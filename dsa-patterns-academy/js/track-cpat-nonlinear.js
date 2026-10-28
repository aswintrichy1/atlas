/* =====================================================================
   CODEX · Advanced Coding Patterns — non-linear modules
   window.TRACKS.cpat  ·  modules: graphs, structures

   The families the rest of this app never reaches: weighted-graph
   algorithms and ordering, the DP taxonomy, range structures, and the
   design/simulation category.

   Self-contained: registers its own widgets and quizzes. A sibling file
   owns this track's metadata and its other modules, so every shared
   namespace is MERGED and the module list is only ever PUSHED to.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     DOM helpers — local to this file, ES5 safe, no dependencies
     ================================================================= */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var k, i, kid;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (attrs[k] == null) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
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

  /* one readout cell: label + emphasised value */
  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  /* a plain sentence inside the readout */
  function roText(text) {
    return h("span", { class: "ro" }, text);
  }

  function segRow(labels, active, onPick) {
    var wrap = h("div", { class: "w-seg" });
    var made = [];
    var i;
    function attach(button, idx) {
      button.addEventListener("click", function () {
        var j;
        for (j = 0; j < made.length; j++) made[j].className = "w-seg-btn";
        button.className = "w-seg-btn active";
        onPick(idx);
      });
    }
    for (i = 0; i < labels.length; i++) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (i === active ? " active" : "") }, labels[i]);
      attach(b, i);
      made.push(b);
      wrap.appendChild(b);
    }
    return wrap;
  }

  function numField(label, value, onChange) {
    var input = h("input", { type: "number", min: "0", value: String(value) });
    function fire() { onChange(input.value); }
    input.addEventListener("input", fire);
    input.addEventListener("change", fire);
    return h("label", { class: "w-field" }, label + " ", input);
  }

  /* compact operation-count formatter */
  function fmt(x) {
    if (x == null || !isFinite(x)) return "\u2014";
    if (x >= 1e12) return (x / 1e12).toFixed(1) + "T";
    if (x >= 1e9) return (x / 1e9).toFixed(1) + "B";
    if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
    if (x >= 1e3) return (x / 1e3).toFixed(1) + "K";
    return String(Math.round(x));
  }

  function log2(x) {
    return Math.log(Math.max(x, 2)) / Math.LN2;
  }

  var Widgets = {};

  /* =================================================================
     WIDGET 1 — cpatPathLab · "Which search, and why?"
     -----------------------------------------------------------------
     Three inputs: edge-weight character, what is actually being asked,
     and graph size. Deterministic, no timers. Refuses Dijkstra the
     moment a negative weight is possible.
     ================================================================= */
  var PATH_WEIGHTS = ["all equal", "non-negative", "some negative"];
  var PATH_GOALS = ["any path", "shortest path", "all shortest distances"];
  var AVG_DEGREE = 4;   /* E ~ 4V — a sparse graph, the common case */

  function pathPlan(wIdx, gIdx, n) {
    var e = n * AVG_DEGREE;
    var lg = log2(n);

    if (gIdx === 0) {
      return {
        algo: "DFS (or BFS)",
        big: "O(V + E)",
        ops: n + e,
        why: "Reachability does not care what the edges cost, so a heap (Dijkstra) or V\u22121 relaxation rounds (Bellman\u2013Ford) would be paid for and never used."
      };
    }

    var scope = gIdx === 1
      ? "and you may stop the moment the target is settled"
      : "and you must run to completion, because every node needs a final distance";

    if (wIdx === 0) {
      return {
        algo: "BFS",
        big: "O(V + E)",
        ops: n + e,
        why: "Equal weights mean ring order is distance order, so the first touch of a node is already optimal " + scope + ". Dijkstra returns the same answer and charges a log V factor for it."
      };
    }
    if (wIdx === 1) {
      return {
        algo: "Dijkstra + binary heap",
        big: "O((V + E) log V)",
        ops: (n + e) * lg,
        why: "Weights differ, so BFS's ring order no longer tracks distance " + scope + ". Bellman\u2013Ford is also correct but costs O(V\u00b7E); you only need it once a weight can go negative."
      };
    }
    return {
      algo: "Bellman\u2013Ford",
      big: "O(V \u00b7 E)",
      ops: n * e,
      why: "Dijkstra is refused here: a negative edge can make an already-settled node cheaper later, which destroys the finality of the pop. Bellman\u2013Ford relaxes every edge V\u22121 times, and one extra round tells you whether a negative cycle exists at all."
    };
  }

  Widgets.cpatPathLab = function (mount) {
    shell(mount, "decision lab", "Which search, and why?",
      "Set what the edges cost, what you are actually being asked for, and how big the graph is. The lab names the algorithm that is correct here \u2014 and says why the others are not.");

    var wIdx = 0;
    var gIdx = 1;
    var nodes = 20000;
    var valid = true;

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function render() {
      var plan = pathPlan(wIdx, gIdx, valid ? nodes : 2);
      clear(readout);
      readout.appendChild(ro("edges:", PATH_WEIGHTS[wIdx] + "  \u00b7  asked for: " + PATH_GOALS[gIdx]));
      readout.appendChild(ro("use", plan.algo));
      readout.appendChild(ro("cost", plan.big));
      if (valid) {
        readout.appendChild(ro("V = " + fmt(nodes) + ", E \u2248 " + fmt(nodes * AVG_DEGREE) + " \u2192 ops \u2248", fmt(plan.ops)));
      } else {
        readout.appendChild(ro("node count", "give a whole number from 2 to 5,000,000"));
      }
      readout.appendChild(roText(plan.why));
    }

    function setNodes(raw) {
      var p = parseInt(String(raw), 10);
      if (isNaN(p) || p < 2 || p > 5000000) valid = false;
      else { valid = true; nodes = p; }
      render();
    }

    stage.appendChild(h("p", { class: "widget-desc" }, "edge weights"));
    stage.appendChild(segRow(PATH_WEIGHTS, wIdx, function (i) { wIdx = i; render(); }));
    stage.appendChild(h("p", { class: "widget-desc" }, "what the question asks for"));
    stage.appendChild(segRow(PATH_GOALS, gIdx, function (i) { gIdx = i; render(); }));
    stage.appendChild(numField("approximate node count", nodes, setNodes));

    mount.appendChild(stage);
    mount.appendChild(readout);
    render();
  };

  /* =================================================================
     WIDGET 2 — cpatRangeLab · "Prefix array, Fenwick, or segment tree?"
     -----------------------------------------------------------------
     Counts operations for all three under a stated cost model, so the
     static prefix array visibly wins with no updates and visibly
     collapses when every operation mutates the array.
     ================================================================= */
  var UPDATE_MIX = ["never", "occasional", "every operation"];

  function rangePlan(n, q, uIdx) {
    var updates = uIdx === 0 ? 0 : (uIdx === 1 ? Math.ceil(q / 10) : q);
    var lg = log2(n);

    /* prefix array: O(n) build, O(1) query, O(n) to repair after a write */
    var prefix = n + q + updates * n;
    /* Fenwick: O(n) build, ~log n per query and per update */
    var fen = n + (q + updates) * lg;
    /* segment tree: O(n) build over ~2n nodes, two descents per query */
    var seg = 2 * n + q * 2 * lg + updates * lg;

    var best = "prefix array", bestOps = prefix, mem = "n + 1 numbers";
    if (fen < bestOps) { best = "Fenwick tree"; bestOps = fen; mem = "n + 1 numbers"; }
    if (seg < bestOps) { best = "segment tree"; bestOps = seg; mem = "\u2248 2n numbers (4n with the recursive layout)"; }

    var note;
    if (updates === 0) {
      note = "With zero updates the prefix array's only weakness never fires: build once in O(n), then every query is one subtraction. Paying log n per query for a tree here is pure loss.";
    } else if (uIdx === 2) {
      note = "Every operation writes, so the prefix array pays an O(n) repair each time and collapses. Both trees absorb the write in O(log n) \u2014 that gap is the whole reason they exist.";
    } else {
      note = "Updates are rare but real. Compare honestly: the prefix array is only ahead while updates \u00d7 n stays under queries \u00d7 log n.";
    }
    if (best === "Fenwick tree") {
      note += " Fenwick wins on constant factor, but it only does invertible prefix aggregates \u2014 switch to a segment tree the moment you need range min, max or gcd.";
    }

    return {
      updates: updates, prefix: prefix, fen: fen, seg: seg,
      best: best, bestOps: bestOps, mem: mem, note: note
    };
  }

  Widgets.cpatRangeLab = function (mount) {
    shell(mount, "decision lab", "Prefix array, Fenwick, or segment tree?",
      "Three structures answer the same range query at very different prices. Set the shape of your workload and watch which one is actually cheapest.");

    var n = 100000;
    var q = 1000000;
    var uIdx = 0;
    var nOk = true, qOk = true;

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function render() {
      clear(readout);
      if (!nOk || !qOk) {
        readout.appendChild(ro("input", "array size 1\u20135,000,000 and query count 0\u201350,000,000"));
        readout.appendChild(roText("Fix the highlighted field and the three op-counts come back."));
        return;
      }
      var p = rangePlan(n, q, uIdx);
      readout.appendChild(ro("n = " + fmt(n) + ", queries = " + fmt(q) + ", updates =", fmt(p.updates)));
      readout.appendChild(ro("prefix array", fmt(p.prefix) + " ops"));
      readout.appendChild(ro("Fenwick", fmt(p.fen) + " ops"));
      readout.appendChild(ro("segment tree", fmt(p.seg) + " ops"));
      readout.appendChild(ro("winner", p.best + " \u2014 " + fmt(p.bestOps) + " ops, memory " + p.mem));
      readout.appendChild(roText(p.note));
    }

    function setN(raw) {
      var v = parseInt(String(raw), 10);
      if (isNaN(v) || v < 1 || v > 5000000) nOk = false;
      else { nOk = true; n = v; }
      render();
    }
    function setQ(raw) {
      var v = parseInt(String(raw), 10);
      if (isNaN(v) || v < 0 || v > 50000000) qOk = false;
      else { qOk = true; q = v; }
      render();
    }

    stage.appendChild(numField("array size n", n, setN));
    stage.appendChild(numField("range queries", q, setQ));
    stage.appendChild(h("p", { class: "widget-desc" }, "how often the array changes"));
    stage.appendChild(segRow(UPDATE_MIX, uIdx, function (i) { uIdx = i; render(); }));

    mount.appendChild(stage);
    mount.appendChild(readout);
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES — merged, never reassigned
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "cpat-graphs": {
      title: "Weighted graphs & ordering checkpoint",
      sub: "Topological order, shortest paths, spanning trees and grids.",
      questions: [
        {
          q: "Kahn's algorithm terminates having emitted only 6 vertices of a 9-vertex directed graph. What does that tell you?",
          options: [
            "The queue was drained too early and the algorithm should be re-run",
            "The graph is disconnected and you must restart the algorithm from each component",
            "Three vertices had in-degree zero and were skipped by the initial scan",
            "The graph contains at least one cycle, so no topological order exists"
          ],
          answer: 3,
          explain: "Kahn's only enqueues a vertex once its in-degree reaches zero, and a vertex inside a cycle always has at least one unprocessed predecessor, so its in-degree never reaches zero. A short output therefore is the cycle check \u2014 no separate detection pass is needed. Disconnection is not the problem: every component contributes its own zero-in-degree sources to the initial queue."
        },
        {
          q: "What is the running time of Dijkstra's algorithm implemented with a binary heap?",
          options: [
            "O((V + E) log V)",
            "O(V \u00b7 E)",
            "O(V + E)",
            "O(V\u00b2 log V)"
          ],
          answer: 0,
          explain: "Each vertex is settled once and each edge can push at most one improved entry, so the heap sees O(V + E) push and pop operations. Because E is at most V\u00b2, log E is O(log V), giving O((V + E) log V) overall. O(V + E) is plain BFS, which has no priority ordering, and O(V\u00b7E) is Bellman\u2013Ford."
        },
        {
          q: "Why does Dijkstra's greedy invariant require non-negative edge weights?",
          options: [
            "Negative numbers make heap comparisons ambiguous",
            "A vertex already settled could later be reached more cheaply through a negative edge, so popping it was not final",
            "The distance array would underflow to a negative value",
            "Negative weights force the graph to contain a cycle"
          ],
          answer: 1,
          explain: "The whole algorithm rests on the claim that the smallest tentative distance in the frontier cannot improve, because every remaining route reaches it through some unsettled vertex whose distance is already at least as large. That argument only holds if extending a path can never make it cheaper. One negative edge breaks it, and the settled vertex keeps a wrong distance forever."
        },
        {
          q: "In the standard heap implementation of Dijkstra, what does 'lazy deletion' mean?",
          options: [
            "Removing a vertex's old heap entry before pushing an improved one",
            "Deferring construction of the heap until the first query arrives",
            "Pushing improved distances as new entries and discarding any popped entry whose stored distance exceeds the best distance recorded for that vertex",
            "Deleting settled vertices from the adjacency list to shrink later scans"
          ],
          answer: 2,
          explain: "A binary heap has no cheap decrease-key, so instead of finding and rewriting the stale entry you simply push a second entry with the better distance. When a pop produces a distance worse than the recorded best, that entry is stale and is skipped in O(1). The heap grows to O(E) entries, which is exactly why the bound is stated over E rather than V."
        },
        {
          q: "A graph has three vertices with edges A\u2013B = 2, A\u2013C = 2 and B\u2013C = 3. Its minimum spanning tree is {A\u2013B, A\u2013C}. What is the shortest B-to-C distance, and does the tree give it?",
          options: [
            "3 by the direct edge; the tree's B\u2013A\u2013C path costs 4, so the tree does not give it",
            "4, and the tree preserves it correctly because an MST contains all shortest paths",
            "2, and the tree path is optimal",
            "3, and the tree path also costs 3"
          ],
          answer: 0,
          explain: "An MST minimises the total weight of the edges it keeps, which is 4 here versus 5 for any other spanning tree. It says nothing about pairwise distance: the cheapest B-to-C route in the original graph is the direct edge at 3, but that edge is not in the tree, so the tree route costs 4. Treating an MST as a shortest-path structure is the classic confusion."
        },
        {
          q: "What is Kruskal's complexity, and which step dominates it?",
          options: [
            "O(V + E), dominated by the union-find operations",
            "O(V \u00b7 E), dominated by repeated relaxation rounds",
            "O(V\u00b2), dominated by scanning an adjacency matrix",
            "O(E log E), dominated by sorting the edges by weight"
          ],
          answer: 3,
          explain: "Kruskal sorts all E edges once at O(E log E), then performs E find operations and V\u22121 unions, each near-constant amortised with union by rank and path compression. The sort therefore dominates. Prim with a binary heap is the O((V + E) log V) alternative and tends to win on dense graphs where E approaches V\u00b2."
        },
        {
          q: "On a grid where stepping into an open cell costs 0 and breaking through a wall costs 1, which search is both correct and fastest?",
          options: [
            "0-1 BFS with a deque at O(V + E), pushing zero-cost moves to the front and unit-cost moves to the back",
            "Bellman\u2013Ford at O(V \u00b7 E), since the same weight repeats many times",
            "Dijkstra at O((V + E) log V), since a heap is required whenever weights differ",
            "Plain BFS at O(V + E), since a grid is unweighted"
          ],
          answer: 0,
          explain: "With only two distinct weights the deque keeps itself sorted by distance without a heap: a zero-cost move lands in the current ring and goes to the front, a unit-cost move belongs to the next ring and goes to the back. That preserves Dijkstra's ordering property at BFS cost. Dijkstra is correct here but pays an unnecessary log V factor, and plain BFS is simply wrong because the moves are not equal in cost."
        }
      ]
    },

    "cpat-structures": {
      title: "DP shapes & range structures checkpoint",
      sub: "Knapsack loop directions, DP taxonomy, Fenwick and segment trees, design problems.",
      questions: [
        {
          q: "In the one-dimensional rolling array for 0/1 knapsack, why must the capacity loop run downward?",
          options: [
            "Descending iteration is friendlier to the CPU cache",
            "So that dp[w \u2212 wt] still holds the previous item's row, which keeps each item usable at most once",
            "So that dp[w \u2212 wt] already includes the current item, allowing it to be reused",
            "Because the base case dp[0] = 0 is only valid when capacities are processed in decreasing order"
          ],
          answer: 1,
          explain: "The 2-D recurrence reads dp[i][w] from dp[i\u22121][w \u2212 wt], meaning the value before item i was considered. Collapsing to one row keeps that guarantee only if the cell you read has not yet been rewritten in this item's pass, and smaller indices are untouched when you walk from W down to wt. The third option describes exactly what upward iteration does, which is the unbounded case, not 0/1."
        },
        {
          q: "In unbounded knapsack, the same rolling array is used but the capacity loop runs upward. Why?",
          options: [
            "Upward iteration avoids integer overflow on large capacities",
            "Either direction gives the same table, so the choice is stylistic",
            "Because dp[w \u2212 wt] may already include copies of the current item, which is precisely what unlimited supply means",
            "Downward iteration would skip the base case at w = 0"
          ],
          answer: 2,
          explain: "Unbounded knapsack wants the current item reusable, so reading a cell that was already updated in this same pass is a feature rather than a bug. Walking upward makes dp[w \u2212 wt] the answer that may already contain one or more copies of this item, and adding one more gives the correct multi-copy value. The direction of that single loop is the entire difference between the two variants."
        },
        {
          q: "Why is 0/1 knapsack's O(n\u00b7W) running time described as pseudo-polynomial rather than polynomial?",
          options: [
            "Because the hidden constant factor is unusually large",
            "Because the recursion depth is O(n) even after tabulation",
            "Because two independent quantities are multiplied together",
            "Because W is a numeric value that takes only about log\u2082 W bits to write down, so the runtime is exponential in the length of the input"
          ],
          answer: 3,
          explain: "Complexity is measured against the size of the encoded input, and a capacity of one billion is written in roughly 30 bits. A table with a billion columns is therefore exponential in those 30 bits, not linear in the input length. That distinction is why subset-sum remains NP-complete despite having a table-filling algorithm every candidate can write."
        },
        {
          q: "\"Given two strings, find the length of their longest common subsequence.\" Which DP shape is this, and what is the state?",
          options: [
            "Subsequence DP on two strings: dp[i][j] over the two prefixes, with matching characters taking dp[i\u22121][j\u22121] + 1",
            "Interval DP: dp[i][j] over a contiguous segment, minimised over a split point k",
            "Knapsack DP: dp[i][c] over items and remaining capacity",
            "Linear sequence DP: dp[i] built from dp[i\u22121] and dp[i\u22122]"
          ],
          answer: 0,
          explain: "Two independent inputs means two independent indices, so the state is a pair of prefix lengths and the table is n by m. On a character match the problem shrinks on both sides at once; on a mismatch you take the better of dropping one character from either string. Interval DP would apply if the state were a segment of one sequence chosen by a split point, which is a different shape entirely."
        },
        {
          q: "What are the costs of a Fenwick tree (binary indexed tree) for prefix sums with point updates?",
          options: [
            "O(1) prefix query and O(n) point update, using O(n) memory",
            "O(log n) prefix query and O(log n) point update, with an O(n) build and O(n) memory",
            "O(n) build, O(log n) query and O(n) point update",
            "O(log n) query and O(1) point update"
          ],
          answer: 1,
          explain: "A query strips the lowest set bit off the index repeatedly and an update adds it repeatedly, so both walk at most log\u2082 n positions. The array holds n + 1 slots, and the in-place build that propagates each slot into its parent runs in O(n) rather than the naive O(n log n). Those are the same asymptotics a segment tree gives, with a noticeably smaller constant."
        },
        {
          q: "You hold a fixed array of 100,000 numbers and must answer one million range-sum queries with no updates at all. Which structure should you use?",
          options: [
            "A Fenwick tree, because it uses less memory than a segment tree",
            "A segment tree, because it is the most general of the three",
            "A plain prefix-sum array: an O(n) build and O(1) per query, roughly 1.1 million operations total",
            "Recompute each range with a loop, since individual ranges are short"
          ],
          answer: 2,
          explain: "The only weakness of a prefix array is that a write invalidates a suffix of the table, and here there are no writes, so it never pays that cost. Each query is one subtraction, giving about 100,000 build steps plus one million queries. A tree would charge log\u2082 100,000 \u2248 17 steps per query, roughly 17 million operations, for a flexibility this workload does not need."
        },
        {
          q: "You must design a set with O(1) insert, O(1) delete and O(1) uniformly random element. Which pairing achieves it?",
          options: [
            "A hash set alone, since it already offers O(1) insert and delete",
            "A balanced binary search tree, which supports all three operations",
            "A min-heap plus a hash map from value to heap position",
            "A dynamic array for indexable random access plus a hash map from value to index, deleting by swapping the victim with the last element"
          ],
          answer: 3,
          explain: "A hash set has no positional index, so picking uniformly at random would require walking it, and a tree charges O(log n) for everything. Pairing the two structures cancels their weaknesses: the array gives an O(1) index for the random draw, the map gives an O(1) lookup for delete, and swapping the victim with the tail keeps the array dense so no holes ever appear. Remember to rewrite the moved element's index in the map."
        }
      ]
    }
  });

  /* =================================================================
     MODULE 1 — graphs · Weighted Graphs & Ordering
     ================================================================= */
  var MODULE_GRAPHS = {
    id: "graphs",
    name: "Weighted Graphs & Ordering",
    icon: "share",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "topo-sort",
        title: "Topological order: Kahn, DFS, and the cycle you cannot ignore",
        summary: "Two O(V+E) ways to linearise a dependency graph, why cycle detection is built into both, and the heap variant that gives the smallest valid order.",
        minutes: 9,
        tags: ["graph", "topological-sort", "dag", "scheduling"],
        blocks: [
          { t: "p", html: "Hold this picture: a pile of tasks with arrows meaning <em>must happen before</em>. A <strong>topological order</strong> is any way of laying that pile out in a line so every arrow points forward. Such an order exists precisely when the graph is a DAG \u2014 one cycle anywhere and no line can satisfy all the arrows, because each task in the cycle would have to precede itself." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "Course scheduling: <em>\u201ccan every course be taken given these prerequisites, and in what order?\u201d</em>",
              "Build and package systems: compile modules so that no unit is built before its dependencies.",
              "Task runners and migration tools: run steps in an order that respects <em>after</em> constraints.",
              "Any phrasing with <em>prerequisite</em>, <em>depends on</em>, <em>must come before</em>, or <em>circular dependency</em>.",
              "Also a preprocessing step: DP over a DAG becomes trivial once the vertices are in topological order."
            ]
          },
          { t: "h", text: "Kahn's algorithm: peel off whatever is unblocked" },
          { t: "p", html: "Count how many arrows point <em>into</em> each vertex \u2014 its <strong>in-degree</strong>. Everything with in-degree zero is ready right now, so seed a queue with all of them. Pop one, emit it, and decrement the in-degree of each of its successors; anything that drops to zero has just become unblocked, so enqueue it. Every vertex is enqueued once and every edge is examined once, which is <strong>O(V + E)</strong> time and O(V) extra space." },
          { t: "code", lang: "python", code:
            "from collections import deque\n\n" +
            "def kahn(n, edges):\n" +
            "    \"\"\"edges: list of (before, after). Returns an order, or None if cyclic.\"\"\"\n" +
            "    adj = [[] for _ in range(n)]\n" +
            "    indeg = [0] * n\n" +
            "    for u, v in edges:\n" +
            "        adj[u].append(v)\n" +
            "        indeg[v] += 1            # v is blocked by one more thing\n\n" +
            "    ready = deque(u for u in range(n) if indeg[u] == 0)\n" +
            "    order = []\n" +
            "    while ready:\n" +
            "        u = ready.popleft()\n" +
            "        order.append(u)\n" +
            "        for v in adj[u]:\n" +
            "            indeg[v] -= 1        # one prerequisite satisfied\n" +
            "            if indeg[v] == 0:\n" +
            "                ready.append(v)\n\n" +
            "    return order if len(order) == n else None   # short == cycle"
          },
          { t: "note", variant: "tip", html: "<strong>Cycle detection is not an add-on here \u2014 it is the return value.</strong> A vertex on a cycle always has an unprocessed predecessor, so its in-degree never reaches zero and it is never emitted. If <code class='tok'>len(order) &lt; n</code> the graph has a cycle, and the vertices missing from the output are exactly the ones tangled in it. That last fact is free diagnostics: you can name the offending modules, not just report failure." },
          { t: "h", text: "The DFS variant: reverse the finish order" },
          { t: "p", html: "Depth-first search gives the same result from the other direction. Recurse into every unvisited successor first, and append a vertex to a list only once all of its descendants are finished. That list is reverse topological order, so reverse it at the end. Also <strong>O(V + E)</strong>, but the recursion costs O(V) stack depth." },
          { t: "p", html: "Detecting the cycle needs three states rather than two. A vertex is <em>white</em> (untouched), <em>grey</em> (on the current recursion path) or <em>black</em> (finished). Reaching a <strong>grey</strong> vertex means you have walked back onto your own path \u2014 a back edge, and therefore a cycle. Reaching a black one is fine; it is a cross edge into work already done." },
          { t: "code", lang: "python", code:
            "WHITE, GREY, BLACK = 0, 1, 2\n\n" +
            "def topo_dfs(n, adj):\n" +
            "    color = [WHITE] * n\n" +
            "    order = []\n\n" +
            "    def visit(u):\n" +
            "        color[u] = GREY                 # u is on the current path\n" +
            "        for v in adj[u]:\n" +
            "            if color[v] == GREY:\n" +
            "                return False            # back edge -> cycle\n" +
            "            if color[v] == WHITE and not visit(v):\n" +
            "                return False\n" +
            "        color[u] = BLACK\n" +
            "        order.append(u)                 # record on FINISH\n" +
            "        return True\n\n" +
            "    for s in range(n):\n" +
            "        if color[s] == WHITE and not visit(s):\n" +
            "            return None                 # cyclic\n" +
            "    order.reverse()\n" +
            "    return order"
          },
          {
            t: "table",
            headers: ["", "Kahn (in-degrees)", "DFS (finish order)"],
            rows: [
              ["Time", "O(V + E)", "O(V + E)"],
              ["Extra space", "O(V) queue + in-degree array", "O(V) colours + O(V) recursion stack"],
              ["Cycle report", "Vertices never emitted <em>are</em> the cycle", "The grey vertex you hit closes the cycle"],
              ["Natural extras", "Level-by-level scheduling; lexicographic variant", "Composes with other DFS results (low-link, components)"],
              ["Deep graphs", "Safe \u2014 iterative", "Can overflow the stack; convert to an explicit stack"]
            ]
          },
          { t: "note", variant: "trap", html: "The classic mistake is building the in-degree array from the wrong end of the edge. <em>\u201cTo take course B you must first take A\u201d</em> is the edge A\u2009\u2192\u2009B, so it increments <code class='tok'>indeg[B]</code>. Reverse it and the algorithm still runs, still terminates, and hands you a confidently backwards schedule that no test on a symmetric example will catch. Write one asymmetric example by hand before you trust the output." },
          { t: "h", text: "The lexicographically smallest order" },
          { t: "p", html: "A DAG usually has many valid orders, and some problems ask for the smallest one in dictionary order. Swap Kahn's FIFO queue for a <strong>min-heap</strong>: instead of taking any unblocked vertex, always take the smallest unblocked vertex. Each vertex is pushed and popped once, so the cost becomes <strong>O(E + V log V)</strong> \u2014 the log factor buys you the tie-break, and nothing else changes." },
          { t: "code", lang: "python", code:
            "import heapq\n\n" +
            "def kahn_smallest(n, adj, indeg):\n" +
            "    ready = [u for u in range(n) if indeg[u] == 0]\n" +
            "    heapq.heapify(ready)              # min-heap instead of a FIFO queue\n" +
            "    order = []\n" +
            "    while ready:\n" +
            "        u = heapq.heappop(ready)      # smallest unblocked vertex\n" +
            "        order.append(u)\n" +
            "        for v in adj[u]:\n" +
            "            indeg[v] -= 1\n" +
            "            if indeg[v] == 0:\n" +
            "                heapq.heappush(ready, v)\n" +
            "    return order if len(order) == n else None"
          },
          { t: "p", html: "Greedy is genuinely correct here: at every step the set of unblocked vertices is exactly the set of legal next choices, so taking the smallest one can never rule out a smaller prefix later. That is worth saying out loud \u2014 interviewers often expect you to justify the greedy choice rather than just make it." },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> The moment a problem talks about <em>prerequisites, dependencies, ordering constraints</em> or <em>circular dependency detection</em> on a directed graph. Use <strong>Kahn</strong> by default \u2014 it is iterative, it reports the cycle members for free, and it extends cleanly to the smallest-order and level-scheduling variants. Use <strong>DFS finish order</strong> when you are already running a DFS for something else. If the graph then needs distances rather than an order, you have moved on to <a href=\"#/cpat/graphs/dijkstra\">shortest paths</a>." },
          { t: "note", variant: "key", html: "<strong>Say the invariant, not the loop.</strong> \u201cA vertex is emitted only when every predecessor has already been emitted; if some vertex never reaches in-degree zero, it is on a cycle and no order exists.\u201d That single sentence contains the algorithm, its correctness argument, and the cycle check \u2014 and it is what earns the credit." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "dijkstra",
        title: "Dijkstra, and knowing when to abandon it",
        summary: "The greedy invariant behind non-negative shortest paths, the heap implementation with lazy deletion, and the Bellman-Ford fallback when a weight can go negative.",
        minutes: 10,
        tags: ["graph", "shortest-path", "dijkstra", "bellman-ford", "heap"],
        blocks: [
          { t: "p", html: "Picture a wavefront spreading out from the source, but at different speeds along different edges. <strong>Dijkstra's algorithm</strong> maintains a <em>settled</em> set of vertices whose shortest distance is final and a frontier of tentative distances, and it repeatedly moves the cheapest frontier vertex into the settled set. Every vertex is settled exactly once." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "<em>Shortest / cheapest / fastest</em> route where the steps have <strong>different costs</strong> \u2014 travel time, toll, latency, risk.",
              "Network routing, delivery cost, minimum effort along a path.",
              "\u201cCheapest way to reach every node from one source\u201d \u2014 that is one Dijkstra run, not many.",
              "Equal-cost steps instead? Stop \u2014 that is plain BFS, and it is cheaper. See <a href=\"#/cpat/graphs/grid-as-graph\">grids as graphs</a> for the deque variant that sits between the two."
            ]
          },
          { t: "h", text: "Why the greedy pop is safe" },
          { t: "p", html: "The whole algorithm rests on one claim: <strong>the smallest tentative distance in the frontier cannot improve.</strong> Suppose vertex <code class='tok'>u</code> has the smallest tentative distance <code class='tok'>d</code>. Any route to <code class='tok'>u</code> you have not already accounted for must leave the settled set through some other frontier vertex <code class='tok'>x</code>, whose tentative distance is at least <code class='tok'>d</code> because <code class='tok'>u</code> was the minimum. Continuing from <code class='tok'>x</code> to <code class='tok'>u</code> only adds more edges. If every edge weight is <strong>\u2265 0</strong>, adding edges cannot reduce the total, so no such route beats <code class='tok'>d</code>. Pop <code class='tok'>u</code>, mark it final, move on." },
          { t: "note", variant: "trap", html: "Every word of that argument depends on <em>\u201cadding edges cannot reduce the total\u201d</em>. Take S\u2009\u2192\u2009A with weight 1, S\u2009\u2192\u2009B with weight 4, and B\u2009\u2192\u2009A with weight \u22125. Dijkstra settles A at 1 and never looks again, but the true distance to A is \u22121 via B. Nothing crashes and no assertion fires \u2014 you simply get a wrong number. <strong>A single negative edge disqualifies Dijkstra outright.</strong>" },
          { t: "h", text: "The binary-heap implementation" },
          { t: "p", html: "A binary heap has no cheap decrease-key, so the standard trick is not to update the old entry at all: push a <em>second</em> entry with the better distance and let the stale one rot. When a pop hands you a distance worse than the best you have already recorded for that vertex, discard it in O(1) and continue. This is <strong>lazy deletion</strong>." },
          { t: "code", lang: "python", code:
            "import heapq\n\n" +
            "def dijkstra(n, adj, src):\n" +
            "    \"\"\"adj[u] = list of (v, w) with every w >= 0. Returns dist[].\"\"\"\n" +
            "    INF = float('inf')\n" +
            "    dist = [INF] * n\n" +
            "    dist[src] = 0\n" +
            "    pq = [(0, src)]                    # (tentative distance, vertex)\n\n" +
            "    while pq:\n" +
            "        d, u = heapq.heappop(pq)\n" +
            "        if d > dist[u]:\n" +
            "            continue                   # stale entry -> lazy deletion\n" +
            "        for v, w in adj[u]:\n" +
            "            nd = d + w\n" +
            "            if nd < dist[v]:\n" +
            "                dist[v] = nd\n" +
            "                heapq.heappush(pq, (nd, v))   # push, never rewrite\n" +
            "    return dist"
          },
          { t: "p", html: "Counting the cost: each vertex is settled once, so there are V real pops; each edge can trigger at most one push, so the heap holds <strong>O(V + E)</strong> entries. Since E \u2264 V\u00b2, <code class='tok'>log E \u2264 2 log V</code>, so every heap operation is O(log V). Total: <strong>O((V + E) log V)</strong>. With a Fibonacci heap the bound improves to O(E + V log V), which is better in theory and almost never worth the constant factor in an interview." },
          { t: "note", variant: "tip", html: "If you only need the distance to <em>one</em> target, break out of the loop the moment you pop it \u2014 it is settled and final at that instant. Same asymptotics, often a large practical saving. If you need the path and not just the length, carry a <code class='tok'>parent[]</code> array updated wherever you write <code class='tok'>dist[v]</code>, then walk it backwards from the target." },
          { t: "h", text: "When a weight can be negative: Bellman\u2013Ford" },
          { t: "p", html: "Give up the greedy ordering and just relax everything, repeatedly. A shortest path in a graph with no negative cycle uses at most V\u22121 edges, so V\u22121 full sweeps over the edge list are enough for every distance to converge. Each sweep is O(E), giving <strong>O(V \u00b7 E)</strong>." },
          { t: "code", lang: "python", code:
            "def bellman_ford(n, edges, src):\n" +
            "    \"\"\"edges: list of (u, v, w); w may be negative.\n" +
            "       Returns dist[], or None if a negative cycle is reachable.\"\"\"\n" +
            "    INF = float('inf')\n" +
            "    dist = [INF] * n\n" +
            "    dist[src] = 0\n\n" +
            "    for _ in range(n - 1):             # V-1 sweeps is always enough\n" +
            "        changed = False\n" +
            "        for u, v, w in edges:\n" +
            "            if dist[u] != INF and dist[u] + w < dist[v]:\n" +
            "                dist[v] = dist[u] + w\n" +
            "                changed = True\n" +
            "        if not changed:\n" +
            "            break                      # converged early\n\n" +
            "    for u, v, w in edges:              # one extra sweep\n" +
            "        if dist[u] != INF and dist[u] + w < dist[v]:\n" +
            "            return None                # still improving -> negative cycle\n" +
            "    return dist"
          },
          { t: "p", html: "That final sweep is the second thing Bellman\u2013Ford gives you for free. If any distance still improves after V\u22121 rounds, no shortest path exists at all \u2014 there is a reachable <strong>negative cycle</strong> you could loop forever to drive the cost down. Currency-arbitrage questions are exactly this check wearing a costume." },
          {
            t: "stat", items: [
              { v: "O(V + E)", k: "BFS \u00b7 equal weights" },
              { v: "O((V+E) log V)", k: "Dijkstra \u00b7 binary heap" },
              { v: "O(V \u00b7 E)", k: "Bellman\u2013Ford \u00b7 any weights" }
            ]
          },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Reach for <strong>Dijkstra</strong> when edges carry <em>different non-negative</em> costs and you need cheapest paths from one source. Drop to <strong>BFS</strong> the instant every edge costs the same. Switch to <strong>Bellman\u2013Ford</strong> when any weight can be negative, or when the question is really <em>\u201cis there a negative cycle?\u201d</em>. If you need cheapest paths between <em>all</em> pairs on a small dense graph, the three-nested-loop Floyd\u2013Warshall at O(V\u00b3) is simpler than running Dijkstra V times." },
          { t: "note", variant: "key", html: "<strong>Name the precondition before you name the algorithm.</strong> \u201cAll weights are non-negative, so I can settle greedily with Dijkstra at O((V+E)\u00a0log\u00a0V); if any weight can be negative I lose that invariant and fall back to Bellman\u2013Ford at O(V\u00b7E), which also tells me whether a negative cycle exists.\u201d That sentence is the difference between reciting a name and demonstrating you know when it breaks." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "mst",
        title: "Minimum spanning trees, and what they are not",
        summary: "Kruskal with union-find and Prim with a heap, the cut and cycle properties that make greedy correct, and the reason an MST is not a shortest-path structure.",
        minutes: 9,
        tags: ["graph", "mst", "kruskal", "prim", "greedy"],
        blocks: [
          { t: "p", html: "You have a connected weighted graph and you want to keep it connected while throwing away as much edge weight as possible. Whatever survives is a tree \u2014 V vertices and exactly V\u22121 edges, no cycles \u2014 and the cheapest such tree is the <strong>minimum spanning tree</strong>. The mental model: connect everything, waste nothing." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "<em>\u201cConnect all N sites at minimum total cost\u201d</em> \u2014 cabling, piping, road building, laying fibre.",
              "<em>\u201cMinimise the cost of keeping the whole network reachable\u201d</em> where only total weight matters.",
              "Clustering: cut the k\u22121 heaviest MST edges and you have k clusters.",
              "Bottleneck questions: the minimax path between two vertices runs along the MST, because the MST minimises the heaviest edge on every connecting route."
            ]
          },
          { t: "h", text: "Why greedy is provably correct" },
          { t: "p", html: "Two facts do all the work. The <strong>cut property</strong>: for any way of splitting the vertices into two non-empty groups, the lightest edge crossing that split belongs to some MST \u2014 because any spanning tree must cross the split somewhere, and swapping in the lighter crossing edge cannot make the tree heavier. The <strong>cycle property</strong> is the mirror image: on any cycle, an edge strictly heavier than every other edge of that cycle belongs to no MST, since you can always delete it and stay connected through the rest of the cycle." },
          { t: "p", html: "Kruskal is the cycle property applied greedily from the light end; Prim is the cut property applied greedily from a growing blob. Both are correct for the same reason, which is worth stating rather than picking one \u201cby feel\u201d." },
          { t: "h", text: "Kruskal: sort the edges, union what is not yet joined" },
          { t: "code", lang: "python", code:
            "def kruskal(n, edges):\n" +
            "    \"\"\"edges: list of (w, u, v). Returns (total_weight, chosen_edges).\"\"\"\n" +
            "    parent = list(range(n))\n" +
            "    rank = [0] * n\n\n" +
            "    def find(x):\n" +
            "        while parent[x] != x:\n" +
            "            parent[x] = parent[parent[x]]      # path compression\n" +
            "            x = parent[x]\n" +
            "        return x\n\n" +
            "    def union(a, b):\n" +
            "        ra, rb = find(a), find(b)\n" +
            "        if ra == rb:\n" +
            "            return False                        # same component -> cycle\n" +
            "        if rank[ra] < rank[rb]:\n" +
            "            ra, rb = rb, ra\n" +
            "        parent[rb] = ra\n" +
            "        if rank[ra] == rank[rb]:\n" +
            "            rank[ra] += 1\n" +
            "        return True\n\n" +
            "    total, chosen = 0, []\n" +
            "    for w, u, v in sorted(edges):               # O(E log E)\n" +
            "        if union(u, v):\n" +
            "            total += w\n" +
            "            chosen.append((u, v, w))\n" +
            "            if len(chosen) == n - 1:\n" +
            "                break                           # spanning tree complete\n" +
            "    return total, chosen"
          },
          { t: "p", html: "Cost: sorting E edges is <strong>O(E log E)</strong>, then E find operations and V\u22121 unions at near-constant amortised cost with union by rank plus path compression. The sort dominates, so Kruskal is <strong>O(E log E)</strong>. If <code class='tok'>len(chosen)</code> ends below V\u22121, the graph was disconnected and you have built a minimum spanning <em>forest</em> instead." },
          { t: "h", text: "Prim: grow one blob, always take the cheapest edge leaving it" },
          { t: "code", lang: "python", code:
            "import heapq\n\n" +
            "def prim(n, adj, start=0):\n" +
            "    \"\"\"adj[u] = list of (v, w). Assumes the graph is connected.\"\"\"\n" +
            "    inside = [False] * n\n" +
            "    pq = [(0, start)]                   # (edge weight, vertex)\n" +
            "    total, taken = 0, 0\n\n" +
            "    while pq and taken < n:\n" +
            "        w, u = heapq.heappop(pq)\n" +
            "        if inside[u]:\n" +
            "            continue                    # stale entry -> lazy deletion\n" +
            "        inside[u] = True\n" +
            "        total += w\n" +
            "        taken += 1\n" +
            "        for v, wt in adj[u]:\n" +
            "            if not inside[v]:\n" +
            "                heapq.heappush(pq, (wt, v))\n" +
            "    return total if taken == n else None    # None -> disconnected"
          },
          { t: "p", html: "Same lazy-deletion trick as in <a href=\"#/cpat/graphs/dijkstra\">Dijkstra</a>, and the same accounting: O(E) pushes, O(V) real pops, O(log V) per heap operation, so Prim with a binary heap is <strong>O((V + E) log V)</strong>. The resemblance is only skin deep, though \u2014 Dijkstra's key is <em>distance from the source</em>, Prim's key is <em>weight of the single edge attaching this vertex to the tree</em>. Confusing the two produces a plausible-looking algorithm that computes neither." },
          {
            t: "table",
            headers: ["", "Kruskal", "Prim (binary heap)"],
            rows: [
              ["Time", "O(E log E)", "O((V + E) log V)"],
              ["Core structure", "Sort + union-find", "Priority queue"],
              ["Best when", "Sparse graphs; edges already sorted or sortable by key", "Dense graphs, where E approaches V\u00b2"],
              ["Disconnected input", "Yields a spanning forest naturally", "Only spans the component it starts in"],
              ["Edges arriving over time", "Fits well \u2014 just keep unioning", "Awkward \u2014 the frontier must be rebuilt"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>An MST is not a shortest-path tree, and this is the classic confusion.</strong> Take three vertices with A\u2013B = 2, A\u2013C = 2, B\u2013C = 3. The MST keeps {A\u2013B, A\u2013C} for a total of 4, which is genuinely minimal. But the shortest B-to-C route is the direct edge at 3, and that edge is not in the tree, so the tree route costs 4. MST minimises the <em>sum of the edges retained</em>; shortest paths minimise <em>distance between a specific pair</em>. Those are different objectives and they disagree on tiny graphs, let alone real ones." },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Only when the objective is <em>total weight of a connecting structure</em> \u2014 wire everything together for the least money, or cluster by cutting the heaviest links. If the objective mentions <em>travel between two places</em>, a per-pair distance, or a source, it is a shortest-path problem and you want <a href=\"#/cpat/graphs/dijkstra\">Dijkstra or Bellman\u2013Ford</a> instead. Pick <strong>Kruskal</strong> for sparse graphs and edge lists, <strong>Prim</strong> for dense graphs and adjacency lists." },
          { t: "note", variant: "key", html: "<strong>State the objective before the algorithm.</strong> \u201cThis minimises total connection cost, not pairwise distance, so it is a spanning tree \u2014 Kruskal at O(E\u00a0log\u00a0E) since the graph is sparse.\u201d Naming the objective is what proves you chose the model rather than pattern-matched on the word <em>graph</em>." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "grid-as-graph",
        title: "Grids as implicit graphs",
        summary: "Cells as vertices without ever building an adjacency list, multi-source BFS, 0-1 BFS with a deque, and when bidirectional search pays.",
        minutes: 9,
        tags: ["grid", "bfs", "deque", "bidirectional", "matrix"],
        blocks: [
          { t: "p", html: "A grid <em>is</em> a graph; you just never have to construct it. Each cell is a vertex, each legal move is an edge, and the adjacency list is generated on demand by adding an offset to a coordinate. An R\u2009\u00d7\u2009C grid with 4-directional movement has R\u00b7C vertices and fewer than 4\u00b7R\u00b7C edges, so a traversal is <strong>O(R\u00b7C)</strong> \u2014 the same O(V + E) bound, with the constants nailed down." },
          { t: "p", html: "<a href='#/patterns/trees-graphs/matrix'>The matrix-traversal pattern</a> covers the uniform-cost case: flood fill, island counting, plain BFS over a grid. This lesson is what happens once the moves stop costing the same \u2014 multi-source starts, zero-or-one edge weights, and the point where a heap becomes necessary." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "The input is a board, maze, map or matrix and you need <em>fewest steps</em>, <em>shortest route</em> or <em>time to spread</em>.",
              "Several starting points that all spread at once \u2014 fire, rot, signal coverage, nearest facility.",
              "Moves that mostly cost nothing but occasionally cost one: breaking a wall, reversing a conveyor, changing direction.",
              "Enormous or implicit state spaces \u2014 puzzle configurations, lock combinations \u2014 where the \u201cgrid\u201d is a state, not a coordinate."
            ]
          },
          { t: "h", text: "Encoding: coordinates in, integers out" },
          { t: "p", html: "Two representations, both fine. Keep <code class='tok'>(r, c)</code> tuples for readability, or flatten to a single integer <code class='tok'>r * C + c</code> when you want array-backed visited and distance tables instead of hash maps \u2014 measurably faster on large boards, and it lets you reuse any graph routine that expects integer vertex ids." },
          { t: "code", lang: "python", code:
            "DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))     # 4-directional\n\n" +
            "def neighbours(r, c, R, C, grid):\n" +
            "    for dr, dc in DIRS:\n" +
            "        nr, nc = r + dr, c + dc\n" +
            "        if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] != '#':\n" +
            "            yield nr, nc\n\n" +
            "# Flattened form when you want array-backed tables:\n" +
            "#   node_id = r * C + c\n" +
            "#   r, c    = divmod(node_id, C)"
          },
          { t: "h", text: "Multi-source BFS: seed the queue with everything" },
          { t: "p", html: "When several cells start \u201cactive\u201d at once, do not run one BFS per source. Push <em>all</em> sources with distance 0 before the loop begins. The wavefronts then expand together and the first to reach a cell is by definition the nearest source, so one pass gives every cell its distance to the closest source. Still <strong>O(R\u00b7C)</strong> \u2014 the same cost as a single-source run, for an answer that would otherwise take one run per source." },
          { t: "code", lang: "python", code:
            "from collections import deque\n\n" +
            "def multi_source_bfs(grid, sources):\n" +
            "    R, C = len(grid), len(grid[0])\n" +
            "    dist = [[-1] * C for _ in range(R)]\n" +
            "    q = deque()\n" +
            "    for r, c in sources:\n" +
            "        dist[r][c] = 0\n" +
            "        q.append((r, c))              # every source starts at 0\n\n" +
            "    while q:\n" +
            "        r, c = q.popleft()\n" +
            "        for nr, nc in neighbours(r, c, R, C, grid):\n" +
            "            if dist[nr][nc] == -1:\n" +
            "                dist[nr][nc] = dist[r][c] + 1\n" +
            "                q.append((nr, nc))    # mark on ENQUEUE, not on dequeue\n" +
            "    return dist"
          },
          { t: "note", variant: "trap", html: "Mark a cell visited when you <strong>enqueue</strong> it, never when you dequeue it. Marking on dequeue lets the same cell be pushed once per neighbour that reaches it, and the queue balloons \u2014 on a dense grid the visit count can grow by a factor of four with no change in the final answer, and the bug survives every small test case you would write by hand." },
          { t: "h", text: "0-1 BFS: a deque instead of a heap" },
          { t: "p", html: "Some grids have exactly two edge costs: zero for a free move and one for a move that costs something. Dijkstra works, but the heap is overkill. Use a <strong>deque</strong> and push a zero-cost move to the <em>front</em> and a unit-cost move to the <em>back</em>. The deque then stays sorted by distance all by itself \u2014 the front holds the current ring, the back the next one \u2014 so you keep Dijkstra's ordering guarantee at <strong>O(V + E)</strong> instead of O((V + E) log V)." },
          { t: "code", lang: "python", code:
            "from collections import deque\n\n" +
            "def zero_one_bfs(n, adj, src):\n" +
            "    \"\"\"adj[u] = list of (v, w) where every w is 0 or 1.\"\"\"\n" +
            "    INF = float('inf')\n" +
            "    dist = [INF] * n\n" +
            "    dist[src] = 0\n" +
            "    dq = deque([src])\n\n" +
            "    while dq:\n" +
            "        u = dq.popleft()\n" +
            "        for v, w in adj[u]:\n" +
            "            if dist[u] + w < dist[v]:\n" +
            "                dist[v] = dist[u] + w\n" +
            "                if w == 0:\n" +
            "                    dq.appendleft(v)   # same ring -> front\n" +
            "                else:\n" +
            "                    dq.append(v)       # next ring -> back\n" +
            "    return dist"
          },
          { t: "note", variant: "tip", html: "Note the guard: 0-1 BFS compares distances rather than using a plain <code class='tok'>visited</code> set, because a cell can be reached first by a unit-cost move and later improved by a zero-cost one. Swapping in a boolean visited set is the standard way to break this algorithm." },
          { t: "h", text: "Bidirectional search" },
          { t: "p", html: "When both the start and the goal are known and the branching factor <code class='tok'>b</code> is high, search from both ends and stop when the frontiers touch. A one-directional search explores roughly <code class='tok'>b<sup>d</sup></code> states; two searches of depth <code class='tok'>d/2</code> explore roughly <code class='tok'>2\u00b7b<sup>d/2</sup></code>, which is dramatically smaller. It needs a single explicit target, reversible moves, and uniform step cost \u2014 lock and word-transformation puzzles fit, open-ended exploration does not." },
          { t: "widget", id: "cpatPathLab" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Treat the grid as a graph whenever the question asks for <em>fewest moves, shortest route, minimum time to spread,</em> or <em>distance to the nearest X</em> on a board. Plain <strong>BFS</strong> for uniform steps; <strong>multi-source BFS</strong> when several cells start active; <strong>0-1 BFS</strong> when moves cost zero or one; <strong>Dijkstra</strong> once costs are arbitrary and non-negative, as covered in <a href=\"#/cpat/graphs/dijkstra\">the shortest-path lesson</a>; <strong>bidirectional search</strong> only with a single known target and a wide branching factor. If the question is instead <em>count the regions</em> or <em>fill this area</em>, distance is irrelevant and any traversal will do." },
          { t: "note", variant: "key", html: "<strong>Never build the adjacency list for a grid.</strong> Generate neighbours from an offset table, mark visited on enqueue, and pick the queue discipline from the cost structure \u2014 FIFO for uniform steps, deque for zero-or-one, heap for arbitrary non-negative. Getting the queue discipline right <em>is</em> getting the algorithm right." },
          { t: "quiz", id: "cpat-graphs" }
        ]
      }
    ]
  };

  /* =================================================================
     MODULE 2 — structures · DP Shapes & Range Structures
     ================================================================= */
  var MODULE_STRUCTURES = {
    id: "structures",
    name: "DP Shapes & Range Structures",
    icon: "cube",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "dp-taxonomy",
        title: "The five DP shapes",
        summary: "A six-step recipe that turns any DP into a mechanical exercise, and the five recurring problem shapes with their state and transition written out.",
        minutes: 11,
        tags: ["dp", "taxonomy", "state", "transition"],
        blocks: [
          { t: "p", html: "Knowing <em>that</em> a problem is dynamic programming is the easy half. The hard half is naming the <strong>state</strong>, and that is where most attempts stall \u2014 not on the code, but on the sentence \u201clet dp[\u2026] mean \u2026\u201d. This lesson gives you a fixed procedure for producing that sentence, then the five shapes almost every interview DP collapses into, so you can pattern-match a new problem onto one instead of inventing from scratch." },
          { t: "p", html: "This is the deep treatment. <a href='#/patterns/recursion-dp/dynamic-programming'>The DP pattern lesson</a> covers recognising a DP and writing the memoised form; start there if the six-step recipe below is unfamiliar. Everything here assumes you can already get to a working recursion and want to know which of the five shapes you are in." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "<em>\u201cCount the number of ways\u2026\u201d</em>, <em>\u201cminimum / maximum cost to\u2026\u201d</em>, <em>\u201clongest / shortest \u2026 subject to\u2026\u201d</em>.",
              "A brute-force recursion you can already write, which visibly recomputes the same arguments.",
              "A sequence of decisions where each choice constrains the next \u2014 take it or skip it, cut here or there.",
              "Small numeric bounds in the constraints (n \u2264 1000, capacity \u2264 10\u2074) hinting that a table of that size is intended."
            ]
          },
          { t: "h", text: "The six-step recipe" },
          {
            t: "ol", items: [
              "<strong>Write the recurrence in English first.</strong> \u201cThe best answer using the first i items with capacity c is either the best without item i, or item i's value plus the best for the remaining capacity.\u201d If you cannot say it, no code will save you.",
              "<strong>Pin the base cases.</strong> The smallest states whose value you know outright \u2014 usually empty input, zero capacity, or a single element.",
              "<strong>Write it as plain recursion.</strong> Do not optimise yet. A correct exponential solution is a working specification.",
              "<strong>Memoise.</strong> Cache on the exact argument tuple. This alone turns exponential into polynomial and costs one decorator or one dictionary.",
              "<strong>Convert to bottom-up.</strong> Order the states so dependencies are already filled, then fill a table with loops. No recursion depth, and the loop order makes the dependencies explicit.",
              "<strong>Compress space, last.</strong> If row i only reads row i\u22121, keep two rows \u2014 or one, if you get the direction right."
            ]
          },
          { t: "p", html: "Do these in order. Steps 5 and 6 are optimisations of something already correct; attempting them first is how people end up with an off-by-one in a table they cannot debug because they never had a reference implementation." },
          { t: "code", lang: "python", code:
            "# The recipe applied end to end.\n" +
            "# Problem: cover every day in `days` using 1-day, 7-day or 30-day passes.\n" +
            "#\n" +
            "# 1. recurrence: dp[d] = cheapest cover for all travel days <= d\n" +
            "# 2. base:       dp[0] = 0  (nothing to cover)\n" +
            "# 3-5. straight to bottom-up; the recursion is the same three branches\n" +
            "\n" +
            "def min_pass_cost(days, costs):        # costs = [one_day, week, month]\n" +
            "    travel = set(days)\n" +
            "    last = days[-1]\n" +
            "    dp = [0] * (last + 1)\n" +
            "    for d in range(1, last + 1):\n" +
            "        if d not in travel:\n" +
            "            dp[d] = dp[d - 1]          # no travel -> no new cost\n" +
            "        else:\n" +
            "            dp[d] = min(dp[d - 1]            + costs[0],\n" +
            "                        dp[max(0, d - 7)]  + costs[1],\n" +
            "                        dp[max(0, d - 30)] + costs[2])\n" +
            "    return dp[last]\n" +
            "\n" +
            "# 6. space: dp[d] reads back up to 30 days, so you could keep a\n" +
            "#    30-slot ring buffer instead of the whole array."
          },
          { t: "h", text: "The five shapes" },
          { t: "p", html: "Almost every DP you will be handed is one of these. Match the shape and the transition writes itself; the remaining work is boundaries." },
          {
            t: "table",
            headers: ["Shape", "State means", "Transition", "Typical cost"],
            rows: [
              [
                "<strong>Linear sequence</strong>",
                "<code class='tok'>dp[i]</code> = best answer for the prefix ending at or through index <code class='tok'>i</code>",
                "<code class='tok'>dp[i] = f(dp[i-1], dp[i-2], \u2026)</code> \u2014 a small fixed look-back",
                "O(n) time, O(1) space after compression"
              ],
              [
                "<strong>Grid</strong>",
                "<code class='tok'>dp[r][c]</code> = best answer for reaching cell (r, c)",
                "<code class='tok'>dp[r][c] = cell + best(dp[r-1][c], dp[r][c-1])</code>",
                "O(R\u00b7C) time, O(C) space with a rolling row"
              ],
              [
                "<strong>Two-string subsequence</strong>",
                "<code class='tok'>dp[i][j]</code> = answer for the first <code class='tok'>i</code> of A and first <code class='tok'>j</code> of B",
                "match \u2192 <code class='tok'>dp[i-1][j-1] + 1</code>; mismatch \u2192 best of <code class='tok'>dp[i-1][j]</code>, <code class='tok'>dp[i][j-1]</code>",
                "O(n\u00b7m) time, O(min(n, m)) space"
              ],
              [
                "<strong>Interval</strong>",
                "<code class='tok'>dp[i][j]</code> = best answer for the contiguous segment <code class='tok'>i..j</code>",
                "try every split <code class='tok'>k</code>: <code class='tok'>dp[i][k] + dp[k+1][j] + cost(i, k, j)</code>",
                "O(n\u00b3) time, O(n\u00b2) space"
              ],
              [
                "<strong>Knapsack</strong>",
                "<code class='tok'>dp[i][c]</code> = best value from the first <code class='tok'>i</code> items within capacity <code class='tok'>c</code>",
                "skip \u2192 <code class='tok'>dp[i-1][c]</code>; take \u2192 <code class='tok'>dp[i-1][c-w\u1d62] + v\u1d62</code>",
                "O(n\u00b7W) \u2014 pseudo-polynomial, see below"
              ]
            ]
          },
          { t: "h", text: "Matching a fresh problem to a shape" },
          {
            t: "table",
            headers: ["The problem says\u2026", "Shape", "Why"],
            rows: [
              ["Walk a list making a local choice at each step", "Linear sequence", "One index is enough to describe where you are"],
              ["Move through a board from corner to corner", "Grid", "Position needs two coordinates, moves are one-directional"],
              ["Compare, align or edit two sequences", "Two-string subsequence", "Two independent inputs \u2192 two independent indices"],
              ["Cut, merge, burst or parenthesise a range", "Interval", "The answer for a segment depends on where you split it"],
              ["Pick a subset under a budget or capacity", "Knapsack", "The state must carry the remaining budget"],
              ["Longest increasing subsequence", "Linear sequence", "<code class='tok'>dp[i]</code> = best run ending at <code class='tok'>i</code>; O(n\u00b2), or O(n log n) with binary search"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>The classic mistake is an under-specified state.</strong> If your transition needs a fact the state does not carry \u2014 how much capacity is left, whether the previous element was taken, which player moves next \u2014 the recurrence is not wrong so much as impossible, and you will spend the interview patching it with globals. Test the state by asking: <em>given only these indices, can I compute the answer without looking at how I got here?</em> If not, add the missing dimension before writing a line of code." },
          { t: "note", variant: "tip", html: "Space compression is mechanical once the shape is named. If row <code class='tok'>i</code> only reads row <code class='tok'>i\u22121</code>, keep two rows and swap. If it also only reads <em>lower</em> columns of the previous row, one row suffices \u2014 provided the loop direction protects the values you still need, which is exactly the subtlety the <a href=\"#/cpat/structures/knapsack-family\">knapsack lesson</a> takes apart." },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Whenever the problem counts ways, optimises over a sequence of choices, or exposes a recursion that recomputes arguments. Then <em>name the shape out loud before coding</em> \u2014 \u201cthis is interval DP, so the state is a segment and the transition is a split point\u201d. If subproblems do not actually repeat, you want divide-and-conquer or a greedy argument instead; if the state must remember the whole path taken, DP is the wrong model and you are in <a href=\"#/cpat/graphs/topo-sort\">search or ordering</a> territory." },
          { t: "note", variant: "key", html: "<strong>The state definition is the answer; everything else is typing.</strong> Say what <code class='tok'>dp[\u2026]</code> means in one unambiguous English sentence and the transition, the base cases, the loop order and the space optimisation all follow from it. If you cannot say the sentence, you do not yet have a solution \u2014 no amount of code will produce one." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "knapsack-family",
        title: "The knapsack family and the loop that decides everything",
        summary: "0/1 knapsack, the rolling one-dimensional array and why its loop runs downward, unbounded knapsack and why its loop runs upward, subset-sum in disguise, and what pseudo-polynomial really costs.",
        minutes: 10,
        tags: ["dp", "knapsack", "subset-sum", "pseudo-polynomial"],
        blocks: [
          { t: "p", html: "A budget, a set of things you could spend it on, and one decision per thing. That is the knapsack family, and it swallows far more interview problems than its name suggests \u2014 anything with a capacity, a weight limit, a target sum, or a fixed number of picks is wearing this costume." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "<em>\u201cMaximise value without exceeding capacity W\u201d</em> \u2014 the literal form.",
              "<em>\u201cCan a subset sum to exactly T?\u201d</em> or <em>\u201csplit this array into two equal-sum halves\u201d</em> \u2014 knapsack with a boolean table.",
              "<em>\u201cFewest coins to make an amount\u201d</em> or <em>\u201chow many ways to make it\u201d</em> \u2014 unbounded knapsack.",
              "Any constraint of the form \u201cat most K of these\u201d where K is small enough to be a table dimension."
            ]
          },
          { t: "h", text: "0/1 knapsack: the two-dimensional table" },
          { t: "p", html: "Each item is taken at most once, so the state is <code class='tok'>dp[i][c]</code> \u2014 the best value obtainable from the first <code class='tok'>i</code> items with capacity <code class='tok'>c</code>. For each item you either skip it and inherit <code class='tok'>dp[i-1][c]</code>, or take it and add its value to <code class='tok'>dp[i-1][c - w\u1d62]</code>. Note that <em>both</em> branches read row <code class='tok'>i-1</code>: the value <em>before</em> this item existed. Remember that; the next section turns on it." },
          { t: "code", lang: "python", code:
            "def knapsack_2d(weights, values, W):\n" +
            "    n = len(weights)\n" +
            "    dp = [[0] * (W + 1) for _ in range(n + 1)]\n" +
            "    for i in range(1, n + 1):\n" +
            "        w, v = weights[i - 1], values[i - 1]\n" +
            "        for c in range(W + 1):\n" +
            "            dp[i][c] = dp[i - 1][c]                       # skip item i\n" +
            "            if w <= c:\n" +
            "                take = dp[i - 1][c - w] + v               # take it, ONCE\n" +
            "                if take > dp[i][c]:\n" +
            "                    dp[i][c] = take\n" +
            "    return dp[n][W]"
          },
          { t: "p", html: "Time <strong>O(n\u00b7W)</strong>, space <strong>O(n\u00b7W)</strong>. Correct, readable, and usually the version to write first in an interview \u2014 the compression below is worth doing only when you have time or the memory bound demands it." },
          { t: "h", text: "The rolling one-dimensional array \u2014 and why the loop runs downward" },
          { t: "p", html: "Row <code class='tok'>i</code> reads only row <code class='tok'>i-1</code>, so one array of length W+1 is enough. But now the array holds row <code class='tok'>i-1</code> at the start of the pass and gradually becomes row <code class='tok'>i</code> as you write into it, and the cell you read \u2014 <code class='tok'>dp[c - w]</code> \u2014 sits at a <em>lower</em> index than the cell you write." },
          { t: "p", html: "Iterate <code class='tok'>c</code> <strong>upward</strong> and by the time you reach <code class='tok'>c</code>, the cell at <code class='tok'>c - w</code> has already been overwritten during this same item's pass. You would be reading a value that may already include item <code class='tok'>i</code>, then adding item <code class='tok'>i</code> again \u2014 silently allowing multiple copies of an item that is supposed to be available once. Iterate <code class='tok'>c</code> <strong>downward</strong> from W to <code class='tok'>w</code> and every lower index is still untouched this pass, so <code class='tok'>dp[c - w]</code> is guaranteed to be the old row. That is the entire justification: <em>descending order preserves the previous row on your left.</em>" },
          { t: "code", lang: "python", code:
            "def knapsack_1d(weights, values, W):\n" +
            "    dp = [0] * (W + 1)                 # currently row i-1\n" +
            "    for w, v in zip(weights, values):\n" +
            "        # DOWNWARD: dp[c - w] has not been touched in this pass yet,\n" +
            "        # so it still holds the value from BEFORE this item existed.\n" +
            "        for c in range(W, w - 1, -1):\n" +
            "            cand = dp[c - w] + v\n" +
            "            if cand > dp[c]:\n" +
            "                dp[c] = cand\n" +
            "    return dp[W]                       # O(n*W) time, O(W) space"
          },
          { t: "h", text: "Unbounded knapsack: the same loop, upward" },
          { t: "p", html: "Now each item has unlimited supply. The state becomes <code class='tok'>dp[c]</code> = best value for capacity <code class='tok'>c</code> using any number of copies, and the transition reads <code class='tok'>dp[c - w]</code> where that cell <em>may already contain copies of the current item</em>. In the 0/1 case that was the bug; here it is precisely the semantics you want. So run <code class='tok'>c</code> <strong>upward</strong> and let the reuse happen." },
          { t: "code", lang: "python", code:
            "def knapsack_unbounded(weights, values, W):\n" +
            "    dp = [0] * (W + 1)\n" +
            "    for w, v in zip(weights, values):\n" +
            "        # UPWARD: dp[c - w] may already include copies of THIS item,\n" +
            "        # which is exactly what unlimited supply means.\n" +
            "        for c in range(w, W + 1):\n" +
            "            cand = dp[c - w] + v\n" +
            "            if cand > dp[c]:\n" +
            "                dp[c] = cand\n" +
            "    return dp[W]                       # O(n*W) time, O(W) space"
          },
          {
            t: "compare",
            bad: { title: "Downward loop \u2192 0/1", items: ["<code class='tok'>for c in range(W, w-1, -1)</code>", "<code class='tok'>dp[c-w]</code> is still the previous row", "Each item contributes at most once", "Use when supply is limited to one"] },
            good: { title: "Upward loop \u2192 unbounded", items: ["<code class='tok'>for c in range(w, W+1)</code>", "<code class='tok'>dp[c-w]</code> may already include this item", "Each item contributes any number of times", "Use when supply is unlimited"] }
          },
          { t: "note", variant: "tip", html: "The two functions differ by one <code class='tok'>range</code> call. That is a gift in an interview: write 0/1, then say <em>\u201cif items were unlimited I would flip the inner loop upward, because reusing the already-updated cell is exactly what reuse means\u201d</em>. It demonstrates you understand the mechanism instead of having memorised two snippets." },
          { t: "h", text: "Subset-sum and partition, wearing a costume" },
          { t: "p", html: "<em>\u201cIs there a subset summing to exactly T?\u201d</em> is 0/1 knapsack where value equals weight and the table stores booleans instead of values. <em>\u201cSplit the array into two equal-sum halves\u201d</em> is the same question with T = total/2, unachievable when the total is odd. Same table, same downward loop, same O(n\u00b7T)." },
          { t: "code", lang: "python", code:
            "def can_partition(nums):\n" +
            "    total = sum(nums)\n" +
            "    if total % 2:\n" +
            "        return False                   # odd total -> no equal split\n" +
            "    T = total // 2\n" +
            "    reachable = [False] * (T + 1)\n" +
            "    reachable[0] = True                # the empty subset\n" +
            "    for x in nums:\n" +
            "        for s in range(T, x - 1, -1):  # downward: each number once\n" +
            "            if reachable[s - x]:\n" +
            "                reachable[s] = True\n" +
            "    return reachable[T]"
          },
          { t: "note", variant: "trap", html: "<strong>O(n\u00b7W) is pseudo-polynomial, not polynomial \u2014 be honest about this.</strong> Complexity is measured against the <em>length</em> of the encoded input, and a capacity of one billion is written in about 30 bits. A table with a billion columns is therefore exponential in those 30 bits. Practically: n = 100 with W = 10\u2074 is a million cells and trivial; the same n with W = 10\u2079 is impossible. This is also why subset-sum is NP-complete despite having an algorithm any candidate can write \u2014 saying so unprompted is a genuine senior signal." },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> The moment you see a <em>capacity, budget, weight limit, target sum</em> or <em>exact amount</em> paired with a set of items you choose from. Then answer two questions in order: <strong>is supply limited to one per item?</strong> (yes \u2192 0/1, downward loop; no \u2192 unbounded, upward loop) and <strong>is the numeric bound small enough to be a table dimension?</strong> If W is huge, the shape is right but the table is not \u2014 look for a greedy structure or meet-in-the-middle instead. See the <a href=\"#/cpat/structures/dp-taxonomy\">DP taxonomy</a> for how this shape sits beside the other four." },
          { t: "note", variant: "key", html: "<strong>One loop direction, two different problems.</strong> Downward keeps <code class='tok'>dp[c-w]</code> in the previous row, so each item is used at most once; upward lets <code class='tok'>dp[c-w]</code> already contain the item, so it can be reused. Say the reason, not the rule \u2014 anyone can memorise a direction, and interviewers ask precisely because so few can explain it." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "range-structures",
        title: "Range queries when the array changes",
        summary: "Fenwick trees for prefix sums with point updates, segment trees for any associative range query, and the honest test for when a prefix-sum array is still the right answer.",
        minutes: 10,
        tags: ["fenwick", "bit", "segment-tree", "range-query"],
        blocks: [
          { t: "p", html: "A prefix-sum array answers any range sum with one subtraction. It has exactly one weakness: change a single element and every prefix after it is wrong, so a write costs O(n) to repair. Range structures exist to remove that weakness, and they charge O(log n) per query for the privilege. The judgement call is whether you are actually paying for something you need." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "Many range queries <strong>interleaved with updates</strong> \u2014 the update is the tell, not the query.",
              "Running counts over a shifting window: rank queries, inversion counting, \u201chow many so far are less than x\u201d.",
              "Range min, max or gcd rather than a sum \u2014 those cannot be undone by subtraction.",
              "A prefix-sum solution you already wrote that turns quadratic the moment the problem adds \u201cand then element i changes\u201d."
            ]
          },
          {
            t: "table",
            headers: ["", "Prefix array", "Fenwick tree", "Segment tree"],
            rows: [
              ["Build", "O(n)", "O(n)", "O(n)"],
              ["Range query", "O(1)", "O(log n)", "O(log n)"],
              ["Point update", "O(n)", "O(log n)", "O(log n)"],
              ["Memory", "n + 1 numbers", "n + 1 numbers", "\u2248 2n numbers (4n with the recursive layout)"],
              ["Operations supported", "Invertible aggregates (sum, xor)", "Invertible aggregates (sum, xor)", "Any associative combine (sum, min, max, gcd)"],
              ["Code volume", "Three lines", "Two short loops", "A small class"]
            ]
          },
          { t: "h", text: "When the prefix array is still right" },
          { t: "p", html: "If the array never changes after construction, stop here \u2014 a prefix array is O(1) per query and a tree is O(log n), so the tree is strictly worse. On 100,000 elements with a million queries that is roughly 1.1 million operations for the prefix array, against some 17 million for a Fenwick tree \u2014 log\u2082\u00a0100,000 \u2248 17 steps per query \u2014 and about double that for a segment tree, which descends to both ends of the range. Reach for a tree only when updates are real. Use the lab below to put numbers on your own workload rather than guessing." },
          { t: "widget", id: "cpatRangeLab" },
          { t: "h", text: "The Fenwick tree" },
          { t: "p", html: "A <strong>Fenwick tree</strong> (binary indexed tree) is an array of the same length as your data, in which slot <code class='tok'>i</code> stores the sum of the <code class='tok'>i &amp; -i</code> elements ending at <code class='tok'>i</code>. That expression isolates the lowest set bit, so slot 8 covers eight elements, slot 12 covers four, slot 7 covers one. Every prefix decomposes into at most <code class='tok'>log\u2082 n</code> of these blocks, which is where both bounds come from." },
          { t: "p", html: "A prefix query starts at <code class='tok'>i</code> and repeatedly <em>strips</em> the lowest set bit, accumulating as it goes. An update starts at <code class='tok'>i</code> and repeatedly <em>adds</em> the lowest set bit, touching each slot whose block covers <code class='tok'>i</code>. Each walk visits at most one index per bit position, so both are <strong>O(log n)</strong>." },
          { t: "code", lang: "python", code:
            "class Fenwick:\n" +
            "    \"\"\"Prefix sums with point updates. 1-based internally, 0-based API.\"\"\"\n" +
            "\n" +
            "    def __init__(self, arr):\n" +
            "        self.n = len(arr)\n" +
            "        self.t = [0] * (self.n + 1)\n" +
            "        for i in range(1, self.n + 1):        # O(n) build\n" +
            "            self.t[i] += arr[i - 1]\n" +
            "            j = i + (i & -i)                  # this slot's parent\n" +
            "            if j <= self.n:\n" +
            "                self.t[j] += self.t[i]\n" +
            "\n" +
            "    def add(self, i, delta):                  # arr[i] += delta, O(log n)\n" +
            "        i += 1\n" +
            "        while i <= self.n:\n" +
            "            self.t[i] += delta\n" +
            "            i += i & -i                       # climb to the next block\n" +
            "\n" +
            "    def prefix(self, i):                      # sum of arr[0:i], O(log n)\n" +
            "        s = 0\n" +
            "        while i > 0:\n" +
            "            s += self.t[i]\n" +
            "            i -= i & -i                       # strip the lowest set bit\n" +
            "        return s\n" +
            "\n" +
            "    def range_sum(self, lo, hi):              # [lo, hi), O(log n)\n" +
            "        return self.prefix(hi) - self.prefix(lo)"
          },
          { t: "note", variant: "tip", html: "The <code class='tok'>O(n)</code> build above is worth knowing. The obvious construction calls <code class='tok'>add</code> n times for O(n log n); propagating each finished slot into its parent in a single pass gets the same tree in linear time, and it is three lines." },
          { t: "h", text: "The segment tree" },
          { t: "p", html: "A <strong>segment tree</strong> stores your data in the leaves of a binary tree and each internal node holds the combination of its two children. Build is <strong>O(n)</strong> because there are about 2n nodes and each is computed once. A query descends to the boundaries of the range and stitches together the O(log n) maximal nodes fully inside it; an update rewrites a leaf and walks up its ancestors. Both are <strong>O(log n)</strong>." },
          { t: "p", html: "The reason to prefer it over Fenwick is generality: the combine function need only be <em>associative</em>, so min, max and gcd all work \u2014 operations that cannot be recovered by subtraction and are therefore out of reach for a prefix array or a plain Fenwick tree." },
          { t: "code", lang: "python", code:
            "class SegTree:\n" +
            "    \"\"\"Iterative segment tree over any associative combine.\"\"\"\n" +
            "\n" +
            "    def __init__(self, arr, combine, identity):\n" +
            "        self.n = len(arr)\n" +
            "        self.f = combine\n" +
            "        self.idty = identity\n" +
            "        self.t = [identity] * (2 * self.n)\n" +
            "        for i, x in enumerate(arr):\n" +
            "            self.t[self.n + i] = x            # leaves\n" +
            "        for i in range(self.n - 1, 0, -1):    # O(n) build\n" +
            "            self.t[i] = combine(self.t[2 * i], self.t[2 * i + 1])\n" +
            "\n" +
            "    def update(self, i, x):                   # O(log n)\n" +
            "        i += self.n\n" +
            "        self.t[i] = x\n" +
            "        i //= 2\n" +
            "        while i >= 1:\n" +
            "            self.t[i] = self.f(self.t[2 * i], self.t[2 * i + 1])\n" +
            "            i //= 2\n" +
            "\n" +
            "    def query(self, lo, hi):                  # [lo, hi), O(log n)\n" +
            "        left, right = self.idty, self.idty\n" +
            "        lo += self.n\n" +
            "        hi += self.n\n" +
            "        while lo < hi:\n" +
            "            if lo & 1:\n" +
            "                left = self.f(left, self.t[lo])\n" +
            "                lo += 1\n" +
            "            if hi & 1:\n" +
            "                hi -= 1\n" +
            "                right = self.f(self.t[hi], right)\n" +
            "            lo //= 2\n" +
            "            hi //= 2\n" +
            "        return self.f(left, right)\n" +
            "\n" +
            "# Range minimum:  SegTree(arr, min, float('inf'))\n" +
            "# Range sum:      SegTree(arr, lambda a, b: a + b, 0)"
          },
          { t: "note", variant: "trap", html: "Two classic mistakes. First, building a segment tree for a static array \u2014 you have paid a class and a log factor to be slower than three lines of prefix sums. Second, reaching for Fenwick when the operation is <em>range minimum</em>: the query walk relies on subtracting one prefix from another, and minima do not subtract. Fenwick can be coaxed into prefix-minimum with restrictions, but the honest answer in an interview is a segment tree." },
          { t: "note", variant: "tip", html: "Keep the boundary convention identical everywhere \u2014 both structures above use half-open <code class='tok'>[lo, hi)</code>. Mixing half-open queries with inclusive updates is where the off-by-ones in this material live, and they produce answers that are correct on most inputs and wrong at the edges." },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Ask one question: <em>does the array change between queries?</em> If no, a prefix-sum array wins outright. If yes, ask what is being aggregated: <strong>sums or xor</strong> \u2192 Fenwick, smallest and fastest to write; <strong>min, max, gcd or anything non-invertible</strong> \u2192 segment tree; <strong>range updates as well as range queries</strong> \u2192 segment tree with lazy propagation. For counting problems, remember the Fenwick trick of indexing by <em>value</em> rather than position so that <code class='tok'>prefix(v)</code> answers \u201chow many seen so far are below v\u201d." },
          { t: "note", variant: "key", html: "<strong>The update, not the query, is what buys the tree.</strong> Both trees give O(log n) queries and O(log n) updates on an O(n) build; a prefix array gives O(1) queries and O(n) updates. Name the read/write mix out loud before choosing, and you will pick correctly every time \u2014 and you will avoid writing a segment tree for an array nobody ever modifies." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "design-problems",
        title: "Design problems: pick the pair whose weaknesses cancel",
        summary: "The interview category where you are handed an API and a complexity budget — random-access sets, min-stacks, lazy iterators, hit counters — and the one move that solves all of them.",
        minutes: 11,
        tags: ["design", "simulation", "data-structures", "api"],
        blocks: [
          { t: "p", html: "This category looks different from everything else in the app. There is no array to scan and no path to find: you are handed a <strong>class signature and a complexity budget</strong> \u2014 <em>implement insert, delete and getRandom, all in O(1)</em> \u2014 and asked to build something that meets it. It comes up constantly and it is the round most candidates have never practised." },
          { t: "h", text: "Recognition triggers" },
          {
            t: "ul", items: [
              "The prompt names a class and lists its methods rather than describing an input and an output.",
              "A per-operation budget is stated explicitly: <em>\u201call operations in O(1)\u201d</em>, <em>\u201cO(1) amortised\u201d</em>, <em>\u201cO(log n) is acceptable\u201d</em>.",
              "The word <em>iterator</em>, <em>stream</em>, <em>cache</em>, <em>counter</em>, or <em>\u201csupporting\u201d</em> followed by a list of operations.",
              "Operations arrive over time and the structure must stay correct after every one, not just at the end."
            ]
          },
          { t: "h", text: "The one move: combine structures whose weaknesses cancel" },
          { t: "p", html: "No single structure meets these budgets, and that is the point of the question. A hash map gives O(1) lookup by key but has no positional index. An array gives O(1) access by index but O(n) removal by value. Neither can do all three operations \u2014 <em>together they can</em>, because each one covers exactly what the other lacks. Every problem below is an instance of that move, so learn the move rather than the four snippets." },
          { t: "h", text: "1 \u00b7 Insert, delete and getRandom in O(1)" },
          { t: "p", html: "Store the values in a dynamic array so a uniform random draw is one index. Store a map from value to its index in that array so delete can find it. The trick that keeps it O(1) is the removal: never shift, <strong>swap the victim with the last element</strong> and pop the tail, so the array stays dense and no holes appear." },
          { t: "code", lang: "python", code:
            "class RandomSet:\n" +
            "    \"\"\"insert / delete / get_random, all O(1) average.\"\"\"\n" +
            "\n" +
            "    def __init__(self):\n" +
            "        self.items = []      # dense array -> O(1) random index\n" +
            "        self.pos = {}        # value -> index in items -> O(1) lookup\n" +
            "\n" +
            "    def insert(self, x):\n" +
            "        if x in self.pos:\n" +
            "            return False\n" +
            "        self.pos[x] = len(self.items)\n" +
            "        self.items.append(x)\n" +
            "        return True\n" +
            "\n" +
            "    def delete(self, x):\n" +
            "        if x not in self.pos:\n" +
            "            return False\n" +
            "        i = self.pos.pop(x)\n" +
            "        tail = self.items.pop()\n" +
            "        if i < len(self.items):          # x was not already the tail\n" +
            "            self.items[i] = tail         # move the tail into the hole\n" +
            "            self.pos[tail] = i           # <- the line everyone forgets\n" +
            "        return True\n" +
            "\n" +
            "    def get_random(self, rand_below):    # rand_below(k) -> 0..k-1\n" +
            "        return self.items[rand_below(len(self.items))]"
          },
          { t: "note", variant: "trap", html: "Two failures here, both silent. Forgetting <code class='tok'>self.pos[tail] = i</code> leaves the map pointing at a stale index, and the structure returns wrong answers only after a specific delete-then-delete sequence. And deleting the tail element itself must not write it back \u2014 the <code class='tok'>i &lt; len(self.items)</code> guard exists for exactly that case. Walk both paths out loud when you present it." },
          { t: "h", text: "2 \u00b7 A stack that reports its minimum in O(1)" },
          { t: "p", html: "A stack cannot be scanned for its minimum in constant time, and a heap cannot pop in stack order. Run both disciplines in parallel: alongside the values, keep a second stack where entry <code class='tok'>i</code> holds the minimum of everything at or below <code class='tok'>i</code>. Because pushes and pops happen at the same end, the two stacks stay aligned forever and every operation stays O(1)." },
          { t: "code", lang: "python", code:
            "class MinStack:\n" +
            "    def __init__(self):\n" +
            "        self.vals = []\n" +
            "        self.mins = []                    # mins[i] = min(vals[0..i])\n" +
            "\n" +
            "    def push(self, x):\n" +
            "        self.vals.append(x)\n" +
            "        if self.mins and self.mins[-1] < x:\n" +
            "            self.mins.append(self.mins[-1])\n" +
            "        else:\n" +
            "            self.mins.append(x)\n" +
            "\n" +
            "    def pop(self):\n" +
            "        self.mins.pop()                   # stays aligned with vals\n" +
            "        return self.vals.pop()\n" +
            "\n" +
            "    def get_min(self):\n" +
            "        return self.mins[-1]              # O(1)"
          },
          { t: "h", text: "3 \u00b7 A lazy iterator over a nested structure" },
          { t: "p", html: "Flattening everything up front is O(total) memory and defeats the purpose of an iterator. Keep a <strong>stack of iterators</strong>, innermost on top, and buffer exactly one value. <code class='tok'>has_next</code> advances only far enough to prove that a value exists and parks it; <code class='tok'>next</code> hands over the parked value. That separation is what makes repeated <code class='tok'>has_next</code> calls safe \u2014 the usual bug in this problem is a <code class='tok'>has_next</code> that consumes." },
          { t: "code", lang: "python", code:
            "class FlatIterator:\n" +
            "    \"\"\"Lazily walks a nested list. Assumes no None values in the data.\"\"\"\n" +
            "\n" +
            "    def __init__(self, nested):\n" +
            "        self.stack = [iter(nested)]      # innermost iterator on top\n" +
            "        self.peeked = None               # at most one buffered value\n" +
            "\n" +
            "    def has_next(self):\n" +
            "        if self.peeked is not None:\n" +
            "            return True                  # already buffered; do NOT advance\n" +
            "        while self.stack:\n" +
            "            item = next(self.stack[-1], None)\n" +
            "            if item is None:\n" +
            "                self.stack.pop()         # this level is exhausted\n" +
            "            elif isinstance(item, list):\n" +
            "                self.stack.append(iter(item))   # descend\n" +
            "            else:\n" +
            "                self.peeked = item       # park one real value\n" +
            "                return True\n" +
            "        return False\n" +
            "\n" +
            "    def next(self):\n" +
            "        if not self.has_next():\n" +
            "            raise StopIteration\n" +
            "        v = self.peeked\n" +
            "        self.peeked = None\n" +
            "        return v"
          },
          { t: "h", text: "4 \u00b7 A hit counter over a sliding time window" },
          { t: "p", html: "Count hits in the trailing 300 seconds. The obvious answer is a queue of timestamps, evicting from the front \u2014 O(1) amortised, but memory grows with traffic, and a burst of a million hits in one second stores a million entries. The better answer bounds memory by the <em>window</em> instead: 300 slots in a ring, each holding a second number and a count, with a stale slot reset on first touch." },
          { t: "code", lang: "python", code:
            "class HitCounter:\n" +
            "    \"\"\"Hits in the trailing W seconds. Memory is O(W), not O(hits).\"\"\"\n" +
            "\n" +
            "    W = 300\n" +
            "\n" +
            "    def __init__(self):\n" +
            "        self.second = [0] * self.W       # which second this slot holds\n" +
            "        self.count = [0] * self.W        # hits during that second\n" +
            "\n" +
            "    def hit(self, t):                    # O(1)\n" +
            "        i = t % self.W\n" +
            "        if self.second[i] != t:\n" +
            "            self.second[i] = t           # slot was stale -> recycle it\n" +
            "            self.count[i] = 0\n" +
            "        self.count[i] += 1\n" +
            "\n" +
            "    def get_hits(self, t):               # O(W), independent of traffic\n" +
            "        total = 0\n" +
            "        for i in range(self.W):\n" +
            "            if t - self.second[i] < self.W:\n" +
            "                total += self.count[i]\n" +
            "        return total"
          },
          { t: "note", variant: "tip", html: "Say the trade-off rather than picking silently: the deque is O(1) per query but O(hits) memory; the ring is O(W) per query but O(W) memory regardless of load. Under a burst the ring is the one that survives. Naming which resource you chose to bound is most of the credit in a design question." },
          { t: "h", text: "5 \u00b7 Insert, getMin and getMax cheaply" },
          { t: "p", html: "The right answer depends entirely on how things leave. If removal is <strong>LIFO</strong>, the parallel-stack trick above extends directly \u2014 keep a running-max stack alongside the running-min stack and everything stays O(1). If removals are <strong>arbitrary</strong>, no stack can help: use a balanced search tree or ordered multiset for O(log n) on all three, or keep a min-heap and a max-heap plus a set of removed ids and skip stale tops on pop \u2014 the same <strong>lazy deletion</strong> idea used in <a href=\"#/cpat/graphs/dijkstra\">the heap-based Dijkstra</a>." },
          {
            t: "table",
            headers: ["Required API", "Pair the structures", "Per-operation cost"],
            rows: [
              ["insert / delete / getRandom", "Dense array (random index) + hash map (value \u2192 index)", "O(1) average, all three"],
              ["push / pop / getMin", "Value stack + parallel running-minimum stack", "O(1), all three"],
              ["next / hasNext over nesting", "Stack of iterators + a one-value buffer", "O(1) amortised, O(depth) memory"],
              ["hit / getHits over W seconds", "Ring of W buckets (second, count)", "O(1) hit, O(W) query, O(W) memory"],
              ["insert / getMin / getMax, LIFO removal", "Value stack + min stack + max stack", "O(1), all three"],
              ["insert / getMin / getMax, arbitrary removal", "Balanced tree, or two heaps + lazy deletion", "O(log n)"]
            ]
          },
          { t: "note", variant: "trap", html: "The classic mistake is claiming a budget the structure does not meet. A hash set alone cannot do <code class='tok'>getRandom</code> in O(1) \u2014 there is no positional index, so a uniform draw means walking it. A sorted array cannot do O(1) insert. A heap cannot do O(1) arbitrary delete. Before you answer, walk each method against your chosen pair and say its cost out loud; an unmet budget you did not notice is worse than one you flagged." },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> The moment the prompt hands you a class and a per-operation budget instead of an input and an output. Then work in this order: <strong>list the operations</strong>, <strong>write the budget beside each one</strong>, <strong>name the single structure that satisfies the most of them</strong>, and <strong>add a second structure that covers what the first cannot</strong>. Almost every answer in this category is one map plus one sequential structure, kept in sync. If your pairing still misses a budget, the missing capability names the structure you have not reached for yet." },
          { t: "p", html: "One track remains. <a href='#/aiec/overview/format'>AI-Enabled Coding</a> takes everything above and changes the conditions: the same families, worked with an AI pair that types faster than you and is wrong often enough to matter. The judgement you have been building here is exactly what that round scores \u2014 <a href='#/aiec/aipatterns/dp'>naming the recurrence before any code exists</a> is worth more when something else is doing the typing, not less." },
          { t: "note", variant: "key", html: "<strong>That is the whole track.</strong> You now have the ordering algorithms, weighted shortest paths and spanning trees for <a href=\"#/cpat/graphs/grid-as-graph\">explicit and implicit graphs</a>; the <a href=\"#/cpat/structures/dp-taxonomy\">five DP shapes</a> and the knapsack loop directions; the <a href=\"#/cpat/structures/range-structures\">range structures</a> for when the array moves under you; and the design move above. The through-line is the same in all of them \u2014 <em>name the model, name what it costs, and name the case where it breaks</em>. Candidates who can do that reliably are not solving harder problems than everyone else; they are just never solving the wrong one." },
          { t: "quiz", id: "cpat-structures" }
        ]
      }
    ]
  };

  /* =================================================================
     TRACK REGISTRATION — order-independent, push only.
     A sibling file owns cpat's name / short / color / blurb and its
     other modules. Never plain-assign window.TRACKS.cpat.
     ================================================================= */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.cpat || (window.TRACKS.cpat = { id: "cpat", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MODULE_GRAPHS, MODULE_STRUCTURES);
})();
