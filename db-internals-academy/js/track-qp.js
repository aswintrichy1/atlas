/* =====================================================================
   LEDGER · Query Processing
   window.TRACKS.qp — modules: pipeline / optimizer / joins

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
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
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
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
  function fmt(n) {
    if (n == null || !isFinite(n)) return "n/a";
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function slider(label, values, idx, show, onChange) {
    var out = h("b", {}, show(values[idx]));
    var inp = h("input", { type: "range", min: "0", max: String(values.length - 1), step: "1", value: String(idx), "aria-label": label });
    inp.addEventListener("input", function () {
      var v = values[Number(inp.value)];
      out.textContent = show(v);
      onChange(v);
    });
    return h("label", { class: "w-field", style: "display:flex;flex-direction:column;gap:4px;min-width:150px;font-size:0.84rem" },
      h("span", {}, label + ": ", out), inp);
  }
  function group(label, node) {
    return h("div", { style: "display:flex;flex-direction:column;gap:4px;font-size:0.84rem" }, h("span", { style: "color:var(--text-dim)" }, label), node);
  }

  var Widgets = {};

  /* ==================================================================
     1. qpJoinCost — textbook page-I/O cost of four join algorithms
  ================================================================== */
  Widgets.qpJoinCost = function (mount) {
    shell(mount, "cost model", "Join cost comparer (page I/Os)",
      "Set the size of R and S in pages, how many rows fit on an R page, the memory budget B in pages, whether S has an index on the join key, and whether inputs arrive sorted. Each algorithm is costed with the classic textbook formulas; the cheapest one is highlighted.");
    var PAGES = [10, 50, 100, 500, 1000, 5000, 10000, 50000];
    var MEM = [5, 12, 25, 52, 102, 302, 1002];
    var st = { M: 1000, N: 500, tpp: 100, B: 102, probe: 0, sorted: "none" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function sortCost(X, B, isSorted) {
      if (isSorted) return { c: 0, p: 0 };
      var runs = Math.ceil(X / B);
      var passes = runs <= 1 ? 1 : 1 + Math.ceil(Math.log(runs) / Math.log(B - 1));
      return { c: 2 * X * passes, p: passes };
    }

    function compute() {
      var M = st.M, N = st.N, B = st.B, m = M * st.tpp;
      var small = Math.min(M, N), big = Math.max(M, N);
      var res = [];
      var scans = Math.ceil(small / (B - 2));
      res.push({ name: "Block nested loop", cost: small + scans * big,
        note: "outer = smaller input (" + (M <= N ? "R" : "S") + "); inner scanned " + fmt(scans) + " time(s)" });
      if (st.probe > 0) res.push({ name: "Index nested loop", cost: M + m * st.probe, note: fmt(m) + " probes × " + st.probe + " I/O each" });
      else res.push({ name: "Index nested loop", cost: null, note: "not possible: no index on S.key" });
      var hash, hnote;
      if (small <= B - 2) { hash = M + N; hnote = "smaller input fits in memory: one read of each"; }
      else {
        var p = Math.max(1, Math.ceil(Math.log(small / (B - 2)) / Math.log(B - 1)));
        hash = 2 * (M + N) * p + (M + N);
        hnote = p === 1 ? "B > √smaller: one partition pass, 3(M+N)" : p + " partition passes: B < √smaller";
      }
      res.push({ name: "Grace hash", cost: hash, note: hnote });
      var sR = sortCost(M, B, st.sorted !== "none");
      var sS = sortCost(N, B, st.sorted === "both");
      res.push({ name: "Sort-merge", cost: sR.c + sS.c + M + N,
        note: "sort R " + (sR.p ? sR.p + " pass(es)" : "skipped") + ", sort S " + (sS.p ? sS.p + " pass(es)" : "skipped") + ", merge M+N" });
      return { res: res, m: m };
    }

    function paint() {
      var out = compute(), res = out.res, i;
      var best = null, worst = null;
      for (i = 0; i < res.length; i++) {
        if (res[i].cost == null) continue;
        if (!best || res[i].cost < best.cost) best = res[i];
        if (!worst || res[i].cost > worst.cost) worst = res[i];
      }
      clear(stage);
      var rowH = 46, W = 640, x0 = 150, barMax = 300;
      var lo = Math.log(Math.max(1, best.cost)) / Math.LN10 - 0.3;
      var hi = Math.log(Math.max(1, worst.cost)) / Math.LN10;
      if (hi - lo < 0.5) hi = lo + 0.5;
      var root = svg("svg", { viewBox: "0 0 " + W + " " + (res.length * rowH + 8), width: "100%", role: "img", "aria-label": "Join cost bars, log scale" });
      for (i = 0; i < res.length; i++) {
        var r = res[i], y = i * rowH + 6;
        var isBest = r === best;
        root.appendChild(svg("text", { x: 0, y: y + 16, style: "fill:var(--text);font-size:13px;font-weight:" + (isBest ? "700" : "500") }, r.name));
        if (r.cost == null) {
          root.appendChild(svg("text", { x: x0, y: y + 16, style: "fill:var(--text-dim);font-size:12px" }, "n/a"));
        } else {
          var lg = Math.log(Math.max(1, r.cost)) / Math.LN10;
          var w = Math.max(6, barMax * (lg - lo) / (hi - lo));
          root.appendChild(svg("rect", { x: x0, y: y + 4, width: w, height: 16, rx: 3,
            style: isBest ? "fill:var(--accent)" : "fill:var(--violet);opacity:0.55" }));
          root.appendChild(svg("text", { x: x0 + w + 8, y: y + 17, style: "fill:var(--text);font-size:12px;font-family:var(--font-mono)" },
            fmt(r.cost) + " I/O" + (isBest ? "  ← cheapest" : "")));
        }
        root.appendChild(svg("text", { x: x0, y: y + 36, style: "fill:var(--text-dim);font-size:11px" }, r.note));
      }
      stage.appendChild(root);
      stage.appendChild(h("p", { style: "font-size:0.8rem;color:var(--text-dim);margin:8px 0 0;line-height:1.5" },
        "Assumptions: cost = page reads + writes, CPU ignored, final output write ignored; bars use a log scale. " +
        "Block NL keeps B−2 outer pages in memory (one input buffer, one output). Index NL uses R as the outer, so it pays M + m × (I/O per probe), " +
        "where m = R pages × rows per page. Grace hash partitions both inputs, then builds and probes: 3(M+N) when B > √(smaller input). " +
        "External sort costs 2 × pages × passes, with passes = 1 + ⌈log_(B−1)(⌈pages/B⌉)⌉; the merge then reads M + N."));
      clear(readout);
      readout.appendChild(ro("cheapest", best.name));
      readout.appendChild(ro("cost", fmt(best.cost) + " I/O"));
      readout.appendChild(ro("≈ time at 10k IOPS", (best.cost / 10000).toFixed(2) + " s"));
      readout.appendChild(ro("worst / cheapest", (worst.cost / best.cost).toFixed(1) + "×"));
      readout.appendChild(ro("R rows (m)", fmt(out.m)));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end" },
      slider("R pages (M)", PAGES, 4, fmt, function (v) { st.M = v; paint(); }),
      slider("S pages (N)", PAGES, 3, fmt, function (v) { st.N = v; paint(); }),
      slider("Memory pages (B)", MEM, 4, fmt, function (v) { st.B = v; paint(); }),
      group("Rows per R page", segment([[10, "10"], [50, "50"], [100, "100"]], 2, function (v) { st.tpp = v; paint(); })),
      group("Index on S.key", segment([[0, "None"], [2, "Yes, ~2 I/O per probe"], [4, "Yes, ~4 I/O per probe"]], 0, function (v) { st.probe = v; paint(); })),
      group("Already sorted on key", segment([["none", "Neither"], ["r", "R only"], ["both", "Both"]], 0, function (v) { st.sorted = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. qpCardinality — independence assumption vs correlated columns
  ================================================================== */
  Widgets.qpCardinality = function (mount) {
    shell(mount, "estimator", "Two predicates, one wrong guess",
      "The table cars has 1,000,000 rows on 10,000 pages. The query filters on make and model, which are correlated in real data. The planner multiplies per-column selectivities unless it has multi-column statistics, then picks an index scan or a sequential scan from that estimate.");
    var ROWS = 1000000, PAGES = 10000;
    var st = { s1: 0.05, s2: 0.02, rho: 1, ext: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function seqCost() { return PAGES * 1.0 + ROWS * 0.01; }
    function idxCost(rows) { return 4 + rows * 4.0 + rows * 0.01; }
    function pct(x) { return (x * 100 >= 1 ? (x * 100).toFixed(1) : (x * 100).toFixed(3)) + "%"; }

    function paint() {
      var indep = st.s1 * st.s2;
      var actualSel = indep + st.rho * (Math.min(st.s1, st.s2) - indep);
      var estSel = st.ext ? actualSel : indep;
      var est = Math.max(1, Math.round(ROWS * estSel)), act = Math.max(1, Math.round(ROWS * actualSel));
      var chosen = idxCost(est) < seqCost() ? "Index Scan" : "Seq Scan";
      var bestActual = idxCost(act) < seqCost() ? "Index Scan" : "Seq Scan";
      var chosenActualCost = chosen === "Index Scan" ? idxCost(act) : seqCost();
      var bestActualCost = Math.min(idxCost(act), seqCost());
      var qerr = Math.max(est, act) / Math.min(est, act);

      clear(stage);
      stage.appendChild(h("pre", { style: "font-family:var(--font-mono);font-size:0.82rem;margin:0 0 10px;white-space:pre-wrap;color:var(--text)" },
        "SELECT * FROM cars WHERE make = 'Honda' AND model = 'Civic';\n" +
        "-- est selectivity = " + (st.ext ? "from multi-column statistics" : pct(st.s1) + " × " + pct(st.s2)) + " = " + pct(estSel)));
      var W = 640, root = svg("svg", { viewBox: "0 0 " + W + " 120", width: "100%", role: "img", "aria-label": "Estimated versus actual rows, log scale" });
      var bars = [["estimated rows", est, "var(--cyan)"], ["actual rows", act, "var(--amber)"]];
      var hiL = Math.log(ROWS) / Math.LN10;
      for (var i = 0; i < bars.length; i++) {
        var y = i * 34 + 6, w = Math.max(6, 330 * (Math.log(bars[i][1]) / Math.LN10) / hiL);
        svgAppend(root, "text", { x: 0, y: y + 15, style: "fill:var(--text);font-size:12px" }, bars[i][0]);
        svgAppend(root, "rect", { x: 130, y: y + 2, width: w, height: 18, rx: 3, style: "fill:" + bars[i][2] + ";opacity:0.75" });
        svgAppend(root, "text", { x: 136 + w, y: y + 16, style: "fill:var(--text);font-size:12px;font-family:var(--font-mono)" }, fmt(bars[i][1]));
      }
      svgAppend(root, "text", { x: 0, y: 92, style: "fill:var(--text-dim);font-size:11px" },
        "Cost model: seq scan = 10,000 pages × 1.0 + 1M rows × 0.01 = 20,000. Index scan ≈ rows × 4.0 (one random heap page per row).");
      svgAppend(root, "text", { x: 0, y: 110, style: "fill:var(--text-dim);font-size:11px" },
        "Crossover ≈ 5,000 rows (0.5%). Below it the index wins; above it the sequential scan wins.");
      stage.appendChild(root);
      var verdict = chosen === bestActual
        ? "The estimate lands on the right side of the crossover, so the plan is fine even if the row count is off."
        : "Plan flip: the estimate says " + chosen + ", but with the real row count " + bestActual + " is cheaper. The chosen plan costs about " + (chosenActualCost / bestActualCost).toFixed(1) + "× the best one.";
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:8px 0 0;line-height:1.55;color:var(--text)" }, verdict));

      clear(readout);
      readout.appendChild(ro("estimated", fmt(est)));
      readout.appendChild(ro("actual", fmt(act)));
      readout.appendChild(ro("error factor", qerr.toFixed(1) + "×"));
      readout.appendChild(ro("plan chosen", chosen));
      readout.appendChild(ro("best plan", bestActual));
    }
    function svgAppend(parent, tag, attrs, text) { parent.appendChild(svg(tag, attrs, text)); }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:12px 18px" },
      group("make = 'Honda' matches", segment([[0.01, "1%"], [0.05, "5%"], [0.2, "20%"]], 1, function (v) { st.s1 = v; paint(); })),
      group("model = 'Civic' matches", segment([[0.005, "0.5%"], [0.02, "2%"], [0.1, "10%"]], 1, function (v) { st.s2 = v; paint(); })),
      group("Real correlation", segment([[0, "None"], [0.5, "Partial"], [1, "Full (one implies the other)"]], 2, function (v) { st.rho = v; paint(); })),
      group("Statistics", segment([[false, "Per-column only"], [true, "Multi-column (extended)"]], 0, function (v) { st.ext = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. qpExplain — click through canned EXPLAIN ANALYZE plans
  ================================================================== */
  var EXPLAIN_PLANS = [
    { id: "healthy", label: "Healthy hash join",
      sql: "SELECT c.country, count(*) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = 'DE' GROUP BY c.country;",
      nodes: [
        { d: 0, op: "HashAggregate", est: 1, rows: 1, loops: 1, ms: 182.4, extra: "Group Key: c.country",
          desc: "Groups the joined rows by country and counts them. It is a pipeline breaker: nothing comes out until every input row has been consumed. One output row was expected and one arrived." },
        { d: 1, op: "Hash Join", est: 98500, rows: 101220, loops: 1, ms: 171.9, extra: "Hash Cond: (o.customer_id = c.id)",
          desc: "Builds a hash table on the smaller, filtered customers input, then streams orders through it. The estimate (98,500) is within a few percent of reality (101,220): the planner had good statistics on both sides." },
        { d: 2, op: "Seq Scan on orders o", est: 1000000, rows: 1000000, loops: 1, ms: 61.0, extra: "Buffers: shared hit=820 read=4920",
          desc: "Reads every orders page. With 10% of orders matching, a sequential scan feeding a hash join beats a million index probes. Most pages came from disk (read=4920) rather than the buffer cache (hit=820)." },
        { d: 2, op: "Hash", est: 9800, rows: 10120, loops: 1, ms: 9.1, extra: "Buckets: 16384  Batches: 1  Memory Usage: 480kB",
          desc: "The build side. Batches: 1 means the whole hash table fit in work_mem, so nothing spilled to temporary files." },
        { d: 3, op: "Seq Scan on customers c", est: 9800, rows: 10120, loops: 1, ms: 6.8, extra: "Filter: (country = 'DE')  Rows Removed by Filter: 89880",
          desc: "Scans customers and keeps 10% of rows. The country value is in the most-common-values list, so the selectivity came straight from its recorded frequency." }
      ] },
    { id: "nlx", label: "Nested loop explosion",
      sql: "SELECT o.id, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'shipped' AND o.carrier = 'ACME';",
      nodes: [
        { d: 0, op: "Nested Loop", est: 12, rows: 15840, loops: 1, ms: 4210.5, extra: "",
          desc: "For each outer row, run the inner index scan once. With an estimate of 12 outer rows this looked like 12 cheap probes. In reality it ran 15,840 probes with random I/O: about 4.2 seconds where a hash join would take a fraction of that." },
        { d: 1, op: "Index Scan using orders_status_idx on orders o", est: 12, rows: 15840, loops: 1, ms: 380.2, extra: "Index Cond: (status = 'shipped')  Filter: (carrier = 'ACME')  Rows Removed by Filter: 402160",
          desc: "The root cause. status and carrier are correlated (ACME only ships certain order types), but the planner multiplied their selectivities as if independent. That made 15,840 rows look like 12, about a 1,300× underestimate, and every decision above this node inherited the error." },
        { d: 1, op: "Index Scan using customers_pkey on customers c", est: 1, rows: 1, loops: 15840, ms: 0.24, extra: "Index Cond: (id = o.customer_id)  Buffers: shared hit=47100 read=16420",
          desc: "Per-loop numbers are fine: one row per probe, as estimated. The damage is loops=15840. Actual time and rows are per loop, so total time here is roughly 0.24 ms × 15,840 ≈ 3.8 s. Always multiply by loops." }
      ] },
    { id: "stale", label: "Stale stats and a spill",
      sql: "SELECT user_id, count(*) FROM events WHERE created_at >= '2026-10-01' GROUP BY user_id ORDER BY count(*) DESC LIMIT 20;",
      nodes: [
        { d: 0, op: "Limit", est: 20, rows: 20, loops: 1, ms: 9120.3, extra: "",
          desc: "Stops pulling after 20 rows. The row counts match trivially; the 9 seconds were spent below." },
        { d: 1, op: "Sort", est: 950, rows: 20, loops: 1, ms: 9120.1, limited: true, extra: "Sort Key: (count(*)) DESC  Sort Method: top-N heapsort  Memory: 27kB",
          desc: "Under a Limit, actual rows only counts what the parent pulled (20), so 950 vs 20 is not a misestimate. A top-N heapsort keeps only 20 rows in memory and is cheap. Learn to recognise this case so you do not chase it." },
        { d: 2, op: "HashAggregate", est: 950, rows: 412300, loops: 1, ms: 8960.7, extra: "Group Key: user_id  Batches: 21  Memory Usage: 8241kB  Disk Usage: 98400kB",
          desc: "Sized for 950 groups, received 412,300. The hash table outgrew work_mem and spilled in 21 batches to temporary files (Disk Usage). The error comes from the scan below." },
        { d: 3, op: "Seq Scan on events", est: 1020, rows: 2480000, loops: 1, ms: 5210.4, extra: "Filter: (created_at >= '2026-10-01')  Rows Removed by Filter: 37520000  Buffers: shared read=310000",
          desc: "Statistics were last gathered before last night's bulk load, and there is no index on created_at the planner could consult for the current maximum. The histogram says almost nothing is newer than its last bound, so 2.48 million rows were estimated as about 1,000. Run ANALYZE after bulk loads." }
      ] }
  ];

  Widgets.qpExplain = function (mount) {
    shell(mount, "plan reader", "Read an EXPLAIN ANALYZE plan",
      "Pick a plan, then click any node. Postgres reports estimated rows and actual rows per loop, so multiply actual rows by loops for the total. A node is flagged when estimate and reality differ by more than 10×.");
    var planIdx = 0, nodeIdx = 0;
    var listBox = h("div", { style: "display:flex;flex-direction:column;gap:4px" });
    var sqlBox = h("pre", { style: "font-family:var(--font-mono);font-size:0.8rem;margin:0 0 10px;white-space:pre-wrap;color:var(--text-dim)" });
    var detail = h("p", { style: "font-size:0.86rem;margin:10px 0 0;line-height:1.55;color:var(--text)" });
    var stage = h("div", { class: "w-stage" }, sqlBox, listBox, detail);
    var readout = h("div", { class: "w-readout" });

    function factor(n) { return Math.max(n.est, n.rows) / Math.max(1, Math.min(n.est, n.rows)); }
    function worstIdx(plan) {
      var w = 0, wf = 0;
      for (var i = 0; i < plan.nodes.length; i++) {
        var n = plan.nodes[i];
        if (n.limited) continue;
        var f = factor(n);
        if (f > wf) { wf = f; w = i; }
      }
      return w;
    }
    function paint() {
      var plan = EXPLAIN_PLANS[planIdx];
      if (!(nodeIdx >= 0 && nodeIdx < plan.nodes.length)) nodeIdx = 0;
      sqlBox.textContent = plan.sql;
      clear(listBox);
      for (var i = 0; i < plan.nodes.length; i++) {
        (function (n, idx) {
          var flagged = !n.limited && factor(n) > 10;
          var line = (n.d ? "->  " : "") + n.op + "  (rows=" + fmt(n.est) + ")  (actual rows=" + fmt(n.rows) + " loops=" + fmt(n.loops) + ")" + (flagged ? "  ⚠" : "");
          var b = h("button", { type: "button", class: "w-btn" + (idx === nodeIdx ? " primary" : " ghost"),
            style: "text-align:left;font-family:var(--font-mono);font-size:0.8rem;margin-left:" + (n.d * 22) + "px;white-space:normal" }, line);
          b.addEventListener("click", function () { nodeIdx = idx; paint(); });
          listBox.appendChild(b);
          if (n.extra) listBox.appendChild(h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);margin-left:" + (n.d * 22 + 14) + "px" }, n.extra));
        })(plan.nodes[i], i);
      }
      var node = plan.nodes[nodeIdx];
      detail.textContent = node.desc;
      clear(readout);
      readout.appendChild(ro("node", node.op.split(" ")[0] + (node.op.indexOf(" ") > 0 ? " " + node.op.split(" ")[1] : "")));
      readout.appendChild(ro("est rows/loop", fmt(node.est)));
      readout.appendChild(ro("actual rows/loop", fmt(node.rows)));
      readout.appendChild(ro("loops", fmt(node.loops)));
      readout.appendChild(ro("total actual rows", fmt(node.rows * node.loops)));
      readout.appendChild(ro("misestimate", node.limited ? "n/a (under Limit)" : factor(node).toFixed(1) + "×"));
    }
    var worstBtn = h("button", { type: "button", class: "w-btn primary" }, "Jump to worst misestimate");
    worstBtn.addEventListener("click", function () { nodeIdx = worstIdx(EXPLAIN_PLANS[planIdx]); paint(); });
    var pairs = [];
    for (var p = 0; p < EXPLAIN_PLANS.length; p++) pairs.push([p, EXPLAIN_PLANS[p].label]);
    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
      segment(pairs, 0, function (v) { planIdx = v; nodeIdx = 0; paint(); }), worstBtn));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     qpRuntimeFilter — runtime (bloom) filters and dynamic partition pruning
  ================================================================== */
  Widgets.qpRuntimeFilter = function (mount) {
    shell(mount, "runtime filter", "Runtime filters on a star join",
      "A 2-billion-row fact table in 8,000 files joins a filtered dimension. After the hash join builds on the dimension, the engine can push a bloom filter of the surviving keys into the fact scan, and with min/max metadata it can skip whole files. Change the dimension filter, the filter mode and how the fact table is laid out.");
    var F = 2e9, FILES = 8000, FPR = 0.01;
    var SEL = [0.0005, 0.002, 0.01, 0.05, 0.2, 0.5, 1];
    var st = { s: 0.01, mode: "bloom", layout: "clustered" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function compute() {
      var match = st.s * F, files = FILES, read = F, into = F;
      if (st.mode === "bloom" || st.mode === "prune") into = match + FPR * (F - match);
      if (st.mode === "prune") {
        files = st.layout === "clustered" ? Math.max(1, Math.ceil(st.s * FILES)) : FILES;
        read = F * files / FILES;
        into = match + FPR * Math.max(0, read - match);
      }
      return { files: files, read: read, into: into, match: match };
    }

    function paint() {
      var r = compute();
      clear(stage);
      var bars = [
        ["rows read from storage", r.read, "var(--violet)"],
        ["rows reaching the join", r.into, "var(--cyan)"],
        ["rows that actually match", r.match, "var(--accent)"]
      ];
      var W = 640, x0 = 190, barMax = 330, rowH = 40;
      var lo = 5, hi = Math.log(F) / Math.LN10;
      var root = svg("svg", { viewBox: "0 0 " + W + " " + (bars.length * rowH + 6), width: "100%", role: "img", "aria-label": "Rows read, joined and matching, log scale" });
      for (var i = 0; i < bars.length; i++) {
        var y = i * rowH + 4, v = Math.max(1, bars[i][1]);
        var w = Math.max(6, barMax * ((Math.log(v) / Math.LN10) - lo) / (hi - lo));
        root.appendChild(svg("text", { x: 0, y: y + 17, style: "fill:var(--text);font-size:13px" }, bars[i][0]));
        root.appendChild(svg("rect", { x: x0, y: y + 4, width: w, height: 18, rx: 3, style: "fill:" + bars[i][2] + ";opacity:0.8" }));
        root.appendChild(svg("text", { x: x0 + w + 8, y: y + 18, style: "fill:var(--text);font-size:12px;font-family:var(--font-mono)" }, fmt(bars[i][1])));
      }
      stage.appendChild(root);
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text);margin:8px 0 0;line-height:1.5" },
        st.mode === "none" ? "No runtime filter: every fact row is read, shipped and probed against the hash table." :
        st.mode === "bloom" ? "Bloom filter at the scan: all files are still read, but non-matching rows are dropped before shuffle and probe (about 1% false positives slip through)." :
        st.layout === "clustered" ? "Min/max pruning plus bloom filter: files whose key range misses the build side are never opened." :
        "Min/max pruning finds nothing to skip: with random layout every file spans almost every key, so only the bloom filter helps."));

      clear(readout);
      readout.appendChild(ro("files opened", fmt(r.files) + " / " + fmt(FILES)));
      readout.appendChild(ro("rows read", fmt(r.read)));
      readout.appendChild(ro("rows into join", fmt(r.into)));
      readout.appendChild(ro("join input vs no filter", (F / Math.max(1, r.into)).toFixed(F / r.into < 10 ? 1 : 0) + "x smaller"));
    }

    var controls = h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end" },
      slider("Dimension rows kept", SEL, 2, function (v) { return (v * 100) + "%"; }, function (v) { st.s = v; paint(); }),
      group("Runtime filter", segment([["none", "None"], ["bloom", "Bloom filter"], ["prune", "Bloom + file pruning"]], 1, function (v) { st.mode = v; paint(); })),
      group("Fact layout", segment([["clustered", "Clustered by key"], ["random", "Random order"]], 0, function (v) { st.layout = v; paint(); })));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "qp-pipeline": {
      title: "Query pipeline checkpoint",
      sub: "Parsing, binding, rewriting, operators and execution models.",
      questions: [
        { q: "A query references a column that does not exist. Which stage rejects it?",
          options: ["The parser, because the grammar forbids unknown names", "The optimizer, when no access path is found", "The binder (semantic analysis), when it resolves names against the catalog", "The executor, on the first row"],
          answer: 2,
          explain: "The grammar only checks shape: any identifier is syntactically legal. Binding is the step that looks names up in the catalog, resolves types and raises the unknown-column error. Nothing reaches the optimizer until binding succeeds." },
        { q: "Which pair is a logical operator and one of its physical implementations?",
          options: ["Join and Hash Join", "Seq Scan and Index Scan", "Sort and Merge Join", "Hash Aggregate and Group Aggregate"],
          answer: 0,
          explain: "A logical join says what result is wanted; hash join, merge join and nested loop are physical algorithms that compute it. Seq Scan and Index Scan are both physical access methods, and both aggregate variants are physical too. The optimizer's job is to map each logical operator to a physical one." },
        { q: "Why is the classic tuple-at-a-time iterator model slow for analytic scans over hundreds of millions of rows?",
          options: ["It cannot stream results", "It forces every operator to materialise its full output", "It cannot run joins", "It pays one or more virtual next() calls and interpretation per row per operator, which dominates when the work per row is tiny"],
          answer: 3,
          explain: "The iterator model streams fine and only blocking operators materialise. The cost is per-row overhead: function calls, branch mispredictions and poor cache use multiplied by every row and every operator. Vectorized engines amortise that over batches of about a thousand values; compiled engines fuse operators into tight loops." },
        { q: "Which operator is a pipeline breaker?",
          options: ["A filter on a scan", "The build side of a hash join", "A projection that drops columns", "The probe side of a hash join"],
          answer: 1,
          explain: "A pipeline breaker must consume its entire input before producing output. The hash table has to be complete before any probe can be answered, so the build side breaks the pipeline. Filters, projections and probes pass rows straight through." },
        { q: "A rewrite turns <code class='tok'>WHERE id IN (SELECT customer_id FROM orders)</code> into a semi-join. What does that buy you?",
          options: ["Nothing; it is cosmetic", "It guarantees an index is used", "The optimizer can now choose join algorithms and join order for the subquery instead of re-running it per outer row", "It removes the need for statistics"],
          answer: 2,
          explain: "Once the subquery is a semi-join it joins the normal join-ordering search: hash semi-join, merge semi-join or nested loop, in whichever order is cheapest. Left as a correlated subquery it may run once per outer row. Unnesting is one of the highest-value rewrites an engine performs." }
      ]
    },
    "qp-optimizer": {
      title: "Optimizer checkpoint",
      sub: "Cost models, statistics, cardinality and join ordering.",
      questions: [
        { q: "In Postgres's cost model, why is random_page_cost (default 4.0) higher than seq_page_cost (1.0)?",
          options: ["Random pages are larger", "It models that a random page fetch is more expensive than reading the next page sequentially", "Index pages are compressed", "It counts CPU time only"],
          answer: 1,
          explain: "Costs are in abstract units anchored on one sequential page read. A random read was historically several times more expensive on spinning disks, and the 4.0 default also assumes many reads hit cache. On SSDs teams commonly lower it toward 1.1–2, which makes index scans look cheaper." },
        { q: "A column has 1,000,000 rows, n_distinct = 50,000, no MCV list. Roughly what selectivity does the planner assume for <code class='tok'>col = 42</code>?",
          options: ["50%", "1/1,000,000", "0.5%", "1/50,000 (0.002%)"],
          answer: 3,
          explain: "Without a most-common-values entry for the constant, the planner assumes non-null rows are spread uniformly across distinct values, so selectivity is about 1/NDV. That gives roughly 20 rows here. If the value is actually a heavy hitter, only an MCV entry would reveal it." },
        { q: "Predicates <code class='tok'>city = 'Paris'</code> (1%) and <code class='tok'>country = 'FR'</code> (2%) are combined with AND. What does the independence assumption estimate, and which way is it wrong?",
          options: ["0.02%, a 50× underestimate because Paris implies France", "1%, exactly right", "3%, an overestimate", "2%, an overestimate"],
          answer: 0,
          explain: "Independence multiplies: 0.01 × 0.02 = 0.0002. In reality every Paris row is a France row, so the true selectivity is 1%, fifty times higher. Correlated predicates almost always cause underestimates, which push the planner toward nested loops and index scans that do not scale." },
        { q: "Why does a System R style optimizer track interesting orders instead of keeping only the cheapest plan for each subset of relations?",
          options: ["To reduce memory use", "To make plans deterministic", "A slightly more expensive plan that produces sorted output can make a later merge join, ORDER BY or GROUP BY cheaper overall", "Because hash joins need sorted input"],
          answer: 2,
          explain: "The cheapest subplan in isolation may not be cheapest in context. Keeping the best plan per sort order lets a later operator skip a sort. Hash joins do not need sorted input; merge joins, ORDER BY and grouping do." },
        { q: "Postgres plans a 15-table join. What happens by default?",
          options: ["Exhaustive dynamic programming over all bushy trees", "It refuses to plan", "It joins tables in FROM-clause order", "Explicit join collapsing is limited (join_collapse_limit 8), and above geqo_threshold (12) FROM items the genetic optimizer searches instead of exhaustive DP"],
          answer: 3,
          explain: "Exhaustive search explodes combinatorially, so Postgres caps it. from_collapse_limit and join_collapse_limit (both 8 by default) stop subqueries and explicit JOINs from being flattened into one huge problem, and at 12 or more FROM items the genetic query optimizer takes over. The result is a good plan, not a guaranteed optimal one." }
      ]
    },
    "qp-joins": {
      title: "Joins, EXPLAIN and pathologies checkpoint",
      sub: "Join algorithms, reading plans and the ways plans go wrong.",
      questions: [
        { q: "R is 1,000 pages, S is 500 pages, and you have 102 buffer pages. Roughly what does a Grace hash join cost in I/Os?",
          options: ["1,500", "1,500,000", "500,000", "4,500"],
          answer: 3,
          explain: "B = 102 is far larger than √500 ≈ 22, so one partitioning pass suffices. Each input is read and written once to partition (2 × 1,500), then read once more to build and probe (1,500), giving 3(M+N) = 4,500. 1,500 would only be possible if the smaller input fit entirely in memory." },
        { q: "In <code class='tok'>EXPLAIN ANALYZE</code>, an inner index scan shows <code class='tok'>actual time=0.020..0.025 rows=1 loops=40000</code>. What is its total contribution?",
          options: ["0.025 ms and 1 row", "About 1 second and 40,000 rows, because time and rows are per loop", "40,000 ms and 1 row", "It cannot be determined"],
          answer: 1,
          explain: "Actual time and rows are averages per execution of the node. Multiply by loops: 0.025 ms × 40,000 ≈ 1,000 ms, and 1 × 40,000 = 40,000 rows. Forgetting to multiply by loops is the most common EXPLAIN misreading." },
        { q: "A prepared statement in Postgres runs fast for its first five executions, then becomes slow for a skewed parameter value. What is the most likely cause?",
          options: ["The plan cache switched to a generic plan that ignores the specific parameter value", "The table was vacuumed", "work_mem shrank", "Postgres recompiles every execution"],
          answer: 0,
          explain: "Postgres plans custom (value-specific) plans for the first five executions, then may switch to a generic plan if its estimated cost is not much worse. The generic plan uses average selectivity, which can be badly wrong for a heavy-hitter value. plan_cache_mode = force_custom_plan restores per-value planning at the cost of planning every time." },
        { q: "Which join algorithm is the only general option when the join condition is <code class='tok'>a.ts BETWEEN b.start AND b.end</code> and no special index exists?",
          options: ["Hash join", "Merge join on equality", "Nested loop", "Index-only scan"],
          answer: 2,
          explain: "Hash joins need equality to hash both sides into the same bucket, and a standard merge join needs an equality merge condition. A nested loop can evaluate any predicate for every pair, so it is the fallback for range and inequality joins. Some engines add specialised range or interval joins, but nested loop is the general case." },
        { q: "A plan shows a Nested Loop whose outer side is estimated at 3 rows and actually returns 60,000. What is the best first fix?",
          options: ["Fix the estimate at its source: ANALYZE, multi-column statistics on the correlated columns, or a rewrite so the planner sees the real row count", "Disable nested loops globally", "Add more RAM", "Increase random_page_cost"],
          answer: 0,
          explain: "The plan is a rational choice for 3 rows and a disaster for 60,000. Correcting the cardinality estimate lets the planner choose a hash join on its own and fixes related queries too. Globally disabling an operator is a blunt switch that hurts every query that legitimately needed it." },
        {
          q: "A star join filters a 4,000-row date dimension down to 90 rows, yet the 2-billion-row fact table is fully scanned in one engine and mostly skipped in another. What most likely explains the difference?",
          options: ["The fast engine caches the whole fact table in memory", "The fast engine pushes a runtime filter (key range or bloom filter) from the built dimension into the fact scan, and the fact table is clustered on date_key so whole files are pruned", "The slow engine is using a nested loop join", "The fast engine ignores the join condition"],
          answer: 1,
          explain: "The selective predicate is on the dimension, so static pruning cannot use it. Runtime filtering builds a summary of the surviving join keys after the hash build and applies it to the probe-side scan; file-level min/max statistics then skip files whose key ranges cannot match. With a random layout only row-level filtering would help."
        },
        {
          q: "What does Spark's adaptive query execution use to change a plan, and when?",
          options: ["Exact sizes of completed shuffle stages, at stage boundaries, to switch to broadcast joins, coalesce small partitions and split skewed ones", "Table statistics refreshed every hour, before the query starts", "Machine-learned predictions of row counts, inside every operator", "Hints in the SQL text only"],
          answer: 0,
          explain: "AQE re-optimises at materialisation points where the output of a stage has been fully counted. With real sizes it can replace a sort-merge join by a broadcast join, merge tiny partitions to cut task overhead, and split oversized partitions to fix skew. Pipelined operators cannot change course mid-stream."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.qp = {
    id: "qp",
    name: "Query Processing",
    short: "QP",
    tagline: "From SQL text to a running plan, and why plans go wrong",
    color: "#fbbf24",
    blurb: "What happens between sending a SQL string and getting rows back: parsing, binding and rewriting; logical versus physical operators; iterator, vectorized and compiled execution; cost models, histograms, most-common values and distinct counts; why the independence assumption breaks; join ordering with dynamic programming; the four classic join algorithms with real I/O math; reading Postgres EXPLAIN ANALYZE; plan caches, adaptive execution and runtime filters; and the plan pathologies that page you at 3 a.m.",
    modules: [
      {
        id: "pipeline",
        name: "The Query Pipeline",
        icon: "queue",
        lessons: [
          {
            id: "parsing-to-plans",
            title: "From SQL text to a plan: parse, bind, rewrite, optimize",
            summary: "The stages every query passes through before a single row is read, and what each one is allowed to change.",
            minutes: 9,
            tags: ["parser", "binder", "rewriter", "optimizer", "pipeline"],
            blocks: [
              { t: "p", html: "Hold this picture: SQL is a <strong>declarative request</strong>, and the engine is a compiler. It turns text into a tree, checks the tree against the catalog, simplifies it with rules, searches for the cheapest way to run it, then executes. Every stage narrows the next stage's freedom, and most slow queries trace back to a decision made in the optimizer, not the executor." },
              { t: "diagram", id: "query-pipeline", caption: "SQL text becomes a parse tree, a bound logical plan, a rewritten plan, a costed physical plan, and finally a running operator tree." },
              { t: "h", text: "The five stages" },
              { t: "table", headers: ["Stage", "Input → output", "Typical failure"], rows: [
                ["Parse", "SQL text → parse tree (grammar only)", "Syntax error near a token"],
                ["Bind / analyze", "Parse tree → typed logical plan with resolved tables, columns, functions", "Unknown column, ambiguous name, type mismatch, missing permission"],
                ["Rewrite", "Logical plan → equivalent, simpler logical plan", "Rarely fails; a missed rewrite just leaves performance on the table"],
                ["Optimize", "Logical plan → cheapest physical plan the search found", "A plan that is correct but slow, almost always from a bad row estimate"],
                ["Execute", "Physical plan → rows", "Out of memory, spills to disk, lock waits, timeouts"]
              ] },
              { t: "h", text: "Parsing and binding" },
              { t: "p", html: "The parser knows only grammar: <code class='tok'>SELECT nme FROM users</code> parses perfectly. The <strong>binder</strong> (Postgres calls it parse analysis) resolves <code class='tok'>users</code> to a catalog object id, discovers that <code class='tok'>nme</code> does not exist, assigns a type to every expression, and expands <code class='tok'>*</code> into an explicit column list. After binding, the tree refers to catalog object ids and typed expressions rather than raw names, so later stages never have to resolve anything again." },
              { t: "code", lang: "sql", code:
                "-- What you wrote\n" +
                "SELECT * FROM active_customers WHERE signup_date > now() - interval '30 days';\n\n" +
                "-- What the planner actually receives after binding + view expansion\n" +
                "SELECT c.id, c.email, c.signup_date            -- * expanded\n" +
                "FROM   customers c                              -- view replaced by its definition\n" +
                "WHERE  c.deleted_at IS NULL                     -- the view's own filter\n" +
                "  AND  c.signup_date > now() - interval '30 days';" },
              { t: "h", text: "Rewriting: wins before any costing" },
              { t: "p", html: "Rewrites are transformations that are always (or almost always) beneficial, so they run without consulting the cost model. They matter because the optimizer can only search the space it is given: a correlated subquery that is never unnested will never be considered as a hash join." },
              { t: "table", headers: ["Rewrite", "Before", "After"], rows: [
                ["View expansion", "<code class='tok'>FROM active_customers</code>", "The view's query inlined, so its filters can merge with yours"],
                ["Predicate pushdown", "Filter above a join", "Filter applied at the scan, shrinking join inputs"],
                ["Subquery unnesting", "<code class='tok'>WHERE id IN (SELECT ...)</code>", "Semi-join that joins the join-order search"],
                ["Constant folding", "<code class='tok'>WHERE x > 2 * 50</code>", "<code class='tok'>WHERE x > 100</code>, evaluated once"],
                ["Outer-to-inner join", "<code class='tok'>LEFT JOIN b ... WHERE b.col = 5</code>", "Inner join, since the WHERE already rejects the NULL-extended rows"],
                ["Join elimination", "Join to a table whose columns are unused, on a unique key", "The join is dropped entirely"]
              ] },
              { t: "note", variant: "tip", html: "Prepared statements skip parse and bind on every execution after the first, and may reuse the plan too. That saves real CPU for short OLTP queries, and it is also where plan-caching surprises come from (see <em>plan pathologies</em>)." },
              { t: "h", text: "Where time actually goes" },
              { t: "stat", items: [
                { v: "~0.1–1 ms", k: "typical parse + plan for a simple OLTP query" },
                { v: "10s of ms", k: "planning a many-way join can reach this" },
                { v: "1000×", k: "spread between a good and bad plan for the same query" }
              ] },
              { t: "p", html: "The trade-off is search time versus plan quality. Spending another millisecond planning is cheap if it avoids a nested-loop disaster, and expensive if the query itself runs in 200 microseconds. That is why engines cap the join search and cache plans for hot statements." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"walk me through what happens when I run a query\", \"why does a view not slow things down\", \"where does an unknown column error come from\", \"what does the optimizer actually receive\"." },
              { t: "note", variant: "key", html: "<strong>Parse checks shape, bind checks meaning, rewrite simplifies for free, optimize searches with costs, execute runs.</strong> Slow-but-correct queries are nearly always an optimizer decision built on a wrong estimate." }
            ]
          },
          {
            id: "logical-vs-physical",
            title: "Logical vs physical operators",
            summary: "What the query asks for versus how the engine computes it, and the physical properties that tie them together.",
            minutes: 9,
            tags: ["relational-algebra", "operators", "physical-plan", "properties"],
            blocks: [
              { t: "p", html: "A <strong>logical operator</strong> states a result: filter these rows, join these two inputs on this key, group by this column. A <strong>physical operator</strong> is an algorithm with a cost: a sequential scan, a B+tree range scan, a hash join, a sort. One logical plan maps to many physical plans; the optimizer picks among them." },
              { t: "table", headers: ["Logical operator", "Physical choices (Postgres names)", "Chosen when"], rows: [
                ["Scan / select", "Seq Scan, Index Scan, Index Only Scan, Bitmap Heap Scan", "Seq for large fractions; index for few rows; bitmap in between"],
                ["Join", "Nested Loop, Hash Join, Merge Join", "NL for tiny outer + indexed inner; hash for big unsorted equi-joins; merge when inputs arrive sorted"],
                ["Aggregate", "HashAggregate, GroupAggregate (sorted), plain Aggregate", "Hash for many groups in memory; group-agg when input is already sorted"],
                ["Sort / ORDER BY", "Sort (quicksort, top-N heapsort, external merge), or none if an index supplies order", "Avoided entirely when a suitable index exists"],
                ["Distinct / set ops", "HashSetOp, sort + Unique", "Same hash-vs-sort trade-off as aggregation"]
              ] },
              { t: "h", text: "Physical properties connect the two" },
              { t: "p", html: "Physical operators produce and require <strong>properties</strong>. The most important is sort order: an index scan on <code class='tok'>orders(customer_id)</code> emits rows ordered by customer_id, which a merge join or GROUP BY can exploit with no sort. In distributed engines the second property is <strong>partitioning</strong>: a hash join needs both sides hash-partitioned on the join key, or the plan must add a shuffle (exchange) operator." },
              { t: "code", lang: "text", code:
                "Logical:   Aggregate[customer_id, sum(amount)]\n" +
                "             └─ Join[o.customer_id = c.id]\n" +
                "                  ├─ Scan orders o\n" +
                "                  └─ Filter[c.region = 'EU'] └─ Scan customers c\n\n" +
                "Physical A: HashAggregate ← Hash Join ← (Seq Scan orders, Hash ← Seq Scan customers)\n" +
                "Physical B: GroupAggregate ← Merge Join ← (Index Scan orders_cust_idx, Sort ← Seq Scan customers)\n" +
                "            B pays for one sort but gets grouping order for free from the merge join." },
              { t: "h", text: "Two ways to search the space" },
              { t: "compare",
                bad: { title: "Bottom-up (System R style, Postgres)", items: ["Build best plans for single tables, then pairs, then triples", "Simple, fast for moderate joins", "Rewrites and implementation choice are separate phases", "Harder to extend with new transformation rules"] },
                good: { title: "Top-down rule-based (Cascades style)", items: ["Memo of equivalent expressions, explored by transformation rules", "Required properties pushed down from the root", "Used by SQL Server, Greenplum's Orca, CockroachDB", "More machinery; search must be pruned with cost bounds"] } },
              { t: "note", variant: "warn", html: "Logical equivalence is subtle with NULLs and outer joins. <code class='tok'>NOT IN (subquery)</code> is not the same as an anti-join when the subquery can return NULL, which is why engines only rewrite it when the column is provably non-null." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the answer shows"], rows: [
                ["Mid", "Names a few physical operators and knows index scan vs seq scan depends on row count"],
                ["Senior", "Explains logical → physical mapping, sort order as a property, hash vs sort aggregation trade-off"],
                ["Staff", "Discusses property enforcement (sorts and exchanges inserted by the optimizer), Cascades vs bottom-up search, and NULL-semantics limits on rewrites"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"why did it choose a Sort here\", \"why a HashAggregate instead of GroupAggregate\", \"why is there an Exchange or Redistribute node\", \"same query, different plan on another database\"." },
              { t: "note", variant: "key", html: "<strong>Logical says what, physical says how, and properties like sort order and partitioning decide which how is cheapest.</strong> A sort you avoid is often worth more than the join algorithm you pick." }
            ]
          },
          {
            id: "execution-models",
            title: "Execution models: Volcano iterators, vectorized, compiled",
            summary: "Pull one row at a time, pull a batch at a time, or generate a tight loop: what each costs per row and who uses it.",
            minutes: 11,
            tags: ["volcano", "iterator", "vectorized", "codegen", "jit", "pipelines"],
            blocks: [
              { t: "p", html: "Every physical plan is a tree of operators, but there are three ways to drive it. The <strong>iterator (Volcano) model</strong> pulls one row at a time through <code class='tok'>next()</code>. The <strong>vectorized model</strong> pulls a batch of roughly a thousand values per call. The <strong>compiled model</strong> fuses a whole pipeline into one generated loop. They produce identical results; they differ in how much overhead each row pays." },
              { t: "h", text: "Volcano: the iterator model" },
              { t: "code", lang: "python", code:
                "class Filter:\n" +
                "    def __init__(self, child, pred): self.child, self.pred = child, pred\n" +
                "    def open(self):  self.child.open()\n" +
                "    def next(self):                      # called once per output row\n" +
                "        while (row := self.child.next()) is not None:\n" +
                "            if self.pred(row):           # interpreted expression tree\n" +
                "                return row\n" +
                "        return None\n" +
                "    def close(self): self.child.close()\n\n" +
                "# root.open(); while (r := root.next()): emit(r); root.close()" },
              { t: "p", html: "It is elegant: each operator is independent, streaming is natural, and LIMIT stops work early. Postgres, MySQL and SQLite use this model. The cost is per-row overhead: at least one indirect call per operator per row plus an interpreted expression evaluation. For OLTP queries touching a few hundred rows that is irrelevant; for a scan of 500 million rows it can dominate the actual work." },
              { t: "h", text: "Vectorized: amortise the overhead" },
              { t: "p", html: "Vectorized engines (DuckDB, the X100 lineage behind Vectorwise, ClickHouse, Snowflake, many columnar engines) pass <strong>column vectors</strong> of typically 1k–2k values. A filter runs a tight loop over a vector and writes a selection vector of qualifying positions. One call now covers a thousand rows, loops are simple enough for the CPU to pipeline and for the compiler to use SIMD, and the vector fits in L1/L2 cache." },
              { t: "h", text: "Compiled: generate the loop" },
              { t: "p", html: "Compiling engines (HyPer and Umbra, Spark's whole-stage code generation, SingleStore) generate code for each <strong>pipeline</strong>: the scan, filter, projection and hash-probe become one loop that keeps the current row in CPU registers. Postgres has a narrower form: with <code class='tok'>jit</code> enabled it uses LLVM to compile expression evaluation and tuple deforming once a plan's cost crosses <code class='tok'>jit_above_cost</code> (100,000 by default)." },
              { t: "table", headers: ["Model", "Per-row overhead", "Strength", "Cost / weakness"], rows: [
                ["Iterator (pull, row)", "High: calls + interpretation per row per operator", "Simple, low latency to first row, great for OLTP", "Slow on large analytic scans"],
                ["Vectorized (pull, batch)", "Low: amortised across ~1k rows", "SIMD-friendly, cache-friendly, no compile step", "Materialises intermediate vectors; harder for row-at-a-time logic"],
                ["Compiled (push, fused)", "Lowest: data stays in registers", "Fastest tight loops for complex expressions", "Compile latency (ms), harder to debug and profile"]
              ] },
              { t: "h", text: "Pipelines and pipeline breakers" },
              { t: "p", html: "A <strong>pipeline</strong> is a chain of operators that pass rows through without storing them: scan → filter → project → hash-probe. A <strong>pipeline breaker</strong> must consume all of its input first: the hash-join build side, a sort, a hash aggregate. Breakers cut the plan into pipelines, consume memory, and are where spills to disk happen. Modern parallel engines split each pipeline's input into small <em>morsels</em> and let worker threads grab them, which balances load without a fixed partitioning." },
              { t: "note", variant: "trap", html: "Do not claim vectorized always beats compiled or the reverse. Published comparisons show each winning on different workloads; the honest answer is that both remove most interpretation overhead and the remaining gap is small next to a bad plan." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"why is DuckDB so fast on my laptop\", \"what does open/next/close mean\", \"why does Postgres JIT sometimes make queries slower\" (compile time on a short query), \"what is a pipeline breaker\"." },
              { t: "quiz", id: "qp-pipeline" },
              { t: "note", variant: "key", html: "<strong>Same plan, three engines: pull a row, pull a batch, or run a fused loop.</strong> Per-row overhead matters for big scans and barely matters for OLTP; pipeline breakers are where memory and spills live." }
            ]
          }
        ]
      },
      {
        id: "optimizer",
        name: "The Optimizer",
        icon: "compass",
        lessons: [
          {
            id: "cost-based-optimizer",
            title: "How a cost-based optimizer prices a plan",
            summary: "Cost units, the Postgres cost parameters, and why the cost model is only as good as the row counts fed into it.",
            minutes: 10,
            tags: ["cost-model", "optimizer", "postgres", "random-page-cost"],
            blocks: [
              { t: "p", html: "A cost-based optimizer enumerates candidate plans, assigns each a number, and keeps the smallest. The number is not milliseconds; it is an <strong>abstract cost</strong> built from estimated page reads and estimated rows processed. Two inputs drive it: <strong>constants</strong> that describe your hardware, and <strong>cardinality estimates</strong> that describe your data. Wrong constants shift plans at the margin; wrong cardinalities flip them completely." },
              { t: "h", text: "Postgres cost parameters" },
              { t: "table", headers: ["Parameter", "Default", "Meaning"], rows: [
                ["<code class='tok'>seq_page_cost</code>", "1.0", "Read one page as part of a sequential scan (the unit)"],
                ["<code class='tok'>random_page_cost</code>", "4.0", "Read one page at a random location; commonly lowered toward 1.1–2 on SSDs"],
                ["<code class='tok'>cpu_tuple_cost</code>", "0.01", "Process one row"],
                ["<code class='tok'>cpu_index_tuple_cost</code>", "0.005", "Process one index entry"],
                ["<code class='tok'>cpu_operator_cost</code>", "0.0025", "Evaluate one operator or function call"],
                ["<code class='tok'>effective_cache_size</code>", "4GB", "Planner's guess of OS + buffer cache, used to discount repeated index page reads"]
              ] },
              { t: "h", text: "Worked example" },
              { t: "code", lang: "text", code:
                "Table: 1,000,000 rows on 10,000 pages. Query: WHERE status = 'refunded' (est. 0.2% → 2,000 rows)\n\n" +
                "Seq Scan   = 10,000 pages × 1.0          = 10,000\n" +
                "           + 1,000,000 rows × 0.01       = 10,000\n" +
                "           + 1,000,000 × 0.0025 (filter) =  2,500\n" +
                "           total                         ≈ 22,500\n\n" +
                "Index Scan ≈ index descent + 2,000 heap fetches\n" +
                "           ≈ 2,000 × 4.0 (random pages, uncorrelated heap) = 8,000\n" +
                "           + small CPU terms                               ≈ 8,100   → index wins\n\n" +
                "Same query at 2% (20,000 rows): index ≈ 80,000+  → seq scan wins (crossover ≈ 0.5%)" },
              { t: "p", html: "Notice how sensitive the choice is to the row estimate, and how insensitive it is to the CPU constants. Halving <code class='tok'>cpu_tuple_cost</code> barely moves anything; underestimating rows by 10× moves the plan across the crossover. Postgres also uses the column's physical <strong>correlation</strong> statistic: if the heap is stored in index order, heap fetches are nearly sequential and the index scan is priced much cheaper." },
              { t: "compare",
                bad: { title: "Tuning the cost constants first", items: ["Feels productive: change one setting, plans move", "Masks the real error and moves other queries too", "Breaks again after the next data change"] },
                good: { title: "Fixing the cardinality first", items: ["Compare estimated vs actual rows in EXPLAIN ANALYZE", "Correct the statistics where the error starts", "Tune constants only to match the hardware, once"] } },
              { t: "note", variant: "warn", html: "Lowering <code class='tok'>random_page_cost</code> on SSD storage is reasonable. Lowering it to make one slow query use an index is a global change disguised as a local fix." },
              { t: "h", text: "Startup cost and total cost" },
              { t: "p", html: "Every Postgres node has two costs: <strong>startup</strong> (work before the first row) and <strong>total</strong>. A sort has a high startup cost; an index scan in the right order has almost none. With <code class='tok'>LIMIT 10</code> the planner interpolates toward startup cost, which is why it may prefer walking an index in ORDER BY order over sorting, and why that choice goes wrong when matching rows are rare and the walk goes much further than expected." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"why does the optimizer ignore my index\", \"what are the cost numbers in EXPLAIN\", \"should I set random_page_cost to 1\", \"why does adding LIMIT change the plan\"." },
              { t: "note", variant: "key", html: "<strong>Cost = page I/O + rows processed, priced with hardware constants and multiplied by estimated row counts.</strong> The constants nudge; the row estimates decide. Fix cardinality before you touch the knobs." }
            ]
          },
          {
            id: "statistics-cardinality",
            title: "Statistics and cardinality: histograms, MCVs, NDV",
            summary: "What the planner knows about your data, the selectivity formulas it applies, and where the independence assumption breaks.",
            minutes: 12,
            tags: ["statistics", "histograms", "mcv", "ndv", "selectivity", "extended-statistics"],
            blocks: [
              { t: "p", html: "Cardinality estimation is the optimizer's weakest link and its most important input. The planner never looks at your table while planning; it looks at a <strong>summary</strong> gathered by <code class='tok'>ANALYZE</code> from a random sample. In Postgres the sample is 300 × <code class='tok'>default_statistics_target</code> rows (30,000 at the default of 100), and the results live in <code class='tok'>pg_statistic</code>, readable through the <code class='tok'>pg_stats</code> view." },
              { t: "h", text: "What is stored per column" },
              { t: "table", headers: ["Statistic", "pg_stats column", "Used for"], rows: [
                ["Null fraction", "<code class='tok'>null_frac</code>", "IS NULL / IS NOT NULL, and scaling every other estimate"],
                ["Distinct values (NDV)", "<code class='tok'>n_distinct</code> (negative = fraction of rows)", "Equality on non-MCV values, GROUP BY size, join selectivity"],
                ["Most common values + frequencies", "<code class='tok'>most_common_vals</code>, <code class='tok'>most_common_freqs</code>", "Exact frequency for heavy hitters (up to target, 100 entries by default)"],
                ["Equi-depth histogram", "<code class='tok'>histogram_bounds</code>", "Range predicates over values not in the MCV list"],
                ["Physical correlation", "<code class='tok'>correlation</code>", "How sequential index-order heap fetches will be"]
              ] },
              { t: "h", text: "The selectivity formulas" },
              { t: "code", lang: "text", code:
                "col = c,   c in MCV list       → its recorded frequency\n" +
                "col = c,   c not in MCV list   → (1 − null_frac − Σ mcv_freqs) / (n_distinct − #mcvs)\n" +
                "col < c                        → fraction of histogram buckets below c (linear inside the\n" +
                "                                 partial bucket) × non-MCV share + MCV freqs below c\n" +
                "p1 AND p2                      → s1 × s2                (independence assumption)\n" +
                "p1 OR p2                       → s1 + s2 − s1 × s2\n" +
                "a.x = b.y  (equi-join)         → 1 / max(ndv(a.x), ndv(b.y))\n" +
                "join rows                      → |A| × |B| × join selectivity\n" +
                "f(col) = c, no stats on f(col) → a fixed default guess (Postgres uses 0.5% for equality)" },
              { t: "p", html: "An <strong>equi-depth</strong> histogram puts the same number of rows in every bucket, so skewed ranges get narrow buckets and estimates stay accurate where the data is dense. With 100 buckets each one represents about 1% of the non-MCV rows, so a range estimate can be off by up to about one bucket's worth at each edge." },
              { t: "h", text: "Where the independence assumption breaks" },
              { t: "p", html: "Multiplying selectivities is exact only if the columns are statistically independent. Real data is full of <strong>correlated columns</strong>: city and country, make and model, order status and carrier, zip code and state. When one predicate implies the other, the true selectivity is close to the smaller one, but the planner reports the product. The error compounds: three correlated predicates at 10% each give an estimate of 0.1% against a truth of 10%, a 100× underestimate. Through a few joins, errors of several orders of magnitude are normal." },
              { t: "widget", id: "qpCardinality" },
              { t: "h", text: "Fixes, ordered by how often they work" },
              { t: "table", headers: ["Tier", "Fix", "Trade-off"], rows: [
                ["Naive", "Force the plan with a hint or by disabling an operator", "Treats the symptom; breaks when data changes"],
                ["Solid", "<code class='tok'>ANALYZE</code> after bulk loads; raise the target on skewed columns: <code class='tok'>ALTER TABLE t ALTER COLUMN c SET STATISTICS 1000</code>", "Longer ANALYZE, slightly slower planning"],
                ["Standout", "<code class='tok'>CREATE STATISTICS s (dependencies, ndistinct, mcv) ON make, model FROM cars</code> so the planner sees the correlation directly", "Must be created per column group you care about; ANALYZE does more work"]
              ] },
              { t: "note", variant: "tip", html: "Postgres extended statistics arrived in version 10 (functional dependencies and n-distinct), with multi-column MCV lists added in 12. SQL Server builds multi-column statistics on composite indexes; Oracle has column groups. Every major engine has a version of this fix because every engine has this problem." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"estimated 50 rows, actual 50,000\", \"filtering on two related columns is slow\", \"query got slow after a big import\", \"what does ANALYZE actually store\"." },
              { t: "note", variant: "key", html: "<strong>The planner sees MCVs, a histogram, NDV and null fraction per column, and multiplies across columns as if they were independent.</strong> Correlated predicates cause underestimates; extended statistics and fresh ANALYZE are the real fixes." }
            ]
          },
          {
            id: "join-ordering",
            title: "Join ordering: dynamic programming, left-deep vs bushy",
            summary: "Why join order dominates cost, how System R style DP searches it, and how engines cap the search for many-way joins.",
            minutes: 11,
            tags: ["join-ordering", "dynamic-programming", "left-deep", "bushy", "geqo"],
            blocks: [
              { t: "p", html: "Join order decides the size of every intermediate result, and intermediate sizes decide cost. Joining a 10-row filtered dimension first can shrink a billion-row fact table to thousands of rows; joining it last means the billion rows flow through every earlier join. The optimizer's hardest job is choosing this order without trying every option." },
              { t: "h", text: "The search space explodes" },
              { t: "stat", items: [
                { v: "3,628,800", k: "left-deep orders for 10 tables (10!)" },
                { v: "~17.6 billion", k: "bushy trees for 10 tables ((2n−2)!/(n−1)!)" },
                { v: "1,024", k: "table subsets DP actually tracks for 10 tables (2^10)" }
              ] },
              { t: "h", text: "System R dynamic programming" },
              { t: "p", html: "The key insight is that the best way to join a set of tables does not depend on what you join it with later (apart from sort order). So the optimizer builds the best plan for every single table, then every pair, then every triple, each time reusing the best plans for the smaller subsets." },
              { t: "code", lang: "text", code:
                "for each table t:        best[{t}] = cheapest access path (seq, index, bitmap)\n" +
                "for size = 2 .. n:\n" +
                "  for each subset S of that size that is connected by join predicates:\n" +
                "    for each split S = L ∪ R  (left-deep: R is a single table)\n" +
                "      for each join method in {nested loop, hash, merge}:\n" +
                "        cand = cost(best[L]) + cost(best[R]) + joinCost(method, rows(L), rows(R))\n" +
                "        keep cand if cheapest for S, or cheapest for S with a useful sort order\n" +
                "return best[all tables]" },
              { t: "p", html: "Two refinements make it practical. Subsets with no join predicate between them are skipped, so cross products are avoided unless forced. And the algorithm keeps the cheapest plan per <strong>interesting order</strong>, because a slightly costlier plan that emits rows sorted on the next join key or the ORDER BY column can win overall." },
              { t: "compare",
                bad: { title: "Left-deep trees", items: ["Right input is always a base table", "Natural pipelining: probe hash tables built on base tables", "Much smaller search space", "Can miss plans that join two small results first"] },
                good: { title: "Bushy trees", items: ["Both inputs may be join results", "Can join two filtered branches independently, then combine", "Good for star and snowflake joins and parallel execution", "Search space far larger; needs pruning"] } },
              { t: "h", text: "How real engines cap the search" },
              { t: "table", headers: ["Engine", "Strategy"], rows: [
                ["Postgres", "Exhaustive DP (including bushy plans) up to <code class='tok'>geqo_threshold</code> = 12 FROM items, genetic search beyond; <code class='tok'>join_collapse_limit</code> and <code class='tok'>from_collapse_limit</code> (8) limit how much gets flattened into one problem"],
                ["MySQL", "Greedy search with depth bounded by <code class='tok'>optimizer_search_depth</code>"],
                ["SQL Server / Cascades family", "Rule-based exploration of a memo with staged timeouts: stop when a good-enough plan is found"],
                ["Analytic engines", "Heuristics for star schemas (filter dimensions first) plus cost-based reordering; some reorder at runtime"]
              ] },
              { t: "note", variant: "trap", html: "With an explicit <code class='tok'>JOIN</code> chain longer than <code class='tok'>join_collapse_limit</code>, Postgres keeps your written order for the excess joins. A query generated by an ORM with 15 joins can therefore be planned partly in the order the ORM happened to emit." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the answer shows"], rows: [
                ["Mid", "Knows join order matters and that the optimizer chooses it"],
                ["Senior", "Explains DP over subsets, left-deep vs bushy, why cross products are avoided"],
                ["Staff", "Explains that cardinality errors compound through joins, so the search is only as good as its estimates; mentions interesting orders, search caps and adaptive or runtime re-optimization"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"query with many joins got slow after adding one more table\", \"star schema with one fact and five dimensions\", \"how does the optimizer pick the join order\", \"why is the plan different when I reorder the FROM clause\"." },
              { t: "quiz", id: "qp-optimizer" },
              { t: "note", variant: "key", html: "<strong>DP over table subsets finds the cheapest join order without trying every permutation, keeping extra plans for useful sort orders.</strong> Engines cap the search for many-way joins, and every choice inherits the cardinality errors underneath it." }
            ]
          }
        ]
      },
      {
        id: "joins",
        name: "Joins, Plans & Pathologies",
        icon: "share",
        lessons: [
          {
            id: "join-algorithms",
            title: "Join algorithms with real I/O math",
            summary: "Block nested loop, index nested loop, Grace hash and sort-merge: the cost formulas, when each wins, and what memory buys you.",
            minutes: 12,
            tags: ["joins", "hash-join", "merge-join", "nested-loop", "io-cost"],
            blocks: [
              { t: "p", html: "Four algorithms cover nearly every join an engine runs. The mental model: <strong>nested loops</strong> compare pairs, <strong>hash joins</strong> partition both sides so only matching buckets meet, and <strong>sort-merge</strong> sorts both sides so matches line up. Which wins depends on input sizes, memory, available indexes and whether the inputs are already sorted." },
              { t: "h", text: "The formulas" },
              { t: "p", html: "Notation: R has M pages and m rows, S has N pages, B is memory in pages. Costs count page I/Os and ignore writing the final output, the standard textbook convention." },
              { t: "table", headers: ["Algorithm", "I/O cost", "Wins when", "Needs"], rows: [
                ["Block nested loop", "M + ⌈M/(B−2)⌉ · N", "One input almost fits in memory, or the predicate is not an equality", "Nothing; handles any predicate"],
                ["Index nested loop", "M + m · (cost per probe)", "Outer side is small (tens to a few thousand rows) and inner has an index on the key", "An index on the inner join column"],
                ["Grace hash", "3(M + N) when B > √(smaller)", "Large, unsorted equi-joins", "Equality predicate; memory ≈ √ of the smaller input"],
                ["Sort-merge", "sort(R) + sort(S) + M + N, with sort(X) = 2 · X · passes", "Inputs already sorted (index order) or output must be sorted anyway", "Equality (merge) condition; sort order"]
              ] },
              { t: "code", lang: "text", code:
                "R = 1,000 pages (100 rows/page → m = 100,000), S = 500 pages, B = 102 pages\n\n" +
                "Block NL (S outer, smaller) = 500 + ⌈500/100⌉ × 1,000       =   5,500\n" +
                "Index NL (R outer, 2 I/O)   = 1,000 + 100,000 × 2            = 201,000\n" +
                "Grace hash (√500 ≈ 22 < 102) = 3 × (1,000 + 500)             =   4,500   ← cheapest\n" +
                "Sort-merge                  = 2·1,000·2 + 2·500·2 + 1,500    =   7,500\n" +
                "  (each relation needs 2 passes: one to form runs of B pages, one to merge them)\n" +
                "If both inputs were already sorted: sort-merge = 1,500, beating hash." },
              { t: "widget", id: "qpJoinCost" },
              { t: "h", text: "Hash joins in practice" },
              { t: "p", html: "In Postgres the build side's hash table must fit in roughly <code class='tok'>work_mem</code> × <code class='tok'>hash_mem_multiplier</code>; if not, the join splits into <strong>batches</strong> written to temporary files, which is the Grace partitioning step. <code class='tok'>Batches: 1</code> in EXPLAIN means it stayed in memory. Hybrid hash joins keep the first partition in memory and only spill the rest, so cost degrades gradually instead of jumping straight to 3(M+N). Skew is the main hazard: one heavy key value creates a partition that never fits." },
              { t: "h", text: "Choosing between them" },
              { t: "table", headers: ["Tier", "Reasoning out loud"], rows: [
                ["Naive", "\"Hash joins are fastest, always use them.\" Ignores tiny outer sides and sorted inputs."],
                ["Solid", "\"Index nested loop for a selective outer side, hash for large equi-joins, merge when inputs arrive sorted.\""],
                ["Standout", "Adds the crossover: index NL costs grow with outer rows times probe cost, so it is excellent at 50 rows and terrible at 500,000. The choice is only as good as the outer-side estimate."]
              ] },
              { t: "note", variant: "warn", html: "Only nested loops handle arbitrary predicates such as range or inequality joins. If you see a slow Nested Loop on <code class='tok'>BETWEEN</code>, the fix is usually a different query shape or a range-friendly index, not a hash join hint." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"which join algorithm would you pick\", \"join is spilling to disk\", \"Batches: 16 in the hash node\", \"estimate the I/O cost of joining these two tables\", \"why a merge join here\"." },
              { t: "note", variant: "key", html: "<strong>Index NL for a small outer, hash for big unsorted equi-joins at about 3(M+N), merge when sort order is free.</strong> Memory above √(smaller input) buys a one-pass hash join; below it, every extra pass rewrites both inputs." }
            ]
          },
          {
            id: "reading-explain",
            title: "Reading Postgres EXPLAIN ANALYZE",
            summary: "Read plans inside out, compare estimated and actual rows, multiply by loops, and use buffers to see real I/O.",
            minutes: 11,
            tags: ["explain", "explain-analyze", "postgres", "buffers", "debugging"],
            blocks: [
              { t: "p", html: "<code class='tok'>EXPLAIN</code> shows the plan the optimizer chose and its estimates. <code class='tok'>EXPLAIN ANALYZE</code> runs the query and adds what really happened. The whole skill is comparing the two: find the lowest node in the tree where estimate and reality diverge, because every node above it made decisions on bad information." },
              { t: "code", lang: "sql", code:
                "EXPLAIN (ANALYZE, BUFFERS)\n" +
                "SELECT o.id, c.email\n" +
                "FROM   orders o JOIN customers c ON c.id = o.customer_id\n" +
                "WHERE  o.status = 'shipped' AND o.carrier = 'ACME';\n\n" +
                "Nested Loop  (cost=0.85..152.40 rows=12 width=40) (actual time=0.05..4210.5 rows=15840 loops=1)\n" +
                "  Buffers: shared hit=48210 read=19870\n" +
                "  ->  Index Scan using orders_status_idx on orders o  (cost=0.43..52.10 rows=12 width=16)\n" +
                "                                       (actual time=0.03..380.2 rows=15840 loops=1)\n" +
                "        Index Cond: (status = 'shipped')\n" +
                "        Filter: (carrier = 'ACME')\n" +
                "        Rows Removed by Filter: 402160\n" +
                "  ->  Index Scan using customers_pkey on customers c  (cost=0.42..8.36 rows=1 width=32)\n" +
                "                                       (actual time=0.02..0.24 rows=1 loops=15840)\n" +
                "        Index Cond: (id = o.customer_id)\n" +
                "Planning Time: 0.4 ms\n" +
                "Execution Time: 4219.8 ms" },
              { t: "h", text: "How to read each field" },
              { t: "table", headers: ["Field", "Meaning", "Watch for"], rows: [
                ["<code class='tok'>cost=0.85..152.40</code>", "Startup cost .. total cost, in planner units", "Only comparable within one plan, never across queries"],
                ["<code class='tok'>rows=12</code>", "Estimated rows per execution of this node", "Compare with actual rows"],
                ["<code class='tok'>actual time=0.05..4210.5</code>", "Milliseconds to first row .. last row, <em>per loop</em>", "Multiply by loops for the total"],
                ["<code class='tok'>rows=15840 loops=1</code>", "Actual rows per loop, and how many times the node ran", "loops in the thousands under a Nested Loop"],
                ["<code class='tok'>Rows Removed by Filter</code>", "Rows read then discarded", "Large values: a missing or wrong index"],
                ["<code class='tok'>Buffers: shared hit / read</code>", "Pages found in shared buffers vs requested from the OS (which may still be OS-cached)", "High read counts, and temp read/written for spills"]
              ] },
              { t: "h", text: "A reading routine" },
              { t: "ol", items: [
                "Read from the innermost, most indented nodes outward: children run before their parents produce output.",
                "For each node compute the misestimate factor: max(est, actual) / min(est, actual). Above about 10× is worth investigating.",
                "Multiply actual time and rows by <code class='tok'>loops</code> before deciding where time went.",
                "Find the <strong>lowest</strong> node with a large misestimate; that is the root cause, the rest is fallout.",
                "Check memory signals: <code class='tok'>Batches</code> above 1 on Hash, <code class='tok'>Sort Method: external merge</code>, <code class='tok'>Disk Usage</code> on HashAggregate.",
                "Only then look at total time per node to see what the error cost."
              ] },
              { t: "widget", id: "qpExplain" },
              { t: "note", variant: "warn", html: "<code class='tok'>EXPLAIN ANALYZE</code> really executes the statement. For INSERT, UPDATE or DELETE wrap it in <code class='tok'>BEGIN; ... ROLLBACK;</code>. Per-node timing also adds overhead on fast nodes with many loops; <code class='tok'>EXPLAIN (ANALYZE, TIMING OFF)</code> keeps row counts while dropping the clock calls." },
              { t: "note", variant: "trap", html: "Under a <code class='tok'>Limit</code>, child nodes stop early, so actual rows can be far below the estimate without any misestimate. The same happens with the inner side of a merge join and with semi-joins that stop at the first match." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> someone pastes a plan and asks \"why is this slow\", \"estimated vs actual rows differ\", \"what does loops mean\", \"what are shared hit and read\"." },
              { t: "note", variant: "key", html: "<strong>Compare estimated and actual rows, multiply by loops, and fix the lowest node where they diverge.</strong> Buffers tell you the real I/O; Batches, external merge and Disk Usage tell you about memory." }
            ]
          },
          {
            id: "adaptive-execution",
            title: "Plan caching, adaptive execution and runtime filters",
            summary: "Why engines cache plans, how they correct bad estimates while the query runs, and how runtime bloom filters and dynamic partition pruning shrink star joins.",
            minutes: 11,
            tags: ["plan-cache", "adaptive-execution", "aqe", "runtime-filters", "dynamic-partition-pruning"],
            blocks: [
              { t: "p", html: "A classic optimizer decides everything before the first row is read, using estimates. Two pressures push engines beyond that model. OLTP systems run the same statement thousands of times a second, so <strong>planning itself</strong> becomes a cost worth caching. Analytical systems run huge joins where one bad estimate costs minutes, so they <strong>watch real row counts and change course mid-flight</strong>." },
              { t: "h", text: "Plan caches in one table" },
              { t: "table", headers: ["Engine", "What is cached", "Main risk and lever"], rows: [
                ["PostgreSQL", "Per-session prepared statements; no shared cache across connections", "Generic plan after five custom ones; <code class='tok'>plan_cache_mode</code>"],
                ["SQL Server", "Shared plan cache keyed by statement text and settings", "Parameter sniffing; <code class='tok'>OPTION (RECOMPILE)</code>, Query Store plan forcing, parameter-sensitive plans in newer versions"],
                ["Oracle", "Shared cursor cache", "Bind peeking; adaptive cursor sharing keeps several plans per statement"],
                ["MySQL", "No reusable execution plan cache; prepared statements still re-optimise", "Planning cost is paid each time, so estimates are always fresh"]
              ] },
              { t: "p", html: "The plan-pathologies lesson covers how a cached plan goes wrong for skewed parameters. The rest of this lesson is about the opposite move: deciding later, with better information." },
              { t: "h", text: "Adaptive execution: re-deciding with real numbers" },
              { t: "ul", items: [
                "<strong>Adaptive joins</strong> (SQL Server): the plan contains both a hash join and a nested-loop branch. After reading the build input, a row-count threshold picks which one runs.",
                "<strong>Memory grant feedback</strong> (SQL Server): if a query spilled or wasted memory, its next execution gets a corrected grant.",
                "<strong>Adaptive plans and statistics feedback</strong> (Oracle): subplans switch join method at runtime, and actual cardinalities inform the next parse.",
                "<strong>Adaptive query execution</strong> (Spark): at each shuffle boundary the engine sees exact sizes, then switches a sort-merge join to a broadcast join when one side turned out small, coalesces many tiny shuffle partitions, and splits skewed partitions so one task does not run for an hour.",
                "Postgres does not re-plan during execution, which is why accurate statistics matter so much there."
              ] },
              { t: "note", variant: "tip", html: "Adaptive execution works at <em>materialisation points</em>, where all of a stage's output has been counted. Pipelined operators cannot change their mind halfway through without buffering, which is why the switch happens at shuffle boundaries or after the hash build." },
              { t: "h", text: "Runtime filters" },
              { t: "p", html: "In a star join the selective predicate is usually on a small dimension (<code class='tok'>region = 'EMEA'</code>, one week of dates) while the cost is in scanning the huge fact table. Once the hash join has built its table on the filtered dimension, the engine knows exactly which join keys can match. A <strong>runtime filter</strong> summarises them (a bloom filter, a min/max range, or for tiny sets an exact IN-list) and pushes it into the fact-table scan. Rows that cannot match are dropped before they are decoded further, shuffled across the network or probed." },
              { t: "p", html: "<strong>Dynamic partition pruning</strong> goes one step further: if the fact table is partitioned or clustered on the join key, the filter's key range is checked against partition values or file-level min/max statistics, and whole files are never opened. Snowflake, Spark, Trino (\"dynamic filtering\"), Impala and many others implement versions of this." },
              { t: "widget", id: "qpRuntimeFilter" },
              { t: "code", lang: "sql", code:
                "-- The shape that benefits: selective dimension, huge fact\n" +
                "SELECT d.week, SUM(f.amount)\n" +
                "FROM sales f\n" +
                "JOIN dates d ON d.date_key = f.date_key\n" +
                "WHERE d.fiscal_quarter = 'Q3 FY2026'      -- ~90 of 4,000 date rows\n" +
                "GROUP BY d.week;\n" +
                "-- Without a runtime filter: scan every sales file, probe every row.\n" +
                "-- With one: the date_key range of Q3 is pushed into the sales scan;\n" +
                "-- if sales is clustered by date_key, most files are skipped outright." },
              { t: "compare",
                bad: { title: "Static plan only", items: ["Fact scan reads everything the static predicates allow", "Join filters only after rows are shuffled and probed", "Partition pruning only for literals in the WHERE clause", "Correct, but pays for rows that can never match"] },
                good: { title: "With runtime filters", items: ["Build side summarises surviving keys after it is built", "Probe-side scan drops non-matching rows early", "File and partition skipping from key ranges discovered at runtime", "Biggest win when the fact table is clustered on the join key"] } },
              { t: "note", variant: "warn", html: "Runtime filters are heuristics. Engines skip them when the build side is large (the filter would let almost everything through) and bloom filters have false positives, so the join still re-checks every row. If the fact table's layout is random with respect to the key, file pruning finds nothing to skip." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"why is this star join fast in one engine and slow in another?\"", "Why"], rows: [
                ["Naive", "The fast engine has more nodes.", "No mechanism"],
                ["Solid", "The fast engine pushes a runtime filter from the dimension into the fact scan, so far fewer rows are shuffled and probed.", "Names the mechanism"],
                ["Standout", "Also checks whether the fact table is clustered on the join key (so files are pruned, not just rows), whether adaptive execution switched join strategy, and how the plan cache interacts with skewed parameters.", "Connects layout, runtime decisions and caching"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"filter is on the dimension but the whole fact table is scanned\", \"partition pruning only works with literal dates\", \"Spark job has one straggler task\" (skew, AQE), \"plan flips between fast and slow\" (plan cache). Ask what the engine knows at plan time versus at runtime." },
              { t: "note", variant: "key", html: "<strong>Plan caches trade freshness for planning cost; adaptive execution and runtime filters trade a little bookkeeping for decisions made on real data.</strong> Runtime bloom filters cut rows before the join, and dynamic partition pruning skips whole files when the fact table is laid out by the join key." }
            ]
          },
          {
            id: "plan-pathologies",
            title: "Plan pathologies: misestimates, parameter sniffing, nested loop explosions",
            summary: "The recurring ways good optimizers produce terrible plans, how to recognise each in EXPLAIN, and the fixes that last.",
            minutes: 12,
            tags: ["pathologies", "parameter-sniffing", "generic-plans", "misestimates", "nested-loop"],
            blocks: [
              { t: "p", html: "Most production plan regressions are not optimizer bugs. They are the optimizer making a reasonable choice from wrong inputs: stale statistics, correlated columns, a cached plan built for a different parameter, or a predicate it cannot estimate. Learn the handful of recurring shapes and you can diagnose most slow queries from the plan alone." },
              { t: "h", text: "The catalogue" },
              { t: "table", headers: ["Pathology", "What you see in the plan", "Lasting fix"], rows: [
                ["Correlated predicates", "Scan estimated at tens of rows, actual thousands; product of selectivities", "<code class='tok'>CREATE STATISTICS</code> on the column group; or a composite index the stats can follow"],
                ["Stale statistics after bulk load", "Range on newest data estimated near zero", "<code class='tok'>ANALYZE</code> as the last step of every load job"],
                ["Nested loop explosion", "Nested Loop with an inner node at loops in the tens of thousands", "Fix the outer-side estimate; the planner then chooses hash on its own"],
                ["Unestimable predicate", "<code class='tok'>WHERE lower(email) = ...</code> or a function call estimated by a default guess", "Expression index (which gets its own statistics) or rewrite to a plain column predicate"],
                ["Hash or sort spill", "Hash <code class='tok'>Batches: 32</code>, <code class='tok'>external merge Disk</code>", "Correct the estimate first; then raise <code class='tok'>work_mem</code> for that session or role"],
                ["LIMIT with rare matches", "Index walk in ORDER BY order with huge Rows Removed by Filter", "Index that covers both the filter and the order, or a rewrite"]
              ] },
              { t: "h", text: "Parameter sniffing and generic plans" },
              { t: "p", html: "Caching plans saves planning time, but a cached plan was built for <em>some</em> parameter values. SQL Server compiles a statement with the first parameter values it sees (\"sniffing\") and reuses that plan; if the first caller asked for a rare value, every later caller asking for a heavy hitter inherits an index-seek plan built for 10 rows. Postgres prepared statements plan <strong>custom</strong> plans for the first five executions, then switch to a <strong>generic</strong> plan if its estimated cost is not meaningfully worse, and the generic plan assumes an average value." },
              { t: "code", lang: "sql", code:
                "-- Postgres: see which plan a prepared statement is using\n" +
                "PREPARE q(text) AS SELECT * FROM orders WHERE tenant_id = $1;\n" +
                "EXPLAIN EXECUTE q('tiny-tenant');      -- after 5 runs, may show $1 instead of the value\n\n" +
                "-- Per session or per role: always plan for the actual value\n" +
                "SET plan_cache_mode = force_custom_plan;   -- Postgres 12+\n\n" +
                "-- SQL Server equivalents: OPTION (RECOMPILE) on the statement,\n" +
                "-- OPTIMIZE FOR (@p UNKNOWN), or force a known-good plan from Query Store." },
              { t: "compare",
                bad: { title: "Always reuse one plan", items: ["Zero planning cost per execution", "One plan for every parameter value", "Catastrophic for skewed keys such as big tenants"] },
                good: { title: "Plan per value (custom / recompile)", items: ["Each execution gets a plan for its own selectivity", "Planning cost on every call: fine for reports, costly for hot OLTP", "Oracle's adaptive cursor sharing keeps several plans per statement as a middle ground"] } },
              { t: "h", text: "Nested loop explosions, up close" },
              { t: "p", html: "The signature is an outer side estimated at a handful of rows that actually produces tens of thousands. Each extra outer row triggers another index descent plus a random heap fetch on the inner side: 50,000 loops × ~4 page touches is 200,000 mostly random reads where a hash join would have read both tables once. Errors compound through joins, so a 30× miss at the bottom of a five-join plan can become a nested loop chain that never finishes." },
              { t: "note", variant: "tip", html: "Engines increasingly hedge at runtime: SQL Server's adaptive joins pick hash or nested loop after seeing the real row count, Oracle has adaptive plans, and Spark's adaptive query execution re-plans between stages. Postgres does not re-plan mid-query, so getting estimates right matters more there; the <code class='tok'>pg_hint_plan</code> extension exists for the cases you cannot fix through statistics." },
              { t: "h", text: "Fix ladder" },
              { t: "table", headers: ["Tier", "Response to a regressed plan"], rows: [
                ["Naive", "<code class='tok'>SET enable_nestloop = off</code> globally, or pin a plan forever"],
                ["Solid", "Find the first misestimated node, refresh or extend statistics, rewrite unestimable predicates"],
                ["Standout", "Also prevents recurrence: ANALYZE in load jobs, extended stats for known correlated columns, plan-regression alerts from query statistics, scoped overrides (per role or statement) with a removal date"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"fast in dev, slow in prod\", \"fast for most customers, slow for one big one\", \"slow after the nightly load\", \"fast the first few times, then slow\", \"query never finishes since we added a join\"." },
              { t: "quiz", id: "qp-joins" },
              { t: "note", variant: "key", html: "<strong>Bad plans are usually good decisions on bad estimates.</strong> Find the first misestimated node, fix the statistics or the predicate, and treat cached plans as a bet that every parameter value looks alike." }
            ]
          }
        ]
      }
    ]
  };
})();
