/* =====================================================================
   BLUEPRINT · track-wild-lld.js
   Adds two modules to the existing LLD track (deep concurrency + more
   worked cases) and one module to the breakdowns track (real-world
   engineering case studies). Owns its own quizzes and its own widget.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================= */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  /* ---------- lldContentionLab ----------------------------------------
     Amdahl's law with a contention model attached. Deliberately a
     teaching model, not a benchmark: the point is the shape of the
     curves, not three-decimal fidelity.
     -------------------------------------------------------------------- */
  Widgets.lldContentionLab = function (mount) {
    var STRIPES = 8;
    var strategy = "global";

    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "lab"),
      h("h3", {}, "What does a lock actually cost?")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Set how many threads you run and how much of each thread's work sits inside the critical section, then compare strategies. Speedup is Amdahl's law, 1 / (s + (1 - s) / n), on the effective serial fraction each strategy leaves you with."));

    var threadsIn = h("input", { type: "range", min: "1", max: "64", step: "1", value: "8" });
    var critIn = h("input", { type: "range", min: "0", max: "100", step: "1", value: "20" });
    var threadsVal = h("b", { style: "font-family:var(--font-mono)" }, "8");
    var critVal = h("b", { style: "font-family:var(--font-mono)" }, "20%");

    var roSpeed = h("b", {}, "\u2014");
    var roCostK = h("span", {}, "lock contention ");
    var roCostV = h("b", {}, "\u2014");
    var roSerial = h("b", {}, "\u2014");
    var roCeil = h("b", {}, "\u2014");
    var roVerdict = h("b", {}, "\u2014");

    /* effective serial fraction + a contention/retry figure per strategy */
    function model(strat, s, n) {
      var others = n - 1;
      if (others < 0) others = 0;
      if (strat === "striped") {
        var sStripe = s / STRIPES;
        return {
          sEff: sStripe + s * 0.04,                       /* hashing + false-sharing tax */
          overhead: 1.02,
          cost: 1 - Math.pow(1 - sStripe, others),
          label: "stripe collision ",
          unit: "pct"
        };
      }
      if (strat === "cas") {
        var p = 1 - Math.pow(1 - s, others);              /* chance someone else is mid-update */
        var attempts = 1 / Math.max(1 - p, 0.05);         /* expected tries per success */
        return {
          sEff: Math.min(0.99, s * 0.3 * attempts),       /* short atomic, redone `attempts` times */
          overhead: 1,
          cost: attempts - 1,
          label: "wasted CAS retries ",
          unit: "x"
        };
      }
      if (strat === "cow") {
        var sPub = Math.min(0.99, s * 0.08);              /* only the pointer publish is serial */
        return {
          sEff: sPub,
          overhead: 1 + 1.5 * s,                          /* every writer copies the structure */
          cost: 1 - Math.pow(1 - sPub, others),
          label: "publish contention ",
          unit: "pct"
        };
      }
      return {
        sEff: s,
        overhead: 1,
        cost: 1 - Math.pow(1 - s, others),
        label: "lock contention ",
        unit: "pct"
      };
    }

    function speedupOf(m, n) {
      var s = m.sEff;
      if (!(s >= 0)) s = 0;
      if (s > 0.99) s = 0.99;
      var raw = 1 / (s + (1 - s) / n);
      return raw / m.overhead;
    }

    function readNum(el, def, lo, hi) {
      var v = el ? parseFloat(el.value) : NaN;
      if (!isFinite(v)) v = def;
      if (v < lo) v = lo;
      if (v > hi) v = hi;
      return v;
    }

    function verdictFor(strat, s, n, mine, base) {
      var pct = Math.round(s * 100);
      if (pct <= 1) {
        return "With almost nothing shared there is nothing to protect: every strategy lands within noise of linear scaling, so pick the code your team can read.";
      }
      if (n === 1) {
        return "One thread means zero contention, so all you can measure here is overhead \u2014 and copy-on-write and striping both charge you a little even when nobody is competing.";
      }
      if (strat === "global") {
        return mine < n * 0.5
          ? "One global lock serialises " + pct + "% of the work, so " + n + " threads return only " + mine.toFixed(1) + "x. You are buying cores you cannot use \u2014 shrink the critical section before you change strategy."
          : "The critical section is small relative to the work, so a single global lock still returns " + mine.toFixed(1) + "x on " + n + " threads. Keep it: it is the version everyone can reason about.";
      }
      if (strat === "striped") {
        return "Splitting across " + STRIPES + " independent stripes drops the effective serial fraction from " + pct + "% to roughly " + (s / STRIPES * 100).toFixed(1) + "%, taking you from " + base.toFixed(1) + "x to " + mine.toFixed(1) + "x \u2014 but only if your keys spread evenly, and any operation spanning two stripes has to take them in a fixed order.";
      }
      if (strat === "cas") {
        return mine > base
          ? "Lock-free wins here (" + mine.toFixed(1) + "x versus " + base.toFixed(1) + "x for the lock) because the contended window is short. Budget for the harder code and the retry loop you now have to reason about."
          : "Retries are eating the win: " + mine.toFixed(1) + "x against " + base.toFixed(1) + "x for a plain lock. A CAS loop under heavy contention is a spin loop that burns cores \u2014 this is where lock-free is premature cleverness.";
      }
      return mine > base
        ? "Copy-on-write turns readers loose (" + mine.toFixed(1) + "x versus " + base.toFixed(1) + "x) because they never block. You are paying for it in allocation and copying on every write \u2014 fine for read-mostly config, ruinous for a hot counter."
        : "Writes are too frequent for copy-on-write: copying the structure on every update costs more than the lock it replaced (" + mine.toFixed(1) + "x against " + base.toFixed(1) + "x).";
    }

    function paint() {
      var n = Math.round(readNum(threadsIn, 8, 1, 64));
      var pct = Math.round(readNum(critIn, 20, 0, 100));
      var s = pct / 100;

      threadsVal.textContent = String(n);
      critVal.textContent = pct + "%";

      var mine = model(strategy, s, n);
      var base = model("global", s, n);
      var mineSpeed = speedupOf(mine, n);
      var baseSpeed = speedupOf(base, n);

      roSpeed.textContent = mineSpeed.toFixed(2) + "x";
      roCostK.textContent = mine.label;
      roCostV.textContent = mine.unit === "x"
        ? mine.cost.toFixed(2) + "x per update"
        : Math.round(mine.cost * 100) + "%";
      roSerial.textContent = (mine.sEff * 100).toFixed(1) + "%";
      roCeil.textContent = mine.sEff > 0.0005
        ? (1 / mine.sEff / mine.overhead).toFixed(1) + "x"
        : "linear";
      roVerdict.textContent = verdictFor(strategy, s, n, mineSpeed, baseSpeed);
    }

    threadsIn.addEventListener("input", paint);
    threadsIn.addEventListener("change", paint);
    critIn.addEventListener("input", paint);
    critIn.addEventListener("change", paint);

    var seg = h("div", { class: "w-seg" });
    var choices = [
      ["global", "Single global lock"],
      ["striped", "Striped locks"],
      ["cas", "Lock-free CAS"],
      ["cow", "Immutable copy-on-write"]
    ];
    for (var i = 0; i < choices.length; i++) {
      (function (val, label, first) {
        var btn = h("button", { class: "w-seg-btn" + (first ? " active" : "") }, label);
        btn.addEventListener("click", function () {
          strategy = val;
          var all = seg.querySelectorAll("button");
          for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
          btn.classList.add("active");
          paint();
        });
        seg.appendChild(btn);
      })(choices[i][0], choices[i][1], i === 0);
    }

    function preset(threads, crit) {
      return function () {
        threadsIn.value = String(threads);
        critIn.value = String(crit);
        paint();
      };
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "threads ", threadsIn, threadsVal),
      h("label", { class: "w-field" }, "critical section ", critIn, critVal)));
    mount.appendChild(h("div", { class: "widget-controls" },
      seg,
      h("button", { class: "w-btn", onclick: preset(4, 5) }, "Thin lock, 4 threads"),
      h("button", { class: "w-btn", onclick: preset(32, 40) }, "Fat lock, 32 threads"),
      h("button", { class: "w-btn ghost", onclick: preset(8, 20) }, "Reset")));

    mount.appendChild(h("div", { class: "w-stage" },
      h("div", { class: "w-readout" },
        h("span", { class: "ro" }, "effective speedup ", roSpeed),
        h("span", { class: "ro" }, roCostK, roCostV),
        h("span", { class: "ro" }, "effective serial fraction ", roSerial),
        h("span", { class: "ro" }, "ceiling at infinite threads ", roCeil)),
      h("div", { class: "w-readout", style: "margin-top:8px" },
        h("span", { class: "ro" }, "verdict ", roVerdict))));

    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES OWNED BY THIS FILE
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "lld-concurrency-deep": {
      title: "Concurrency in depth checkpoint",
      sub: "Visibility, deadlock, atomics, and the async structure that keeps a service alive.",
      questions: [
        {
          q: "A worker spins on <code>while (!stopped) { poll(); }</code> where <code>stopped</code> is a plain non-volatile boolean set by another thread. The setter definitely ran, but the worker never exits. What is wrong?",
          options: [
            "A memory-visibility problem \u2014 nothing forces the reading thread to observe the other thread's write",
            "A race condition on the write \u2014 two threads wrote the flag at the same time",
            "A deadlock \u2014 the setter holds a lock the worker needs",
            "Starvation \u2014 the setter thread is never scheduled"
          ],
          answer: 0,
          explain: "Only one thread writes the flag, so there is no mutual-exclusion problem to solve. The bug is visibility: without a volatile read, a synchronised block, or another happens-before edge, the compiler and CPU are free to hoist the read out of the loop and the worker reads a stale cached value forever. Mutual exclusion and visibility are separate guarantees, and a lock happens to provide both."
        },
        {
          q: "Which of these is NOT one of the four conditions that must all hold for a deadlock to occur?",
          options: [
            "Mutual exclusion",
            "Priority inversion",
            "Circular wait",
            "Hold and wait"
          ],
          answer: 1,
          explain: "The four necessary conditions are mutual exclusion, hold-and-wait, no preemption, and circular wait; break any single one and deadlock becomes impossible. Priority inversion is a real and separate pathology \u2014 a low-priority thread holding a lock a high-priority thread needs \u2014 but it is a scheduling problem, not a deadlock condition."
        },
        {
          q: "Acquiring locks in a single global order everywhere in the codebase prevents deadlock by breaking which condition?",
          options: [
            "Mutual exclusion",
            "No preemption",
            "Circular wait",
            "Hold and wait"
          ],
          answer: 2,
          explain: "If every thread takes locks in the same total order, a cycle in the wait-for graph cannot form: a thread holding a lower-ranked lock only ever waits on higher-ranked ones. That is why the rule is worth the discipline of assigning locks a comparable rank, even something as crude as identity hash. Timeouts attack no-preemption instead, and are the fallback when a total order is impractical."
        },
        {
          q: "A CAS-based stack reads head = A and prepares to swing head to A.next. Before its compare-and-swap runs, another thread pops A, pops B, and pushes A back. The original CAS still succeeds. Why is that a bug?",
          options: [
            "Two threads can never pop the same node, so the CAS should have failed",
            "Compare-and-swap is not actually atomic on most processors",
            "The second thread should have taken a lock before popping",
            "The CAS compared equal pointer values, so it succeeded even though the list behind that pointer changed underneath it"
          ],
          answer: 3,
          explain: "This is the ABA problem: CAS only tells you the compared word is unchanged, not that the state it refers to is unchanged. The stack's head is A again but A.next now points somewhere stale, so the successful swap corrupts the list. The standard fixes are a version-stamped or tagged pointer so the compared word changes on every update, or a reclamation scheme such as hazard pointers or epochs that stops the node being reused while a reader holds it."
        },
        {
          q: "A quarter of each task's work runs inside one global critical section. With 8 threads, what speedup should you expect at best?",
          options: [
            "About 8x \u2014 threads scale linearly until you saturate cores",
            "About 6x",
            "About 2.9x",
            "About 4x"
          ],
          answer: 2,
          explain: "Amdahl's law gives 1 / (s + (1 - s) / n) with s = 0.25 and n = 8, which is 1 / (0.25 + 0.09375) = 2.9. Note that 4x is the ceiling as thread count goes to infinity, which is why adding threads past a point stops helping. Shrinking the serial fraction is worth far more than adding hardware."
        },
        {
          q: "Your service is dominated by blocking network calls: roughly 90 ms waiting and 10 ms computing per task, on an 8-core machine. What is a sane starting pool size?",
          options: [
            "Around 80 \u2014 cores multiplied by (1 + wait/compute)",
            "8 \u2014 one thread per core",
            "1 \u2014 concurrency does not help I/O",
            "Unbounded \u2014 one thread per in-flight request"
          ],
          answer: 0,
          explain: "The usual starting formula is threads = cores x target utilisation x (1 + wait time / compute time), which here is 8 x 1 x (1 + 9) = 80. One thread per core is right for CPU-bound work and leaves an I/O-bound service idle; unbounded threads trade one bottleneck for memory exhaustion and scheduler thrash. Treat the number as a starting point to measure from, not a truth."
        },
        {
          q: "A single-threaded event loop serving thousands of connections executes one synchronous, blocking database call inside a handler. What is the effect?",
          options: [
            "Only that connection is delayed; the loop continues serving the others",
            "The entire loop stalls \u2014 every other connection waits for that one call to return",
            "The runtime transparently moves the blocking call onto a background thread",
            "The call fails immediately because blocking I/O is not permitted on an event loop"
          ],
          answer: 1,
          explain: "An event loop makes progress by returning to the loop quickly; a blocking call parks the only thread that can run any handler, so latency for every other connection grows by the full duration of that call. Runtimes do not rescue you automatically \u2014 you have to hand the work to a worker pool or use a non-blocking client. This is the single most common way an async service falls over under load that a synchronous one would have survived."
        }
      ]
    },

    "lld-lldcases": {
      title: "More LLD cases checkpoint",
      sub: "Rate limiters, expense splitting, chess, logging, and notification dispatch.",
      questions: [
        {
          q: "You want to swap a token-bucket limiter for a sliding-window one without touching a single call site. Which shape gets you there?",
          options: [
            "An <code>if</code> on an algorithm-name string inside the limiter's <code>allow()</code> method",
            "A subclass of every caller, one per algorithm",
            "A <code>RateLimitStrategy</code> interface with one <code>tryAcquire(key)</code> method, injected into the limiter",
            "A global flag read once at process start"
          ],
          answer: 2,
          explain: "Putting the varying algorithm behind a one-method interface is the Strategy pattern, and it is exactly what Open/Closed asks for: a new algorithm is a new class, not an edit to tested code. The branch-on-string version compiles fine but every new algorithm reopens the same method, and every caller subclass multiplies the change surface. Injecting the strategy also lets tests supply a deterministic fake clock and limiter."
        },
        {
          q: "Why can a fixed-window counter let through nearly twice the configured rate?",
          options: [
            "Because clocks drift between the servers holding the counter",
            "Because integer arithmetic rounds the limit upward",
            "Because the counter needs a lock and locks drop requests",
            "Because a burst can straddle the window boundary \u2014 the tail of one window plus the head of the next both fit inside the limit"
          ],
          answer: 3,
          explain: "With a limit of 100 per minute, 100 requests at 11:59:59 and 100 more at 12:00:01 are both legal, so a client sustains 200 in a two-second span. A sliding-window log, a sliding-window counter that weights the previous bucket, or a token bucket all smooth this out. The trade-off is memory and arithmetic: the fixed window is one integer, the log is one entry per request."
        },
        {
          q: "Why model a <code>Split</code> as a first-class entity rather than writing pairwise debts straight into a balances table?",
          options: [
            "The split records who owes what and why, so balances can be re-derived, an expense can be edited or deleted, and settlements can be simplified",
            "It removes the need for a database entirely",
            "Pairwise rows take less space on disk",
            "It makes every read and write O(1)"
          ],
          answer: 0,
          explain: "Balances are a projection of the underlying splits, and once you throw the splits away you cannot correct an expense, explain a number to a suspicious housemate, or recompute after a currency fix. Keeping the split lets you treat balances as derived state you can rebuild at any time. It also makes settlement simplification possible, because you can reduce the net position graph rather than replay ad-hoc pairwise rows."
        },
        {
          q: "In a chess model, castling, en passant, and check all depend on board-wide state and move history. Where should move legality live?",
          options: [
            "Entirely inside each piece class, since each piece knows how it moves",
            "Pieces generate candidate moves from their own geometry; a rules engine that sees the whole board and history validates them",
            "In the UI, where the user's intent is known",
            "In the database, expressed as a constraint"
          ],
          answer: 1,
          explain: "Piece polymorphism is the right tool for the part that is genuinely per-piece \u2014 the geometry of how a knight or bishop moves \u2014 but the rules that make a move illegal depend on things a piece cannot see: the king's exposure, the rook's move history, the previous move's double pawn push. Splitting generation from validation keeps each piece small and puts board-wide invariants in one auditable place. The board stays the single authoritative state, and moves are applied through it rather than by pieces mutating themselves."
        },
        {
          q: "A logging framework needs pluggable destinations, severity filtering, and configurable output shape. What is the clean decomposition?",
          options: [
            "One <code>Logger</code> class with a switch over format and a file path field",
            "A subclass for every combination of destination, format, and level",
            "Appenders for destinations, levels for filtering, and formatters for shape \u2014 composed at configuration time, not inherited",
            "A single static method that takes a dozen parameters"
          ],
          answer: 2,
          explain: "These are three independent axes, so composing them keeps the class count linear instead of multiplicative; a subclass per combination is the textbook explosion the Decorator and Strategy patterns exist to avoid. Each appender owns its own destination and its own synchronisation, the level check is a cheap guard on the hot path, and the formatter is a pure function that is trivial to test. The logger itself then does almost nothing, which is exactly what you want on a path every other class calls."
        },
        {
          q: "Your notification dispatcher grows another <code>if channel == \"sms\"</code> branch every time a channel is added, and each branch has its own retry code. What fixes it?",
          options: [
            "Convert the branches to a switch statement for readability",
            "Drop retries and let the caller handle failure",
            "Move retry logic inside each channel so each transport can tune its own backoff",
            "A <code>Channel</code> interface per transport plus a retry and fallback policy the dispatcher applies uniformly, so channels know nothing about retry and the dispatcher knows nothing about transports"
          ],
          answer: 3,
          explain: "The two things varying independently are the transport and the delivery policy, so each needs its own abstraction; a switch keeps them tangled and a per-channel retry implementation duplicates backoff, jitter, and attempt limits four times over with no consistent fallback ordering. Channels should expose a narrow send-and-classify-the-failure contract, and the dispatcher should decide whether a failure is retryable and when to fall back. Per-channel tuning survives as configuration passed to the shared policy, not as copied code."
        }
      ]
    },

    "breakdowns-wild": {
      title: "Production case studies checkpoint",
      sub: "Migrations, real-time collaboration, inventory, queues, and lake economics.",
      questions: [
        {
          q: "What is the largest design cost of moving a heavily-read relational workload onto a wide-column store?",
          options: [
            "Access paths must be designed around the partition key up front \u2014 joins and ad-hoc queries largely go away",
            "Storage becomes more expensive per byte",
            "You lose SQL syntax and have to learn a new query dialect",
            "You can no longer index anything at all"
          ],
          answer: 0,
          explain: "Wide-column stores buy predictable latency and horizontal write scale by making you commit to how rows are partitioned and clustered before you write them. The relational habit of asking a new question by writing a new join disappears; every new question becomes a new table, a new materialisation, or an offline job. Syntax and secondary indexes are minor by comparison \u2014 the expensive part is that query flexibility was the thing you traded away."
        },
        {
          q: "Two users drag the same shape simultaneously in a real-time collaborative editor. Which property must the design guarantee?",
          options: [
            "Serialisability \u2014 one user's drag is rejected outright",
            "Convergence \u2014 once both clients have applied the same set of operations, they display the same document",
            "Linearisability of every mouse pointer position",
            "Exactly-once delivery of every input event"
          ],
          answer: 1,
          explain: "Collaborative editors are eventually consistent by construction: clients apply local edits immediately and reconcile afterwards, so the guarantee that matters is that any two clients holding the same operation set render the same document. Rejecting one user's edit is a correctness-preserving but unusable answer for a drawing tool. Exactly-once delivery is neither achievable nor necessary once operations are designed to be idempotent and commutative or transformable."
        },
        {
          q: "Why is \"send every edit to the server and wait for the acknowledgement before rendering it\" unusable in a graphical editor?",
          options: [
            "It consumes too much bandwidth",
            "Servers cannot process that message volume",
            "It puts a full network round trip in front of every keystroke and drag frame, so the interface feels laggy no matter how fast the server is",
            "It makes convergence impossible"
          ],
          answer: 2,
          explain: "Direct manipulation needs feedback within roughly a frame, and even a fast round trip is an order of magnitude beyond that budget, so the cursor visibly trails the mouse. The fix is optimistic local application with reconciliation afterwards, which is precisely what forces you into operational transformation or conflict-free replicated data types. The cost is that every edit must be expressible as an operation that can be replayed or transformed against concurrent ones."
        },
        {
          q: "During a flash sale, what does a short-lived inventory reservation actually buy you?",
          options: [
            "It removes the need for a database transaction anywhere in checkout",
            "It guarantees zero oversell under every possible failure",
            "It makes the catalogue page render faster",
            "It turns \"check availability, then buy\" into a single claim with an expiry, so a slow checkout cannot let the same unit be sold twice"
          ],
          answer: 3,
          explain: "The classic oversell bug is the gap between reading stock and committing the order; a reservation collapses that into one atomic claim and attaches a deadline so abandoned carts return stock automatically. It does not make oversell impossible \u2014 replication lag, compensating failures, and deliberately optimistic buffers can all still produce it \u2014 which is why teams pair it with an explicit policy for what happens when they do oversell. The reservation makes the window small and bounded rather than open-ended."
        },
        {
          q: "A message that crashes its consumer on every delivery will, if nothing is done about it:",
          options: [
            "Be redelivered indefinitely, burning capacity and blocking the partition or tenant behind it, unless attempts are capped and it is routed to a dead-letter destination",
            "Be dropped automatically by any reasonable broker",
            "Cause the broker process itself to fail",
            "Be resolved by adding more consumers"
          ],
          answer: 0,
          explain: "At-least-once delivery means an unacknowledged message comes back, and a poison message is unacknowledged forever, so the queue makes no forward progress past it in any ordered or partitioned setup. Capping attempts and moving the message to a dead-letter destination converts an outage into a triage queue somebody can look at on Monday. Adding consumers only multiplies the crash rate, because every consumer receives the same bad message in turn."
        },
        {
          q: "Why does the small-files problem hurt an analytics lake so much?",
          options: [
            "Object stores refuse to hold that many objects",
            "Per-file overhead \u2014 listing, opening, reading footers, and scheduling a task per file \u2014 starts to dominate the actual scan work",
            "Compression ratios collapse to nothing",
            "Columnar formats stop being splittable"
          ],
          answer: 1,
          explain: "A query over ten thousand two-megabyte files does the same amount of real scanning as one over a hundred two-hundred-megabyte files, but pays ten thousand listings, opens, and task launches to do it. Columnar footers and statistics also lose their pruning power when each file holds too few rows to be selective. The fix is boring and effective: compact on a schedule, size files in the hundreds of megabytes, and stop partitioning on a column with high cardinality."
        }
      ]
    }
  });

  /* =================================================================
     MODULE 1 · CONCURRENCY IN DEPTH  (pushed onto window.TRACKS.lld)
     ================================================================= */
  var MODULE_CONCURRENCY = {
    id: "concurrency-deep",
    name: "Concurrency In Depth",
    icon: "bolt",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "threads-and-state",
        title: "Shared mutable state is the bug",
        summary: "Visibility versus mutual exclusion, why reproducing a race proves nothing, and the two ways to not have the problem at all.",
        minutes: 9,
        tags: ["concurrency", "memory-model", "immutability"],
        blocks: [
          { t: "p", html: "You have already met race conditions and locks in <a class='inline' href='#/lld/principles/concurrency'>Concurrency &amp; thread safety</a>. This module goes underneath that lesson. Start with the mental model that makes everything else fall out: <strong>concurrency bugs need three ingredients \u2014 state that is shared, state that is mutable, and more than one thread touching it.</strong> Remove any one ingredient and the bug is not fixed, it is impossible." },
          { t: "p", html: "That framing matters because most engineers reach for a lock first. A lock is how you <em>manage</em> shared mutable state. Immutability and confinement are how you <em>avoid</em> it. Managing is harder, slower, and easier to get wrong, so it should be the second thing you try." },

          { t: "h", text: "Two different problems wearing the same coat" },
          { t: "p", html: "\"Thread safety\" bundles two guarantees that people routinely confuse. They fail differently, they are caused by different machinery, and only one of them is about threads interleaving." },
          {
            t: "table",
            headers: ["Problem", "What actually goes wrong", "Smallest fix"],
            rows: [
              ["<strong>Mutual exclusion</strong>", "Two threads interleave inside a read-modify-write, so one update is lost. Both threads saw the truth; the truth changed under them.", "Serialise the section: a lock, or one atomic instruction that does the whole read-modify-write."],
              ["<strong>Memory visibility</strong>", "One thread writes; another never sees the write, or sees writes in a different order than the source code. No interleaving is required \u2014 a single writer is enough.", "Establish a <em>happens-before</em> edge: a volatile/atomic access, a lock acquire and release pair, thread start or join."]
            ]
          },
          { t: "p", html: "Visibility is the surprising one because it has nothing to do with timing luck. A compiler may hoist a repeated read out of a loop into a register. A CPU may keep a write in a store buffer for a while. Neither is a bug \u2014 both are required for the single-threaded performance you take for granted \u2014 and neither is obliged to publish anything to other threads unless you ask." },
          { t: "code", lang: "java", code:
            "// Single writer, single reader, no interleaving at all.\n" +
            "// Still broken: nothing forces the reader to observe the write.\n" +
            "class Worker implements Runnable {\n" +
            "    private boolean stopped = false;      // plain field\n" +
            "\n" +
            "    public void run() {\n" +
            "        while (!stopped) {                // may be hoisted to: if (!stopped) while (true)\n" +
            "            pollOnce();\n" +
            "        }\n" +
            "    }\n" +
            "    public void stop() { stopped = true; }\n" +
            "}\n" +
            "\n" +
            "// Fix: give the read and the write a happens-before edge.\n" +
            "//   private volatile boolean stopped = false;\n" +
            "// A lock around both would also work, and would additionally give\n" +
            "// mutual exclusion you do not need here."
          },
          { t: "note", variant: "trap", html: "<strong>\"But it worked when I ran it.\"</strong> A race condition is not a property of an execution, it is a property of the program. Your run took one interleaving out of an astronomically large set, on one CPU architecture, with one compiler's optimisation decisions, under one load. A stronger memory model (x86 is fairly forgiving) can hide a bug that a weaker one (many ARM cores) exposes on the first try in production. Reproducing a concurrency bug is evidence; failing to reproduce it is not." },

          { t: "h", text: "Why you cannot test your way out" },
          {
            t: "ul", items: [
              "<strong>The interleaving space is enormous.</strong> Two threads with ten steps each already have over 180,000 orderings; your test explores a handful, biased toward whatever the scheduler likes today.",
              "<strong>Instrumentation changes the schedule.</strong> Adding logging or a breakpoint inserts delays that make the bad window vanish \u2014 the classic heisenbug.",
              "<strong>Load changes the schedule.</strong> Contention that never appears at ten requests per second appears constantly at ten thousand.",
              "<strong>Different hardware, different reorderings.</strong> Code that is correct on your laptop's memory model can be wrong on the machine you deploy to."
            ]
          },
          { t: "p", html: "The tools that <em>do</em> help are the ones that reason rather than sample: thread sanitisers and race detectors that track happens-before edges, static analysis that flags fields written under a lock in one place and read without it in another, and stress tests that deliberately inject scheduling noise. Treat them as smoke detectors, not proof." },

          { t: "h", text: "Way out 1 \u2014 immutability" },
          { t: "p", html: "If an object's state cannot change after construction, every thread that can see it sees the same thing forever. There is no critical section because there is no modification. This is not a trick; it is the removal of one of the three ingredients." },
          { t: "code", lang: "java", code:
            "// Every field final, no setters, defensive copy on the way in.\n" +
            "// Safe to publish to any number of threads with no synchronisation.\n" +
            "final class Money {\n" +
            "    private final long minorUnits;\n" +
            "    private final String currency;\n" +
            "\n" +
            "    Money(long minorUnits, String currency) {\n" +
            "        this.minorUnits = minorUnits;\n" +
            "        this.currency = currency;\n" +
            "    }\n" +
            "    // 'mutation' returns a new value instead of changing this one\n" +
            "    Money plus(Money other) {\n" +
            "        if (!currency.equals(other.currency)) throw new IllegalArgumentException();\n" +
            "        return new Money(minorUnits + other.minorUnits, currency);\n" +
            "    }\n" +
            "}"
          },
          { t: "note", variant: "warn", html: "Immutability is only free if the object is <strong>safely published</strong>. Handing a fully-constructed immutable object to another thread through a plain non-final field can still expose a partially-constructed view. Publish through a final field, a volatile field, a concurrent collection, or the act of starting the thread \u2014 all of which carry the happens-before edge with them." },

          { t: "h", text: "Way out 2 \u2014 confinement" },
          { t: "p", html: "If mutable state is only ever reachable by one thread, it is not shared, so it needs no protection. Confinement is usually cheaper than immutability because you keep writing ordinary mutable code; the discipline is entirely about who holds the reference." },
          {
            t: "table",
            headers: ["Flavour", "How the state stays private", "Where it shows up"],
            rows: [
              ["Stack confinement", "The object never escapes a local variable", "Almost all correct code, by accident"],
              ["Thread confinement", "One thread owns the object for its whole life", "UI toolkits, single-threaded event loops, per-thread connections"],
              ["Ownership handoff", "The producer stops touching the object the moment it publishes it", "Queues between stages; message passing; actor mailboxes"],
              ["Partitioned ownership", "Each shard of the data has exactly one owner thread", "Per-key actors, per-partition consumers, sharded caches"]
            ]
          },
          { t: "note", variant: "trap", html: "Confinement fails silently the day someone returns an internal collection from a getter. If a class relies on confinement, the invariant lives in the code's boundaries, not in its types, so write it down in the class comment and enforce it with defensive copies at the edges. \"Nobody would call this from another thread\" survives exactly one refactor." },

          { t: "cue", html: "<strong>Spot it in a prompt when:</strong> a field is written in one place and read in another with no lock in either; a getter hands out a mutable collection; a bug only reproduces under load or only on one machine; a fix consists of adding a sleep; someone says \"it is only a boolean, that is atomic\" (it is atomic and still invisible)." },
          { t: "note", variant: "key", html: "<strong>Mutual exclusion and visibility are separate guarantees.</strong> A lock happens to give you both, which is why people never learn the difference until a lock-free \"optimisation\" removes one of them. Before you design a locking scheme, spend a minute asking whether the state can be immutable or confined instead \u2014 the cheapest concurrency bug is the one the design made impossible. When it cannot be, go to <a class='inline' href='#/lld/concurrency-deep/locks-and-deadlock'>locks and deadlock</a>." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "locks-and-deadlock",
        title: "Locks, granularity, and deadlock",
        summary: "What mutual exclusion costs, the four conditions for deadlock and how to break them, plus livelock, starvation, and reentrancy.",
        minutes: 11,
        tags: ["concurrency", "locks", "deadlock"],
        blocks: [
          { t: "p", html: "A lock is a queue with a marketing problem. It looks like a keyword; it behaves like a single-server queue in front of your critical section. Everything that is true of queues \u2014 that utilisation near one makes latency explode, that arrival bursts matter more than averages \u2014 is true of contended locks. Hold that picture and lock design becomes capacity planning." },
          { t: "p", html: "The cost has three parts: the <strong>uncontended</strong> cost (an atomic instruction, cheap), the <strong>contended</strong> cost (a context switch and a trip through the scheduler, hundreds of times more expensive), and the <strong>serialisation</strong> cost (the part of your program that can no longer use more cores). The third one is the one that ruins your day, and it is what <a class='inline' href='#/lld/concurrency-deep/lockfree-and-atomics'>the next lesson's lab</a> makes you stare at." },

          { t: "h", text: "Granularity: fewer locks or smaller ones" },
          {
            t: "table",
            headers: ["Granularity", "Buys you", "Costs you"],
            rows: [
              ["One global lock", "Trivially correct, impossible to deadlock against itself, easy to review", "Every thread serialises on it; your effective serial fraction is the whole critical section"],
              ["Lock per object / per key", "Independent keys proceed in parallel", "Memory per lock, and any operation spanning two objects now needs two locks in a fixed order"],
              ["Striped locks (N locks, key hashed to one)", "Most of the parallelism of per-object locking at a fixed memory cost", "Unrelated keys collide on a stripe; cross-stripe operations are awkward; hot keys still serialise"],
              ["Read-write lock", "Concurrent readers on read-mostly data", "Writer starvation if reads never stop; more expensive than a plain lock when writes are common"]
            ]
          },
          { t: "note", variant: "tip", html: "Before you split a lock, shrink the section it guards. Moving I/O, logging, formatting, and allocation outside the critical section is usually worth more than any change of locking scheme, and it cannot introduce a deadlock. Compute into local variables, then take the lock only to publish." },

          { t: "h", text: "The four conditions for deadlock" },
          { t: "p", html: "Deadlock requires <strong>all four</strong> of these to hold simultaneously. That is genuinely useful, not trivia: every prevention technique in existence is an attack on one of them, and knowing which one you are attacking tells you what the technique will and will not cover." },
          {
            t: "ol", items: [
              "<strong>Mutual exclusion</strong> \u2014 a resource is held in a non-shareable mode. Attack it by making the resource shareable or immutable, which is usually not available for a lock.",
              "<strong>Hold and wait</strong> \u2014 a thread holding one resource requests another. Attack it by acquiring everything you need at once, or by releasing before you request.",
              "<strong>No preemption</strong> \u2014 a resource cannot be forcibly taken from its holder. Attack it with <code class='tok'>tryLock</code> plus a timeout, backing off and releasing what you hold on failure.",
              "<strong>Circular wait</strong> \u2014 a cycle exists in the wait-for graph. Attack it by imposing a total order on lock acquisition. This is the practical winner."
            ]
          },
          { t: "code", lang: "java", code:
            "// DEADLOCK: two accounts, two threads, opposite acquisition orders.\n" +
            "void transferBroken(Account from, Account to, long amount) {\n" +
            "    synchronized (from) {                 // thread A: locks #1 then #2\n" +
            "        synchronized (to) {               // thread B: locks #2 then #1\n" +
            "            from.debit(amount);\n" +
            "            to.credit(amount);\n" +
            "        }\n" +
            "    }\n" +
            "}\n" +
            "\n" +
            "// FIX: a total order on locks makes a cycle impossible.\n" +
            "// Any stable, comparable key works -- here, the account id.\n" +
            "void transfer(Account from, Account to, long amount) {\n" +
            "    if (from.id() == to.id()) throw new IllegalArgumentException(\"same account\");\n" +
            "    Account first  = from.id() < to.id() ? from : to;\n" +
            "    Account second = from.id() < to.id() ? to   : from;\n" +
            "    synchronized (first) {\n" +
            "        synchronized (second) {           // every thread agrees on the order\n" +
            "            from.debit(amount);\n" +
            "            to.credit(amount);\n" +
            "        }\n" +
            "    }\n" +
            "}"
          },
          { t: "note", variant: "warn", html: "If there is no natural ordering key, do not give up on ordering \u2014 use identity hash codes as the rank, and keep one extra \"tie-breaker\" lock for the rare case where two objects hash equal. That is uglier than the version above, and still far better than hoping." },

          { t: "h", text: "Three rules that prevent most real deadlocks" },
          {
            t: "ul", items: [
              "<strong>Order every multi-lock acquisition consistently</strong>, and write the order down somewhere a reviewer will see it. Cycles cannot form in a totally ordered graph.",
              "<strong>Prefer <code class='tok'>tryLock</code> with a timeout</strong> at the boundaries where ordering is impractical. You trade a guaranteed hang for a retryable failure, which is an enormous improvement in operability: a timeout produces a log line and a metric, a deadlock produces a silent, wedged thread pool.",
              "<strong>Never hold a lock across a call you do not control.</strong> Not a callback, not a listener notification, not a network or database call, not a virtual method a subclass might override. You cannot know what locks that code takes, so you cannot reason about the order."
            ]
          },
          { t: "note", variant: "trap", html: "The third rule is the one teams break. A method holds its own lock and then fires an observer notification; a listener registered six months later happens to take a different lock, and now you have a cycle nobody wrote deliberately. Copy the listener list under the lock, release it, then notify \u2014 the pattern is worth internalising, and it is exactly what makes the Observer pattern from <a class='inline' href='#/lld/patterns/behavioral'>behavioral patterns</a> dangerous in concurrent code." },

          { t: "h", text: "Livelock and starvation \u2014 not deadlock, still stuck" },
          {
            t: "compare",
            bad: {
              title: "Livelock",
              items: [
                "Threads are running, not blocked \u2014 CPU looks busy",
                "Each keeps politely backing off and retrying in lockstep",
                "Classic cause: uniform, fixed backoff after a tryLock failure",
                "Fix: randomised backoff (jitter) so the symmetry breaks"
              ]
            },
            good: {
              title: "Starvation",
              items: [
                "One thread makes progress; another never gets its turn",
                "Classic cause: an unfair lock plus a steady stream of contenders",
                "Also: readers arriving faster than a read-write lock drains them, so the writer waits forever",
                "Fix: fair queueing, or a writer-preference read-write lock"
              ]
            }
          },
          { t: "p", html: "Fairness is not free. A fair lock hands ownership to the longest waiter, which means the running thread must yield even when it could have re-acquired instantly, and throughput drops noticeably. Use fairness where a tail-latency guarantee matters more than throughput, and be able to say that out loud rather than flipping the flag by default." },

          { t: "h", text: "Reentrancy" },
          { t: "p", html: "A <strong>reentrant</strong> lock lets the thread that already holds it acquire it again, tracking a hold count and only releasing at zero. Without reentrancy, a class whose synchronised method calls another of its own synchronised methods deadlocks against itself \u2014 and so does any subclass override that calls up to the parent." },
          { t: "note", variant: "tip", html: "Reentrancy is a convenience with a sharp edge: it means your invariants can be observed <em>mid-update</em>. If a method takes the lock, breaks the invariant, and calls a virtual method that re-enters and reads the state, the lock did not save you. This is the same alien-method problem as above, arriving from the inside." },

          { t: "cue", html: "<strong>Reach for lock ordering when:</strong> a method touches two or more entities of the same kind (transfer, merge, swap, link); you see nested <code class='tok'>synchronized</code> blocks; a hang reproduces only under load and the thread dump shows two threads each holding what the other wants. <strong>Reach for a timeout when:</strong> the lock order depends on data you do not control, or the code path crosses a subsystem boundary." },
          { t: "note", variant: "key", html: "<strong>The four conditions are mutual exclusion, hold-and-wait, no preemption, and circular wait; break any one and deadlock is impossible.</strong> In practice you break circular wait with a consistent global acquisition order, keep <code class='tok'>tryLock</code> with a timeout as the fallback where ordering is impractical, and never hold a lock across a call you do not control. Say those three sentences in an interview and you have covered what the question was actually testing." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "lockfree-and-atomics",
        title: "Lock-free, atomics, and the ABA problem",
        summary: "Compare-and-swap as the primitive, why ABA is subtle, and an honest account of when lock-free is worth the maintenance bill.",
        minutes: 11,
        tags: ["concurrency", "atomics", "lock-free"],
        blocks: [
          { t: "p", html: "Every lock-free structure you will ever read is built from one instruction: <strong>compare-and-swap</strong>. CAS takes an address, the value you believe is there, and the value you want to write. It writes only if the current value still matches your expectation, and it tells you whether it succeeded. That is the whole primitive. Everything else is a retry loop around it." },
          { t: "code", lang: "java", code:
            "// The universal shape of a lock-free update: read, compute, CAS, retry.\n" +
            "long addAndGet(AtomicLong cell, long delta) {\n" +
            "    for (;;) {\n" +
            "        long current = cell.get();            // 1. snapshot\n" +
            "        long next    = current + delta;       // 2. compute off to the side\n" +
            "        if (cell.compareAndSet(current, next))// 3. publish only if unchanged\n" +
            "            return next;\n" +
            "        // 4. someone beat us; loop and recompute from the new value\n" +
            "    }\n" +
            "}"
          },
          { t: "p", html: "Note what this buys and what it does not. It is <strong>lock-free</strong>: the system as a whole always makes progress, because a failed CAS means somebody else succeeded. It is <em>not</em> <strong>wait-free</strong>: an individual thread can be unlucky forever. And it is not free of blocking-like behaviour \u2014 under heavy contention the retry loop is a spin loop, burning a core to make no progress." },

          { t: "h", text: "The ABA problem" },
          { t: "p", html: "CAS compares a <em>word</em>, and you want to conclude something about <em>state</em>. Those are the same thing only if the word changes whenever the state does. ABA is what happens when they come apart: a location holds A, changes to B, and changes back to A before your CAS runs. Your compare succeeds. The world it referred to is gone." },
          { t: "code", lang: "text", code:
            "Thread 1 (popping)                 Thread 2\n" +
            "-----------------------------------------------------------\n" +
            "head = A ; next = A.next (= B)\n" +
            "                                   pop A        head -> B\n" +
            "                                   pop B        head -> C\n" +
            "                                   push A       head -> A, A.next = C\n" +
            "CAS(head, A -> B)  SUCCEEDS\n" +
            "\n" +
            "head now points at B, which was already popped and may be freed.\n" +
            "The compared word was identical. The structure was not."
          },
          { t: "note", variant: "trap", html: "ABA is not a theoretical curiosity, and it is not solved by \"using a bigger integer\". It bites hardest with <strong>pointers</strong>, because allocators recycle addresses: free a node and the very next allocation can hand the same address back, manufacturing an A that is not the original A. A monotonically increasing counter never suffers ABA precisely because its word cannot return to a previous value." },
          {
            t: "ul", items: [
              "<strong>Version-stamped references</strong> \u2014 CAS a pair (pointer, counter) and bump the counter on every write, so the compared word never repeats. Needs a double-width CAS or a stamped-reference type.",
              "<strong>Hazard pointers</strong> \u2014 each thread publishes the nodes it is currently reading; reclamation skips anything published. Correct and general, and a substantial amount of machinery.",
              "<strong>Epoch-based reclamation</strong> \u2014 defer freeing until every thread has passed a quiescent point. Cheaper on the read path, harder to bound memory.",
              "<strong>A tracing garbage collector</strong> \u2014 removes the pointer-reuse form of ABA for free, because a node you still reference is never recycled. It does <em>not</em> remove logical ABA, where a value legitimately returns to a previous state and that matters."
            ]
          },

          { t: "h", text: "Feel the trade-off" },
          { t: "p", html: "Move the sliders. Watch what happens to the lock-free curve as you raise thread count with a fat critical section, and notice that copy-on-write is slower than a lock the moment writes stop being rare." },
          { t: "widget", id: "lldContentionLab" },
          { t: "p", html: "The shape you should take away: lock-free wins when the contended window is <em>tiny</em> \u2014 a counter, a flag, a single pointer swap. It loses when the window is wide, because a CAS loop under contention is a spin that wastes exactly the cores you added. That is Amdahl's law refusing to be negotiated with: <code class='tok'>1 / (s + (1 - s) / n)</code> caps you at <code class='tok'>1/s</code> no matter how many threads you buy." },

          { t: "h", text: "When lock-free genuinely wins" },
          {
            t: "table",
            headers: ["Tier", "Approach", "Why"],
            rows: [
              ["<strong>Naive</strong>", "Hand-rolled lock-free linked structure with your own reclamation scheme", "You have written a research paper and shipped it without the peer review. Nobody on the team can safely modify it, and the bugs are non-deterministic and unloggable."],
              ["<strong>Naive</strong>", "A plain lock held across an I/O call", "The serial fraction is now measured in milliseconds. No amount of clever locking recovers this; the fix is to not do that."],
              ["<strong>Solid</strong>", "A plain lock around a short, pure, in-memory critical section", "Readable, reviewable, debuggable, and usually within noise of anything cleverer. This is the correct default and you should be able to defend it."],
              ["<strong>Standout</strong>", "Standard-library atomics and concurrent collections, with a lock for anything they do not cover", "Someone else wrote and verified the lock-free part; you get the throughput without owning the correctness proof. Reach for an atomic counter, a concurrent map, a striped adder \u2014 not your own stack."]
            ]
          },
          {
            t: "compare",
            bad: {
              title: "Signs you are being clever, not fast",
              items: [
                "No benchmark showed the lock was the bottleneck",
                "The structure is exotic but the contention is low",
                "The code needs a comment explaining a memory ordering",
                "Only one person on the team can review it",
                "The failure mode is corruption, not a slow log line"
              ]
            },
            good: {
              title: "Signs lock-free is the right call",
              items: [
                "A profile shows real, sustained contention on one short section",
                "The operation is a single word update: counter, flag, pointer",
                "A library primitive already exists for exactly this",
                "The alternative lock would be held across a wide section you cannot shrink",
                "You can state the memory ordering requirement in one sentence"
              ]
            }
          },
          { t: "note", variant: "warn", html: "Be honest in interviews about this. \"I would use a lock, measure, and only go lock-free if the profile demanded it\" is a <em>stronger</em> answer than reciting a lock-free stack, because it shows you know what the code costs the team after you leave. If they push, describe the CAS loop and name ABA \u2014 that demonstrates the knowledge without pretending it is the default." },

          { t: "cue", html: "<strong>Reach for atomics when:</strong> the state is one word and the update is read-modify-write on that word; you need a compare-and-set for a state machine transition; you are incrementing a metric on a hot path. <strong>Reach for a lock when:</strong> the invariant spans more than one field, the section calls anything you do not own, or you cannot describe the failure mode in a sentence." },
          { t: "note", variant: "key", html: "<strong>CAS gives you an atomic word, not an atomic world.</strong> ABA is the gap between those two, and the fixes \u2014 version stamps, hazard pointers, epochs, or a tracing collector \u2014 all work by making the compared word or the memory itself refuse to repeat. The honest default remains a short, plain lock; go lock-free only where a profile and a library primitive both agree with you. Next: how this scales up into <a class='inline' href='#/lld/concurrency-deep/async-patterns'>asynchronous structure</a>." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "async-patterns",
        title: "Structuring asynchronous work",
        summary: "Futures, pool sizing, bounded queues and backpressure, cancellation and timeouts, and the blocking call that kills an event loop.",
        minutes: 11,
        tags: ["concurrency", "async", "backpressure", "thread-pools"],
        blocks: [
          { t: "p", html: "Once you stop thinking in threads and start thinking in <strong>tasks on a bounded resource</strong>, most async design becomes obvious. A thread is not a unit of work; it is an expensive execution slot, roughly a megabyte of stack plus a scheduler entry. The unit of work is the task, and your job is to decide how many can be in flight, what happens when there are too many, and how one gives up." },

          { t: "h", text: "Futures and promises: a handle to a result you do not have yet" },
          { t: "p", html: "A future is a placeholder for a value that will exist later, plus a way to attach what should happen when it does. The value of the abstraction is <em>composition</em>: you can express \"do these two in parallel, then combine, and if either fails do this instead\" without ever naming a thread." },
          { t: "code", lang: "javascript", code:
            "// Compose, do not nest. The two fetches overlap; the join waits for both.\n" +
            "async function loadDashboard(userId) {\n" +
            "  const [profile, orders] = await Promise.all([\n" +
            "    getProfile(userId),\n" +
            "    getRecentOrders(userId)\n" +
            "  ]);\n" +
            "  return { profile, orders };\n" +
            "}\n" +
            "\n" +
            "// Degrade instead of failing the whole page: settle, then decide.\n" +
            "async function loadDashboardResilient(userId) {\n" +
            "  const results = await Promise.allSettled([\n" +
            "    getProfile(userId),\n" +
            "    getRecentOrders(userId)\n" +
            "  ]);\n" +
            "  const profile = results[0].status === 'fulfilled' ? results[0].value : null;\n" +
            "  const orders  = results[1].status === 'fulfilled' ? results[1].value : [];\n" +
            "  if (!profile) throw new Error('profile is required');\n" +
            "  return { profile, orders, degraded: results[1].status !== 'fulfilled' };\n" +
            "}"
          },
          { t: "note", variant: "trap", html: "The two ways futures go wrong in review: a <strong>dropped rejection</strong>, where nothing is attached to the failure path so an error disappears into a log nobody reads; and an <strong>accidental sequence</strong>, where awaiting inside a loop turns work that could have overlapped into a serial chain. Both are invisible until the latency graph tells on you." },

          { t: "h", text: "Thread pools, and why sizing them wrong is the usual incident" },
          { t: "p", html: "A pool exists to cap concurrency. That is its purpose \u2014 the thread reuse is a side benefit. Size it as a function of what the tasks actually do:" },
          { t: "code", lang: "text", code:
            "threads = cores x targetUtilisation x (1 + waitTime / computeTime)\n" +
            "\n" +
            "CPU-bound   8 cores, wait 0 ms,  compute 10 ms\n" +
            "            8 x 1.0 x (1 + 0)          =  8 threads\n" +
            "            (many teams use cores + 1 to cover a page fault)\n" +
            "\n" +
            "I/O-bound   8 cores, wait 90 ms, compute 10 ms\n" +
            "            8 x 1.0 x (1 + 9)          = 80 threads\n" +
            "\n" +
            "Then sanity-check against the downstream: if the database accepts\n" +
            "40 concurrent connections, 80 threads just moves the queue.\n" +
            "The bottleneck does not care where you put the waiting."
          },
          {
            t: "table",
            headers: ["Sizing mistake", "What it looks like in production"],
            rows: [
              ["Pool far too small", "Latency climbs while CPU sits idle; the queue depth graph is the only thing moving"],
              ["Pool far too large", "Context-switch overhead and memory pressure; you overwhelm a downstream that had been coping"],
              ["One shared pool for everything", "A slow dependency saturates the pool and unrelated fast endpoints start timing out \u2014 use separate pools (bulkheads) per dependency"],
              ["Blocking tasks on a CPU-sized pool", "Every thread parked in a socket read; throughput collapses to almost nothing with the machine 3% busy"],
              ["Nested pool dependency", "Tasks in pool A submit to pool A and wait for the result; the pool deadlocks against itself with no lock in sight"]
            ]
          },
          { t: "note", variant: "warn", html: "That last row is worth reading twice. A task that submits to its own pool and blocks on the result is a genuine deadlock \u2014 all threads waiting for work that can only run on a thread. It is invisible in code review because there is no lock and no shared state. If a task must depend on another task, they belong on different pools." },

          { t: "h", text: "Bounded queues and backpressure" },
          { t: "p", html: "An unbounded queue is not a safety feature, it is a delayed outage. It converts \"we are overloaded\" \u2014 a condition you can measure and respond to \u2014 into memory growth and rising latency, and eventually into an out-of-memory kill that takes the in-flight work with it. Bound every queue and decide, deliberately, what happens when it is full." },
          {
            t: "table",
            headers: ["Full-queue policy", "Use when", "Cost"],
            rows: [
              ["Reject and signal the caller", "The caller can retry or degrade; requests have a client-side deadline", "Visible failures, which is the point \u2014 they show up as a metric rather than as memory"],
              ["Block the producer", "The producer is the same system and can safely slow down", "Backpressure propagates upstream; dangerous if the producer holds a lock or a connection"],
              ["Run on the caller's thread", "You want an automatic throttle with no extra machinery", "The submitting thread stops accepting new work, which is often exactly what you want"],
              ["Drop oldest / drop newest", "Data is a stream where staleness is worse than loss (metrics, telemetry)", "Silent loss \u2014 only acceptable if you count what you dropped"]
            ]
          },
          { t: "note", variant: "tip", html: "Backpressure is just the queue's fullness travelling upstream until it reaches something that can slow down or say no. If no component in your chain is willing to say no, the chain has no backpressure and its capacity limit is your memory limit." },

          { t: "h", text: "Cancellation and timeouts" },
          {
            t: "ul", items: [
              "<strong>Every remote call gets a timeout.</strong> A missing timeout is an unbounded resource hold: the thread, the connection, and the caller's patience are all pinned until the network gives up, which can be minutes.",
              "<strong>Propagate a deadline, not a duration.</strong> If the client has 500 ms left, each hop should pass the remaining budget down rather than restarting its own timer, or three hops of \"200 ms each\" silently becomes 600 ms.",
              "<strong>Cancellation is cooperative.</strong> Setting a flag or interrupting a thread does nothing unless the task checks it at the points where it can safely stop. Design those checkpoints; do not assume the runtime will kill anything.",
              "<strong>Cancel the work, not just the wait.</strong> Abandoning a future while the underlying request keeps running is how you build a system that is at capacity while serving nobody.",
              "<strong>Do not retry on a timeout without a budget.</strong> A timeout usually means the downstream is struggling; retries add load to something already failing. Cap attempts, add jitter, and pair it with a circuit breaker."
            ]
          },

          { t: "h", text: "The blocking call inside the event loop" },
          { t: "p", html: "An event loop is a single thread that runs handlers to completion. Its entire performance story is that each handler returns quickly so the next one can run. Put one synchronous call in a handler and you have not slowed that request \u2014 you have stopped the server." },
          { t: "code", lang: "javascript", code:
            "// BROKEN on an event loop: every other connection waits on this.\n" +
            "function handler(req, res) {\n" +
            "  const rows = db.querySync('select * from orders where id = ?', req.id);\n" +
            "  res.json(rows);            // 40 ms of blocking = 40 ms of global stall\n" +
            "}\n" +
            "\n" +
            "// Fine: the loop is free while the driver waits on the socket.\n" +
            "async function handler(req, res) {\n" +
            "  const rows = await db.query('select * from orders where id = ?', [req.id]);\n" +
            "  res.json(rows);\n" +
            "}\n" +
            "\n" +
            "// Also blocking, and easier to miss: CPU-bound work in a handler.\n" +
            "// Hashing, image resizing, large JSON parsing, sorting a big array --\n" +
            "// none of them yield. Move them to a worker pool.\n" +
            "async function handlerCpu(req, res) {\n" +
            "  const digest = await workerPool.run('hash', req.body);\n" +
            "  res.json({ digest });\n" +
            "}"
          },
          { t: "note", variant: "trap", html: "The same trap has a synchronous-server twin: a thread-per-request server survives one slow dependency and dies of a thousand, because every waiting request holds a thread. Async does not remove the limit \u2014 it moves it from threads to memory and file descriptors. Whichever model you use, name the resource that runs out first." },

          { t: "cue", html: "<strong>Say this out loud in an interview:</strong> \"This queue is bounded at N and rejects when full.\" \"Every outbound call has a timeout and we propagate the remaining deadline.\" \"Slow dependencies get their own pool so they cannot starve the fast paths.\" Those three sentences separate someone who has run a service from someone who has read about one." },
          { t: "note", variant: "key", html: "<strong>Async design is resource budgeting, not thread juggling.</strong> Cap concurrency with a right-sized pool per dependency, bound every queue and choose the rejection policy on purpose, give every remote call a propagated deadline, and keep blocking work off any thread that other requests depend on. When you design a queue or worker in <a class='inline' href='#/lld/lldcases/case-notification'>a real class-design problem</a>, these are the properties the interviewer is listening for." },
          { t: "quiz", id: "lld-concurrency-deep" }
        ]
      }
    ]
  };

  /* =================================================================
     MODULE 2 · MORE LLD CASES  (pushed onto window.TRACKS.lld)
     ================================================================= */
  var MODULE_CASES = {
    id: "lldcases",
    name: "More LLD Cases",
    icon: "wrench",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "case-rate-limiter",
        title: "Worked example: in-process rate limiter",
        summary: "Four algorithms behind one interface, so the policy changes without a single caller changing.",
        minutes: 10,
        tags: ["practice", "case-study", "strategy-pattern"],
        blocks: [
          { t: "p", html: "Design an in-process rate limiter: a component a service calls before doing expensive work, which answers yes or no for a given key. Follow <a class='inline' href='#/lld/practice/lld-process'>the LLD process</a> \u2014 the interest here is entirely in where the varying part goes." },

          { t: "h", text: "1 \u00b7 Clarify the requirements" },
          {
            t: "ul", items: [
              "<strong>Per-key limits</strong> \u2014 a limit applies to a user, an API key, or an endpoint, not to the process as a whole.",
              "<strong>Multiple policies</strong> \u2014 different keys get different limits, and the algorithm itself may need to change (fixed window today, token bucket tomorrow).",
              "<strong>Cheap and non-blocking</strong> \u2014 it runs on every request; it must be constant time and must never do I/O.",
              "<strong>Thread-safe</strong> \u2014 many request threads hit the same key concurrently.",
              "<strong>Out of scope</strong> \u2014 distributed coordination across instances. Say so explicitly: an in-process limiter multiplied by N instances is an N-times-larger effective limit, and that is a deliberate trade, not an oversight."
            ]
          },

          { t: "h", text: "2 \u00b7 Entities and responsibilities" },
          {
            t: "table",
            headers: ["Type", "Responsibility"],
            rows: [
              ["<code>RateLimiter</code>", "The facade callers use. Resolves a key to its rule, finds or creates that key's state, delegates the decision."],
              ["<code>RateLimitStrategy</code>", "The one-method interface that varies: given state, a rule, and now, may this request proceed?"],
              ["<code>FixedWindow / SlidingWindow / TokenBucket / LeakyBucket</code>", "Concrete strategies. Each owns its own state shape and its own arithmetic."],
              ["<code>Rule</code>", "Immutable value: limit, window duration, burst allowance."],
              ["<code>Clock</code>", "Injected time source. Without this the tests need sleeps, and tests with sleeps are tests that flake."],
              ["<code>BucketRegistry</code>", "Key to state map, with eviction of idle keys so the map is not an unbounded memory leak."]
            ]
          },

          { t: "h", text: "3 \u00b7 The class design" },
          { t: "code", lang: "python", code:
            "from dataclasses import dataclass\n" +
            "from threading import Lock\n" +
            "\n" +
            "@dataclass(frozen=True)\n" +
            "class Rule:\n" +
            "    limit: int            # permits per window\n" +
            "    window_seconds: float\n" +
            "    burst: int = 0        # extra permits a bucket may accumulate\n" +
            "\n" +
            "class RateLimitStrategy:\n" +
            "    \"\"\"The only thing that varies. One method, no I/O, no blocking.\"\"\"\n" +
            "    def new_state(self, rule, now): raise NotImplementedError\n" +
            "    def try_acquire(self, state, rule, now, permits=1): raise NotImplementedError\n" +
            "\n" +
            "class TokenBucket(RateLimitStrategy):\n" +
            "    def new_state(self, rule, now):\n" +
            "        return {'tokens': float(rule.limit), 'last': now}\n" +
            "\n" +
            "    def try_acquire(self, state, rule, now, permits=1):\n" +
            "        rate = rule.limit / rule.window_seconds        # tokens per second\n" +
            "        ceiling = rule.limit + rule.burst\n" +
            "        elapsed = max(0.0, now - state['last'])\n" +
            "        state['tokens'] = min(ceiling, state['tokens'] + elapsed * rate)\n" +
            "        state['last'] = now\n" +
            "        if state['tokens'] >= permits:\n" +
            "            state['tokens'] -= permits\n" +
            "            return Decision(allowed=True, retry_after=0.0)\n" +
            "        deficit = permits - state['tokens']\n" +
            "        return Decision(allowed=False, retry_after=deficit / rate)\n" +
            "\n" +
            "class RateLimiter:\n" +
            "    def __init__(self, strategy, rules, clock, stripes=64):\n" +
            "        self._strategy = strategy                       # injected: DIP\n" +
            "        self._rules = rules                             # key pattern -> Rule\n" +
            "        self._clock = clock\n" +
            "        self._state = {}\n" +
            "        self._locks = [Lock() for _ in range(stripes)]  # striped, not global\n" +
            "\n" +
            "    def _lock_for(self, key):\n" +
            "        return self._locks[hash(key) % len(self._locks)]\n" +
            "\n" +
            "    def try_acquire(self, key, permits=1):\n" +
            "        rule = self._rules.resolve(key)\n" +
            "        now = self._clock.now()\n" +
            "        with self._lock_for(key):              # short section, no I/O inside\n" +
            "            state = self._state.get(key)\n" +
            "            if state is None:\n" +
            "                state = self._strategy.new_state(rule, now)\n" +
            "                self._state[key] = state\n" +
            "            return self._strategy.try_acquire(state, rule, now, permits)"
          },
          { t: "p", html: "Two things to point at while you draw this. The strategy is stateless and the <em>state lives with the key</em>, which is what lets one strategy instance serve millions of keys. And the lock is striped rather than global \u2014 the critical section is a few arithmetic operations, so the only way it becomes a bottleneck is if every thread queues on one lock. That is the <a class='inline' href='#/lld/concurrency-deep/locks-and-deadlock'>granularity decision</a> made concrete." },

          { t: "h", text: "4 \u00b7 The decision that matters: where the algorithm lives" },
          {
            t: "table",
            headers: ["Tier", "Design", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "<code>if algorithm == 'token_bucket': ... elif ...</code> inside <code>try_acquire</code>", "Every new algorithm reopens the one method every request executes. The method accumulates four state shapes, the tests grow combinatorially, and a bug in one branch is a bug on the hot path for all of them."],
              ["<strong>Naive</strong>", "<code>TokenBucketRateLimiter</code>, <code>FixedWindowRateLimiter</code>, ... each a full limiter subclass", "The registry, striping, eviction, and rule resolution are duplicated in every subclass. Changing eviction means editing four classes, and callers now depend on which algorithm they got."],
              ["<strong>Solid</strong>", "A <code>RateLimitStrategy</code> interface with the algorithm injected", "One point of variation, one place to change. Callers depend on <code>RateLimiter</code> only; swapping the algorithm is a wiring change. This is Open/Closed and Dependency Inversion doing exactly their job."],
              ["<strong>Standout</strong>", "The above, plus the strategy resolved <em>per rule</em> rather than per limiter, and a <code>Decision</code> return type carrying <code>retry_after</code>", "Different keys can now use different algorithms in one process \u2014 a token bucket for burst-tolerant reads, a strict fixed window for a billing endpoint. Returning a structured decision rather than a boolean lets the caller emit a correct retry hint instead of guessing."]
            ]
          },
          { t: "note", variant: "trap", html: "The fixed-window counter is the one everybody writes first and the one that quietly lets through twice the limit. With a limit of 100 per minute, 100 requests at 11:59:59 and 100 more at 12:00:01 are both legal, so the client sustains 200 in two seconds. Name that boundary burst before the interviewer does, and say what you would use instead (sliding window counter, or a token bucket) and what it costs (more state, more arithmetic)." },

          { t: "h", text: "5 \u00b7 Extensions they will ask for" },
          {
            t: "ul", items: [
              "<strong>\"Make it distributed.\"</strong> The strategy interface survives; the state store changes from a local map to a shared one, and <code>try_acquire</code> becomes a single atomic server-side operation (a script or a conditional update) rather than read-then-write. Call out the new failure mode: what does the limiter do when the store is unreachable? Fail open and risk overload, or fail closed and cause an outage \u2014 pick and justify.",
              "<strong>\"Different limits per tier.\"</strong> Rule resolution becomes an ordered match on key patterns; keep it out of the limiter behind a <code>RuleResolver</code> so the matching logic can be tested alone.",
              "<strong>\"Tell the client when to come back.\"</strong> Already handled by <code>retry_after</code> on the decision, which is why the boolean return was the wrong shape.",
              "<strong>\"The map grows forever.\"</strong> Idle keys need eviction \u2014 a time-based expiry sweep or a bounded LRU (see <a class='inline' href='#/lld/practice/case-lru'>the LRU case</a>). This is a real memory leak in production limiters and a good thing to volunteer.",
              "<strong>\"Two limits at once, per-second and per-day.\"</strong> Compose: a <code>CompositeStrategy</code> that requires all children to allow, and refunds permits to the ones that allowed if a later one denies. Mention the refund \u2014 forgetting it double-charges the first limiter."
            ]
          },
          { t: "note", variant: "key", html: "<strong>The whole design is one question: what varies?</strong> Here it is the algorithm, so the algorithm goes behind a one-method interface and everything else \u2014 registry, striping, eviction, rule resolution \u2014 stays put and stays shared. Return a decision object, not a boolean; inject the clock, or your tests will sleep; and stripe the lock, because the critical section is arithmetic and should never be the bottleneck." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "case-splitwise",
        title: "Worked example: expense splitting and balances",
        summary: "Model the split as a first-class entity, derive balances, and simplify settlements instead of storing pairwise debts.",
        minutes: 10,
        tags: ["practice", "case-study", "domain-modelling"],
        blocks: [
          { t: "p", html: "Design an expense-splitting system: a group records who paid for what, the system tracks who owes whom, and it can tell everyone the smallest set of payments that clears the group. It looks like a CRUD problem and is actually a modelling problem, which is why it is asked." },

          { t: "h", text: "1 \u00b7 Clarify the requirements" },
          {
            t: "ul", items: [
              "<strong>Groups of users</strong>, each with many expenses. A user can be in several groups.",
              "<strong>Split types</strong> \u2014 equal, exact amounts, percentage, and shares. New types will be added; assume so.",
              "<strong>Multiple payers</strong> \u2014 two people can jointly pay one bill. Ask about this early; it changes the model from a single <code>paid_by</code> field to a collection.",
              "<strong>Balances</strong> \u2014 what any pair owes, and what one member's net position is.",
              "<strong>Settlements</strong> \u2014 record a payment, and suggest the minimum number of transfers that clears the group.",
              "<strong>Correctness constraints</strong> \u2014 amounts are integers in minor units, splits must sum exactly to the total, expenses can be edited and deleted."
            ]
          },
          { t: "note", variant: "warn", html: "Use integer minor units (cents, paise) for every amount, and decide the rounding rule up front. Splitting 10.00 three ways gives 3.33, 3.33, 3.34 \u2014 somebody absorbs the remainder, and the system must pick deterministically (largest-remainder to the payer, or rotate) rather than letting floating point decide. Saying this unprompted is a strong signal." },

          { t: "h", text: "2 \u00b7 Entities and responsibilities" },
          {
            t: "table",
            headers: ["Type", "Responsibility"],
            rows: [
              ["<code>User</code>, <code>Group</code>", "Identity and membership. Nothing financial."],
              ["<code>Expense</code>", "One real-world spend: total, currency, description, who paid what, and its splits. Immutable once created \u2014 an edit creates a new version."],
              ["<code>Share</code>", "One participant's slice of one expense: user, owed amount in minor units. The first-class entity everything else derives from."],
              ["<code>SplitStrategy</code>", "Turns a total plus participant inputs into a list of <code>Share</code>s that sums exactly to the total. Equal, exact, percent, shares."],
              ["<code>Settlement</code>", "A real transfer that happened: payer, payee, amount, timestamp. Also an entry in the ledger."],
              ["<code>BalanceService</code>", "Folds expenses and settlements into net positions. Owns no state of its own."],
              ["<code>SimplifyService</code>", "Turns net positions into a minimal set of transfers."]
            ]
          },

          { t: "h", text: "3 \u00b7 The class design" },
          { t: "code", lang: "python", code:
            "from dataclasses import dataclass\n" +
            "from typing import List, Dict\n" +
            "\n" +
            "@dataclass(frozen=True)\n" +
            "class Share:\n" +
            "    user_id: str\n" +
            "    owed_minor: int          # integer minor units, always\n" +
            "\n" +
            "class SplitStrategy:\n" +
            "    def split(self, total_minor: int, inputs) -> List[Share]:\n" +
            "        raise NotImplementedError\n" +
            "\n" +
            "class EqualSplit(SplitStrategy):\n" +
            "    def split(self, total_minor, inputs):\n" +
            "        users = list(inputs.participants)\n" +
            "        base, remainder = divmod(total_minor, len(users))\n" +
            "        # deterministic remainder: first `remainder` users absorb one unit\n" +
            "        return [Share(u, base + (1 if i < remainder else 0))\n" +
            "                for i, u in enumerate(users)]\n" +
            "\n" +
            "class PercentSplit(SplitStrategy):\n" +
            "    def split(self, total_minor, inputs):\n" +
            "        shares, running = [], 0\n" +
            "        items = list(inputs.percents.items())\n" +
            "        for user, pct in items[:-1]:\n" +
            "            amount = total_minor * pct // 100\n" +
            "            running += amount\n" +
            "            shares.append(Share(user, amount))\n" +
            "        last_user = items[-1][0]                 # last absorbs the remainder\n" +
            "        shares.append(Share(last_user, total_minor - running))\n" +
            "        return shares\n" +
            "\n" +
            "@dataclass(frozen=True)\n" +
            "class Expense:\n" +
            "    id: str\n" +
            "    group_id: str\n" +
            "    total_minor: int\n" +
            "    paid_by: Dict[str, int]      # user -> amount actually paid\n" +
            "    shares: List[Share]          # user -> amount actually owed\n" +
            "\n" +
            "    def validate(self):\n" +
            "        # the two invariants that keep the whole system honest\n" +
            "        assert sum(self.paid_by.values()) == self.total_minor\n" +
            "        assert sum(s.owed_minor for s in self.shares) == self.total_minor\n" +
            "\n" +
            "class BalanceService:\n" +
            "    def net_positions(self, expenses, settlements) -> Dict[str, int]:\n" +
            "        \"\"\"Positive = the group owes them. Negative = they owe the group.\"\"\"\n" +
            "        net: Dict[str, int] = {}\n" +
            "        for e in expenses:\n" +
            "            for user, paid in e.paid_by.items():\n" +
            "                net[user] = net.get(user, 0) + paid\n" +
            "            for s in e.shares:\n" +
            "                net[s.user_id] = net.get(s.user_id, 0) - s.owed_minor\n" +
            "        for t in settlements:\n" +
            "            net[t.payer] = net.get(t.payer, 0) + t.amount_minor\n" +
            "            net[t.payee] = net.get(t.payee, 0) - t.amount_minor\n" +
            "        return net                 # always sums to zero; assert it\n" +
            "\n" +
            "class SimplifyService:\n" +
            "    def transfers(self, net: Dict[str, int]):\n" +
            "        \"\"\"Greedy max-debtor to max-creditor. Not provably minimal, but\n" +
            "        at most n-1 transfers and good enough for real groups.\"\"\"\n" +
            "        debtors  = sorted(((v, u) for u, v in net.items() if v < 0))\n" +
            "        creditors = sorted(((v, u) for u, v in net.items() if v > 0), reverse=True)\n" +
            "        out, i, j = [], 0, 0\n" +
            "        while i < len(debtors) and j < len(creditors):\n" +
            "            owe, d = debtors[i]\n" +
            "            due, c = creditors[j]\n" +
            "            amount = min(-owe, due)\n" +
            "            out.append((d, c, amount))\n" +
            "            debtors[i]   = (owe + amount, d)\n" +
            "            creditors[j] = (due - amount, c)\n" +
            "            if debtors[i][0] == 0:   i += 1\n" +
            "            if creditors[j][0] == 0: j += 1\n" +
            "        return out"
          },

          { t: "h", text: "4 \u00b7 The decision that matters: what you store" },
          {
            t: "table",
            headers: ["Tier", "Design", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "On each expense, write rows into a <code>debts(from, to, amount)</code> table and add them up", "The <em>why</em> is gone the moment you write the row. You cannot edit an expense, cannot explain a number to a suspicious housemate, cannot recompute after a currency correction, and any bug in the write path is permanently baked into the data."],
              ["<strong>Naive</strong>", "Store the expense but keep a running <code>balance</code> column you mutate in place", "Now correctness depends on every write path being perfect forever, and a partial failure leaves a balance that matches nothing. There is no way to detect the drift, because the balance is the only record."],
              ["<strong>Solid</strong>", "Expenses and shares are the durable truth; balances are computed by folding them", "Everything is derivable and auditable. Editing an expense is a new version plus a recompute; a bug is fixable by re-running the fold. Splits are first-class, so the split logic can be tested against the sum invariant."],
              ["<strong>Standout</strong>", "The above, plus balances kept as a <em>cached projection</em> with the fold as the authority, and settlements recorded as ledger entries rather than as balance edits", "You get O(1) reads without giving up derivability, and you can periodically re-fold and assert the cache matches. Treating a settlement as an entry rather than an adjustment means the ledger always sums to zero \u2014 which is a single assertion that catches an entire class of bug."]
            ]
          },
          { t: "note", variant: "tip", html: "The invariant to state out loud is that <strong>net positions across a group always sum to zero</strong>. It falls out of double-entry: every unit owed by someone is owed to someone. Assert it after every fold and you will catch rounding bugs, missing shares, and bad settlements on the first test rather than in someone's rent." },

          { t: "h", text: "5 \u00b7 Extensions they will ask for" },
          {
            t: "ul", items: [
              "<strong>\"Multiple currencies.\"</strong> Store the original amount and currency, plus the rate used at the time. Never re-convert historic expenses with today's rate, or last month's balances change every morning.",
              "<strong>\"Edit or delete an expense.\"</strong> Append a new version and mark the old one superseded rather than mutating. Balances re-fold; the audit trail survives; concurrent edits are detectable with a version check.",
              "<strong>\"Non-group, one-to-one expenses.\"</strong> A degenerate group of two. Resist adding a parallel code path.",
              "<strong>\"Truly minimal transfers.\"</strong> Be honest: minimising the number of transfers exactly is a hard combinatorial problem, and the greedy pass gives at most n-1 transfers, which is what users actually want. Saying \"greedy, at most n-1, and I would not pay for optimal\" is a better answer than claiming optimality.",
              "<strong>\"Two people edit the same expense at once.\"</strong> Optimistic concurrency: expenses carry a version, the update is conditional on it, and a mismatch returns a conflict to resolve. See <a class='inline' href='#/lld/practice/case-idempotent-workflow'>the idempotent workflow case</a> for the same idea applied to money movement."
            ]
          },
          { t: "note", variant: "key", html: "<strong>Store facts, derive summaries.</strong> The share is the fact; the balance is a fold over facts; the settlement is another fact, not an edit to a summary. That single choice is what makes editing, auditing, currency correction, and \"why do I owe this?\" all tractable \u2014 and it is why the interviewer asked a question that looks like CRUD." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "case-chess",
        title: "Worked example: a chess game model",
        summary: "Split move generation from move validation, keep the board authoritative, and stop pieces from mutating the world.",
        minutes: 11,
        tags: ["practice", "case-study", "polymorphism"],
        blocks: [
          { t: "p", html: "Design the model behind a chess game. The trap is that chess looks like a perfect showcase for inheritance \u2014 six pieces, six move rules, one base class \u2014 and then castling, en passant, promotion, and check arrive and demolish that shape. Where legality lives is the entire question." },

          { t: "h", text: "1 \u00b7 Clarify the requirements" },
          {
            t: "ul", items: [
              "<strong>Legal move enforcement</strong> \u2014 including castling, en passant, promotion, and the rule that you may not leave or move into check.",
              "<strong>Game outcomes</strong> \u2014 checkmate, stalemate, and draws by the fifty-move rule, threefold repetition, and insufficient material.",
              "<strong>History</strong> \u2014 undo, replay, and export, which means moves must be recorded as data, not just applied.",
              "<strong>Out of scope for the model</strong> \u2014 the engine that picks a move, the clock, the network layer, the UI. Say so; a candidate who designs an AI evaluator has answered a different question."
            ]
          },
          { t: "note", variant: "trap", html: "Notice how many rules are not properties of a piece at all. Castling depends on whether that king and that rook have ever moved and on squares being unattacked. En passant depends on the immediately previous move. Check depends on every enemy piece at once. A design that puts all legality inside <code class='tok'>Piece</code> ends up passing the whole board and the whole history into every piece \u2014 at which point the piece is not encapsulating anything." },

          { t: "h", text: "2 \u00b7 Entities and responsibilities" },
          {
            t: "table",
            headers: ["Type", "Responsibility"],
            rows: [
              ["<code>Board</code>", "The authoritative state: piece placement, side to move, castling rights, en-passant target, halfmove clock. Nothing else may hold a second copy."],
              ["<code>Piece</code> (polymorphic)", "Colour, type, and <em>pseudo-legal move generation</em>: the squares this piece could reach given occupancy alone. No knowledge of check, history, or rights."],
              ["<code>Move</code>", "An immutable value: from, to, piece, captured piece, promotion, flags for castle and en passant. Rich enough to be undone exactly."],
              ["<code>RuleEngine</code>", "Board-wide validation: filters pseudo-legal moves to legal ones, detects check, checkmate, stalemate, and draws."],
              ["<code>Game</code>", "Orchestration: applies a validated move, appends to history, flips the side to move, reports status."],
              ["<code>MoveHistory</code>", "The move list plus enough undo state (captured piece, prior rights, prior clock) to reverse each move exactly."]
            ]
          },

          { t: "h", text: "3 \u00b7 The class design" },
          { t: "code", lang: "python", code:
            "from dataclasses import dataclass\n" +
            "from typing import List, Optional\n" +
            "\n" +
            "@dataclass(frozen=True)\n" +
            "class Move:\n" +
            "    frm: int; to: int                 # 0..63\n" +
            "    piece: 'Piece'\n" +
            "    captured: Optional['Piece'] = None\n" +
            "    promotion: Optional[str] = None   # 'Q' | 'R' | 'B' | 'N'\n" +
            "    is_castle: bool = False\n" +
            "    is_en_passant: bool = False\n" +
            "\n" +
            "class Piece:\n" +
            "    \"\"\"Knows its own geometry. Knows nothing about check or history.\"\"\"\n" +
            "    def __init__(self, colour): self.colour = colour\n" +
            "    def pseudo_moves(self, board, square) -> List[Move]:\n" +
            "        raise NotImplementedError\n" +
            "\n" +
            "class SlidingPiece(Piece):\n" +
            "    DIRECTIONS: tuple = ()            # subclasses supply their rays\n" +
            "    def pseudo_moves(self, board, square):\n" +
            "        out = []\n" +
            "        for step in self.DIRECTIONS:\n" +
            "            target = square + step\n" +
            "            while board.on_board(square, target, step):\n" +
            "                occupant = board.at(target)\n" +
            "                if occupant is None:\n" +
            "                    out.append(Move(square, target, self))\n" +
            "                else:\n" +
            "                    if occupant.colour != self.colour:\n" +
            "                        out.append(Move(square, target, self, captured=occupant))\n" +
            "                    break                       # rays stop at the first piece\n" +
            "                target += step\n" +
            "        return out\n" +
            "\n" +
            "class Bishop(SlidingPiece): DIRECTIONS = (-9, -7, 7, 9)\n" +
            "class Rook(SlidingPiece):   DIRECTIONS = (-8, -1, 1, 8)\n" +
            "class Queen(SlidingPiece):  DIRECTIONS = (-9, -8, -7, -1, 1, 7, 8, 9)\n" +
            "\n" +
            "class RuleEngine:\n" +
            "    \"\"\"Everything that needs to see the whole board or the history.\"\"\"\n" +
            "    def legal_moves(self, board) -> List[Move]:\n" +
            "        candidates = []\n" +
            "        for square, piece in board.pieces_of(board.side_to_move):\n" +
            "            candidates.extend(piece.pseudo_moves(board, square))\n" +
            "        candidates.extend(self._castles(board))       # needs rights + attacks\n" +
            "        candidates.extend(self._en_passant(board))    # needs previous move\n" +
            "        # the rule no piece can enforce: you may not end up in check\n" +
            "        legal = []\n" +
            "        for mv in candidates:\n" +
            "            undo = board.apply(mv)\n" +
            "            if not self.is_attacked(board, board.king_square(mv.piece.colour),\n" +
            "                                    by=opposite(mv.piece.colour)):\n" +
            "                legal.append(mv)\n" +
            "            board.undo(undo)                          # exact reversal\n" +
            "        return legal\n" +
            "\n" +
            "    def status(self, board):\n" +
            "        moves = self.legal_moves(board)\n" +
            "        in_check = self.is_attacked(board, board.king_square(board.side_to_move),\n" +
            "                                    by=opposite(board.side_to_move))\n" +
            "        if moves:\n" +
            "            if board.halfmove_clock >= 100:  return 'draw:fifty-move'\n" +
            "            if board.repetitions() >= 3:     return 'draw:repetition'\n" +
            "            return 'check' if in_check else 'ongoing'\n" +
            "        return 'checkmate' if in_check else 'stalemate'\n" +
            "\n" +
            "class Game:\n" +
            "    def __init__(self, board, rules):\n" +
            "        self.board, self.rules, self.history = board, rules, []\n" +
            "\n" +
            "    def play(self, frm, to, promotion=None):\n" +
            "        wanted = self._match(self.rules.legal_moves(self.board), frm, to, promotion)\n" +
            "        if wanted is None:\n" +
            "            raise IllegalMove(frm, to)\n" +
            "        undo = self.board.apply(wanted)   # only the board mutates the board\n" +
            "        self.history.append((wanted, undo))\n" +
            "        return self.rules.status(self.board)"
          },
          { t: "p", html: "The critical line is <code class='tok'>undo = board.apply(mv)</code>. A single object owns state transitions and hands back exactly what is needed to reverse them. No piece ever writes to the board, so there is one place to look when the position is wrong, and undo is a first-class operation rather than a re-simulation from move one." },

          { t: "h", text: "4 \u00b7 The decision that matters: piece polymorphism versus a rules engine" },
          {
            t: "table",
            headers: ["Tier", "Design", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "<code>piece.is_legal(board, from, to)</code> \u2014 all legality inside the piece hierarchy", "King needs castling rights and enemy attack maps; pawn needs the previous move; every piece needs check detection. The board and history end up passed into every piece, so nothing is encapsulated and check logic is duplicated six times or hoisted into the base class as a god method."],
              ["<strong>Naive</strong>", "One <code>RuleEngine</code> with a switch on piece type and no <code>Piece</code> classes", "Move geometry is genuinely per-type and genuinely stable \u2014 it is the one part inheritance handles perfectly. Collapsing it into a switch throws away the only clean polymorphism the problem offers and produces a 400-line method."],
              ["<strong>Solid</strong>", "Pieces generate pseudo-legal moves from geometry; a rules engine validates against board-wide state", "Each piece stays small and testable in isolation. Every rule that needs global knowledge lives in one auditable class. Adding a variant piece is a new class; adding a variant rule is a change in one place."],
              ["<strong>Standout</strong>", "The above, plus <code>Move</code> as an immutable value with full undo information and <code>Board</code> as the sole mutator", "Undo, replay, threefold repetition, and legality-by-simulation all become cheap and exact, because the model can move forwards and backwards through history without reconstructing anything. Perft testing \u2014 counting leaf nodes to a fixed depth against known values \u2014 then verifies the whole rule set in one command."]
            ]
          },
          { t: "note", variant: "warn", html: "Sliding pieces share their entire algorithm and differ only by direction vectors, so <code class='tok'>SlidingPiece</code> is a legitimate use of inheritance \u2014 a genuine is-a with a stable base. Knight, king, and pawn do not fit it and should not be forced in. That is <a class='inline' href='#/lld/oop/composition-inheritance'>composition over inheritance</a> applied with judgement rather than as a slogan: use the hierarchy exactly as far as the shared behaviour actually goes." },

          { t: "h", text: "5 \u00b7 Extensions they will ask for" },
          {
            t: "ul", items: [
              "<strong>\"Add a chess variant.\"</strong> A new piece is a new <code>Piece</code> subclass. A changed rule \u2014 different board size, different castling \u2014 is a different <code>RuleEngine</code> implementation. That the two extensions land in two different places is the proof the split was right.",
              "<strong>\"Undo and redo.\"</strong> Already there: history holds move plus undo state, so redo is re-applying the move. This is the Command pattern from <a class='inline' href='#/lld/patterns/behavioral'>behavioral patterns</a> with the undo record made explicit.",
              "<strong>\"Draw by repetition.\"</strong> Hash the position \u2014 placement, side to move, castling rights, en-passant target \u2014 and count occurrences. Note that the hash must include rights and the en-passant square, or two genuinely different positions collide.",
              "<strong>\"Make it fast.\"</strong> Bitboards: one 64-bit word per piece type per colour, so attack generation is bit operations. Say this is a representation change behind <code>Board</code>, not a design change \u2014 the rule engine's interface does not move. Also say you would not start there.",
              "<strong>\"Two players over a network.\"</strong> The server holds the authoritative <code>Board</code> and validates every move; clients are views. Never trust a client-computed legal move \u2014 the same reasoning as <a class='inline' href='#/breakdowns/wild/wild-multiplayer-editing'>server-authoritative collaborative editing</a>."
            ]
          },
          { t: "note", variant: "key", html: "<strong>Put per-type geometry in the type, and board-wide rules in one engine that can see everything.</strong> Chess is the cleanest available demonstration that polymorphism and a centralised rules layer are complements, not alternatives \u2014 and that keeping one object authoritative over state is what makes undo, replay, and validation-by-simulation all fall out for free." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "case-logger",
        title: "Worked example: a logging framework",
        summary: "Three independent axes \u2014 destination, level, format \u2014 composed rather than inherited, with writes that are safe and fast.",
        minutes: 10,
        tags: ["practice", "case-study", "composition"],
        blocks: [
          { t: "p", html: "Design a logging framework. It is asked because it looks trivial and is not: the thing gets called from every class in the system, from every thread, on the hot path, and it must never be the reason a request fails. The design pressure is unusual \u2014 correctness under concurrency, minimal overhead when disabled, and configurability without a class explosion." },

          { t: "h", text: "1 \u00b7 Clarify the requirements" },
          {
            t: "ul", items: [
              "<strong>Levels</strong> \u2014 trace through error, filterable globally and per logger name, with a hierarchy so <code>com.app.billing</code> inherits from <code>com.app</code>.",
              "<strong>Multiple destinations</strong> \u2014 console, rolling file, and a network sink, and one message may go to several.",
              "<strong>Configurable output shape</strong> \u2014 plain text for a terminal, structured JSON for a log pipeline, chosen per destination.",
              "<strong>Thread-safe</strong> \u2014 concurrent calls must not interleave within a single record.",
              "<strong>Cheap when off</strong> \u2014 a disabled trace call should cost approximately nothing, including not building the message string.",
              "<strong>Never take the application down</strong> \u2014 a full disk or an unreachable sink degrades logging, it does not fail the request."
            ]
          },

          { t: "h", text: "2 \u00b7 Entities and responsibilities" },
          {
            t: "table",
            headers: ["Type", "Responsibility"],
            rows: [
              ["<code>Logger</code>", "The caller-facing object, one per name. Checks the level, builds the record, hands it to its appenders. Deliberately almost empty."],
              ["<code>LogRecord</code>", "Immutable value: timestamp, level, logger name, thread, message, arguments, exception, context fields."],
              ["<code>Appender</code>", "Owns one destination and its own synchronisation and failure policy. Console, rolling file, network."],
              ["<code>Formatter</code>", "Pure function from record to string or bytes. No I/O, no state, trivially testable."],
              ["<code>Filter</code>", "Optional extra predicate on a record \u2014 sampling, per-tenant suppression, rate limiting."],
              ["<code>LoggerFactory</code>", "Resolves a name to a configured logger, walking the name hierarchy for the effective level and appender set."],
              ["<code>AsyncAppender</code>", "A decorator: bounded queue plus a drain thread in front of any other appender."]
            ]
          },

          { t: "h", text: "3 \u00b7 The class design" },
          { t: "code", lang: "java", code:
            "// Formatter: pure, stateless, no I/O. The easiest thing in the system to test.\n" +
            "interface Formatter { String format(LogRecord r); }\n" +
            "\n" +
            "// Appender: owns a destination AND its own thread safety AND its own\n" +
            "// failure policy. Callers never synchronise on an appender themselves.\n" +
            "interface Appender extends AutoCloseable {\n" +
            "    void append(LogRecord r);\n" +
            "    void flush();\n" +
            "}\n" +
            "\n" +
            "final class FileAppender implements Appender {\n" +
            "    private final Object lock = new Object();      // private -- nobody else can hold it\n" +
            "    private final Formatter formatter;\n" +
            "    private final BufferedWriter out;\n" +
            "    private final Level flushAbove;                // e.g. flush immediately at ERROR\n" +
            "\n" +
            "    public void append(LogRecord r) {\n" +
            "        String line = formatter.format(r);         // formatting OUTSIDE the lock\n" +
            "        synchronized (lock) {                      // short: one buffered write\n" +
            "            try {\n" +
            "                out.write(line);\n" +
            "                out.newLine();\n" +
            "                if (r.level().atLeast(flushAbove)) out.flush();\n" +
            "            } catch (IOException e) {\n" +
            "                // logging must never fail the caller's request\n" +
            "                ErrorSink.reportOnce(\"file appender failed\", e);\n" +
            "            }\n" +
            "        }\n" +
            "    }\n" +
            "}\n" +
            "\n" +
            "// AsyncAppender is a DECORATOR: same interface, adds a bounded handoff.\n" +
            "final class AsyncAppender implements Appender {\n" +
            "    private final Appender delegate;\n" +
            "    private final BlockingQueue<LogRecord> queue;  // BOUNDED, always\n" +
            "    private final Thread drain;\n" +
            "    private final AtomicLong dropped = new AtomicLong();\n" +
            "\n" +
            "    public void append(LogRecord r) {\n" +
            "        if (!queue.offer(r)) dropped.incrementAndGet();  // shed, never block\n" +
            "    }\n" +
            "    private void drainLoop() {\n" +
            "        while (running) {\n" +
            "            LogRecord r = queue.poll(200, MILLISECONDS);\n" +
            "            if (r != null) delegate.append(r);\n" +
            "        }\n" +
            "    }\n" +
            "}\n" +
            "\n" +
            "final class Logger {\n" +
            "    private final String name;\n" +
            "    private volatile Level threshold;              // volatile: reconfigurable live\n" +
            "    private final List<Appender> appenders;        // immutable snapshot, swapped on reconfig\n" +
            "\n" +
            "    public boolean isEnabled(Level l) { return l.atLeast(threshold); }\n" +
            "\n" +
            "    public void log(Level l, String template, Object... args) {\n" +
            "        if (!isEnabled(l)) return;                 // the cheap early exit\n" +
            "        LogRecord r = new LogRecord(clock.now(), l, name,\n" +
            "                                    Thread.currentThread().getName(),\n" +
            "                                    template, args, Context.snapshot());\n" +
            "        for (Appender a : appenders) a.append(r);  // no lock held here\n" +
            "    }\n" +
            "}"
          },
          { t: "note", variant: "tip", html: "Two performance details worth naming. Pass the <strong>template and arguments separately</strong> so string interpolation only happens if the record survives filtering \u2014 building the message eagerly is the single most common cause of a logging framework showing up in a profile. And keep the appender list an <strong>immutable snapshot</strong> that reconfiguration replaces wholesale, so the read path never takes a lock and never sees a half-updated list." },

          { t: "h", text: "4 \u00b7 The decision that matters: composition of three independent axes" },
          {
            t: "table",
            headers: ["Tier", "Design", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "One <code>Logger</code> with a file path, a boolean for JSON, and a level field", "Three axes crammed into one class. Adding a second destination means an array of paths, then a per-path format, then a per-path level \u2014 and you have grown the composition badly, inside a class that every thread in the process calls."],
              ["<strong>Naive</strong>", "<code>JsonFileLogger</code>, <code>TextFileLogger</code>, <code>JsonNetworkLogger</code>, ...", "The combination explosion: destinations x formats x buffering strategies. Three of each is twenty-seven classes, and buffered-async is a fourth axis that doubles it again."],
              ["<strong>Solid</strong>", "Appender for destination, Formatter for shape, Level for filtering, all injected", "Linear growth: a new destination is one class, a new format is one class. Each is testable alone, and the formatter is a pure function, which makes it the easiest part of the system to get exactly right."],
              ["<strong>Standout</strong>", "The above, plus <code>AsyncAppender</code> as a decorator wrapping any appender, and each appender owning its own private lock and failure policy", "Buffering becomes a fourth axis you compose rather than a flag you add to every appender, which is the Decorator pattern earning its keep. Private per-appender locks mean a slow network sink cannot block a console write, and per-appender failure handling means a full disk degrades one destination instead of throwing into the caller."]
            ]
          },
          { t: "note", variant: "warn", html: "Never let the logger throw into the caller. A logging failure must become a dropped record and a counter, never an exception on a request path \u2014 an unreachable log sink taking down checkout is a real outage that has happened to real teams. And bound the async queue: an unbounded one converts a slow sink into an out-of-memory kill, which is <a class='inline' href='#/lld/concurrency-deep/async-patterns'>exactly the backpressure failure</a> from the concurrency module." },

          { t: "h", text: "5 \u00b7 Extensions they will ask for" },
          {
            t: "ul", items: [
              "<strong>\"Structured logging with context.\"</strong> Add a context map to the record, populated from a per-request scope. Snapshot it at record creation \u2014 reading it later on the drain thread gives you whichever request happened to be running then.",
              "<strong>\"Rolling files by size and time.\"</strong> A rollover policy injected into <code>FileAppender</code>, plus a retention policy for deletion. Two more one-method interfaces, no new appender.",
              "<strong>\"Change the level at runtime without a restart.\"</strong> Already possible: the threshold is volatile and the appender list is a swapped snapshot. Say why volatile matters here \u2014 it is the <a class='inline' href='#/lld/concurrency-deep/threads-and-state'>visibility guarantee</a>, not mutual exclusion.",
              "<strong>\"Sample high-volume logs.\"</strong> A <code>Filter</code> in front of the appenders, keeping one in N or rate-limiting per logger name. Reuse the limiter from <a class='inline' href='#/lld/lldcases/case-rate-limiter'>the rate limiter case</a> rather than writing a second one.",
              "<strong>\"Guarantee nothing is lost on crash.\"</strong> Be honest that buffering and durability are in direct tension: flushing every record is durable and slow, buffering is fast and loses a tail. Offer the middle \u2014 buffer everything, flush synchronously at error level and above."
            ]
          },
          { t: "note", variant: "key", html: "<strong>When three things vary independently, compose them; do not multiply them into a hierarchy.</strong> Destination, filtering, and format are orthogonal, so each becomes its own small abstraction and the logger itself shrinks to a level check and a loop. Keep the lock private, short, and outside formatting; bound the async queue; and make failure a dropped counter rather than an exception in someone's request." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "case-notification",
        title: "Worked example: a notification dispatcher",
        summary: "One channel abstraction, one shared retry and fallback policy, and a dispatcher that knows nothing about SMS.",
        minutes: 11,
        tags: ["practice", "case-study", "strategy-pattern", "reliability"],
        blocks: [
          { t: "p", html: "Design a notification service: other systems ask it to tell a user something, and it delivers over email, SMS, push, or an in-app inbox, respecting the user's preferences and retrying sensibly when a provider is having a bad day. The design pressure is that transports and delivery policy vary <em>independently</em>, and the naive design tangles them." },

          { t: "h", text: "1 \u00b7 Clarify the requirements" },
          {
            t: "ul", items: [
              "<strong>Multiple channels</strong> \u2014 email, SMS, push, in-app \u2014 and more later. Each has a different provider API, different failure modes, and different cost.",
              "<strong>User preferences</strong> \u2014 opt-outs per category, quiet hours, and a preferred channel order.",
              "<strong>Templates</strong> \u2014 one logical notification renders differently per channel; SMS has a hard length limit, email has a subject.",
              "<strong>Reliability</strong> \u2014 transient provider failures get retried with backoff; a channel that stays down falls back to the next one.",
              "<strong>No duplicates</strong> \u2014 a retry must not send twice. Ask whether the guarantee is at-least-once with deduplication or best-effort; it changes the design.",
              "<strong>Out of scope</strong> \u2014 the queueing infrastructure itself. Assume a durable queue exists and design the worker."
            ]
          },
          { t: "note", variant: "trap", html: "The requirement people miss is <strong>terminal versus retryable failure</strong>. \"Provider timed out\" should be retried; \"phone number is invalid\" and \"user has unsubscribed\" must not be, ever, and they must not fall back to another channel either. If a channel returns a bare boolean, the dispatcher cannot tell these apart and will hammer a provider with requests that can never succeed." },

          { t: "h", text: "2 \u00b7 Entities and responsibilities" },
          {
            t: "table",
            headers: ["Type", "Responsibility"],
            rows: [
              ["<code>NotificationRequest</code>", "Immutable input: recipient, category, template id, payload, idempotency key, priority."],
              ["<code>Channel</code>", "One transport. Renders via its template, calls its provider, and <em>classifies</em> the outcome. Knows nothing about retry, fallback, or preferences."],
              ["<code>DeliveryResult</code>", "The classification: sent, retryable failure (with an optional provider hint on when), or terminal failure with a reason."],
              ["<code>PreferenceService</code>", "Resolves recipient plus category into an ordered list of permitted channels. The only place opt-outs and quiet hours live."],
              ["<code>RetryPolicy</code>", "Attempt budget, backoff with jitter, and per-channel overrides. A value object, not code inside a channel."],
              ["<code>Dispatcher</code>", "Orchestrates: resolve channels, deduplicate, attempt, apply the policy, fall back, record the outcome. Contains zero transport-specific code."],
              ["<code>DeliveryLog</code>", "Durable per-(key, channel) attempt record. Provides deduplication and the audit trail for \"did we actually send it?\""]
            ]
          },

          { t: "h", text: "3 \u00b7 The class design" },
          { t: "code", lang: "python", code:
            "from dataclasses import dataclass\n" +
            "from enum import Enum\n" +
            "\n" +
            "class Outcome(Enum):\n" +
            "    SENT = 'sent'\n" +
            "    RETRYABLE = 'retryable'     # provider timeout, 5xx, throttled\n" +
            "    TERMINAL = 'terminal'       # invalid address, unsubscribed, blocked\n" +
            "\n" +
            "@dataclass(frozen=True)\n" +
            "class DeliveryResult:\n" +
            "    outcome: Outcome\n" +
            "    provider_id: str = ''       # for reconciliation and support tickets\n" +
            "    reason: str = ''\n" +
            "    retry_after: float = 0.0    # provider hint, honoured over our backoff\n" +
            "\n" +
            "class Channel:\n" +
            "    \"\"\"One transport. No retry, no fallback, no preferences in here.\"\"\"\n" +
            "    name: str\n" +
            "    def supports(self, recipient) -> bool: raise NotImplementedError\n" +
            "    def send(self, recipient, rendered, idempotency_key) -> DeliveryResult:\n" +
            "        raise NotImplementedError\n" +
            "\n" +
            "class SmsChannel(Channel):\n" +
            "    name = 'sms'\n" +
            "    def supports(self, recipient):\n" +
            "        return bool(recipient.phone_e164)\n" +
            "    def send(self, recipient, rendered, idempotency_key):\n" +
            "        try:\n" +
            "            resp = self._provider.send(\n" +
            "                to=recipient.phone_e164,\n" +
            "                body=rendered.body[:1600],\n" +
            "                client_token=idempotency_key)      # provider-side dedupe\n" +
            "            return DeliveryResult(Outcome.SENT, provider_id=resp.sid)\n" +
            "        except ProviderThrottled as e:\n" +
            "            return DeliveryResult(Outcome.RETRYABLE, retry_after=e.retry_after)\n" +
            "        except (ProviderTimeout, ProviderUnavailable):\n" +
            "            return DeliveryResult(Outcome.RETRYABLE, retry_after=0.0)\n" +
            "        except InvalidNumber as e:\n" +
            "            return DeliveryResult(Outcome.TERMINAL, reason=str(e))\n" +
            "\n" +
            "@dataclass(frozen=True)\n" +
            "class RetryPolicy:\n" +
            "    max_attempts: int = 4\n" +
            "    base_delay: float = 1.0\n" +
            "    max_delay: float = 60.0\n" +
            "    def delay_for(self, attempt, hint=0.0, rand=None):\n" +
            "        if hint > 0:\n" +
            "            return min(hint, self.max_delay)          # trust the provider first\n" +
            "        raw = min(self.max_delay, self.base_delay * (2 ** (attempt - 1)))\n" +
            "        jitter = rand() if rand else 0.5              # injected: deterministic tests\n" +
            "        return raw * (0.5 + 0.5 * jitter)             # full-ish jitter, no thundering herd\n" +
            "\n" +
            "class Dispatcher:\n" +
            "    def __init__(self, channels, preferences, renderer, policy, log, scheduler):\n" +
            "        self._channels = {c.name: c for c in channels}\n" +
            "        self._preferences = preferences\n" +
            "        self._renderer = renderer\n" +
            "        self._policy = policy\n" +
            "        self._log = log\n" +
            "        self._scheduler = scheduler\n" +
            "\n" +
            "    def dispatch(self, request, attempt=1, channel_index=0):\n" +
            "        order = self._preferences.channels_for(request.recipient, request.category)\n" +
            "        if channel_index >= len(order):\n" +
            "            return self._log.exhausted(request.idempotency_key)\n" +
            "\n" +
            "        channel = self._channels[order[channel_index]]\n" +
            "        key = request.idempotency_key\n" +
            "        if self._log.already_sent(key, channel.name):   # dedupe before any send\n" +
            "            return 'duplicate-suppressed'\n" +
            "        if not channel.supports(request.recipient):\n" +
            "            return self.dispatch(request, 1, channel_index + 1)\n" +
            "\n" +
            "        rendered = self._renderer.render(request, channel.name)\n" +
            "        result = channel.send(request.recipient, rendered, key)\n" +
            "        self._log.record(key, channel.name, attempt, result)\n" +
            "\n" +
            "        if result.outcome is Outcome.SENT:\n" +
            "            return 'sent:' + channel.name\n" +
            "        if result.outcome is Outcome.TERMINAL:\n" +
            "            # never retry, never fall back on an unsubscribe; do fall back\n" +
            "            # on a channel-specific address problem\n" +
            "            if result.reason == 'unsubscribed':\n" +
            "                return 'suppressed'\n" +
            "            return self.dispatch(request, 1, channel_index + 1)\n" +
            "        if attempt < self._policy.max_attempts:\n" +
            "            delay = self._policy.delay_for(attempt, result.retry_after)\n" +
            "            return self._scheduler.retry_in(delay, request, attempt + 1, channel_index)\n" +
            "        return self.dispatch(request, 1, channel_index + 1)   # budget spent, fall back"
          },
          { t: "p", html: "Read the dispatcher again and notice what is <em>not</em> in it: no provider SDK, no phone-number formatting, no subject line, no length limit. It reads as policy \u2014 try, classify, wait, fall back, record \u2014 and every transport detail is behind <code class='tok'>Channel</code>. That is the test for whether the abstraction is real." },

          { t: "h", text: "4 \u00b7 The decision that matters: where retry lives" },
          {
            t: "table",
            headers: ["Tier", "Design", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "<code>if channel == 'sms': ... elif channel == 'email': ...</code> inside <code>send()</code>, each branch with its own retry loop", "Every new channel edits the one method the whole system depends on, and backoff, jitter, and attempt limits are reimplemented per branch with subtly different bugs. There is no consistent fallback order because there is no place that owns ordering."],
              ["<strong>Naive</strong>", "A <code>Channel</code> interface, but each channel retries internally", "The abstraction looks right and leaks badly. Retry duration is now invisible to the caller, so a synchronous dispatch can block for a minute; fallback cannot happen, because the dispatcher only learns of failure after the channel has given up; and per-channel budgets cannot be enforced globally."],
              ["<strong>Solid</strong>", "Channels send once and classify; the dispatcher owns retry and fallback via an injected <code>RetryPolicy</code>", "One implementation of backoff and jitter, one fallback ordering, one attempt budget. A new channel is one class implementing two methods, and it cannot get retry wrong because it does not do retry."],
              ["<strong>Standout</strong>", "The above, plus per-channel circuit breakers and a durable <code>DeliveryLog</code> keyed by (idempotency key, channel)", "A provider that is fully down stops being retried at all after the breaker opens, so you fail over to the next channel in milliseconds instead of after four backoffs \u2014 and you stop adding load to something already failing. The delivery log makes retries safe by construction and answers \"did the user get it?\" without asking the provider."]
            ]
          },
          { t: "note", variant: "tip", html: "Layer deduplication rather than trusting one level of it. The dispatcher checks the delivery log before sending, and it also passes the idempotency key to the provider as a client token so a response lost in transit does not become a second SMS. That is the same lesson as <a class='inline' href='#/lld/practice/case-idempotent-workflow'>the idempotent workflow case</a>: every non-idempotent side effect needs its own dedupe boundary." },

          { t: "h", text: "5 \u00b7 Extensions they will ask for" },
          {
            t: "ul", items: [
              "<strong>\"Add a new channel next week.\"</strong> One class, two methods, one template variant, one line of configuration. If the answer is longer than that, the abstraction is not doing its job.",
              "<strong>\"Quiet hours and digests.\"</strong> Preferences return a schedule as well as an order; low-priority notifications are appended to a per-user digest and flushed on a timer. Keep this in the preference layer \u2014 the dispatcher should not learn about time of day.",
              "<strong>\"Priority: alerts must jump the queue.\"</strong> Separate queues and separate worker pools per priority, so a marketing blast cannot delay a security alert. Same bulkhead reasoning as <a class='inline' href='#/lld/concurrency-deep/async-patterns'>pool sizing</a>.",
              "<strong>\"A provider is down for an hour.\"</strong> The circuit breaker opens after a failure threshold, fails fast to the next channel, and half-opens periodically to test recovery. Without it, every notification pays four backoffs before falling back.",
              "<strong>\"How do we know it arrived?\"</strong> Providers post delivery receipts asynchronously; correlate them to the delivery log by provider id. Note that \"accepted by provider\" and \"delivered to the human\" are genuinely different states and the model should hold both."
            ]
          },
          { t: "note", variant: "key", html: "<strong>Two things vary here, so there are two abstractions: the transport and the policy.</strong> Channels send once and classify the outcome; the dispatcher owns retry, backoff, fallback ordering, and deduplication. Return a classified result rather than a boolean \u2014 without the retryable-versus-terminal distinction, no correct policy is possible \u2014 and keep a durable delivery log so retries are safe and \"did we send it?\" has an answer." },
          { t: "quiz", id: "lld-lldcases" }
        ]
      }
    ]
  };

  /* =================================================================
     MODULE 3 · PRODUCTION CASE STUDIES  (pushed onto window.TRACKS.breakdowns)
     ================================================================= */
  var MODULE_WILD = {
    id: "wild",
    name: "Production Case Studies",
    icon: "globe",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "wild-wide-column-migration",
        title: "Moving a read-heavy relational workload to a wide-column store",
        summary: "What forces the migration, why the partition key redesign is the real work, and what you give up when joins go away.",
        minutes: 10,
        tags: ["wild", "migration", "data-modelling"],
        blocks: [
          { t: "p", html: "These lessons are a different shape from the interview walkthroughs. There is no clean answer at the end \u2014 the point is the <em>class of decision</em>: what constraint forced someone's hand, what they did, what the obvious alternative would have cost, and what generalises. Read them for judgement, not for a template." },

          { t: "h", text: "The situation and the constraint" },
          { t: "p", html: "A product's core entity \u2014 call it an activity feed, a listing catalogue, a device state table \u2014 lives in a single-leader relational database. Reads are one to two orders of magnitude more frequent than writes. The team has already done everything cheap: added read replicas, added a cache, added indexes, moved reporting off the primary." },
          { t: "p", html: "The constraint that forces the change is almost never \"queries are slow\". It is usually one of three things, and it is worth being precise, because each points at a different solution:" },
          {
            t: "table",
            headers: ["Forcing constraint", "What it looks like", "Does a wide-column store fix it?"],
            rows: [
              ["<strong>Write ceiling on one leader</strong>", "Write latency climbs with volume; replication lag grows; the primary is the only thing you cannot scale by adding a machine", "Yes \u2014 this is the case it is built for"],
              ["<strong>Dataset larger than one machine</strong>", "Vertical scaling has run out; the largest instance is already in use", "Yes, though relational sharding is also a real answer"],
              ["<strong>Operational fragility of failover</strong>", "Every leader failover is a visible outage of tens of seconds", "Partly \u2014 leaderless replication removes the failover gap, at the cost of conflict handling"],
              ["<strong>One slow query pattern</strong>", "A handful of expensive reads dominate", "No \u2014 fix the query, the index, or the cache. Migrating for this is a very expensive way to avoid an EXPLAIN"]
            ]
          },
          { t: "note", variant: "warn", html: "Be suspicious of any migration whose justification is \"scale\" without a named ceiling. \"We will hit the write throughput of a single leader in nine months at current growth\" is a reason. \"NoSQL is faster\" is not, and it usually means somebody has a query plan problem they have not read." },

          { t: "h", text: "What was actually done" },
          { t: "p", html: "The engineering work turns out to be almost entirely data modelling, and almost none of it is the migration mechanics. A wide-column store partitions rows by a partition key and sorts them within the partition by clustering columns, so the physical layout <em>is</em> the query plan. You do not write a query and hope; you decide the access pattern first and store the data in the shape that serves it." },
          { t: "code", lang: "text", code:
            "RELATIONAL (ask any question later)\n" +
            "  activities(id, actor_id, target_id, kind, created_at)\n" +
            "  index on (actor_id, created_at)\n" +
            "  index on (target_id, created_at)\n" +
            "  -> new question? add an index, or join.\n" +
            "\n" +
            "WIDE-COLUMN (decide the questions first)\n" +
            "  activities_by_actor\n" +
            "     PARTITION KEY  (actor_id, bucket_month)\n" +
            "     CLUSTERING     (created_at DESC, activity_id)\n" +
            "\n" +
            "  activities_by_target                 <- a SECOND COPY of the data\n" +
            "     PARTITION KEY  (target_id, bucket_month)\n" +
            "     CLUSTERING     (created_at DESC, activity_id)\n" +
            "\n" +
            "  -> new question? a third table, and a write path that fills it.\n" +
            "\n" +
            "The bucket_month suffix exists because an unbounded partition is a\n" +
            "time bomb: one actor with millions of rows becomes a partition the\n" +
            "cluster cannot balance or compact."
          },
          {
            t: "ul", items: [
              "<strong>The partition key is chosen for spread and for bounded size</strong>, in that order. A key that concentrates traffic on one partition recreates the single-leader problem inside a distributed system, and a key with no time or hash bucket eventually produces a partition too large to compact.",
              "<strong>Every read pattern gets its own table.</strong> Denormalisation is not a compromise here; it is the model. The write path fans out to all of them.",
              "<strong>Writes become the hard part.</strong> A single logical write is now several physical writes with no transaction across them, so the write path needs idempotency keys and a repair job for partial failures.",
              "<strong>The migration itself is dual-write plus backfill plus shadow-read comparison.</strong> Write to both stores, backfill history in batches, read from both and compare for a period, then cut over reads, then stop writing to the old store. Every step is reversible except the last."
            ]
          },

          { t: "h", text: "Why the obvious alternative was rejected" },
          { t: "p", html: "The obvious alternative is sharding the relational database: keep SQL, keep transactions within a shard, split by tenant or by hash of the primary entity. Teams reject it for reasons worth understanding, because the reasons are not always good ones." },
          {
            t: "compare",
            bad: {
              title: "Bad reasons to reject relational sharding",
              items: [
                "\"Sharding is old-fashioned\"",
                "\"We would have to write a routing layer\" \u2014 you also have to write a fan-out write path",
                "\"Cross-shard queries are hard\" \u2014 cross-partition queries are harder",
                "\"The new store is managed\" \u2014 so are managed relational offerings"
              ]
            },
            good: {
              title: "Good reasons to reject relational sharding",
              items: [
                "Resharding requires a planned migration each time; the wide-column store rebalances by adding nodes",
                "Multi-region active-active writes are genuinely painful with a single leader per shard",
                "The access pattern is already key-based and the joins you would lose are already gone",
                "Failover time is a stated availability requirement and leaderless replication removes it"
              ]
            }
          },

          { t: "h", text: "What it cost" },
          {
            t: "ul", items: [
              "<strong>Ad-hoc query capability, entirely.</strong> The support engineer who could answer a question with a SQL console now files a ticket for a job. Teams usually rebuild this by streaming the same data into an analytical store, which means running two systems and reconciling them.",
              "<strong>Transactional integrity across entities.</strong> Whatever the relational model enforced with a foreign key and a transaction is now enforced by application code that can crash halfway. Every invariant that used to be free becomes a repair job.",
              "<strong>A new class of production problem.</strong> Hot partitions, tombstone accumulation from deletes, compaction storms, and the discovery that a query which is instant for most keys is a timeout for one very large one.",
              "<strong>Schema change gets slower, not faster.</strong> Adding a field is easy; changing an access pattern means a new table and a backfill of the entire dataset.",
              "<strong>Months of dual-write.</strong> During which every write path exists twice, and every bug exists in two shapes."
            ]
          },

          { t: "h", text: "What generalises" },
          {
            t: "table",
            headers: ["Tier", "How teams approach a store migration", "Outcome"],
            rows: [
              ["<strong>Naive</strong>", "Pick the store first, model the data afterwards", "You discover the access pattern you forgot after the backfill, and the partition key is already load-bearing"],
              ["<strong>Solid</strong>", "Enumerate every read pattern with its rate and latency requirement, then design partition keys against that list", "The model fits the traffic, and the questions you cannot answer are known in advance rather than discovered in an incident"],
              ["<strong>Standout</strong>", "The above, plus an explicit written answer to \"what can we no longer do, and what will we do instead?\" before any code is written", "The analytical replacement for lost ad-hoc querying is budgeted as part of the migration rather than as a surprise six months later"]
            ]
          },
          { t: "note", variant: "key", html: "<strong>A wide-column store does not make your data faster; it makes your access patterns permanent.</strong> You trade query flexibility for predictable latency and horizontal write scale, and the migration's real cost is the flexibility, not the engineering. Before any migration, write down the questions you will no longer be able to ask and how you will answer them instead \u2014 if that document is hard to write, the migration is not ready." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "wild-multiplayer-editing",
        title: "Real-time multiplayer editing in a graphical editor",
        summary: "Convergence, presence, and the latency budget that makes the obvious client-server design unusable.",
        minutes: 10,
        tags: ["wild", "realtime", "collaboration"],
        blocks: [
          { t: "h", text: "The situation and the constraint" },
          { t: "p", html: "A single-user graphical editor \u2014 a design tool, a diagram canvas, a document with layout \u2014 needs to become multiplayer. Several people edit the same file at once, see each other's cursors and selections, and never lose work. The document is not a flat string; it is a tree of objects with positions, styles, and z-order." },
          { t: "p", html: "The constraint that dominates everything is <strong>the latency budget for direct manipulation</strong>. When a user drags a shape, the shape must follow the pointer within roughly a frame. Typing must echo at the speed of the key press. Cross-continent network round trips are one to three orders of magnitude beyond that budget, and no amount of server optimisation closes the gap, because the gap is the speed of light in fibre." },
          { t: "note", variant: "warn", html: "This is the reason the obvious architecture fails, and it is worth stating precisely: it is not that the server is slow. Even a server that responds in zero time leaves you with the round trip. Any design that puts the network in front of the render loop is dead before it is written." },

          { t: "h", text: "What was actually done" },
          { t: "p", html: "Every real implementation lands on the same two-part answer, whatever the underlying algorithm. <strong>Apply locally first, reconcile afterwards.</strong> The client mutates its own copy immediately and renders; the edit is sent as an <em>operation</em>; the server or peers merge operations into a common order; each client reconciles its optimistic state with the merged truth." },
          {
            t: "ul", items: [
              "<strong>Edits become operations, not states.</strong> \"Set x to 240\" loses concurrent intent; \"move by 12\" composes. Designing the operation vocabulary is the majority of the work, and it constrains what the editor can do forever.",
              "<strong>Convergence is the guarantee.</strong> Any two clients that have applied the same set of operations must render the same document, regardless of the order they arrived in. This is what operational transformation and conflict-free replicated data types both exist to provide, by different means.",
              "<strong>Presence is a separate, lossy channel.</strong> Cursors, selections, and viewport rectangles are high-frequency and worthless once stale, so they are sent unreliably, throttled to a frame rate, and never stored. Mixing presence into the document stream is a classic way to drown the real edits.",
              "<strong>The server stays authoritative for ordering and permissions</strong> even when merging is theoretically peer-to-peer, because someone has to hold the durable copy, enforce access control, and give late joiners a snapshot.",
              "<strong>Late join is a snapshot plus a tail of operations</strong>, which means the operation log must be compactable or it grows without bound."
            ]
          },
          { t: "code", lang: "text", code:
            "NAIVE (unusable)\n" +
            "  drag frame -> server -> ack -> render\n" +
            "  every frame carries a full round trip; the shape trails the cursor\n" +
            "\n" +
            "OPTIMISTIC (what everyone ships)\n" +
            "  drag frame -> render immediately\n" +
            "              -> queue op, send async\n" +
            "  server assigns order, broadcasts\n" +
            "  client receives its own op back  -> confirm, drop from pending\n" +
            "  client receives a remote op      -> transform against pending, apply\n" +
            "\n" +
            "The pending queue is the entire complexity of the design. It is the\n" +
            "set of edits the user can see and the server has not yet confirmed."
          },

          { t: "h", text: "Why the obvious alternative was rejected" },
          {
            t: "table",
            headers: ["Alternative", "Why it is attractive", "Why it was rejected"],
            rows: [
              ["Server-authoritative, wait for the acknowledgement", "Trivially correct; one copy of the truth; no merge logic at all", "A round trip in front of every frame. Correct and unusable \u2014 the only architecture users will reject in the first ten seconds"],
              ["Pessimistic locking \u2014 check out an object before editing", "Zero merge logic; conflicts are impossible by construction", "Collaboration becomes turn-taking. Two people cannot nudge the same group, and a client that crashes holding a lock blocks the object until the lease expires"],
              ["Last-write-wins on whole objects", "Simple; a single timestamp comparison", "Concurrent edits to different properties of one shape destroy each other. One user changes the colour, another moves it, and one change silently vanishes"],
              ["Full document diff and merge on every change", "Reuses familiar version-control ideas", "Diffing a large scene graph per keystroke is far too expensive, and text-style three-way merge has no sensible answer for spatial and z-order conflicts"]
            ]
          },

          { t: "h", text: "What it cost" },
          {
            t: "ul", items: [
              "<strong>Every feature now has a concurrency design.</strong> Adding grouping, or components with overrides, or a new property means answering \"what happens when two people do this at once?\" before the feature can ship. Velocity on the editor itself drops permanently.",
              "<strong>Undo becomes genuinely hard.</strong> Users expect undo to reverse <em>their</em> last action, not the document's. That means selective undo of one user's operation from a shared history \u2014 a substantially harder problem than a stack.",
              "<strong>A whole category of unreproducible bugs.</strong> Divergence between two clients is timing-dependent and usually only visible as \"my colleague sees something different\". Teams end up building fingerprint comparison and operation-log capture just to make these reportable.",
              "<strong>Memory and metadata overhead.</strong> Conflict-free data types in particular carry per-element identity and tombstones for deleted elements, so a document that has been heavily edited can carry far more metadata than content until compaction runs.",
              "<strong>Offline editing is a much bigger ask than it looks.</strong> A client that has been offline for a day rejoins with a large divergent history, and the merge that results may be technically convergent and semantically nonsense."
            ]
          },

          { t: "h", text: "What generalises" },
          {
            t: "ul", items: [
              "<strong>Find the interaction's latency budget first, and check whether the network fits inside it.</strong> When it does not, optimism is not a shortcut, it is the only architecture available. That applies to games, cursors, autocomplete, and drag-and-drop equally.",
              "<strong>Model intent, not resulting state.</strong> An operation that says what the user meant can be merged; a snapshot of the outcome cannot. This is the same instinct as storing shares rather than balances in <a class='inline' href='#/lld/lldcases/case-splitwise'>the expense-splitting case</a>.",
              "<strong>Separate the durable channel from the ephemeral one.</strong> Presence data is high-volume and worthless when late; document operations are low-volume and must never be lost. Giving them the same delivery guarantees over-serves one and starves the other.",
              "<strong>Convergence is a weaker guarantee than correctness, and it is the right one to pick.</strong> \"Everyone ends up seeing the same thing\" is achievable and sufficient; \"the merge is what the users intended\" is not always definable, let alone achievable."
            ]
          },
          { t: "note", variant: "key", html: "<strong>When the network does not fit inside the interaction's latency budget, you must apply locally and reconcile later \u2014 and that single decision drags in operations, convergence, a pending queue, and a permanent tax on every future feature.</strong> Take it deliberately, with the cost written down, rather than discovering it three features in." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "wild-inventory-consistency",
        title: "Inventory correctness during a flash sale",
        summary: "Reservation semantics, the oversell trade-off, and the narrow places where strict consistency is worth its price.",
        minutes: 10,
        tags: ["wild", "consistency", "commerce"],
        blocks: [
          { t: "h", text: "The situation and the constraint" },
          { t: "p", html: "A commerce platform sells a limited-stock item at an announced time. Traffic goes from steady to hundreds of times steady in seconds, concentrated on <em>one</em> item \u2014 which means every request contends on the same row, the same key, the same partition. The catalogue is distributed and replicated across regions; the stock count is a single number that many services want to read and one flow must decrement." },
          { t: "p", html: "Two constraints pull in opposite directions, which is what makes this a design problem rather than a database question:" },
          {
            t: "stat", items: [
              { v: "One key", k: "all contention lands here" },
              { v: "~0 ms", k: "budget for the add-to-cart response" },
              { v: "0", k: "acceptable silent oversell on a serial-numbered item" }
            ]
          },
          { t: "note", variant: "trap", html: "The naive bug is the one everyone writes once: read the stock, check it is greater than zero, then decrement. Between the read and the decrement, a thousand other requests did the same. This is exactly <a class='inline' href='#/lld/concurrency-deep/threads-and-state'>the read-modify-write race</a> from the concurrency module, except the interleaving happens across machines, so no local lock can help." },

          { t: "h", text: "What was actually done" },
          { t: "p", html: "The unifying idea is the <strong>reservation</strong>: turn \"check, then buy\" into a single atomic claim with an expiry. A reservation is a short-lived hold on one unit, created by one conditional operation, converted to an order on payment, and released automatically if checkout does not complete." },
          { t: "code", lang: "text", code:
            "BROKEN                              RESERVED\n" +
            "  read available                      atomic claim:\n" +
            "  if available > 0:                     decrement available\n" +
            "      decrement                         and create hold(order, ttl)\n" +
            "      create order                      IF available > 0\n" +
            "  ^ two round trips, a race           ^ one operation, no gap\n" +
            "    between them                        the store enforces the check\n" +
            "\n" +
            "Lifecycle:\n" +
            "  HELD --(payment captured)--> CONFIRMED\n" +
            "       --(user abandons)-----> EXPIRED   -> stock returns\n" +
            "       --(explicit cancel)---> RELEASED  -> stock returns\n" +
            "\n" +
            "Expiry must be enforced by a sweeper, not only by a TTL read,\n" +
            "or abandoned carts silently hold stock nobody can buy."
          },
          {
            t: "ul", items: [
              "<strong>The claim is one conditional write</strong>, whatever the store: a conditional update, a compare-and-set, an atomic decrement with a floor, or a transaction on a single row. The critical property is that the check and the decrement cannot be separated.",
              "<strong>Hot-key contention is handled by splitting the counter, not by locking harder.</strong> One thousand units becomes twenty buckets of fifty; a request claims from a bucket chosen by hash, and falls through to other buckets when its own is empty. This is <a class='inline' href='#/lld/concurrency-deep/locks-and-deadlock'>lock striping</a> applied to a distributed counter, with the same weakness: uneven drain means a request can see \"sold out\" while stock remains elsewhere, so the fall-through path matters.",
              "<strong>A queue in front of the sale converts contention into a line.</strong> Admitting a bounded number of shoppers per second to the purchase path turns an unbounded contention problem into a throughput problem, and gives users a comprehensible experience instead of a random error.",
              "<strong>Reads are deliberately not consistent.</strong> The catalogue page shows a cached, possibly stale count. Only the claim is strongly consistent. This is the central trade: pay for consistency on one operation, not on the millions of reads around it.",
              "<strong>Payment and reservation are separate state machines linked by an idempotency key</strong>, so a retried checkout cannot create a second hold \u2014 the same structure as <a class='inline' href='#/lld/practice/case-idempotent-workflow'>the idempotent workflow case</a>."
            ]
          },

          { t: "h", text: "Why the obvious alternative was rejected" },
          {
            t: "table",
            headers: ["Alternative", "Why it is attractive", "Why it loses"],
            rows: [
              ["A distributed lock around the item", "Conceptually familiar; mirrors the single-process solution", "Adds a network round trip inside the critical section, and lock lease expiry under load produces two holders of the same lock \u2014 the exact bug you were preventing"],
              ["A strongly consistent transaction across the whole checkout", "Correct by construction; one mental model", "Serialises the entire flow on one row, including payment latency. Throughput collapses to roughly one purchase per transaction duration, and a slow payment provider becomes a stock outage"],
              ["Eventually consistent decrement, reconcile later", "Fastest possible write path; scales trivially", "Guarantees oversell proportional to replication lag times request rate. Acceptable for a warehouse with a thousand fungible units, unacceptable for ten numbered tickets"],
              ["Pre-allocate every unit to a queue slot up front", "No contention at all at sale time", "Requires knowing demand in advance and handles abandonment badly; unclaimed slots are dead stock unless you build the recycling path anyway"]
            ]
          },

          { t: "h", text: "What it cost" },
          {
            t: "ul", items: [
              "<strong>Oversell does not go to zero; it goes to bounded and deliberate.</strong> Most platforms accept a small oversell probability on fungible goods and handle it commercially \u2014 a refund and an apology cost less than the throughput that eliminating it would have cost. Zero-oversell is reserved for goods where a duplicate is a legal or physical impossibility, like a numbered seat.",
              "<strong>A whole reservation lifecycle to operate.</strong> Sweepers, expiry, orphaned holds, the day the sweeper is down and stock silently disappears from sale. This subsystem needs monitoring in its own right.",
              "<strong>Confusing user experiences.</strong> Stock shows available on the page and fails at checkout, because reads are stale by design. That is a product decision that needs product sign-off, not a bug to be fixed by an engineer.",
              "<strong>Bucketed counters need rebalancing.</strong> Uneven drain means one bucket empties while others hold stock; without fall-through and periodic rebalancing you report sold-out with inventory in hand.",
              "<strong>Reconciliation becomes permanent work.</strong> Somebody has to compare physical stock, reservations, and orders on a schedule and explain the differences."
            ]
          },

          { t: "h", text: "What generalises" },
          {
            t: "table",
            headers: ["Tier", "Approach to a contended invariant", "Outcome"],
            rows: [
              ["<strong>Naive</strong>", "Make everything strongly consistent because correctness matters", "Throughput collapses on the hot key and the sale fails for everyone, including the people you were protecting"],
              ["<strong>Naive</strong>", "Make everything eventually consistent because scale matters", "Oversell scales with traffic, and the commercial cost arrives exactly when volume is highest"],
              ["<strong>Solid</strong>", "Identify the single operation that must be atomic and pay for consistency only there", "Reads stay cheap and cached; one narrow write path carries the guarantee"],
              ["<strong>Standout</strong>", "The above, plus an explicit, agreed policy for what happens when the guarantee is breached anyway", "The system has a defined behaviour under failure instead of an incident, and the business has priced the residual risk on purpose"]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Consistency is bought per operation, not per system.</strong> Find the one place where the invariant actually lives \u2014 here, the claim on a unit \u2014 make that a single atomic conditional write with an expiry, and let everything around it be stale and cheap. Then decide out loud what you will do when you oversell anyway, because at sufficient scale you will." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "wild-job-queue-at-scale",
        title: "Running an enormous asynchronous job queue",
        summary: "Tenant fairness, poison messages, and why the operational tooling mattered more than which broker was chosen.",
        minutes: 10,
        tags: ["wild", "queues", "operations"],
        blocks: [
          { t: "h", text: "The situation and the constraint" },
          { t: "p", html: "A platform runs asynchronous work on behalf of many tenants: rendering exports, sending campaigns, recomputing derived data, running scheduled imports. Job durations span four orders of magnitude \u2014 milliseconds to hours. Volume is bursty and correlated, because tenants schedule things on the hour. Every job must eventually run, and the queue must never become the reason a tenant's product looks broken." },
          { t: "p", html: "The forcing constraint is not throughput. Brokers are fast and every mainstream one will move more messages than the workers can process. The constraint is <strong>isolation</strong>: one tenant, one job type, or one bad message must not be able to consume the shared capacity that everyone else depends on." },

          { t: "h", text: "What was actually done" },
          {
            t: "ul", items: [
              "<strong>Queues split by workload shape, not by team.</strong> Long jobs and short jobs get separate queues and separate worker pools, because a single slow job class fills every worker slot and short jobs queue behind it. This is bulkheading, and it is the same reasoning as <a class='inline' href='#/lld/concurrency-deep/async-patterns'>giving each dependency its own thread pool</a>.",
              "<strong>Fairness enforced by scheduling, not by hope.</strong> Round-robin across tenants with per-tenant concurrency caps, so the tenant that enqueued a hundred thousand jobs at nine in the morning gets a fixed share rather than the whole cluster. Weighted fair queueing where tenants have different tiers.",
              "<strong>Attempt caps and a dead-letter destination on every consumer, without exception.</strong> A message that crashes its consumer is redelivered forever under at-least-once semantics, and in an ordered or partitioned queue it blocks everything behind it. Cap attempts, move it aside, alert, continue.",
              "<strong>Jobs designed to be idempotent and re-runnable</strong>, because at-least-once delivery means every job will occasionally run twice. The job carries a key, checks whether its effect already exists, and exits cleanly.",
              "<strong>Visibility timeouts sized to the job, with heartbeats for long ones.</strong> A job that takes longer than its visibility timeout gets redelivered while still running, so two workers do the same work \u2014 and if it is not idempotent, they corrupt each other.",
              "<strong>Payloads are references, not documents.</strong> The message carries an id; the worker fetches the data. Large payloads make the broker a database it was not designed to be, and make redelivery expensive."
            ]
          },
          { t: "code", lang: "text", code:
            "Per-message state, as the operator sees it\n" +
            "-----------------------------------------\n" +
            "  ENQUEUED -> LEASED -> DONE\n" +
            "                 |\n" +
            "                 +-> lease expired (crash / timeout) -> ENQUEUED\n" +
            "                 +-> failed, attempts < max -> DELAYED -> ENQUEUED\n" +
            "                 +-> failed, attempts = max -> DEAD_LETTER\n" +
            "\n" +
            "The four numbers that actually predict an incident\n" +
            "-------------------------------------------------\n" +
            "  oldest message age      -- backlog in TIME, not in count\n" +
            "  per-tenant in-flight    -- who is eating the shared capacity\n" +
            "  redelivery rate         -- crashes and lease expiries, rising early\n" +
            "  dead-letter arrival rate-- new poison classes appearing"
          },
          { t: "note", variant: "tip", html: "Queue <em>depth</em> is a famously bad primary alert. A depth of one million is fine if it drains in a minute, and a depth of two hundred is an incident if the consumer is dead. <strong>Oldest message age</strong> is the metric that maps to what a user experiences, and it catches a stalled consumer immediately whereas depth catches it only after it accumulates." },

          { t: "h", text: "Why the obvious alternative was rejected" },
          {
            t: "table",
            headers: ["Alternative", "Why it is attractive", "Why it loses"],
            rows: [
              ["One big queue, add workers when it backs up", "Simplest possible operation; maximum pooling of capacity", "No isolation whatsoever. One tenant's burst or one slow job class becomes everyone's latency, and adding workers just gives the noisy tenant more of them"],
              ["A queue per tenant", "Perfect isolation, trivially explained", "Thousands of mostly-idle queues; per-queue overhead and connection cost dominate; capacity cannot be shared with the tenants who actually need it right now"],
              ["Switch brokers to fix a backlog", "Feels like a decisive fix, and the new broker's benchmarks look better", "The backlog is almost always consumer throughput, fairness, or a poison message. A migration relocates the problem and costs a quarter"],
              ["Unbounded retries so nothing is ever lost", "Sounds like the safe, conservative choice", "Converts a single bad message into permanent capacity loss, and in an ordered partition into a total stall. Losing a message to a dead-letter queue is recoverable; stalling the pipeline is not"]
            ]
          },

          { t: "h", text: "What it cost" },
          {
            t: "ul", items: [
              "<strong>The scheduler became a real system.</strong> Fair queueing with per-tenant caps and priorities is not a config flag; it is code with its own bugs, its own tests, and its own on-call surprises.",
              "<strong>Idempotency is a tax on every job author.</strong> Every new job type must be written to tolerate running twice, and code review has to enforce it, because the failure only appears under redelivery.",
              "<strong>Dead-letter queues need an owner or they become a graveyard.</strong> Without a triage rotation and a bulk replay tool, they silently accumulate real customer work that nobody ever runs.",
              "<strong>Debugging is genuinely harder.</strong> Answering \"what happened to this one job?\" needs correlation ids threaded through enqueue, lease, retry, and completion, and that has to be built deliberately.",
              "<strong>Capacity planning gained a dimension.</strong> You now size for concurrency per class and per tenant, not just aggregate throughput."
            ]
          },

          { t: "h", text: "What generalises" },
          {
            t: "compare",
            bad: {
              title: "Where teams spend the effort",
              items: [
                "Comparing broker benchmarks",
                "Tuning prefetch and batch sizes",
                "Arguing about exactly-once semantics",
                "Building a dashboard of queue depth"
              ]
            },
            good: {
              title: "Where the effort actually pays",
              items: [
                "Fairness and per-tenant caps",
                "Attempt caps, dead-letter routing, and a replay tool",
                "Idempotent jobs, which make at-least-once sufficient",
                "Alerting on oldest message age and redelivery rate"
              ]
            }
          },
          { t: "p", html: "The generalisable claim is uncomfortable and reliably true: <strong>the queue technology is rarely the differentiator, and the tooling around it always is.</strong> Two teams on identical brokers will have wildly different operational experiences depending on whether they can answer \"whose jobs are these, why are they retrying, and can I replay these two hundred safely?\" without writing a script." },
          { t: "note", variant: "key", html: "<strong>At-least-once delivery is the only guarantee you will actually get, so make jobs idempotent and stop trying to buy exactly-once.</strong> Then spend your design budget on isolation \u2014 separate queues per workload shape, per-tenant concurrency caps, attempt limits with a dead-letter path \u2014 and alert on oldest message age rather than depth. The broker choice matters far less than any of these." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "wild-data-lake-cost",
        title: "Taming an analytics data lake",
        summary: "Partitioning gone wrong, the small-files pathology, and treating cost as a first-class design constraint.",
        minutes: 11,
        tags: ["wild", "data", "cost"],
        blocks: [
          { t: "h", text: "The situation and the constraint" },
          { t: "p", html: "An analytics platform accumulates events in object storage, queried by an engine that scans files. It began as \"just write the events, we will figure out queries later\", which is the correct decision at the start and a liability by year two. Now dashboards are slow, the query bill is a line item somebody senior is asking about, and nobody can explain why a query over one day of data reads for four minutes." },
          { t: "p", html: "The constraint here is unusual and worth noticing: <strong>nothing is broken</strong>. Every query returns the right answer. The forcing function is entirely economic and operational, which means there is no incident to justify the work and it has to be argued for on its merits." },

          { t: "h", text: "What was actually done" },
          { t: "p", html: "Three problems, all of which are layout problems rather than engine problems." },
          {
            t: "table",
            headers: ["Pathology", "How it happened", "The fix"],
            rows: [
              ["<strong>Small files</strong>", "Streaming writers commit every minute, producing thousands of one-to-five-megabyte files per partition per day", "Compact on a schedule into files in the hundreds of megabytes; let the streaming path stay small and let a background job merge"],
              ["<strong>Over-partitioning</strong>", "Partitioning by date <em>and</em> tenant <em>and</em> event type produces millions of directories, most holding a single tiny file", "Partition on the low-cardinality columns queries actually filter on \u2014 usually date, sometimes one more. Use sorting and file-level statistics for the rest"],
              ["<strong>Under-partitioning</strong>", "Everything in one prefix, so every query is a full scan", "Partition by the time column that appears in nearly every predicate; that alone often removes most of the bytes scanned"],
              ["<strong>Row-oriented storage</strong>", "Events written as JSON lines because that is what the producer emitted", "Columnar format with compression: a query touching three of forty columns reads three, and compresses far better because each column is homogeneous"]
            ]
          },
          { t: "p", html: "The small-files problem deserves its own explanation because the arithmetic is counter-intuitive. The <em>bytes</em> are the same either way. What changes is the per-file overhead, and at high file counts that overhead is the whole query." },
          { t: "code", lang: "text", code:
            "Same 20 GB of data, two layouts\n" +
            "-------------------------------\n" +
            "  A) 10,000 files x 2 MB     B) 100 files x 200 MB\n" +
            "\n" +
            "     10,000 list entries         100 list entries\n" +
            "     10,000 opens                100 opens\n" +
            "     10,000 footer reads         100 footer reads\n" +
            "     10,000 scheduled tasks      100 scheduled tasks\n" +
            "\n" +
            "  Real scan work is identical. Overhead is 100x.\n" +
            "  Worse: with few rows per file, column statistics stop being\n" +
            "  selective, so file-level pruning cannot skip anything either.\n" +
            "\n" +
            "  Cost model to hold in your head:\n" +
            "     query cost ~ bytes scanned + per-file overhead x file count\n" +
            "  Partitioning attacks the first term. Compaction attacks the second.\n" +
            "  Doing only one of them is why a 'partitioned' lake is still slow."
          },
          {
            t: "ul", items: [
              "<strong>A table format on top of the files</strong> \u2014 one that maintains a manifest with per-file statistics \u2014 replaces directory listing with a metadata read, and makes compaction and schema evolution safe to run while queries are live. This is usually the single highest-leverage change.",
              "<strong>Tiering by age.</strong> Recent data is hot, small, and frequently queried; data older than a quarter is scanned rarely. Move it to colder storage with a lifecycle rule and accept the higher retrieval latency.",
              "<strong>Retention that actually deletes.</strong> Most lakes hold data nobody has queried in a year because deleting felt risky. Query-access logs turn that from a judgement call into a fact.",
              "<strong>Cost attribution per team and per query.</strong> Not to punish anyone \u2014 because until a dashboard owner can see that their auto-refreshing panel scans a terabyte an hour, they have no reason to change it."
            ]
          },

          { t: "h", text: "Why the obvious alternative was rejected" },
          {
            t: "table",
            headers: ["Alternative", "Why it is attractive", "Why it loses"],
            rows: [
              ["Buy a bigger cluster / more query capacity", "One purchase order, no engineering time, immediate relief", "Pays the overhead faster rather than removing it. The cost curve keeps its slope, and the problem returns at a higher baseline"],
              ["Move everything into a warehouse", "Excellent performance; someone else owns the layout problem", "Loading and storage costs at lake scale are substantial, and you lose the ability to keep raw, schema-flexible data. Most teams end up doing this for the curated subset only \u2014 which is the right answer, but it is not \"everything\""],
              ["Aggressive caching of query results", "Cheap to add; helps repeated dashboard loads immediately", "Helps only the repeated queries. Exploratory and ad-hoc work, which is why the lake exists, is unaffected"],
              ["Rewrite the ingestion path to write large files directly", "Removes compaction entirely; conceptually clean", "Directly conflicts with freshness \u2014 large files mean buffering for a long time before committing. Separating fast small writes from background compaction is what lets you have both"]
            ]
          },

          { t: "h", text: "What it cost" },
          {
            t: "ul", items: [
              "<strong>Compaction is a permanent background job</strong> with its own compute bill, its own failure modes, and its own interaction with readers. It is cheaper than the queries it saves, but it is not free and it never finishes.",
              "<strong>Repartitioning historical data is a full rewrite.</strong> Getting the partition scheme wrong is expensive to correct, which is exactly why it deserves thought at the start rather than after the first slow dashboard.",
              "<strong>The table format is a dependency.</strong> Every engine and tool that reads the lake must understand it, and the ones that do not now need an export path.",
              "<strong>Retention conversations are political.</strong> \"We are deleting data\" triggers an organisational immune response, and the work is as much about producing evidence of non-use as it is about lifecycle rules.",
              "<strong>Someone must own it.</strong> A lake with no owner regresses within two quarters, because every new pipeline reintroduces small files by default."
            ]
          },

          { t: "h", text: "What generalises" },
          {
            t: "table",
            headers: ["Tier", "How cost is treated", "Outcome"],
            rows: [
              ["<strong>Naive</strong>", "Cost is finance's problem; engineering optimises for latency and correctness only", "The bill grows superlinearly with usage and eventually forces a rushed migration under budget pressure"],
              ["<strong>Solid</strong>", "Cost is monitored, attributed to teams, and reviewed periodically", "Bad patterns get caught within a quarter and the people who can fix them can see them"],
              ["<strong>Standout</strong>", "Cost per query and per pipeline is a design-review criterion, with layout decisions justified against it before data is written", "Layout matches access patterns from the beginning, and the expensive rewrite never has to happen"]
            ]
          },
          { t: "p", html: "The thread running through all five of these lessons is the same one, and it is worth stating plainly now that you have seen it five times. Every one of these teams hit a constraint that made the comfortable design untenable \u2014 a write ceiling, the speed of light, a contended row, a shared worker pool, a bill \u2014 and every one of them responded by <em>giving something up on purpose</em>: ad-hoc queries, simple correctness, strict consistency everywhere, exactly-once semantics, storage flexibility. None of them found a design with no downside, because there is not one." },
          { t: "p", html: "What separates the good outcomes from the bad ones is not cleverness. It is whether the team wrote the cost down before they paid it. The teams that enumerated what they were losing built the replacement into the plan; the teams that did not discovered it in an incident, a support ticket, or an invoice. When you design, the deliverable is not the diagram \u2014 it is the diagram plus the sentence explaining what it costs. Take that habit back into <a class='inline' href='#/lld/practice/lld-process'>your own class designs</a>, where the same discipline is what turns a walkthrough into an argument." },
          { t: "note", variant: "key", html: "<strong>Design is choosing which problem to have, and the deliverable is the trade-off, not the diagram.</strong> Across all five of these \u2014 the migration, the collaborative editor, the flash sale, the job queue, and the lake \u2014 the teams that did well were the ones who named what they were giving up, budgeted the replacement, and could say it out loud. That sentence is also, not coincidentally, the one that gets you hired." },
          { t: "quiz", id: "breakdowns-wild" }
        ]
      }
    ]
  };

  /* =================================================================
     REGISTRATION — push only, never redefine a track
     ================================================================= */
  window.TRACKS = window.TRACKS || {};

  /* 1) two modules onto the existing lld track (registered by curriculum-lld.js) */
  var L = window.TRACKS.lld;
  if (L && L.modules) L.modules.push(MODULE_CONCURRENCY, MODULE_CASES);

  /* 2) one module onto the breakdowns track (registered by a sibling author) */
  var B = window.TRACKS.breakdowns || (window.TRACKS.breakdowns = { id: "breakdowns", modules: [] });
  B.modules = B.modules || [];
  B.modules.push(MODULE_WILD);
})();
