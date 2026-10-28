/* =====================================================================
   CODEX · AI-Enabled Coding — Problem Breakdowns + Closing The Loop
   Adds two modules to window.TRACKS.aiec (track metadata is owned by a
   sibling file — this file only pushes modules onto it).
   Registers: QUIZZES["aiec-aibreakdowns"], QUIZZES["aiec-aiecreview"],
              Widgets.aiecBenchLab
   Self-contained. No external links, no dependencies, no build step.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     WIDGET — naive vs smarter, at scale
     ================================================================= */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var k;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number"
        ? document.createTextNode(String(kid))
        : kid);
    }
    return el;
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function log2(x) { return Math.log(x) / Math.LN2; }

  /* Work-units per second, used only to turn an operation count into an
     order-of-magnitude feel. Illustrative, not measured. A dynamic-programming
     cell costs more than an array read, so tasks carry their own rate. */
  var DEFAULT_RATE = 2e8;

  function fmtOps(x) {
    if (!isFinite(x)) return "unbounded";
    if (x < 1000) return String(Math.round(x));
    if (x < 1e6) return (Math.round(x / 100) / 10) + "K";
    if (x < 1e9) return (Math.round(x / 1e5) / 10) + "M";
    if (x < 1e12) return (Math.round(x / 1e8) / 10) + "B";
    return x.toExponential(1);
  }

  function fmtRatio(r) {
    if (!isFinite(r) || r > 1e6) return r.toExponential(1) + "\u00d7";
    if (r < 10) return (Math.round(r * 10) / 10) + "\u00d7";
    return Math.round(r) + "\u00d7";
  }

  function fmtTime(ops, rate) {
    var s = ops / (rate || DEFAULT_RATE);
    if (s < 0.001) return "well under a millisecond";
    if (s < 1) return "roughly " + Math.round(s * 1000) + " ms";
    if (s < 90) return "roughly " + (Math.round(s * 10) / 10) + " s";
    if (s < 7200) return "roughly " + Math.round(s / 60) + " min";
    if (s < 259200) return "roughly " + Math.round(s / 3600) + " hours";
    return "it never finishes";
  }

  var BENCH_TASKS = [
    {
      label: "maze-solver",
      unit: "cell expansions",
      naiveName: "exhaustive DFS over every route",
      smartName: "BFS in layers",
      model: "Naive is modelled as 2^\u221aN, an illustrative stand-in for exponential route enumeration; BFS is N.",
      sizes: [
        { label: "8 \u00d7 8 grid", detail: "64 cells", n: 64 },
        { label: "40 \u00d7 40 grid", detail: "1,600 cells", n: 1600 },
        { label: "200 \u00d7 200 grid", detail: "40,000 cells", n: 40000 }
      ],
      naive: function (s) { return Math.pow(2, Math.sqrt(s.n)); },
      smart: function (s) { return s.n; }
    },
    {
      label: "spell-checker",
      unit: "DP cells",
      naiveName: "full edit distance against every word",
      smartName: "length + prefix pruning, banded DP",
      rate: 1e8,
      model: "Both are linear in dictionary size. Pruning keeps about 3% of words and the band cuts each comparison from 8\u00d78 to 8\u00d75 cells \u2014 a constant-factor win, not an asymptotic one.",
      sizes: [
        { label: "2,000-word dictionary", detail: "a toy fixture", n: 2000 },
        { label: "60,000-word dictionary", detail: "a working vocabulary", n: 60000 },
        { label: "500,000-word dictionary", detail: "names and inflections", n: 500000 }
      ],
      naive: function (s) { return s.n * 64; },
      smart: function (s) { return Math.max(1, Math.round(s.n * 0.03)) * 40; }
    },
    {
      label: "kitchen-queue",
      unit: "comparisons",
      naiveName: "linear scan for the next ready order",
      smartName: "binary heap keyed on ready time",
      model: "Naive is n\u00b2; the heap is 2n\u00b7log\u2082n for one push and one pop per order.",
      sizes: [
        { label: "50 orders", detail: "one dinner service", n: 50 },
        { label: "5,000 orders", detail: "a week, replayed", n: 5000 },
        { label: "200,000 orders", detail: "a planning simulation", n: 200000 }
      ],
      naive: function (s) { return s.n * s.n; },
      smart: function (s) { return 2 * s.n * log2(s.n); }
    },
    {
      label: "connect-four",
      unit: "board probes",
      naiveName: "rescan the whole board after each move",
      smartName: "walk only the four lines through the last move",
      model: "Naive is moves \u00d7 R \u00d7 C \u00d7 4 directions; incremental is moves \u00d7 24 probes, independent of board size.",
      sizes: [
        { label: "6 \u00d7 7 board, 21 moves", detail: "one human game", R: 6, C: 7, M: 21 },
        { label: "12 \u00d7 12 board, 80 moves", detail: "a generalised board", R: 12, C: 12, M: 80 },
        { label: "60 \u00d7 60 board, 1,500 moves", detail: "a bot playing itself", R: 60, C: 60, M: 1500 }
      ],
      naive: function (s) { return s.M * s.R * s.C * 4; },
      smart: function (s) { return s.M * 24; }
    }
  ];

  var SIZE_LABELS = ["small", "interview-scale", "large"];

  function verdictFor(naive, ratio) {
    if (naive > 1e9) {
      return "The naive version does not finish at this size. That is not a trade-off to weigh \u2014 the smarter one is the only one that exists.";
    }
    if (ratio < 3) {
      return "Both are instant here. Write the naive one, say in a sentence why it is fine at this size, and spend the saved minutes on tests.";
    }
    if (ratio < 25) {
      return "A real but survivable gap. Either choice is defensible \u2014 what is not defensible is picking one without naming the gap out loud.";
    }
    if (ratio < 500) {
      return "Worth the extra code. The smarter version is now the default answer and the naive one is the thing you mention, then discard.";
    }
    return "Not optional. At this size the naive version is the difference between a demo and something you could ship.";
  }

  Widgets.aiecBenchLab = function (mount) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "bench lab"),
      h("h3", null, "Naive vs smarter, at scale")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Pick a task and an input size. The figures are computed from the two complexities in the "
      + "lesson, and the wall-clock column is an order-of-magnitude feel, not a measurement."));

    var taskIndex = 0;
    var sizeIndex = 1;

    var taskSeg = h("div", { class: "w-seg" });
    var sizeSeg = h("div", { class: "w-seg" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function segButtons(wrap, labels, getIndex, setIndex) {
      var buttons = [];
      labels.forEach(function (lab, i) {
        var b = h("button", { class: "w-seg-btn" + (i === getIndex() ? " active" : "") }, lab);
        b.addEventListener("click", function () {
          setIndex(i);
          buttons.forEach(function (other, j) {
            if (j === i) other.classList.add("active");
            else other.classList.remove("active");
          });
          render();
        });
        buttons.push(b);
        wrap.appendChild(b);
      });
    }

    function bar(label, widthPct, tone) {
      var fill = h("i", null);
      fill.style.display = "inline-block";
      fill.style.height = "10px";
      fill.style.width = widthPct + "%";
      fill.style.background = tone;
      fill.style.borderRadius = "5px";
      var row = h("div", null, h("small", null, label), h("br", null), fill);
      row.style.margin = "6px 0";
      return row;
    }

    function render() {
      var task = BENCH_TASKS[taskIndex] || BENCH_TASKS[0];
      var size = task.sizes[sizeIndex] || task.sizes[0];
      var naive = 1, smart = 1;
      try {
        naive = task.naive(size);
        smart = task.smart(size);
      } catch (e) {
        naive = 1; smart = 1;
      }
      if (!isFinite(naive) || naive < 1) naive = 1;
      if (!isFinite(smart) || smart < 1) smart = 1;
      var ratio = naive / smart;

      var big = Math.max(naive, smart);
      var scale = Math.log(big + 1);
      var naiveW = scale > 0 ? Math.max(4, Math.round((Math.log(naive + 1) / scale) * 100)) : 100;
      var smartW = scale > 0 ? Math.max(4, Math.round((Math.log(smart + 1) / scale) * 100)) : 100;

      clear(stage);
      stage.appendChild(bar("naive \u2014 " + task.naiveName, naiveW, "var(--rose, #f87171)"));
      stage.appendChild(bar("smarter \u2014 " + task.smartName, smartW, "var(--lime, #a3e635)"));

      clear(readout);
      readout.appendChild(h("span", { class: "ro" },
        task.label + " \u00b7 " + SIZE_LABELS[sizeIndex] + " \u00b7 " + size.label + " (" + size.detail + ")"));
      readout.appendChild(h("span", { class: "ro" },
        "naive: " + fmtOps(naive) + " " + task.unit + " \u2014 " + fmtTime(naive, task.rate)));
      readout.appendChild(h("span", { class: "ro" },
        "smarter: " + fmtOps(smart) + " " + task.unit + " \u2014 " + fmtTime(smart, task.rate)));
      readout.appendChild(h("span", { class: "ro" },
        "ratio: " + fmtRatio(ratio) + " less work"));
      readout.appendChild(h("span", { class: "ro" }, verdictFor(naive, ratio)));
      readout.appendChild(h("span", { class: "ro" }, task.model));
    }

    segButtons(taskSeg, BENCH_TASKS.map(function (t) { return t.label; }),
      function () { return taskIndex; },
      function (i) { taskIndex = i; });
    segButtons(sizeSeg, SIZE_LABELS,
      function () { return sizeIndex; },
      function (i) { sizeIndex = i; });

    mount.appendChild(taskSeg);
    mount.appendChild(sizeSeg);
    mount.appendChild(stage);
    mount.appendChild(readout);
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "aiec-aibreakdowns": {
      title: "Problem breakdowns checkpoint",
      sub: "Ten small features, and the judgement calls buried inside them.",
      questions: [
        {
          q: "Your AI pair shuffles the deck with deck.sort(function () { return Math.random() - 0.5; }). What is the strongest objection?",
          options: [
            "It runs in O(n log n) rather than O(n), which is too slow for 52 cards",
            "It mutates the caller's array instead of returning a copy",
            "Math.random() cannot be seeded, so the shuffle is untestable",
            "It does not produce a uniform permutation, and the bias survives eyeballing"
          ],
          answer: 3,
          explain: "A comparison sort assumes a consistent ordering, and a comparator that answers "
            + "randomly is not one, so the resulting distribution depends on the sort's internal access "
            + "pattern and some permutations appear far more often than others. Speed is irrelevant at 52 "
            + "cards; correctness is the whole objection. Fisher-Yates is O(n), four lines, and provably "
            + "uniform. Seeding matters too, but it applies equally to both, so it is not what makes the sort wrong."
        },
        {
          q: "Checking only the four lines through the last move, instead of rescanning a 6x7 board, is roughly a 7x cut in probes. Where does that 7x actually change an outcome?",
          options: [
            "Inside a bot's search, where the check runs once per explored node",
            "During a human game, where each move must resolve within a frame",
            "Only when the board is stored as a flat array rather than nested arrays",
            "Nowhere - the incremental version is purely a readability improvement"
          ],
          answer: 0,
          explain: "A human game is about 21 moves, so both versions finish in well under a millisecond "
            + "and the 7x is invisible. The same routine called several hundred thousand times inside a "
            + "depth-seven search turns that 7x into the difference between roughly a second per move and "
            + "roughly a tenth of a second. Naming the calling context, not the asymptotics, is what makes the choice defensible."
        },
        {
          q: "Length-and-prefix pruning cuts the spell-checker's work by roughly 50x at every dictionary size. How should you describe that improvement?",
          options: [
            "It lowers the complexity to O(log D * m * n)",
            "The complexity stays linear in dictionary size; you bought a large constant factor",
            "It only helps once the dictionary stops fitting in cache",
            "It lowers the complexity to O(m * n), independent of the dictionary"
          ],
          answer: 1,
          explain: "Filtering keeps a fixed fraction of the dictionary, so the work still grows linearly "
            + "with D and the complexity class is unchanged. What you bought is a constant, and a 50x "
            + "constant is exactly the difference between roughly 300 ms and roughly 6 ms per keystroke. "
            + "Saying 'same complexity, fifty times faster, and here is why that is the number that matters' "
            + "is stronger than claiming an asymptotic win you did not get."
        },
        {
          q: "You ship first-fit-decreasing for the container packer. What is the accurate claim to make about the result?",
          options: [
            "Sorting descending makes the greedy optimal, so the container count is minimal",
            "It is optimal when every item is the same size and approximate otherwise",
            "It is an approximation with a proven bound of about 11/9 of the optimum plus a small constant",
            "No bound is known for it, so measuring on your own data is the only honest answer"
          ],
          answer: 2,
          explain: "Bin packing is NP-hard, so an O(n log n) greedy is not finding the optimum and no "
            + "amount of sorting changes that. First-fit-decreasing has a proven worst-case bound of "
            + "11/9 times the optimum plus 6/9 bins, which is a strong and quotable guarantee. Claiming "
            + "optimality you do not have is the answer that ends a round; naming the bound is the answer that passes it."
        },
        {
          q: "The road graph has edges weighted by travel time, and your AI pair hands you a clean, correct BFS. What is wrong with it?",
          options: [
            "BFS is O(V+E), which is too slow once the graph reaches city scale",
            "BFS cannot reconstruct the route without also storing a parent array",
            "BFS is undefined on directed graphs, and one-way streets make the graph directed",
            "BFS minimises edge count, so it returns the fewest-hop route rather than the fastest one"
          ],
          answer: 3,
          explain: "BFS treats every edge as costing the same, so it is only correct when the weights are "
            + "equal. On a weighted graph it will happily return a one-hop back road over a three-hop "
            + "motorway. Dijkstra with a binary heap costs O((V+E) log V) and is correct for non-negative "
            + "weights, so speed was never the issue - the answer is simply wrong, and it looks like a route."
        },
        {
          q: "In the two-hop friend recommender, a candidate reachable through three of your friends should contribute...",
          options: [
            "three points, because the number of two-hop paths is the mutual-friend count",
            "one point, after de-duplicating candidates with a Set",
            "one point per friend but capped at two, to damp celebrity effects",
            "no points, because several paths mean they are already inside your cluster"
          ],
          answer: 0,
          explain: "The number of distinct two-hop paths to a candidate is exactly the number of friends "
            + "you have in common, which is the score you are ranking by. Collapsing the candidate list "
            + "with a Set is a natural-looking cleanup that silently destroys the ranking and leaves "
            + "everyone tied at one. Exclude yourself and your existing friends, cap high-degree hubs if "
            + "you like, but never de-duplicate the increments themselves."
        },
        {
          q: "A DFS maze solver with a visited set passes your first three tests. Which test exposes its actual defect?",
          options: [
            "A maze with no route to the exit, asserting it returns null",
            "A maze with two routes to the exit, asserting the returned one is the shorter",
            "A 500x500 maze, asserting it does not blow the call stack",
            "A maze where the start cell is also the exit"
          ],
          answer: 1,
          explain: "All four tests are worth having, but only one catches the real bug: DFS returns a "
            + "path, not the shortest path, and that is invisible whenever your fixtures have a single "
            + "route. Build a maze with a short corridor and a long detour and assert the returned length. "
            + "BFS is right because it expands in layers, so the first time it touches the exit is by definition a shortest route."
        },
        {
          q: "Which part of the battleship task is the worst thing to hand to the model unsupervised?",
          options: [
            "The function that renders the board as text for debugging",
            "The fixtures that place ships at known coordinates for tests",
            "The cell-to-ship index and the remaining-hits bookkeeping",
            "The random shot generator used by the practice bot"
          ],
          answer: 2,
          explain: "Every real bug in this task is a bookkeeping bug - decrementing on a repeat shot, or "
            + "reporting a ship sunk one hit early. That state is also the part a reviewer cannot verify "
            + "by reading, which is exactly why you own it. Fixtures, rendering and a random bot are "
            + "mechanical, well specified and cheap to check by eye, which makes them ideal to delegate."
        }
      ]
    },

    "aiec-aiecreview": {
      title: "Closing the loop checkpoint",
      sub: "Running the round: orient, plan, drive, verify, narrate.",
      questions: [
        {
          q: "You have 45 minutes, an AI pair, and a small feature to build. What is the highest-value use of the first five minutes?",
          options: [
            "Prompting for a first draft, so there is code on screen to react to",
            "Asking the model to outline three candidate architectures and comparing them",
            "Writing the full test suite, so the model has something concrete to satisfy",
            "Pinning the interface, the invariants, and two or three clarifying questions before any code exists"
          ],
          answer: 3,
          explain: "Generated code becomes an anchor: once it is on screen you will edit it rather than "
            + "reconsider it, and its data model quietly becomes yours. Clarifying questions and a stated "
            + "interface cost almost nothing and determine everything downstream. A full suite is premature "
            + "before you know the shape, and three architectures is a system-design answer to a small feature question."
        },
        {
          q: "The model produces a function that passes every test you wrote, but you cannot explain one of its branches. What do you do?",
          options: [
            "Work out which input reaches that branch, then write the test that pins it - or delete the branch",
            "Delete it and rewrite the whole function yourself to be safe",
            "Ask the model to comment the branch, then move on",
            "Keep it - passing tests are the contract, and reading generated code burns the clock"
          ],
          answer: 0,
          explain: "An unexplained branch is precisely where the defect lives, because your tests clearly "
            + "do not reach it. Finding the input that exercises it either produces a real test or proves "
            + "the branch is dead code you can remove. Rewriting the whole function throws away work that "
            + "was probably fine, and a generated comment tells you what the model believes, not what the code does."
        },
        {
          q: "Which prompt is most likely to cost you time rather than save it?",
          options: [
            "Given this Board object, implement fire(r, c) returning exactly 'miss', 'hit', 'sunk' or 'repeat'.",
            "Write a battleship game in JavaScript.",
            "Write a binary min-heap over an array with a comparator, exposing push, pop and size.",
            "Write six tests for this function, including the empty input and the single-element case."
          ],
          answer: 1,
          explain: "An unscoped prompt returns a whole application with its own data model, its own render "
            + "loop and its own assumptions, none of which match the design you were part-way through. You "
            + "pay to read it, and then it quietly redefines your state shape. The other three are bounded, "
            + "have a stated contract, and produce output you can check in seconds."
        },
        {
          q: "Which failure mode most often costs the offer in this round?",
          options: [
            "Choosing a slower algorithm than the interviewer had in mind",
            "Typing more slowly than the model generates",
            "Accepting generated code you have not read, then being unable to defend it",
            "Writing your tests after the implementation rather than before"
          ],
          answer: 2,
          explain: "The round exists to test judgement and control, so the disqualifying moment is the one "
            + "where you cannot say why a line is there. A slower algorithm you can justify reads as a "
            + "trade-off; unexplained code reads as someone who was carried. Test ordering and typing speed "
            + "are style points by comparison, and neither is what the interviewer writes down."
        },
        {
          q: "What most reliably signals that you are driving rather than riding?",
          options: [
            "Producing more code in the time available than an unassisted candidate would",
            "Never using the model, so every line is provably your own",
            "Accepting suggestions quickly and correcting them afterwards when tests fail",
            "Stating what you expect before you ask, then saying what you got and whether it matched"
          ],
          answer: 3,
          explain: "A prediction made out loud turns every generation into a check on your own model of the "
            + "problem, and it is audible to the interviewer whether you were right or wrong. Volume proves "
            + "nothing, refusing the tool wastes the round's premise, and accept-then-fix hands the design to "
            + "whatever the model happened to produce. Predict, compare, then decide - that is the whole signal."
        }
      ]
    }
  });

  /* =================================================================
     MODULE 1 — Problem Breakdowns
     ================================================================= */
  var LEVEL_HEADERS = ["Level", "On the code", "Out loud"];
  var BENCH_HEADERS = ["Input", "Naive \u2014 work", "Smarter \u2014 work", "Rough wall-clock (illustrative)", "Call"];

  var MODULE_BREAKDOWNS = {
    id: "aibreakdowns",
    name: "Problem Breakdowns",
    icon: "grid",
    lessons: [

      /* ---------------------------------------------------------- 1 */
      {
        id: "battleship",
        title: "1 \u00b7 Battleship: grid state and sunk detection",
        summary: "Model a shot-resolution engine, then replace a per-shot board scan with an index built once at placement.",
        minutes: 9,
        tags: ["ai-pair", "state-modelling", "grid"],
        blocks: [
          { t: "p", html: "This round hands you a <strong>small feature</strong>, not a puzzle. The grader is watching whether you keep hold of the design while a model writes code faster than you can read it. Start with the picture: a battleship engine is <em>one lookup table and two counters</em>. Every bug in it is a bookkeeping bug, and bookkeeping is exactly what a model gets subtly, plausibly wrong." },

          { t: "h", text: "The task" },
          { t: "p", html: "Build the server-side state for a grid game. Ships occupy contiguous cells on an <code class='tok'>R \u00d7 C</code> board. Expose <code class='tok'>place(shipId, cells)</code>, <code class='tok'>fire(r, c)</code> returning exactly one of <code class='tok'>\"miss\"</code>, <code class='tok'>\"hit\"</code>, <code class='tok'>\"sunk\"</code> or <code class='tok'>\"repeat\"</code>, and <code class='tok'>isOver()</code>. No rendering, no networking." },
          { t: "ul", items: [
            "Does a repeat shot consume a turn, or is it a no-op the client should have prevented?",
            "One board or two \u2014 do we need per-player state, or is this instance one player's ocean?",
            "Can ships touch or overlap? Is diagonal placement legal?",
            "Do we need a move history for replay and undo, or only the current position?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Board as a flat array of length <code class='tok'>R*C</code> holding a ship id or <code class='tok'>-1</code>.",
            "A parallel <code class='tok'>shot</code> array of booleans so a repeat is a single lookup.",
            "A <code class='tok'>remaining[shipId]</code> counter set at placement time.",
            "<code class='tok'>fire</code> reads two cells, writes one, and decrements at most one counter.",
            "<code class='tok'>isOver</code> is a single <code class='tok'>afloat</code> counter, not a scan."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["Cell \u2192 ship index and the counters", "You", "This decision fixes every complexity in the file, and it is the part nobody can review by reading"],
            ["<code class='tok'>fire</code> body", "The model, from your signature and return contract", "Mechanical once the state shape is pinned"],
            ["Placement validation (bounds, overlap, contiguity)", "The model", "Tedious, well specified, easy to check with fixtures"],
            ["Test fixtures with ships at known coordinates", "The model", "Pure typing, and you can eyeball it in seconds"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> Keep only the board array. On a hit, decide whether the ship sank by scanning every cell: if any cell of that ship is unshot, it is still afloat. That is <strong>O(R\u00b7C) per shot</strong>, so <strong>O(S\u00b7R\u00b7C)</strong> over a game of <code class='tok'>S</code> shots. It breaks not at game size \u2014 a 10\u00d710 board is 100 cells and nobody notices \u2014 but the first time this class is reused inside a bot that self-plays a hundred thousand games, or on a 1000\u00d71000 campaign map, where a single run turns into something on the order of a hundred billion cell reads." },
          { t: "code", lang: "javascript", code:
            "// Naive: re-derive 'sunk' by scanning the board on every hit.\n" +
            "function fireNaive(state, r, c) {\n" +
            "  var i = r * state.C + c;\n" +
            "  if (state.shot[i]) return \"repeat\";\n" +
            "  state.shot[i] = true;\n" +
            "  var id = state.cell[i];\n" +
            "  if (id < 0) return \"miss\";\n" +
            "  for (var k = 0; k < state.cell.length; k++) {   // O(R*C) every hit\n" +
            "    if (state.cell[k] === id && !state.shot[k]) return \"hit\";\n" +
            "  }\n" +
            "  return \"sunk\";\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Pay the scan once, at placement, and carry the answer forward. <code class='tok'>remaining[id]</code> starts at the ship's length and drops by one per fresh hit; <code class='tok'>afloat</code> drops when a counter reaches zero. Every call is now <strong>O(1)</strong>, with <strong>O(R\u00b7C)</strong> paid once during setup and <strong>O(R\u00b7C + ships)</strong> memory. There is no input size at which this is the wrong choice, which is rare and worth saying." },
          { t: "code", lang: "javascript", code:
            "// Indexed: fire() touches a constant number of slots.\n" +
            "function place(state, id, cells) {\n" +
            "  for (var i = 0; i < cells.length; i++) state.cell[cells[i]] = id;\n" +
            "  state.remaining[id] = cells.length;\n" +
            "  state.afloat++;\n" +
            "}\n\n" +
            "function fire(state, r, c) {\n" +
            "  var i = r * state.C + c;\n" +
            "  if (state.shot[i]) return \"repeat\";     // before any mutation\n" +
            "  state.shot[i] = true;\n" +
            "  var id = state.cell[i];\n" +
            "  if (id < 0) return \"miss\";\n" +
            "  state.remaining[id] -= 1;\n" +
            "  if (state.remaining[id] > 0) return \"hit\";\n" +
            "  state.afloat -= 1;\n" +
            "  return \"sunk\";\n" +
            "}\n\n" +
            "function isOver(state) { return state.afloat === 0; }"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["10\u00d710, 100 shots (one human game)", "~10K cell reads", "~100 reads", "both well under a millisecond", "Either \u2014 say why the scan is fine"],
            ["10\u00d710, 100K shots (bot self-play)", "~10M reads", "~100K reads", "roughly 50 ms vs well under a millisecond", "Index \u2014 the gap is now visible"],
            ["1000\u00d71000 map, 100K shots", "~100B reads", "~100K reads", "roughly 8 minutes vs well under a millisecond", "Index \u2014 the scan is unusable"]
          ] },
          { t: "p", html: "Those figures are illustrative orders of magnitude, not measurements. They are also a reminder that asymptotics alone would have told you to index from the first row, when in reality the first row is a tie \u2014 both versions are contiguous array reads, which the cache loves, and 10,000 of them cost nothing. Grade by the behaviour at the size you actually run at, and name the size." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cHere is my state object with <code class='tok'>cell</code>, <code class='tok'>shot</code>, <code class='tok'>remaining</code> and <code class='tok'>afloat</code>. Write <code class='tok'>fire(r, c)</code> returning exactly one of those four strings. A repeat shot must mutate nothing.\u201d The return contract and the invariant are both pinned, so there is nothing left to invent.",
            "<strong>Worked:</strong> \u201cWrite placement validation only: bounds, contiguity, no overlap. Do not touch <code class='tok'>fire</code>.\u201d Scoping by file region keeps the diff readable.",
            "<strong>Garbage:</strong> \u201cWrite battleship in JavaScript.\u201d You get a full CLI game with its own board format, a render loop and a random AI. None of it fits your state shape, and reading it costs more than writing the function would have."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> firing twice on water returns <code class='tok'>\"miss\"</code> then <code class='tok'>\"repeat\"</code> with counters unchanged; the second-to-last cell of a two-cell ship returns <code class='tok'>\"hit\"</code>; the last returns <code class='tok'>\"sunk\"</code>; sinking every ship flips <code class='tok'>isOver</code>.",
            "<strong>The defect to expect:</strong> a model that decrements <code class='tok'>remaining</code> before the repeat check, so re-firing the same cell sinks a ship. It passes any test that never fires twice at one square."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "A correct state model and a working <code class='tok'>fire</code>, with tests for hit, miss and sunk", "Can walk through what each field holds"],
            ["Senior", "The O(1) index chosen up front; the repeat-shot invariant written down before any code", "Names the reuse case that makes the scan unacceptable, rather than reciting complexity"],
            ["Staff", "The engine has a deliberate boundary \u2014 a bot could drive it without touching internals", "Says which decisions are cheap to reverse later and which are not, and designs for that"]
          ] },

          { t: "note", variant: "key", html: "<strong>The board is the API.</strong> Decide the cell\u2192ship index and the remaining-hits counters before the model writes a line. Every defect in this task is bookkeeping, and bookkeeping is the one thing a reviewer cannot catch by reading." }
        ]
      },

      /* ---------------------------------------------------------- 2 */
      {
        id: "card-game",
        title: "2 \u00b7 Card game: a shuffle you can prove",
        summary: "Encode a deck, shuffle with Fisher-Yates instead of a random comparator, and evaluate a trick with an explicit comparator.",
        minutes: 9,
        tags: ["ai-pair", "randomness", "modelling"],
        blocks: [
          { t: "p", html: "Hold this picture: a deck is <em>an array of 52 integers</em>, a shuffle is <em>a permutation</em>, and a trick is <em>a fold with a comparator</em>. The interesting part of this task is that the popular wrong shuffle is faster to write, looks perfectly random to a human, and passes every test anyone thinks to write. It is the best example in this module of a bug that survives review." },

          { t: "h", text: "The task" },
          { t: "p", html: "Model a standard deck. Deal <code class='tok'>p</code> hands of <code class='tok'>n</code> cards. Given the cards played to a trick, the suit that was led and an optional trump suit, return the index of the winning play. Shuffling must be fair and reproducible under test." },
          { t: "ul", items: [
            "Is there a trump suit, and can it change between hands?",
            "Are aces high, low, or either depending on context?",
            "Do we need reproducible deals \u2014 that is, an injectable random source \u2014 for replays and tests?",
            "Is scoring per trick, or does a whole hand get evaluated poker-style at the end?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Encode a card as an integer <code class='tok'>0..51</code>: <code class='tok'>rank = c % 13</code>, <code class='tok'>suit = (c / 13) | 0</code>. One number, no allocation, trivially comparable.",
            "Shuffle in place with Fisher-Yates, taking the random source as a parameter.",
            "Deal by slicing consecutive runs \u2014 dealing round-robin from a fair shuffle buys nothing.",
            "Write <code class='tok'>beats(a, b, led, trump)</code> as an explicit ladder, then fold the plays through it."
          ] },
          { t: "compare",
            bad: { title: "Hand the model \u201cshuffle this deck\u201d", items: [
              "About half the time you get a random comparator",
              "It looks shuffled, so nothing prompts you to check",
              "The bias only shows up in a distribution test nobody asked for"
            ] },
            good: { title: "Write the shuffle, delegate the comparator", items: [
              "Fisher-Yates is four lines you should own",
              "The trick comparator is rules transcription \u2014 ideal to delegate",
              "You supply the rules ladder; the model writes the branches"
            ] }
          },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> Sort with a comparator that returns a random sign. It is <strong>O(n log n)</strong> and it is <em>not a shuffle</em>. A comparison sort assumes its comparator describes a consistent ordering; a random one does not, so the output distribution is an artefact of the sort algorithm's access pattern. Where it breaks is not an input size \u2014 it is broken at every size, including 52. It just never announces itself." },
          { t: "code", lang: "javascript", code:
            "// WRONG. Non-uniform, and the skew is invisible by eye.\n" +
            "function shuffleNaive(deck) {\n" +
            "  return deck.sort(function () { return Math.random() - 0.5; });\n" +
            "}\n\n" +
            "// The test that exposes it: shuffle [0,1,2] many times and count\n" +
            "// permutations. A fair shuffle gives ~1/6 each; this one does not.\n" +
            "function permutationCounts(shuffle, trials) {\n" +
            "  var counts = {};\n" +
            "  for (var t = 0; t < trials; t++) {\n" +
            "    var key = shuffle([0, 1, 2]).join(\"\");\n" +
            "    counts[key] = (counts[key] || 0) + 1;\n" +
            "  }\n" +
            "  return counts;                 // inspect, do not print\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Fisher-Yates walks from the end, swapping each position with a uniformly chosen index from the <em>unvisited prefix including itself</em>. That is <strong>O(n)</strong> time, <strong>O(1)</strong> extra space, and every one of the <code class='tok'>n!</code> permutations is equally likely. Fifty-one swaps for a deck. It lands, permanently: there is no scale at which you would prefer the sort." },
          { t: "code", lang: "javascript", code:
            "// Fisher-Yates. rnd() must return a float in [0, 1).\n" +
            "function shuffle(a, rnd) {\n" +
            "  for (var i = a.length - 1; i > 0; i--) {\n" +
            "    var j = Math.floor(rnd() * (i + 1));   // 0..i INCLUSIVE\n" +
            "    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;\n" +
            "  }\n" +
            "  return a;\n" +
            "}\n\n" +
            "// Trick evaluation: trump beats led, led beats off-suit, then rank.\n" +
            "function beats(a, b, led, trump) {\n" +
            "  var at = a.suit === trump, bt = b.suit === trump;\n" +
            "  if (at !== bt) return at;\n" +
            "  var al = a.suit === led, bl = b.suit === led;\n" +
            "  if (al !== bl) return al;\n" +
            "  if (a.suit !== b.suit) return false;     // neither can win\n" +
            "  return a.rank > b.rank;\n" +
            "}\n\n" +
            "function trickWinner(plays, led, trump) {\n" +
            "  var best = 0;\n" +
            "  for (var i = 1; i < plays.length; i++) {\n" +
            "    if (beats(plays[i], plays[best], led, trump)) best = i;\n" +
            "  }\n" +
            "  return best;                              // O(p)\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["One 52-card deck", "~300 comparisons", "51 swaps", "both well under a millisecond", "Fisher-Yates \u2014 and it is the only correct one"],
            ["100K deals (a simulation)", "~30M comparisons", "~5M swaps", "roughly 150 ms vs roughly 25 ms", "Fisher-Yates"],
            ["1M-element deck", "~20M comparisons", "1M swaps", "roughly 100 ms vs roughly 5 ms", "Fisher-Yates"]
          ] },
          { t: "p", html: "Roughly six times less work at deck size, and the gap widens with <code class='tok'>log n</code>. Treat these as orders of magnitude rather than measurements \u2014 but note the shape of the result, because it is unusual: normally the faster option costs you something. Here the fast one is <em>also</em> the correct one, so there is no trade-off to weigh and nothing to defend. Say that out loud; recognising when a decision is free is itself a signal." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cWrite Fisher-Yates over this array, taking <code class='tok'>rnd</code> as a parameter so tests can inject a fixed sequence. Swap with an index in <code class='tok'>[0, i]</code> inclusive.\u201d Naming the inclusive range removes the exact ambiguity the model tends to resolve wrongly.",
            "<strong>Worked:</strong> \u201cHere is the precedence ladder: trump, then led suit, then rank. Write <code class='tok'>beats(a, b, led, trump)</code> against it.\u201d Rules transcription is the model's best mode.",
            "<strong>Garbage:</strong> \u201cShuffle this deck.\u201d Frequently returns the random comparator, occasionally returns a shuffle that samples <code class='tok'>j</code> from the whole array each step \u2014 also biased, also invisible."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> the shuffled deck is a permutation of the input (sorted copies are equal); with a stubbed <code class='tok'>rnd</code> the output permutation is exactly the expected one; a three-element array shuffled 60,000 times puts each of the six orderings within a few percent of 10,000.",
            "<strong>The defect to expect:</strong> <code class='tok'>j = Math.floor(rnd() * n)</code> using the full length instead of <code class='tok'>i + 1</code>. That draws <code class='tok'>n\u207f</code> equally likely outcomes onto <code class='tok'>n!</code> permutations, which cannot divide evenly, so some orderings are permanently more likely. Only the distribution test catches it."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Correct Fisher-Yates and a working trick comparator", "Knows the random-comparator shuffle is wrong"],
            ["Senior", "The random source is injected, and a distribution test exists", "Explains <em>why</em> a random comparator breaks a comparison sort, not just that it does"],
            ["Staff", "Card encoding, dealing and evaluation are separable; the RNG is a seam", "Frames it as a correctness property that must be tested, because no reviewer will see it"]
          ] },

          { t: "note", variant: "key", html: "<strong>Sorting by a random comparator is the most-shipped correctness bug in card code.</strong> Fisher-Yates is O(n), four lines, and provably uniform \u2014 write it yourself, take the RNG as a parameter, and add the distribution test that makes the property visible." }
        ]
      },

      /* ---------------------------------------------------------- 3 */
      {
        id: "connect-four",
        title: "3 \u00b7 Connect Four: check the move, not the board",
        summary: "Drop discs in O(1) with a heights array, then replace a full-board win scan with four line walks through the last cell.",
        minutes: 9,
        tags: ["ai-pair", "grid", "incremental"],
        blocks: [
          { t: "p", html: "The mental model that makes this task easy: <em>a new win must pass through the disc you just dropped</em>. Nothing else changed, so nothing else needs checking. That single observation turns a board-sized scan into a constant amount of work, and noticing it before you prompt is the difference between guiding the model and cleaning up after it." },

          { t: "h", text: "The task" },
          { t: "p", html: "Implement <code class='tok'>drop(col, player)</code> for an <code class='tok'>R \u00d7 C</code> board, returning the landing cell or rejecting a full column, and a win check that reports whether the last move completed a run of <code class='tok'>K</code> in any of the four directions. Also report a draw when the board fills." },
          { t: "ul", items: [
            "Fixed 6\u00d77 and K=4, or generalised R\u00d7C and connect-K?",
            "Do we need <code class='tok'>undo</code>? If a bot will search with this, undo is not optional.",
            "Should a win return the winning line, so a UI can highlight it?",
            "Is a full column an exception, a false return, or a validation the caller already did?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Flat board array of length <code class='tok'>R*C</code>, index <code class='tok'>r * C + c</code>. Write that formula down; it is where the bugs live.",
            "<code class='tok'>heights[col]</code> gives the next free row, making <code class='tok'>drop</code> O(1) with no column scan.",
            "Four direction vectors, each walked both ways from the landing cell.",
            "<code class='tok'>undo</code> is <code class='tok'>heights[col]--</code> plus one cell clear \u2014 add it now if a search is coming."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["Index formula and the heights array", "You", "One transposed letter here produces a bug that only shows on non-square boards"],
            ["The four-direction walk", "The model, given the direction list and the bound", "Loop mechanics with a clear contract"],
            ["Edge-case fixtures (each corner, each edge)", "The model", "Volume typing, and you can read it at a glance"],
            ["Whether undo exists at all", "You", "It is an architecture decision disguised as a helper"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> After every move, sweep the board: from each cell, try each of the four directions and check whether <code class='tok'>K</code> matching discs start there. That is <strong>O(R\u00b7C\u00b7K)</strong> per move, so <strong>O(M\u00b7R\u00b7C\u00b7K)</strong> over a game. On 6\u00d77 that is about 170 cell-direction probes per move, which is genuinely nothing. It breaks inside a bot: a depth-seven search on a seven-wide board explores on the order of 800,000 positions, and 170 probes each is roughly 130 million probes for a single move decision." },
          { t: "code", lang: "javascript", code:
            "// Naive: re-derive the whole board's win state after every move.\n" +
            "function isWinNaive(b, R, C, K) {\n" +
            "  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];\n" +
            "  for (var r = 0; r < R; r++) {\n" +
            "    for (var c = 0; c < C; c++) {\n" +
            "      var p = b[r * C + c];\n" +
            "      if (p === 0) continue;\n" +
            "      for (var d = 0; d < 4; d++) {\n" +
            "        var run = 1;\n" +
            "        for (var s = 1; s < K; s++) {\n" +
            "          var rr = r + DIRS[d][0] * s, cc = c + DIRS[d][1] * s;\n" +
            "          if (rr < 0 || rr >= R || cc < 0 || cc >= C) break;\n" +
            "          if (b[rr * C + cc] !== p) break;\n" +
            "          run++;\n" +
            "        }\n" +
            "        if (run >= K) return p;\n" +
            "      }\n" +
            "    }\n" +
            "  }\n" +
            "  return 0;\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Only lines through the last cell can be new, so walk outward from it in each of the four directions, at most <code class='tok'>K-1</code> steps per side, and stop early on a mismatch. That is <strong>O(K)</strong> per move \u2014 at most 24 probes for connect-four \u2014 and it is <em>independent of board size</em>. The total for a game is <strong>O(M\u00b7K)</strong>." },
          { t: "code", lang: "javascript", code:
            "var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];\n\n" +
            "function walk(b, R, C, r, c, dr, dc, p, K) {\n" +
            "  var n = 0;\n" +
            "  for (var s = 1; s < K; s++) {\n" +
            "    var rr = r + dr * s, cc = c + dc * s;\n" +
            "    if (rr < 0 || rr >= R || cc < 0 || cc >= C) break;\n" +
            "    if (b[rr * C + cc] !== p) break;\n" +
            "    n++;\n" +
            "  }\n" +
            "  return n;\n" +
            "}\n\n" +
            "// Only lines through (r, c) can be new. At most 4 * 2 * (K-1) probes.\n" +
            "function isWinAt(b, R, C, r, c, K) {\n" +
            "  var p = b[r * C + c];\n" +
            "  if (p === 0) return false;\n" +
            "  for (var d = 0; d < DIRS.length; d++) {\n" +
            "    var dr = DIRS[d][0], dc = DIRS[d][1];\n" +
            "    var run = 1 + walk(b, R, C, r, c, dr, dc, p, K)\n" +
            "                + walk(b, R, C, r, c, -dr, -dc, p, K);\n" +
            "    if (run >= K) return true;\n" +
            "  }\n" +
            "  return false;\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["6\u00d77, 21 moves (one game)", "~3.5K probes", "~500 probes", "both well under a millisecond", "Either \u2014 and say so"],
            ["12\u00d712, 80 moves", "~46K probes", "~1.9K probes", "both well under a millisecond", "Incremental, on principle"],
            ["60\u00d760, 1,500 moves", "~22M probes", "~36K probes", "roughly 110 ms vs well under a millisecond", "Incremental"],
            ["Depth-7 search, ~800K nodes", "~130M probes", "~19M probes", "roughly 700 ms vs roughly 100 ms", "Incremental \u2014 this is the case that matters"]
          ] },
          { t: "p", html: "Illustrative figures, not measurements \u2014 but read the shape. The ratio is a flat <strong>7\u00d7</strong> on a standard board no matter how many moves you play, because it is just <code class='tok'>R\u00b7C\u00b74 / 24</code>. A constant factor of seven is invisible in a human game and decisive inside a search loop. The honest interview sentence is not \u201cthe incremental one is faster\u201d; it is \u201cthe incremental one is seven times cheaper, which matters only if something calls it hundreds of thousands of times \u2014 so, does it?\u201d" },
          { t: "widget", id: "aiecBenchLab" },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cGiven the last placed cell, return true if it completes a run of K. Do not scan the board \u2014 walk only the four lines through that cell, at most K-1 steps each way, and bound-check on every step.\u201d",
            "<strong>Worked:</strong> \u201cGenerate fixtures for a win at each of the four board corners and one spanning the right edge.\u201d Edge fixtures are exactly what you forget and exactly what a model will happily grind out.",
            "<strong>Garbage:</strong> \u201cAdd win detection.\u201d You get a full-board scanner run after every move, usually with only three of the four directions, and a diagonal loop that reads past the right edge into the next row."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a vertical win, a horizontal win, both diagonals, a win touching each board edge, a rejected full column, and a full board that reports a draw rather than a win.",
            "<strong>The defect to expect:</strong> <code class='tok'>r * R + c</code> instead of <code class='tok'>r * C + c</code>. On a square test board it is correct; on 6\u00d77 it silently reads the wrong cells, and a horizontal run wraps across the row boundary. Always test on a board where <code class='tok'>R !== C</code>."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Correct drop and win detection, tested in all four directions", "Explains why only the last move needs checking"],
            ["Senior", "Heights array, incremental check, undo present if a search is plausible", "Quantifies the 7\u00d7 and says when it stops being free"],
            ["Staff", "Board representation chosen with the caller in mind \u2014 search-friendly, allocation-free", "Names the non-square board test as the guard against the index bug"]
          ] },

          { t: "note", variant: "key", html: "<strong>Only the last move can create a win.</strong> Four line walks of at most K-1 steps each way is O(K) and independent of board size. Test on a board where <code class='tok'>R !== C</code>, or the <code class='tok'>r * C + c</code> bug hides in plain sight." }
        ]
      },

      /* ---------------------------------------------------------- 4 */
      {
        id: "friend-recommender",
        title: "4 \u00b7 Friend recommender: two hops, bounded",
        summary: "Score candidates by mutual connections without touching the whole graph, and cap the frontier so hubs cannot dominate.",
        minutes: 9,
        tags: ["ai-pair", "graphs", "ranking"],
        blocks: [
          { t: "p", html: "Picture the graph, not the loop. Everyone who could plausibly be suggested to you is <em>two hops away</em>, and two hops from any normal person is a few thousand nodes \u2014 not the whole network. The naive solution is not slow because it does expensive work per user; it is slow because it visits users it had no reason to look at." },

          { t: "h", text: "The task" },
          { t: "p", html: "Given an undirected friendship graph, return the top <code class='tok'>k</code> suggestions for user <code class='tok'>u</code>, ranked by the number of friends they share with <code class='tok'>u</code>. Exclude <code class='tok'>u</code> and anyone already connected to <code class='tok'>u</code>. Ties break deterministically." },
          { t: "ul", items: [
            "How many users, and what is the maximum degree? A single hub with half a million edges changes the design.",
            "Is this served live per request, or precomputed nightly? That decides whether O(d\u00b2) per call is acceptable.",
            "Do we need to exclude blocked users and previously dismissed suggestions?",
            "Is the adjacency structure already in memory, or are we paying I/O per neighbour lookup?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Adjacency as a map from user to a set of user ids, so membership is a constant-time probe.",
            "Walk friends of friends, incrementing a count per candidate.",
            "Filter out <code class='tok'>u</code> and <code class='tok'>u</code>'s existing friends after counting, not during \u2014 one predicate, one place.",
            "Take the top <code class='tok'>k</code> with a size-<code class='tok'>k</code> heap rather than sorting the whole candidate list.",
            "Skip friends whose degree exceeds a cap; hubs add cost and almost no signal."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["The two-hop traversal and the counting rule", "You", "The counting rule <em>is</em> the ranking; get it wrong and the feature is quietly meaningless"],
            ["Top-k selection", "The model", "A size-k heap is standard, well specified, easy to test"],
            ["Degree cap and its default", "You", "A product decision about signal, wearing the costume of a performance tweak"],
            ["Graph fixtures (triangle, star, disconnected)", "The model", "Fast to generate, fast to verify"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> For every user <code class='tok'>v</code> in the graph, intersect <code class='tok'>adj[u]</code> with <code class='tok'>adj[v]</code> and record the size. With set probes the intersection costs O(d), so the whole request is <strong>O(V\u00b7d)</strong>. It breaks on <em>graph size</em>, not on degree: at a million users you touch a million adjacency structures per request to find a few thousand candidates, and it does not get better with caching because each user asks a different question." },
          { t: "code", lang: "javascript", code:
            "// Naive: score every user in the graph. O(V * d) per request.\n" +
            "function suggestNaive(adj, u, k) {\n" +
            "  var mine = adj.get(u) || new Set();\n" +
            "  var scored = [];\n" +
            "  adj.forEach(function (friends, v) {\n" +
            "    if (v === u || mine.has(v)) return;\n" +
            "    var shared = 0;\n" +
            "    mine.forEach(function (f) { if (friends.has(f)) shared++; });\n" +
            "    if (shared > 0) scored.push([v, shared]);\n" +
            "  });\n" +
            "  scored.sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });\n" +
            "  return scored.slice(0, k);\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Only visit what can score. For each friend <code class='tok'>f</code> of <code class='tok'>u</code>, walk <code class='tok'>f</code>'s friends and increment a counter per candidate. The cost is the sum of your friends' degrees \u2014 <strong>O(d\u00b2)</strong> for average degree <code class='tok'>d</code>, plus <strong>O(Cand\u00b7log k)</strong> for top-k. Crucially it is <em>independent of V</em>. The degree cap bounds the worst case at <strong>O(d\u00b7D)</strong> so one celebrity friend cannot turn a 40,000-operation request into a 500,000-operation one." },
          { t: "code", lang: "javascript", code:
            "// Two-hop, bounded frontier. Cost is sum of friends' degrees.\n" +
            "function suggest(adj, u, k, degreeCap) {\n" +
            "  var mine = adj.get(u);\n" +
            "  if (!mine) return [];\n" +
            "  var score = new Map();\n" +
            "  mine.forEach(function (f) {\n" +
            "    var theirs = adj.get(f);\n" +
            "    if (!theirs || theirs.size > degreeCap) return;   // skip hubs\n" +
            "    theirs.forEach(function (w) {\n" +
            "      if (w === u || mine.has(w)) return;\n" +
            "      score.set(w, (score.get(w) || 0) + 1);   // one point per path\n" +
            "    });\n" +
            "  });\n" +
            "  var out = [];\n" +
            "  score.forEach(function (n, w) { out.push([w, n]); });\n" +
            "  out.sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });\n" +
            "  return out.slice(0, k);\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["V = 10,000, average degree 100", "~1M set probes", "~10K probes", "roughly 5 ms vs well under a millisecond", "Two-hop"],
            ["V = 1,000,000, average degree 200", "~200M probes", "~40K probes", "roughly 1 s vs well under a millisecond", "Two-hop \u2014 the naive one is a per-request second"],
            ["Same, but one friend has degree 500,000", "~200M probes", "~40K probes (cap on) / ~540K (cap off)", "well under a millisecond vs roughly 3 ms", "Two-hop with the cap"]
          ] },
          { t: "p", html: "Orders of magnitude, not measurements. One empirical detail worth saying out loud: both versions are dominated by hash probes, which are cache-hostile. If the adjacency lists are stored as sorted contiguous arrays instead of hash sets, a merge-style intersection can beat the set version by several times at <em>identical</em> asymptotics \u2014 memory layout, not complexity, is often the last factor of three." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201c<code class='tok'>adj</code> is a Map of id to Set of ids. Return the top 5 ids by mutual-friend count with <code class='tok'>u</code>, excluding <code class='tok'>u</code> and <code class='tok'>u</code>'s friends, ties broken by lower id. Skip any friend whose degree exceeds 5,000.\u201d Every rule the ranking depends on is stated, including the tie-break.",
            "<strong>Worked:</strong> \u201cWrite a bounded max-heap that keeps only the best k entries by score.\u201d Small, standard, verifiable.",
            "<strong>Garbage:</strong> \u201cRecommend friends for this user.\u201d You get an invented scoring heuristic \u2014 mutual friends times three, plus two for the same city, plus recency \u2014 which answers a product question you were not asked and buries the algorithm you were."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a user with no friends returns empty; a closed triangle returns nothing (everyone is already a friend); a candidate reachable through three friends outscores one reachable through two; a candidate reachable only via a capped hub is excluded, asserted deliberately so the cap is documented by a test.",
            "<strong>The defect to expect:</strong> de-duplicating candidates with a Set. It looks like sensible cleanup and it destroys the feature \u2014 the count of distinct two-hop paths <em>is</em> the mutual-friend score, so collapsing them leaves everybody tied at one and the ranking becomes iteration order."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "A correct two-hop count with exclusions and a deterministic tie-break", "Explains why two hops is the right frontier"],
            ["Senior", "Degree cap present, top-k via heap rather than a full sort", "Says the cost is O(d\u00b2) and independent of V, and why that is the point"],
            ["Staff", "Treats the cap as a product knob with a default and a test", "Raises precompute-versus-live and picks based on the read pattern, not on taste"]
          ] },

          { t: "note", variant: "key", html: "<strong>Visit only what can score.</strong> Two hops costs O(d\u00b2) and never touches V; the degree cap is what keeps one hub from making that a lie. And never de-duplicate the increments \u2014 the number of paths <em>is</em> the score." }
        ]
      },

      /* ---------------------------------------------------------- 5 */
      {
        id: "inventory-packer",
        title: "5 \u00b7 Inventory packer: an approximation you can name",
        summary: "Fit items into the fewest containers with first-fit-decreasing, and say the word 'approximation' before the interviewer does.",
        minutes: 9,
        tags: ["ai-pair", "greedy", "approximation"],
        blocks: [
          { t: "p", html: "This is the one task in the module where the honest answer is <em>\u201cthe optimum is out of reach, and here is the bound I will accept instead\u201d</em>. Bin packing is NP-hard. A candidate who says that in the first minute has already passed the part of the round this task exists to test; a candidate who lets a model produce a greedy and calls the output optimal has already failed it." },

          { t: "h", text: "The task" },
          { t: "p", html: "Items have integer sizes. Containers all hold capacity <code class='tok'>C</code>. Assign every item to a container so that the number of containers used is as small as you can manage, and return the assignment \u2014 not just the count." },
          { t: "ul", items: [
            "Is capacity uniform across containers, or do we have a mix of sizes?",
            "Can an item be split across containers, or must it stay whole? (Split is the fractional problem and is easy; whole is the hard one.)",
            "Do we need the true optimum, or is a good answer in milliseconds acceptable?",
            "Are there side constraints \u2014 a maximum item count per container, or categories that cannot travel together?",
            "Is this a batch we can sort, or a stream where each item must be placed on arrival?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Say out loud that exact bin packing is NP-hard, then choose a greedy deliberately.",
            "Reject any item larger than capacity loudly, before packing begins.",
            "Compute the lower bound <code class='tok'>ceil(total / C)</code> \u2014 it is free and it tells you how good your answer is.",
            "First-fit-decreasing: sort descending on a copy, then place each item in the first container that fits.",
            "If the input is a stream and sorting is impossible, fall back to plain first-fit and say why."
          ] },
          { t: "compare",
            bad: { title: "\u201cPack these optimally\u201d", items: [
              "Invites an exponential exhaustive search",
              "Or a greedy mislabelled as optimal, which is worse",
              "Hides the only interesting decision in the task"
            ] },
            good: { title: "\u201cImplement first-fit-decreasing; do not search for the optimum\u201d", items: [
              "Bounded, mechanical, correct in one shot",
              "Leaves the choice of approximation with you",
              "The bound becomes something you can quote"
            ] }
          },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> First-fit in arrival order: scan open containers, drop the item in the first that fits, otherwise open a new one. With a linear scan that is <strong>O(n\u00b7B)</strong>, worst case <strong>O(n\u00b2)</strong> when containers pile up. Its quality bound is <strong>at most about 1.7 times the optimum</strong>. Where it breaks is input order: feed the small items first and they fragment every container, so each large item that follows needs a fresh one." },
          { t: "code", lang: "javascript", code:
            "// First-fit, arrival order. Simple, order-sensitive.\n" +
            "function firstFit(sizes, cap) {\n" +
            "  var bins = [], left = [];\n" +
            "  for (var i = 0; i < sizes.length; i++) {\n" +
            "    var s = sizes[i];\n" +
            "    if (s > cap) throw new Error(\"item exceeds capacity: \" + s);\n" +
            "    var placed = false;\n" +
            "    for (var b = 0; b < bins.length; b++) {      // O(B) scan\n" +
            "      if (left[b] >= s) { bins[b].push(i); left[b] -= s; placed = true; break; }\n" +
            "    }\n" +
            "    if (!placed) { bins.push([i]); left.push(cap - s); }\n" +
            "  }\n" +
            "  return bins;\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Place the awkward items while there is still room to place them: sort descending, then first-fit. Cost is <strong>O(n log n)</strong> for the sort plus the same placement scan, and the placement scan itself drops to <strong>O(n log n)</strong> if you keep remaining capacities in a segment tree instead of a list. The quality bound improves to <strong>at most 11/9 of the optimum plus 6/9 containers</strong> \u2014 roughly 22% over optimal in the worst case, and typically much closer. It is still an approximation." },
          { t: "code", lang: "javascript", code:
            "// First-fit-decreasing. Sort a copy of the INDICES, not the input.\n" +
            "function firstFitDecreasing(sizes, cap) {\n" +
            "  var order = [];\n" +
            "  for (var i = 0; i < sizes.length; i++) {\n" +
            "    if (sizes[i] > cap) throw new Error(\"item exceeds capacity: \" + sizes[i]);\n" +
            "    order.push(i);\n" +
            "  }\n" +
            "  order.sort(function (a, b) { return sizes[b] - sizes[a] || a - b; });\n\n" +
            "  var bins = [], left = [];\n" +
            "  for (var k = 0; k < order.length; k++) {\n" +
            "    var idx = order[k], s = sizes[idx], placed = false;\n" +
            "    for (var b = 0; b < bins.length; b++) {\n" +
            "      if (left[b] >= s) { bins[b].push(idx); left[b] -= s; placed = true; break; }\n" +
            "    }\n" +
            "    if (!placed) { bins.push([idx]); left.push(cap - s); }\n" +
            "  }\n" +
            "  return bins;\n" +
            "}\n\n" +
            "// Free quality signal: you cannot do better than this many bins.\n" +
            "function lowerBound(sizes, cap) {\n" +
            "  var total = 0;\n" +
            "  for (var i = 0; i < sizes.length; i++) total += sizes[i];\n" +
            "  return Math.ceil(total / cap);\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: ["Input", "First-fit \u2014 containers / work", "FFD \u2014 containers / work", "Rough wall-clock (illustrative)", "Call"], rows: [
            ["40 items, capacity 100, lower bound 12", "~14 / ~300 ops", "~13 / ~500 ops", "both well under a millisecond", "FFD \u2014 the sort is free at this size"],
            ["10,000 items, lower bound 3,000", "~3,300 / ~17M ops", "~3,080 / ~17M ops", "roughly 85 ms each", "FFD \u2014 same time, ~7% fewer containers"],
            ["1,000,000 items, lower bound 300,000", "~330K / ~170B ops", "~308K / ~170B ops", "roughly 15 minutes each", "Neither \u2014 replace the linear bin scan first"]
          ] },
          { t: "p", html: "Illustrative orders of magnitude. Two things the asymptotics alone would not tell you. First, the container counts, not the timings, are the number this feature is judged on \u2014 a 7% reduction in containers is a real operational saving and costs one <code class='tok'>sort</code> call. Second, at a million items <em>both</em> greedies collapse for the same reason: the O(B) container scan. Fixing the quality bound was never the bottleneck; fixing the data structure is." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cImplement first-fit-decreasing over item indices sorted descending by size, capacity C, returning arrays of indices. Do not attempt to find the optimum.\u201d The last sentence is load-bearing \u2014 without it you sometimes get a recursive search.",
            "<strong>Worked:</strong> \u201cAdd a property test: every input index appears exactly once across the returned bins, and no bin exceeds capacity.\u201d Property tests are the model's strongest contribution here.",
            "<strong>Garbage:</strong> \u201cPack these items into the fewest boxes.\u201d Either an exhaustive search that hangs past twenty items, or a greedy with a comment claiming optimality \u2014 and the comment is the dangerous part, because it is the sentence you will repeat under pressure."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> every item appears exactly once; no container exceeds capacity; an item exactly equal to capacity gets a container to itself; an item larger than capacity is rejected rather than dropped; the container count is never below <code class='tok'>ceil(total / C)</code>.",
            "<strong>The defect to expect:</strong> silently skipping oversized items, so totals reconcile and the caller never learns an item vanished. A close second is sorting the caller's array in place, which reorders their data as a side effect of packing it."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Working first-fit with capacity respected and every item placed", "Knows a greedy is not guaranteed optimal"],
            ["Senior", "FFD, an oversized-item guard, and the lower bound reported alongside the answer", "Quotes the 11/9 bound and explains why a bound beats a benchmark"],
            ["Staff", "Bin lookup structure chosen for the target n; stream fallback identified", "Frames container count as the business metric and time as the constraint, not the reverse"]
          ] },

          { t: "note", variant: "key", html: "<strong>Say \u201capproximation\u201d before anyone asks.</strong> Bin packing is NP-hard; first-fit-decreasing costs one sort and gives you at most 11/9 of the optimum plus 6/9 containers. A bounded approximation you can name always beats an optimum you cannot deliver." }
        ]
      },

      /* ---------------------------------------------------------- 6 */
      {
        id: "kitchen-queue",
        title: "6 \u00b7 Kitchen queue: priorities with dependencies",
        summary: "Simulate an order queue where prep-time prerequisites gate readiness, and replace the scan-for-next with a heap.",
        minutes: 10,
        tags: ["ai-pair", "heap", "simulation"],
        blocks: [
          { t: "p", html: "Two rules live in this task and they are easy to conflate. <em>Readiness</em> says an order may start; <em>priority</em> says which of the ready ones goes first. Almost every wrong answer here \u2014 human or generated \u2014 collapses the two by sorting on priority and calling it a schedule. Keep them separate in your head and the data structure follows immediately." },

          { t: "h", text: "The task" },
          { t: "p", html: "Orders arrive with a placed-at time, a priority, and a prep duration. Some orders cannot start until another order finishes (a sauce before the dish that uses it). One cook works one order at a time without interruption. Return the sequence the cook should work in, and each order's completion time." },
          { t: "ul", items: [
            "One cook or several? One is a single-machine schedule; several is a different problem and I want to know before I model it.",
            "Is priority absolute, or does arrival time break ties within a priority?",
            "Can we interrupt a started order when something more urgent becomes ready?",
            "Are prerequisites guaranteed acyclic, or must we detect and report a cycle?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Count prerequisites per order; the orders with none are ready at their arrival time.",
            "Keep a clock. Repeatedly pick the best <em>ready</em> order, advance the clock by its prep time, and record completion.",
            "Completing an order decrements its dependents' counts; a dependent that reaches zero becomes ready.",
            "If nothing is ready but orders remain, jump the clock to the next arrival \u2014 do not spin.",
            "If nothing is ready and no arrivals remain, that is a cycle: report it rather than looping."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["The readiness rule and the clock advance", "You", "This is the simulation's semantics; a subtle error here produces plausible, wrong timelines"],
            ["The binary heap", "The model", "Pure boilerplate with a crisp contract \u2014 push, pop, size, comparator"],
            ["The comparator", "You (one line)", "It encodes the tie-break policy you agreed with the interviewer"],
            ["Fixtures: chains, diamonds, a cycle", "The model", "Cheap to generate and cheap to read"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> Hold every order in an array. At each step scan the array for the best one that is both unprocessed and ready. That is <strong>O(n\u00b2)</strong> \u2014 <code class='tok'>n</code> selections, each a full scan. It breaks nowhere near service size: fifty orders is 2,500 comparisons and finishes instantly. It breaks the moment somebody points the same code at a replay \u2014 200,000 historical orders is around 40 billion comparisons, which is a coffee break per run." },
          { t: "code", lang: "javascript", code:
            "// Naive: linear scan for the best ready order, every step. O(n^2)\n" +
            "function scheduleNaive(orders, deps) {\n" +
            "  var done = [], clock = 0, remaining = orders.length;\n" +
            "  var finished = {}, pending = orders.slice();\n" +
            "  while (remaining > 0) {\n" +
            "    var best = -1;\n" +
            "    for (var i = 0; i < pending.length; i++) {\n" +
            "      var o = pending[i];\n" +
            "      if (!o || o.placedAt > clock) continue;\n" +
            "      if (!readyNow(o, deps, finished)) continue;\n" +
            "      if (best < 0 || better(o, pending[best])) best = i;\n" +
            "    }\n" +
            "    if (best < 0) { clock = nextArrival(pending, clock); continue; }\n" +
            "    var pick = pending[best];\n" +
            "    pending[best] = null; remaining--;\n" +
            "    clock += pick.prep;\n" +
            "    finished[pick.id] = clock;\n" +
            "    done.push(pick.id);\n" +
            "  }\n" +
            "  return { order: done, finishedAt: finished };\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Keep only the <em>ready</em> orders, in a binary heap ordered by priority then placed-at. Each order is pushed once and popped once, at <code class='tok'>O(log n)</code> each, so the whole schedule is <strong>O(n log n)</strong> after an <strong>O(n + e)</strong> pass to build the dependency counts. Cycle detection falls out for free: if the loop ends with orders unprocessed and nothing ready, those orders are in a cycle." },
          { t: "code", lang: "javascript", code:
            "function Heap(cmp) { this.a = []; this.cmp = cmp; }\n" +
            "Heap.prototype.size = function () { return this.a.length; };\n" +
            "Heap.prototype.push = function (x) {\n" +
            "  var a = this.a, i = a.length; a.push(x);\n" +
            "  while (i > 0) {\n" +
            "    var p = (i - 1) >> 1;\n" +
            "    if (this.cmp(a[i], a[p]) >= 0) break;\n" +
            "    var t = a[i]; a[i] = a[p]; a[p] = t; i = p;\n" +
            "  }\n" +
            "};\n" +
            "Heap.prototype.pop = function () {\n" +
            "  var a = this.a, top = a[0], last = a.pop();\n" +
            "  if (a.length) {\n" +
            "    a[0] = last;\n" +
            "    for (var i = 0; ;) {\n" +
            "      var l = 2 * i + 1, r = l + 1, m = i;\n" +
            "      if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;\n" +
            "      if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;\n" +
            "      if (m === i) break;\n" +
            "      var t = a[i]; a[i] = a[m]; a[m] = t; i = m;\n" +
            "    }\n" +
            "  }\n" +
            "  return top;\n" +
            "};\n\n" +
            "// Lower priority number wins; ties go to whoever ordered first.\n" +
            "function cmp(a, b) { return (a.priority - b.priority) || (a.placedAt - b.placedAt); }\n\n" +
            "function schedule(orders, dependents, blockedCount) {\n" +
            "  var heap = new Heap(cmp), clock = 0, out = [], finishedAt = {}, emitted = 0;\n" +
            "  orders.forEach(function (o) { if (blockedCount[o.id] === 0) heap.push(o); });\n" +
            "  while (heap.size()) {\n" +
            "    var o = heap.pop();\n" +
            "    if (o.placedAt > clock) clock = o.placedAt;   // idle until it arrives\n" +
            "    clock += o.prep;\n" +
            "    finishedAt[o.id] = clock;\n" +
            "    out.push(o.id); emitted++;\n" +
            "    (dependents[o.id] || []).forEach(function (d) {\n" +
            "      if (--blockedCount[d.id] === 0) heap.push(d);\n" +
            "    });\n" +
            "  }\n" +
            "  if (emitted < orders.length) return { ok: false, order: out };  // cycle\n" +
            "  return { ok: true, order: out, finishedAt: finishedAt };\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["50 orders (one service)", "~2.5K comparisons", "~560 comparisons", "both well under a millisecond", "Scan \u2014 and the heap is arguably slower here"],
            ["5,000 orders (a week, replayed)", "~25M comparisons", "~123K comparisons", "roughly 125 ms vs well under a millisecond", "Heap"],
            ["200,000 orders (planning run)", "~40B comparisons", "~7M comparisons", "roughly 3 minutes vs roughly 35 ms", "Heap \u2014 not optional"]
          ] },
          { t: "p", html: "Illustrative figures. The first row is the one worth dwelling on: at fifty orders the array scan is very likely <em>faster</em> than the heap, because it walks contiguous memory with no sift, no comparator indirection and no allocation, while the heap pays all three for a theoretical win it never gets to bank. Saying that \u2014 rather than reciting <code class='tok'>O(n log n) &lt; O(n\u00b2)</code> \u2014 is the sentence that separates someone who memorised complexities from someone who understands them." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cWrite a binary min-heap over an array with an injected comparator, exposing push, pop and size. No dependencies, no classes I have to import.\u201d Boilerplate with a contract is the model's best case.",
            "<strong>Worked:</strong> \u201cGiven <code class='tok'>blockedCount</code> and <code class='tok'>dependents</code>, write the simulation loop. An order becomes heap-eligible only when its count reaches zero.\u201d The readiness rule is stated, so it cannot be guessed.",
            "<strong>Garbage:</strong> \u201cSchedule these orders by priority.\u201d You get <code class='tok'>orders.sort(byPriority)</code>, which ignores dependencies entirely. It is correct on any fixture where prerequisites happen to arrive first, which is most hand-written fixtures."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a high-priority order blocked by a slow prerequisite must run <em>after</em> a lower-priority ready one; equal priorities resolve by earliest placed; completion times are non-decreasing; a two-order cycle returns a failure rather than hanging; an order arriving after the cook goes idle advances the clock instead of starting early.",
            "<strong>The defect to expect:</strong> pushing dependents onto the heap at build time rather than on completion. The heap ordering then hides it \u2014 output still looks priority-sorted, and only a test where a prerequisite is deliberately slow reveals that the dish was cooked before its sauce."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "A correct simulation with dependencies respected and a working heap", "Distinguishes readiness from priority when asked"],
            ["Senior", "Cycle detection, idle-time handling, deterministic tie-break", "States why the heap holds only ready orders, not all orders"],
            ["Staff", "The single-cook assumption is isolated so multi-cook is a change, not a rewrite", "Names the small-n case where the scan wins and declines to over-engineer"]
          ] },

          { t: "note", variant: "key", html: "<strong>Readiness gates, priority orders.</strong> The heap holds only ready orders, so pushes happen on completion, never up front. And at fifty orders the array scan may genuinely be faster \u2014 knowing when the better complexity loses is the point of measuring." }
        ]
      },

      /* ---------------------------------------------------------- 7 */
      {
        id: "maze-solver",
        title: "7 \u00b7 Maze solver: a path versus the path",
        summary: "DFS returns a route and BFS returns the shortest one; reconstruct with parents and avoid the queue that quietly goes quadratic.",
        minutes: 9,
        tags: ["ai-pair", "bfs", "grids"],
        blocks: [
          { t: "p", html: "Hold the difference in one line: <em>DFS commits, BFS compares</em>. Depth-first dives down one corridor until it finds an exit and hands you whatever it found. Breadth-first expands in rings, so the first ring that touches the exit is by definition a shortest route. Both are O(V+E). Only one answers the question you were asked." },

          { t: "h", text: "The task" },
          { t: "p", html: "Given a grid of open cells and walls, a start and an exit, return the shortest route as a list of cells, or null if no route exists. Movement is four-directional." },
          { t: "ul", items: [
            "Four-way or eight-way movement? Diagonals change both the neighbour list and the notion of distance.",
            "Are all open cells equally cheap, or does terrain have a cost? Weighted cells make BFS the wrong tool.",
            "One query, or many from the same start? Many means computing the parent field once and reusing it.",
            "How large can the grid get \u2014 does a full parent array fit comfortably in memory?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Flat arrays of length <code class='tok'>R*C</code> for walls, visited and parents. No nested arrays, no allocation in the loop.",
            "BFS from the start, marking visited <em>on enqueue</em> so no cell enters the queue twice.",
            "Stop as soon as the exit is dequeued \u2014 or as soon as it is enqueued, which is one ring earlier.",
            "Walk the parent chain backwards from the exit and reverse it."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["Choice of BFS, and why", "You", "This is the entire judgement being tested; it is not a detail to delegate"],
            ["The neighbour loop with bounds checks", "The model", "Four offsets and four guards \u2014 mechanical, and easy to check"],
            ["Path reconstruction from parents", "The model", "Short, well specified, verifiable against a known maze"],
            ["Maze fixtures with two routes of different lengths", "You", "This fixture is the test that catches DFS; you must know it exists"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> Recursive DFS with a visited set. It finds <em>a</em> route in <strong>O(V+E)</strong> and it is not the shortest. The usual repair \u2014 keep going, remember the best route seen \u2014 means abandoning the visited set and enumerating simple paths, whose count grows exponentially with grid size. So the naive version fails on correctness first and on time second, which is the worst possible order: your first three tests pass." },
          { t: "code", lang: "javascript", code:
            "// Returns A path. Not THE path. Passes any single-route fixture.\n" +
            "function dfsPath(walls, R, C, start, exit) {\n" +
            "  var seen = new Uint8Array(R * C), path = [];\n" +
            "  function go(i) {\n" +
            "    if (seen[i] || walls[i]) return false;\n" +
            "    seen[i] = 1; path.push(i);\n" +
            "    if (i === exit) return true;\n" +
            "    var r = (i / C) | 0, c = i % C;\n" +
            "    if (r > 0     && go(i - C)) return true;\n" +
            "    if (r < R - 1 && go(i + C)) return true;\n" +
            "    if (c > 0     && go(i - 1)) return true;\n" +
            "    if (c < C - 1 && go(i + 1)) return true;\n" +
            "    path.pop();\n" +
            "    return false;\n" +
            "  }\n" +
            "  return go(start) ? path : null;\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> BFS with a queue and a parent array. On a four-connected grid every cell has at most four edges, so <code class='tok'>E</code> is proportional to <code class='tok'>V</code> and <strong>O(V+E)</strong> is just <strong>O(R\u00b7C)</strong> time and space. Reconstruction is <strong>O(path length)</strong>. It lands everywhere: correct at any size, and linear." },
          { t: "code", lang: "javascript", code:
            "// BFS: expands in rings, so the first arrival is a shortest route.\n" +
            "function shortestPath(walls, R, C, start, exit) {\n" +
            "  var n = R * C;\n" +
            "  var parent = new Int32Array(n).fill(-1);\n" +
            "  var seen = new Uint8Array(n);\n" +
            "  var queue = new Int32Array(n), head = 0, tail = 0;\n" +
            "  queue[tail++] = start; seen[start] = 1;      // mark ON ENQUEUE\n\n" +
            "  while (head < tail) {                         // head index, never shift()\n" +
            "    var i = queue[head++];\n" +
            "    if (i === exit) break;\n" +
            "    var r = (i / C) | 0, c = i % C;\n" +
            "    if (r > 0)     visit(i - C, i);\n" +
            "    if (r < R - 1) visit(i + C, i);\n" +
            "    if (c > 0)     visit(i - 1, i);\n" +
            "    if (c < C - 1) visit(i + 1, i);\n" +
            "  }\n" +
            "  function visit(j, from) {\n" +
            "    if (seen[j] || walls[j]) return;\n" +
            "    seen[j] = 1; parent[j] = from; queue[tail++] = j;\n" +
            "  }\n" +
            "  if (!seen[exit]) return null;\n" +
            "  var out = [];\n" +
            "  for (var k = exit; k !== -1; k = parent[k]) out.push(k);\n" +
            "  return out.reverse();\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["8\u00d78 grid (64 cells)", "~256 expansions", "64 expansions", "both well under a millisecond", "BFS \u2014 for the answer, not the speed"],
            ["40\u00d740 grid (1,600 cells)", "on the order of 10\u00b9\u00b2 expansions", "1,600 expansions", "roughly an hour and a half vs well under a millisecond", "BFS"],
            ["200\u00d7200 grid (40,000 cells)", "astronomically large", "40,000 expansions", "never finishes vs well under a millisecond", "BFS"]
          ] },
          { t: "p", html: "The naive column models exhaustive route enumeration as roughly <code class='tok'>2^\u221aN</code> \u2014 an illustrative stand-in for exponential growth, not a measurement or a tight bound. The point survives any reasonable model: exponential is not \u201cslower\u201d, it is a different category of outcome. There is also a purely empirical trap on the BFS side \u2014 using <code class='tok'>Array.prototype.shift()</code> as the dequeue can cost O(n) per call in some engines, turning a linear algorithm into a quadratic one with no change to the pseudocode. A head index costs one variable and removes the risk." },
          { t: "widget", id: "aiecBenchLab" },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cBFS over a flat R\u00d7C grid, four neighbours, using a head index instead of <code class='tok'>shift()</code>, filling an <code class='tok'>Int32Array</code> of parents. Return the reconstructed route or null.\u201d Every representation decision is already made, so nothing is left to invent.",
            "<strong>Worked:</strong> \u201cBuild me a maze fixture with a 14-step route and a 40-step detour to the same exit.\u201d The model is good at constructing adversarial fixtures once you say what the adversary is.",
            "<strong>Garbage:</strong> \u201cFind the path through this maze.\u201d Recursive DFS, near-certainly. It is short, it is readable, it passes your first tests, and it answers a different question."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a maze with a short route and a long detour, asserting the returned <em>length</em>; a walled-off exit returning null; start equal to exit returning a single-cell route; a one-row corridor; a route that must hug the right edge.",
            "<strong>The defect to expect:</strong> marking visited on dequeue instead of enqueue. The answer stays correct, but cells enter the queue once per neighbour that discovers them, so the queue swells and the constant factor multiplies. Right behind it: a neighbour check that omits the column guard, so <code class='tok'>c + 1</code> wraps into the first cell of the next row and the solver walks through a wall."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Working BFS with parents and reconstruction, tested against a two-route maze", "Says why BFS gives the shortest route on unit edges"],
            ["Senior", "Flat typed arrays, head-index queue, visited marked on enqueue", "Names the <code class='tok'>shift()</code> trap as an implementation cost, not a complexity one"],
            ["Staff", "Separates the search from the reconstruction so weights or a heuristic can be swapped in", "Says what would change if cells had costs, and names Dijkstra without switching to it prematurely"]
          ] },

          { t: "note", variant: "key", html: "<strong>DFS finds a route; BFS finds the route.</strong> On unit edges the first ring to touch the exit is a shortest one \u2014 O(R\u00b7C) with a parent array. The fixture that catches every wrong answer here is a maze with two routes of different lengths." }
        ]
      },

      /* ---------------------------------------------------------- 8 */
      {
        id: "route-planner",
        title: "8 \u00b7 Route planner: weights make BFS wrong",
        summary: "Dijkstra with a lazy-deletion heap, why hop count is not travel time, and what a few fixed stops cost you.",
        minutes: 10,
        tags: ["ai-pair", "dijkstra", "graphs"],
        blocks: [
          { t: "p", html: "One sentence carries this task: <em>BFS counts edges, Dijkstra adds them up</em>. The moment an edge carries a number, hop count stops being distance, and an algorithm that was correct in the previous lesson silently becomes wrong here. It still returns a route. It still looks right. That is precisely why it is dangerous when a model hands it to you at speed." },

          { t: "h", text: "The task" },
          { t: "p", html: "You have a road network: nodes are junctions, directed edges carry a travel time in seconds. Return the fastest route from A to B. Extension: the route must pass through two or three fixed stops in a given order." },
          { t: "ul", items: [
            "Can any edge weight be negative? If yes, Dijkstra is off the table and I need to know now.",
            "Directed or undirected \u2014 do we model one-way streets and turn restrictions?",
            "Are the stops in a fixed order, or do we choose the order? Choosing turns this into a travelling-salesman problem.",
            "Do we need the route itself or only its total duration?",
            "One query or many from the same origin \u2014 is there a precompute budget?"
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Adjacency list of <code class='tok'>{ to, w }</code>, built once.",
            "Dijkstra with a binary heap, using lazy deletion instead of decrease-key.",
            "A <code class='tok'>prev</code> array for reconstruction, exactly as in the maze.",
            "For ordered stops, chain segments A\u2192s\u2081\u2192s\u2082\u2192B and concatenate \u2014 optimal because the order is fixed.",
            "If the order is free and there are <code class='tok'>k</code> stops, say the words: that is TSP, and a Held-Karp dynamic program solves it in O(k\u00b2\u00b72^k), fine up to about ten stops."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["The choice of Dijkstra and the non-negativity precondition", "You", "It is the decision the round is testing; delegating it forfeits the point"],
            ["Heap and the relaxation loop", "The model", "Textbook shape once you specify lazy deletion"],
            ["Segment chaining for fixed stops", "The model", "Straightforward composition over a function you already trust"],
            ["Whether to precompute anything", "You", "A systems call that depends on query volume, not on the algorithm"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> BFS from A. It costs <strong>O(V+E)</strong>, it terminates, it returns a route, and it minimises the wrong quantity: number of edges. A single-hop back road beats a three-hop motorway every time. Where it breaks is not a size \u2014 it is broken on the first weighted graph, at every size, and only a fixture where the fewest-hop route is deliberately slower will reveal it. Worth saying when BFS <em>is</em> right: when all weights are equal, it is the correct and cheaper choice." },
          { t: "code", lang: "javascript", code:
            "// Correct code, wrong question: this minimises hops, not seconds.\n" +
            "function fewestHops(adj, src, dst) {\n" +
            "  var prev = new Map(), queue = [src], head = 0;\n" +
            "  prev.set(src, null);\n" +
            "  while (head < queue.length) {\n" +
            "    var u = queue[head++];\n" +
            "    if (u === dst) break;\n" +
            "    (adj.get(u) || []).forEach(function (e) {\n" +
            "      if (prev.has(e.to)) return;\n" +
            "      prev.set(e.to, u);\n" +
            "      queue.push(e.to);\n" +
            "    });\n" +
            "  }\n" +
            "  return prev.has(dst) ? rebuild(prev, dst) : null;\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Dijkstra: always expand the unfinished node with the smallest known distance, and relax its edges. With a binary heap that is <strong>O((V + E) log V)</strong>. Lazy deletion \u2014 push a fresh entry on every improvement and skip stale pops \u2014 avoids implementing decrease-key and costs only a slightly larger heap. The precondition is real: <strong>all weights must be non-negative</strong>. If one can be negative, you need Bellman-Ford at <strong>O(V\u00b7E)</strong>, and you should say so rather than shipping a wrong answer quickly." },
          { t: "code", lang: "javascript", code:
            "// Dijkstra, lazy deletion. Requires w >= 0 on every edge.\n" +
            "function fastest(adj, n, src, dst) {\n" +
            "  var dist = new Float64Array(n).fill(Infinity);\n" +
            "  var prev = new Int32Array(n).fill(-1);\n" +
            "  var heap = new Heap(function (a, b) { return a.d - b.d; });\n" +
            "  dist[src] = 0; heap.push({ v: src, d: 0 });\n\n" +
            "  while (heap.size()) {\n" +
            "    var top = heap.pop();\n" +
            "    if (top.d > dist[top.v]) continue;      // stale entry, skip it\n" +
            "    if (top.v === dst) break;\n" +
            "    var edges = adj[top.v] || [];\n" +
            "    for (var i = 0; i < edges.length; i++) {\n" +
            "      var e = edges[i], nd = top.d + e.w;\n" +
            "      if (nd < dist[e.to]) {\n" +
            "        dist[e.to] = nd; prev[e.to] = top.v;\n" +
            "        heap.push({ v: e.to, d: nd });\n" +
            "      }\n" +
            "    }\n" +
            "  }\n" +
            "  return { time: dist[dst], prev: prev };\n" +
            "}\n\n" +
            "// Fixed stop order: the concatenation of optimal legs is optimal.\n" +
            "function viaStops(adj, n, points) {\n" +
            "  var total = 0, legs = [];\n" +
            "  for (var i = 0; i + 1 < points.length; i++) {\n" +
            "    var leg = fastest(adj, n, points[i], points[i + 1]);\n" +
            "    if (!isFinite(leg.time)) return null;\n" +
            "    total += leg.time; legs.push(leg);\n" +
            "  }\n" +
            "  return { time: total, legs: legs };\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["V = 1,000, E = 3,000 (a town)", "~4K ops \u2014 wrong answer", "~40K ops", "both well under a millisecond", "Dijkstra"],
            ["V = 200,000, E = 500,000 (a city)", "~700K ops \u2014 wrong answer", "~12M ops", "roughly 4 ms vs roughly 60 ms", "Dijkstra"],
            ["V = 2,000,000, E = 5,000,000 (a region)", "~7M ops \u2014 wrong answer", "~150M ops", "roughly 35 ms vs roughly 750 ms", "Dijkstra, then precompute"]
          ] },
          { t: "p", html: "Illustrative magnitudes. Notice that BFS wins every row on time and loses every row outright, which is why a benchmark alone is a bad way to choose an algorithm \u2014 you have to grade correctness first and speed second. On the empirical side, Dijkstra at regional scale spends most of its time missing cache while chasing adjacency and heap entries rather than doing arithmetic; that is why production routers precompute, with contraction hierarchies or an A* heuristic on top. You are not implementing that in 25 minutes, but naming it is the senior signal." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cDijkstra over an adjacency list of <code class='tok'>{to, w}</code> with non-negative weights. Binary heap with lazy deletion \u2014 skip a popped entry whose distance is worse than <code class='tok'>dist[v]</code>. Return <code class='tok'>dist</code> and <code class='tok'>prev</code>.\u201d",
            "<strong>Worked:</strong> \u201cWrite a fixture where the two-hop route totals 300 seconds and the one-hop route totals 900.\u201d That single fixture is the difference between shipping and not.",
            "<strong>Garbage:</strong> \u201cFind the shortest route between these junctions.\u201d The word \u201cshortest\u201d is ambiguous and the model resolves it as hop count roughly as often as as cost. You get clean, tested, confident BFS."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a graph where the fewest-hop route is not the cheapest; an unreachable destination returning infinity rather than throwing; a zero-weight edge; a self-loop; a negative edge that is rejected loudly at input validation.",
            "<strong>The defect to expect:</strong> marking a node visited when it is <em>pushed</em> rather than when it is popped. That is not a performance nit \u2014 it is incorrect, because a cheaper route to that node can still be discovered later and will be discarded. The gentler cousin is omitting the stale-entry skip, which stays correct but re-expands nodes."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Working Dijkstra with a heap and route reconstruction", "Explains why BFS is wrong once edges carry weights"],
            ["Senior", "Lazy deletion, non-negativity validated, fixed-stop chaining", "States the O((V+E) log V) cost and the Bellman-Ford fallback and when it applies"],
            ["Staff", "Query pattern drives the design \u2014 one-off search versus precomputed structure", "Names free-order stops as TSP and gives the Held-Karp bound rather than hand-waving"]
          ] },

          { t: "note", variant: "key", html: "<strong>Weights turn BFS into a plausible wrong answer.</strong> Dijkstra with a binary heap is O((V+E) log V) and needs non-negative weights \u2014 say that precondition out loud, because it is the sentence that proves you chose the algorithm rather than recognised it." }
        ]
      },

      /* ---------------------------------------------------------- 9 */
      {
        id: "spell-checker",
        title: "9 \u00b7 Spell checker: pruning buys a constant",
        summary: "Bounded edit distance over a length-and-prefix filtered candidate set, and the honesty to call it a constant-factor win.",
        minutes: 10,
        tags: ["ai-pair", "strings", "dynamic-programming"],
        blocks: [
          { t: "p", html: "The model to hold: <em>edit distance is expensive per comparison, so the win is in comparing less</em>. You are not going to make the dynamic program asymptotically faster in a 30-minute round. You are going to stop running it against words that could not possibly be close, and then you are going to be honest that this is a constant factor \u2014 a large, decisive one, but a constant." },

          { t: "h", text: "The task" },
          { t: "p", html: "Given a query word that is not in the dictionary, return up to five suggestions ranked by edit distance and then by word frequency. Distances above <code class='tok'>k = 2</code> are not suggestions." },
          { t: "ul", items: [
            "Plain Levenshtein, or Damerau, which treats a transposition as one edit? \u201cteh\u201d is the commonest typo there is, so this changes the product.",
            "Is the dictionary fixed at start-up? If so we can pay for an index once and amortise it forever.",
            "Do we fold case and accents before comparing?",
            "What is the latency budget \u2014 per keystroke, or on submit? That number decides the whole design."
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "At start-up, bucket the dictionary by <code class='tok'>(length, first letter)</code>. One pass, reused by every query.",
            "For a query of length <code class='tok'>m</code>, gather buckets for lengths <code class='tok'>m-k .. m+k</code>. A length gap larger than <code class='tok'>k</code> guarantees distance greater than <code class='tok'>k</code>, so this filter is exact, not heuristic.",
            "Take the query's first letter bucket plus the buckets for a mistyped first letter \u2014 do not assume the first character is correct.",
            "Run bounded edit distance on the survivors, abandoning any comparison that cannot finish under <code class='tok'>k</code>.",
            "Rank by distance, then by frequency, then by the word itself for determinism."
          ] },
          { t: "table", headers: ["Piece", "Who writes it", "Why"], rows: [
            ["The pruning rules and their exactness argument", "You", "A filter that is subtly not exact drops correct suggestions, and nothing in the output looks wrong"],
            ["Bounded edit distance with rolling rows", "The model, with the band specified", "Index-heavy, standard, and much faster to review than to write"],
            ["The index build", "The model", "One pass with a clear key"],
            ["The ranking comparator", "You (one line)", "It is the product decision, and it must be deterministic"]
          ] },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> Run full Levenshtein against every dictionary word. That is <strong>O(D\u00b7m\u00b7n)</strong> for a dictionary of <code class='tok'>D</code> words \u2014 with <code class='tok'>D</code> at half a million and words around eight letters, roughly 32 million DP cells per query. Where it breaks is the latency budget rather than the machine: at per-keystroke suggestions, a few hundred milliseconds of work per keypress makes typing feel broken long before anything times out." },
          { t: "code", lang: "javascript", code:
            "// Full Levenshtein, two rolling rows. O(m*n) per word.\n" +
            "function editDistance(a, b) {\n" +
            "  var m = a.length, n = b.length;\n" +
            "  var prev = new Int32Array(n + 1), cur = new Int32Array(n + 1);\n" +
            "  for (var j = 0; j <= n; j++) prev[j] = j;\n" +
            "  for (var i = 1; i <= m; i++) {\n" +
            "    cur[0] = i;\n" +
            "    for (var j2 = 1; j2 <= n; j2++) {\n" +
            "      var cost = a.charCodeAt(i - 1) === b.charCodeAt(j2 - 1) ? 0 : 1;\n" +
            "      var del = prev[j2] + 1, ins = cur[j2 - 1] + 1, sub = prev[j2 - 1] + cost;\n" +
            "      cur[j2] = Math.min(del, ins, sub);\n" +
            "    }\n" +
            "    var t = prev; prev = cur; cur = t;\n" +
            "  }\n" +
            "  return prev[n];\n" +
            "}\n\n" +
            "// Naive query: O(D * m * n).\n" +
            "function suggestNaive(dict, q, k) {\n" +
            "  var out = [];\n" +
            "  for (var i = 0; i < dict.length; i++) {\n" +
            "    var d = editDistance(q, dict[i].word);\n" +
            "    if (d <= k) out.push({ word: dict[i].word, d: d, f: dict[i].freq });\n" +
            "  }\n" +
            "  return out;\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Two prunings. The <em>length filter</em> is exact: converting a word of length <code class='tok'>n</code> into one of length <code class='tok'>m</code> needs at least <code class='tok'>|m-n|</code> edits, so anything outside <code class='tok'>[m-k, m+k]</code> cannot qualify. The <em>band</em> is also exact: any alignment straying more than <code class='tok'>k</code> cells from the diagonal has already spent more than <code class='tok'>k</code> edits, so only a band of width <code class='tok'>2k+1</code> matters, making each comparison <strong>O(m\u00b7k)</strong> instead of <strong>O(m\u00b7n)</strong>. Add a first-letter bucket and the candidate set drops to a few percent. Total: <strong>O(K\u00b7m\u00b7k)</strong> where <code class='tok'>K</code> is a fixed fraction of <code class='tok'>D</code> \u2014 which is still <strong>linear in dictionary size</strong>." },
          { t: "code", lang: "javascript", code:
            "// Bounded, banded distance: returns k+1 as soon as it cannot win.\n" +
            "function boundedDistance(a, b, k) {\n" +
            "  var m = a.length, n = b.length;\n" +
            "  if (Math.abs(m - n) > k) return k + 1;      // exact length filter\n" +
            "  var INF = k + 1;\n" +
            "  var prev = new Int32Array(n + 1), cur = new Int32Array(n + 1);\n" +
            "  for (var j = 0; j <= n; j++) prev[j] = j <= k ? j : INF;\n" +
            "  for (var i = 1; i <= m; i++) {\n" +
            "    var lo = Math.max(1, i - k), hi = Math.min(n, i + k);\n" +
            "    cur[0] = i <= k ? i : INF;\n" +
            "    if (lo > 1) cur[lo - 1] = INF;            // outside the band is INF, not 0\n" +
            "    var best = INF;\n" +
            "    for (var j2 = lo; j2 <= hi; j2++) {\n" +
            "      var cost = a.charCodeAt(i - 1) === b.charCodeAt(j2 - 1) ? 0 : 1;\n" +
            "      var v = Math.min(prev[j2] + 1, cur[j2 - 1] + 1, prev[j2 - 1] + cost);\n" +
            "      cur[j2] = v;\n" +
            "      if (v < best) best = v;\n" +
            "    }\n" +
            "    if (hi < n) cur[hi + 1] = INF;\n" +
            "    if (best > k) return k + 1;               // whole row already lost\n" +
            "    var t = prev; prev = cur; cur = t;\n" +
            "  }\n" +
            "  return prev[n] > k ? k + 1 : prev[n];\n" +
            "}\n\n" +
            "// Index once at start-up; every query reuses it.\n" +
            "function buildIndex(dict) {\n" +
            "  var byKey = new Map();\n" +
            "  dict.forEach(function (e) {\n" +
            "    var key = e.word.length + \":\" + e.word.charAt(0);\n" +
            "    if (!byKey.has(key)) byKey.set(key, []);\n" +
            "    byKey.get(key).push(e);\n" +
            "  });\n" +
            "  return byKey;\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["2,000-word fixture", "~128K DP cells", "~2.4K cells", "roughly 1 ms vs well under a millisecond", "Either \u2014 both fit any budget"],
            ["60,000-word vocabulary", "~3.8M cells", "~72K cells", "roughly 38 ms vs roughly 1 ms", "Pruned \u2014 the naive one now eats the budget"],
            ["500,000-word dictionary", "~32M cells", "~600K cells", "roughly 320 ms vs roughly 6 ms", "Pruned \u2014 the naive one is unusable per keystroke"]
          ] },
          { t: "p", html: "Illustrative figures. The important observation is the one the numbers make for you: the ratio is roughly <strong>50\u00d7 at every size</strong>, because both versions are linear in <code class='tok'>D</code>. Pruning bought a constant. And a 50\u00d7 constant is the entire difference between 320 ms and 6 ms, which is the difference between a feature that feels broken and one nobody notices. If you genuinely need to beat linear, that is an index over words with up to <code class='tok'>k</code> characters deleted, or a metric tree over the distance function \u2014 both trade a much larger index for sub-linear lookup, and both are a conversation, not a 25-minute build." },
          { t: "widget", id: "aiecBenchLab" },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cWrite bounded Levenshtein with two rolling rows and a band of width 2k+1. Cells outside the band must read as k+1, never 0. Return early with k+1 when the whole row exceeds k.\u201d Naming the outside-the-band value pre-empts the exact bug.",
            "<strong>Worked:</strong> \u201cProve or disprove: can a word whose length differs from the query by more than k ever be within distance k?\u201d Asking for the argument, not the code, is a good use of the model when the filter's exactness is what you are unsure about.",
            "<strong>Garbage:</strong> \u201cWrite a spell checker.\u201d A hardcoded twenty-word list, full distance against all of it, and a confident comment claiming it is O(n)."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a word at distance exactly <code class='tok'>k</code> is included and one at <code class='tok'>k+1</code> is not; a transposition is distance 1 under Damerau and 2 under plain Levenshtein, so assert whichever you implemented; the pruned path returns the same set as the naive path over a small dictionary; ties break deterministically by frequency then alphabetically.",
            "<strong>The defect to expect:</strong> the band's boundary cells left at 0 instead of infinity. Distances come out <em>too small</em>, so you get more suggestions rather than fewer \u2014 the output looks fine, plausible words appear, and only a differential test against the unbanded version catches it."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Correct edit distance and a working suggestion list under a distance cap", "Explains the O(m\u00b7n) cost of one comparison"],
            ["Senior", "Length filter, band, early abandon, index built once at start-up", "Says plainly that pruning is a constant factor and why that is still the right move"],
            ["Staff", "Latency budget stated first and the design derived from it", "Names a sub-linear index as the next step and declines to build it in the time available"]
          ] },

          { t: "note", variant: "key", html: "<strong>Compare less, not faster.</strong> The length filter and the band are both <em>exact</em>, so pruning costs no recall \u2014 it just leaves the complexity linear in dictionary size. Claim the constant factor honestly; a 50\u00d7 constant is worth more than an asymptotic claim you cannot support." }
        ]
      },

      /* --------------------------------------------------------- 10 */
      {
        id: "task-scheduler",
        title: "10 \u00b7 Task scheduler: order, or prove there is none",
        summary: "Kahn's algorithm in O(V+E), waves for parallelism, and cycle detection that names the tasks instead of hanging.",
        minutes: 10,
        tags: ["ai-pair", "topological-sort", "graphs"],
        blocks: [
          { t: "p", html: "The picture: <em>a task is runnable when its prerequisite count hits zero</em>. Everything else \u2014 the ordering, the parallel waves, the cycle report \u2014 falls out of maintaining that one counter. This is the cleanest task in the module, and it is the one where the naive version and the good version cost the same number of lines, so there is no trade-off to defend at all." },

          { t: "h", text: "The task" },
          { t: "p", html: "Tasks have prerequisites. Return an execution order that never runs a task before its prerequisites, or report that no such order exists and name the tasks involved. Bonus: group the order into waves that could run in parallel." },
          { t: "ul", items: [
            "Can the input contain duplicate edges, or an edge to an unknown task id?",
            "Do you want any valid order, or a specific one \u2014 alphabetical, or by priority \u2014 for reproducible builds?",
            "Should an unknown prerequisite be an error, or treated as already satisfied?",
            "How large does this get? A monorepo build graph is a very different size from a checklist."
          ] },

          { t: "h", text: "Plan" },
          { t: "ol", items: [
            "Build <code class='tok'>dependents[]</code> and <code class='tok'>indegree[]</code> in one pass, de-duplicating edges as you go.",
            "Seed a queue with every task of indegree zero.",
            "Pop, emit, and decrement each dependent; push the ones that reach zero.",
            "If fewer tasks were emitted than exist, everything left has an unmet prerequisite \u2014 that set contains a cycle.",
            "For waves, drain the whole queue level by level; the number of waves is the critical path length."
          ] },
          { t: "compare",
            bad: { title: "\u201cSort these tasks by dependency\u201d", items: [
              "Frequently returns recursive DFS with no cycle guard",
              "Hangs or overflows the stack on the first cyclic input",
              "The model's own fixtures are acyclic, so it looks correct"
            ] },
            good: { title: "\u201cKahn's algorithm, and return ok:false on a cycle\u201d", items: [
              "Iterative, so no stack limit to worry about",
              "The failure path is part of the contract, not an exception",
              "Waves come free from the same loop"
            ] }
          },

          { t: "h", text: "Two solutions" },
          { t: "p", html: "<strong>Solution 1 \u2014 the naive one.</strong> Repeatedly sweep every remaining task, looking for one whose prerequisites are all finished; emit it; repeat. That is <strong>O(V\u00b2)</strong> at best, and <strong>O(V\u00b7E)</strong> if you re-check every edge on each sweep. It is completely fine for a hundred tasks. It breaks on a CI graph: twenty thousand jobs is roughly four hundred million checks, so a scheduler that should be instant becomes a visible pause, and a monorepo graph is worse." },
          { t: "code", lang: "javascript", code:
            "// Naive: sweep for a runnable task, repeat. O(V^2) or worse.\n" +
            "function orderNaive(tasks, prereqs) {\n" +
            "  var done = {}, out = [], left = tasks.slice();\n" +
            "  while (left.length) {\n" +
            "    var pick = -1;\n" +
            "    for (var i = 0; i < left.length; i++) {\n" +
            "      var ps = prereqs[left[i]] || [];\n" +
            "      var ready = true;\n" +
            "      for (var j = 0; j < ps.length; j++) { if (!done[ps[j]]) { ready = false; break; } }\n" +
            "      if (ready) { pick = i; break; }\n" +
            "    }\n" +
            "    if (pick < 0) return { ok: false, blocked: left };   // cycle\n" +
            "    var t = left.splice(pick, 1)[0];\n" +
            "    done[t] = true; out.push(t);\n" +
            "  }\n" +
            "  return { ok: true, order: out };\n" +
            "}"
          },
          { t: "p", html: "<strong>Solution 2 \u2014 the smarter one.</strong> Kahn's algorithm: maintain the indegree, and let completion push newly unblocked tasks onto a queue. Every node is enqueued once and every edge is relaxed once, so it is <strong>O(V+E)</strong> time and <strong>O(V+E)</strong> space. Cycle detection is not an extra pass \u2014 it is the count of emitted tasks. Waves are not an extra algorithm \u2014 they are the queue drained a level at a time." },
          { t: "code", lang: "javascript", code:
            "// Kahn's algorithm, O(V + E), with waves and cycle reporting.\n" +
            "function schedule(tasks, prereqs) {\n" +
            "  var indeg = new Map(), dependents = new Map(), seenEdge = new Set();\n" +
            "  tasks.forEach(function (t) { indeg.set(t, 0); dependents.set(t, []); });\n\n" +
            "  tasks.forEach(function (t) {\n" +
            "    (prereqs[t] || []).forEach(function (p) {\n" +
            "      if (!indeg.has(p)) throw new Error(\"unknown prerequisite: \" + p);\n" +
            "      var key = p + \">\" + t;\n" +
            "      if (seenEdge.has(key)) return;        // duplicate edges break indegree\n" +
            "      seenEdge.add(key);\n" +
            "      dependents.get(p).push(t);\n" +
            "      indeg.set(t, indeg.get(t) + 1);\n" +
            "    });\n" +
            "  });\n\n" +
            "  var frontier = [];\n" +
            "  indeg.forEach(function (d, t) { if (d === 0) frontier.push(t); });\n" +
            "  frontier.sort();                           // determinism, if promised\n\n" +
            "  var waves = [], order = [];\n" +
            "  while (frontier.length) {\n" +
            "    waves.push(frontier.slice());\n" +
            "    var next = [];\n" +
            "    frontier.forEach(function (t) {\n" +
            "      order.push(t);\n" +
            "      dependents.get(t).forEach(function (d) {\n" +
            "        indeg.set(d, indeg.get(d) - 1);\n" +
            "        if (indeg.get(d) === 0) next.push(d);\n" +
            "      });\n" +
            "    });\n" +
            "    next.sort();\n" +
            "    frontier = next;\n" +
            "  }\n\n" +
            "  if (order.length !== tasks.length) {\n" +
            "    var blocked = [];\n" +
            "    indeg.forEach(function (d, t) { if (d > 0) blocked.push(t); });\n" +
            "    return { ok: false, blocked: blocked };   // every cycle lives in here\n" +
            "  }\n" +
            "  return { ok: true, order: order, waves: waves };\n" +
            "}"
          },

          { t: "h", text: "Benchmark" },
          { t: "table", headers: BENCH_HEADERS, rows: [
            ["V = 100, E = 300 (a checklist)", "~10K checks", "~400 ops", "both well under a millisecond", "Either \u2014 but Kahn is not more code"],
            ["V = 20,000, E = 60,000 (CI graph)", "~400M checks", "~80K ops", "roughly 2 s vs well under a millisecond", "Kahn"],
            ["V = 1,000,000, E = 4,000,000 (build graph)", "~10\u00b9\u00b2 checks", "~5M ops", "roughly 1.5 hours vs roughly 25 ms", "Kahn"]
          ] },
          { t: "p", html: "Orders of magnitude, not measurements. This table is the module's cleanest case because there is nothing to weigh: Kahn is asymptotically better, no harder to write, and gives you cycle detection and parallel waves as by-products. When a benchmark comes out this one-sided, say so quickly and move on \u2014 spending three minutes justifying an obvious choice reads as uncertainty, not rigour." },

          { t: "h", text: "Prompting and verification" },
          { t: "ul", items: [
            "<strong>Worked:</strong> \u201cKahn's algorithm over an indegree map, emitting waves. If the emitted count is below the task count, return <code class='tok'>{ok: false, blocked}</code> \u2014 do not throw.\u201d Making the failure path part of the return type is the instruction that most changes the output.",
            "<strong>Worked:</strong> \u201cAdd a fixture with a duplicate edge A\u2192B listed twice, and assert the order is still valid.\u201d You have to know the bug exists to ask for the fixture, which is the whole job.",
            "<strong>Garbage:</strong> \u201cSort these tasks by dependency.\u201d Recursive DFS with no cycle guard, which recurses forever on the first cyclic input. Its own generated fixtures are acyclic, so the demo is flawless."
          ] },
          { t: "ul", items: [
            "<strong>Tests first:</strong> a diamond (A\u2192B, A\u2192C, B\u2192D, C\u2192D) produces a valid order; a two-node cycle returns <code class='tok'>ok:false</code> naming both; a self-loop is a cycle of one; an unknown prerequisite id raises; an empty graph returns an empty order; the same input twice returns the same order if you promised determinism.",
            "<strong>The defect to expect:</strong> counting a duplicate edge twice. Indegree never reaches zero for that task, so it silently disappears from the output and the run reports a cycle that does not exist. De-duplicate at build time, or count edges consistently in both directions."
          ] },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "Working topological order with cycle detection that does not hang", "Explains the indegree invariant in a sentence"],
            ["Senior", "Iterative Kahn, duplicate-edge handling, deterministic ordering, waves emitted", "States O(V+E) and points out that cycle detection is free rather than extra"],
            ["Staff", "Failure is a return value with the blocked set, designed for a caller to act on", "Reads the wave count as the critical path and says what that implies for build time"]
          ] },

          { t: "note", variant: "key", html: "<strong>Indegree zero means runnable.</strong> Kahn's algorithm is O(V+E), gives cycle detection for the price of a counter comparison, and hands you parallel waves for free. If fewer tasks came out than went in, the remainder <em>is</em> your cycle report." },
          { t: "quiz", id: "aiec-aibreakdowns" }
        ]
      }
    ]
  };

  /* =================================================================
     MODULE 2 — Closing The Loop
     ================================================================= */
  var MODULE_REVIEW = {
    id: "aiecreview",
    name: "Closing The Loop",
    icon: "broom",
    lessons: [
      {
        id: "aiec-review",
        title: "Putting it together",
        summary: "One end-to-end dry run of an AI-paired session, a checklist you can rehearse, and the failure modes ranked by cost.",
        minutes: 11,
        tags: ["ai-pair", "review", "interview-craft"],
        blocks: [
          { t: "p", html: "Everything in this track has been one argument made ten different ways: <strong>judgment is the deliverable</strong>. The model is fast and confident and it will produce something plausible for any prompt you give it, including the prompts you have not thought through. The round is not testing whether you can get code out of it. It is testing whether the design that ends up on screen is the one you chose." },

          { t: "h", text: "The five beats" },
          { t: "ol", items: [
            "<strong>Orient</strong> \u2014 restate the task in your own words, ask the two or three questions that would change your design, and agree the interface. No code yet.",
            "<strong>Plan</strong> \u2014 say the decomposition out loud and mark each piece <em>mine</em> or <em>model's</em>. This is the beat candidates skip and the one interviewers remember.",
            "<strong>Drive</strong> \u2014 prompt for one bounded piece at a time, predict what you expect before you read the output, and keep the state model in your own hands.",
            "<strong>Verify</strong> \u2014 tests you wrote, run against code you read. Anything you cannot explain gets a test or gets deleted.",
            "<strong>Narrate</strong> \u2014 close with the trade-off you took, the one you rejected, and what would change your mind at ten times the input size."
          ] },
          { t: "stat", items: [
            { v: "~5 min", k: "orient" },
            { v: "~5 min", k: "plan" },
            { v: "~22 min", k: "drive" },
            { v: "~10 min", k: "verify" },
            { v: "~3 min", k: "narrate" }
          ] },
          { t: "p", html: "That is a 45-minute shape; scale it, do not reorder it. The two beats that get eaten under pressure are <em>plan</em> and <em>verify</em>, and they are the two that the round is actually scoring. If you are running late, cut scope \u2014 build four of the six behaviours properly \u2014 rather than cutting verification, which converts a small feature into an unproven one." },

          { t: "h", text: "A dry run: kitchen-queue, end to end" },
          { t: "p", html: "Take the <code class='tok'>kitchen-queue</code> task from the previous module: orders with priorities and prep-time prerequisites, one cook. Here is the whole session compressed into what you would actually say and send." },
          { t: "code", lang: "text", code:
            "ORIENT (aloud, no typing)\n" +
            "  \"Orders have a priority and a prep time, and some are blocked by others.\n" +
            "   Before I model this: one cook or several? Is priority absolute or does\n" +
            "   arrival break ties? Do I need to detect a prerequisite cycle?\"\n" +
            "  -> one cook, priority then arrival, cycles must be reported.\n\n" +
            "PLAN (aloud, then a comment block in the file)\n" +
            "  readiness gates, priority orders.  <- the invariant, written down\n" +
            "  mine   : readiness rule, clock advance, comparator\n" +
            "  model's: binary heap, fixtures, the cycle test\n\n" +
            "DRIVE (three bounded prompts, in this order)\n" +
            "  1. \"Binary min-heap over an array, injected comparator, push/pop/size.\"\n" +
            "     predict: ~25 lines, sift up and down, no allocation per op.\n" +
            "  2. \"Given blockedCount and dependents, write the loop. A task becomes\n" +
            "      heap-eligible only when its count reaches zero.\"\n" +
            "     predict: the risk is pushing dependents up front - check that first.\n" +
            "  3. \"Fixtures: a chain, a diamond, a two-node cycle, and a case where a\n" +
            "      high-priority order is blocked by a slow prerequisite.\"\n\n" +
            "VERIFY (my tests, their code)\n" +
            "  blocked-high-priority test  -> must run AFTER the ready low-priority one\n" +
            "  two-node cycle              -> returns ok:false, does not hang\n" +
            "  idle gap                    -> clock jumps to next arrival, no early start\n\n" +
            "NARRATE\n" +
            "  \"Heap because the ready set changes as orders complete. At fifty orders\n" +
            "   a linear scan would likely be faster - contiguous memory, no sift - so\n" +
            "   I would keep the scan if fifty were the real ceiling. It is not, because\n" +
            "   this same code will replay history, so O(n log n) it is.\"\n"
          },
          { t: "p", html: "Notice what is missing: there is no moment where a wall of generated code appears and gets accepted. Three bounded prompts, each with a prediction attached, each checked before the next one goes out. That rhythm is the whole technique, and it is why the fixture prompt comes <em>third</em> rather than last \u2014 you want the adversarial cases in hand before you believe the implementation." },

          { t: "h", text: "The rehearsal checklist" },
          { t: "ul", items: [
            "I restated the problem and asked at least two questions that could change the design.",
            "I named the invariant \u2014 one sentence \u2014 and wrote it into the file before any code existed.",
            "I decided which pieces I own, and the state model was always one of them.",
            "Every prompt was scoped to one piece and carried an explicit contract: inputs, return values, forbidden behaviours.",
            "I said what I expected before reading each output, and said whether it matched.",
            "I wrote at least one test that the happy path cannot satisfy.",
            "There is no line on screen I cannot explain.",
            "I stated one complexity, one constant-factor caveat, and the input size at which my answer would change."
          ] },

          { t: "h", text: "Failure modes, ranked by how often they cost the offer" },
          { t: "table", headers: ["Rank", "Failure mode", "What it looks like", "The fix"], rows: [
            ["1", "Accepting unread code", "Fluent output, then a pause when asked why a branch exists", "Predict before you read; anything unexplained gets a test or gets cut"],
            ["2", "Skipping the plan", "Prompting in minute two, refactoring the data model in minute twenty", "Five minutes of decomposition, with owners marked, before the first prompt"],
            ["3", "Unscoped prompts", "A whole application arrives with its own state shape", "One piece per prompt, with the interface pinned in the prompt itself"],
            ["4", "Testing only the happy path", "Green suite, and the DFS still returns the long route", "Write the adversarial fixture first \u2014 two routes, a cycle, a duplicate edge"],
            ["5", "Reciting complexity without context", "\u201cO(n log n) beats O(n\u00b2)\u201d with no mention of n", "Name the size, then the constant factors that decide it there"],
            ["6", "Over-engineering on the model's suggestion", "A cache, a pool and an abstraction nobody asked for", "Ask what it buys at the stated size; if the answer is nothing, decline out loud"]
          ] },
          { t: "compare",
            bad: { title: "Riding", items: [
              "Prompt, skim, accept, repeat",
              "The data model is whatever arrived first",
              "Tests are written to match the code",
              "\u201cIt works\u201d is the strongest available claim"
            ] },
            good: { title: "Driving", items: [
              "Predict, prompt, compare, decide",
              "The data model is yours and the model fills it in",
              "Tests are written to break the code",
              "\u201cHere is the trade-off, and here is when I would change it\u201d"
            ] }
          },

          { t: "note", variant: "warn", html: "The most expensive thirty seconds in this round is the one where you accept a suggestion because it is <em>syntactically satisfying</em> \u2014 it compiles, it reads well, it fills the hole. That is the moment the design quietly stops being yours, and it is almost always the code you cannot defend twenty minutes later." },

          { t: "h", text: "How this scores at each level" },
          { t: "table", headers: LEVEL_HEADERS, rows: [
            ["Mid", "A working feature with real tests, and every line explainable", "Can walk through the design and say which parts came from the model"],
            ["Senior", "A deliberate decomposition, adversarial tests, one justified performance decision", "States the trade-off and the input size that would reverse it, unprompted"],
            ["Staff", "Boundaries drawn so the risky parts are isolated and the rest is replaceable", "Turns the exercise into a conversation about what this would need to survive in production, without losing the clock"]
          ] },

          { t: "cue", html: "<b>Take the wheel back when</b> you catch yourself scrolling rather than reading; when a suggestion introduces a type, a file or a dependency you did not plan; when the code passes tests you did not write; when you cannot say in one sentence what a function guarantees; or when you are about to say \u201cthat looks right\u201d about anything you would not have written yourself." },

          { t: "note", variant: "key", html: "<strong>Judgment is the deliverable.</strong> Orient, plan, drive, verify, narrate \u2014 the two beats you will be tempted to skip are the two being scored. Predict before every prompt, own the state model, and finish with a trade-off and the size at which you would change your mind. That is the whole round, and it is entirely rehearsable." },
          { t: "quiz", id: "aiec-aiecreview" }
        ]
      }
    ]
  };

  /* =================================================================
     Register — order-independent, push only. A sibling file owns the
     track's name / short / color / blurb.
     ================================================================= */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.aiec || (window.TRACKS.aiec = { id: "aiec", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MODULE_BREAKDOWNS, MODULE_REVIEW);
})();
