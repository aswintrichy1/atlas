/* =====================================================================
   CASCADE · SQL & Query Engines track  (curriculum + quizzes + widgets)
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, svgEl = WK.svgEl, shell = WK.shell;

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

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Join visualizer */
  window.Widgets["de-sql-joins"] = function (mount) {
    shell(mount, "visualizer", "Join Visualizer",
      "Two tables, the same keys. Switch the join type and watch which unmatched rows survive (with NULLs).");
    var L = [{ id: 1, name: "Ava" }, { id: 2, name: "Bo" }, { id: 3, name: "Cy" }];
    var R = [{ id: 2, city: "NYC" }, { id: 3, city: "SF" }, { id: 4, city: "LA" }];
    var kind = "inner";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function result() {
      var out = [];
      var rById = {}; R.forEach(function (r) { rById[r.id] = r; });
      var lById = {}; L.forEach(function (l) { lById[l.id] = l; });
      if (kind === "inner" || kind === "left" || kind === "full") {
        L.forEach(function (l) { var r = rById[l.id]; if (r) out.push({ id: l.id, name: l.name, city: r.city }); else if (kind !== "inner") out.push({ id: l.id, name: l.name, city: null }); });
      }
      if (kind === "right" || kind === "full") {
        R.forEach(function (r) { if (!lById[r.id]) out.push({ id: r.id, name: null, city: r.city }); });
      }
      if (kind === "right") { // also matched rows
        R.forEach(function (r) { var l = lById[r.id]; if (l) out.unshift({ id: r.id, name: l.name, city: r.city }); });
        // de-dup matched already added? rebuild cleanly:
        out = [];
        R.forEach(function (r) { var l = lById[r.id]; out.push({ id: r.id, name: l ? l.name : null, city: r.city }); });
      }
      return out;
    }
    function grid(title, cols, rows, faintNull) {
      var w = h("div", { style: "margin:4px 0" });
      w.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.6rem;color:var(--text-faint);margin-bottom:4px" }, title));
      var b = h("div", { class: "grid-board", style: "grid-template-columns:repeat(" + cols.length + ",minmax(48px,1fr));gap:3px" });
      cols.forEach(function (c) { b.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:5px;font-family:var(--font-mono);font-size:.58rem;color:var(--text-dim)" }, c)); });
      rows.forEach(function (r) {
        r.forEach(function (v) {
          var isNull = v === null || v === undefined;
          b.appendChild(h("div", { class: "grid-cell" + (isNull ? "" : " dp-fill"), style: "width:auto;height:auto;padding:6px 4px;font-size:.68rem" + (isNull ? ";color:var(--text-faint)" : "") }, isNull ? "NULL" : String(v)));
        });
      });
      w.appendChild(b);
      return w;
    }
    function paint() {
      stage.innerHTML = "";
      var two = h("div", { style: "display:flex;gap:18px;flex-wrap:wrap" });
      two.appendChild(grid("L (users)", ["id", "name"], L.map(function (l) { return [l.id, l.name]; })));
      two.appendChild(grid("R (cities)", ["id", "city"], R.map(function (r) { return [r.id, r.city]; })));
      stage.appendChild(two);
      var res = result();
      stage.appendChild(grid(kind.toUpperCase() + " JOIN result", ["id", "name", "city"], res.map(function (r) { return [r.id, r.name, r.city]; })));
      readout.innerHTML = "";
      readout.appendChild(ro("join", kind.toUpperCase(), true));
      readout.appendChild(ro("result rows", String(res.length)));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "inner", label: "INNER" }, { v: "left", label: "LEFT" }, { v: "right", label: "RIGHT" }, { v: "full", label: "FULL" }], function () { return kind; }, function (v) { kind = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Window function lab */
  window.Widgets["de-sql-window"] = function (mount) {
    shell(mount, "lab", "Window Function Lab",
      "Window functions compute across a frame without collapsing rows. Toggle PARTITION BY and the function.");
    var data = [
      { dept: "A", name: "Ava", salary: 120 },
      { dept: "A", name: "Bo", salary: 100 },
      { dept: "B", name: "Cy", salary: 110 },
      { dept: "B", name: "Di", salary: 110 },
      { dept: "B", name: "Ed", salary: 90 }
    ];
    var fn = "row_number", part = true;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function compute() {
      var groups = {};
      data.forEach(function (r) { var k = part ? r.dept : "_"; (groups[k] = groups[k] || []).push(r); });
      var out = [];
      Object.keys(groups).forEach(function (k) {
        var g = groups[k].slice().sort(function (a, b) { return b.salary - a.salary; });
        var run = 0;
        g.forEach(function (r, i) {
          var val;
          if (fn === "row_number") val = i + 1;
          else if (fn === "rank") { val = 1; for (var j = 0; j < i; j++) if (g[j].salary > r.salary) val++; if (i > 0 && g[i - 1].salary === r.salary) val = out[out.length - 1].val; }
          else if (fn === "sum_run") { run += r.salary; val = run; }
          else val = i === 0 ? "NULL" : g[i - 1].salary; // lag
          out.push({ dept: r.dept, name: r.name, salary: r.salary, val: val });
        });
      });
      return out;
    }
    function overClause() {
      var p = part ? "PARTITION BY dept " : "";
      var f = { row_number: "ROW_NUMBER()", rank: "RANK()", sum_run: "SUM(salary)", lag: "LAG(salary)" }[fn];
      return f + " OVER (" + p + "ORDER BY salary DESC)";
    }
    function paint() {
      var rows = compute();
      stage.innerHTML = "";
      var b = h("div", { class: "grid-board", style: "grid-template-columns:repeat(4,minmax(56px,1fr));gap:3px" });
      ["dept", "name", "salary", "result"].forEach(function (c) { b.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:5px;font-family:var(--font-mono);font-size:.58rem;color:" + (c === "result" ? "var(--accent-ink)" : "var(--text-dim)") }, c)); });
      rows.forEach(function (r) {
        [r.dept, r.name, r.salary, r.val].forEach(function (v, ci) {
          b.appendChild(h("div", { class: "grid-cell" + (ci === 3 ? " dp-cur" : ""), style: "width:auto;height:auto;padding:6px 4px;font-size:.68rem" }, String(v)));
        });
      });
      stage.appendChild(b);
      readout.innerHTML = "";
      readout.appendChild(h("span", { class: "ro" }, h("b", { style: "color:var(--accent-ink);font-family:var(--font-mono)" }, overClause())));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "row_number", label: "ROW_NUMBER" }, { v: "rank", label: "RANK" }, { v: "sum_run", label: "running SUM" }, { v: "lag", label: "LAG" }], function () { return fn; }, function (v) { fn = v; paint(); }),
      seg([{ v: "on", label: "PARTITION BY dept" }, { v: "off", label: "no partition" }], function () { return part ? "on" : "off"; }, function (v) { part = v === "on"; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 3 — Query plan comparison */
  window.Widgets["de-sql-plan"] = function (mount) {
    shell(mount, "visualizer", "Query Plan Lab",
      "The same query, two plans. Pushdown and pruning cut the rows scanned by orders of magnitude.");
    var mode = "naive";
    var svg = svgEl("svg", { class: "tree-svg", viewBox: "0 0 360 260", role: "img" });
    var readout = h("div", { class: "w-readout" });
    function planNodes() {
      if (mode === "naive") {
        return [
          { y: 30, label: "Result", on: true },
          { y: 90, label: "HashJoin", on: true },
          { y: 150, label: "Filter country=EU", on: true },
          { y: 210, label: "Scan orders (10M rows)", on: true, big: true }
        ];
      }
      return [
        { y: 30, label: "Result", on: true },
        { y: 90, label: "HashJoin", on: true },
        { y: 150, label: "Scan orders", on: true },
        { y: 210, label: "partition prune + pushdown (50K)", on: true, small: true }
      ];
    }
    function paint() {
      svg.innerHTML = "";
      var ns = planNodes();
      for (var i = 0; i < ns.length - 1; i++) {
        svg.appendChild(svgEl("path", { class: "tr-edge on", d: "M180 " + (ns[i].y + 14) + " L180 " + (ns[i + 1].y - 14) }));
      }
      ns.forEach(function (n) {
        var g = svgEl("g", { class: "tr-node" + (n.big ? " cmp" : " on") });
        var rectColor = n.big ? "var(--rose)" : (n.small ? "var(--accent)" : "var(--accent)");
        g.appendChild(svgEl("rect", { x: 60, y: n.y - 14, width: 240, height: 28, rx: 8, fill: "var(--surface-solid)", stroke: rectColor, "stroke-width": n.big || n.small ? 2.5 : 1.6 }));
        var t = svgEl("text", { x: 180, y: n.y, fill: "var(--text)", "font-family": "var(--font-mono)", "font-size": "10", "text-anchor": "middle", "dominant-baseline": "central" });
        t.textContent = n.label; g.appendChild(t);
        svg.appendChild(g);
      });
      readout.innerHTML = "";
      readout.appendChild(ro("plan", mode, true));
      readout.appendChild(ro("rows scanned", mode === "naive" ? "10,000,000" : "50,000"));
      readout.appendChild(ro("speedup", mode === "naive" ? "1\u00d7 (baseline)" : "~200\u00d7"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "naive", label: "Naive plan" }, { v: "optimized", label: "Optimized plan" }], function () { return mode; }, function (v) { mode = v; paint(); })));
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-sql-core": {
      title: "SQL mastery checkpoint",
      sub: "Joins, aggregation, CTEs and set operations.",
      questions: [
        {
          q: "A LEFT JOIN keeps\u2026",
          options: ["Only matching rows", "All rows from the left table, NULL-filling the right where there\u2019s no match", "All rows from the right table", "No rows"],
          answer: 1,
          explain: "LEFT JOIN returns every left-table row; when the right side has no match, its columns come back NULL. INNER drops unmatched rows on both sides."
        },
        {
          q: "The difference between WHERE and HAVING is that HAVING\u2026",
          options: ["Runs before grouping", "Is faster", "Filters after aggregation (on grouped results)", "Only works on text"],
          answer: 2,
          explain: "WHERE filters rows before grouping; HAVING filters the grouped/aggregated results (e.g. HAVING SUM(amount) > 1000)."
        },
        {
          q: "UNION (without ALL) differs from UNION ALL by\u2026",
          options: ["Being slower for no reason", "Sorting the output", "Keeping only the first table", "Removing duplicate rows"],
          answer: 3,
          explain: "UNION de-duplicates the combined result (an extra sort/hash step); UNION ALL concatenates without dedup and is cheaper when you know there are no duplicates."
        },
        {
          q: "Which query returns customers who have never placed an order?",
          options: ["SELECT c.* FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)", "SELECT c.* FROM customers c JOIN orders o ON o.customer_id = c.id", "SELECT DISTINCT customer_id FROM orders", "SELECT c.* FROM customers c CROSS JOIN orders o"],
          answer: 0,
          explain: "NOT EXISTS is an anti-join: it keeps rows with no match. It is also NULL-safe, unlike NOT IN over a subquery that may return a NULL customer_id."
        },
        {
          q: "A recursive CTE is the natural tool for\u2026",
          options: ["Pivoting months into columns", "Deduplicating rows", "Walking a hierarchy such as an org chart, level by level, until no new rows appear", "Computing a running total"],
          answer: 2,
          explain: "A recursive CTE has an anchor member and a recursive member that joins back to the CTE; it repeats until an iteration adds no rows \u2014 ideal for trees and graphs of unknown depth."
        }
      ]
    },
    "de-sql-analytics": {
      title: "Analytical SQL checkpoint",
      sub: "Window functions and ranking.",
      questions: [
        {
          q: "Unlike GROUP BY, a window function\u2026",
          options: ["Computes across a set of rows but returns a value per row", "Collapses rows into one per group", "Can\u2019t use ORDER BY", "Only works on numbers"],
          answer: 0,
          explain: "Window functions compute over a frame (PARTITION/ORDER) while keeping every input row \u2014 so you can show each employee\u2019s salary AND their rank in one result set."
        },
        {
          q: "To number rows 1,2,3 within each department ordered by salary, you\u2019d use\u2026",
          options: ["COUNT(*)", "ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary)", "GROUP BY dept", "DISTINCT"],
          answer: 1,
          explain: "ROW_NUMBER() with PARTITION BY dept restarts the numbering per department, and ORDER BY salary sets the sequence \u2014 the canonical 'top-N per group' building block."
        },
        {
          q: "RANK() differs from DENSE_RANK() in that RANK()\u2026",
          options: ["Never ties", "Is the same as ROW_NUMBER", "Leaves gaps after ties (1,1,3)", "Ignores ORDER BY"],
          answer: 2,
          explain: "On a tie, RANK() assigns the same rank then skips (1,1,3), while DENSE_RANK() doesn\u2019t skip (1,1,2). ROW_NUMBER() always gives distinct numbers."
        },
        {
          q: "To compare each month\u2019s revenue with the previous month, use\u2026",
          options: ["RANK()", "NTILE(12)", "SUM() with GROUP BY month", "LAG(revenue) OVER (ORDER BY month)"],
          answer: 3,
          explain: "LAG reads a value from an earlier row in the window order without a self-join, so month-over-month change is revenue - LAG(revenue)."
        },
        {
          q: "In the gaps-and-islands technique, what do you subtract to group consecutive days into streaks?",
          options: ["The previous row\u2019s value from LAG", "ROW_NUMBER() ordered by date, from the date itself", "The partition count", "The total row count"],
          answer: 1,
          explain: "For consecutive dates, date minus ROW_NUMBER() is constant; it changes whenever a gap appears. Grouping by that difference yields one group per streak."
        }
      ]
    },
    "de-sql-engines": {
      title: "Query engines checkpoint",
      sub: "Planning, optimization and MPP.",
      questions: [
        {
          q: "A cost-based optimizer chooses a plan using\u2026",
          options: ["The order you wrote the joins", "Random selection", "The alphabetical order of tables", "Table/column statistics to estimate cardinalities and costs"],
          answer: 3,
          explain: "The CBO uses statistics (row counts, distinct values, histograms) to estimate how many rows each operator produces and picks the cheapest join order and algorithm \u2014 stale stats lead to bad plans."
        },
        {
          q: "In an MPP engine, a broadcast join is preferred when\u2026",
          options: ["One table is small enough to copy to every worker, avoiding a big shuffle", "Both tables are huge", "There is no join key", "The data is sorted"],
          answer: 0,
          explain: "Broadcasting a small table to all workers lets each join its local partition of the big table without shuffling the big one \u2014 the same idea as Spark\u2019s broadcast join."
        },
        {
          q: "Partition pruning speeds a query by\u2026",
          options: ["Adding indexes", "Skipping partitions whose values can\u2019t satisfy the WHERE clause", "Caching results", "Sorting output"],
          answer: 1,
          explain: "If a query filters dt = '2024-01-02', the engine reads only that partition and skips the rest \u2014 the single biggest scan-reduction lever in analytical engines."
        },
        {
          q: "In an MPP engine, which plan step is usually the most expensive for a big\u2013big join?",
          options: ["Parsing the SQL", "Returning the final rows to the client", "Redistributing rows across workers so matching keys meet on the same node", "Looking the table up in the catalog"],
          answer: 2,
          explain: "Hash-redistributing both sides moves data between every pair of workers. Broadcast or co-located partitioning avoids it, which is why exchanges are the thing to minimize."
        },
        {
          q: "Clustering (sorting) data on a frequently filtered column helps because\u2026",
          options: ["It enables primary keys", "It makes every column smaller", "It removes the need for statistics", "Each file or block covers a narrow value range, so min/max metadata lets the engine skip most of them"],
          answer: 3,
          explain: "Zone maps only prune when values are clustered. Sorted data gives each block a tight min/max range, so a selective predicate excludes most blocks without reading them."
        }
      ]
    },
    "de-sql-performance": {
      title: "Query performance checkpoint",
      sub: "Indexes, EXPLAIN and anti-patterns.",
      questions: [
        {
          q: "Wrapping an indexed column in a function, e.g. WHERE DATE(created_at) = '2024-01-01', usually\u2026",
          options: ["Speeds it up", "Has no effect", "Prevents the index from being used (a full scan)", "Creates an index"],
          answer: 2,
          explain: "A function on the column makes it non-sargable, so the engine can\u2019t use the index and scans the table. Rewrite as a range: created_at >= '2024-01-01' AND created_at < '2024-01-02'."
        },
        {
          q: "In an EXPLAIN plan, a large gap between estimated and actual rows signals\u2026",
          options: ["A perfect plan", "The query is cached", "An index is present", "Stale or missing statistics misleading the optimizer"],
          answer: 3,
          explain: "When estimates are far off actuals, the optimizer is working from bad stats and likely chose a poor join order/algorithm \u2014 refreshing statistics often fixes the plan."
        },
        {
          q: "Why do analytical (columnar) engines rarely rely on B-tree indexes?",
          options: ["They scan large ranges and use column pruning, min/max stats and partitioning instead", "Indexes are illegal there", "They never filter", "Indexes don\u2019t exist"],
          answer: 0,
          explain: "OLAP queries touch large fractions of data; columnar projection, zone maps (min/max) and partition pruning serve them better than per-row B-trees, which shine for OLTP point lookups."
        },
        {
          q: "SELECT * on a wide columnar table mainly hurts because\u2026",
          options: ["It locks the table", "It reads every column\u2019s data even though the query needs only a few", "It sorts the output", "It disables partition pruning"],
          answer: 1,
          explain: "Columnar engines read only the columns referenced. SELECT * forces every column chunk to be read and decompressed, multiplying I/O on wide tables."
        },
        {
          q: "In an EXPLAIN plan, a nested-loop join between two large tables usually indicates\u2026",
          options: ["The ideal plan", "Cached results", "A missing or non-equi join condition, or bad estimates, forcing row-by-row comparison", "A broadcast join"],
          answer: 2,
          explain: "Hash and merge joins need an equality condition. Without one (or with badly underestimated inputs) the engine falls back to comparing every pair of rows, which explodes on large inputs."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sql = {
    id: "sql", name: "SQL & Query Engines", short: "SQL",
    tagline: "The language under every pipeline", color: "#bef264",
    blurb: "SQL from joins to query engines: aggregation, subqueries and CTEs, set operations, window functions and analytics, how a query is planned and optimized, MPP and distributed engines, partition pruning and clustering, indexes, EXPLAIN plans, and the anti-patterns that wreck performance.",
    modules: [
      {
        id: "sql-core", name: "SQL Mastery", icon: "blocks",
        lessons: [
          {
            id: "joins-sql", title: "Joins deep dive",
            summary: "Inner, outer, semi and anti joins \u2014 and the fan-out that silently inflates totals.",
            minutes: 8, tags: ["joins"],
            blocks: [
              { t: "p", html: "Joins combine rows from two tables on a condition. The <strong>type</strong> decides what happens to <em>unmatched</em> rows: <strong>INNER</strong> drops them, <strong>LEFT/RIGHT</strong> keep one side (NULL-filling the other), <strong>FULL</strong> keeps both." },
              { t: "widget", id: "de-sql-joins" },
              { t: "p", html: "Two more you should know by name: a <strong>semi join</strong> (" + tok("WHERE EXISTS") + ") keeps left rows that <em>have</em> a match without duplicating them; an <strong>anti join</strong> (" + tok("WHERE NOT EXISTS") + ") keeps left rows with <em>no</em> match." },
              { t: "note", variant: "trap", html: "Beware <strong>fan-out</strong>: joining to a table with multiple matches per key multiplies rows, so a later " + tok("SUM(amount)") + " double-counts. If a join changes your row count unexpectedly, the grain broke \u2014 aggregate the child first or use a semi join." },
              { t: "note", variant: "key", html: "Pick the join type from what you want to happen to non-matches. Most 'wrong totals' bugs are really the wrong join type or an unintended fan-out." }
            ]
          },
          {
            id: "aggregation", title: "GROUP BY, HAVING & filtering",
            summary: "Collapse rows into groups, filter before and after, and roll up subtotals.",
            minutes: 6, tags: ["group-by", "having"],
            blocks: [
              { t: "p", html: "<strong>GROUP BY</strong> collapses rows into one per group and lets you apply aggregates (" + tok("SUM") + ", " + tok("COUNT") + ", " + tok("AVG") + "). <strong>WHERE</strong> filters rows <em>before</em> grouping; <strong>HAVING</strong> filters the <em>groups</em> after aggregation." },
              { t: "code", lang: "sql", code:
                "SELECT product, SUM(amount) AS revenue\n" +
                "FROM sales\n" +
                "WHERE order_date >= '2024-01-01'   -- filter rows first\n" +
                "GROUP BY product\n" +
                "HAVING SUM(amount) > 10000;        -- then filter groups" },
              { t: "note", variant: "tip", html: "Order of operations: WHERE \u2192 GROUP BY \u2192 HAVING \u2192 SELECT \u2192 ORDER BY. Filtering rows in WHERE (not HAVING) is both correct and faster \u2014 you aggregate less." },
              { t: "note", variant: "tip", html: "<strong>GROUPING SETS</strong>, <strong>ROLLUP</strong> and <strong>CUBE</strong> compute multiple aggregation levels (subtotals, grand totals) in one pass \u2014 handy for reporting cubes." },
              { t: "note", variant: "key", html: "<strong>The GROUP BY list <em>is</em> the grain of the result.</strong> Every number you emit is only true at that level, so a measure that looks safe to re-sum one grain up \u2014 an average, a rate, a distinct count \u2014 usually is not. Decide what one output row means before you decide what to aggregate." }
            ]
          },
          {
            id: "subqueries-ctes", title: "Subqueries & CTEs",
            summary: "Compose queries readably with CTEs, and know when a correlated subquery costs you.",
            minutes: 6, tags: ["cte", "subquery"],
            blocks: [
              { t: "p", html: "A <strong>CTE</strong> (" + tok("WITH") + ") names a subquery so you can build a pipeline of readable steps. A <strong>correlated subquery</strong> references the outer row and runs per row \u2014 powerful, but a performance trap on big tables." },
              { t: "code", lang: "sql", code:
                "WITH ranked AS (\n" +
                "  SELECT *, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn\n" +
                "  FROM employees\n" +
                ")\n" +
                "SELECT * FROM ranked WHERE rn <= 3;   -- top 3 per dept" },
              { t: "p", html: "<strong>Recursive CTEs</strong> traverse hierarchies (org charts, graph paths) by referencing themselves until a base case is reached." },
              { t: "note", variant: "key", html: "Prefer CTEs + window functions over deeply nested or correlated subqueries: they\u2019re clearer and usually let the optimizer do better. Readability is a performance feature when humans maintain the SQL." }
            ]
          },
          {
            id: "set-ops", title: "Set operations",
            summary: "Combine result sets with UNION, INTERSECT and EXCEPT \u2014 mind the dedup.",
            minutes: 5, tags: ["union", "set-ops"],
            blocks: [
              { t: "table", headers: ["Operator", "Returns"], rows: [
                ["UNION", "Rows in either set, duplicates removed"],
                ["UNION ALL", "Rows in either set, duplicates kept"],
                ["INTERSECT", "Rows in both sets"],
                ["EXCEPT / MINUS", "Rows in the first but not the second"]
              ] },
              { t: "p", html: "All set operations require the inputs to have the same number of columns with compatible types, matched by position (not name)." },
              { t: "note", variant: "tip", html: "Use <strong>UNION ALL</strong> unless you actually need dedup \u2014 plain UNION adds a sort/hash to remove duplicates, which is wasted work when you know there are none (e.g. unioning disjoint partitions)." },
              { t: "note", variant: "key", html: "EXCEPT and INTERSECT are a tidy way to diff two datasets \u2014 great for reconciliation tests ('rows in source but not target')." },
              { t: "quiz", id: "de-sql-core" }
            ]
          }
        ]
      },
      {
        id: "analytics", name: "Analytical SQL", icon: "trend",
        lessons: [
          {
            id: "window-functions", title: "Window functions",
            summary: "Compute across related rows without collapsing them \u2014 the analyst\u2019s superpower.",
            minutes: 8, tags: ["window-functions"],
            blocks: [
              { t: "p", html: "A <strong>window function</strong> computes over a set of rows (the <em>window</em>) defined by " + tok("OVER (PARTITION BY \u2026 ORDER BY \u2026)") + " \u2014 but unlike " + tok("GROUP BY") + ", it returns a value for <em>every</em> row. That\u2019s how you show a value <em>and</em> its rank, running total, or the previous row\u2019s value side by side." },
              { t: "widget", id: "de-sql-window" },
              { t: "p", html: "Three families: <strong>ranking</strong> (" + tok("ROW_NUMBER") + ", " + tok("RANK") + ", " + tok("DENSE_RANK") + "), <strong>aggregate</strong> windows (" + tok("SUM") + "/" + tok("AVG") + " " + tok("OVER") + " for running totals), and <strong>offset</strong> (" + tok("LAG") + ", " + tok("LEAD") + " for previous/next)." },
              { t: "p", html: "The <strong>frame</strong> (" + tok("ROWS BETWEEN \u2026") + ") controls which rows the function sees \u2014 e.g. a moving average over the last 7 rows. PARTITION resets the window per group; ORDER defines the sequence." },
              { t: "note", variant: "trap", html: "A window with " + tok("ORDER BY") + " but no explicit frame defaults to a <em>running</em> frame (" + tok("RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW") + "), and RANGE treats ties as peers \u2014 so " + tok("SUM() OVER (ORDER BY day)") + " gives tied days the same running total. For a whole-partition aggregate, omit ORDER BY or say " + tok("ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING") + "." },
              { t: "h", text: "The same thing in Spark" },
              { t: "code", lang: "python", code:
                "from pyspark.sql.window import Window\n" +
                "from pyspark.sql.functions import rank, sum as _sum, lag, col\n\n" +
                "w = Window.partitionBy(\"dept\").orderBy(col(\"salary\").desc())\n" +
                "df.withColumn(\"rk\", rank().over(w)) \\\n" +
                "  .withColumn(\"run_total\", _sum(\"salary\").over(w)) \\\n" +
                "  .withColumn(\"prev\", lag(\"salary\").over(w))" },
              { t: "note", variant: "key", html: "<strong>On a distributed engine a window shuffles on PARTITION BY and sorts inside it \u2014 a group-by\u2019s cost profile without the group-by\u2019s reduction.</strong> Every input row survives, so a partition key with few distinct values concentrates the sort into a few tasks. Give it a key with real cardinality, and never omit PARTITION BY on a large table: the whole dataset becomes one partition sorted on one worker." }
            ]
          },
          {
            id: "ranking", title: "Ranking, running totals & gaps-and-islands",
            summary: "The patterns window functions unlock \u2014 top-N, cumulative sums, and grouping streaks.",
            minutes: 6, tags: ["ranking", "patterns"],
            blocks: [
              { t: "ul", items: [
                "<strong>Top-N per group</strong> \u2014 " + tok("ROW_NUMBER() OVER (PARTITION BY \u2026 ORDER BY \u2026)") + " then filter " + tok("rn <= N") + ".",
                "<strong>Running total</strong> \u2014 " + tok("SUM(x) OVER (ORDER BY t)") + " for cumulative sums.",
                "<strong>Period-over-period</strong> \u2014 " + tok("LAG(x) OVER (ORDER BY month)") + " to compare to last month."
              ] },
              { t: "p", html: "<strong>Gaps-and-islands</strong> is the classic trick: to collapse consecutive runs (streaks of active days, contiguous ID ranges), subtract a " + tok("ROW_NUMBER()") + " from the value \u2014 rows in the same run share a constant, which you then group on." },
              { t: "note", variant: "tip", html: "ROW_NUMBER vs RANK vs DENSE_RANK differ only on ties: distinct numbering, gapped (1,1,3), and gapless (1,1,2). Pick by whether ties should share a position and whether gaps matter." },
              { t: "note", variant: "tip", html: "Most 'I need a loop' SQL problems are really a window function. Reach for " + tok("OVER") + " before writing a self-join or a procedural cursor." },
              { t: "note", variant: "key", html: "<strong>Every window function is a sort you are paying for, and " + tok("PARTITION BY") + " is what keeps that sort parallel.</strong> Partitioned windows split across workers; an " + tok("OVER") + " clause with no partition funnels the whole table through a single ordered stream, which is the first thing to stop scaling as volume grows. Partition on the coarsest column that still gives the right answer." }
            ]
          },
          {
            id: "pivoting", title: "Pivoting & conditional aggregation",
            summary: "Reshape long data to wide (and back) with CASE or PIVOT.",
            minutes: 5, tags: ["pivot"],
            blocks: [
              { t: "p", html: "<strong>Pivoting</strong> turns rows into columns \u2014 e.g. one row per customer with a column per month. The portable way is <strong>conditional aggregation</strong>: " + tok("SUM(CASE WHEN month='Jan' THEN amount END)") + ". Some engines also offer a " + tok("PIVOT") + " operator." },
              { t: "code", lang: "sql", code:
                "SELECT customer,\n" +
                "  SUM(CASE WHEN month = 'Jan' THEN amount END) AS jan,\n" +
                "  SUM(CASE WHEN month = 'Feb' THEN amount END) AS feb\n" +
                "FROM sales\n" +
                "GROUP BY customer;" },
              { t: "note", variant: "key", html: "Conditional aggregation is the universal pivot \u2014 it works everywhere and reads clearly. Reserve " + tok("UNPIVOT") + " (wide\u2192long) for normalizing spreadsheet-shaped inputs back into tidy rows." },
              { t: "quiz", id: "de-sql-analytics" }
            ]
          }
        ]
      },
      {
        id: "engines", name: "Query Engines", icon: "cube",
        lessons: [
          {
            id: "execution", title: "How a query runs",
            summary: "From SQL text to a physical plan: parse, bind, optimize, execute.",
            minutes: 7, tags: ["execution", "plan"],
            blocks: [
              { t: "p", html: "SQL is declarative \u2014 you say <em>what</em>, the engine decides <em>how</em>. It <strong>parses</strong> the text, <strong>binds</strong> names to tables/columns, builds a <strong>logical plan</strong>, <strong>optimizes</strong> it into a <strong>physical plan</strong> (choosing scan types, join algorithms, order), and <strong>executes</strong> it." },
              { t: "widget", id: "de-sql-plan" },
              { t: "p", html: "Optimization is where the magic is: <strong>predicate pushdown</strong> (filter as early/low as possible), <strong>projection pushdown</strong> (read only needed columns), <strong>partition pruning</strong>, and <strong>join reordering</strong>." },
              { t: "note", variant: "key", html: "Two plans for the same query can differ by orders of magnitude. The optimizer\u2019s job is to find the cheap one \u2014 and your job is to give it the stats, partitioning and predicates that make the cheap plan possible." }
            ]
          },
          {
            id: "optimizer", title: "The cost-based optimizer",
            summary: "Statistics drive cardinality estimates, which drive join order and algorithm choice.",
            minutes: 6, tags: ["optimizer", "stats"],
            blocks: [
              { t: "p", html: "A <strong>cost-based optimizer</strong> (CBO) uses <strong>statistics</strong> \u2014 row counts, distinct values, histograms \u2014 to estimate how many rows each operator emits (its <strong>cardinality</strong>), then picks the join order and algorithm with the lowest estimated cost." },
              { t: "note", variant: "trap", html: "Garbage in, garbage out: <strong>stale statistics</strong> are the #1 cause of bad plans. If the CBO thinks a table has 1,000 rows but it has 1 billion, it may pick a disastrous join. Keep stats fresh (" + tok("ANALYZE") + ")." },
              { t: "note", variant: "tip", html: "You can\u2019t usually pick the plan, but you can feed the optimizer better inputs: fresh stats, selective predicates it can push down, and partitioning/clustering it can prune on." },
              { t: "note", variant: "tip", html: "When a plan is wrong, check the estimated-vs-actual row counts in " + tok("EXPLAIN ANALYZE") + " first \u2014 a big mismatch points straight at the bad estimate to fix." },
              { t: "note", variant: "key", html: "<strong>A bad plan is almost always a bad estimate, and estimates compound upward.</strong> Whatever the optimizer gets wrong about the first join is carried into every operator above it, so the plan degrades faster than the data grows \u2014 which is why a query that was fine last quarter can fall off a cliff without anyone changing it. You do not choose the plan; you choose how honest its inputs are." }
            ]
          },
          {
            id: "mpp", title: "MPP & distributed query engines",
            summary: "How Trino, BigQuery and Snowflake split a query across many workers.",
            minutes: 7, tags: ["mpp", "trino"],
            blocks: [
              { t: "p", html: "<strong>MPP</strong> (massively parallel processing) engines \u2014 <strong>Trino</strong>, <strong>BigQuery</strong>, <strong>Snowflake</strong>, <strong>Redshift</strong> \u2014 split a query across many <strong>workers</strong>, each handling a slice of data, coordinated by a leader. The cost center is the <strong>exchange</strong>: moving data between workers (just like Spark\u2019s shuffle)." },
              { t: "p", html: "Join distribution mirrors the batch track: <strong>broadcast</strong> a small table to every worker, or <strong>partition</strong> (hash-distribute) both sides of a big\u2013big join on the key so matching rows meet on the same worker." },
              { t: "note", variant: "tip", html: "Same physics as Spark: parallel scans are cheap, cross-worker data movement is expensive. Fewer/smaller exchanges \u2014 via broadcast, co-located partitioning, and pruning \u2014 mean faster distributed queries." },
              { t: "note", variant: "tip", html: "Snowflake/BigQuery separate storage from compute, so you scale workers up for a heavy query and down after \u2014 the warehouse idea from the storage track, applied per-query." },
              { t: "note", variant: "tip", html: "<strong>Snowflake specifics.</strong> The Glacier atlas (Snowflake) in this collection covers how a virtual warehouse executes a query in <em>Architecture &amp; Storage \u203a Three-Layer Architecture</em>, and sizing, multi-cluster scaling and workload isolation in <em>Warehouses &amp; Query Performance \u203a Virtual Warehouses</em>." },
              { t: "note", variant: "key", html: "<strong>Adding workers buys scan speed; it never buys exchange speed.</strong> A scan divides cleanly, but an exchange has every worker talking to every other one, so the expensive half of the query does not shrink when the cluster grows. When a bigger warehouse stops helping, stop resizing and start removing exchanges." }
            ]
          },
          {
            id: "pruning-clustering", title: "Partitioning, clustering & pruning",
            summary: "Physical layout that lets the engine skip data it doesn\u2019t need.",
            minutes: 6, tags: ["pruning", "clustering"],
            blocks: [
              { t: "p", html: "The fastest scan is the one you don\u2019t do. <strong>Partition pruning</strong> skips partitions a " + tok("WHERE") + " can\u2019t match; <strong>clustering / Z-ordering</strong> sorts data so <strong>min/max zone maps</strong> let the engine skip blocks even <em>within</em> a partition." },
              { t: "note", variant: "tip", html: "Partitioning prunes at the folder level; clustering + zone maps prune at the file/block level. Together they turn a table scan into a few targeted reads \u2014 the storage track\u2019s layout lessons paying off at query time." },
              { t: "note", variant: "tip", html: "Cluster on the columns you filter and join on most. A well-clustered table can answer a selective query by reading a fraction of one partition." },
              { t: "note", variant: "tip", html: "<strong>Engine specifics.</strong> Snowflake has no user-defined partitions \u2014 it prunes automatically on micro-partition metadata, and clustering keys improve it; the Glacier atlas (Snowflake) in this collection covers this in <em>Architecture &amp; Storage \u203a Micro-partitions &amp; Pruning</em>. Delta Lake\u2019s data skipping, Z-ordering and liquid clustering are in the <a class='inline' href='#/databricks/delta/maintenance'>Delta maintenance lesson</a>." },
              { t: "note", variant: "key", html: "<strong>Pruning is a contract between the layout and the predicate, and it breaks silently.</strong> Cast the partition column, wrap it in a function, or filter on something you never clustered by, and the engine quietly reads the whole table \u2014 identical answer, whole-table bill, no error anywhere. Layout only pays off for the filters people actually write, so choose it from the queries you see, not the ones you imagine." },
              { t: "quiz", id: "de-sql-engines" }
            ]
          }
        ]
      },
      {
        id: "performance", name: "Query Performance", icon: "wrench",
        lessons: [
          {
            id: "indexes", title: "Indexes & when they help",
            summary: "B-trees make point lookups fast in OLTP \u2014 and matter far less in columnar OLAP.",
            minutes: 6, tags: ["indexes"],
            blocks: [
              { t: "p", html: "An <strong>index</strong> (usually a <strong>B-tree</strong>) is a sorted side structure that turns a full scan into a quick lookup. It shines when a query is <strong>selective</strong> (returns few rows); a <strong>covering index</strong> includes all needed columns so the engine never touches the table." },
              { t: "note", variant: "trap", html: "Indexes aren\u2019t free: every write must maintain them, and a non-selective query (returning most rows) is faster with a scan than an index. Index the columns you filter/join on selectively \u2014 not every column." },
              { t: "note", variant: "key", html: "Why columnar OLAP engines barely use B-trees: analytical queries scan large ranges, where column pruning, zone maps and partitioning beat per-row indexes. Indexes are an OLTP tool; pruning is the OLAP equivalent." }
            ]
          },
          {
            id: "explain", title: "Reading EXPLAIN plans",
            summary: "Decode the plan to find the operator that\u2019s actually costing you.",
            minutes: 6, tags: ["explain"],
            blocks: [
              { t: "p", html: "" + tok("EXPLAIN") + " shows the plan; " + tok("EXPLAIN ANALYZE") + " runs it and shows <em>actual</em> rows and time per operator. Read it bottom-up: scans at the leaves, joins/aggregates above, the result at the root." },
              { t: "ul", items: [
                "<strong>Scan type</strong> \u2014 full scan vs index/partition pruning.",
                "<strong>Join node</strong> \u2014 broadcast vs hash vs sort-merge.",
                "<strong>Estimated vs actual rows</strong> \u2014 a big gap means stale stats.",
                "<strong>The widest/slowest operator</strong> \u2014 that\u2019s your bottleneck."
              ] },
              { t: "note", variant: "key", html: "Don\u2019t guess at performance \u2014 read the plan. The operator processing the most rows (or spilling) is where to spend effort; everything else is noise." }
            ]
          },
          {
            id: "anti-patterns", title: "SQL anti-patterns & tuning",
            summary: "The recurring mistakes that turn fast queries slow.",
            minutes: 6, tags: ["anti-patterns", "tuning"],
            blocks: [
              { t: "compare",
                bad: { title: "Anti-patterns", items: ["SELECT * (reads every column)", "Function on a filtered/indexed column (non-sargable)", "Implicit type casts blocking pruning", "N+1 queries in a loop", "Unintended fan-out joins", "OFFSET pagination on deep pages"] },
                good: { title: "Better", items: ["Select only needed columns", "Filter on raw columns (sargable ranges)", "Match types explicitly", "One set-based query", "Aggregate child rows first", "Keyset (seek) pagination"] }
              },
              { t: "p", html: "The two highest-impact habits map straight to the rest of this atlas: <strong>scan less</strong> (project columns, push down predicates, prune partitions) and <strong>move less</strong> (avoid needless shuffles/exchanges and fan-out)." },
              { t: "note", variant: "key", html: "Performance is mostly about <em>data volume</em>, not clever syntax. Read less and move less, and the query gets fast \u2014 the same principle from storage scans to Spark shuffles to MPP exchanges." },
              { t: "quiz", id: "de-sql-performance" }
            ]
          }
        ]
      }
    ]
  };
})();
