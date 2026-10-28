/* =====================================================================
   AI-Enabled Coding · module "aipatterns"
   The classic algorithmic pattern families, reframed for work done with
   an AI pair programmer. The algorithm is not the lesson — directing and
   verifying the model on each family is. Judgment is the deliverable.

   This file owns: one module pushed onto window.TRACKS.aiec, one quiz
   (aiec-aipatterns), one widget (aiecPatternPicker). Sibling files own
   the track's own metadata and the other modules, so this file only ever
   pushes and only ever merges.
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     widgets owned by this file
  ------------------------------------------------------------------ */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (attrs[k] == null) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* Five problem statements, one per family this module covers most often.
     Everything here is fixed data — the widget is deterministic. */
  var PICKS = [
    {
      label: "grid + walls",
      statement: "Fewest moves from the start to the exit on a grid where '#' is a wall.",
      family: "Breadth-first search over an unweighted graph",
      yours: "Whether every move costs the same. If it does, BFS is exact and cheap. The moment one move costs more than another, this is Dijkstra and BFS becomes confidently wrong.",
      prompt: "BFS on a character grid, 4-neighbour moves, return (moves, path).\nMark a cell visited when you enqueue it, not when you dequeue it, and\ncomment that line. Return (-1, []) when the exit is unreachable.",
      checks: [
        { defect: "Cells are marked visited at dequeue, so the same cell is enqueued many times over.", check: "Count enqueues and assert the total never exceeds the number of cells." },
        { defect: "The path comes back goal-first, or without the start cell.", check: "Assert path[0] is the start, path[-1] is the exit, and len(path) - 1 equals the reported move count." },
        { defect: "An unreachable exit returns 0 instead of a sentinel.", check: "Wall the exit off completely and assert -1, not a falsy zero." }
      ]
    },
    {
      label: "prereqs",
      statement: "Order a set of tasks so that every prerequisite runs before the task that needs it.",
      family: "Topological sort over a directed graph",
      yours: "What a cycle means for your caller — an error to report with names, or a state to repair. Decide before you prompt, because it changes the signature.",
      prompt: "Kahn topological sort over (nodes, edges). If len(order) != len(nodes)\nafter the main loop, raise with every name whose in-degree is still above\nzero. Seed the ready queue in sorted order so runs are repeatable.",
      checks: [
        { defect: "A cyclic input returns a short list rather than raising, and a short list reads as plausible.", check: "Feed A to B and B to A. Assert it raises. A two-node cycle is the entire test." },
        { defect: "Nodes that appear only as somebody's dependency never make it into the output.", check: "Assert len(order) equals the count of distinct names across both sides of the edge list." },
        { defect: "A DFS variant uses one visited set and calls any re-convergence a cycle.", check: "Feed the diamond A to B, A to C, B to D, C to D. Assert it succeeds — that graph is acyclic." }
      ]
    },
    {
      label: "fewest boxes",
      statement: "Pack a list of order sizes into as few fixed-capacity boxes as possible.",
      family: "Greedy bin packing — an approximation, not an optimum",
      yours: "Whether \"fewest\" means provably minimal or good enough. Minimal is a search over an NP-hard problem; good enough is a heuristic you are obliged to label as one.",
      prompt: "First-fit-decreasing bin packing. Sort descending, then first fit.\nAdd one comment stating this is a heuristic with no optimality guarantee.\nFinish with two asserts: every bin's load <= capacity, and the multiset\nof packed items equals the input.",
      checks: [
        { defect: "The capacity test uses < where it needs <=, so an item that exactly fills a bin opens a new one.", check: "Pack [5, 5] into capacity 10 and assert one bin." },
        { defect: "An item that fits nowhere is dropped instead of opening a bin, which makes the packing look tighter.", check: "Assert the multiset of packed items equals the input — item counts, not eyeballs." },
        { defect: "The docstring calls the result optimal, because that word is free.", check: "Brute force any instance under about ten items. Capacity 10 with [2, 5, 4, 7, 1, 3, 8] needs four bins in arrival order and three sorted descending." }
      ]
    },
    {
      label: "at most k",
      statement: "Longest run in a string containing at most k distinct characters.",
      family: "Two-pointer window with a count map",
      yours: "What the window is allowed to hold, and whether k bounds distinct characters or total characters. Everything downstream is bookkeeping.",
      prompt: "Longest substring with at most k distinct characters, two-pointer window\nplus a count map. Delete a key the moment its count hits zero so the map\nsize IS the distinct count. Return the length and the window bounds.",
      checks: [
        { defect: "Counts drop to zero but the keys stay, so the map size overstates the distinct count and the window never grows.", check: "\"aaabbb\" with k = 1 must return 3." },
        { defect: "The shrink is an if where it needs to be a while, so one contraction is not enough.", check: "\"abaccc\" with k = 2 must return 4." },
        { defect: "The reported length is R - L instead of R - L + 1.", check: "A single character with k = 1 must return 1." }
      ]
    },
    {
      label: "cut a rod",
      statement: "Maximum revenue from cutting a rod of length n, given a price for each piece length.",
      family: "Dynamic programming over one dimension",
      yours: "The recurrence and the base cases, written as one line of comment before any code exists. That line is the only thing you can check cheaply, and everything else depends on it.",
      prompt: "Comments only, no code: state the recurrence for the best revenue from a\nrod of length n and the base case at length 0. Say what the index means.\nThen stop and wait.",
      checks: [
        { defect: "The table is sized n instead of n + 1, or the length-0 entry is never set.", check: "Assert length 0 gives 0 and length 1 gives the price of a 1-piece." },
        { defect: "The memo is keyed on part of the state, which is invisible until a second dimension varies.", check: "Cross-check the memoised version against the plain recursion for every length up to about twelve." },
        { defect: "The loop reuses a piece it should not, or refuses one it should — the same defect that turns 0/1 knapsack into unbounded.", check: "Rod cutting does allow reuse. Hand-compute one case, then re-derive the loop direction for any 0/1 variant separately." }
      ]
    }
  ];

  Widgets.aiecPatternPicker = function (mount) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "triage"),
      h("h3", {}, "Which pattern, and what do I delegate?")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Pick a problem statement to see the family, the decision that stays with you, the prompt worth typing, and the check that catches the defect this family attracts. Click the same statement again to walk to its next defect."));

    var stage = h("div", { class: "w-stage" });
    var segWrap = h("div", { class: "w-seg" });
    var statement = h("p", { style: "margin:14px 0 12px;font-weight:600" }, "");
    var top = h("div", { class: "w-readout" });
    var promptCap = h("div", { style: "margin-top:16px;font-size:0.68rem;letter-spacing:0.09em;text-transform:uppercase;opacity:0.65" }, "the prompt worth typing");
    var promptBox = h("div", { style: "margin-top:6px;font-family:var(--font-mono);font-size:0.76rem;line-height:1.6;white-space:pre-wrap" }, "");
    var bottom = h("div", { class: "w-readout" });

    var idx = 0;
    var step = 0;

    function ro(label, value) {
      return h("span", { class: "ro", style: "flex:1 1 100%" }, label + "  ", h("b", {}, value));
    }

    function render() {
      var p = PICKS[idx] || PICKS[0];
      var checks = (p.checks && p.checks.length) ? p.checks : [{ defect: "n/a", check: "n/a" }];
      var at = step % checks.length;
      var c = checks[at];

      statement.textContent = p.statement;
      top.innerHTML = "";
      top.appendChild(ro("pattern family", p.family));
      top.appendChild(ro("your call, not the model's", p.yours));
      promptBox.textContent = p.prompt;
      bottom.innerHTML = "";
      bottom.appendChild(ro("likely defect " + (at + 1) + " of " + checks.length, c.defect));
      bottom.appendChild(ro("cheapest check", c.check));
    }

    PICKS.forEach(function (p, i) {
      var b = h("button", { class: i === 0 ? "w-seg-btn active" : "w-seg-btn" }, p.label);
      b.addEventListener("click", function () {
        if (i === idx) step = step + 1;
        else { idx = i; step = 0; }
        var all = segWrap.querySelectorAll("button");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
        b.classList.add("active");
        render();
      });
      segWrap.appendChild(b);
    });

    stage.appendChild(segWrap);
    stage.appendChild(statement);
    stage.appendChild(top);
    stage.appendChild(promptCap);
    stage.appendChild(promptBox);
    stage.appendChild(bottom);
    mount.appendChild(stage);
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ------------------------------------------------------------------
     quizzes owned by this file
  ------------------------------------------------------------------ */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "aiec-aipatterns": {
      title: "Patterns with a copilot checkpoint",
      sub: "Delegating the mechanical part, keeping the judgment, and catching what the model gets wrong.",
      questions: [
        {
          q: "You asked for \"the cheapest route between two towns, where each road has a toll\", and the model produced a clean breadth-first search. What is the cheapest way to prove it is wrong?",
          options: [
            "Run it on a large random graph and compare the wall-clock time against a known implementation",
            "Add type annotations and re-read the function line by line",
            "Build a three-node graph where the direct road costs 10 and the two-road detour costs 1 + 1",
            "Ask the model to confirm whether it used Dijkstra's algorithm"
          ],
          answer: 2,
          explain: "BFS minimises the number of edges, not their total cost, so it happily returns the single 10-cost road. A three-node instance where fewest hops and cheapest cost disagree separates the two algorithms in one assertion. Timing measures speed, not correctness, and asking the model to grade itself produces an answer rather than evidence."
        },
        {
          q: "Your DFS post-order topological sort has to reject cyclic input. Which observation actually proves a cycle?",
          options: [
            "A neighbour that is already in the finished set",
            "An output list shorter than the number of nodes",
            "A node reached from two different top-level calls",
            "A neighbour that is still on the current recursion stack"
          ],
          answer: 3,
          explain: "A cycle is a back edge, and a back edge is exactly an edge into a node whose recursive call has not returned yet — the grey or on-stack marker. Hitting an already-finished node is ordinary re-convergence and happens in any diamond-shaped acyclic graph, so treating it as a cycle gives false positives. The short-output test belongs to Kahn's algorithm; in a DFS every node eventually finishes, so the count tells you nothing."
        },
        {
          q: "A generated permutation routine returns exactly the right number of results, but every result is an empty list. What is the most likely cause?",
          options: [
            "The base case stores the live path object instead of a copy of it",
            "The recursion never reaches its base case",
            "The used array is allocated one element too short",
            "The results list is declared inside the recursive function"
          ],
          answer: 0,
          explain: "Appending the shared path stores a reference, so as the recursion unwinds and each undo step pops an element, every stored reference drains to empty. The count is right because the base case still fires the right number of times, which is why this defect survives a test that only checks the length of the result list. Take a snapshot at the leaf and the same code is correct."
        },
        {
          q: "You need to pack orders into the fewest boxes and you know greedy will not always be optimal. What is the best thing to ask for?",
          options: [
            "The optimal packing, so the answer is exact",
            "First-fit-decreasing, returning the bin contents plus a comment stating it is a heuristic with no optimality guarantee",
            "An exhaustive search over all assignments, so optimality is guaranteed",
            "A thousand random shuffles fed through first-fit, keeping the best result"
          ],
          answer: 1,
          explain: "Naming the heuristic makes the output reviewable in seconds and signals out loud that you know bin packing is NP-hard, which is the judgment being assessed. Asking for \"the optimal packing\" invites a confident claim you cannot verify. Exhaustive search dies past a dozen items, and random restarts trade a reviewable answer for a nondeterministic one."
        },
        {
          q: "Twenty minutes left, and the problem is clearly dynamic programming. What is the best first prompt?",
          options: [
            "Write a dynamic programming solution to this problem",
            "Write the fully space-optimised bottom-up version directly",
            "State the recurrence and the base cases in comments only, no code yet",
            "Generate fifty test cases before writing any solution"
          ],
          answer: 2,
          explain: "The recurrence is the one part you can check in ten seconds and the part every later step inherits, so a wrong recurrence wastes all the work that follows. Asking for a whole DP solution gets you a plausible table you cannot audit under time pressure. Jumping straight to the space-optimised form also throws away the slow reference version you would have checked it against."
        },
        {
          q: "A space-optimised 0/1 knapsack came back and you suspect the capacity loop runs the wrong way. Which single case exposes it fastest?",
          options: [
            "A capacity larger than the total weight of all items",
            "An empty item list with capacity 0",
            "Every item given a value of 0",
            "One item of weight 1 and value 1 with capacity 5 — the answer must be 1"
          ],
          answer: 3,
          explain: "Iterating capacity upward lets the row you are writing feed itself, so the same item is taken repeatedly and 0/1 quietly becomes unbounded knapsack — the buggy version returns 5. The empty case and the all-zero case return 0 either way, and an oversized capacity returns the total value either way, so none of them distinguish the two loops. You need an input where reuse changes the answer."
        },
        {
          q: "Why is \"write a regex that parses this format\" usually the wrong thing to delegate?",
          options: [
            "A dense pattern is hard to review by eye, can backtrack catastrophically on near-matches, and cannot express nesting at all",
            "Regex engines are slower than hand-written loops in every case",
            "Models cannot reliably produce syntactically valid regular expressions",
            "Regular expressions cannot be unit tested"
          ],
          answer: 0,
          explain: "You still own the review, and a sixty-character pattern hides its own bugs in a way a twenty-line tokeniser does not. Nested quantifiers can turn an input that almost matches into exponential work, and no regular expression handles arbitrary nesting such as balanced brackets. Ask instead for a small named tokeniser, or several short anchored patterns you can test one at a time."
        },
        {
          q: "You are asked to build an LRU cache with an AI pair. How should the work split?",
          options: [
            "Let the model choose the structures and write the pointer plumbing yourself",
            "Choose the hash-map-plus-doubly-linked-list pairing yourself, delegate the node splicing, then test that a read protects a key from eviction",
            "Delegate the whole thing and read the result once before running it",
            "Write all of it yourself, since models are unreliable on data structures"
          ],
          answer: 1,
          explain: "Structure selection is what fixes the complexity contract, and it is the part being assessed; pointer surgery is mechanical, and models are fast and accurate at it. The eviction-after-read test then targets the single most common generated defect — a get that returns the right value without marking the entry as recently used. Writing everything yourself wastes the time advantage you were given."
        }
      ]
    }
  });

  /* ------------------------------------------------------------------
     module
  ------------------------------------------------------------------ */
  var MODULE = {
    id: "aipatterns",
    name: "Patterns With A Copilot",
    icon: "share",
    lessons: [

      /* =============================== 1 =============================== */
      {
        id: "ds-design",
        title: "Designing a data structure to order",
        summary: "Pick the pair of structures yourself, delegate the pointer plumbing, and spend your review budget on the one invariant models drop.",
        minutes: 10,
        tags: ["data-structures", "delegation", "review"],
        blocks: [
          { t: "p", html: "A “design a structure that supports these operations” question is two questions wearing one coat. The first is <strong>which structures</strong>: what pair of primitives makes every required operation cheap at the same time. The second is <strong>how they are wired</strong>: splicing nodes, keeping two containers in step, handling the empty case. The first is judgment and it is the thing being assessed; the second is plumbing, and an AI pair is genuinely good at it. So the division of labour is not a compromise, it is the answer — <strong>you choose, the model types</strong>. Ask for “an LRU cache” and you get a working one, because it has seen thousands; ask for a structure supporting <em>insert, delete and get-random in O(1)</em> and it will often reach for something plausible and slow, because that choice needs a reason and it does not have yours." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "“Design a cache / a scheduler / a leaderboard that supports …” followed by a list of operations.",
            "<em>“All operations in O(1)”</em> or <em>“each operation in logarithmic time”</em> — a complexity target attached to a set of operations rather than to one algorithm.",
            "“As numbers arrive, report the median / the running maximum / the k-th largest.” The word <em>arrive</em> means a structure, not a sort.",
            "“Are these two accounts in the same group?” plus “merge two groups” — connectivity under merges.",
            "Two operations that pull in opposite directions: fast lookup <em>and</em> a maintained order; fast insert <em>and</em> a maintained rank."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "table",
            headers: ["Primitive", "What it buys", "What it cannot do"],
            rows: [
              ["Hash map", "O(1) average lookup and delete by key", "No order at all — it cannot tell you what is oldest or largest"],
              ["Doubly linked list", "O(1) splice and unsplice given a node reference", "No lookup — you must be handed the node"],
              ["Two heaps (max-heap of the low half, min-heap of the high half)", "O(log n) insert with the median at the two tops", "No lookup or delete of an arbitrary value"],
              ["Parent array with path compression and union by size", "Near-constant amortised merge and find", "No split, and no ordering within a group"]
            ]
          },
          { t: "p", html: "Almost every ordered-structure question is <strong>one lookup primitive plus one order primitive</strong>, glued so that each operation touches both. Naming that pair out loud is most of the answer: “a dictionary from key to node, and a doubly linked list holding recency” already implies O(1) get and put before a line exists." },
          { t: "h", text: "Worked example" },
          { t: "p", html: "Capacity 2. Put <code class='tok'>a</code>, put <code class='tok'>b</code>, <em>get</em> <code class='tok'>a</code>, put <code class='tok'>c</code>. The only interesting question is which key <code class='tok'>c</code> evicts, and the answer is <code class='tok'>b</code> — because a read counts as a touch. That single sentence is the invariant, and it is the line generated code most often omits." },
          { t: "code", lang: "python", code:
            "# The dict answers \"where is it?\".  The list answers \"what is oldest?\".\n" +
            "class Node:\n" +
            "    __slots__ = (\"k\", \"v\", \"prev\", \"next\")\n" +
            "    def __init__(self, k=None, v=None):\n" +
            "        self.k, self.v = k, v\n" +
            "        self.prev = self.next = None\n\n" +
            "class LRU:\n" +
            "    def __init__(self, cap):\n" +
            "        self.cap = cap\n" +
            "        self.map = {}                      # key -> Node\n" +
            "        self.head = Node()                 # sentinel: most recent side\n" +
            "        self.tail = Node()                 # sentinel: least recent side\n" +
            "        self.head.next, self.tail.prev = self.tail, self.head\n\n" +
            "    def _unlink(self, n):\n" +
            "        n.prev.next, n.next.prev = n.next, n.prev\n\n" +
            "    def _push_front(self, n):\n" +
            "        n.prev, n.next = self.head, self.head.next\n" +
            "        self.head.next.prev = n\n" +
            "        self.head.next = n\n\n" +
            "    def get(self, k):\n" +
            "        n = self.map.get(k)\n" +
            "        if n is None:\n" +
            "            return -1\n" +
            "        self._unlink(n); self._push_front(n)   # a READ is a touch\n" +
            "        return n.v\n\n" +
            "    def put(self, k, v):\n" +
            "        n = self.map.get(k)\n" +
            "        if n is not None:\n" +
            "            n.v = v\n" +
            "            self._unlink(n); self._push_front(n)\n" +
            "            return\n" +
            "        if len(self.map) == self.cap:\n" +
            "            oldest = self.tail.prev\n" +
            "            self._unlink(oldest)\n" +
            "            del self.map[oldest.k]         # BOTH structures, every time\n" +
            "        n = Node(k, v)\n" +
            "        self.map[k] = n\n" +
            "        self._push_front(n)\n\n" +
            "# cap=2: put(a) put(b) get(a) put(c)  ->  b is evicted, not a."
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>Write the operation list with a target complexity beside each one.</strong> Four lines. This is the contract, and it is what makes a wrong structure obviously wrong.",
            "<strong>Pick the lookup primitive, then the order primitive.</strong> If you cannot name why each one is there, you are not ready to prompt.",
            "<strong>Decide who owns each invariant.</strong> “The dict and the list always hold the same key set” is a sentence you will use to review the generated code.",
            "<strong>Decide the boundary rules yourself:</strong> what a miss returns, what happens at capacity zero, what a duplicate key does, what the median of an empty stream is. Models pick a plausible answer here and never mention it.",
            "<strong>Only then prompt.</strong> The prompt should contain your structure choice, not ask for one."
          ] },
          { t: "note", variant: "warn", html: "The cost of two structures is <strong>two places to update on every mutation</strong>. Every defect in this family is one of those updates missing: the node moved but the dict was not touched, or the dict entry was deleted but the node stayed linked. When you review, do not read the code top to bottom — read every mutation and ask “did both containers change?”." },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "Implement an LRU cache as a dict from key to node plus a doubly linked\n" +
            "list with sentinel head and tail. get(key) -> value or -1, put(key,\n" +
            "value) -> None, both O(1).\n\n" +
            "Constraints, so I can review this in 90 seconds:\n" +
            "- get() must move the node to the front. Comment that line.\n" +
            "- On eviction, remove the entry from BOTH the list and the dict.\n" +
            "- No OrderedDict and no move_to_end. I want the pointer work visible.\n" +
            "- Sentinels, so no branch on \"is this the head\".\n" +
            "- Every method under twelve lines, no logging, no extra error handling."
          },
          { t: "p", html: "The constraint that earns its keep is <strong>“comment that line”</strong>. It forces the one behaviour you are going to check into a place you can find without reading the whole file, and if the model cannot produce the comment it usually has not produced the behaviour either. “No OrderedDict” matters for a different reason: the shortcut is correct but it hides the structure you were asked to design, and you cannot discuss what you cannot see." },
          { t: "table",
            headers: ["Tier", "Prompt", "What you get"],
            rows: [
              ["Naive", "“Write an LRU cache.”", "Working code built on a library shortcut, no visible design, nothing to talk about"],
              ["Naive", "“Write an efficient O(1) cache with eviction.”", "The model picks the structures, so the assessed decision was delegated"],
              ["Solid", "“Dict plus doubly linked list, sentinels, get moves to front.”", "Your design, its typing — reviewable in a minute"],
              ["Standout", "The same, plus the review constraints and the boundary rules you already decided", "Reviewable <em>and</em> pre-loaded with the tests you are about to run"]
            ]
          },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["<code class='tok'>get()</code> returns the value but does not move the node", "Every value returned is correct, so functional tests pass; only eviction order is wrong", "Capacity 2: put a, put b, get a, put c. Assert <code class='tok'>a</code> survives and <code class='tok'>b</code> is gone"],
              ["The evicted node leaves the list but stays in the dict", "The dict silently grows past capacity and can hand back an unlinked node", "Assert <code class='tok'>len(map) &lt;= cap</code> after ten puts into a capacity-3 cache"],
              ["Two-heap median rebalances one element too late", "Odd counts look right; only even counts are wrong", "Push 1, 2, 3, 4 and assert the median is 2.5"],
              ["Union-find writes <code class='tok'>parent[x] = y</code> instead of <code class='tok'>parent[find(x)] = find(y)</code>", "Chains of merges still look connected, so a linear test passes", "<code class='tok'>union(0,1); union(0,2)</code> then assert <code class='tok'>find(1) == find(2)</code> — the buggy version orphans 1"]
            ]
          },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> When the problem hands you an <em>operation list</em> with complexity targets instead of a single question; when a maintained order must survive arbitrary lookups; when items merge into groups and you need membership; when a value must be reported continuously as data arrives. The tell is the word <em>supports</em>." },
          { t: "ul", items: [
            "<strong>Just a sorted list</strong> if the data is loaded once and only read afterwards — no structure needed, and saying so is a point in your favour.",
            "<strong>A single heap</strong> if you only ever need one end of the order. Two heaps only earn their complexity when you need the middle.",
            "<strong>A balanced BST or a skip list</strong> when you need order <em>and</em> range queries; the hash-plus-list pairing gives you order but no ranges.",
            "<strong>The language's ordered dictionary</strong> in production code. In an interview it is the right answer to mention and the wrong answer to submit."
          ] },
          { t: "widget", id: "aiecPatternPicker" },
          { t: "note", variant: "key", html: "<strong>Choose the pair, delegate the plumbing, test the consequence.</strong> Name your two primitives and the complexity each one buys before you type a prompt, then put the invariant into the prompt as a comment requirement. Every check in this family has the same shape: a fixed sequence of four or five operations and one assertion about a <em>consequence</em> rather than a return value — who got evicted, how big the map grew, who is still connected. Structure defects hide behind correct return values, which is exactly why reading the code is not enough." }
        ]
      },

      /* =============================== 2 =============================== */
      {
        id: "graph-search",
        title: "Graph search and pathfinding",
        summary: "Choose the search from the cost model, force visited-on-enqueue into the prompt, and falsify with a graph where hops and cost disagree.",
        minutes: 10,
        tags: ["graphs", "bfs", "dijkstra", "verification"],
        blocks: [
          { t: "p", html: "Every search over a graph is the same loop — take a frontier node, look at its neighbours, remember where you came from — and the only real question is <strong>what the frontier is ordered by</strong>. A queue orders by hop count, a stack orders by nothing in particular, a priority queue orders by accumulated cost. Pick the ordering from the cost model and the algorithm names itself. It is also the family where an AI pair is most likely to hand you something that runs, returns a path, and is wrong. Generated graph code fails in ways that <em>do not throw</em>: a search that is correct whenever all edges happen to cost the same, a visited set in the wrong place, a path returned backwards. None of those look like bugs while you read them, so choose your checks before you read the code." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "<em>“Fewest moves / minimum number of steps / shortest sequence”</em> with no cost per step — breadth-first search.",
            "<em>“Cheapest, fastest, lowest total toll”</em> with a non-negative number on each edge — Dijkstra.",
            "“Can I reach …”, “how many separate regions”, “is there a path at all” — depth-first search is enough and simpler.",
            "A grid of characters. A grid is a graph whose edges you never build; the neighbours are just four or eight offsets.",
            "“Word ladder”, “state after a sequence of legal moves”, “minimum number of transformations” — an implicit graph over states."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "table",
            headers: ["Piece", "The rule", "Cost"],
            rows: [
              ["Frontier container", "Queue for hop count, stack for reachability, min-heap keyed on distance for weighted cost", "BFS and DFS are O(V + E); Dijkstra with a binary heap is O((V + E) log V)"],
              ["Visited set", "Mark a node the moment you <em>enqueue</em> it, never when you dequeue it", "One set; without it a single cycle is an infinite loop"],
              ["Parent map", "<code class='tok'>parent[child] = current</code> written once, at the same moment you mark visited", "One map; walk it back from the goal and reverse"]
            ]
          },
          { t: "h", text: "Worked example" },
          { t: "p", html: "A 4-neighbour grid where <code class='tok'>#</code> is a wall. This version returns both the move count and the path, marks visited at enqueue, and uses a sentinel for “unreachable” rather than a zero that reads as success." },
          { t: "code", lang: "python", code:
            "from collections import deque\n\n" +
            "def shortest(grid, start, goal):\n" +
            "    R, C = len(grid), len(grid[0])\n" +
            "    if start == goal:\n" +
            "        return 0, [start]\n" +
            "    seen = {start}                      # marked at ENQUEUE time\n" +
            "    parent = {start: None}\n" +
            "    q = deque([start])\n" +
            "    while q:\n" +
            "        r, c = q.popleft()\n" +
            "        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):\n" +
            "            nr, nc = r + dr, c + dc\n" +
            "            if not (0 <= nr < R and 0 <= nc < C):\n" +
            "                continue\n" +
            "            if grid[nr][nc] == \"#\" or (nr, nc) in seen:\n" +
            "                continue\n" +
            "            seen.add((nr, nc))          # before the queue, not after\n" +
            "            parent[(nr, nc)] = (r, c)\n" +
            "            if (nr, nc) == goal:\n" +
            "                path, cur = [], goal\n" +
            "                while cur is not None:\n" +
            "                    path.append(cur)\n" +
            "                    cur = parent[cur]\n" +
            "                path.reverse()          # collected goal-first\n" +
            "                return len(path) - 1, path\n" +
            "            q.append((nr, nc))\n" +
            "    return -1, []                       # sentinel, not 0"
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>State the cost model in one sentence.</strong> “Every move costs one” or “each edge carries a non-negative toll”. That sentence selects the algorithm; nothing else does.",
            "<strong>Decide what you return</strong> — a count, a path, or both — and what unreachable looks like. A sentinel you chose beats a zero somebody assumed.",
            "<strong>Decide the neighbour rule</strong> yourself: four directions or eight, wrap-around or not, is the start cell allowed to be a wall.",
            "<strong>Choose where visited is marked</strong> and say it out loud. This is the single highest-value sentence in the whole family.",
            "<strong>Check for negative weights before anything else.</strong> If any edge can be negative, Dijkstra is out and you are looking at Bellman-Ford at O(V·E)."
          ] },
          { t: "note", variant: "trap", html: "Marking visited at <em>dequeue</em> instead of enqueue still returns the correct distance, which is exactly why it survives review. What it does is let a node be enqueued once per incoming edge, so the queue grows with E rather than V and an open grid degrades badly. Correct output, wrong cost — the hardest class of defect to spot by reading. Dijkstra inverts the rule rather than sharing it: a node is <strong>settled</strong> only when it is <em>popped</em> with its final distance, and stale heap entries are skipped on pop. Marking a node settled when you push it is the classic mistranslation, and that one is not merely slow — it returns distances that are too high." },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "BFS shortest path on a character grid: '.' walkable, '#' wall,\n" +
            "4-neighbour moves. Signature: shortest(grid, start, goal) ->\n" +
            "(moves, path).\n\n" +
            "Constraints, so I can review this in 90 seconds:\n" +
            "- Mark a cell visited at ENQUEUE time, not at dequeue. Comment it.\n" +
            "- Reconstruct the path from a parent map and return it start-first.\n" +
            "- Return (-1, []) when the goal is unreachable. No exceptions.\n" +
            "- Do not add diagonals, weights, or a heuristic. If a move could ever\n" +
            "  cost more than one, stop and say so rather than writing Dijkstra."
          },
          { t: "p", html: "That last constraint is the one worth stealing for every family. You are not just asking for code, you are asking the model to <strong>refuse and report</strong> when your framing is wrong. A model told “stop and say so” will sometimes tell you that your problem is weighted — which is a free correctness review of your own thinking, delivered before you have written a test." },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["No visited set at all", "Fine on any acyclic test; loops forever on the first cycle", "Two mutually adjacent open cells is already a cycle — assert the call returns at all"],
              ["Visited marked at dequeue", "Distances are correct, only the queue size is wrong", "Count enqueues; assert the total never exceeds the cell count"],
              ["BFS used where edges have costs", "It returns a real path, and it is right whenever the costs happen to be equal", "Three nodes: direct edge 10, detour 1 + 1. Assert 2"],
              ["Dijkstra settles a node when it is <em>pushed</em>", "Usually right, because the cheap route often arrives first", "0→1 costs 5, 0→2 costs 1, 2→1 costs 1. Assert dist(1) == 2, not 5"],
              ["Path returned goal-first, or missing the start", "The move count is right, so a count-only test passes", "Assert <code class='tok'>path[0] == start</code>, <code class='tok'>path[-1] == goal</code>, <code class='tok'>len(path) - 1 == moves</code>"]
            ]
          },
          { t: "code", lang: "text", code:
            "The three-line falsifier for \"is this BFS or Dijkstra?\":\n\n" +
            "    nodes  A B C\n" +
            "    edges  A-B cost 10        <- one hop, expensive\n" +
            "           A-C cost 1\n" +
            "           C-B cost 1         <- two hops, cheap\n\n" +
            "    BFS      -> 10   (fewest hops)\n" +
            "    Dijkstra -> 2    (lowest cost)\n\n" +
            "Keep this graph in your head. It costs nothing to type and it\n" +
            "separates the two algorithms on the first run."
          },
          { t: "table",
            headers: ["Bar", "What is expected on this family"],
            rows: [
              ["Mid", "Names BFS or Dijkstra correctly, gets a working implementation out of the model, states O(V + E)"],
              ["Senior", "Derives the choice from the cost model out loud, puts the visited-on-enqueue rule in the prompt, and runs the hops-versus-cost falsifier without being asked"],
              ["Staff", "Also names what would change the answer — negative edges, a heuristic worth adding, a bidirectional search — and says which of those is not worth the complexity here"]
            ]
          },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Any time the problem is “get from one state to another” and you can describe a neighbour. <em>Fewest steps</em> and unweighted → BFS. <em>Cheapest</em> with non-negative weights → Dijkstra. <em>Reachable at all</em>, or “count the regions” → DFS. <em>Any negative weight</em> → not Dijkstra, and say so before you write anything." },
          { t: "compare",
            bad: { title: "Reaching for Dijkstra by default", items: ["A heap you did not need, so O((V+E) log V) instead of O(V+E)", "More generated code to review for the same answer", "Hides whether you understood the cost model"] },
            good: { title: "Choosing from the cost model", items: ["BFS when every move costs one — simpler and faster", "The choice itself becomes something you can defend out loud", "One falsifying graph proves you picked right"] }
          },
          { t: "note", variant: "key", html: "<strong>The cost model picks the algorithm; the visited rule picks the runtime.</strong> Say “every move costs the same, so this is BFS” out loud, require visited-on-enqueue in the prompt, and keep the three-node graph where fewest hops and lowest cost disagree — it is the cheapest proof that the model solved your problem rather than a similar one." }
        ]
      },

      /* =============================== 3 =============================== */
      {
        id: "topo-sort",
        title: "Topological sort and dependency resolution",
        summary: "Kahn or DFS post-order, chosen deliberately, with cycle detection written into the signature rather than discovered in production.",
        minutes: 9,
        tags: ["graphs", "topological-sort", "cycles"],
        blocks: [
          { t: "p", html: "A dependency question is a directed graph plus one promise: <strong>every edge points from a thing that must happen first to a thing that happens later</strong>. Topological sort is any order that keeps that promise, and there is usually more than one. The interesting part is not producing an order — the model will do that correctly — it is what happens when no order exists. So treat cycle detection as part of the signature rather than error handling bolted on afterwards: “return an order, or raise naming the tasks stuck in a loop” is a different function from “return an order”, and the difference is what separates code you would deploy from code that silently drops half your tasks." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "<em>“Prerequisites”, “depends on”, “must come before”, “blocked by”</em> — the vocabulary is the pattern.",
            "“In what order should these be built / installed / run / taken?”",
            "“Detect whether the dependencies are consistent”, or “find the circular import”. Cycle detection is the whole question, and the sort is the mechanism.",
            "Course schedules, build graphs, package installs, migration ordering, spreadsheet recalculation.",
            "A hidden variant: “is this possible at all?” — you never need the order, only whether one exists."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "table",
            headers: ["Approach", "How cycles surface", "Reach for it when"],
            rows: [
              ["Kahn — repeatedly take a node with in-degree zero", "For free: if the output is shorter than the node count, the remainder is exactly the cyclic part", "You want the cycle report, a stable order, or no recursion"],
              ["DFS post-order — reverse the finish order", "Only if you keep an on-stack (“grey”) marker separate from finished", "You are already writing a DFS, or you want the order lazily"],
              ["Kahn with a min-heap instead of a queue", "Same as Kahn", "The problem asks for the lexicographically smallest valid order"]
            ]
          },
          { t: "p", html: "Both traversals are <strong>O(V + E)</strong>. The min-heap variant costs an extra log factor and buys determinism you can state; that is a real trade, not a free upgrade." },
          { t: "h", text: "Worked example" },
          { t: "p", html: "Kahn, with the count check treated as a required post-condition. Note that the cycle report is one line and it names the offending tasks, which is the difference between a useful error and “something went wrong”." },
          { t: "code", lang: "python", code:
            "from collections import deque\n\n" +
            "def toposort(nodes, edges):\n" +
            "    \"\"\"edges: list of (before, after). Returns an order or raises.\"\"\"\n" +
            "    indeg = dict((n, 0) for n in nodes)\n" +
            "    out = dict((n, []) for n in nodes)\n" +
            "    for a, b in edges:\n" +
            "        if a not in indeg or b not in indeg:      # undeclared name\n" +
            "            raise KeyError(\"edge names an undeclared node: %r\" % ((a, b),))\n" +
            "        out[a].append(b)\n" +
            "        indeg[b] += 1\n\n" +
            "    ready = deque(sorted(n for n in nodes if indeg[n] == 0))  # stable start\n" +
            "    order = []\n" +
            "    while ready:\n" +
            "        n = ready.popleft()\n" +
            "        order.append(n)\n" +
            "        for m in out[n]:\n" +
            "            indeg[m] -= 1\n" +
            "            if indeg[m] == 0:\n" +
            "                ready.append(m)\n\n" +
            "    if len(order) != len(nodes):        # cycle detection IS this line\n" +
            "        stuck = sorted(n for n in nodes if indeg[n] > 0)\n" +
            "        raise ValueError(\"cycle among: \" + \", \".join(map(str, stuck)))\n" +
            "    return order\n\n" +
            "# A -> B, B -> A  ->  ValueError(\"cycle among: A, B\")\n" +
            "# Seeding sorted() makes the start stable; for the lexicographically\n" +
            "# smallest order overall, use a heap instead of the deque."
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>Decide what a cycle means to your caller.</strong> Raise with names? Return the strongly connected components? Break the weakest edge? This changes the return type, so decide before prompting.",
            "<strong>Decide where the node list comes from.</strong> The union of both sides of the edges, or an explicit list? Nodes that appear only as somebody's dependency are the most common silent omission.",
            "<strong>Decide whether ties matter.</strong> If two tasks are both ready, does anything depend on which runs first? If your tests compare output lists, you need a deterministic tie-break.",
            "<strong>Decide the edge direction convention</strong> and write it in the docstring. Half of all dependency bugs are a reversed edge, and reversed edges produce a perfectly valid order for the wrong graph.",
            "<strong>Pick Kahn or DFS on purpose</strong> and be able to say why in one sentence."
          ] },
          { t: "note", variant: "warn", html: "A reversed edge convention is invisible to every automated check. The order is valid, the count matches, no cycle is reported — it is just backwards. The only defence is an assertion written from the problem statement rather than from the code: <em>“build the library before the app”</em> becomes <code class='tok'>order.index(\"lib\") &lt; order.index(\"app\")</code>." },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "Kahn topological sort. Input: nodes (list of names) and edges (list of\n" +
            "(before, after) pairs, meaning `before` must run first). Return a list\n" +
            "of names in a valid order.\n\n" +
            "Constraints, so I can review this in 90 seconds:\n" +
            "- Build in-degrees for every declared node. Raise if an edge names a\n" +
            "  node that was not declared.\n" +
            "- After the main loop: if len(order) != len(nodes), raise with every\n" +
            "  name whose in-degree is still above zero. Cycle detection is a\n" +
            "  requirement, not a nice-to-have.\n" +
            "- Seed the ready queue in sorted order so two runs agree.\n" +
            "- No recursion. No logging."
          },
          { t: "p", html: "Spelling out the direction convention in the prompt — <em>“(before, after), meaning before must run first”</em> — costs eight words and removes the one defect no test of yours will catch. Asking for the cycle report in the same breath as the sort is what stops it from being an afterthought: a model told to raise with names will write the count check, and the count check <em>is</em> the cycle detection." },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["Kahn returns a short list on cyclic input", "The short list is a valid order over the acyclic part, so it reads as plausible output", "Feed A→B and B→A. Assert it raises. Two nodes is the whole test"],
              ["A DFS variant uses one visited set as its cycle test", "Chains and trees pass; only re-convergence fails", "Feed the diamond A→B, A→C, B→D, C→D. Assert success — that graph is acyclic"],
              ["Nodes appearing only as a dependency are dropped", "The output is a correct order over a subset, which looks like a correct order", "Assert <code class='tok'>len(order)</code> equals the distinct names across both sides of the edges"],
              ["The order changes between runs (set iteration)", "Nothing fails; your tests turn flaky and your explanation stops being repeatable", "Run it twice on the same input and assert the two lists are equal"],
              ["Edge direction reversed", "Perfectly valid order, wrong graph", "One assertion taken from the problem statement, not from the code: <code class='tok'>index(lib) &lt; index(app)</code>"]
            ]
          },
          { t: "p", html: "The diamond test deserves a moment. A DFS that reports a cycle whenever it meets an already-visited node is wrong in the <em>safe-looking</em> direction: it rejects valid input. Because most hand-written tests are chains, it passes them all, and the first real dependency graph — which always has re-convergence — fails. Four edges catch it." },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> Whenever the input contains ordering constraints between items rather than a metric to optimise: <em>prerequisites, blocked by, must precede, depends on</em>. Also whenever the real question is “are these constraints even satisfiable?” — that is cycle detection, and topological sort is how you answer it." },
          { t: "ul", items: [
            "<strong>Plain DFS with a grey set</strong> when you only need “is there a cycle?” and never need the order.",
            "<strong>Strongly connected components</strong> when cycles are expected and you must group them rather than reject them — a condensed graph of components is a DAG again.",
            "<strong>A priority queue over ready tasks</strong> when several orders are valid and you want the cheapest or the shortest critical path, not just any order.",
            "<strong>Nothing at all</strong> if the dependencies form a tree or a chain; say that out loud and move on."
          ] },
          { t: "note", variant: "key", html: "<strong>Cycle detection belongs in the signature.</strong> Kahn hands it to you as a single line — output shorter than the node count means the remainder is the cycle — so ask for the raise-with-names in the same prompt as the sort. And keep two four-edge graphs in your pocket: a two-node cycle that must be rejected, and a diamond that must not be." }
        ]
      },

      /* =============================== 4 =============================== */
      {
        id: "backtracking",
        title: "Backtracking and constraint satisfaction",
        summary: "Choose, explore, unchoose — and the undo is the exact line generated code drops, so assert the state came back clean.",
        minutes: 9,
        tags: ["backtracking", "recursion", "pruning"],
        blocks: [
          { t: "p", html: "Backtracking is a walk over a tree of partial answers. At each node you <strong>choose</strong> one option, <strong>explore</strong> everything that follows from it, then <strong>unchoose</strong> so the next sibling starts from the same state you did. That third step is the whole pattern; search that never undoes is not search, it is one long guess. It is also the step an AI pair drops most reliably, and for a structural reason — the undo lines carry no information about the problem. Nothing in “generate all valid board arrangements” hints that a list needs popping, so generated backtracking is often <em>almost</em> right: correct tree shape, correct number of leaves, corrupted state. That is why this family gets a dedicated assertion rather than a read-through." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "<em>“All”</em> — all subsets, all permutations, all combinations, all valid arrangements, all ways to partition.",
            "<em>“Return every solution”</em> rather than a count or a best. If a count is enough, dynamic programming is usually cheaper.",
            "Constraints stated as rules the answer must obey: no two in the same row, brackets balanced, letters used once, sum equals the target.",
            "Puzzle vocabulary: place, fill, assign, colour, schedule without conflicts.",
            "A small input bound — n under roughly twenty, a nine-by-nine board. Exponential is expected here, and the bound is the hint."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "table",
            headers: ["Piece", "What it looks like", "Failure if you skip it"],
            rows: [
              ["Choose / explore / unchoose", "Two mirrored lines around one recursive call", "State leaks into sibling branches; results are garbage or duplicated"],
              ["A feasibility check before recursing", "One <code class='tok'>if</code> at the top of the loop body", "You explore whole subtrees that cannot contain a solution"],
              ["A snapshot at the leaf", "<code class='tok'>res.append(path[:])</code> — a copy, never the live list", "The right number of results, all of them empty"]
            ]
          },
          { t: "p", html: "Pruning is where the time goes, and it comes in three flavours worth naming: <strong>feasibility</strong> (this partial answer already breaks a rule), <strong>bounding</strong> (even the best completion cannot beat what I have), and <strong>symmetry breaking</strong> (this branch is a mirror of one I already did). Only the first is usually generated without being asked." },
          { t: "h", text: "Worked example" },
          { t: "p", html: "Permutations of a list that may contain duplicates — the smallest example that exercises every part of the pattern, including the sibling-skip that stops <code class='tok'>[1,1,2]</code> from producing six results where three are correct." },
          { t: "code", lang: "python", code:
            "def permutations(nums):\n" +
            "    nums = sorted(nums)              # duplicates end up adjacent\n" +
            "    n = len(nums)\n" +
            "    res, path, used = [], [], [False] * n\n\n" +
            "    def walk():\n" +
            "        if len(path) == n:\n" +
            "            res.append(path[:])      # SNAPSHOT, not the live list\n" +
            "            return\n" +
            "        for i in range(n):\n" +
            "            if used[i]:\n" +
            "                continue\n" +
            "            if i > 0 and nums[i] == nums[i - 1] and not used[i - 1]:\n" +
            "                continue             # same value, same depth, already tried\n" +
            "            used[i] = True\n" +
            "            path.append(nums[i])     # choose\n" +
            "            walk()                   # explore\n" +
            "            path.pop()\n" +
            "            used[i] = False          # UNCHOOSE\n\n" +
            "    walk()\n" +
            "    assert not path and not any(used)   # state came back clean\n" +
            "    return res\n\n" +
            "# [1, 2, 3] -> 6 results.   [1, 1, 2] -> 3 results, not 6.\n" +
            "# Delete either unchoose line and the assert fires immediately."
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>Name the state precisely</strong> — what makes one node of the tree different from another. Usually a partial answer plus a used-marker; sometimes a position index is enough.",
            "<strong>Decide what a leaf is</strong> and what you store there. If you store a mutable object you must store a copy, and that decision is yours, not the model's.",
            "<strong>Write the constraint as a predicate</strong> before you write the recursion. If you cannot express “valid so far” in one line, the recursion will not be able to either.",
            "<strong>Decide which prunes you want</strong>, and be explicit that a prune must not change the answer — only the time.",
            "<strong>Decide the duplicate policy.</strong> Are <code class='tok'>[1,1]</code> and <code class='tok'>[1,1]</code> one result or two? This is a specification question and interviewers ask it on purpose."
          ] },
          { t: "note", variant: "trap", html: "A prune that changes the answer instead of only the runtime is the worst outcome in this family, because the code got <em>faster</em> and faster feels like progress. Keep the unpruned version until you have compared both on every input up to size five or six, then delete it. Never prune and optimise in the same prompt." },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "Backtracking permutations of a list that may contain duplicates.\n" +
            "Return each distinct permutation exactly once.\n\n" +
            "Constraints, so I can review this in 90 seconds:\n" +
            "- Structure the recursion as three labelled steps. Put the words\n" +
            "  \"choose\", \"explore\" and \"unchoose\" in comments on those lines.\n" +
            "- Append a COPY of the path at the leaf, never the live list.\n" +
            "- Handle duplicates by sorting first and skipping an equal sibling at\n" +
            "  the same depth. Explain the skip condition in one comment line.\n" +
            "- End the top-level function with an assert that the path is empty\n" +
            "  and no slot is still marked used.\n" +
            "- No pruning beyond that, and no yield. Plain list return."
          },
          { t: "p", html: "Requiring the word <strong>“unchoose”</strong> as a comment is the highest-leverage constraint in this module. It gives you a token to search for: no “unchoose” comment means no undo, and you know that in one second rather than after reading a recursive function. Requiring the closing assert is the same idea made executable — the model writes your test for you, and the test fails loudly the moment the undo is missing." },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["The leaf stores the live path instead of a copy", "The result <em>count</em> is exactly right, and count is what most tests check", "Assert no result is empty, and that the results are distinct"],
              ["A choice is made and never undone", "Small inputs sometimes still produce plausible output", "The closing assert: state equals its initial value after the top-level call"],
              ["State restored on only one exit path", "An early <code class='tok'>return</code> inside the loop skips the undo", "Grep for <code class='tok'>return</code> inside the recursion; each one needs the undo or a <code class='tok'>finally</code>"],
              ["Duplicate inputs give duplicate outputs", "Correct for distinct inputs, which is what the example in the prompt used", "<code class='tok'>permutations([1,1,2])</code> must be 3 results, not 6"],
              ["A prune that changes the answer", "It got faster, and faster looks like an improvement", "Compare against the unpruned version on every input up to size six"]
            ]
          },
          { t: "p", html: "One number is worth carrying for sanity checks: the eight-queens problem has <strong>92</strong> solutions. If a generated solver reports 92 you know the tree, the constraint, and the undo are all intact; if it reports something else you know which of the three to look at first — too few means over-pruning or a missing branch, too many means a constraint that is not being enforced on every placement." },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> When the problem wants <em>every</em> arrangement rather than a best or a count, when validity is expressed as rules a partial answer can already break, and when the input bound is small enough that exponential is acceptable. If the question asks “how many” and never needs the arrangements, stop and check whether dynamic programming counts them instead." },
          { t: "compare",
            bad: { title: "Backtracking by reflex", items: ["Enumerating 2^n subsets to answer a counting question", "Exponential time where a table would be polynomial", "No pruning, because nobody asked for any"] },
            good: { title: "Backtracking on purpose", items: ["Every solution is genuinely required output", "Constraints prune whole subtrees early", "The undo is asserted, not assumed"] }
          },
          { t: "note", variant: "key", html: "<strong>The undo is the pattern; make the model prove it.</strong> Require the word “unchoose” in a comment and a closing assert that the shared state came back clean, then check the result count on a tiny input with a repeat in it. Right count with empty results means a missing snapshot; wrong count means a missing undo or an unenforced constraint." }
        ]
      },

      /* =============================== 5 =============================== */
      {
        id: "greedy-packing",
        title: "Greedy and bin packing",
        summary: "Justify with an exchange argument or admit you are approximating — then verify the invariants a comparator bug destroys.",
        minutes: 10,
        tags: ["greedy", "bin-packing", "approximation"],
        blocks: [
          { t: "p", html: "A greedy algorithm commits to the locally best-looking option and never revisits it. That is either brilliant or wrong, and the difference is not a matter of taste: some problems admit an <strong>exchange argument</strong> — a proof that any optimal solution can be rearranged, step by step, into the greedy one without getting worse — and some do not. Knowing which side of that line you are on is the entire assessed skill here. It is also the family where honesty is worth marks: bin packing is NP-hard; no greedy rule solves it optimally. Saying “first-fit-decreasing, and I am aware this is an approximation” is a stronger answer than a confident claim of optimality — and it is the sentence an AI pair will not volunteer on your behalf." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "<em>“Fewest boxes / trucks / servers / rooms”</em> for a set of sized items — packing.",
            "<em>“Maximum number of non-overlapping …”</em> with start and end times — interval scheduling, where greedy by earliest finish time <em>is</em> optimal.",
            "“Minimum number of coins / platforms / refuelling stops.” Some of these are exactly greedy, some are famously not; check before you commit.",
            "A sorting step that seems to make the problem obvious. That instinct is usually right, and the sort key is the algorithm.",
            "Constraints large enough to rule out exact search — hundreds of thousands of items means a heuristic is expected, and saying so is part of the answer."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "table",
            headers: ["Piece", "The rule", "What it costs"],
            rows: [
              ["The sort key", "Sort by the quantity the exchange argument is about — finish time, size descending, ratio", "O(n log n), and it must be a strict weak ordering or the sort is undefined"],
              ["The commitment rule", "First fit, best fit, earliest finish — one scan, no revisiting", "O(n) scans over open bins, so first-fit is O(n·bins) unless you index them"],
              ["The honesty clause", "Either an exchange argument, or the sentence “this is an approximation”", "Nothing. It is free, and its absence is expensive"]
            ]
          },
          { t: "p", html: "Two published bounds are worth carrying because they let you be precise about how much the sort buys you: first-fit never needs more than roughly <strong>1.7×</strong> the optimal number of bins, and first-fit-decreasing tightens that to about <strong>11/9</strong> of optimal plus a small constant. You do not need the proofs; you need to know that sorting descending first is not a stylistic preference." },
          { t: "h", text: "Worked example" },
          { t: "p", html: "Capacity 10 and items <code class='tok'>[2, 5, 4, 7, 1, 3, 8]</code>. The sizes total 30, so three bins is the floor. In arrival order, first-fit needs four. Sorted descending, first-fit needs three, all of them exactly full. Same rule, same code, one sort — that is the whole lesson of this family in one instance." },
          { t: "code", lang: "python", code:
            "def first_fit_decreasing(items, cap):\n" +
            "    \"\"\"Heuristic. Bin packing is NP-hard; this is NOT optimal.\"\"\"\n" +
            "    if any(x > cap for x in items):\n" +
            "        raise ValueError(\"an item larger than a bin has no packing\")\n" +
            "    bins, load = [], []\n" +
            "    for x in sorted(items, reverse=True):    # the sort IS the algorithm\n" +
            "        for i in range(len(bins)):\n" +
            "            if load[i] + x <= cap:           # <=, not <\n" +
            "                bins[i].append(x)\n" +
            "                load[i] += x\n" +
            "                break\n" +
            "        else:\n" +
            "            bins.append([x])                 # nothing fitted: open a bin\n" +
            "            load.append(x)\n" +
            "    assert all(l <= cap for l in load)               # no overfilled bin\n" +
            "    assert sorted(sum(bins, [])) == sorted(items)    # nothing lost or cloned\n" +
            "    return bins\n\n" +
            "# cap = 10, items = [2, 5, 4, 7, 1, 3, 8]   (total 30 -> 3 bins is the floor)\n" +
            "#   arrival order, first fit     -> 4 bins\n" +
            "#   sorted descending, first fit -> 3 bins, every one exactly full"
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>Decide whether you owe an exchange argument or an admission.</strong> Try to state the argument in one sentence; if you cannot, you are approximating, and that is fine as long as you say it.",
            "<strong>Choose the sort key and be able to justify it.</strong> “Descending, because a big item that arrives late finds every bin already spoiled” is the justification, and it is also the proof sketch.",
            "<strong>Pick the commitment rule</strong> — first fit, best fit, worst fit — and know that the difference between them is usually smaller than the difference sorting makes.",
            "<strong>Define the invariants you will assert:</strong> no bin over capacity, and the multiset of packed items equals the input. Write them down before you prompt, because they become the code's last two lines.",
            "<strong>Decide the tie policy.</strong> Equal items are common in real inputs, and a comparator that treats equals as “less” is undefined behaviour in some languages and a wrong order in others."
          ] },
          { t: "note", variant: "warn", html: "Watch the word <em>optimal</em>. It arrives free in generated docstrings and it is the one claim in this family you usually cannot support. If a docstring says “finds the minimum number of bins”, either delete the sentence or replace it with the honest one — an interviewer who spots an unearned optimality claim will ask you to prove it, and that is not a conversation you want to be having at minute twenty-five." },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "First-fit-decreasing bin packing. Input: item sizes and one bin\n" +
            "capacity. Return a list of bins, each a list of item sizes.\n\n" +
            "Constraints, so I can review this in 90 seconds:\n" +
            "- Sort descending, then first fit. Do NOT attempt an exact search.\n" +
            "- One comment stating this is a heuristic with no optimality\n" +
            "  guarantee, and that bin packing is NP-hard. Do not use the word\n" +
            "  \"optimal\" or \"minimum\" anywhere.\n" +
            "- Raise if any single item exceeds the capacity.\n" +
            "- Finish with two asserts: every bin's load <= capacity, and the\n" +
            "  multiset of packed items equals the input."
          },
          { t: "p", html: "“Do not use the word optimal” looks pedantic and is not. Banning a word is a constraint a model can actually satisfy, and it forces the generated prose into an accurate claim. The two closing asserts do the same job for the code: they turn the two properties you care about into executable lines that a reviewer can find in three seconds." },
          { t: "table",
            headers: ["Tier", "How you justify the greedy choice", "How it lands"],
            rows: [
              ["Naive", "“Greedy is fine here.”", "No argument, so no credit, and the interviewer now doubts the rest"],
              ["Naive", "“This gives the minimum number of bins.”", "An unearned optimality claim on an NP-hard problem"],
              ["Solid", "“First-fit-decreasing. Bin packing is NP-hard, so this is an approximation.”", "Honest, correct, and shows you know the landscape"],
              ["Standout", "The same, plus the exchange argument for the case where greedy <em>is</em> exact (intervals by earliest finish) and why packing is not that case", "Demonstrates you can tell the two apart, which is the actual skill"]
            ]
          },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["Capacity tested with <code class='tok'>&lt;</code> where it needs <code class='tok'>&lt;=</code>", "Only fails when an item exactly fills the remaining space", "Pack <code class='tok'>[5, 5]</code> into capacity 10 and assert one bin"],
              ["An item that fits nowhere is dropped instead of opening a bin", "The packing looks <em>tighter</em>, which reads as better", "Assert the multiset of packed items equals the input"],
              ["The comparator is not a strict weak ordering — equals reported as less", "Equal items are common, and answering “less” for two equals breaks the contract every standard sort assumes: depending on the language you get an arbitrary permutation, an exception, or memory corruption", "Sort a list where every element is equal; assert the output is a permutation of the input. It catches the dropped-item bug for free"],
              ["Sorted ascending, or not sorted at all", "Still a valid packing, just more bins", "Capacity 10, <code class='tok'>[2,5,4,7,1,3,8]</code>: assert 3 bins, not 4"],
              ["Docstring claims optimality", "Nothing fails, and it is the sentence you will be asked to defend", "Read the docstring out loud. If it says minimum, prove it or delete it"]
            ]
          },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> When items must be assigned or selected one at a time and you can name a sort key that makes the local choice safe. <em>Maximum non-overlapping intervals</em> → greedy by earliest finish, and it is exactly optimal. <em>Fewest containers</em> → greedy is an approximation, so label it. If the local choice needs to be reconsidered later, you are looking at dynamic programming or a search, not greedy." },
          { t: "ul", items: [
            "<strong>Dynamic programming</strong> when a choice must be revisited — the classic tell is the coin system <code class='tok'>[1, 3, 4]</code> and target 6, where greedy takes 4+1+1 and the answer is 3+3.",
            "<strong>Exact search with pruning</strong> when the instance is genuinely small and optimality is genuinely required. Under about a dozen items this is cheap; beyond that it is not.",
            "<strong>A flow or matching formulation</strong> when the assignment has capacities on both sides — greedy will be reliably mediocre there.",
            "<strong>Greedy anyway</strong>, as a baseline you can measure the fancier thing against. Say that out loud; it is a mature engineering answer."
          ] },
          { t: "note", variant: "key", html: "<strong>Earn the greedy or admit the approximation.</strong> If you can state the exchange argument, say it and take the credit; if you cannot, name the heuristic, say “no optimality guarantee”, and ban the word <em>optimal</em> from the prompt. Then let two asserts do your reviewing: no bin over capacity, and the items out are exactly the items in." }
        ]
      },

      /* =============================== 6 =============================== */
      {
        id: "dp",
        title: "Dynamic programming under time pressure",
        summary: "Six steps, six prompts. Never ask for \"a DP solution\" — ask for the recurrence, check it, and only then let the model build.",
        minutes: 11,
        tags: ["dynamic-programming", "prompting", "verification"],
        blocks: [
          { t: "p", html: "Dynamic programming is one idea with five layers of packaging. The idea is a <strong>recurrence</strong>: the answer to a state expressed in terms of smaller states. Everything else — recursion, a memo, a table, two rows — is the same recurrence transported into a faster container. Get the recurrence wrong and all five layers are wrong together, which is why it is the only part you should ever check by hand. That single fact determines how you delegate. “Write a DP solution for this” gets you a plausible table you cannot audit in the time you have left. Prompting the six steps <em>separately</em> gets you one line to verify by hand, then a slow version to trust, then two mechanical transformations you can diff against it. Same total typing, radically different reviewability." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "<em>“How many ways”</em>, <em>“minimum cost”</em>, <em>“maximum value”</em>, <em>“longest / shortest”</em> over a sequence of choices.",
            "“Can this be split / partitioned / reached exactly?” — a yes-or-no over a target is usually a boolean table.",
            "Two sequences compared position by position: edit distance, common subsequence, wildcard or regex matching.",
            "A brute-force recursion you can already picture that would recompute the same arguments over and over. Overlapping subproblems <em>are</em> the signal.",
            "A constraint bound that looks like a table dimension: n up to 1,000 and a target up to 10,000 is an invitation to an O(n·target) table."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "ol", items: [
            "<strong>Recurrence</strong> — the answer for a state in terms of smaller states. One line.",
            "<strong>Base cases</strong> — the smallest states, stated explicitly, including the empty one.",
            "<strong>Plain recursion</strong> — a direct transcription, exponential and correct. This is your reference implementation and later your oracle: four lines that turn “I think the table is right” into a test. Skipping it under time pressure is what makes DP feel like luck.",
            "<strong>Memoise</strong> — a cache keyed on the <em>full</em> state tuple. Nothing else changes.",
            "<strong>Bottom-up</strong> — the same table filled in an order that respects the dependencies.",
            "<strong>Space-optimise</strong> — keep only the rows the recurrence actually reads."
          ] },
          { t: "h", text: "Worked example" },
          { t: "p", html: "Edit distance, because its base cases are exactly where off-by-one lives. The table is <code class='tok'>(m+1) × (n+1)</code>, row <code class='tok'>i</code> refers to the character <code class='tok'>a[i-1]</code>, and the first row and column are the cost of deleting or inserting everything. Get those three sentences right and the rest is transcription." },
          { t: "code", lang: "python", code:
            "# 1. RECURRENCE      d(i, j) = edits between a[:i] and b[:j]\n" +
            "#      a[i-1] == b[j-1]  ->  d(i-1, j-1)\n" +
            "#      else              ->  1 + min(d(i-1, j),      # delete from a\n" +
            "#                                    d(i,   j-1),    # insert into a\n" +
            "#                                    d(i-1, j-1))    # substitute\n" +
            "# 2. BASE CASES      d(i, 0) = i    d(0, j) = j    d(0, 0) = 0\n" +
            "#    so the table is (m+1) x (n+1) and row i means the char a[i-1]\n\n" +
            "def edit(a, b):                      # steps 5 and 6, two rows\n" +
            "    if len(b) > len(a):\n" +
            "        a, b = b, a                  # keep the shorter one on the row\n" +
            "    m, n = len(a), len(b)\n" +
            "    prev = list(range(n + 1))        # d(0, j) = j\n" +
            "    for i in range(1, m + 1):\n" +
            "        cur = [i] + [0] * n          # d(i, 0) = i\n" +
            "        for j in range(1, n + 1):\n" +
            "            if a[i - 1] == b[j - 1]:\n" +
            "                cur[j] = prev[j - 1]\n" +
            "            else:\n" +
            "                cur[j] = 1 + min(prev[j], cur[j - 1], prev[j - 1])\n" +
            "        prev = cur\n" +
            "    return prev[n]\n\n" +
            "# O(m*n) time, O(min(m, n)) space.\n" +
            "# Run these four before you trust it:\n" +
            "#   edit(\"\", \"abc\") == 3      edit(\"abc\", \"\") == 3\n" +
            "#   edit(\"a\", \"a\")  == 0      edit(\"a\", \"b\")  == 1"
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>Write the state in words first.</strong> “The best answer considering the first i items with j capacity left.” If that sentence is vague, the recurrence will be too.",
            "<strong>Enumerate the choices at one state</strong> — take it or skip it, match or delete or insert. The recurrence is a minimum or maximum over exactly those choices.",
            "<strong>Write the base cases including the empty one.</strong> The empty prefix is where every off-by-one lives, and it is also the cheapest test you will ever write.",
            "<strong>Decide the answer's location</strong> — is it <code class='tok'>d(m, n)</code>, or the maximum over a row? Getting the recurrence right and reading the wrong cell is a real and common way to fail.",
            "<strong>Only optimise space once the table is verified.</strong> Space optimisation is a mechanical rewrite; doing it before you have a correct reference means you have nothing to diff against."
          ] },
          { t: "note", variant: "trap", html: "The space-optimised 0/1 knapsack is the trap worth memorising. Iterating capacity <em>ascending</em> lets the row you are writing read cells you already updated for the same item, so the item gets taken repeatedly and 0/1 quietly becomes unbounded knapsack. The answers get <em>larger</em>, never smaller, so nothing looks broken. <code class='tok'>knap([1], [1], 5)</code> must be 1; the ascending version returns 5." },
          { t: "code", lang: "python", code:
            "def knap(weights, values, cap):\n" +
            "    best = [0] * (cap + 1)\n" +
            "    for w, v in zip(weights, values):\n" +
            "        for c in range(cap, w - 1, -1):     # DESCENDING: each item once\n" +
            "            best[c] = max(best[c], best[c - w] + v)\n" +
            "    return best[cap]\n\n" +
            "# knap([1], [1], 5) == 1\n" +
            "# Make that inner range ascending and it returns 5 -- one item, five times.\n" +
            "# One item, one assert, and the whole loop direction question is settled."
          },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "STEP 1 (comments only, no code):\n" +
            "  State the recurrence for the edit distance between a[:i] and b[:j],\n" +
            "  and the base cases for i = 0 and j = 0. Say which character row i\n" +
            "  and column j refer to. Then stop.\n\n" +
            "STEP 2 (only after I have checked step 1):\n" +
            "  Write the plain recursive version from that recurrence. No memo.\n\n" +
            "STEP 3: add memoisation keyed on the FULL state tuple. Change nothing else.\n" +
            "STEP 4: convert to a bottom-up (m+1) x (n+1) table. Keep step 3 in the file.\n" +
            "STEP 5: reduce to two rows, shorter string on the row.\n" +
            "STEP 6: delete the slow versions only after they agree on 100 random inputs.\n\n" +
            "Rule for every step: change nothing except what the step asks for. If a\n" +
            "step makes you want to revise the recurrence, say so instead of quietly\n" +
            "editing it."
          },
          { t: "p", html: "The constraint that makes this work is <strong>“change nothing else”</strong>. Left alone, a model asked to memoise will often also rename variables, restructure the base cases, and fix an imagined bug — and now you cannot tell whether the memo is correct, because you are diffing against a moving target. Step-by-step prompting with a no-drift rule turns DP into four diffs you can read instead of one artefact you must trust." },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["Table sized <code class='tok'>m × n</code> instead of <code class='tok'>(m+1) × (n+1)</code>", "The off-by-one only shows on an empty prefix, which nobody tests by hand", "<code class='tok'>edit(\"\", \"abc\") == 3</code> and <code class='tok'>edit(\"abc\", \"\") == 3</code>"],
              ["Characters indexed <code class='tok'>a[i]</code> in a 1-indexed table", "Answers come out close, and sometimes right", "<code class='tok'>edit(\"a\",\"a\") == 0</code> and <code class='tok'>edit(\"a\",\"b\") == 1</code>"],
              ["Memo keyed on part of the state", "Correct on the example, silently wrong as soon as the dropped dimension varies", "Diff the memoised version against the plain recursion on every small input"],
              ["Space-optimised 0/1 knapsack iterating capacity ascending", "Values only get bigger, so nothing looks broken", "<code class='tok'>knap([1],[1],5)</code> must be 1, not 5"],
              ["The wrong cell returned — <code class='tok'>d(m,n)</code> when the answer is a row maximum", "The table is completely correct, which is where you will look", "Hand-compute one tiny instance end to end and compare the returned number"]
            ]
          },
          { t: "table",
            headers: ["Bar", "What is expected on this family"],
            rows: [
              ["Mid", "Recognises DP, gets a working memoised solution from the model, states the time and space complexity correctly"],
              ["Senior", "Prompts the recurrence separately and checks it by hand, keeps the plain recursion as an oracle, and runs the empty-input base-case tests unprompted"],
              ["Staff", "Also names why this state is the right state, what the space optimisation costs you in debuggability, and when a table is the wrong tool because the state space is too large"]
            ]
          },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> When a brute-force recursion would revisit the same arguments — overlapping subproblems plus optimal substructure. Counting questions (“how many ways”) and optimising questions (“minimum cost”) over a sequence of choices are the two big families. If the problem wants the arrangements themselves rather than a count, that is backtracking; if a local choice is provably safe, that is greedy." },
          { t: "compare",
            bad: { title: "Asking for “a DP solution”", items: ["One artefact, no reviewable intermediate steps", "A recurrence you never saw and cannot check", "Nothing to diff the fast version against"] },
            good: { title: "Six prompts, one per step", items: ["A one-line recurrence you verify by hand in seconds", "A slow reference version that becomes your oracle", "Two mechanical rewrites you can diff, not trust"] }
          },
          { t: "note", variant: "key", html: "<strong>Prompt the recurrence, not the solution.</strong> Six steps, one prompt each, with “change nothing else” attached to every one. Keep the plain recursion as an oracle until the fast version agrees with it on a hundred small inputs, and run the empty-input base case first — it is one line and it catches the off-by-one that ships most often." }
        ]
      },

      /* =============================== 7 =============================== */
      {
        id: "string-parsing",
        title: "String matching and parsing",
        summary: "Rolling hashes must verify their hits, windows must delete zero counts, and \"write a regex for this\" is the delegation to refuse.",
        minutes: 10,
        tags: ["strings", "parsing", "rolling-hash", "regex"],
        blocks: [
          { t: "p", html: "String problems split cleanly into three shapes, and naming the shape decides everything after it. <strong>Matching</strong>: is this pattern in that text — a rolling hash or a prefix-function scan. <strong>Scanning</strong>: find the best window satisfying a property — two pointers and a count map. <strong>Parsing</strong>: turn characters into structure — a tokeniser, and then something that consumes tokens. Mixing them up is how a twenty-minute problem becomes a forty-minute one. It is also the family with the most tempting bad delegation. “Write me a regex that handles this format” produces a dense pattern that works on the examples in your prompt, cannot be reviewed line by line, and cannot express nesting at all. You will accept it because it is short — and short is not the same as reviewable." },
          { t: "h", text: "Recognising it" },
          { t: "ul", items: [
            "<em>“Does the text contain …”</em>, <em>“find all occurrences”</em>, <em>“count the substrings equal to …”</em> — matching.",
            "<em>“Longest / shortest substring such that …”</em>, <em>“at most k distinct”</em>, <em>“contains all of”</em> — a window.",
            "“Evaluate this expression”, “validate this format”, “extract the fields” with nesting or quoting — parsing, and therefore a tokeniser.",
            "“Compare every substring against every other” as a brute force — that is the hash-based approach asking to be used.",
            "Any format described with the words “can be nested” or “may be quoted”. That phrase rules out regular expressions entirely."
          ] },
          { t: "h", text: "Building blocks" },
          { t: "table",
            headers: ["Piece", "The rule", "Cost"],
            rows: [
              ["Rolling hash", "Slide the window by adding the entering character and removing the leaving one — then <em>verify the characters</em> on every reported hit", "Expected O(n + m); without verification a collision is a wrong answer, and worst case degrades toward O(n·m)"],
              ["Two-pointer window", "Expand right always, contract left <em>while</em> the window is invalid; delete a count key the moment it reaches zero", "O(n) — every character enters and leaves at most once"],
              ["Hand-rolled tokeniser", "One explicit index, one branch per token class, and every branch either advances the index or raises", "O(n), and it is reviewable by eye, which is the actual reason to prefer it"]
            ]
          },
          { t: "p", html: "The rule that carries the most weight is the small one in the middle: <strong>delete zero-count keys</strong>. If the map keeps entries whose count has fallen to zero, then the map's size no longer equals the number of distinct characters in the window, every “at most k distinct” comparison is wrong, and the window can never grow back. One deletion, and the invariant is restored." },
          { t: "h", text: "Worked example" },
          { t: "p", html: "A tokeniser for arithmetic expressions. Twenty lines, one loop, one index, and an explicit invariant. Compare it to the regex you would have accepted instead and ask which one you would rather be reading out loud to an interviewer." },
          { t: "code", lang: "python", code:
            "NUM, NAME, OP, PUNC = \"num\", \"name\", \"op\", \"punc\"\n\n" +
            "def tokenise(s):\n" +
            "    i, n, out = 0, len(s), []\n" +
            "    while i < n:\n" +
            "        c = s[i]\n" +
            "        if c.isspace():\n" +
            "            i += 1\n" +
            "        elif c.isdigit():\n" +
            "            j = i\n" +
            "            while j < n and s[j].isdigit():\n" +
            "                j += 1\n" +
            "            out.append((NUM, s[i:j], i)); i = j\n" +
            "        elif c.isalpha() or c == \"_\":\n" +
            "            j = i\n" +
            "            while j < n and (s[j].isalnum() or s[j] == \"_\"):\n" +
            "                j += 1\n" +
            "            out.append((NAME, s[i:j], i)); i = j\n" +
            "        elif c in \"+-*/\":\n" +
            "            out.append((OP, c, i)); i += 1\n" +
            "        elif c in \"()\":\n" +
            "            out.append((PUNC, c, i)); i += 1\n" +
            "        else:\n" +
            "            raise ValueError(\"unexpected %r at index %d\" % (c, i))\n" +
            "        # INVARIANT: every branch advances i or raises. No branch may do\n" +
            "        # neither, or this loop spins forever on one character.\n" +
            "    return out\n\n" +
            "# tokenise(\"12 + 4*(x - 3)\") ->\n" +
            "#   [('num','12',0), ('op','+',3), ('num','4',5), ('op','*',6),\n" +
            "#    ('punc','(',7), ('name','x',8), ('op','-',10), ('num','3',12),\n" +
            "#    ('punc',')',13)]"
          },
          { t: "h", text: "Designing it" },
          { t: "ol", items: [
            "<strong>Name the shape first</strong> — matching, scanning, or parsing. Say it out loud; it is the decision the rest of the code inherits.",
            "<strong>Decide what a token is</strong> if you are parsing, and what each token carries. Carry the index: error messages that name a position are worth the extra field.",
            "<strong>Decide the alphabet and the encoding.</strong> Bytes or characters? Case sensitive? Is the input guaranteed ASCII? Models assume ASCII and never say so.",
            "<strong>Decide the verification rule for hashes</strong> before you write one. “Every reported index is confirmed by a character comparison” is a design decision, not an optimisation.",
            "<strong>Decide, deliberately, not to use a regex</strong> when the format can nest — and be ready to say why in one sentence, because you will be asked."
          ] },
          { t: "note", variant: "warn", html: "Regular expressions fail in three ways that matter here. They are <strong>hard to review</strong>, so a bug hides in plain sight. They can <strong>backtrack catastrophically</strong> — nested quantifiers over an input that <em>almost</em> matches can take exponential time, which is a denial-of-service waiting to happen. And they <strong>cannot express nesting</strong>, so balanced brackets and quoted delimiters are out of scope no matter how clever the pattern. Short anchored patterns for single fields are fine; a pattern that parses a format is not." },
          { t: "h", text: "How to prompt the AI for it" },
          { t: "code", lang: "text", code:
            "Write a tokeniser for arithmetic expressions: integers, identifiers,\n" +
            "the operators + - * /, and parentheses. Return (kind, text, index)\n" +
            "triples. No regex.\n\n" +
            "Constraints, so I can review this in 90 seconds:\n" +
            "- One while loop over an explicit index. Every branch must either\n" +
            "  advance the index or raise. State that invariant in a comment.\n" +
            "- Unrecognised characters raise, naming the character AND its index.\n" +
            "- One branch per token class, in the order you test them.\n" +
            "- Do not import re, and do not collapse the branches into a\n" +
            "  table-driven loop. I am reading this by eye, not running it."
          },
          { t: "p", html: "“I am reading this by eye, not running it” is a constraint about <em>you</em>, and it changes the output more than any technical instruction in the list. It rules out the clever table-driven version, the regex, and the comprehension that does four things at once — all of which are fine code and none of which you can review in the ninety seconds you actually have." },
          { t: "h", text: "How to verify the AI's code for it" },
          { t: "table",
            headers: ["Defect the model produces", "Why it slips through", "Cheapest check"],
            rows: [
              ["A rolling-hash hit is reported without comparing characters", "Collisions are rare, so every hand-written test passes", "Inside the test, assert <code class='tok'>text[i:i+m] == pattern</code> for every reported index"],
              ["The leaving character's power is off by one when the window slides", "Index 0 matches, so the first test looks fine; nothing after it matches", "Assert a hit at index 0, at the last valid index, and in the middle — then diff against the naive scan"],
              ["Zero counts left in the window map", "The window only ever comes out too small, so the answer looks conservative", "<code class='tok'>\"aaabbb\"</code> with k = 1 must be 3"],
              ["The shrink is an <code class='tok'>if</code> where it needs a <code class='tok'>while</code>", "One contraction is enough on most short tests", "<code class='tok'>\"abaccc\"</code> with k = 2 must be 4"],
              ["A tokeniser branch that neither advances nor raises", "Only an input that reaches that branch hangs — and then it hangs forever", "Feed a character no rule matches, under an iteration cap. It must raise, not spin"],
              ["A regex used where the format nests", "It matches every example that was in the prompt", "Feed one nested case such as <code class='tok'>((a))</code>. Half-matching is failing"]
            ]
          },
          { t: "p", html: "For matching in particular, the cheapest verification is not a clever test — it is a <strong>differential test</strong>. Keep the four-line naive scan, generate a few hundred short random strings, and assert the fast version reports exactly the same indices. It catches the power-of-the-base bug, the missing verification, and the off-by-one at the end of the text, all at once, for less code than any one of them would take to test individually." },
          { t: "h", text: "When to use vs alternatives" },
          { t: "cue", html: "<b>Spotting it in a prompt.</b> <em>Fixed pattern in a long text</em>, or “compare all substrings of one length” → rolling hash with verification. <em>Best window satisfying a property</em> → two pointers with a count map. <em>Structure, nesting, or quoting</em> → tokenise, then parse the tokens. And when someone suggests a regex for a nesting format, that is your cue to say why it cannot work rather than to write a longer pattern." },
          { t: "ul", items: [
            "<strong>A prefix-function scan (KMP)</strong> when you need a worst-case linear guarantee rather than an expected one — no hash, no collisions, no verification step.",
            "<strong>A trie or an Aho-Corasick automaton</strong> when you are matching many patterns at once; one pass over the text instead of one pass per pattern.",
            "<strong>A short anchored regex</strong> for a single flat field with a name and a test beside it. This is regex used well.",
            "<strong>A real parser</strong> — tokeniser plus recursive descent — the moment the grammar has nesting. Two small functions beat one unreviewable pattern."
          ] },
          { t: "note", variant: "key", html: "<strong>Match, scan, or parse — name it, then delegate accordingly.</strong> Hashes must verify their hits; windows must delete zero counts and contract with a <em>while</em>; parsers must have a branch invariant that guarantees progress. And refuse “write a regex for this” whenever the format can nest: a twenty-line tokeniser you can read out loud beats a sixty-character pattern you cannot." },
          { t: "quiz", id: "aiec-aipatterns" }
        ]
      }
    ]
  };

  /* ------------------------------------------------------------------
     track registration — order-independent, push only.
     A sibling file owns the track's name / short / color / blurb.
  ------------------------------------------------------------------ */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.aiec || (window.TRACKS.aiec = { id: "aiec", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MODULE);
})();
