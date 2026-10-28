/* =====================================================================
   LEDGER · SQL Mastery for Interviews
   window.TRACKS.sql — modules: windows / ctes / perf

   Self-contained: this file registers its own widgets (sqlWindow,
   sqlSargable), its own quizzes (sql-windows, sql-ctes, sql-perf) and
   its own track data.
   ===================================================================== */
(function () {
  "use strict";

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
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  var PRE_STYLE = "margin:0 0 10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;" +
    "background:var(--surface-solid);color:var(--text);font-family:ui-monospace,Menlo,Consolas,monospace;" +
    "font-size:0.82rem;line-height:1.5;white-space:pre-wrap;overflow-x:auto";
  var TH_STYLE = "text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);color:var(--text-dim);font-weight:600";
  var TD_STYLE = "padding:5px 8px;border-bottom:1px solid var(--line);color:var(--text)";

  var Widgets = {};

  /* ---------- sqlWindow: live window-function evaluator ---------- */
  Widgets.sqlWindow = function (mount) {
    shell(mount, "live SQL", "Window function lab",
      "Eight sales rows with deliberate ties. Pick a function, toggle PARTITION BY, change the ORDER BY key and the frame. The result column is computed live with standard SQL semantics.");

    var DATA = [
      { id: 1, region: "East", day: 1, amount: 100 },
      { id: 2, region: "East", day: 2, amount: 80 },
      { id: 3, region: "East", day: 2, amount: 120 },
      { id: 4, region: "East", day: 3, amount: 80 },
      { id: 5, region: "West", day: 1, amount: 90 },
      { id: 6, region: "West", day: 1, amount: 60 },
      { id: 7, region: "West", day: 2, amount: 150 },
      { id: 8, region: "West", day: 3, amount: 60 }
    ];
    var fn = "rank", part = true, order = "day", frame = "rows";

    function cmp(a, b) {
      if (order === "day") return a.day - b.day;
      return b.amount - a.amount;
    }

    function compute() {
      var rows = DATA.slice();
      rows.sort(function (a, b) {
        if (part && a.region !== b.region) return a.region < b.region ? -1 : 1;
        var c = cmp(a, b);
        if (c !== 0) return c;
        return a.id - b.id;
      });
      var parts = [], cur = null;
      for (var i = 0; i < rows.length; i++) {
        var key = part ? rows[i].region : "all";
        if (!cur || cur.key !== key) { cur = { key: key, rows: [] }; parts.push(cur); }
        cur.rows.push(rows[i]);
      }
      var out = [], tiedGroups = 0;
      for (var p = 0; p < parts.length; p++) {
        var rs = parts[p].rows, cum = 0, dense = 0;
        for (var r = 0; r < rs.length; r++) {
          var row = rs[r], rank = 1, rangeSum = 0, peers = 0;
          cum += row.amount;
          for (var j = 0; j < rs.length; j++) {
            var c2 = cmp(rs[j], row);
            if (c2 < 0) { rank++; rangeSum += rs[j].amount; }
            else if (c2 === 0) { peers++; rangeSum += rs[j].amount; }
          }
          var firstOfPeers = r === 0 || cmp(rs[r - 1], row) !== 0;
          if (firstOfPeers) { dense++; if (peers > 1) tiedGroups++; }
          out.push({
            row: row, part: parts[p].key, rn: r + 1, rank: rank, dense: dense,
            rowsSum: cum, rangeSum: rangeSum, lag: r > 0 ? rs[r - 1].amount : null, peers: peers
          });
        }
      }
      return { out: out, partitions: parts.length, tiedGroups: tiedGroups };
    }

    function exprText() {
      var over = [];
      if (part) over.push("PARTITION BY region");
      over.push(order === "day" ? "ORDER BY day" : "ORDER BY amount DESC");
      var f;
      if (fn === "rn") f = "ROW_NUMBER()";
      else if (fn === "rank") f = "RANK()";
      else if (fn === "dense") f = "DENSE_RANK()";
      else if (fn === "lag") f = "LAG(amount)";
      else {
        f = "SUM(amount)";
        over.push(frame === "rows" ? "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW" : "RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW");
      }
      return "SELECT region, day, amount,\n       " + f + " OVER (" + over.join(" ") + ") AS result\nFROM sales;";
    }

    function value(o) {
      if (fn === "rn") return o.rn;
      if (fn === "rank") return o.rank;
      if (fn === "dense") return o.dense;
      if (fn === "lag") return o.lag === null ? "NULL" : o.lag;
      return frame === "rows" ? o.rowsSum : o.rangeSum;
    }

    var sqlBox = h("pre", { style: PRE_STYLE });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var res = compute();
      sqlBox.textContent = exprText();
      clear(stage);
      var isSum = fn === "sum";
      var head = h("tr", {},
        h("th", { style: TH_STYLE }, "region"), h("th", { style: TH_STYLE }, "day"),
        h("th", { style: TH_STYLE }, "amount"), h("th", { style: TH_STYLE }, "peers"),
        h("th", { style: TH_STYLE }, "result"));
      if (isSum) head.appendChild(h("th", { style: TH_STYLE }, frame === "rows" ? "if RANGE" : "if ROWS"));
      var tbody = h("tbody", {});
      var diff = 0, distinct = {}, lastPart = null;
      for (var i = 0; i < res.out.length; i++) {
        var o = res.out[i];
        var v = value(o);
        distinct[String(v)] = true;
        var other = frame === "rows" ? o.rangeSum : o.rowsSum;
        var differs = isSum && o.rowsSum !== o.rangeSum;
        if (differs) diff++;
        var sep = part && lastPart !== null && lastPart !== o.part ? "border-top:2px solid var(--line);" : "";
        lastPart = o.part;
        var hi = differs ? "color:var(--amber-ink);font-weight:700;" : "font-weight:700;";
        var tr = h("tr", {},
          h("td", { style: TD_STYLE + sep }, o.row.region),
          h("td", { style: TD_STYLE + sep }, String(o.row.day)),
          h("td", { style: TD_STYLE + sep }, String(o.row.amount)),
          h("td", { style: TD_STYLE + sep + (o.peers > 1 ? "color:var(--violet-ink);font-weight:700" : "color:var(--text-dim)") }, o.peers > 1 ? o.peers + " tied" : "1"),
          h("td", { style: TD_STYLE + sep + hi }, String(v)));
        if (isSum) tr.appendChild(h("td", { style: TD_STYLE + sep + "color:var(--text-dim)" }, String(other)));
        tbody.appendChild(tr);
      }
      stage.appendChild(h("div", { style: "overflow-x:auto" },
        h("table", { style: "border-collapse:collapse;width:100%;font-size:0.86rem" }, h("thead", {}, head), tbody)));

      var msg;
      if (fn === "rn") msg = "ROW_NUMBER never repeats. Tied rows get distinct numbers in an order the engine is free to choose (here broken by id); add a unique tiebreaker to ORDER BY if you need it stable.";
      else if (fn === "rank") msg = "RANK gives tied rows the same number, then skips: two rows at rank 2 mean the next row is rank 4.";
      else if (fn === "dense") msg = "DENSE_RANK gives tied rows the same number and never skips, so it counts distinct values of the ORDER BY key.";
      else if (fn === "lag") msg = "LAG reads the previous row of the partition; the first row of each partition has no predecessor and gets NULL. The frame clause is ignored.";
      else if (frame === "rows") msg = "ROWS counts physical rows: each tied row adds only itself. Amber cells are where RANGE would give a different answer.";
      else msg = "RANGE pulls in every peer (same ORDER BY value) of the current row, so tied rows share one running total. This is the default frame when you write ORDER BY without a frame.";
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:10px 0 0;line-height:1.55;color:var(--text)" }, msg));

      clear(readout);
      readout.appendChild(ro("partitions", res.partitions));
      readout.appendChild(ro("tied peer groups", res.tiedGroups));
      readout.appendChild(ro("distinct results", Object.keys(distinct).length));
      readout.appendChild(ro("rows where ROWS and RANGE differ", isSum ? diff : "n/a (frame ignored)"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["rn", "ROW_NUMBER"], ["rank", "RANK"], ["dense", "DENSE_RANK"], ["sum", "running SUM"], ["lag", "LAG"]], 1, function (v) { fn = v; paint(); }),
      segment([[true, "PARTITION BY region"], [false, "No partition"]], 0, function (v) { part = v; paint(); }),
      segment([["day", "ORDER BY day"], ["amount", "ORDER BY amount DESC"]], 0, function (v) { order = v; paint(); }),
      segment([["rows", "ROWS frame"], ["range", "RANGE frame"]], 0, function (v) { frame = v; paint(); })));
    mount.appendChild(sqlBox);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- sqlSargable: can an index serve this predicate? ---------- */
  Widgets.sqlSargable = function (mount) {
    shell(mount, "rewrite", "Sargability checker",
      "Pick a predicate pattern against a table with a B-tree index on the filtered column(s). See whether the index can be used, why, and the rewrite that makes it seekable.");

    var P = {
      fn: {
        bad: "WHERE YEAR(created_at) = 2025",
        good: "WHERE created_at >= '2025-01-01'\n  AND created_at <  '2026-01-01'",
        verdict: "no", sel: 0.1,
        why: "The index is sorted by created_at, not by YEAR(created_at). Wrapping the column in a function hides the sort order, so the engine must compute YEAR() for every row.",
        fix: "Move the work to the constant side as a half-open range, or build an expression index on the exact expression."
      },
      like: {
        bad: "WHERE last_name LIKE '%son'",
        good: "-- store reverse(last_name) in an indexed column\nWHERE last_name_rev LIKE 'nos%'",
        verdict: "no", sel: 0.002,
        why: "A B-tree is ordered left to right. With a leading wildcard there is no starting key to seek to, so every entry must be checked.",
        fix: "Index the reversed string for suffix search, or use a trigram (GIN/GiST) or full-text index for contains-style search."
      },
      cast: {
        bad: "WHERE phone = 5551234      -- phone is VARCHAR",
        good: "WHERE phone = '5551234'",
        verdict: "no", sel: 0.0000002,
        why: "MySQL compares a string column to a number by converting the column value on every row, which disables the index. Postgres refuses varchar = integer with a type error instead.",
        fix: "Make the literal (or bind parameter) the same type as the column. Casting the constant is free; casting the column is not."
      },
      or: {
        bad: "WHERE customer_id = 42 OR referrer_id = 42",
        good: "SELECT * FROM orders WHERE customer_id = 42\nUNION\nSELECT * FROM orders WHERE referrer_id = 42",
        verdict: "partial", sel: 0.0002,
        why: "One composite index on (customer_id, referrer_id) cannot serve the second branch. Some engines combine two single-column indexes (bitmap OR in Postgres, index merge in MySQL), otherwise it is a full scan.",
        fix: "Give each branch its own index and its own query, then UNION them (UNION removes rows matching both branches)."
      },
      math: {
        bad: "WHERE price * 1.2 > 120",
        good: "WHERE price > 100",
        verdict: "no", sel: 0.05,
        why: "Arithmetic on the column is just another function call. The optimizer will not solve the inequality for you.",
        fix: "Do the algebra yourself and leave the column bare on one side of the comparison."
      },
      range: {
        bad: "WHERE created_at >= '2025-01-01'\n  AND created_at <  '2025-02-01'",
        good: "-- already sargable: bare column, constant bounds",
        verdict: "yes", sel: 0.01,
        why: "Bare column compared to constants: the engine seeks to the lower bound and walks leaf pages until the upper bound.",
        fix: "Nothing to fix. Prefer half-open ranges so timestamps late on the last day are not lost."
      },
      prefix: {
        bad: "WHERE last_name LIKE 'Joh%'",
        good: "-- sargable as written (in Postgres with a non-C collation,\n-- build the index with text_pattern_ops)",
        verdict: "yes", sel: 0.001,
        why: "A fixed prefix becomes a range: last_name >= 'Joh' AND last_name < 'Joi'. The engine can seek straight to it.",
        fix: "Nothing to fix in MySQL. In Postgres, check the index operator class matches the collation."
      }
    };
    var pick = "fn", show = "bad", n = 10000000;

    var sqlBox = h("pre", { style: PRE_STYLE });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var p = P[pick];
      var rewritten = show === "good";
      var usable = rewritten || p.verdict === "yes" ? "yes" : (p.verdict === "partial" ? "only with 2 separate indexes" : "no");
      var seek = rewritten || p.verdict === "yes";
      var examined = seek ? Math.max(1, Math.ceil(n * p.sel)) : n;
      var best = Math.max(1, Math.ceil(n * p.sel));
      sqlBox.textContent = "SELECT * FROM orders\n" + (rewritten ? p.good : p.bad) + ";";
      clear(stage);
      var colour = seek ? "var(--lime-ink)" : (p.verdict === "partial" ? "var(--amber-ink)" : "var(--rose-ink)");
      stage.appendChild(h("p", { style: "margin:0 0 6px;font-weight:700;color:" + colour },
        seek ? "Index seek / range scan" : (p.verdict === "partial" ? "Full scan unless the engine can combine two indexes" : "Full scan: the index cannot be used for this predicate")));
      stage.appendChild(h("p", { style: "margin:0 0 6px;font-size:0.86rem;line-height:1.55;color:var(--text)" }, rewritten ? p.fix : p.why));
      if (!rewritten && p.verdict !== "yes") {
        stage.appendChild(h("p", { style: "margin:0;font-size:0.84rem;color:var(--text-dim)" }, "Switch to \"Sargable rewrite\" to see the fix."));
      }
      clear(readout);
      readout.appendChild(ro("index usable", usable));
      readout.appendChild(ro("rows examined", fmt(examined)));
      readout.appendChild(ro("rows matching", fmt(best)));
      readout.appendChild(ro("work vs ideal", (examined / best >= 10 ? fmt(examined / best) : (examined / best).toFixed(1)) + "x"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["fn", "Function on column"], ["like", "Leading wildcard"], ["cast", "Implicit cast"], ["or", "OR across columns"], ["math", "Arithmetic"], ["range", "Plain range"], ["prefix", "Prefix LIKE"]], 0, function (v) { pick = v; paint(); }),
      segment([["bad", "As written"], ["good", "Sargable rewrite"]], 0, function (v) { show = v; paint(); }),
      segment([[1000000, "1M rows"], [10000000, "10M rows"], [100000000, "100M rows"]], 1, function (v) { n = v; paint(); })));
    mount.appendChild(sqlBox);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- quizzes ---------- */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sql-windows": {
      title: "Window functions checkpoint",
      sub: "Ranking with ties, default frames, LAST_VALUE and gaps-and-islands.",
      questions: [
        { q: "Scores ordered DESC are 90, 85, 85, 80. What does RANK() return for the 80?",
          options: ["3", "4", "2", "5"], answer: 1,
          explain: "RANK gives both 85s rank 2 and then skips one position for the extra tied row, so the next row is 4. DENSE_RANK would return 3 because it never leaves gaps. ROW_NUMBER also returns 4 here, but only because the 80 happens to be the fourth row." },
        { q: "You write SUM(amount) OVER (ORDER BY day) with no frame clause, and two rows share day 2. What do those two rows show?",
          options: [
            "Different running totals, each adding only its own amount",
            "NULL, because the ordering is ambiguous",
            "The same running total, which already includes both day-2 rows",
            "An error asking for a unique ORDER BY key"],
          answer: 2,
          explain: "With ORDER BY and no explicit frame the default is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, and RANGE includes every peer of the current row. Both day-2 rows therefore see the sum through the end of day 2. Write ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW if you want a strict row-by-row total." },
        { q: "LAST_VALUE(price) OVER (PARTITION BY symbol ORDER BY ts) keeps returning the current row's price. Why?",
          options: [
            "The default frame ends at the current row (and its peers), so the current row is the last one in the frame",
            "LAST_VALUE ignores ORDER BY and reads in insertion order",
            "PARTITION BY resets the function on every row",
            "LAST_VALUE only works on numeric columns with an index"],
          answer: 0,
          explain: "Window value functions read from the frame, and the default frame stops at the current row. Extend it with ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING, or flip the sort and use FIRST_VALUE, which is immune to the frame end." },
        { q: "In the gaps-and-islands trick you compute login_date minus ROW_NUMBER() ordered by date. Why does that identify streaks?",
          options: [
            "ROW_NUMBER restarts at every gap in the dates",
            "Subtracting integers from dates rounds every date to the start of its week",
            "It sorts the table so that streaks become adjacent",
            "Inside a run of consecutive dates both values grow by exactly one per row, so their difference stays constant and becomes a group key"],
          answer: 3,
          explain: "Within a streak the date and the row number advance in lockstep, so date minus row number is the same for every row of that streak. When a gap appears the date jumps by more than one while the row number still moves by one, which changes the difference and starts a new group. Deduplicate dates first or repeated days break the lockstep." },
        { q: "Why does WHERE ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) <= 3 fail?",
          options: [
            "ROW_NUMBER requires a GROUP BY clause",
            "Comparison operators are not allowed on window results",
            "Window functions are evaluated after WHERE, so you must compute them in a subquery or CTE (or use QUALIFY where supported) and filter outside",
            "PARTITION BY cannot be combined with ORDER BY DESC"],
          answer: 2,
          explain: "Logically WHERE runs before window functions are computed, so the value does not exist yet at filter time. Compute rn in a CTE and filter on it in the outer query; engines such as Snowflake, BigQuery and DuckDB offer QUALIFY as shorthand for exactly this." }
      ]
    },
    "sql-ctes": {
      title: "CTEs, sets and NULLs checkpoint",
      sub: "Recursion, set operations, duplicate semantics and three-valued logic.",
      questions: [
        { q: "SELECT name FROM emp WHERE id NOT IN (SELECT manager_id FROM emp). One employee has manager_id NULL. What comes back?",
          options: [
            "Every employee who manages nobody",
            "Every employee, because NULL is ignored",
            "An error about NULL in a subquery",
            "Zero rows"],
          answer: 3,
          explain: "NOT IN expands to id <> m1 AND id <> m2 AND ... AND id <> NULL. Comparing anything to NULL is UNKNOWN, so the whole AND can never be TRUE and WHERE keeps nothing. Use NOT EXISTS, or filter manager_id IS NOT NULL inside the subquery." },
        { q: "Table A holds the values 1, 1, 2 and table B holds 1. What does A EXCEPT ALL B return?",
          options: ["{2}", "{1, 2}", "{1, 1, 2}", "An empty set"], answer: 1,
          explain: "EXCEPT ALL is multiset subtraction: each row in B cancels one matching row in A. One of the two 1s survives, and the 2 has nothing to cancel it. Plain EXCEPT would first remove duplicates and return only {2}." },
        { q: "A recursive CTE walks a 'follows' graph that contains cycles. What is the most robust protection?",
          options: [
            "Carry the visited path in each row and stop when the next node is already in it, plus a depth cap as a backstop",
            "Switch UNION ALL to UNION and rely on it to stop repeats",
            "Add ORDER BY to the recursive member",
            "Wrap the CTE in SELECT DISTINCT"],
          answer: 0,
          explain: "UNION only discards rows that are identical in every column, so as soon as you carry depth or a path the rows differ and the loop continues. Tracking the path (an array or delimited string) and rejecting revisits stops cycles precisely, and a depth limit protects you if the check has a bug. Postgres 14 adds a CYCLE clause that does this for you." },
        { q: "A table has 10 rows and 3 of them have email NULL. What do COUNT(*) and COUNT(email) return?",
          options: ["10 and 10", "7 and 7", "10 and 7", "7 and 10"], answer: 2,
          explain: "COUNT(*) counts rows regardless of contents. COUNT(column) counts only non-NULL values of that column. The same rule makes AVG divide by the non-NULL count, which silently changes averages when NULLs appear." },
        { q: "In PostgreSQL 12 and later, how is a non-recursive CTE that is referenced exactly once usually executed?",
          options: [
            "Always materialized into a temporary result first",
            "Executed once per outer row",
            "Rejected unless you add MATERIALIZED",
            "Inlined into the outer query so the planner can push filters into it, unless you write MATERIALIZED"],
          answer: 3,
          explain: "Before version 12, Postgres always materialized CTEs, making them an optimization fence. Since 12, side-effect-free CTEs referenced once are inlined, and you can force either behaviour with MATERIALIZED or NOT MATERIALIZED. Other engines differ, so check the plan rather than assuming." }
      ]
    },
    "sql-perf": {
      title: "Performance and interview patterns checkpoint",
      sub: "Sargability, semi- and anti-joins, and the classic problems.",
      questions: [
        { q: "orders has a B-tree index on created_at. Which predicate lets the engine seek the index for one calendar day?",
          options: [
            "WHERE DATE(created_at) = '2025-06-01'",
            "WHERE CAST(created_at AS VARCHAR) LIKE '2025-06-01%'",
            "WHERE created_at >= '2025-06-01' AND created_at < '2025-06-02'",
            "WHERE EXTRACT(DAY FROM created_at) = 1"],
          answer: 2,
          explain: "Only the half-open range leaves the column bare, so the engine can seek to the lower bound and stop at the upper. The other three apply a function or cast to every row's value, which hides the index order and forces a scan (unless you build a matching expression index)." },
        { q: "You need customers with no orders, and orders.customer_id is nullable. Which form is both correct and optimizer-friendly?",
          options: [
            "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)",
            "WHERE c.id NOT IN (SELECT customer_id FROM orders)",
            "INNER JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL",
            "WHERE c.id <> ALL (SELECT customer_id FROM orders)"],
          answer: 0,
          explain: "NOT EXISTS only asks whether a matching row exists, so a NULL customer_id can never match and cannot poison the result; optimizers plan it as an anti-join. NOT IN and <> ALL return nothing once a NULL appears, and an INNER JOIN can never produce a row whose joined side is missing." },
        { q: "SELECT c.* FROM customers c JOIN orders o ON o.customer_id = c.id is meant to list customers who have ordered. What goes wrong?",
          options: [
            "Customers with NULL emails are dropped",
            "The join silently becomes a LEFT JOIN",
            "It fails because c.* cannot be used with a join",
            "Customers appear once per order, so the list contains duplicates"],
          answer: 3,
          explain: "A join multiplies rows: a customer with five orders appears five times. Adding DISTINCT hides it at the cost of a sort or hash, while EXISTS or IN expresses a semi-join that returns each customer at most once and lets the engine stop at the first match." },
        { q: "Salaries are 100, 100, 90, 80. Which query returns 90 as the second-highest salary?",
          options: [
            "Rows where ROW_NUMBER() OVER (ORDER BY salary DESC) = 2",
            "Rows where DENSE_RANK() OVER (ORDER BY salary DESC) = 2",
            "Rows where RANK() OVER (ORDER BY salary DESC) = 2",
            "ORDER BY salary DESC LIMIT 1 OFFSET 1"],
          answer: 1,
          explain: "The second-highest distinct value is 90, and DENSE_RANK numbers distinct values 1, 1, 2, 3. ROW_NUMBER = 2 and OFFSET 1 both land on the second 100, while RANK jumps from 1 to 3 so no row has rank 2. Always ask whether 'second highest' means distinct values." },
        { q: "To keep only the latest row per user_id in a table full of duplicates, which approach is standard?",
          options: [
            "GROUP BY user_id and select MAX(updated_at) with SELECT *",
            "SELECT DISTINCT user_id, * ordered by updated_at",
            "Number rows with ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) and keep rn = 1",
            "DELETE every row whose updated_at is not unique"],
          answer: 2,
          explain: "ROW_NUMBER assigns exactly one row number 1 per user, and the extra id tiebreaker makes the choice deterministic when timestamps tie. GROUP BY with SELECT * is invalid in strict SQL, and DISTINCT on all columns does not collapse rows that differ in any column." }
      ]
    }
  });

  /* ---------- track ---------- */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sql = {
    id: "sql",
    name: "SQL Mastery for Interviews",
    short: "SQL",
    tagline: "Window functions, recursion, NULL logic and the rewrites that make indexes work",
    color: "#a3e635",
    blurb: "The SQL that separates a pass from a strong pass: window functions with frames and ties, gaps and islands, recursive CTEs with cycle protection, set operations and duplicate semantics, three-valued NULL logic, sargable predicates, semi- and anti-joins, and the classic interview problems written the way a senior engineer writes them.",
    modules: [
      {
        id: "windows",
        name: "Window Functions",
        icon: "grid",
        lessons: [
          {
            id: "window-basics",
            title: "Window functions: rows that remember their neighbours",
            summary: "What OVER, PARTITION BY and ORDER BY actually do, where window functions sit in evaluation order, and why you cannot filter on them in WHERE.",
            minutes: 9,
            tags: ["window-functions", "partition-by", "evaluation-order"],
            blocks: [
              { t: "p", html: "Hold this picture: <strong>GROUP BY collapses rows, a window function decorates them</strong>. Every input row survives, and each one gets an extra value computed from a set of related rows called its <em>window</em>. That is why window functions answer questions like \"each sale and its share of the region total\" in one pass, without a self-join." },
              { t: "code", lang: "sql", code:
                "SELECT region, day, amount,\n" +
                "       SUM(amount) OVER (PARTITION BY region)            AS region_total,\n" +
                "       ROUND(100.0 * amount / SUM(amount) OVER (PARTITION BY region), 1) AS pct\n" +
                "FROM sales;" },
              { t: "table", headers: ["region", "day", "amount", "region_total", "pct"], rows: [
                ["East", "1", "100", "380", "26.3"],
                ["East", "2", "80", "380", "21.1"],
                ["East", "2", "120", "380", "31.6"],
                ["East", "3", "80", "380", "21.1"],
                ["West", "1", "90", "360", "25.0"]
              ] },
              { t: "h", text: "Anatomy of OVER ( )" },
              { t: "table", headers: ["Clause", "What it does", "If you leave it out"], rows: [
                ["<code class='tok'>PARTITION BY</code>", "Splits rows into independent groups; the function restarts in each", "The whole result set is one partition"],
                ["<code class='tok'>ORDER BY</code>", "Orders rows inside each partition; required for ranking, LAG/LEAD and running totals", "Rows are unordered; aggregates see the whole partition"],
                ["Frame (<code class='tok'>ROWS</code> / <code class='tok'>RANGE</code> / <code class='tok'>GROUPS</code>)", "Picks which rows around the current row an aggregate or value function sees", "With ORDER BY: start of partition through current row <em>and its peers</em>. Without: whole partition"]
              ] },
              { t: "h", text: "Where windows sit in evaluation order" },
              { t: "code", lang: "text", code:
                "FROM / JOIN  ->  WHERE  ->  GROUP BY  ->  HAVING\n" +
                "            ->  window functions  ->  SELECT list  ->  DISTINCT\n" +
                "            ->  ORDER BY  ->  LIMIT / OFFSET" },
              { t: "p", html: "Two consequences interviewers probe. First, window functions see rows <em>after</em> WHERE and GROUP BY, so they can wrap aggregates. Second, you cannot reference a window result in WHERE or HAVING, because it does not exist yet at that point." },
              { t: "compare",
                bad: { title: "Fails: filter before the value exists", items: [
                  "SELECT * FROM emp WHERE RANK() OVER (ORDER BY salary DESC) <= 3",
                  "Error: window functions are not allowed in WHERE"] },
                good: { title: "Works: compute, then filter outside", items: [
                  "WITH r AS (SELECT *, RANK() OVER (ORDER BY salary DESC) AS rk FROM emp) SELECT * FROM r WHERE rk <= 3",
                  "Or QUALIFY rk <= 3 in Snowflake, BigQuery, DuckDB"] } },
              { t: "h", text: "Aggregates of aggregates" },
              { t: "p", html: "Because windows run after GROUP BY, you can window over a grouped result. <code class='tok'>SUM(SUM(amount)) OVER ()</code> reads as \"sum the per-group sums across all groups\" and gives you percent-of-total per group in one query." },
              { t: "code", lang: "sql", code:
                "SELECT region,\n" +
                "       SUM(amount)                                    AS region_sales,\n" +
                "       ROUND(100.0 * SUM(amount) / SUM(SUM(amount)) OVER (), 1) AS pct_of_total\n" +
                "FROM sales\n" +
                "GROUP BY region;\n" +
                "-- East 380 51.4 | West 360 48.6" },
              { t: "note", variant: "trap", html: "<strong>Window cost is a sort.</strong> Each distinct <code class='tok'>PARTITION BY ... ORDER BY</code> combination typically needs the rows sorted (or hashed then sorted) that way. Three different window specs in one SELECT can mean three sorts; reuse the same spec, or a named <code class='tok'>WINDOW w AS (...)</code>, when you can." },
              { t: "widget", id: "sqlWindow" },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"for each row, also show ...\", \"compared with the previous\", \"share of total\", \"rank within\", \"running\", \"top N per\". If the output keeps one row per input row but needs information from other rows, reach for a window before a self-join." },
              { t: "note", variant: "key", html: "<strong>A window function keeps every row and adds a value computed over related rows.</strong> It runs after WHERE and GROUP BY, so filter on it one level up (CTE or QUALIFY), never in the same WHERE." }
            ]
          },
          {
            id: "frames-and-ranking",
            title: "Frames, ranking and value functions",
            summary: "ROW_NUMBER vs RANK vs DENSE_RANK vs NTILE, ROWS vs RANGE vs GROUPS, the default-frame peer trap, LAG/LEAD, the LAST_VALUE gotcha and top-N per group.",
            minutes: 12,
            tags: ["ranking", "frames", "lag-lead", "top-n"],
            blocks: [
              { t: "p", html: "Ranking functions differ only in how they treat <strong>ties</strong>, and aggregate windows differ only in their <strong>frame</strong>. Get those two ideas crisp and most window questions become mechanical. Start with four ranking functions over one set of ties:" },
              { t: "code", lang: "sql", code:
                "SELECT name, score,\n" +
                "       ROW_NUMBER() OVER w AS rn,\n" +
                "       RANK()       OVER w AS rnk,\n" +
                "       DENSE_RANK() OVER w AS drnk,\n" +
                "       NTILE(2)     OVER w AS half\n" +
                "FROM results\n" +
                "WINDOW w AS (ORDER BY score DESC);" },
              { t: "table", headers: ["name", "score", "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE(2)"], rows: [
                ["Ana", "90", "1", "1", "1", "1"],
                ["Bo", "85", "2", "2", "2", "1"],
                ["Cy", "85", "3", "2", "2", "2"],
                ["Di", "80", "4", "4", "3", "2"]
              ] },
              { t: "ul", items: [
                "<strong>ROW_NUMBER</strong>: always unique. Which tied row gets 2 versus 3 is up to the engine unless ORDER BY includes a unique tiebreaker.",
                "<strong>RANK</strong>: ties share a value, then a gap (1, 2, 2, 4). Equals 1 + the number of rows strictly ahead.",
                "<strong>DENSE_RANK</strong>: ties share a value, no gap (1, 2, 2, 3). Equals the count of distinct values at or ahead.",
                "<strong>NTILE(n)</strong>: splits rows into n buckets as evenly as possible; earlier buckets take the remainder (10 rows into NTILE(3) gives 4, 3, 3). It ignores ties, so Bo and Cy can land in different buckets."
              ] },
              { t: "h", text: "Frames: ROWS vs RANGE vs GROUPS" },
              { t: "table", headers: ["Unit", "Counts", "1 PRECEDING means", "Use it for"], rows: [
                ["<code class='tok'>ROWS</code>", "Physical rows", "The single row before this one", "Running totals, N-row moving averages"],
                ["<code class='tok'>RANGE</code>", "Values of the ORDER BY key", "Rows whose key is within 1 of this key (offsets need a numeric/date key)", "Time-based windows that tolerate gaps, peer-aware totals"],
                ["<code class='tok'>GROUPS</code>", "Peer groups (sets of tied rows)", "The previous group of tied rows", "\"This value and the previous distinct value\" (Postgres 11+, SQLite, DuckDB; not MySQL)"]
              ] },
              { t: "h", text: "The default-frame trap" },
              { t: "p", html: "Write <code class='tok'>ORDER BY</code> inside OVER without a frame and you get <code class='tok'>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>. RANGE treats all rows with the same ORDER BY value as <em>peers</em> and includes them all. With duplicate keys your \"running\" total jumps by the whole tied group at once." },
              { t: "code", lang: "sql", code:
                "SELECT day, amount,\n" +
                "  SUM(amount) OVER (ORDER BY day)                                   AS default_range,\n" +
                "  SUM(amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING\n" +
                "                                   AND CURRENT ROW)                 AS rows_total\n" +
                "FROM east_sales;" },
              { t: "table", headers: ["day", "amount", "default (RANGE)", "ROWS"], rows: [
                ["1", "100", "100", "100"],
                ["2", "80", "<strong>300</strong>", "180"],
                ["2", "120", "300", "300"],
                ["3", "80", "380", "380"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Make running totals deterministic.</strong> Use ROWS <em>and</em> a unique tiebreaker: <code class='tok'>ORDER BY day, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>. ROWS alone fixes the peer jump but leaves the order of tied rows arbitrary, so the intermediate totals can change between runs." },
              { t: "h", text: "Moving averages, LAG and LEAD" },
              { t: "code", lang: "sql", code:
                "SELECT day, revenue,\n" +
                "  AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma_7_rows,\n" +
                "  AVG(revenue) OVER (ORDER BY day RANGE BETWEEN INTERVAL '6 days' PRECEDING\n" +
                "                                       AND CURRENT ROW)                    AS ma_7_days,\n" +
                "  revenue - LAG(revenue, 1, 0) OVER (ORDER BY day)                       AS change_vs_prev,\n" +
                "  LEAD(day) OVER (ORDER BY day)                                          AS next_day\n" +
                "FROM daily_revenue;" },
              { t: "p", html: "The ROWS version averages the last 7 <em>rows</em>; if days are missing it silently spans more than a week. The RANGE-with-interval version (Postgres 11+, among others) averages the last 7 <em>calendar days</em>, however many rows that is. <code class='tok'>LAG(x, offset, default)</code> and <code class='tok'>LEAD</code> ignore the frame entirely." },
              { t: "note", variant: "trap", html: "<strong>The LAST_VALUE gotcha.</strong> Value functions read from the frame. FIRST_VALUE works with the default frame because the frame starts at the partition start. LAST_VALUE does not: the default frame ends at the current row, so it returns the current row (or its last peer). Widen the frame to <code class='tok'>ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING</code> or reverse the sort and use FIRST_VALUE." },
              { t: "h", text: "Top-N per group" },
              { t: "code", lang: "sql", code:
                "WITH ranked AS (\n" +
                "  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY category\n" +
                "                                 ORDER BY sales DESC, product_id) AS rn\n" +
                "  FROM products p\n" +
                ")\n" +
                "SELECT * FROM ranked WHERE rn <= 3;" },
              { t: "table", headers: ["Tier", "Answer", "What it signals"], rows: [
                ["Naive", "Correlated subquery counting how many rows beat each row", "Works, but O(n²) per group and awkward with ties"],
                ["Solid", "ROW_NUMBER in a CTE, filter rn &lt;= N", "Knows windows and evaluation order"],
                ["Standout", "Asks whether ties should be included (RANK) or exactly N (ROW_NUMBER with tiebreaker); mentions an index on (category, sales DESC) or a LATERAL ... LIMIT N for few groups and huge tables", "Clarifies semantics, then reasons about cost"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"top 3 per\", \"latest per\", \"rank\", \"ties should share\", \"previous / next value\", \"7-day rolling\", \"running balance\". Each maps to ROW_NUMBER/RANK, LAG/LEAD or a framed aggregate; say which frame out loud." },
              { t: "note", variant: "key", html: "<strong>Ties decide the ranking function; the frame decides the aggregate.</strong> The default frame is RANGE through the current row's peers, so declare ROWS plus a unique tiebreaker for running totals, and widen the frame for LAST_VALUE." }
            ]
          },
          {
            id: "gaps-and-islands",
            title: "Gaps and islands: finding runs in ordered data",
            summary: "The row-number difference trick, the LAG-flag-and-running-sum method, status-change islands and finding missing ids.",
            minutes: 10,
            tags: ["gaps-and-islands", "streaks", "row-number"],
            blocks: [
              { t: "p", html: "An <strong>island</strong> is a maximal run of consecutive values (dates, ids, identical statuses); a <strong>gap</strong> is what separates islands. \"Longest login streak\", \"periods a sensor was offline\" and \"merge overlapping bookings\" are all this one problem wearing different clothes." },
              { t: "h", text: "The row-number difference trick" },
              { t: "p", html: "Inside a streak, the date goes up by one per row and so does ROW_NUMBER. Their difference is therefore <em>constant</em> for the whole streak and changes when a gap appears. That constant is your group key." },
              { t: "code", lang: "sql", code:
                "WITH d AS (\n" +
                "  SELECT DISTINCT user_id, login_date FROM logins      -- duplicates break the trick\n" +
                "), g AS (\n" +
                "  SELECT user_id, login_date,\n" +
                "         login_date - CAST(ROW_NUMBER() OVER (PARTITION BY user_id\n" +
                "                                              ORDER BY login_date) AS int) AS grp\n" +
                "  FROM d\n" +
                ")\n" +
                "SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end,\n" +
                "       COUNT(*) AS days\n" +
                "FROM g\n" +
                "GROUP BY user_id, grp\n" +
                "ORDER BY days DESC;" },
              { t: "table", headers: ["login_date", "row_number", "date minus rn (grp)"], rows: [
                ["2025-03-01", "1", "2025-02-28"],
                ["2025-03-02", "2", "2025-02-28"],
                ["2025-03-03", "3", "2025-02-28"],
                ["2025-03-05", "4", "2025-03-01"],
                ["2025-03-06", "5", "2025-03-01"],
                ["2025-03-09", "6", "2025-03-03"]
              ] },
              { t: "p", html: "Three islands: 3 days from March 1, 2 days from March 5, 1 day on March 9. In Postgres <code class='tok'>date - integer</code> yields a date; elsewhere use <code class='tok'>DATEADD(day, -rn, login_date)</code> or subtract from an integer day number. For integer ids, <code class='tok'>id - ROW_NUMBER()</code> works directly." },
              { t: "note", variant: "trap", html: "<strong>Deduplicate first.</strong> Two logins on March 2 give that day two row numbers, so the difference shifts and one streak splits into two. Either SELECT DISTINCT the dates or use <code class='tok'>DENSE_RANK()</code> instead of ROW_NUMBER." },
              { t: "h", text: "The flag-and-sum method" },
              { t: "p", html: "When \"consecutive\" needs a rule (gaps of up to 30 minutes count as the same session), mark where each island starts and turn the marks into ids with a running sum." },
              { t: "code", lang: "sql", code:
                "WITH flagged AS (\n" +
                "  SELECT user_id, ts,\n" +
                "         CASE WHEN ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts)\n" +
                "                   <= INTERVAL '30 minutes' THEN 0 ELSE 1 END AS is_start\n" +
                "  FROM events\n" +
                "), sessions AS (\n" +
                "  SELECT *, SUM(is_start) OVER (PARTITION BY user_id ORDER BY ts\n" +
                "                                ROWS UNBOUNDED PRECEDING) AS session_id\n" +
                "  FROM flagged\n" +
                ")\n" +
                "SELECT user_id, session_id, MIN(ts) AS started, MAX(ts) AS ended, COUNT(*) AS events\n" +
                "FROM sessions GROUP BY user_id, session_id;" },
              { t: "p", html: "The first event per user has LAG = NULL, the comparison is UNKNOWN, CASE falls to ELSE, and the row correctly starts a session. That is three-valued logic working <em>for</em> you." },
              { t: "h", text: "Status-change islands" },
              { t: "p", html: "For runs of the same status in a time series (up, up, down, up), subtract two row numbers: one over the whole series and one per status. Rows in the same run share the difference." },
              { t: "code", lang: "sql", code:
                "SELECT status, MIN(ts) AS from_ts, MAX(ts) AS to_ts\n" +
                "FROM (\n" +
                "  SELECT ts, status,\n" +
                "         ROW_NUMBER() OVER (ORDER BY ts)\n" +
                "       - ROW_NUMBER() OVER (PARTITION BY status ORDER BY ts) AS grp\n" +
                "  FROM health_checks\n" +
                ") t\n" +
                "GROUP BY status, grp\n" +
                "ORDER BY from_ts;" },
              { t: "h", text: "Finding the gaps themselves" },
              { t: "code", lang: "sql", code:
                "SELECT id + 1 AS gap_start, next_id - 1 AS gap_end\n" +
                "FROM (SELECT id, LEAD(id) OVER (ORDER BY id) AS next_id FROM invoices) t\n" +
                "WHERE next_id - id > 1;\n" +
                "-- ids 1,2,3,7,8,12  ->  (4,6) and (9,11)" },
              { t: "table", headers: ["Method", "Best for", "Watch out for"], rows: [
                ["Value minus ROW_NUMBER", "Strictly consecutive integers or dates", "Duplicates; needs a fixed step of 1"],
                ["LAG flag + running SUM", "Custom continuity rules, tolerances, sessions", "Frame must be ROWS with a deterministic order"],
                ["Two ROW_NUMBERs", "Runs of equal status in a sequence", "Ties in the timestamp make runs ambiguous"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"consecutive\", \"streak\", \"in a row\", \"sessions with a 30-minute timeout\", \"periods when status was\", \"missing invoice numbers\", \"merge overlapping ranges\"." },
              { t: "quiz", id: "sql-windows" },
              { t: "note", variant: "key", html: "<strong>Turn \"consecutive\" into a group key.</strong> Value minus ROW_NUMBER for fixed steps, or a LAG-based start flag plus a ROWS running sum for anything with a rule. Deduplicate before you number." }
            ]
          }
        ]
      },
      {
        id: "ctes",
        name: "CTEs, Sets & NULLs",
        icon: "blocks",
        lessons: [
          {
            id: "ctes-and-recursion",
            title: "CTEs and recursive CTEs",
            summary: "Readable pipelines with WITH, how engines execute CTEs, and recursion for hierarchies, series and graphs, with cycle protection.",
            minutes: 11,
            tags: ["cte", "recursive", "hierarchy", "cycles"],
            blocks: [
              { t: "p", html: "A CTE is a <strong>named subquery you can read top to bottom</strong>. In an interview it does double duty: it structures your answer into steps the interviewer can follow, and it is the only standard way to write recursion in SQL." },
              { t: "h", text: "How engines run a plain CTE" },
              { t: "table", headers: ["Engine", "Default behaviour", "Control"], rows: [
                ["PostgreSQL 12+", "Inlined when side-effect free and referenced once; materialized if referenced more than once", "<code class='tok'>AS MATERIALIZED</code> / <code class='tok'>AS NOT MATERIALIZED</code>"],
                ["PostgreSQL 11 and older", "Always materialized: an optimization fence, filters are not pushed inside", "Rewrite as a subquery"],
                ["MySQL 8, SQL Server, Snowflake", "Generally treated like a derived table / inlined view", "Engine-specific; read the plan"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Readability is free; materialization is not.</strong> A fence can hurt (no predicate pushdown) or help (an expensive expression computed once). Say that trade-off when an interviewer asks whether CTEs are slower." },
              { t: "h", text: "Recursive CTE mechanics" },
              { t: "p", html: "A recursive CTE has an <strong>anchor</strong> member (runs once) joined by <code class='tok'>UNION ALL</code> to a <strong>recursive</strong> member that references the CTE itself. The engine feeds the rows produced in iteration k into iteration k+1, and stops when an iteration produces no rows." },
              { t: "code", lang: "sql", code:
                "-- series generation: a date spine to fill missing days\n" +
                "WITH RECURSIVE days(d) AS (\n" +
                "  SELECT DATE '2025-03-01'\n" +
                "  UNION ALL\n" +
                "  SELECT d + 1 FROM days WHERE d < DATE '2025-03-07'\n" +
                ")\n" +
                "SELECT days.d, COALESCE(SUM(o.amount), 0) AS revenue\n" +
                "FROM days LEFT JOIN orders o ON o.order_date = days.d\n" +
                "GROUP BY days.d ORDER BY days.d;" },
              { t: "p", html: "Postgres has <code class='tok'>generate_series</code> for this, but the recursive form works across engines (SQL Server omits the RECURSIVE keyword). The LEFT JOIN plus COALESCE turns missing days into explicit zeros, which matters for moving averages." },
              { t: "h", text: "Walking a hierarchy" },
              { t: "code", lang: "sql", code:
                "WITH RECURSIVE chain AS (\n" +
                "  SELECT id, name, manager_id, 0 AS depth,\n" +
                "         CAST(name AS VARCHAR(1000)) AS path\n" +
                "  FROM employees WHERE manager_id IS NULL          -- anchor: the CEO\n" +
                "  UNION ALL\n" +
                "  SELECT e.id, e.name, e.manager_id, c.depth + 1,\n" +
                "         CAST(c.path || ' > ' || e.name AS VARCHAR(1000))\n" +
                "  FROM employees e JOIN chain c ON e.manager_id = c.id\n" +
                ")\n" +
                "SELECT depth, path FROM chain ORDER BY path;" },
              { t: "table", headers: ["depth", "path"], rows: [
                ["0", "Ines"],
                ["1", "Ines &gt; Raj"],
                ["2", "Ines &gt; Raj &gt; Mei"],
                ["1", "Ines &gt; Tom"]
              ] },
              { t: "h", text: "Cycle protection" },
              { t: "p", html: "Org charts are trees; follow graphs, bill-of-materials errors and bad data are not. A cycle makes the recursion run until the engine's limit or forever. <strong>UNION instead of UNION ALL is not enough</strong>: it only drops rows identical in every column, and once you carry depth or path, rows never repeat exactly." },
              { t: "code", lang: "sql", code:
                "-- PostgreSQL: carry visited nodes as an array\n" +
                "WITH RECURSIVE reach AS (\n" +
                "  SELECT followee AS node, ARRAY[follower, followee] AS seen, 1 AS depth\n" +
                "  FROM follows WHERE follower = 42\n" +
                "  UNION ALL\n" +
                "  SELECT f.followee, r.seen || f.followee, r.depth + 1\n" +
                "  FROM follows f JOIN reach r ON f.follower = r.node\n" +
                "  WHERE f.followee <> ALL (r.seen)        -- stop at revisits\n" +
                "    AND r.depth < 6                       -- backstop\n" +
                ")\n" +
                "SELECT DISTINCT node FROM reach;\n" +
                "-- PostgreSQL 14+: CYCLE node SET is_cycle USING path" },
              { t: "table", headers: ["Engine", "Built-in guard"], rows: [
                ["SQL Server", "MAXRECURSION hint, default 100 levels (0 = unlimited)"],
                ["MySQL 8", "<code class='tok'>cte_max_recursion_depth</code>, default 1000"],
                ["PostgreSQL", "No depth limit by default; CYCLE and SEARCH clauses since 14"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Recursive CTEs are level-at-a-time loops.</strong> Deep or wide graphs can explode in intermediate rows. For hot hierarchy queries, consider a closure table, materialized paths (for example Postgres <code class='tok'>ltree</code>) or nested sets, trading write complexity for cheap reads." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"all reports under a manager\", \"category tree\", \"path from A to B\", \"fill in missing dates\", \"generate numbers 1 to N\", \"bill of materials\". Say anchor, recursive step, termination and cycle guard in that order." },
              { t: "note", variant: "key", html: "<strong>Recursive CTE = anchor UNION ALL step, repeated until a step returns nothing.</strong> Always state the termination condition and a cycle guard (visited path plus depth cap); UNION alone does not stop cycles." }
            ]
          },
          {
            id: "set-operations",
            title: "Set operations and duplicate semantics",
            summary: "UNION vs UNION ALL, INTERSECT and EXCEPT, the ALL variants as multiset math, NULLs in set comparisons and reconciliation queries.",
            minutes: 8,
            tags: ["union", "intersect", "except", "duplicates"],
            blocks: [
              { t: "p", html: "Set operators stack result sets <em>vertically</em>, matched by <strong>column position</strong>, not name. The key question every time: <strong>should duplicates survive?</strong> The bare operators answer \"no\" (set semantics); the <code class='tok'>ALL</code> variants answer \"yes\" (multiset semantics)." },
              { t: "code", lang: "sql", code:
                "-- A: 1, 1, 2, NULL      B: 1, 3, NULL\n" +
                "SELECT v FROM a UNION         SELECT v FROM b;  -- 1, 2, 3, NULL\n" +
                "SELECT v FROM a UNION ALL     SELECT v FROM b;  -- 7 rows\n" +
                "SELECT v FROM a INTERSECT     SELECT v FROM b;  -- 1, NULL\n" +
                "SELECT v FROM a EXCEPT        SELECT v FROM b;  -- 2\n" +
                "SELECT v FROM a INTERSECT ALL SELECT v FROM b;  -- 1, NULL\n" +
                "SELECT v FROM a EXCEPT ALL    SELECT v FROM b;  -- 1, 2" },
              { t: "table", headers: ["Operator", "Row with m copies in A, n in B appears", "Cost note"], rows: [
                ["UNION", "1 time if m + n &gt; 0", "Dedup needs a sort or hash over everything"],
                ["UNION ALL", "m + n times", "Plain concatenation, streams"],
                ["INTERSECT", "1 time if m &gt; 0 and n &gt; 0", "Dedup + match"],
                ["INTERSECT ALL", "min(m, n) times", "Not supported everywhere (Postgres yes)"],
                ["EXCEPT (Oracle: MINUS)", "1 time if m &gt; 0 and n = 0", "Dedup + anti-match"],
                ["EXCEPT ALL", "max(m − n, 0) times", "Not supported everywhere"]
              ] },
              { t: "note", variant: "trap", html: "<strong>UNION by reflex drops real data.</strong> Two identical $10 payments from the same customer on the same day are two payments. Combining payment sources with UNION silently merges them. Default to UNION ALL and dedupe deliberately." },
              { t: "h", text: "NULLs behave differently here" },
              { t: "p", html: "In a WHERE clause <code class='tok'>NULL = NULL</code> is UNKNOWN. Set operators, DISTINCT and GROUP BY instead treat two NULLs as <em>not distinct</em>, which is why NULL appears in the INTERSECT result above. So <code class='tok'>EXCEPT</code> handles NULL columns gracefully where a hand-written <code class='tok'>NOT EXISTS ... WHERE a.col = b.col</code> would not (unless you use <code class='tok'>IS NOT DISTINCT FROM</code>)." },
              { t: "h", text: "Reconciliation: are these two tables the same?" },
              { t: "code", lang: "sql", code:
                "-- rows in one table but not the other, labelled\n" +
                "(SELECT 'only_in_src' AS side, s.* FROM (SELECT * FROM src EXCEPT SELECT * FROM dst) s)\n" +
                "UNION ALL\n" +
                "(SELECT 'only_in_dst', d.* FROM (SELECT * FROM dst EXCEPT SELECT * FROM src) d);\n" +
                "-- empty result + equal COUNT(*) => same set of rows.\n" +
                "-- use EXCEPT ALL (where supported) if duplicate counts must also match" },
              { t: "h", text: "Rules that trip people" },
              { t: "ul", items: [
                "Column count must match and types must be compatible; output column names come from the <strong>first</strong> query.",
                "A single ORDER BY / LIMIT at the end applies to the whole combined result. To sort or limit one branch, wrap it in parentheses or a subquery.",
                "In standard SQL and Postgres, INTERSECT binds tighter than UNION and EXCEPT; parenthesize instead of relying on it.",
                "<code class='tok'>OR</code> across different columns can often be rewritten as UNION of two index-friendly queries (see the sargability lesson)."
              ] },
              { t: "compare",
                bad: { title: "Typical slip", items: [
                  "UNION to combine two event logs",
                  "Identical rows collapse; counts come out low",
                  "Extra sort or hash over the full result"] },
                good: { title: "Deliberate choice", items: [
                  "UNION ALL by default",
                  "UNION only when the spec says distinct",
                  "EXCEPT / INTERSECT for diffing whole rows, NULL-safe"] } },
              { t: "note", variant: "key", html: "<strong>Bare set operators remove duplicates; ALL variants do multiset arithmetic.</strong> Default to UNION ALL, and remember set operators treat NULLs as equal, which makes EXCEPT a clean NULL-safe diff." }
            ]
          },
          {
            id: "null-semantics",
            title: "NULL and three-valued logic",
            summary: "TRUE, FALSE and UNKNOWN; the NOT IN trap; COUNT(*) vs COUNT(col); NULLs in aggregates, GROUP BY, ORDER BY and outer joins.",
            minutes: 10,
            tags: ["null", "three-valued-logic", "not-in", "aggregates"],
            blocks: [
              { t: "p", html: "NULL means <strong>unknown or missing</strong>, not zero and not empty string. Any comparison with it yields a third truth value, <strong>UNKNOWN</strong>. WHERE, JOIN ON and HAVING keep a row only when the condition is TRUE, so UNKNOWN behaves like FALSE there. (A CHECK constraint is the opposite: it rejects only FALSE, so UNKNOWN passes.)" },
              { t: "table", headers: ["Expression", "Result", "Why"], rows: [
                ["NULL = NULL", "UNKNOWN", "Two unknowns are not known to be equal"],
                ["NULL &lt;&gt; 5", "UNKNOWN", "Might or might not differ"],
                ["TRUE AND UNKNOWN", "UNKNOWN", "Depends on the unknown"],
                ["FALSE AND UNKNOWN", "FALSE", "FALSE wins AND regardless"],
                ["TRUE OR UNKNOWN", "TRUE", "TRUE wins OR regardless"],
                ["NOT UNKNOWN", "UNKNOWN", "Negating unknown is still unknown"],
                ["NULL IS NULL", "TRUE", "IS tests are two-valued"]
              ] },
              { t: "h", text: "The NOT IN trap" },
              { t: "code", lang: "sql", code:
                "-- managers: 7, 9, NULL\n" +
                "SELECT name FROM emp\n" +
                "WHERE id NOT IN (SELECT manager_id FROM emp);   -- returns ZERO rows\n\n" +
                "-- id NOT IN (7, 9, NULL)\n" +
                "-- = id <> 7 AND id <> 9 AND id <> NULL\n" +
                "-- = ...      AND ...    AND UNKNOWN   -> never TRUE\n\n" +
                "SELECT name FROM emp e\n" +
                "WHERE NOT EXISTS (SELECT 1 FROM emp m WHERE m.manager_id = e.id);  -- correct" },
              { t: "note", variant: "trap", html: "<strong>One NULL in a NOT IN list empties the result.</strong> IN is safe (a NULL just never matches), NOT IN is not. Prefer NOT EXISTS, or add <code class='tok'>WHERE manager_id IS NOT NULL</code> inside the subquery." },
              { t: "h", text: "Aggregates and NULL" },
              { t: "code", lang: "sql", code:
                "-- bonus values: 100, NULL, 300, NULL\n" +
                "SELECT COUNT(*)            AS rows_,      -- 4\n" +
                "       COUNT(bonus)        AS non_null,   -- 2\n" +
                "       COUNT(DISTINCT bonus) AS distinct_, -- 2\n" +
                "       SUM(bonus)          AS total,      -- 400\n" +
                "       AVG(bonus)          AS avg_,       -- 200  (400 / 2, not / 4)\n" +
                "       AVG(COALESCE(bonus, 0)) AS avg_all -- 100\n" +
                "FROM staff;" },
              { t: "ul", items: [
                "Aggregates other than COUNT(*) skip NULLs. SUM over zero non-NULL values returns <strong>NULL</strong>, not 0: wrap in COALESCE for reports.",
                "Decide whether a NULL bonus means \"no bonus\" (treat as 0) or \"unknown\" (exclude). The two averages above differ by 2x.",
                "<code class='tok'>NULLIF(denominator, 0)</code> turns divide-by-zero into NULL instead of an error."
              ] },
              { t: "h", text: "GROUP BY, ORDER BY and DISTINCT" },
              { t: "table", headers: ["Context", "NULL behaviour"], rows: [
                ["GROUP BY / DISTINCT", "All NULLs form one group (treated as not distinct)"],
                ["ORDER BY in PostgreSQL, Oracle", "NULLs sort as larger than everything: last in ASC, first in DESC"],
                ["ORDER BY in MySQL, SQL Server, SQLite", "NULLs sort as smaller: first in ASC"],
                ["Explicit control", "<code class='tok'>NULLS FIRST</code> / <code class='tok'>NULLS LAST</code> in Postgres, Oracle, SQLite 3.30+, Snowflake; emulate with <code class='tok'>ORDER BY col IS NULL, col</code> in MySQL"],
                ["Unique constraints", "Most engines allow many NULLs in a UNIQUE column; SQL Server allows one"]
              ] },
              { t: "h", text: "Outer joins that quietly become inner joins" },
              { t: "compare",
                bad: { title: "Filter in WHERE", items: [
                  "LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid'",
                  "Customers without orders have o.status NULL, the test is UNKNOWN, and they vanish: you wrote an inner join"] },
                good: { title: "Filter in ON", items: [
                  "LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'",
                  "Every customer survives; only paid orders attach"] } },
              { t: "p", html: "For NULL-safe equality use <code class='tok'>a IS NOT DISTINCT FROM b</code> (standard; Postgres, Snowflake, SQL Server 2022+) or MySQL's <code class='tok'>a &lt;=&gt; b</code>. Beware that some engines (Postgres among them) cannot use a plain B-tree index for it; when it matters, compare with explicit <code class='tok'>(a = b OR (a IS NULL AND b IS NULL))</code>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"customers who never ...\", \"not in the list\", \"average including those with none\", \"some values are missing\", \"sorted with blanks at the end\". Ask out loud whether the column is nullable before writing NOT IN or AVG." },
              { t: "quiz", id: "sql-ctes" },
              { t: "note", variant: "key", html: "<strong>Comparisons with NULL are UNKNOWN, and filters keep only TRUE.</strong> That single rule explains the NOT IN trap, outer joins collapsing under WHERE, and AVG ignoring NULLs. Use NOT EXISTS, IS [NOT] DISTINCT FROM and COALESCE on purpose." }
            ]
          }
        ]
      },
      {
        id: "perf",
        name: "Performance & Interview Patterns",
        icon: "bolt",
        lessons: [
          {
            id: "sargable-rewrites",
            title: "Sargable predicates: writing filters an index can use",
            summary: "Why functions, casts, leading wildcards and arithmetic on columns force scans, and the rewrites that restore index seeks.",
            minutes: 10,
            tags: ["sargable", "indexes", "rewrites"],
            blocks: [
              { t: "p", html: "A predicate is <strong>sargable</strong> (Search ARGument-able) when the engine can turn it into a seek on an index: a starting key and a stopping key in the index's sort order. The mental model: <strong>the index is sorted by the raw column value</strong>. Anything that transforms that value before comparing destroys the order the index gives you." },
              { t: "stat", items: [
                { v: "3–4", k: "B-tree levels for ~100M rows (typical)" },
                { v: "~4 pages", k: "to seek one key" },
                { v: "every page", k: "read by a full scan" }
              ] },
              { t: "h", text: "The usual suspects" },
              { t: "table", headers: ["Pattern", "Not sargable", "Sargable rewrite"], rows: [
                ["Function on column", "<code class='tok'>YEAR(created_at) = 2025</code>", "<code class='tok'>created_at &gt;= '2025-01-01' AND created_at &lt; '2026-01-01'</code>"],
                ["Date truncation", "<code class='tok'>DATE(ts) = '2025-06-01'</code>", "<code class='tok'>ts &gt;= '2025-06-01' AND ts &lt; '2025-06-02'</code>"],
                ["Arithmetic", "<code class='tok'>price * 1.2 &gt; 120</code>", "<code class='tok'>price &gt; 100</code>"],
                ["Case folding", "<code class='tok'>LOWER(email) = 'a@x.example'</code>", "Expression index on LOWER(email), or a case-insensitive collation / citext"],
                ["Implicit cast", "<code class='tok'>varchar_col = 5551234</code>", "<code class='tok'>varchar_col = '5551234'</code> (match the column type)"],
                ["Leading wildcard", "<code class='tok'>name LIKE '%son'</code>", "Reversed-string index, trigram index, or full-text search"],
                ["NULL-coalescing", "<code class='tok'>COALESCE(status, 'new') = 'new'</code>", "<code class='tok'>(status = 'new' OR status IS NULL)</code>"]
              ] },
              { t: "widget", id: "sqlSargable" },
              { t: "h", text: "Implicit casts: the invisible function" },
              { t: "p", html: "When types differ, the engine inserts a conversion. If it converts the <em>constant</em>, all is well. If it converts the <em>column</em>, you have a function on every row. MySQL converts a string column compared with a number to a number, which skips the index. SQL Server converts by data-type precedence, so a <code class='tok'>VARCHAR</code> column compared with an <code class='tok'>NVARCHAR</code> parameter (a common driver default) can turn a seek into a scan. Postgres mostly refuses mismatched comparisons outright." },
              { t: "code", lang: "sql", code:
                "-- MySQL: compare plans\n" +
                "EXPLAIN SELECT * FROM users WHERE phone = 5551234;    -- type: ALL (full scan)\n" +
                "EXPLAIN SELECT * FROM users WHERE phone = '5551234';  -- type: ref (index lookup)" },
              { t: "h", text: "When you cannot rewrite: index the expression" },
              { t: "code", lang: "sql", code:
                "-- PostgreSQL\n" +
                "CREATE INDEX idx_users_email_lower ON users (LOWER(email));\n" +
                "SELECT * FROM users WHERE LOWER(email) = 'ana@x.example';   -- seeks\n\n" +
                "-- MySQL 8.0.13+ functional index\n" +
                "CREATE INDEX idx_orders_year ON orders ((YEAR(created_at)));" },
              { t: "p", html: "The query must use the <em>exact</em> indexed expression. The cost is another index to maintain on every write and more space, so prefer the plain rewrite when one exists." },
              { t: "note", variant: "warn", html: "<strong>Prefix LIKE has a collation catch.</strong> <code class='tok'>LIKE 'Joh%'</code> is a range in MySQL. In Postgres a B-tree on a text column with a non-C collation cannot serve LIKE; create it with <code class='tok'>text_pattern_ops</code> (or use the C collation) to get the seek." },
              { t: "h", text: "OR across columns" },
              { t: "p", html: "<code class='tok'>customer_id = 42 OR referrer_id = 42</code> cannot use one composite index for both branches. Postgres may combine two single-column indexes with a BitmapOr, and MySQL may use index merge, but a plan you can rely on is two indexed queries joined with UNION (or UNION ALL plus an exclusion predicate on the second branch)." },
              { t: "table", headers: ["Tier", "Answer to \"this query is slow\""], rows: [
                ["Naive", "\"Add an index on created_at\" (already exists; the function still blocks it)"],
                ["Solid", "Reads the plan, spots the function on the column, rewrites to a half-open range"],
                ["Standout", "Also checks parameter types from the driver, collation for LIKE, and whether an expression index is worth its write cost"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"index exists but the query still scans\", \"filter by month / year / day\", \"case-insensitive lookup\", \"search names ending in\", \"fast in the console, slow from the app\" (parameter type mismatch)." },
              { t: "note", variant: "key", html: "<strong>Leave the indexed column bare on one side of the comparison.</strong> Move functions, arithmetic and casts onto the constant side; if you cannot, index the exact expression and accept the write cost." }
            ]
          },
          {
            id: "semi-anti-joins",
            title: "EXISTS vs IN vs JOIN: semi-joins and anti-joins",
            summary: "Which form returns what, how optimizers plan them, why JOIN duplicates rows and why NOT IN is the dangerous anti-join.",
            minutes: 9,
            tags: ["exists", "in", "semi-join", "anti-join"],
            blocks: [
              { t: "p", html: "A <strong>semi-join</strong> returns rows from the left side that have <em>at least one</em> match on the right, each left row at most once. An <strong>anti-join</strong> returns left rows with <em>no</em> match. SQL has no SEMI JOIN keyword; you express them with EXISTS, IN, or a join plus tricks, and the optimizer recognizes the pattern." },
              { t: "h", text: "Semi-join: customers who have ordered" },
              { t: "code", lang: "sql", code:
                "-- 1. EXISTS: clear intent, stops at the first match\n" +
                "SELECT c.* FROM customers c\n" +
                "WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);\n\n" +
                "-- 2. IN: same result; NULLs on the right are harmless here\n" +
                "SELECT c.* FROM customers c\n" +
                "WHERE c.id IN (SELECT customer_id FROM orders);\n\n" +
                "-- 3. JOIN: duplicates one row per matching order!\n" +
                "SELECT c.* FROM customers c JOIN orders o ON o.customer_id = c.id;\n" +
                "-- needs DISTINCT (extra sort/hash) to be correct" },
              { t: "h", text: "Anti-join: customers who never ordered" },
              { t: "code", lang: "sql", code:
                "-- 1. NOT EXISTS: correct with NULLs, planned as an anti-join\n" +
                "SELECT c.* FROM customers c\n" +
                "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);\n\n" +
                "-- 2. LEFT JOIN ... IS NULL: also correct; test a NOT NULL column of o\n" +
                "SELECT c.* FROM customers c\n" +
                "LEFT JOIN orders o ON o.customer_id = c.id\n" +
                "WHERE o.id IS NULL;\n\n" +
                "-- 3. NOT IN: wrong as soon as orders.customer_id has a NULL\n" +
                "SELECT c.* FROM customers c\n" +
                "WHERE c.id NOT IN (SELECT customer_id FROM orders);" },
              { t: "table", headers: ["Form", "Duplicates?", "NULL-safe?", "Typical plan"], rows: [
                ["EXISTS", "No", "Yes", "Semi-join (hash, merge or nested loop with early exit)"],
                ["IN (subquery)", "No", "Yes", "Usually converted to a semi-join"],
                ["JOIN", "Yes, one per match", "n/a", "Inner join; DISTINCT adds a sort/hash"],
                ["NOT EXISTS", "No", "Yes", "Anti-join"],
                ["LEFT JOIN ... IS NULL", "No (if the IS NULL column is non-nullable)", "Yes", "Anti-join or outer join + filter"],
                ["NOT IN (subquery)", "No", "<strong>No</strong>", "Postgres: hashed or per-row subplan, not a true anti-join, unless both sides are known NOT NULL"]
              ] },
              { t: "note", variant: "trap", html: "<strong>NOT IN is slow and wrong for the same reason.</strong> Because a single NULL must flip the whole answer to empty, many optimizers cannot rewrite NOT IN into a plain anti-join when the column is nullable. NOT EXISTS has no such constraint." },
              { t: "h", text: "Does EXISTS beat IN?" },
              { t: "p", html: "Folklore says yes; modern optimizers mostly say \"same plan\". Postgres, SQL Server and Oracle convert both into semi-joins; MySQL 8 does so for IN and, since 8.0.16, for EXISTS too. Older MySQL versions ran some IN subqueries as dependent subqueries per row, which is where the folklore comes from. The answer that scores: <em>they are usually equivalent for semi-joins; I check the plan, and I always use NOT EXISTS rather than NOT IN for anti-joins.</em>" },
              { t: "h", text: "When JOIN is the right tool" },
              { t: "ul", items: [
                "You need columns from the right side (order totals, not just \"has ordered\").",
                "The relationship is guaranteed one-to-one or many-to-one (joining orders to their single customer).",
                "You aggregate after joining anyway: <code class='tok'>GROUP BY c.id</code> collapses the duplicates for a reason."
              ] },
              { t: "compare",
                bad: { title: "JOIN + DISTINCT as a semi-join", items: [
                  "Builds every customer-order pair, then removes duplicates",
                  "DISTINCT also merges legitimately identical customer rows",
                  "Hides the intent from the reader"] },
                good: { title: "EXISTS", items: [
                  "States the question: is there at least one order?",
                  "Engine can stop at the first match per customer",
                  "Index on orders(customer_id) makes each probe cheap"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"who have at least one\", \"who never\", \"without any\", \"not present in\", \"list each customer once\". Semi-join means EXISTS or IN; anti-join means NOT EXISTS or LEFT JOIN ... IS NULL." },
              { t: "note", variant: "key", html: "<strong>EXISTS/IN for semi-joins, NOT EXISTS for anti-joins, JOIN only when you need the other side's columns.</strong> JOIN multiplies rows, and NOT IN collapses to empty on a single NULL." }
            ]
          },
          {
            id: "interview-patterns",
            title: "Classic SQL interview problems, solved properly",
            summary: "Second-highest salary, dedupe keeping the latest, retention cohorts, median, consecutive days and running balance, with the clarifying questions that earn credit.",
            minutes: 14,
            tags: ["interview", "patterns", "cohorts", "median", "dedupe"],
            blocks: [
              { t: "p", html: "These six problems recur because each tests one idea under pressure: ties, determinism, date bucketing, ordered aggregates, islands, frames. Before writing, say the <strong>clarifying question</strong> out loud; that alone separates candidates." },
              { t: "h", text: "1. Nth-highest salary (here, second)" },
              { t: "code", lang: "sql", code:
                "-- Clarify: distinct values? what if there is no second? per department?\n" +
                "SELECT MAX(salary) AS second_highest           -- returns NULL if none exists\n" +
                "FROM emp\n" +
                "WHERE salary < (SELECT MAX(salary) FROM emp);\n\n" +
                "-- generalizes to N and to per-group:\n" +
                "SELECT dept, salary FROM (\n" +
                "  SELECT dept, salary,\n" +
                "         DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS dr\n" +
                "  FROM emp\n" +
                ") t WHERE dr = 2;\n\n" +
                "-- salaries 100, 100, 90: DENSE_RANK gives 90 rank 2.\n" +
                "-- ORDER BY salary DESC LIMIT 1 OFFSET 1 returns 100 (ties), and returns\n" +
                "-- no row at all (not NULL) when only one salary exists." },
              { t: "h", text: "2. Deduplicate, keeping the latest row" },
              { t: "code", lang: "sql", code:
                "WITH ranked AS (\n" +
                "  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id\n" +
                "                                ORDER BY updated_at DESC, id DESC) AS rn\n" +
                "  FROM user_profiles\n" +
                ")\n" +
                "DELETE FROM user_profiles\n" +
                "WHERE id IN (SELECT id FROM ranked WHERE rn > 1);\n" +
                "-- read-only variant: SELECT ... WHERE rn = 1 (or QUALIFY rn = 1)" },
              { t: "note", variant: "tip", html: "<strong>Deterministic survivor, durable fix.</strong> The <code class='tok'>id DESC</code> tiebreaker picks the same survivor every run when two rows share a timestamp. On a big table, deleting most rows is usually slower than <code class='tok'>CREATE TABLE ... AS SELECT</code> the survivors and swapping; say so, then add a unique constraint so duplicates cannot return." },
              { t: "h", text: "3. Retention by signup cohort" },
              { t: "code", lang: "sql", code:
                "WITH cohort AS (\n" +
                "  SELECT user_id, DATE_TRUNC('month', MIN(event_date)) AS cohort_month\n" +
                "  FROM events GROUP BY user_id\n" +
                "), activity AS (\n" +
                "  SELECT DISTINCT e.user_id, c.cohort_month,\n" +
                "         (EXTRACT(YEAR FROM e.event_date) - EXTRACT(YEAR FROM c.cohort_month)) * 12\n" +
                "       + (EXTRACT(MONTH FROM e.event_date) - EXTRACT(MONTH FROM c.cohort_month)) AS month_n\n" +
                "  FROM events e JOIN cohort c USING (user_id)\n" +
                ")\n" +
                "SELECT cohort_month, month_n,\n" +
                "       COUNT(*) AS active_users,\n" +
                "       ROUND(100.0 * COUNT(*) / FIRST_VALUE(COUNT(*)) OVER (\n" +
                "             PARTITION BY cohort_month ORDER BY month_n), 1) AS retention_pct\n" +
                "FROM activity\n" +
                "GROUP BY cohort_month, month_n\n" +
                "ORDER BY cohort_month, month_n;\n" +
                "-- 2025-01 | 0 | 1000 | 100.0\n" +
                "-- 2025-01 | 1 |  420 |  42.0\n" +
                "-- 2025-01 | 2 |  310 |  31.0\n" +
                "-- FIRST_VALUE is safe with the default frame (it starts at the partition start).\n" +
                "-- Clarify: what counts as active, and is the denominator cohort size or month-0 actives?" },
              { t: "h", text: "4. Median" },
              { t: "code", lang: "sql", code:
                "-- Postgres, Oracle, Snowflake, SQL Server (as a window), DuckDB\n" +
                "SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) AS median FROM orders;\n\n" +
                "-- portable fallback: average the middle one or two rows\n" +
                "SELECT AVG(amount) AS median FROM (\n" +
                "  SELECT amount,\n" +
                "         ROW_NUMBER() OVER (ORDER BY amount) AS rn,\n" +
                "         COUNT(*) OVER ()                   AS n\n" +
                "  FROM orders WHERE amount IS NOT NULL\n" +
                ") t\n" +
                "WHERE rn IN ((n + 1) / 2, (n + 2) / 2);   -- integer division\n" +
                "-- n = 5 -> positions 3 and 3; n = 6 -> positions 3 and 4 (averaged).\n" +
                "-- PERCENTILE_DISC returns an actual data value instead of interpolating." },
              { t: "h", text: "5. Users active N consecutive days" },
              { t: "code", lang: "sql", code:
                "WITH d AS (SELECT DISTINCT user_id, CAST(event_ts AS DATE) AS day FROM events),\n" +
                "g AS (\n" +
                "  SELECT user_id, day,\n" +
                "         day - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS int) AS grp\n" +
                "  FROM d\n" +
                ")\n" +
                "SELECT DISTINCT user_id\n" +
                "FROM g GROUP BY user_id, grp\n" +
                "HAVING COUNT(*) >= 3;\n" +
                "-- fixed-N shortcut on deduplicated days:\n" +
                "--   LEAD(day, 2) OVER (PARTITION BY user_id ORDER BY day) = day + 2" },
              { t: "h", text: "6. Running balance" },
              { t: "code", lang: "sql", code:
                "SELECT account_id, txn_ts, amount,\n" +
                "       SUM(amount) OVER (PARTITION BY account_id\n" +
                "                         ORDER BY txn_ts, txn_id\n" +
                "                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance\n" +
                "FROM ledger_entries\n" +
                "ORDER BY account_id, txn_ts, txn_id;\n" +
                "-- two entries at 09:00: the default RANGE frame would show 300 on both,\n" +
                "-- and without txn_id the intermediate balance could be 500 or -200." },
              { t: "table", headers: ["txn_ts", "amount", "balance"], rows: [
                ["09:00", "+500", "500"],
                ["09:00", "−200", "300"],
                ["12:30", "−50", "250"],
                ["17:10", "+120", "370"]
              ] },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the bar requires"], rows: [
                ["Mid", "Correct result on the happy path; uses window functions instead of self-joins; readable CTE steps"],
                ["Senior", "Asks about ties, NULLs and empty results first; deterministic tiebreakers; explicit frames; knows which forms are sargable"],
                ["Staff", "All of the above plus cost: indexes that support the window sort, when to precompute (cohort tables, summary rollups), engine differences, and how to keep duplicates from coming back"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"second highest\" (ties, empty), \"remove duplicates\" (which survivor), \"retention\" (cohort + offset), \"median\" (ordered set aggregate), \"consecutive\" (islands), \"balance\" or \"cumulative\" (ROWS frame + tiebreaker)." },
              { t: "quiz", id: "sql-perf" },
              { t: "note", variant: "key", html: "<strong>Every classic problem hides one trap: ties, NULLs, empty results or frame defaults.</strong> Name the trap before you write the query, use a deterministic tiebreaker, and state the frame explicitly." }
            ]
          }
        ]
      }
    ]
  };
})();
