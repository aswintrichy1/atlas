/* =====================================================================
   PYXIS · Profiling & Performance
   window.TRACKS.perf — modules: measure / speed
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     complexityLab — orders of magnitude for common choices
  ================================================================== */
  var PATTERNS = {
    member: {
      label: "Membership test",
      a: { name: "x in big_list", big: "O(n)", ns: function (n) { return 12 * n; } },
      b: { name: "x in big_set", big: "O(1) average", ns: function () { return 40; } },
      note: "A list scans element by element; a set hashes once and jumps to a bucket. Converting once to a set pays off after a handful of lookups."
    },
    front: {
      label: "Insert at the front",
      a: { name: "lst.insert(0, x)", big: "O(n)", ns: function (n) { return 30 + 0.4 * n; } },
      b: { name: "dq.appendleft(x)", big: "O(1)", ns: function () { return 35; } },
      note: "list.insert(0) shifts every pointer one slot along. A deque links fixed-size blocks, so both ends are cheap."
    },
    sorted: {
      label: "Search sorted data",
      a: { name: "linear scan", big: "O(n)", ns: function (n) { return 12 * n; } },
      b: { name: "bisect.bisect_left", big: "O(log n)", ns: function (n) { return 60 * Math.max(1, Math.log(n) / Math.LN2); } },
      note: "Once data is sorted, binary search needs about 20 comparisons for a million items instead of up to a million."
    }
  };
  function human(ns) {
    if (ns < 1000) return K.fmt(ns, 0) + " ns";
    if (ns < 1e6) return K.fmt(ns / 1000, 1) + " \u00b5s";
    if (ns < 1e9) return K.fmt(ns / 1e6, 1) + " ms";
    return K.fmt(ns / 1e9, 2) + " s";
  }

  Widgets.complexityLab = function (mount) {
    K.shell(mount, "cost model", "Big-O you can feel",
      "Pick a pattern and a data size. The lab estimates the cost of 1,000 operations for each implementation, using rough CPython constants. Orders of magnitude, not benchmarks: measure your own code.");
    var pat = "member", exp = 5;
    var ctl = h("div", { class: "w-stage", style: "display:flex;gap:12px;flex-wrap:wrap;align-items:center" });
    var bars = h("div", { class: "w-stage", style: "display:grid;gap:8px" });
    var readout = h("div", { class: "w-readout" });
    var nLabel = h("b", {}, "");
    function bar(impl, total, max, strong) {
      var pct = Math.max(1, Math.round(Math.log(1 + total) / Math.log(1 + max) * 100));
      return h("div", { style: "display:grid;grid-template-columns:150px 1fr 90px;gap:8px;align-items:center;font-size:0.8rem;color:var(--text)" },
        h("code", { class: "tok" }, impl.name),
        h("div", { style: "height:12px;border-radius:6px;background:var(--surface-2);overflow:hidden" },
          h("div", { style: "height:100%;width:" + pct + "%;background:" + (strong ? "var(--accent)" : "var(--rose)") })),
        h("span", { style: "font-family:var(--font-mono)" }, human(total)));
    }
    function paint() {
      var p = PATTERNS[pat], n = Math.pow(10, exp);
      nLabel.textContent = K.fmt(n, 0);
      var ta = p.a.ns(n) * 1000, tb = p.b.ns(n) * 1000, max = Math.max(ta, tb);
      K.clear(bars);
      bars.appendChild(bar(p.a, ta, max, false));
      bars.appendChild(bar(p.b, tb, max, true));
      bars.appendChild(h("div", { style: "font-size:0.74rem;color:var(--text-dim)" }, "bar length on a log scale"));
      K.clear(readout);
      readout.appendChild(K.ro("pattern", p.label));
      readout.appendChild(K.ro("n", K.fmt(n, 0)));
      readout.appendChild(K.ro(p.a.name, p.a.big));
      readout.appendChild(K.ro(p.b.name, p.b.big));
      readout.appendChild(K.ro("ratio", K.fmt(ta / tb, 0) + "\u00d7"));
      readout.appendChild(K.wide(p.note));
    }
    ctl.appendChild(K.segment(Object.keys(PATTERNS).map(function (k) { return [k, PATTERNS[k].label]; }), 0, function (v) { pat = v; paint(); }));
    ctl.appendChild(K.labeled("size 10^k", K.range(2, 7, 1, exp, function (v) { exp = v; paint(); })));
    ctl.appendChild(h("span", { style: "font-size:0.82rem;color:var(--text-dim)" }, "n = ", nLabel));
    mount.appendChild(ctl);
    mount.appendChild(bars);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "perf-measure": {
      title: "Measuring performance checkpoint",
      sub: "Budgets, profilers, benchmarks and memory.",
      questions: [
        {
          q: "An endpoint is slow in production. What is the best first step?",
          options: ["Measure: get a profile or trace of the slow path under realistic load before changing code","Rewrite the hot loop in Rust","Add caching everywhere","Upgrade the server"],
          answer: 0,
          explain: "Intuition about bottlenecks is wrong surprisingly often; the time is frequently in a query, a serialisation step or a network call rather than the loop you suspected. Profile first so the fix targets the actual cost."
        },
        {
          q: "When is a sampling profiler such as py-spy preferable to cProfile?",
          options: ["Never","Only for C extensions","When you need exact call counts","For production or long-running processes: it attaches to a live PID with low overhead and does not require code changes"],
          answer: 3,
          explain: "cProfile instruments every call, which adds overhead and distorts tiny functions. Sampling reads stacks periodically, so it is cheap enough to point at a busy production process and produce a flame graph."
        },
        {
          q: "In a flame graph, what does a wide bar near the top of a stack mean?",
          options: ["That function was called many times","It used a lot of memory","That function itself (its own code, not just its callees) appears in a large share of samples, so it is where time is spent","It raised exceptions"],
          answer: 2,
          explain: "Width is proportion of samples. A wide frame with no wide children is self time: the most direct optimisation target. Order left to right is not time order."
        },
        {
          q: "Why does timeit report the best of several repeats instead of the mean?",
          options: ["To flatter results","Noise from other processes only ever makes runs slower, so the minimum is the best estimate of the code's own cost","The mean is hard to compute","It does not; it reports the median"],
          answer: 1,
          explain: "For microbenchmarks, interference is additive. The minimum approximates the undisturbed cost. For whole-system latency you care about distributions and percentiles instead."
        },
        {
          q: "What does tracemalloc help you find?",
          options: ["CPU hot spots","Which lines allocated the Python memory that is still alive, and how that changes between two snapshots","Network latency","GIL contention"],
          answer: 1,
          explain: "Comparing snapshots before and after a suspect operation shows which call sites grew. Native allocations made by C libraries need a tool such as memray."
        },
        {
          q: "Approximately how much memory can __slots__ save on a class with a million small instances?",
          options: ["A substantial amount, because instances no longer carry a per-instance __dict__","None","It only saves CPU","It doubles memory"],
          answer: 0,
          explain: "Each regular instance has a dictionary for its attributes. Slots store attributes in a fixed layout instead, which typically cuts per-instance size significantly and speeds attribute access slightly."
        }
      ]
    },
    "perf-speed": {
      title: "Making Python faster checkpoint",
      sub: "Data structures, vectorisation, caching and native code.",
      questions: [
        {
          q: "A loop does if item in seen: where seen is a list of 100,000 IDs. What is the simplest big win?",
          options: ["Use a while loop","Sort the list each time","Use multiprocessing","Make seen a set, turning each O(n) scan into an average O(1) hash lookup"],
          answer: 3,
          explain: "Algorithmic fixes beat micro-optimisations by orders of magnitude. A set lookup costs about the same at 100 or 100 million items."
        },
        {
          q: "Why is total = (prices * qty).sum() on NumPy arrays much faster than a Python for-loop?",
          options: ["NumPy uses the GPU","Python loops are disabled","The loop runs in compiled code over contiguous typed memory, avoiding per-element interpreter overhead and boxing","It caches results"],
          answer: 2,
          explain: "Each Python iteration pays for bytecode dispatch and boxed objects. Vectorised operations do the arithmetic in C over raw buffers, often 10 to 100 times faster."
        },
        {
          q: "What is the risk of @functools.lru_cache on an instance method?",
          options: ["It is not allowed","It makes calls slower","The cache holds references to self in its keys, keeping instances alive for the cache's lifetime and sharing one cache across all instances","It only caches the first call"],
          answer: 2,
          explain: "The method's self argument becomes part of the cache key, so the cache retains every instance it saw. Cache at module level on explicit keys, use cached_property, or a per-instance cache."
        },
        {
          q: "Which statement about caching is most important for correctness?",
          options: ["Caches should be as large as possible","Every cache needs an invalidation or expiry story: what makes an entry stale and when it is removed","Caches remove the need for databases","lru_cache is thread-unsafe"],
          answer: 1,
          explain: "A cache trades freshness for speed. Without a defined TTL, version key or explicit invalidation, you will eventually serve wrong data, which is worse than slow data."
        },
        {
          q: "When is moving a hot function to Rust (PyO3) or Cython justified?",
          options: ["After profiling shows a CPU-bound pure-Python hot spot that algorithmic and vectorised fixes cannot address, and the build complexity is acceptable","As a first step","Whenever code is slow","Only for I/O-bound code"],
          answer: 0,
          explain: "Native extensions add a toolchain, platform wheels and a second language to maintain. They pay off for tight CPU loops; they do nothing for code waiting on a database."
        },
        {
          q: "A service spends 80% of request time waiting on a database. Which optimisation is least useful?",
          options: ["Fixing an N+1 query pattern","Adding an index","Batching queries","Rewriting the request handler's Python in C"],
          answer: 3,
          explain: "Amdahl's law: speeding up the 20% of time spent in Python at best saves 20%. The waits dominate, so query shape, indexes and batching matter far more."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.perf = {
    id: "perf",
    name: "Profiling & Performance",
    short: "PERF",
    tagline: "Measure, then make it fast",
    color: "#f472b6",
    blurb: "Performance budgets and Amdahl's law, cProfile and sampling profilers with flame graphs, honest microbenchmarks, memory profiling and __slots__, then the cost model of built-ins, NumPy vectorisation, caching with invalidation, and when native code is worth it.",
    modules: [
      {
        id: "measure",
        name: "Measure first",
        icon: "trend",
        lessons: [
          L("perf-mindset", "Performance mindset and budgets", "Define what fast enough means, find where time actually goes, and remember that the part you do not speed up limits the whole.", 7, ["budgets", "amdahl", "latency"], [
            B.p("Performance work starts with a <strong>target</strong>, not a hunch: \"p99 under 300 ms at 500 requests per second\" or \"nightly job under 20 minutes\". Without a target you cannot tell when to stop, and you will optimise whatever is most interesting rather than what matters."),
            B.table(["Step", "Question", "Tool"], [
              ["1. Budget", "What latency or throughput is required, and at which percentile?", "SLOs, product requirements"],
              ["2. Observe", "Where does time go in production?", "Tracing, metrics, sampling profiler"],
              ["3. Reproduce", "Can I make it slow on demand?", "A benchmark or load test with realistic data"],
              ["4. Change one thing", "Did that change move the number?", "Before/after measurements"],
              ["5. Guard", "Will it stay fast?", "Performance tests or alerts in CI and production"]
            ]),
            B.code("text", [
              "Amdahl's law: overall speed-up = 1 / ((1 - p) + p / s)",
              "  p = fraction of time in the part you improve",
              "  s = how much faster that part becomes",
              "",
              "Request: 80% DB wait, 20% Python",
              "Make the Python 10x faster: 1 / (0.8 + 0.02) = 1.22x overall",
              "Halve the DB wait:          1 / (0.4 + 0.2)  = 1.67x overall"
            ]),
            B.stat([["~0.1 \u00b5s", "Python function call"], ["~0.1\u20131 ms", "same-region network round trip"], ["~1\u201310 ms", "typical indexed DB query"]]),
            B.tip("Latency is a distribution. Report p50, p95 and p99, not the average: a mean of 50 ms can hide a p99 of 2 seconds that every heavy user feels."),
            B.cue("<strong>Interview cue:</strong> before proposing any optimisation, ask for the target and the breakdown. \"Which percentile, at what load, and where is the time today?\""),
            B.key("<strong>No target, no optimisation.</strong> Set a budget, measure the breakdown, and spend effort where Amdahl's law says it will move the total.")
          ]),
          L("cprofile", "cProfile, py-spy and flame graphs", "Deterministic profiling for local deep dives, sampling profilers for production, and flame graphs to read either at a glance.", 9, ["cprofile", "py-spy", "flamegraph"], [
            B.p("A <strong>deterministic</strong> profiler such as <code class='tok'>cProfile</code> hooks every function call and return, giving exact call counts but adding overhead that inflates small functions. A <strong>sampling</strong> profiler such as <code class='tok'>py-spy</code> reads the stack many times per second from outside the process: low overhead, no code changes, safe for production."),
            B.code("bash", [
              "python -m cProfile -o out.prof -m billing.jobs.reconcile",
              "python -c \"import pstats; pstats.Stats('out.prof').sort_stats('cumulative').print_stats(15)\"",
              "",
              "py-spy top --pid 4242                       # live 'top' for Python functions",
              "py-spy record -o flame.svg --pid 4242 --duration 30",
              "py-spy dump --pid 4242                      # where is every thread right now?"
            ]),
            B.table(["Column (pstats)", "Meaning"], [
              ["ncalls", "Number of calls (primitive/total for recursion)"],
              ["tottime", "Time in the function itself, excluding callees"],
              ["cumtime", "Time in the function including everything it called"],
              ["percall", "tottime or cumtime divided by calls"]
            ]),
            B.p("Reading a <strong>flame graph</strong>: each box is a stack frame, width is the share of samples, and children sit above their callers. Look for wide plateaus: frames that are wide themselves but have no wide children. That is self time, the most direct target. Left-to-right order is alphabetical or arbitrary, not chronological."),
            B.warn("Profile with realistic data and configuration. A profile of a test fixture with ten rows will tell you about import time and framework overhead, not the N+1 query that dominates at ten thousand rows."),
            B.tip("<code class='tok'>py-spy dump</code> on a hung process is a superb debugging tool: it shows exactly which line every thread is waiting on, including deadlocks and stuck network calls."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"CPU is at 100% in production and we do not know why\". Attach a sampling profiler to one pod for 30 seconds and read the flame graph."),
            B.key("<strong>cProfile to count, sampling to find.</strong> Read flame graphs for wide self-time plateaus, and profile with production-sized data.")
          ]),
          L("timeit-benchmarks", "Microbenchmarks done right", "timeit for tiny comparisons, pyperf for stable numbers, and the discipline that keeps benchmarks from lying.", 7, ["timeit", "pyperf", "benchmarks"], [
            B.p("Microbenchmarks answer narrow questions: is approach A faster than B for this input? They are easy to get wrong because CPU frequency scaling, caches, background processes and the interpreter's own warm-up all add noise."),
            B.code("bash", [
              "python -m timeit -s \"xs = list(range(10_000)); s = set(xs)\" \"9_999 in xs\"",
              "python -m timeit -s \"xs = list(range(10_000)); s = set(xs)\" \"9_999 in s\"",
              "",
              "python -m pyperf timeit -s \"import json; d = {'a': list(range(100))}\" \"json.dumps(d)\""
            ]),
            B.code("python", [
              "import timeit",
              "t = min(timeit.repeat(\"''.join(parts)\", setup=\"parts = ['x'] * 1000\", number=10_000, repeat=5))",
              "print(f\"{t / 10_000 * 1e6:.2f} us per call\")"
            ]),
            B.table(["Rule", "Why"], [
              ["Benchmark the real input sizes", "Constant factors and caches flip winners at different sizes"],
              ["Take the minimum of repeats for micro, percentiles for systems", "Noise only adds time; users feel tails"],
              ["Keep setup out of the timed statement", "Otherwise you measure the setup"],
              ["Compare on the same machine and Python version", "3.11+ interpreter changes alter relative costs"],
              ["Check the result is used", "Dead results can make comparisons meaningless"]
            ]),
            B.trap("A 30% win on a microbenchmark of a function that accounts for 0.5% of request time is a 0.15% win in production. Confirm with a profile that the code matters before celebrating."),
            B.cue("<strong>Interview cue:</strong> \"I use microbenchmarks to choose between implementations and profiles to choose what to optimise\" keeps the two tools in their lanes."),
            B.key("<strong>Benchmarks answer small questions precisely.</strong> Isolate setup, use real sizes, repeat and take the minimum, and only trust them for code a profile says matters.")
          ]),
          L("memory-profiling", "Memory: tracemalloc, slots and streaming", "Find what holds memory with snapshots, shrink objects with __slots__, and stop materialising data you only need to stream.", 8, ["memory", "tracemalloc", "slots"], [
            B.p("Memory problems come in two shapes: <strong>too much at once</strong> (loading a whole file, building huge lists) and <strong>never let go</strong> (leaks via caches, globals, reference cycles with finalizers, or callbacks). Different tools find each."),
            B.code("python", [
              "import tracemalloc",
              "",
              "tracemalloc.start(25)                   # keep 25 frames per allocation",
              "before = tracemalloc.take_snapshot()",
              "run_suspect_job()",
              "after = tracemalloc.take_snapshot()",
              "for stat in after.compare_to(before, \"lineno\")[:10]:",
              "    print(stat)"
            ]),
            B.table(["Technique", "Saves", "Cost"], [
              ["Stream with generators and file iteration", "Peak memory: O(1) instead of O(n)", "Single pass"],
              ["<code class='tok'>__slots__</code> / <code class='tok'>dataclass(slots=True)</code>", "Per-instance dict overhead", "No dynamic attributes"],
              ["<code class='tok'>array</code>, NumPy, Arrow buffers", "Boxing: 8 bytes per number instead of ~28 or more", "Typed, less flexible"],
              ["Interning or categorical dtypes", "Repeated strings stored once", "Conversion step"],
              ["Bounded caches (maxsize, TTL)", "Unbounded growth", "Some recomputation"]
            ]),
            B.code("python", [
              "import sys",
              "sys.getsizeof(1)            # ~28 bytes: an int is a full object",
              "sys.getsizeof([1, 2, 3])    # the list only: pointers, not the ints",
              "# getsizeof is shallow; use tracemalloc or a memory profiler for real totals"
            ]),
            B.warn("A container's memory limit counts native allocations too: NumPy buffers, database driver caches, compression libraries. tracemalloc only sees Python's allocator, so pair it with a native-aware profiler such as memray when RSS and tracemalloc disagree."),
            B.quiz("perf-measure"),
            B.cue("<strong>Spotting it in a prompt:</strong> \"the worker is OOM-killed after a few hours\". That is retention, not peak: snapshot over time and diff, looking for caches and global collections."),
            B.key("<strong>Stream instead of loading, slot instead of dict, bound every cache.</strong> Diff snapshots to find leaks and use native-aware tools when RSS disagrees.")
          ])
        ]
      },
      {
        id: "speed",
        name: "Make it faster",
        icon: "bolt",
        lessons: [
          L("data-structures-cost", "The cost model of built-ins", "Know the complexity of list, dict, set and deque operations so you pick the right structure before you ever need a profiler.", 8, ["complexity", "big-o", "builtins"], [
            B.p("The cheapest optimisation is choosing the right data structure up front. Python's built-ins have well-known costs; knowing a few by heart prevents most accidental quadratic code."),
            B.widget("complexityLab"),
            B.table(["Operation", "list", "dict / set", "deque"], [
              ["Index / key lookup", "O(1)", "O(1) average", "O(n) in the middle"],
              ["Membership <code class='tok'>in</code>", "O(n)", "O(1) average", "O(n)"],
              ["Append at end", "O(1) amortised", "O(1) average insert", "O(1)"],
              ["Insert or pop at front", "O(n)", "n/a", "O(1)"],
              ["Delete by value", "O(n)", "O(1) average", "O(n)"],
              ["Sort", "O(n log n)", "n/a (sort keys)", "n/a"]
            ]),
            B.code("python", [
              "# accidental O(n^2): membership in a list inside a loop",
              "unique = []",
              "for x in items:",
              "    if x not in unique:      # scans the list every time",
              "        unique.append(x)",
              "",
              "# O(n): dict keeps order and gives O(1) membership",
              "unique = list(dict.fromkeys(items))",
              "",
              "# string building: collect then join once",
              "html = \"\".join(render(row) for row in rows)"
            ]),
            B.tip("<code class='tok'>heapq</code> gives O(log n) push/pop for top-k and schedulers; <code class='tok'>bisect</code> keeps a list sorted with O(log n) search. Both beat repeatedly sorting."),
            B.cue("<strong>Interview cue:</strong> spot the <code class='tok'>in list</code> inside a loop and say \"that is O(n\u00b2); a set makes it O(n)\". It is the most common performance bug in code review."),
            B.key("<strong>Pick the structure for the access pattern.</strong> Sets and dicts for lookups, deques for both ends, heapq and bisect for order, join for strings.")
          ]),
          L("vectorize", "Vectorisation with NumPy", "Move loops out of the interpreter: whole-array operations, broadcasting and boolean masks run in compiled code.", 8, ["numpy", "vectorization", "broadcasting"], [
            B.p("A Python loop over a million numbers performs a million rounds of bytecode dispatch, attribute lookup and object boxing. A NumPy expression performs one Python-level call that loops in C over a typed, contiguous buffer. Same arithmetic, often one or two orders of magnitude faster."),
            B.code("python", [
              "import numpy as np",
              "",
              "prices = np.asarray(prices_list, dtype=np.float64)",
              "qty = np.asarray(qty_list, dtype=np.int64)",
              "",
              "# loop version: about 1 us per item in CPython",
              "total = sum(p * q for p, q in zip(prices_list, qty_list))",
              "",
              "# vectorised: one call, the loop runs in C",
              "total = float((prices * qty).sum())",
              "",
              "# boolean masks instead of if-inside-loop",
              "discounted = np.where(qty >= 10, prices * 0.9, prices)",
              "",
              "# broadcasting: (n, 1) against (1, m) gives (n, m) without copies",
              "dist = np.abs(points[:, None] - centers[None, :])"
            ]),
            B.table(["Pattern", "Vectorised replacement"], [
              ["if/else per element", "<code class='tok'>np.where</code>, boolean masks"],
              ["Accumulating in a loop", "<code class='tok'>sum, cumsum, bincount</code>"],
              ["Nested loops over pairs", "Broadcasting"],
              ["Group-and-aggregate", "pandas or Polars group_by (next tracks)"],
              ["Truly sequential logic", "Numba JIT, or keep the loop and move it native"]
            ]),
            B.warn("Converting between Python lists and arrays costs time too. Vectorisation pays when data stays in array form across several operations, not when you convert for a single multiplication."),
            B.p("Trade-off: vectorised code can allocate large temporaries (each intermediate array is full size) and reads less like the business rule. For memory-tight pipelines, chunk the input or use in-place operations (<code class='tok'>out=</code>)."),
            B.cue("<strong>Spotting it in a prompt:</strong> a Python for-loop doing arithmetic over rows of numbers. Propose arrays and masks, and mention the conversion cost."),
            B.key("<strong>Push loops down into compiled code.</strong> Keep data in arrays, replace branches with masks, broadcast instead of nesting, and watch temporary allocations.")
          ]),
          L("caching-perf", "Caching without lying", "Memoise pure functions, bound every cache, decide how entries go stale, and know where in-process caching stops working.", 8, ["cache", "lru_cache", "invalidation"], [
            B.p("A cache trades memory and freshness for speed. That trade is only safe when you can state three things: <strong>what the key is</strong>, <strong>how big the cache may grow</strong>, and <strong>what makes an entry stale</strong>."),
            B.code("python", [
              "from functools import lru_cache, cache, cached_property",
              "",
              "@lru_cache(maxsize=4096)                 # pure function, hashable args",
              "def tax_rate(country: str, category: str) -> float:",
              "    return load_rate_table()[country][category]",
              "",
              "tax_rate.cache_info()                    # hits, misses, size",
              "tax_rate.cache_clear()                   # on config reload",
              "",
              "class Report:",
              "    @cached_property",
              "    def totals(self) -> dict[str, float]:  # once per instance",
              "        return compute_totals(self.rows)"
            ]),
            B.table(["Layer", "Scope", "Invalidation", "Watch out"], [
              ["<code class='tok'>lru_cache</code>", "One process", "maxsize eviction, cache_clear()", "No TTL; on methods it retains self"],
              ["TTL cache (library)", "One process", "Time-based", "Each worker has its own copy"],
              ["Redis / Memcached", "Shared by all workers", "TTL, explicit delete, versioned keys", "Network hop, stampedes, serialisation"],
              ["HTTP caching", "Clients and CDNs", "Cache-Control, ETag", "Personalised responses must not be shared"]
            ]),
            B.trap("With four gunicorn workers on three pods, an in-process cache is twelve independent caches. Invalidating one does nothing for the others. Shared or versioned keys are needed when staleness matters."),
            B.tip("Prevent stampedes on hot keys: refresh slightly before expiry, add jitter to TTLs, or let one request recompute while others serve the stale value."),
            B.cue("<strong>Interview cue:</strong> whenever you propose a cache, state the key, the bound, the TTL or invalidation event, and what happens on a miss storm."),
            B.key("<strong>Key, bound, staleness.</strong> Cache pure computations in process, shared data in a shared store, and never ship a cache without an invalidation story.")
          ]),
          L("native-speedups", "When to go native", "Cython, mypyc, Rust with PyO3, Numba or more processes: what each costs, and the evidence you need before paying it.", 8, ["cython", "rust", "numba"], [
            B.p("When profiling shows a CPU-bound pure-Python hot spot, and better algorithms and vectorisation have run out, compiled code can deliver another large step. Each option adds a toolchain and a maintenance cost, so choose the lightest one that solves the measured problem."),
            B.table(["Option", "How", "Best for", "Cost"], [
              ["Newer CPython", "Upgrade the interpreter", "Free wins: 3.11 brought large average speed-ups", "Compatibility testing"],
              ["Numba", "<code class='tok'>@njit</code> on numeric functions", "Loops over NumPy arrays", "Subset of Python; JIT warm-up"],
              ["mypyc", "Compile type-annotated modules", "Typed pure-Python libraries", "Some dynamic features unsupported"],
              ["Cython", "Python-like language with C types", "Tight loops, wrapping C libraries", "Build step, platform wheels"],
              ["Rust via PyO3 + maturin", "Write the core in Rust", "Parsers, heavy CPU, safety-critical speed", "Second language, cross-compiling wheels"],
              ["Process pool", "Spread work across cores", "Embarrassingly parallel CPU tasks", "Pickling, memory per process"]
            ]),
            B.code("python", [
              "from numba import njit",
              "import numpy as np",
              "",
              "@njit(cache=True)",
              "def ewma(x: np.ndarray, alpha: float) -> np.ndarray:",
              "    out = np.empty_like(x)",
              "    out[0] = x[0]",
              "    for i in range(1, x.size):          # a sequential loop numpy cannot vectorise",
              "        out[i] = alpha * x[i] + (1 - alpha) * out[i - 1]",
              "    return out"
            ]),
            B.warn("Native extensions must be built for every platform and Python version you support, and they can crash the process instead of raising an exception. Budget for CI wheel builds and for debugging at a lower level."),
            B.ul([
              "<strong>Evidence first:</strong> a profile showing the function dominates, a benchmark, and a target.",
              "<strong>Isolate the kernel:</strong> a small, pure function with simple types crosses the boundary cheaply.",
              "<strong>Keep a Python fallback</strong> and differential tests that compare the two implementations."
            ]),
            B.quiz("perf-speed"),
            B.cue("<strong>Interview cue:</strong> \"I would profile, fix the algorithm, vectorise, and only then compile the remaining kernel, keeping a pure-Python oracle for tests.\""),
            B.key("<strong>Native code is the last step, not the first.</strong> Upgrade, re-think the algorithm and vectorise before compiling a small, measured kernel.")
          ])
        ]
      }
    ]
  };
})();
