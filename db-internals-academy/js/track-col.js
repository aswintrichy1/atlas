/* =====================================================================
   LEDGER · Columnar & MPP Engines
   window.TRACKS.col — modules: columnar / mpp / formats

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.

   Vendor internals evolve between releases; the lessons teach the
   durable mechanisms and soften numbers that vary by product/version.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
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

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function lcg(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function fmtBytes(n) {
    if (!isFinite(n) || n < 0) return "n/a";
    var units = ["B", "KB", "MB", "GB", "TB", "PB"];
    var i = 0;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)) + " " + units[i];
  }

  function bitsFor(x) {
    if (!(x > 0)) return 1;
    return Math.max(1, Math.ceil(Math.log(x + 1) / Math.LN2));
  }

  function bar(pct, color) {
    pct = Math.max(0.6, Math.min(100, pct));
    return h("span", { style: "display:block;height:12px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
      h("i", { style: "display:block;height:100%;width:" + pct.toFixed(2) + "%;background:" + color }));
  }

  var Widgets = {};

  /* ==================================================================
     1. colRowCol — bytes read: row store vs column store
  ================================================================== */
  Widgets.colRowCol = function (mount) {
    shell(mount, "calculator", "Bytes read: row store vs column store",
      "A table with C columns of 8-byte values and R rows. Your query touches k columns. A row store reads whole rows; a column store reads only the k columns it needs, usually compressed.");
    var state = { C: 50, R: 100000000, k: 3, comp: 3 };
    var WIDTH = 8;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var kLabel = h("span", { style: "font-family:var(--font-mono);font-size:0.84rem;color:var(--text)" }, "k = 3");
    var kInput = h("input", { type: "range", min: "1", max: "10", step: "1", value: "3", "aria-label": "columns touched" });
    kInput.addEventListener("input", function () {
      var v = parseInt(kInput.value, 10);
      state.k = isNaN(v) ? 1 : Math.max(1, Math.min(10, v));
      paint();
    });

    function strip(label, cells, litFn) {
      var row = h("div", { style: "display:flex;align-items:center;gap:8px;margin:4px 0" });
      row.appendChild(h("span", { style: "width:110px;font-size:0.8rem;color:var(--text-dim)" }, label));
      var box = h("div", { style: "display:flex;gap:2px;flex-wrap:wrap" });
      for (var i = 0; i < cells; i++) {
        var lit = litFn(i);
        box.appendChild(h("span", { style: "display:inline-block;width:12px;height:14px;border-radius:2px;border:1px solid " +
          (lit ? "var(--cyan-ink)" : "var(--line)") + ";background:" +
          (lit ? "color-mix(in srgb, var(--cyan) 45%, transparent)" : "var(--surface-solid)") }));
      }
      if (state.C > cells) box.appendChild(h("span", { style: "font-size:0.8rem;color:var(--text-dim);margin-left:4px" }, "+" + (state.C - cells) + " more"));
      row.appendChild(box);
      return row;
    }

    function paint() {
      kLabel.textContent = "k = " + state.k;
      var rowBytes = state.R * state.C * WIDTH;
      var colRaw = state.R * state.k * WIDTH;
      var colBytes = colRaw / state.comp;
      var shown = Math.min(state.C, 24);
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin:0 0 6px" }, "Highlighted cells are bytes the engine must read for one row's worth of the table."));
      stage.appendChild(strip("row store", shown, function () { return true; }));
      stage.appendChild(strip("column store", shown, function (i) { return i < state.k; }));
      var grid = h("div", { style: "display:grid;grid-template-columns:110px 1fr 90px;gap:8px;align-items:center;margin-top:10px;font-size:0.84rem" });
      grid.appendChild(h("span", { style: "color:var(--text)" }, "row store"));
      grid.appendChild(bar(100, "var(--rose)"));
      grid.appendChild(h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, fmtBytes(rowBytes)));
      grid.appendChild(h("span", { style: "color:var(--text)" }, "column store"));
      grid.appendChild(bar(colBytes / rowBytes * 100, "var(--cyan)"));
      grid.appendChild(h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, fmtBytes(colBytes)));
      stage.appendChild(grid);
      var secRow = rowBytes / 2e9, secCol = colBytes / 2e9;
      clear(readout);
      readout.appendChild(ro("row store reads", fmtBytes(rowBytes)));
      readout.appendChild(ro("column store reads", fmtBytes(colBytes)));
      readout.appendChild(ro("I/O reduction", Math.round(rowBytes / colBytes) + "x"));
      readout.appendChild(ro("scan @ 2 GB/s", secRow.toFixed(secRow < 10 ? 2 : 0) + " s vs " + secCol.toFixed(secCol < 10 ? 2 : 0) + " s"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[10, "10 cols"], [50, "50 cols"], [200, "200 cols"]], 1, function (v) { state.C = v; paint(); }),
      segment([[1000000, "1M rows"], [100000000, "100M rows"], [1000000000, "1B rows"]], 1, function (v) { state.R = v; paint(); }),
      segment([[1, "no compression"], [3, "light ~3x"], [8, "strong ~8x"]], 1, function (v) { state.comp = v; paint(); }),
      h("label", { class: "w-field", style: "display:flex;align-items:center;gap:8px" }, "columns touched", kInput, kLabel)
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. colEncoding — encoding sizes for four sample columns
  ================================================================== */
  var ENC_N = 10000;
  var COUNTRIES = ["United States", "India", "Germany", "Brazil", "Japan", "France", "Canada", "Mexico", "Australia", "Spain", "Kenya", "Norway"];
  var ENC_COLS = {
    ids: { label: "sorted order ids", kind: "int" },
    country: { label: "country (12 values)", kind: "str" },
    ts: { label: "event timestamps", kind: "int" },
    floats: { label: "random floats", kind: "float" }
  };

  function genColumn(name) {
    var r = lcg(name === "ids" ? 7 : name === "country" ? 11 : name === "ts" ? 13 : 17);
    var out = [], i, t = 1767225600;
    for (i = 0; i < ENC_N; i++) {
      if (name === "ids") out.push(100000 + i);
      else if (name === "country") { var u = r(); out.push(COUNTRIES[Math.min(11, Math.floor(u * u * 12))]); }
      else if (name === "ts") { t += Math.floor(r() * 30); out.push(t); }
      else out.push(Math.round(r() * 1e8) / 1e4);
    }
    return out;
  }

  function reorder(vals, order, kind) {
    var a = vals.slice();
    if (order === "sorted") {
      a.sort(kind === "str" ? function (x, y) { return x < y ? -1 : x > y ? 1 : 0; } : function (x, y) { return x - y; });
    } else if (order === "shuffled") {
      var r = lcg(99);
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
    }
    return a;
  }

  function encodingSizes(vals, kind) {
    var n = vals.length, i;
    var valSize = function (v) { return kind === "str" ? String(v).length + 4 : 8; };
    var raw = 0;
    for (i = 0; i < n; i++) raw += valSize(vals[i]);
    var rle = 0;
    for (i = 0; i < n; i++) if (i === 0 || vals[i] !== vals[i - 1]) rle += valSize(vals[i]) + 4;
    var seen = {}, distinct = 0, dictBytes = 0;
    for (i = 0; i < n; i++) {
      var key = "k" + vals[i];
      if (!seen[key]) { seen[key] = 1; distinct++; dictBytes += valSize(vals[i]); }
    }
    var dict = dictBytes + Math.ceil(n * bitsFor(distinct - 1) / 8);
    var forPack = NaN, delta = NaN;
    if (kind === "int") {
      var mn = vals[0], mx = vals[0];
      for (i = 1; i < n; i++) { if (vals[i] < mn) mn = vals[i]; if (vals[i] > mx) mx = vals[i]; }
      forPack = 8 + Math.ceil(n * bitsFor(mx - mn) / 8);
      var maxZ = 0;
      for (i = 1; i < n; i++) {
        var d = vals[i] - vals[i - 1];
        var z = d >= 0 ? 2 * d : -2 * d - 1;
        if (z > maxZ) maxZ = z;
      }
      delta = 8 + Math.ceil((n - 1) * bitsFor(maxZ) / 8);
    }
    return { raw: raw, rle: rle, dict: dict, forPack: forPack, delta: delta, distinct: distinct };
  }

  Widgets.colEncoding = function (mount) {
    shell(mount, "lab", "Encoding lab: which trick wins on which column?",
      "Ten thousand values per column, encoded for real in your browser. Pick a column and a row order, then compare run-length, dictionary, frame-of-reference bit-packing and delta encoding against the raw size.");
    var cache = {};
    var state = { col: "country", order: "loaded" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function base(name) { if (!cache[name]) cache[name] = genColumn(name); return cache[name]; }

    function paint() {
      var meta = ENC_COLS[state.col] || ENC_COLS.country;
      var vals = reorder(base(state.col), state.order, meta.kind);
      var s = encodingSizes(vals, meta.kind);
      var rows = [
        ["raw (plain)", s.raw, "var(--text-dim)"],
        ["run-length (RLE)", s.rle, "var(--amber)"],
        ["dictionary + bit-packed codes", s.dict, "var(--violet)"],
        ["frame-of-reference + bit-pack", s.forPack, "var(--cyan)"],
        ["delta + bit-pack", s.delta, "var(--lime)"]
      ];
      var maxV = 0, i, best = null;
      for (i = 0; i < rows.length; i++) {
        if (isFinite(rows[i][1]) && rows[i][1] > maxV) maxV = rows[i][1];
        if (i > 0 && isFinite(rows[i][1]) && (!best || rows[i][1] < best[1])) best = rows[i];
      }
      clear(stage);
      var sample = vals.slice(0, 8).join(", ");
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim);margin:0 0 8px;overflow-wrap:anywhere" }, "first values: " + sample + ", ..."));
      var grid = h("div", { style: "display:grid;grid-template-columns:210px 1fr 90px;gap:8px;align-items:center;font-size:0.84rem" });
      for (i = 0; i < rows.length; i++) {
        var v = rows[i][1];
        var na = !isFinite(v);
        grid.appendChild(h("span", { style: "color:var(--text)" }, rows[i][0]));
        grid.appendChild(na ? h("span", { style: "font-size:0.8rem;color:var(--text-dim)" }, meta.kind === "str" ? "not for strings (apply to dictionary codes)" : "not for floats (engines use XOR or byte-split schemes)") : bar(v / maxV * 100, rows[i][2]));
        grid.appendChild(h("span", { style: "font-family:var(--font-mono);color:" + (na ? "var(--text-dim)" : v > s.raw ? "var(--rose-ink)" : "var(--text)") }, na ? "n/a" : fmtBytes(v)));
      }
      stage.appendChild(grid);
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin-top:10px;line-height:1.5" },
        "Sizes in red are larger than raw: the encoding hurts on this data. Real formats pick an encoding per column chunk and then usually run a general-purpose codec on top."));
      clear(readout);
      readout.appendChild(ro("distinct values", s.distinct));
      readout.appendChild(ro("raw", fmtBytes(s.raw)));
      readout.appendChild(ro("best", best ? best[0] : "raw"));
      readout.appendChild(ro("ratio", best && best[1] < s.raw ? (s.raw / best[1]).toFixed(1) + "x" : "1.0x (nothing beats raw)"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["ids", "Sorted ids"], ["country", "Country"], ["ts", "Timestamps"], ["floats", "Random floats"]], 1, function (v) { state.col = v; paint(); }),
      segment([["loaded", "As loaded"], ["sorted", "Sorted"], ["shuffled", "Shuffled"]], 0, function (v) { state.order = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. colPrune — zone maps / micro-partition pruning
  ================================================================== */
  var PRUNE_PARTS = 48;
  var PRUNE_DAYS = 365;
  var PRUNE_MB = 16;

  function partitionRanges(layout) {
    var r = lcg(layout === "random" ? 31 : 37);
    var out = [], i;
    for (i = 0; i < PRUNE_PARTS; i++) {
      var lo, hi;
      if (layout === "clustered") {
        lo = Math.floor(i * PRUNE_DAYS / PRUNE_PARTS);
        hi = Math.floor((i + 1) * PRUNE_DAYS / PRUNE_PARTS) - 1;
      } else if (layout === "partial") {
        var c = Math.floor((i + 0.5) * PRUNE_DAYS / PRUNE_PARTS);
        lo = Math.max(0, c - 30 - Math.floor(r() * 20));
        hi = Math.min(PRUNE_DAYS - 1, c + 30 + Math.floor(r() * 20));
      } else {
        lo = Math.floor(r() * 40);
        hi = PRUNE_DAYS - 1 - Math.floor(r() * 40);
      }
      out.push([lo, hi]);
    }
    return out;
  }

  Widgets.colPrune = function (mount) {
    shell(mount, "pruning", "Partition pruning with min/max metadata",
      "A year of events stored in 48 immutable partitions, each with min/max of event_day in its metadata. The query filters a date range ending on day 200. Partitions whose range cannot overlap are skipped without being read.");
    var state = { layout: "clustered", span: 7 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var parts = partitionRanges(state.layout);
      var hiQ = 200, loQ = hiQ - state.span + 1;
      var scanned = 0, i;
      clear(stage);
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:0.82rem;color:var(--text);margin:0 0 8px" },
        "WHERE event_day BETWEEN " + loQ + " AND " + hiQ));
      var grid = h("div", { style: "display:grid;grid-template-columns:repeat(8, minmax(0, 1fr));gap:4px" });
      for (i = 0; i < parts.length; i++) {
        var p = parts[i];
        var hit = p[0] <= hiQ && p[1] >= loQ;
        if (hit) scanned++;
        grid.appendChild(h("div", {
          title: "P" + i + ": days " + p[0] + "-" + p[1],
          style: "padding:4px 2px;border-radius:5px;text-align:center;font-family:var(--font-mono);font-size:0.78rem;line-height:1.25;border:1px solid " +
            (hit ? "var(--rose-ink)" : "var(--line)") + ";background:" +
            (hit ? "color-mix(in srgb, var(--rose) 22%, transparent)" : "var(--surface-solid)") +
            ";color:" + (hit ? "var(--text)" : "var(--text-dim)")
        }, "P" + i, h("br", {}), p[0] + "-" + p[1]));
      }
      stage.appendChild(grid);
      var depthSum = 0, samples = 0, d;
      for (d = 0; d < PRUNE_DAYS; d += 7) {
        var c = 0;
        for (i = 0; i < parts.length; i++) if (parts[i][0] <= d && parts[i][1] >= d) c++;
        depthSum += c; samples++;
      }
      var depth = samples ? depthSum / samples : 0;
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin-top:10px;line-height:1.5" },
        state.layout === "clustered" ? "Loaded in date order: each partition covers a narrow, non-overlapping slice, so the metadata excludes almost everything."
          : state.layout === "partial" ? "Mostly ordered with overlap (late-arriving data, parallel loaders): pruning still helps, but each day lives in several partitions."
          : "Loaded with no relation to date: every partition spans nearly the whole year, so min/max proves nothing and the engine scans it all."));
      clear(readout);
      readout.appendChild(ro("partitions scanned", scanned + " / " + PRUNE_PARTS));
      readout.appendChild(ro("pruned", Math.round((PRUNE_PARTS - scanned) / PRUNE_PARTS * 100) + "%"));
      readout.appendChild(ro("bytes read", fmtBytes(scanned * PRUNE_MB * 1e6)));
      readout.appendChild(ro("avg clustering depth", depth.toFixed(1)));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["clustered", "Clustered by date"], ["partial", "Partially clustered"], ["random", "Unclustered"]], 0, function (v) { state.layout = v; paint(); }),
      segment([[1, "1 day"], [7, "1 week"], [30, "1 month"], [90, "1 quarter"]], 1, function (v) { state.span = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "col-columnar": {
      title: "Columnar storage checkpoint",
      sub: "Row vs column layout, encodings, vectorized execution and late materialization.",
      questions: [
        {
          q: "An analytics query aggregates 2 of a table's 80 columns over 500 million rows. What is the main reason a column store reads far fewer bytes than a row store?",
          options: [
            "It caches whole rows in memory more aggressively",
            "It keeps a B+tree on every column",
            "It reads only the two needed columns, and those homogeneous columns compress well",
            "It skips the write-ahead log during reads"
          ],
          answer: 2,
          explain: "A row store has to pull every page that holds the rows, which means all 80 columns. A column store keeps each column in its own chunks, so it reads 2 of 80 columns, roughly 40x less before compression. Compression then shrinks those two columns further."
        },
        {
          q: "Which encoding is the best fit for a sorted, monotonically increasing order_id column?",
          options: [
            "Delta encoding followed by bit-packing",
            "Dictionary encoding",
            "Run-length encoding",
            "No encoding, only a general-purpose codec"
          ],
          answer: 0,
          explain: "Consecutive sorted ids differ by tiny amounts, so storing deltas turns large 64-bit values into numbers that fit in a few bits each. Every value is distinct, so dictionary encoding needs a dictionary as big as the column. RLE needs repeated values, and there are none."
        },
        {
          q: "Why does vectorized execution usually beat tuple-at-a-time (iterator) execution on analytic queries?",
          options: [
            "It avoids reading from disk entirely",
            "It runs every query on a GPU",
            "It assembles full rows earlier in the plan",
            "It spreads the per-call interpretation overhead over a batch of roughly 1-2K values and runs tight, SIMD-friendly loops over arrays that stay in cache"
          ],
          answer: 3,
          explain: "The iterator model pays a virtual call, branches and type dispatch for every row in every operator. Processing a vector of about a thousand values per call pays that overhead once per batch. The inner loop becomes a simple loop over a typed array that the CPU can pipeline and vectorize."
        },
        {
          q: "What does late materialization mean in a column store?",
          options: [
            "Results are written to disk only at commit time",
            "Filters run on a few columns first, and the other columns are fetched only for the row positions that survive",
            "Compression is deferred until the nightly merge",
            "Indexes are built after the load finishes"
          ],
          answer: 1,
          explain: "The engine evaluates predicates column by column and produces a list or bitmap of qualifying positions. Only then does it read the other projected columns, and only at those positions. With a selective filter, most values of the wide columns are never decoded."
        },
        {
          q: "A country column holds 12 distinct values in random row order. Which approach typically gives the smallest encoding?",
          options: [
            "Run-length encoding on the raw strings",
            "Delta encoding on the strings",
            "Dictionary encoding with bit-packed codes",
            "Frame-of-reference on the string lengths"
          ],
          answer: 2,
          explain: "In random order the runs are short, so RLE stores nearly one run per value. A dictionary maps the 12 strings to codes that fit in 4 bits each, replacing strings of about 10 bytes with half a byte. If the column were sorted, RLE on top of the codes would shrink it further."
        }
      ]
    },
    "col-mpp": {
      title: "Pruning and MPP checkpoint",
      sub: "Zone maps, micro-partitions, distribution, joins and how the big warehouses differ.",
      questions: [
        {
          q: "A table keeps min/max of event_date per micro-partition and was loaded in time order. A query filters on yesterday's date. What happens?",
          options: [
            "Every partition is scanned, then filtered",
            "Most partitions are skipped using metadata alone, because their date ranges cannot contain yesterday",
            "The engine first builds a B-tree on event_date",
            "The query falls back to shuffling the whole table"
          ],
          answer: 1,
          explain: "Loading in time order gives each partition a narrow, mostly non-overlapping date range. The planner compares the predicate with each partition's min/max and drops every partition that cannot match before any data is read. That is pruning, and it only works because the data is clustered on the filter column."
        },
        {
          q: "You join a 2 TB fact table with a 50 MB dimension across 32 nodes. The fact table is not distributed on the join key. Which strategy is usually best?",
          options: [
            "Shuffle both tables on the join key",
            "Send both tables to the leader node",
            "Run a nested-loop join on each node",
            "Broadcast the dimension to every node and join locally against the fact rows already there"
          ],
          answer: 3,
          explain: "Broadcasting copies 50 MB to each of 32 nodes, about 1.6 GB of traffic, and the 2 TB fact table never moves. Shuffling both sides would push most of the 2 TB across the network. Broadcast wins whenever one side is small compared with the cost of repartitioning the other."
        },
        {
          q: "What is the key benefit of separating storage from compute (as Snowflake, BigQuery and Redshift RA3 do) compared with classic shared-nothing?",
          options: [
            "Compute can be resized or isolated per workload without redistributing data, because the data lives in shared storage",
            "Queries never need the network",
            "Data no longer needs a columnar format",
            "Single-row updates become cheap"
          ],
          answer: 0,
          explain: "In shared-nothing, each node owns a slice of the data, so adding nodes means rebalancing it. With shared object storage, you can start, stop or add compute clusters in seconds to minutes, and several clusters can read the same data. The cost is network reads from object storage, which engines hide with local SSD caches."
        },
        {
          q: "In Redshift, two large tables are almost always joined on customer_id. Which distribution choice fits best?",
          options: [
            "DISTSTYLE ALL on both tables",
            "DISTSTYLE EVEN on both tables",
            "DISTKEY(customer_id) on both, so matching rows land on the same slice",
            "No distribution at all; rely on sort keys"
          ],
          answer: 2,
          explain: "Hash-distributing both tables on the join key co-locates matching rows, so the join runs slice-local with no redistribution. ALL copies a table to every node, which only suits small dimensions. EVEN spreads rows round-robin and forces a shuffle or broadcast at join time."
        },
        {
          q: "What is a slot in BigQuery?",
          options: [
            "A reserved block of storage in the distributed file system",
            "A unit of compute capacity (CPU, memory, I/O) that the scheduler hands to query stages",
            "A row group inside a Capacitor file",
            "A dedicated virtual machine assigned to each user"
          ],
          answer: 1,
          explain: "BigQuery splits a query into stages of many parallel tasks and schedules them on slots, its abstract unit of compute. On-demand queries draw from a shared pool, while reservations buy dedicated slot capacity. Storage is separate and billed on its own, which is why slots say nothing about where data lives."
        }
      ]
    },
    "col-formats": {
      title: "Formats and writes checkpoint",
      sub: "Parquet anatomy, open table formats, snapshots and why columnar writes are batch-shaped.",
      questions: [
        {
          q: "Where does a Parquet file keep the per-column min/max statistics and offsets that a reader uses first to skip whole row groups?",
          options: [
            "In a separate index file next to the data file",
            "Only in the header of each data page",
            "In the object store's metadata tags",
            "In the footer metadata, which the reader fetches first"
          ],
          answer: 3,
          explain: "A Parquet reader seeks to the end of the file, reads the footer length and magic bytes, then reads the footer. The footer holds the schema, each row group's column chunk offsets and their statistics. With that the reader can skip row groups and fetch only the column chunks it needs."
        },
        {
          q: "Why can an Iceberg table support time travel?",
          options: [
            "It keeps a write-ahead log that it replays backwards",
            "Each commit creates a new snapshot that points to an immutable set of data files, and older snapshots keep referencing their files until they expire",
            "It copies the whole table on every commit",
            "Object stores version every file automatically"
          ],
          answer: 1,
          explain: "Data files are never modified in place. A commit writes new files plus new metadata that lists the live files, and then atomically swaps the table's current-metadata pointer. Reading an older snapshot just means following an older metadata tree, which works until snapshot expiry deletes the unreferenced files."
        },
        {
          q: "Why is a single-row UPDATE expensive in a columnar warehouse?",
          options: [
            "Data files are immutable and compressed per column, so the engine must rewrite, or mark deletes in, the whole file or partition that holds the row",
            "Columnar engines lock the whole database for every update",
            "Every update rebuilds all B-tree indexes on the table",
            "Each update forces a full vacuum before it can commit"
          ],
          answer: 0,
          explain: "A row's values are spread across many compressed column chunks inside an immutable file. Changing one value means decoding and rewriting the file, or recording a delete and writing the new row elsewhere. Either way, one logical row turns into megabytes of physical work, so warehouses favour batched MERGE over row-by-row DML."
        },
        {
          q: "Which statement correctly contrasts copy-on-write with merge-on-read for table-format updates?",
          options: [
            "Copy-on-write is faster for writes; merge-on-read is faster for reads",
            "They are the same strategy with different names",
            "Copy-on-write rewrites the affected files at write time, so reads stay cheap; merge-on-read writes small delete or delta files and reconciles them during reads until compaction",
            "Merge-on-read only works on row stores"
          ],
          answer: 2,
          explain: "Copy-on-write pays at write time: it rewrites every file that holds a changed row, and readers see clean files. Merge-on-read writes small delete or delta files quickly, and every reader merges them in until a compaction folds them back. Pick based on whether the table is write-heavy or read-heavy."
        },
        {
          q: "A pipeline commits one row per second into an Iceberg table, each as its own commit. What is the likely result?",
          options: [
            "Faster queries, because the data is always fresh",
            "Automatic clustering of the table",
            "Lower storage cost",
            "Thousands of tiny files and snapshots that bloat metadata and slow query planning, so you should batch commits and compact"
          ],
          answer: 3,
          explain: "Each commit writes at least one new data file plus new metadata. At one row per commit you get files of a few kilobytes with almost no compression benefit, and the planner must open huge manifests. Batch writes into larger commits, compact small files on a schedule and expire old snapshots."
        },
        {
          q: "Two Spark jobs commit to the same Iceberg table at the same moment: one appends new files, the other appends to a different partition. What happens?",
          options: ["Both commits are lost and must be rerun", "The table is locked until an administrator intervenes", "One commit's pointer swap fails, it re-reads the new snapshot, finds no overlapping files, and retries successfully on top", "The second job silently overwrites the first job's files"],
          answer: 2,
          explain: "Table formats commit optimistically by atomically swapping the metadata pointer or adding the next log entry. The loser validates against the winner's changes; pure appends do not conflict, so it simply commits a new snapshot on top. Rewrites or deletes of the same files would conflict and fail."
        },
        {
          q: "Why can an Iceberg table rename a column or change its partitioning from daily to hourly without rewriting existing data files?",
          options: ["Columns are tracked by permanent field ids, and each data file records the partition spec it was written with, so both changes are metadata-only", "Iceberg rewrites all files in the background automatically", "Parquet files store columns by position, so names do not matter", "Iceberg forbids old snapshots from being read after such a change"],
          answer: 0,
          explain: "Field ids decouple stored data from column names, so a rename changes only metadata and a recycled name cannot pick up old data. Partition specs are versioned per file, so new files use the new spec while old files keep theirs and the planner prunes both."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.col = {
    id: "col",
    name: "Columnar & MPP Engines",
    short: "COL",
    tagline: "Why warehouses scan billions of rows in seconds",
    color: "#2dd4bf",
    blurb: "How analytic engines really work. Start with row vs column layout, compression and encodings, vectorized execution and late materialization. Then cover pruning with zone maps and micro-partitions, MPP shuffles and broadcasts, and how Snowflake, Redshift, BigQuery and DuckDB differ. Finish with Parquet anatomy, open table formats with snapshots and time travel, running Iceberg and Delta tables (optimistic commits, schema and partition evolution, compaction), time-series engines, and why single-row writes hurt a column store.",
    modules: [
      /* ------------------------------------------------------------ */
      {
        id: "columnar",
        name: "Columnar Storage & Execution",
        icon: "grid",
        lessons: [
          {
            id: "row-vs-column",
            title: "Row stores vs column stores: OLTP and OLAP",
            summary: "The same table laid out two ways, and why the layout decides which workload is cheap.",
            minutes: 9,
            tags: ["columnar", "oltp", "olap", "storage-layout"],
            blocks: [
              { t: "p", html: "Hold this picture: a table is a grid, and the disk is a single line of bytes. A <strong>row store</strong> writes the grid one row at a time, so all of a row's fields sit next to each other. A <strong>column store</strong> writes it one column at a time, so all values of one column sit next to each other. Everything else in this track follows from that choice." },
              { t: "diagram", id: "row-vs-col", caption: "The same three rows, serialized row by row (top) and column by column (bottom)." },
              { t: "h", text: "Two workloads, two shapes of access" },
              { t: "table", headers: ["", "OLTP (transactions)", "OLAP (analytics)"], rows: [
                ["Typical query", "Fetch or update one order by id", "Sum revenue by region over two years"],
                ["Rows touched", "1 to a few hundred", "Millions to billions"],
                ["Columns touched", "Most of the row", "A handful out of dozens or hundreds"],
                ["Write pattern", "Many small concurrent writes", "Bulk loads, occasional batch updates"],
                ["Latency target", "Sub-millisecond to milliseconds", "Seconds; throughput matters more"],
                ["Natural layout", "Row store (PostgreSQL, MySQL/InnoDB, SQL Server rowstore)", "Column store (Snowflake, BigQuery, Redshift, DuckDB)"]
              ] },
              { t: "h", text: "What the bytes look like" },
              { t: "code", lang: "text", code:
                "orders(id, region, amount, status)\n" +
                "  (1, 'EU', 40.0, 'paid') (2, 'US', 15.5, 'open') (3, 'EU', 99.0, 'paid')\n\n" +
                "row layout   : [1|EU|40.0|paid] [2|US|15.5|open] [3|EU|99.0|paid]\n" +
                "column layout: id     -> [1, 2, 3]\n" +
                "               region -> [EU, US, EU]\n" +
                "               amount -> [40.0, 15.5, 99.0]\n" +
                "               status -> [paid, open, paid]"
              },
              { t: "p", html: "Now run <code class='tok'>SELECT region, SUM(amount) FROM orders GROUP BY region</code> on 100 million rows with 50 columns of about 8 bytes each. The row store reads every page, so about <strong>40 GB</strong>. The column store reads two columns, so about <strong>1.6 GB</strong> raw. Those two columns are homogeneous and compress well, so the real read is often a few hundred megabytes. That roughly 100x difference comes from layout, not from cleverer code." },
              { t: "widget", id: "colRowCol" },
              { t: "h", text: "The price of the column layout" },
              { t: "compare",
                bad: { title: "Where column stores hurt", items: ["Fetching one full row means one read per column, then stitching them together", "Inserting one row touches every column's file", "Updating one value rewrites a compressed, immutable chunk", "High-concurrency point lookups are not what they are built for"] },
                good: { title: "Where column stores win", items: ["Scans read only the columns a query names", "Similar values side by side compress 3-10x or more", "Tight loops over typed arrays suit modern CPUs", "Min/max metadata per chunk lets whole chunks be skipped"] } },
              { t: "note", variant: "trap", html: "<code class='tok'>SELECT *</code> throws away the main advantage of a column store. On a 200-column table it forces every column to be read and decoded. In warehouses billed by bytes scanned, it is also the fastest way to waste money." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"why is the warehouse faster than Postgres for this report?\""], rows: [
                ["Naive", "\"It is a bigger, faster database.\" (Names no mechanism.)"],
                ["Solid", "\"It stores data by column, so the report reads only the 3 columns it needs instead of whole rows, and those columns compress well.\""],
                ["Standout", "Solid, plus: the bytes-read arithmetic, vectorized execution on compressed data, pruning via per-chunk min/max, and the cost: slow point lookups and expensive single-row updates, which is why OLTP stays on a row store and is replicated out."]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"dashboards are slow on the production database\", \"aggregate over billions of events\", \"only a few columns of a wide table\". Reach for columnar layout, and say what it costs for point reads and updates." },
              { t: "note", variant: "key", html: "<strong>Layout decides cost.</strong> Row stores make one-row reads and writes cheap; column stores make reading a few columns of many rows cheap. Pick the layout that matches how the workload touches the data, and name what the other side costs." }
            ]
          },
          {
            id: "compression-encoding",
            title: "Compression and encodings: RLE, dictionary, delta, bit-packing",
            summary: "Why columns compress so well, which lightweight encoding fits which data, and where general-purpose codecs come in.",
            minutes: 11,
            tags: ["columnar", "compression", "encoding", "rle", "dictionary"],
            blocks: [
              { t: "p", html: "A column holds one type, often from a small domain, often in a meaningful order. That makes it much more predictable than a row, which mixes an integer, a string, a float and a date. Column engines use this in two layers: <strong>lightweight encodings</strong> that exploit the structure of the values, then optionally a <strong>general-purpose codec</strong> that squeezes the remaining bytes." },
              { t: "h", text: "The lightweight encodings" },
              { t: "table", headers: ["Encoding", "How it works", "Wins when", "Loses when"], rows: [
                ["<strong>Run-length (RLE)</strong>", "Store (value, run length) pairs", "Long runs of repeats: sorted low-cardinality columns, flags", "Values change every row: runs of length 1 add overhead"],
                ["<strong>Dictionary</strong>", "Store each distinct value once; the column becomes small integer codes", "Few distinct values (country, status, SKU category)", "Near-unique values: the dictionary is as big as the data"],
                ["<strong>Delta</strong>", "Store the first value, then differences between neighbours", "Sorted or slowly changing integers: ids, timestamps", "Random order: deltas are as large as the values"],
                ["<strong>Frame-of-reference (FOR)</strong>", "Subtract a block minimum; store small offsets", "Values clustered in a narrow range per block", "One outlier widens the whole block (patched variants handle this)"],
                ["<strong>Bit-packing</strong>", "Use exactly as many bits as the largest value needs", "Small integers, such as codes, deltas and offsets", "Rarely used alone; it is the final step of the others"]
              ] },
              { t: "code", lang: "text", code:
                "status   : paid paid paid paid open open paid      RLE  -> (paid,4)(open,2)(paid,1)\n" +
                "country  : DE IN DE US IN DE                        dict -> {DE:0, IN:1, US:2}  codes 0 1 0 2 1 0  (2 bits each)\n" +
                "ts (sec) : 1767225600 1767225612 1767225619 ...     delta -> 1767225600, +12, +7, ...  (5 bits each)\n" +
                "price    : 1003 1010 1001 1007 (block min 1001)     FOR  -> base 1001, offsets 2 9 0 6  (4 bits each)"
              },
              { t: "widget", id: "colEncoding" },
              { t: "h", text: "Encodings stack" },
              { t: "p", html: "Real engines chain them. Dictionary encoding produces small integer codes, then <strong>RLE or bit-packing</strong> runs on the codes. Delta produces small integers, then <strong>bit-packing</strong> stores them in 3-8 bits instead of 64. Parquet's default dictionary path, for example, writes a dictionary page and then a hybrid of RLE and bit-packing for the codes. Writers usually pick an encoding per column chunk, and some fall back to plain encoding when a dictionary grows too large." },
              { t: "h", text: "General-purpose codecs on top" },
              { t: "table", headers: ["Codec", "Character", "Typical use"], rows: [
                ["Snappy / LZ4", "Very fast to decompress, moderate ratio", "Hot data, interactive scans, a common default"],
                ["ZSTD", "Tunable level; good ratio at good speed", "Increasingly the default for warehouse and lake files"],
                ["Gzip / Deflate", "Higher ratio, slower to decode", "Archival or bandwidth-bound transfers"]
              ] },
              { t: "stat", items: [
                { v: "3-10x", k: "typical columnar compression on real business data" },
                { v: "4 bits", k: "per value for a 12-value dictionary code" },
                { v: "~0", k: "gain on random floats from integer encodings" }
              ] },
              { t: "p", html: "Lightweight encodings have a second advantage: some operators can <strong>work on encoded data directly</strong>. A filter <code class='tok'>country = 'DE'</code> becomes an integer compare on dictionary codes. A <code class='tok'>COUNT</code> over an RLE run is one addition, not thousands. A general-purpose codec has to be fully decompressed before anything can read the values." },
              { t: "note", variant: "tip", html: "Sort order is a compression knob. Sorting by a low-cardinality column first creates long runs for RLE and narrow ranges for FOR, and it also helps pruning. That is why sort keys and clustering keys matter twice." },
              { t: "note", variant: "warn", html: "High-cardinality strings (UUIDs, free text, URLs) defeat dictionaries and runs. They end up plain-encoded plus a codec, and they often dominate a table's footprint. Keep them out of hot scan paths, or store a hash or surrogate key alongside them." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"storage costs are exploding\", \"why is this column so big\", \"should we sort before loading\". Talk about cardinality, row order, the encoding each column gets, and which codec is layered on top." },
              { t: "note", variant: "key", html: "<strong>Match the encoding to the data's shape.</strong> Few distinct values: dictionary. Long repeats: RLE. Ordered integers: delta. Narrow ranges: frame-of-reference. Finish with bit-packing and a fast codec. Row order decides how well all of them work." }
            ]
          },
          {
            id: "vectorized-execution",
            title: "Vectorized execution and late materialization",
            summary: "Why processing ~1-2K values per call beats one row per call, and why engines delay assembling rows.",
            minutes: 11,
            tags: ["columnar", "vectorized", "simd", "late-materialization", "execution"],
            blocks: [
              { t: "p", html: "Reading fewer bytes is only half of what makes an analytic engine fast. The other half is what the CPU does with those bytes. The classic <strong>iterator (Volcano) model</strong> pulls one row at a time through a tree of operators. That is elegant, but on a billion rows the per-row overhead becomes the real cost." },
              { t: "h", text: "Tuple-at-a-time: overhead per row, per operator" },
              { t: "code", lang: "text", code:
                "while (row = agg.next())          // each next() is a virtual call\n" +
                "  -> filter.next()                // which calls its child...\n" +
                "     -> scan.next()               // ...one row at a time\n" +
                "        decode one value, check type, evaluate predicate tree, return\n\n" +
                "1e9 rows x 3 operators x (call + branches + type dispatch) = billions of tiny, unpredictable steps"
              },
              { t: "p", html: "Each call is cheap on its own, but the CPU spends more time on function calls, branch mispredictions and interpreting the expression tree than on actual arithmetic. Its instruction cache and branch predictor never settle into a pattern." },
              { t: "h", text: "Vectorized: overhead per batch" },
              { t: "code", lang: "python", code:
                "# each operator processes a vector (batch) of ~1024-2048 values per call\n" +
                "def filter_gt(values, threshold, out_sel):\n" +
                "    n = 0\n" +
                "    for i in range(len(values)):      # in C/C++: a tight loop the compiler can turn into SIMD\n" +
                "        out_sel[n] = i\n" +
                "        n += values[i] > threshold    # branch-free: write the index, advance only if it passes\n" +
                "    return n                          # selection vector: positions that survived\n"
              },
              { t: "stat", items: [
                { v: "~1-2K", k: "values per vector (DuckDB's default is 2048)" },
                { v: "L1/L2", k: "a vector of a few columns stays cache-resident" },
                { v: "1 call", k: "of interpretation overhead per batch instead of per row" }
              ] },
              { t: "ul", items: [
                "<strong>Amortization</strong>: dispatch, type checks and virtual calls happen once per vector.",
                "<strong>SIMD</strong>: a loop over a typed array lets the compiler, or hand-written kernels, compare 8 to 16 values per instruction.",
                "<strong>Cache friendliness</strong>: the batch is sized to fit in cache. Too small and overhead returns; too large and intermediates spill to slower memory.",
                "<strong>Selection vectors</strong>: filters output positions rather than copying data, so downstream operators touch only survivors."
              ] },
              { t: "h", text: "Late materialization" },
              { t: "ol", items: [
                "Evaluate the most selective predicate on its column alone, producing a position list or bitmap.",
                "Apply the next predicate only at those positions, which shrinks the list further.",
                "Fetch the projected columns only at the surviving positions.",
                "Assemble output tuples at the very end, or never, if an aggregate consumes the columns directly."
              ] },
              { t: "table", headers: ["", "Early materialization", "Late materialization"], rows: [
                ["When rows are built", "Right after the scan", "As late as possible, often only for the output"],
                ["Bytes decoded", "Every projected column for every row", "Only the columns needed at each step, only for survivors"],
                ["Best for", "Low-selectivity queries that keep most rows", "Selective filters on wide tables"],
                ["Cost", "Wasted decoding of rows later filtered out", "Bookkeeping for positions; re-reading columns at random offsets"]
              ] },
              { t: "h", text: "Vectorized vs compiled: two answers to the same problem" },
              { t: "table", headers: ["Approach", "Idea", "Examples"], rows: [
                ["Vectorized interpretation", "Precompiled kernels per type and operator, each run on batches", "DuckDB, ClickHouse, Snowflake (broadly), Vectorwise lineage"],
                ["Query compilation", "Generate machine code per query that fuses operators into one loop, keeping values in registers", "HyPer/Umbra lineage, Spark's whole-stage code generation"]
              ] },
              { t: "p", html: "Both approaches remove per-row interpretation. Compilation can win on complex expressions, while vectorization is simpler to build, profile and keep portable. Many modern engines mix the two." },
              { t: "note", variant: "trap", html: "\"Vectorized\" does not mean \"uses a GPU\". It means the unit of work is a batch of values rather than a single row. SIMD is a bonus that batching makes possible, not the definition." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Explaining why the engine is fast"], rows: [
                ["Naive", "\"It is written in C++.\""],
                ["Solid", "\"It processes batches of about a thousand values per operator call, which amortizes overhead and uses SIMD.\""],
                ["Standout", "Solid, plus selection vectors, late materialization on selective filters, cache-sized batches, operating on dictionary codes, and the trade-off against query compilation."]
              ] },
              { t: "quiz", id: "col-columnar" },
              { t: "note", variant: "key", html: "<strong>Move work from per row to per batch.</strong> Vectorized engines run tight loops over cache-sized arrays of about 1-2K values, filters emit selection vectors, and full rows are assembled only at the end, so the CPU computes instead of dispatching." }
            ]
          }
        ]
      },
      /* ------------------------------------------------------------ */
      {
        id: "mpp",
        name: "Pruning & MPP Architecture",
        icon: "share",
        lessons: [
          {
            id: "zone-maps-pruning",
            title: "Zone maps, micro-partitions and clustering",
            summary: "Skipping data you never read: min/max metadata per chunk, and why physical order makes or breaks it.",
            minutes: 10,
            tags: ["pruning", "zone-maps", "micro-partitions", "clustering", "snowflake"],
            blocks: [
              { t: "p", html: "The cheapest byte is the one you never read. Analytic engines rarely use B-tree indexes. Instead they keep <strong>small summaries per chunk of data</strong>, at minimum the min and max of each column. Before scanning, the planner checks the predicate against those summaries and drops every chunk that cannot match. This is called <strong>pruning</strong> or <strong>data skipping</strong>." },
              { t: "h", text: "A zone map is just min/max per chunk" },
              { t: "code", lang: "text", code:
                "chunk  rows      event_date min..max        amount min..max\n" +
                "c0     ~100K     2026-01-01 .. 2026-01-07   0.5 .. 980\n" +
                "c1     ~100K     2026-01-07 .. 2026-01-14   0.1 .. 1200\n" +
                "c2     ~100K     2026-01-14 .. 2026-01-21   0.9 .. 760\n\n" +
                "WHERE event_date = '2026-01-17'  ->  c0: skip   c1: skip   c2: scan"
              },
              { t: "p", html: "The check costs microseconds per chunk and needs no maintenance beyond computing the stats at write time, which is easy because chunks are immutable. The catch is that a zone map only helps if the column's values are <strong>physically grouped</strong>. If every chunk spans the whole range, min/max proves nothing." },
              { t: "h", text: "Snowflake micro-partitions" },
              { t: "ul", items: [
                "Tables are split automatically into immutable <strong>micro-partitions</strong>, each holding on the order of 50-500 MB of uncompressed data, stored compressed and columnar in object storage.",
                "The cloud services layer keeps metadata per micro-partition: value ranges per column, distinct-value and null counts, and more.",
                "Pruning happens at compile time against that metadata, so a well-clustered filter can skip most of a large table before a single file is fetched.",
                "Natural clustering comes from load order. Tables loaded by time are naturally clustered on time.",
                "An optional <strong>clustering key</strong> plus automatic reclustering rewrites partitions in the background to restore grouping. It costs compute credits."
              ] },
              { t: "widget", id: "colPrune" },
              { t: "h", text: "Measuring and fixing clustering" },
              { t: "table", headers: ["Signal", "Meaning", "Action"], rows: [
                ["Clustering depth (avg overlapping partitions per value)", "1-2 is excellent; tens or hundreds means pruning is mostly failing", "Add a clustering key on the common filter column, or sort on load"],
                ["Partitions scanned vs total in the query profile", "The direct evidence of pruning", "Compare before and after reclustering"],
                ["Filter wrapped in a function or cast", "Can stop the planner from comparing against min/max", "Filter on the raw column, or use a matching computed key"]
              ] },
              { t: "h", text: "The same idea in other engines" },
              { t: "table", headers: ["Engine", "Unit with min/max", "How you shape the order"], rows: [
                ["Redshift", "1 MB column blocks (zone maps)", "Sort keys, plus VACUUM to re-sort"],
                ["Parquet / lakehouse", "Row group and page statistics; file stats in table-format manifests", "Sort or Z-order on write; compaction"],
                ["BigQuery", "Partitions and clustered storage blocks", "PARTITION BY date, CLUSTER BY up to a few columns"],
                ["DuckDB", "Row groups of roughly 120K rows with per-column stats", "Insert in sorted order"]
              ] },
              { t: "note", variant: "warn", html: "Clustering is not free. Reclustering rewrites immutable data, which costs compute and creates new files and snapshots. Cluster on the one or two columns most queries filter on, usually a date and maybe a tenant id, not on everything." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the query scans the whole table even though it filters by day\", \"bytes scanned is huge\", \"partitions scanned equals total\". Check physical order and min/max pruning before reaching for more compute." },
              { t: "note", variant: "key", html: "<strong>Pruning turns physical order into skipped I/O.</strong> Every immutable chunk carries min/max; the planner skips chunks that cannot match. It only works when data is clustered on the filter column, so load in order or pay to recluster." }
            ]
          },
          {
            id: "mpp-architecture",
            title: "MPP: shared-nothing, separated storage, and distributed joins",
            summary: "How a query fans out across many nodes, and how data moves for joins and aggregations.",
            minutes: 11,
            tags: ["mpp", "shared-nothing", "distributed-joins", "shuffle", "broadcast"],
            blocks: [
              { t: "p", html: "<strong>Massively parallel processing (MPP)</strong> splits one query across many workers. Each worker scans its share, partially aggregates or joins, and exchanges intermediate data with the others. The design questions are where the data lives and how much of it has to cross the network." },
              { t: "h", text: "Two architectures" },
              { t: "table", headers: ["", "Shared-nothing (classic MPP)", "Separated storage and compute"], rows: [
                ["Where data lives", "Each node owns a slice on its local disks", "Shared object storage; nodes cache hot data on local SSD"],
                ["Scaling compute", "Add nodes, then redistribute data", "Start more or bigger clusters; no data moves"],
                ["Workload isolation", "Everyone shares the same nodes", "Separate clusters per team or job over the same data"],
                ["Cost when idle", "Nodes keep running to keep data available", "Compute can suspend; storage is billed separately"],
                ["Weak spot", "Rebalancing, skew, resize downtime", "Cold-cache reads from object storage add latency"],
                ["Examples", "Classic Redshift (DC nodes), Teradata, Greenplum", "Snowflake, BigQuery, Redshift RA3 / serverless"]
              ] },
              { t: "h", text: "Distributing a join" },
              { t: "table", headers: ["Strategy", "What moves", "Use when"], rows: [
                ["<strong>Co-located</strong>", "Nothing: both sides are already partitioned on the join key", "Tables share a distribution key that is also the join key"],
                ["<strong>Broadcast</strong>", "The small side is copied to every node", "One side is small (dimension tables, filtered subsets)"],
                ["<strong>Shuffle (repartition)</strong>", "Both sides are hash-partitioned on the join key across nodes", "Both sides are large and not co-located"]
              ] },
              { t: "code", lang: "text", code:
                "fact = 2 TB, dim = 50 MB, nodes = 32\n\n" +
                "broadcast dim : 50 MB x 32               ~= 1.6 GB on the network\n" +
                "shuffle both  : (2 TB + 50 MB) x 31/32   ~= 1.9 TB on the network\n" +
                "co-located    : 0 bytes (only if both were distributed on the join key)\n\n" +
                "Rule of thumb: broadcast while  size(small) x nodes  <<  size(large)"
              },
              { t: "h", text: "Exchange operators and two-phase aggregation" },
              { t: "p", html: "In the plan, data movement shows up as <strong>exchange</strong> operators (also called redistribute, repartition or shuffle). Aggregations usually run in two phases. Each node pre-aggregates its local rows, which shrinks a billion rows to perhaps a few thousand groups, and only those partial results are shuffled by group key for the final merge. <code class='tok'>COUNT(DISTINCT ...)</code> is harder because partial results cannot shrink as much, which is why engines offer approximate versions such as HyperLogLog." },
              { t: "note", variant: "trap", html: "<strong>Skew kills parallelism.</strong> If 30% of rows share one join or group key (a null, a default tenant, one celebrity customer), the node that gets that key does 30% of the work while the rest wait. The query is only as fast as its slowest worker. Watch for one long-running task in the profile, then salt the hot key or handle it separately." },
              { t: "compare",
                bad: { title: "Designing without the network in mind", items: ["Join two huge tables on a key neither is distributed by", "Distribute on a low-cardinality column (status, country)", "Ignore NULL join keys that all hash to one node", "Resize the cluster to fix a skewed query"] },
                good: { title: "Designing for data movement", items: ["Co-locate the biggest, most frequent join", "Broadcast small dimensions", "Distribute on a high-cardinality, evenly spread key", "Read the plan for exchanges and per-node row counts"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"one node is at 100% while the others idle\", \"the join is slow after the table grew\", \"how would you join two very large tables\". Talk distribution keys, broadcast vs shuffle, and skew." },
              { t: "note", variant: "key", html: "<strong>In MPP the network is the bottleneck.</strong> Co-locate when you can, broadcast what is small, shuffle only what you must, aggregate locally first, and hunt skew. Separated storage makes compute elastic but does not remove the shuffle." }
            ]
          },
          {
            id: "warehouses-compared",
            title: "Snowflake, Redshift, BigQuery and DuckDB under the hood",
            summary: "Four engines, the same core ideas, and the architectural choices that make them feel different.",
            minutes: 12,
            tags: ["snowflake", "redshift", "bigquery", "duckdb", "architecture"],
            blocks: [
              { t: "p", html: "All four are columnar, compressed, vectorized or compiled, and prune with metadata. They differ in <strong>where compute runs, who manages it, and how you pay for it</strong>. Learn those differences at the level of mechanism. Exact limits and feature names change from release to release." },
              { t: "table", headers: ["", "Snowflake", "Redshift", "BigQuery", "DuckDB"], rows: [
                ["Deployment", "Managed service", "Managed clusters or serverless", "Serverless service", "Library inside your process"],
                ["Storage", "Micro-partitions in cloud object storage", "RA3: managed storage on object storage with local SSD cache", "Capacitor columnar files on a distributed file system", "Single local file (or Parquet/CSV it reads directly)"],
                ["Compute unit", "Virtual warehouse (T-shirt sizes)", "Nodes split into slices", "Slots", "Threads on your machine"],
                ["Physical tuning", "Clustering keys (optional)", "Distribution style and sort keys", "Partitioning and clustering", "Insert order; row groups"],
                ["Sweet spot", "Many teams with isolated compute over shared data", "AWS-centric warehousing with explicit control", "Ad hoc analysis at very large scale with no ops", "Local analytics, notebooks, embedded apps, CI"]
              ] },
              { t: "h", text: "Snowflake: three layers" },
              { t: "ul", items: [
                "<strong>Storage</strong>: immutable, compressed columnar micro-partitions in object storage. Time travel and zero-copy clones work by keeping and sharing old partitions.",
                "<strong>Compute: virtual warehouses</strong>: independent MPP clusters. Each size step roughly doubles the compute and the credits per hour. Multi-cluster warehouses add clusters for concurrency. Warehouses cache data on local SSD, so a warm warehouse reads far less from object storage.",
                "<strong>Cloud services layer</strong>: authentication, metadata, the optimizer, pruning, transaction coordination and the result cache. Identical repeated queries can be answered from the result cache when the underlying data has not changed."
              ] },
              { t: "h", text: "Redshift: you shape the distribution" },
              { t: "ul", items: [
                "A <strong>leader node</strong> parses and plans; <strong>compute nodes</strong> divided into <strong>slices</strong> execute in parallel.",
                "<strong>Distribution style</strong>: KEY (hash on a column), EVEN (round-robin), ALL (full copy per node) or AUTO.",
                "<strong>Sort keys</strong> order data on disk, so 1 MB block zone maps can skip blocks.",
                "<strong>RA3 managed storage</strong> keeps the authoritative copy in object storage with a local SSD cache, which decouples storage size from node count."
              ] },
              { t: "code", lang: "sql", code:
                "CREATE TABLE sales (\n" +
                "  sale_id     BIGINT,\n" +
                "  customer_id BIGINT,\n" +
                "  sale_date   DATE,\n" +
                "  amount      DECIMAL(12,2)\n" +
                ")\n" +
                "DISTKEY (customer_id)      -- co-locate with customers joined on customer_id\n" +
                "SORTKEY (sale_date);       -- zone maps skip blocks for date-range filters"
              },
              { t: "h", text: "BigQuery: serverless Dremel" },
              { t: "ul", items: [
                "Built on <strong>Dremel</strong>: a query becomes a tree, or more generally a graph of stages, of many parallel workers.",
                "Data is stored in <strong>Capacitor</strong>, a columnar format, on a distributed file system. Storage and compute are fully separate.",
                "Compute is measured in <strong>slots</strong>: on demand from a shared pool (billed by bytes scanned) or reserved capacity.",
                "Intermediate data between stages goes through a <strong>distributed in-memory shuffle tier</strong>, so a stage's workers can fail or scale without losing the shuffle.",
                "Partitioning by date and clustering on filter columns cut bytes scanned, which is both speed and cost."
              ] },
              { t: "h", text: "DuckDB: in-process and vectorized" },
              { t: "p", html: "DuckDB is a library, not a server: an analytic engine with vectorized execution, morsel-driven parallelism across cores and columnar storage in one file. It can query Parquet, CSV or Arrow data in place. There is no network hop and no cluster, so a laptop can aggregate hundreds of millions of rows interactively." },
              { t: "code", lang: "python", code:
                "import duckdb\n\n" +
                "con = duckdb.connect()   # in-process, in memory\n" +
                "con.sql(\"\"\"\n" +
                "  SELECT region, SUM(amount) AS revenue\n" +
                "  FROM read_parquet('events/*.parquet')   -- reads footers, prunes row groups\n" +
                "  WHERE event_date >= DATE '2026-01-01'\n" +
                "  GROUP BY region\n" +
                "\"\"\").show()"
              },
              { t: "note", variant: "warn", html: "Vendor internals change. Warehouse sizes, slot pricing models, node families, default vector sizes and cache behaviour all evolve. In an interview, explain the mechanism, such as separated storage, compute units, pruning and shuffles, and say \"roughly\" or \"on the order of\" for numbers you have not checked recently." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "\"Which engine would you pick, and why?\""], rows: [
                ["Naive", "Names a favourite with no criteria."],
                ["Solid", "Maps the workload to the architecture: concurrency and isolation (Snowflake warehouses), explicit physical control on AWS (Redshift keys), serverless ad hoc scale (BigQuery), local or embedded (DuckDB)."],
                ["Standout", "Solid, plus the cost model (credits vs slots vs bytes scanned vs nodes), the physical tuning each needs, cold-cache and skew behaviour, and where an open table format lets several engines share the same data."]
              ] },
              { t: "quiz", id: "col-mpp" },
              { t: "note", variant: "key", html: "<strong>Same core, different control planes.</strong> All four are columnar engines that prune and run in parallel. Snowflake isolates compute per warehouse over shared storage, Redshift exposes distribution and sort keys, BigQuery hides compute behind slots and a serverless shuffle, and DuckDB brings the engine into your process." }
            ]
          }
        ]
      },
      /* ------------------------------------------------------------ */
      {
        id: "formats",
        name: "File Formats & Columnar Writes",
        icon: "blocks",
        lessons: [
          {
            id: "open-table-formats",
            title: "Parquet anatomy and open table formats",
            summary: "Row groups, column chunks, pages and footer stats, then the metadata layer that turns files into a table with snapshots.",
            minutes: 12,
            tags: ["parquet", "iceberg", "delta-lake", "hudi", "time-travel"],
            blocks: [
              { t: "p", html: "A data lake is a pile of files in object storage. <strong>Parquet</strong> makes each file a self-describing, columnar, prunable unit. An <strong>open table format</strong> (Iceberg, Delta Lake, Hudi) adds a metadata layer that says which files make up the table right now. That layer gives you atomic commits, schema evolution and time travel without a database server owning the files." },
              { t: "h", text: "Inside a Parquet file" },
              { t: "code", lang: "text", code:
                "PAR1                                   <- magic bytes\n" +
                "Row group 0  (e.g. ~128 MB of rows)\n" +
                "  Column chunk: id      [dict page][data page][data page]...\n" +
                "  Column chunk: region  [dict page][data page]...\n" +
                "  Column chunk: amount  [data page][data page]...\n" +
                "Row group 1\n" +
                "  ...\n" +
                "Footer (FileMetaData)\n" +
                "  schema, row count, per row group: column chunk offsets, encodings,\n" +
                "  codec, statistics (min, max, null count)\n" +
                "footer length (4 bytes) + PAR1         <- reader starts here"
              },
              { t: "table", headers: ["Level", "Typical size", "What it enables"], rows: [
                ["File", "Hundreds of MB to ~1 GB is a healthy target", "Unit of listing and table-format tracking"],
                ["Row group", "Often ~128 MB or a fixed row count", "Unit of parallelism and of skipping via footer stats"],
                ["Column chunk", "One column within a row group", "Read only the columns a query needs"],
                ["Page", "Often ~1 MB or less", "Unit of encoding and compression; optional page indexes allow finer skipping"]
              ] },
              { t: "p", html: "A reader fetches the last 8 bytes, then the footer, then decides which row groups survive the predicate using their min/max. It then issues range reads only for the needed column chunks of those row groups. On object storage, where every request has latency, those few large range reads are the whole game." },
              { t: "h", text: "The table-format layer" },
              { t: "code", lang: "text", code:
                "catalog: db.events -> current metadata file  (atomic pointer swap = commit)\n" +
                "  metadata.json   : schema, partition spec, list of snapshots\n" +
                "    snapshot S42  -> manifest list\n" +
                "      manifest A  -> data files f1..f200  (+ per-file column min/max, row counts)\n" +
                "      manifest B  -> data files f201..f350\n" +
                "    snapshot S41  -> older manifest list (still readable = time travel)"
              },
              { t: "table", headers: ["", "Apache Iceberg", "Delta Lake", "Apache Hudi"], rows: [
                ["Metadata shape", "Metadata file, then manifest lists, then manifests", "Ordered JSON commit log plus periodic Parquet checkpoints", "A timeline of instants (commits, compactions, cleans)"],
                ["Commit", "Atomic swap of the current-metadata pointer in a catalog", "Atomically write the next numbered log entry", "Complete an instant on the timeline"],
                ["Row-level changes", "Copy-on-write, or delete files for merge-on-read", "Copy-on-write, or deletion vectors", "Copy-on-write or merge-on-read table types"],
                ["Known for", "Hidden partitioning, multi-engine support", "Tight Spark integration", "Upserts and incremental pulls"]
              ] },
              { t: "h", text: "Snapshots and time travel" },
              { t: "p", html: "Because data files are immutable, every commit produces a new <strong>snapshot</strong>, a complete list of live files, while old snapshots keep pointing at their old files. Reading as of yesterday just means reading an older snapshot. Expiring snapshots and deleting unreferenced files reclaims storage and ends time travel past that point. Snowflake's time travel works in a similar spirit, by retaining old micro-partitions for a retention window." },
              { t: "code", lang: "sql", code:
                "-- Snowflake: query the table as it was an hour ago\n" +
                "SELECT * FROM orders AT (OFFSET => -3600);\n\n" +
                "-- Delta Lake (Spark SQL): by version or timestamp\n" +
                "SELECT * FROM orders VERSION AS OF 120;\n\n" +
                "-- Iceberg (Spark SQL): by snapshot id or timestamp\n" +
                "SELECT * FROM orders FOR TIMESTAMP AS OF '2026-10-27 09:00:00';"
              },
              { t: "note", variant: "trap", html: "<strong>Small files are a slow death.</strong> Thousands of tiny files mean thousands of footer reads and object-store requests, poor compression and bloated manifests. Size files deliberately, compact regularly and expire snapshots." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"several engines need the same data\", \"we need to query last Tuesday's state\", \"lake queries are slow and list millions of files\". Talk Parquet stats, manifests, snapshots and compaction." },
              { t: "note", variant: "key", html: "<strong>Parquet makes files prunable; table formats make piles of files a table.</strong> Footer stats skip row groups, manifest stats skip files, and immutable files plus snapshot metadata give atomic commits and time travel. Keep files large and compacted." }
            ]
          },
          {
            id: "table-format-operations",
            title: "Running a lakehouse: commits, evolution and maintenance",
            summary: "Optimistic commits and conflicts, field-id schema evolution, hidden partitioning and partition evolution, catalogs, Parquet nesting, and the maintenance jobs every Iceberg or Delta table needs.",
            minutes: 12,
            tags: ["iceberg", "delta-lake", "parquet", "schema-evolution", "compaction", "catalog"],
            blocks: [
              { t: "p", html: "The previous lesson showed what a table format <em>is</em>. This one is about living with it: several writers committing at once, schemas and partitioning that change over years, and the housekeeping without which a lake table slowly grinds to a halt." },
              { t: "h", text: "Commits are optimistic" },
              { t: "p", html: "There is no lock server. A writer reads the current snapshot, writes new data files, then tries to <strong>atomically swap</strong> the table's metadata pointer (Iceberg, through the catalog) or create the next numbered log entry (Delta, through put-if-absent semantics on the log). If another writer committed first, the swap fails. The writer then re-reads the new snapshot and <strong>validates</strong> whether the two commits really conflict. Two appends never do, so the commit is simply retried on top. Two jobs that rewrote or deleted rows in the same files do conflict, and one of them fails." },
              { t: "ol", items: [
                "Read snapshot S41 and plan the write.",
                "Write data files and new manifests (invisible to everyone so far).",
                "Commit: swap current metadata from S41 to S42, only if it is still S41.",
                "If someone else made S42 first: check for overlapping files or partitions, then retry as S43 or fail."
              ] },
              { t: "note", variant: "tip", html: "Design pipelines so concurrent writers touch disjoint partitions, for example one job per day or per region. Then optimistic commits almost never conflict, and the occasional retry is cheap." },
              { t: "h", text: "Catalogs: who holds the pointer" },
              { t: "p", html: "Iceberg needs a <strong>catalog</strong> to store the current metadata location and to make the swap atomic: a Hive metastore, AWS Glue, a JDBC database, or a service speaking the Iceberg <strong>REST catalog</strong> protocol (Polaris, Unity Catalog, Nessie and others). Delta keeps its log beside the data, but object stores that lack atomic put-if-absent need a coordination service for safe multi-writer commits. The catalog is also where access control and multi-engine discovery live, which is why it has become the contested layer." },
              { t: "h", text: "Schema evolution by field id" },
              { t: "p", html: "Iceberg assigns every column a permanent <strong>field id</strong> and Parquet files store data under those ids. Renaming a column changes only metadata, dropping a column hides its id, and adding a column with a recycled name can never resurrect old data. Formats that match columns by name or position risk reading the wrong column after a rename-and-add. Delta supports renames and drops through its column-mapping mode for the same reason." },
              { t: "h", text: "Hidden partitioning and partition evolution" },
              { t: "p", html: "Hive-style tables made users partition on a derived column (<code class='tok'>event_date</code>) and remember to filter on it; a query filtering only on <code class='tok'>event_ts</code> scanned everything. Iceberg declares partitions as <strong>transforms</strong> of real columns, such as <code class='tok'>days(event_ts)</code> or <code class='tok'>bucket(16, user_id)</code>, and prunes from filters on the source column. Because each data file records the spec it was written with, the partition spec can <strong>evolve</strong> (daily to hourly, say) without rewriting old data: old files keep the old layout and the planner handles both." },
              { t: "code", lang: "sql", code:
                "-- Iceberg (Spark SQL)\n" +
                "CREATE TABLE lake.events (id BIGINT, user_id BIGINT, event_ts TIMESTAMP, payload STRING)\n" +
                "USING iceberg PARTITIONED BY (days(event_ts));\n" +
                "ALTER TABLE lake.events RENAME COLUMN payload TO body;          -- metadata only\n" +
                "ALTER TABLE lake.events ADD PARTITION FIELD bucket(16, user_id); -- new files only\n\n" +
                "-- Maintenance procedures\n" +
                "CALL lake.system.rewrite_data_files(table => 'events');          -- compact small files\n" +
                "CALL lake.system.expire_snapshots(table => 'events', older_than => TIMESTAMP '2026-10-21 00:00:00');\n" +
                "CALL lake.system.remove_orphan_files(table => 'events');\n" +
                "CALL lake.system.rewrite_manifests('events');\n\n" +
                "-- Delta Lake equivalents\n" +
                "OPTIMIZE events ZORDER BY (user_id);    -- compact and cluster\n" +
                "VACUUM events RETAIN 168 HOURS;         -- delete files unreferenced for 7 days" },
              { t: "h", text: "The maintenance loop" },
              { t: "table", headers: ["Job", "Why it is needed", "If you skip it"], rows: [
                ["Compaction", "Streaming and frequent commits create many small files; merge-on-read accumulates delete files", "Query planning and footer reads dominate; reads slow down every day"],
                ["Clustering (sort, Z-order, Hilbert, liquid clustering)", "Puts related values in the same files so min/max statistics prune well", "Files overlap on every key and nothing is skipped"],
                ["Expire snapshots", "Every commit keeps old files alive for time travel", "Storage grows without bound; metadata files balloon"],
                ["Remove orphan files", "Failed or abandoned writes leave files no snapshot references", "Paying to store garbage"],
                ["Rewrite manifests", "Many small manifests slow down planning", "Planning time grows with commit count"]
              ] },
              { t: "note", variant: "trap", html: "Snapshot expiry and VACUUM end time travel past their cut-off, and a too-short retention can delete files that a long-running reader or a lagging streaming job still needs. Keep retention longer than your longest query and your slowest consumer." },
              { t: "h", text: "Parquet details that matter in practice" },
              { t: "ul", items: [
                "<strong>Nested data</strong> (structs, lists, maps) is flattened into leaf columns using <em>repetition and definition levels</em>, a scheme from Google's Dremel paper, so a reader can fetch one nested field without the rest.",
                "Besides row-group min/max, files can carry a <strong>page index</strong> (per-page min/max) and optional <strong>bloom filters</strong> per column chunk for equality lookups on high-cardinality keys.",
                "Dictionary encoding falls back to plain encoding when a column chunk's dictionary grows too large, which is one reason sorted or clustered data compresses better.",
                "Common codecs are Snappy (fast), ZSTD (better ratio, now a popular default) and GZIP (legacy)."
              ] },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"our Iceberg table got slow and expensive\"", "Why"], rows: [
                ["Naive", "Add more compute.", "Treats a layout problem as a capacity problem"],
                ["Solid", "Compact small files, cluster on common filter columns, expire snapshots and remove orphans.", "Names the maintenance loop"],
                ["Standout", "Also schedules maintenance per partition, sets retention from the slowest reader, avoids commit conflicts by partitioning writers, and uses hidden partitioning or partition evolution instead of rewriting history.", "Operates the table as a system"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"two jobs write the same table\", \"commit failed, concurrent modification\", \"rename a column without breaking old files\", \"change partitioning without a rewrite\", \"storage bill keeps growing\". Talk optimistic commits, field ids, transforms and the maintenance loop." },
              { t: "note", variant: "key", html: "<strong>Lakehouse tables are run, not just created.</strong> Commits are optimistic swaps validated for overlap; field ids make schema changes safe; partition transforms enable hidden partitioning and evolution; compaction, clustering, snapshot expiry and orphan cleanup keep reads fast and storage bounded." }
            ]
          },
          {
            id: "time-series-engines",
            title: "Time-series engines: chunks, compression and retention",
            summary: "What makes time-series workloads special, time partitioning, delta-of-delta and XOR compression, downsampling, retention, and the high-cardinality problem.",
            minutes: 9,
            tags: ["time-series", "timescaledb", "prometheus", "compression", "retention"],
            blocks: [
              { t: "p", html: "Metrics, sensor readings, prices and logs share a shape: <strong>append-mostly, arriving roughly in time order, queried by recent time ranges, aggregated into windows, and deleted wholesale when old</strong>. Time-series engines exploit every part of that shape, mostly with ideas you have already seen in this track: partitioning, columnar compression and zone maps." },
              { t: "h", text: "The data model" },
              { t: "p", html: "A <strong>series</strong> is identified by a metric name plus a set of <strong>tags</strong> or labels (<code class='tok'>cpu_usage{host=\"web-17\", region=\"eu\"}</code>); each point is a timestamp and one or more numeric <strong>fields</strong>. Engines index the tags to find series and store each series' points contiguously and compressed." },
              { t: "h", text: "Partition by time" },
              { t: "p", html: "Data is cut into time <strong>chunks</strong> or blocks: TimescaleDB hypertables create a child table per time interval, Prometheus writes two-hour blocks after holding the newest data in an in-memory head block protected by a WAL, ClickHouse tables are usually partitioned by month or day. Inserts hit only the newest chunk, whose indexes stay small and in memory; range queries prune to a few chunks; and retention becomes dropping whole chunks, which is instant and creates no dead rows to vacuum." },
              { t: "h", text: "Compression that exploits regularity" },
              { t: "code", lang: "text", code:
                "timestamps (every 10 s):  1000  1010  1020  1030  1041  1050\n" +
                "delta:                          10    10    10    11     9\n" +
                "delta-of-delta:                       0     0     1    -2   -> mostly zeros, a bit or two each\n\n" +
                "values (gauge):  22.50  22.50  22.51  22.51\n" +
                "XOR with previous float: 0, small, 0 ...    -> zero or a few meaningful bits" },
              { t: "p", html: "Regular timestamps become runs of zeros after <strong>delta-of-delta</strong> encoding, and slowly changing floats XORed with their predecessor share most of their bits. Facebook's Gorilla paper reported around 1.4 bytes per point for production metrics, against 16 bytes raw. Columnar engines get similar effects from delta, run-length and dictionary encoding on sorted data." },
              { t: "h", text: "Downsampling and continuous aggregates" },
              { t: "p", html: "Nobody needs ten-second resolution for last year. Engines maintain <strong>rollups</strong>: per-minute or per-hour aggregates computed incrementally as data arrives (TimescaleDB continuous aggregates, ClickHouse materialized views, recording rules in Prometheus). Raw data can then expire after days while rollups live for years." },
              { t: "code", lang: "sql", code:
                "-- TimescaleDB\n" +
                "SELECT create_hypertable('metrics', 'ts', chunk_time_interval => INTERVAL '1 day');\n\n" +
                "CREATE MATERIALIZED VIEW metrics_hourly WITH (timescaledb.continuous) AS\n" +
                "SELECT time_bucket('1 hour', ts) AS hour, host, avg(cpu) AS cpu_avg, max(cpu) AS cpu_max\n" +
                "FROM metrics GROUP BY hour, host;\n\n" +
                "SELECT add_retention_policy('metrics', INTERVAL '14 days');   -- drop raw chunks\n" +
                "SELECT add_compression_policy('metrics', INTERVAL '2 days');  -- columnar-compress old chunks" },
              { t: "note", variant: "warn", html: "<strong>High cardinality</strong> is the classic failure. Every distinct tag combination is a new series with its own index entries and in-memory state. Putting a user id, request id or full URL into a tag can create millions of series and exhaust memory. Keep unbounded values out of tags; store them as fields or in a log or columnar store instead." },
              { t: "table", headers: ["Engine", "Shape", "Good at"], rows: [
                ["TimescaleDB", "Postgres extension: hypertables, columnar compression of old chunks", "SQL, joins with relational data, existing Postgres tooling"],
                ["Prometheus", "Pull-based metrics, local TSDB blocks, PromQL", "Operational monitoring and alerting"],
                ["InfluxDB", "Purpose-built TSDB; recent versions use a columnar engine on Arrow and Parquet", "High-ingest metrics and IoT"],
                ["ClickHouse", "General columnar MergeTree sorted by (series, time)", "Very large event and log analytics, high-cardinality data"]
              ] },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"store 1M sensor readings per second for a year\"", "Why"], rows: [
                ["Naive", "A normal table with an index on timestamp.", "Index bloat, slow deletes, poor compression"],
                ["Solid", "Time-partitioned chunks, columnar compression, retention by dropping chunks, hourly rollups.", "Uses the workload's shape"],
                ["Standout", "Also controls tag cardinality, sizes chunks so the active one fits in memory, handles late-arriving data, and keeps raw versus rollup retention separate.", "Anticipates the common failure modes"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"metrics\", \"IoT sensors\", \"tick data\", \"keep raw data for 30 days and hourly for 2 years\", \"Prometheus is running out of memory\". Reach for time chunks, compression, rollups and a cardinality check." },
              { t: "note", variant: "key", html: "<strong>Time-series engines are time-partitioned columnar stores.</strong> Chunks make inserts local and retention a metadata drop; delta-of-delta and XOR encoding shrink points to a byte or two; rollups keep long history cheap; and unbounded tag values are the main way to break them." }
            ]
          },
          {
            id: "columnar-writes",
            title: "Columnar writes: delta stores, merges and expensive updates",
            summary: "Why one-row writes hurt a column store, and how engines buffer, batch and merge to cope.",
            minutes: 11,
            tags: ["columnar", "writes", "delta-store", "merge", "copy-on-write"],
            blocks: [
              { t: "p", html: "Everything that makes columnar reads fast fights against small writes. Columns are split across chunks, compressed together, sorted for runs and summarized with min/max, and the files are immutable. Changing one value in one row means touching a structure designed to be written <strong>once, in bulk</strong>." },
              { t: "h", text: "What one UPDATE really costs" },
              { t: "ol", items: [
                "Find the file or partition that holds the row, using metadata and a scan.",
                "Decode the affected column chunks. For copy-on-write, that means every column of that file.",
                "Write a whole new file with the change, often tens to hundreds of megabytes, or write a delete marker plus the new row elsewhere.",
                "Commit new metadata: a new snapshot or manifest, or a new version of the partition list.",
                "Later, garbage-collect the old file once time travel and retention allow it."
              ] },
              { t: "stat", items: [
                { v: "1 row", k: "logical change" },
                { v: "~100 MB", k: "possible physical rewrite under copy-on-write" },
                { v: "1 commit", k: "of metadata and a new snapshot per statement" }
              ] },
              { t: "h", text: "Write buffers and delta stores" },
              { t: "p", html: "Engines that need fresher writes put a <strong>write-optimized buffer</strong> in front of the read-optimized columnar store, then merge it in the background. Queries read both and combine them, much like an LSM tree's memtable and SSTables." },
              { t: "table", headers: ["System", "Write side", "Merge into columnar"], rows: [
                ["C-Store / Vertica lineage", "Write-optimized store in memory", "A tuple mover converts batches into read-optimized sorted projections"],
                ["SQL Server columnstore", "Delta rowgroups (row format) plus a delete bitmap", "A background tuple mover compresses full delta rowgroups into columnar segments"],
                ["ClickHouse MergeTree", "Each insert creates a new sorted part", "Background merges combine parts into larger ones"],
                ["Snowflake", "DML writes new micro-partitions", "Changed partitions are rewritten; old ones are retained for time travel"],
                ["Iceberg / Delta (merge-on-read)", "Delete files or deletion vectors plus new data files", "Compaction rewrites data files and applies the deletes"]
              ] },
              { t: "h", text: "Copy-on-write vs merge-on-read" },
              { t: "compare",
                bad: { title: "Copy-on-write", items: ["Rewrites every file containing a changed row at write time", "Writes are slow and write amplification is high", "Readers see clean files with no merge work", "Good for read-heavy tables with infrequent batch updates"] },
                good: { title: "Merge-on-read", items: ["Writes small delete or delta files quickly", "Readers must merge deletes in, so reads slow down as deltas pile up", "Needs regular compaction to restore read speed", "Good for frequent updates, CDC and streaming upserts"] } },
              { t: "h", text: "Write in sets, not rows" },
              { t: "code", lang: "sql", code:
                "-- Anti-pattern: an application loop doing 50,000 single-row updates\n" +
                "-- UPDATE customers SET tier = 'gold' WHERE id = 1017;   (x 50,000 commits)\n\n" +
                "-- Pattern: land changes in a staging table, apply them in one set-based statement\n" +
                "MERGE INTO customers AS t\n" +
                "USING customer_changes AS s\n" +
                "  ON t.id = s.id\n" +
                "WHEN MATCHED THEN UPDATE SET tier = s.tier, updated_at = s.changed_at\n" +
                "WHEN NOT MATCHED THEN INSERT (id, tier, updated_at) VALUES (s.id, s.tier, s.changed_at);"
              },
              { t: "note", variant: "warn", html: "Trickle inserts, meaning one row or a few rows per statement, produce tiny partitions or files, bloat metadata and waste compression. Buffer upstream (a queue, a stage, micro-batches every few seconds to minutes) and load in batches large enough to fill real files." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Design for \"keep the warehouse in sync with the OLTP database\""], rows: [
                ["Naive", "Replay every OLTP statement into the warehouse as it happens."],
                ["Solid", "Capture changes (CDC), land them in a staging table, and apply them with periodic batched MERGE statements."],
                ["Standout", "Solid, plus choosing copy-on-write vs merge-on-read for the table, scheduled compaction and snapshot expiry, merge-key clustering so a MERGE prunes to few partitions, and an explicit freshness target (for example 5 minutes) that sets the batch size."]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we update rows in the warehouse one at a time\", \"streaming upserts into the lake\", \"MERGE is slow and rewrites the whole table\". Explain immutable chunks, batch the writes, and pick CoW or MoR with compaction." },
              { t: "quiz", id: "col-formats" },
              { t: "note", variant: "key", html: "<strong>Columnar storage is write-once, read-many.</strong> A single-row change rewrites or patches immutable compressed chunks. Buffer changes, apply them in set-based batches, choose copy-on-write or merge-on-read based on the read/write mix, and compact on a schedule." }
            ]
          }
        ]
      }
    ]
  };
})();
