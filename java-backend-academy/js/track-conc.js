/* =====================================================================
   ANVIL · Concurrency
   window.TRACKS.conc — modules: threads / sync / loom
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  function lcg(seed) {
    var s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ==================================================================
     concRace — simulated interleaving of counter increments
  ================================================================== */
  function simulate(mode, threads, perThread, seed) {
    var rnd = lcg(seed);
    var shared = 0, lockOwner = -1, retries = 0, blockedTicks = 0;
    var cells = [];
    var st = [];
    for (var i = 0; i < threads; i++) { st.push({ done: 0, phase: 0, local: 0 }); cells.push(0); }
    var trace = [];
    var active = threads;
    var guard = 0;
    while (active > 0 && guard++ < 1e6) {
      var t = Math.floor(rnd() * threads);
      var s = st[t];
      if (s.done >= perThread) continue;
      var line = null;
      if (mode === "plain") {
        if (s.phase === 0) { s.local = shared; s.phase = 1; line = "T" + t + " reads " + s.local; }
        else { shared = s.local + 1; s.phase = 0; s.done++; line = "T" + t + " writes " + shared; }
      } else if (mode === "sync") {
        if (s.phase === 0) {
          if (lockOwner === -1) { lockOwner = t; s.phase = 1; line = "T" + t + " locks"; }
          else { blockedTicks++; line = "T" + t + " blocked"; }
        } else if (s.phase === 1) { s.local = shared; s.phase = 2; line = "T" + t + " reads " + s.local; }
        else { shared = s.local + 1; lockOwner = -1; s.phase = 0; s.done++; line = "T" + t + " writes " + shared + ", unlocks"; }
      } else if (mode === "atomic") {
        if (s.phase === 0) { s.local = shared; s.phase = 1; line = "T" + t + " reads " + s.local; }
        else if (shared === s.local) { shared = s.local + 1; s.phase = 0; s.done++; line = "T" + t + " CAS " + s.local + "\u2192" + shared + " ok"; }
        else { retries++; s.phase = 0; line = "T" + t + " CAS fails, retry"; }
      } else {
        cells[t]++; s.done++; line = "T" + t + " cell[" + t + "]++";
      }
      if (s.done >= perThread && s.phase === 0) active--;
      if (trace.length < 10 && line) trace.push(line);
    }
    if (mode === "adder") shared = cells.reduce(function (a, b) { return a + b; }, 0);
    return { total: shared, expected: threads * perThread, retries: retries, blocked: blockedTicks, trace: trace };
  }

  var RACE_NOTES = {
    plain: "count++ is read, add, write. When two threads read the same value, one increment is silently lost.",
    sync: "A monitor makes read-modify-write atomic. Correct, but contending threads wait for the lock.",
    atomic: "AtomicInteger uses compare-and-set: no lock, but a failed CAS means re-reading and retrying under contention.",
    adder: "LongAdder gives each thread its own cell and sums on read: the cheapest option for hot counters that are read rarely."
  };

  Widgets.concRace = function (mount) {
    K.shell(mount, "simulate", "Lost-update race",
      "Several threads each increment a shared counter. Pick a strategy and reshuffle the schedule: a simulated scheduler interleaves the steps, so you can see exactly how updates get lost and what each fix costs.");
    var mode = "plain", threads = 2, seed = 7;
    var readout = h("div", { class: "w-readout" });
    var stage = h("div", { class: "w-stage" });
    function paint() {
      var r = simulate(mode, threads, 1000, seed);
      K.clear(readout);
      var lost = r.expected - r.total;
      readout.appendChild(K.ro("expected", K.fmt(r.expected)));
      readout.appendChild(K.ro("actual", K.fmt(r.total)));
      readout.appendChild(h("span", { class: "ro", style: "color:" + (lost > 0 ? "var(--rose-ink)" : "var(--lime-ink)") }, "lost updates ", h("b", {}, K.fmt(lost))));
      if (mode === "atomic") readout.appendChild(K.ro("CAS retries", K.fmt(r.retries)));
      if (mode === "sync") readout.appendChild(K.ro("blocked steps", K.fmt(r.blocked)));
      readout.appendChild(K.wide(RACE_NOTES[mode]));
      K.clear(stage);
      stage.appendChild(h("div", { style: "font-family:var(--font-mono, monospace);font-size:0.8rem;line-height:1.6" },
        h("div", { style: "color:var(--text-dim)" }, "First steps of schedule #" + seed + ":"),
        h("div", {}, r.trace.join("  \u00b7  "))));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["plain", "count++"], ["sync", "synchronized"], ["atomic", "AtomicInteger"], ["adder", "LongAdder"]], 0, function (v) { mode = v; paint(); }),
      K.segment([[2, "2 threads"], [4, "4 threads"], [8, "8 threads"]], 0, function (v) { threads = v; paint(); }),
      K.btn("Reshuffle schedule", "primary", function () { seed = (seed * 31 + 17) % 9973; paint(); })
    ));
    mount.appendChild(readout);
    mount.appendChild(stage);
    paint();
  };

  /* ==================================================================
     concThroughput — Little's law with platform vs virtual threads
  ================================================================== */
  Widgets.concThroughput = function (mount) {
    K.shell(mount, "model", "Thread-per-request throughput",
      "Each request spends 2 ms on CPU and then waits on I/O. Little's law (concurrency = throughput \u00d7 latency) tells you how many requests per second a service can hold in flight. Compare a 200-thread platform pool with virtual threads, and watch the bottleneck move to the database pool.");
    var model = "platform", io = 200, dbPool = 50;
    var CORES = 8, CPU_MS = 2, POOL = 200;
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var latency = (CPU_MS + io) / 1000;               // seconds per request
      var cpuCap = CORES / (CPU_MS / 1000);              // req/s if CPU bound
      var threadCap = model === "platform" ? POOL / latency : Infinity;
      var dbCap = dbPool > 0 ? dbPool / (io / 1000) : Infinity;
      var caps = [["CPU (8 cores)", cpuCap], ["request threads", threadCap], ["DB connection pool", dbCap]];
      caps.sort(function (a, b) { return a[1] - b[1]; });
      var max = caps[0][1];
      var inFlight = max * latency;
      var threadMem = model === "platform" ? POOL * 1.0 : inFlight * 0.01;   // MB, rough
      K.clear(readout);
      readout.appendChild(K.ro("max throughput", K.fmt(max) + " req/s"));
      readout.appendChild(K.ro("bottleneck", caps[0][0]));
      readout.appendChild(K.ro("requests in flight", K.fmt(inFlight)));
      readout.appendChild(K.ro("thread stack memory", "~" + K.fmt(threadMem) + " MB"));
      var msg = model === "platform" && caps[0][0] === "request threads"
        ? "The pool runs out of threads while they sit waiting on I/O. CPU is mostly idle."
        : model === "virtual" && caps[0][0] === "DB connection pool"
          ? "Virtual threads removed the thread limit; now the database pool caps you. Protect it with a bounded pool or semaphore rather than letting requests pile up."
          : caps[0][0] === "CPU (8 cores)" ? "You are CPU-bound: more threads of any kind will not help." : "Throughput is limited by " + caps[0][0] + ".";
      readout.appendChild(K.wide(msg));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["platform", "Platform pool (200)"], ["virtual", "Virtual threads"]], 0, function (v) { model = v; paint(); }),
      K.segment([[20, "20 ms I/O"], [200, "200 ms I/O"], [1000, "1 s I/O"]], 1, function (v) { io = v; paint(); }),
      K.segment([[50, "DB pool 50"], [400, "DB pool 400"], [0, "no DB"]], 0, function (v) { dbPool = v; paint(); })
    ));
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "conc-threads": {
      title: "Threads and executors checkpoint",
      sub: "Interruption, the memory model and pool configuration.",
      questions: [
        {
          q: "A worker catches InterruptedException inside a loop, logs it and continues. What is wrong?",
          options: ["Nothing, logging is enough", "It swallows the cancellation request; it should restore the flag with Thread.currentThread().interrupt() or exit", "InterruptedException cannot be caught", "It should call Thread.stop()"],
          answer: 1,
          explain: "Interruption is cooperative cancellation. Catching the exception clears the flag, so code that swallows it makes the thread impossible to stop cleanly. Either propagate it, exit, or re-set the flag."
        },
        {
          q: "One thread sets a plain boolean field running = false; another loops while (running). The loop may never stop. Why?",
          options: ["Booleans are not thread-safe types", "Without a happens-before edge, the reading thread is not guaranteed to see the write; declare the field volatile", "The loop needs Thread.sleep", "The GC holds the old value"],
          answer: 1,
          explain: "The Java memory model only guarantees visibility across threads through happens-before edges such as volatile writes and reads, locks, or thread start and join. Without one, the JIT may hoist the read out of the loop."
        },
        {
          q: "Executors.newFixedThreadPool(10) backs its workers with an unbounded queue. What is the production risk?",
          options: ["Threads leak", "Under overload, tasks pile up in memory without limit and latency grows until the heap is exhausted", "Tasks run out of order", "It cannot be shut down"],
          answer: 1,
          explain: "An unbounded queue never applies backpressure; it converts overload into memory growth and huge queueing delay. Use a ThreadPoolExecutor with a bounded queue and an explicit rejection policy."
        },
        {
          q: "For a pool doing blocking I/O where each task waits 90 ms and computes 10 ms on an 8-core machine, what does the sizing rule N = cores \u00d7 (1 + wait/compute) suggest?",
          options: ["8", "16", "80", "800"],
          answer: 2,
          explain: "8 \u00d7 (1 + 90/10) = 80 threads keeps the cores busy while others wait. It is a starting point to validate with load tests; for this shape of work, virtual threads are often the simpler answer."
        },
        {
          q: "Which statement about ThreadLocal in a thread pool is correct?",
          options: ["Values are cleared automatically after each task", "Values survive across tasks on the same pooled thread, so they must be removed in a finally block", "ThreadLocal does not work in pools", "Each task gets a fresh ThreadLocal map"],
          answer: 1,
          explain: "Pooled threads are reused, so a value set by one request leaks into the next task on that thread, including user identity or tenant ids. Always remove it in finally, or use a framework that manages context for you."
        },
        {
          q: "Thread A writes data = 42 and then sets a volatile flag ready = true. Thread B reads ready == true. What is guaranteed about data?",
          options: ["Nothing, data is not volatile", "B sees 42, because the volatile write releases earlier writes and the volatile read that observes it acquires them", "B sees 42 only on x86 CPUs", "B must also lock to see it"],
          answer: 1,
          explain: "A volatile write and a subsequent read of the same field create a happens-before edge covering everything A did before the write. Only the flag needs to be volatile."
        },
        {
          q: "Why does classic double-checked locking require the instance field to be volatile?",
          options: ["To make the synchronized block faster", "Without it, another thread can see a non-null reference to a partially constructed object", "Static fields must always be volatile", "To prevent garbage collection"],
          answer: 1,
          explain: "The unsynchronized first read has no happens-before edge with the constructor's writes, so reordering can publish the reference before the fields are set. volatile restores the ordering."
        }
      ]
    },
    "conc-sync": {
      title: "Async composition and synchronization checkpoint",
      sub: "CompletableFuture, locks, atomics and concurrent collections.",
      questions: [
        {
          q: "A service calls supplyAsync(() -> blockingHttpCall()) without passing an executor. What is the risk?",
          options: ["It runs synchronously", "It runs on the shared ForkJoinPool common pool, which is sized for CPU work, so blocking calls starve every other user of that pool", "It throws immediately", "It creates a new thread per call"],
          answer: 1,
          explain: "The common pool has roughly one thread per core and is shared across the JVM, including parallel streams. Blocking it stalls unrelated work. Pass a dedicated executor, or use virtual threads, for blocking tasks."
        },
        {
          q: "You need the result of call A to start call B, both returning CompletableFuture. Which method composes them without nesting futures?",
          options: ["thenApply", "thenCompose", "thenAccept", "allOf"],
          answer: 1,
          explain: "thenCompose flattens a function that itself returns a CompletableFuture, like flatMap. thenApply would give you CompletableFuture<CompletableFuture<B>>."
        },
        {
          q: "Two threads each run if (!map.containsKey(k)) map.put(k, load(k)) on a ConcurrentHashMap. What is the problem?",
          options: ["ConcurrentHashMap rejects null keys", "Check-then-act is not atomic: both may load and put; use computeIfAbsent instead", "containsKey locks the map", "Nothing, the map is thread-safe"],
          answer: 1,
          explain: "Each call is thread-safe on its own, but the sequence is not. computeIfAbsent performs the check and insert atomically per key. Keep its function short, since it runs while the bin is locked."
        },
        {
          q: "A metrics counter is incremented by many threads on every request and read once per scrape. Which type fits best?",
          options: ["volatile long", "synchronized long field", "AtomicLong", "LongAdder"],
          answer: 3,
          explain: "LongAdder spreads increments across per-thread cells, avoiding CAS contention on one memory location, and sums the cells when read. volatile long alone would lose updates."
        },
        {
          q: "Thread 1 locks A then B; thread 2 locks B then A. What is the standard prevention?",
          options: ["Use more threads", "Always acquire locks in one global order, or use tryLock with a timeout and back off", "Make the locks volatile", "Call Thread.yield between locks"],
          answer: 1,
          explain: "Deadlock needs a cycle in lock acquisition. A consistent ordering removes the cycle; tryLock with timeout lets a thread give up and retry instead of waiting forever."
        }
      ]
    },
    "conc-loom": {
      title: "Virtual threads checkpoint",
      sub: "When virtual threads help, their pitfalls, and how they compare with reactive code.",
      questions: [
        {
          q: "What kind of workload benefits most from virtual threads?",
          options: ["CPU-bound number crunching", "Many concurrent requests that mostly wait on blocking I/O", "Single-threaded batch jobs", "Code that never blocks"],
          answer: 1,
          explain: "Virtual threads make blocking cheap: a waiting virtual thread unmounts from its carrier, so you can hold many thousands of in-flight requests. They do not make CPU-bound code faster."
        },
        {
          q: "Why should you not put virtual threads in a fixed-size pool?",
          options: ["They cannot be pooled technically", "They are cheap to create; pooling reintroduces the thread limit you wanted to remove. Limit the scarce resource instead, for example with a Semaphore", "Pools leak memory", "Pooled virtual threads become platform threads"],
          answer: 1,
          explain: "Create one virtual thread per task. If a downstream service or database can only take N concurrent calls, guard that call with a semaphore or connection pool, not the thread count."
        },
        {
          q: "With virtual threads enabled, throughput stops scaling and JFR shows jdk.VirtualThreadPinned events. What is a common cause on JDK 21?",
          options: ["Too much heap", "Blocking while inside a synchronized block, which pins the virtual thread to its carrier", "Using records", "Calling Optional.get"],
          answer: 1,
          explain: "On JDK 21, a virtual thread that blocks inside synchronized cannot unmount, so it occupies a carrier thread. Replace such sections with ReentrantLock or move to a JDK where synchronized no longer pins (JDK 24 and later)."
        },
        {
          q: "Which situation still favours a reactive stack such as WebFlux over MVC with virtual threads?",
          options: ["A CRUD API backed by JDBC", "Long-lived streaming connections where backpressure between producer and consumer must be expressed end to end", "A service that calls two REST APIs per request", "A scheduled report job"],
          answer: 1,
          explain: "Reactive streams carry demand signals, which is valuable for streaming and high fan-in push workloads. For typical request-response services, virtual threads give similar scalability with simpler, debuggable blocking code."
        },
        {
          q: "In Spring Boot 3.2 or later, how do you run request handling on virtual threads?",
          options: ["Rewrite controllers as reactive", "Set spring.threads.virtual.enabled=true on Java 21 or later", "Add @Async to every controller", "Start the JVM with -Xss1k"],
          answer: 1,
          explain: "The property switches the embedded server's request executor and several Spring executors to virtual threads. Verify downstream pool sizes, since concurrency is no longer capped by the old thread pool."
        },
        {
          q: "What advantage does ScopedValue have over ThreadLocal for passing request context?",
          options: ["It is mutable from anywhere", "It is immutable, bound for a bounded scope, automatically unbound afterwards and cheaply inherited by structured child tasks", "It survives across requests", "It is stored in the database"],
          answer: 1,
          explain: "A scoped value is set once for the dynamic extent of a call and cannot leak into the next task on a pooled thread. Child tasks forked in a structured scope see it without copying maps."
        },
        {
          q: "In structured concurrency, what happens to sibling subtasks when one fails (with the default fail-fast policy)?",
          options: ["They keep running in the background", "They are cancelled, and the scope's join reports the failure, so no work outlives the scope", "The JVM exits", "They are retried"],
          answer: 1,
          explain: "A scope treats concurrent subtasks as one unit of work: a failure cancels the rest, and the try-with-resources block cannot exit while subtasks are still running. That removes leaked threads and orphaned calls."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.conc = {
    id: "conc",
    name: "Concurrency",
    short: "CONC",
    tagline: "Correct first, then fast",
    color: "#22d3ee",
    blurb: "Threads, interruption and the Java memory model; executors and how to size them; composing async work with CompletableFuture; locks, atomics and concurrent collections; and virtual threads \u2014 what Project Loom changes for a Spring service and where reactive code still fits.",
    modules: [
      {
        id: "threads",
        name: "Threads & the Memory Model",
        icon: "queue",
        lessons: [
          {
            id: "threads-basics",
            title: "Threads, interruption and thread-local state",
            summary: "Platform threads, their lifecycle, cooperative cancellation with interrupts, and the ThreadLocal trap in pools.",
            minutes: 8,
            tags: ["threads", "interrupts", "threadlocal"],
            blocks: [
              { t: "p", html: "A classic <strong>platform thread</strong> is a thin wrapper around an operating-system thread. It is expensive: it reserves a stack (often around 1 MB of address space), costs a kernel context switch, and an OS can only juggle so many of them. That cost shaped twenty years of Java server design." },
              { t: "h", text: "Lifecycle" },
              { t: "table", headers: ["State", "Meaning", "Seen in a thread dump when"], rows: [
                ["RUNNABLE", "Running or ready, including inside native I/O", "Doing work, or blocked in a socket read"],
                ["BLOCKED", "Waiting to enter a synchronized monitor", "Lock contention"],
                ["WAITING / TIMED_WAITING", "Parked: wait, join, LockSupport.park, sleep", "Idle pool workers, futures, sleeps"],
                ["TERMINATED", "Finished", "Rarely, it is gone"]
              ] },
              { t: "h", text: "Interruption is cooperative cancellation" },
              { t: "p", html: "Java cannot safely kill a thread. Instead, <code class='tok'>interrupt()</code> sets a flag and wakes blocking calls with <code class='tok'>InterruptedException</code>. Code must honour it: stop, or pass it on." },
              { t: "code", lang: "java", code: J([
                "void drain(BlockingQueue<Job> queue) {",
                "  try {",
                "    while (!Thread.currentThread().isInterrupted()) {",
                "      Job job = queue.take();          // throws if interrupted",
                "      handle(job);",
                "    }",
                "  } catch (InterruptedException e) {",
                "    Thread.currentThread().interrupt(); // restore the flag for callers",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Swallowing InterruptedException breaks shutdown.</strong> Catching it clears the flag. If you log and continue, executor shutdown and graceful pod termination hang until a hard kill." },
              { t: "h", text: "ThreadLocal in pooled threads" },
              { t: "p", html: "<code class='tok'>ThreadLocal</code> attaches a value to the current thread. Frameworks use it for transactions, security context and logging MDC. In a pool, the thread outlives the task, so anything you set leaks into the next request unless you remove it." },
              { t: "code", lang: "java", code: J([
                "TENANT.set(tenantId);",
                "try {",
                "  return service.handle(request);",
                "} finally {",
                "  TENANT.remove(); // never leave request state on a pooled thread",
                "}"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Do not create threads by hand per task.</strong> Use an executor so threads are bounded, named, observable and shut down cleanly. Background reading: <a class='inline' href='../hld-lld-academy/index.html#/lld/concurrency-deep/threads-and-state'>Blueprint: threads and shared state</a>." },
              { t: "note", variant: "key", html: "<strong>Threads are cancelled by cooperation, not force.</strong> Honour interrupts, restore the flag when you catch it, and always clear ThreadLocal state on pooled threads." }
            ]
          },
          {
            id: "java-memory-model",
            title: "The Java memory model: visibility and happens-before",
            summary: "Why one thread's write may be invisible to another, which actions create happens-before edges, and how to publish objects safely.",
            minutes: 9,
            tags: ["jmm", "volatile", "happens-before"],
            blocks: [
              { t: "p", html: "Compilers and CPUs reorder and cache memory operations for speed. Within one thread you never notice. Across threads, the <strong>Java memory model</strong> (JMM) only promises that thread B sees thread A's writes if there is a <strong>happens-before</strong> relationship between them." },
              { t: "h", text: "Edges that create happens-before" },
              { t: "table", headers: ["Action in thread A", "...happens-before...", "Action in thread B"], rows: [
                ["Unlock of a monitor or Lock", "\u2192", "A later lock of the same monitor"],
                ["Write of a volatile field", "\u2192", "A later read of that field"],
                ["<code class='tok'>thread.start()</code>", "\u2192", "Every action in the started thread"],
                ["Every action in a thread", "\u2192", "Another thread returning from <code class='tok'>join()</code> on it"],
                ["Completing a future", "\u2192", "The code that observes its result"],
                ["End of a constructor that sets final fields", "\u2192", "Any thread that sees the object reference"]
              ] },
              { t: "code", lang: "java", code: J([
                "class Poller implements Runnable {",
                "  private volatile boolean running = true; // without volatile the loop may spin forever",
                "",
                "  public void stop() { running = false; }",
                "",
                "  public void run() {",
                "    while (running) {",
                "      pollOnce();",
                "    }",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "warn", html: "<strong>volatile gives visibility, not atomicity.</strong> <code class='tok'>count++</code> on a volatile field still loses updates, because it is a read, an add and a write. Use an atomic or a lock for compound actions." },
              { t: "h", text: "Safe publication" },
              { t: "ul", items: [
                "Prefer <strong>immutable objects</strong> with final fields \u2014 records are a natural fit.",
                "Publish through something that creates an edge: a volatile field, a concurrent collection, a lock, or a completed future.",
                "Double-checked locking only works if the instance field is <code class='tok'>volatile</code>; usually a holder class or a Spring singleton bean is simpler."
              ] },
              { t: "compare",
                bad: { title: "Shared mutable state", items: ["Plain fields written by one thread and read by another", "Mutable DTOs passed between executors", "Hoping tests catch it"] },
                good: { title: "Designed for threads", items: ["Immutable values, confined mutable state", "Handoff through queues, futures or concurrent maps", "Each shared field has a documented guard"] } },
              { t: "h", text: "Reordering, concretely" },
              { t: "code", lang: "java", code: J([
                "// shared, no synchronization",
                "int data = 0; boolean ready = false;",
                "",
                "// thread A                     // thread B",
                "data = 42;                      if (ready) {",
                "ready = true;                     System.out.println(data); // may print 0!",
                "                                }"
              ]) },
              { t: "p", html: "Nothing forces B to see A's writes in program order: the compiler or CPU may reorder them, or B may read a stale cached value. Declaring <code class='tok'>ready</code> as <code class='tok'>volatile</code> fixes it: a volatile write <em>releases</em> every earlier write, and a volatile read that sees it <em>acquires</em> them. B is then guaranteed to print 42." },
              { t: "table", headers: ["volatile gives you", "volatile does not give you"], rows: [
                ["Visibility of the field and of writes before it (release/acquire)", "Atomic read-modify-write (<code class='tok'>count++</code>)"],
                ["No reordering across the volatile access", "Mutual exclusion for multi-field invariants"],
                ["Atomic reads and writes of long and double", "Safety for check-then-act sequences"]
              ] },
              { t: "h", text: "final fields and double-checked locking" },
              { t: "p", html: "Final fields have a special guarantee: once a constructor finishes, any thread that sees the object reference sees the final fields' values, without synchronization \u2014 as long as <code class='tok'>this</code> did not escape during construction. That is why immutable objects are safe to share." },
              { t: "code", lang: "java", code: J([
                "class RateTable {",
                "  private static volatile RateTable instance;      // volatile is what makes this correct",
                "",
                "  static RateTable get() {",
                "    RateTable r = instance;",
                "    if (r == null) {",
                "      synchronized (RateTable.class) {",
                "        r = instance;",
                "        if (r == null) instance = r = load();",
                "      }",
                "    }",
                "    return r;",
                "  }",
                "}",
                "// simpler: a static holder class, or let Spring manage one singleton bean"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Finer-grained tools exist, rarely needed.</strong> <code class='tok'>VarHandle</code> offers acquire, release and opaque modes for lock-free library code. Application code is almost always clearer with volatile, atomics, locks or concurrent collections." },
              { t: "note", variant: "key", html: "<strong>No happens-before edge, no guarantee.</strong> Use volatile for flags, locks or atomics for compound updates, and prefer immutable objects handed off through thread-safe structures." }
            ]
          },
          {
            id: "executors",
            title: "Executors and thread-pool sizing",
            summary: "Configure ThreadPoolExecutor deliberately: core and max size, bounded queues, rejection, shutdown, and context propagation in Spring.",
            minutes: 10,
            tags: ["executor", "thread-pool", "async"],
            blocks: [
              { t: "p", html: "An <strong>executor</strong> separates <em>what</em> to run from <em>how</em> threads are managed. In production you want every pool to be bounded, named and observable, so overload becomes a clear rejection rather than a slow memory leak." },
              { t: "code", lang: "java", code: J([
                "ThreadPoolExecutor pool = new ThreadPoolExecutor(",
                "    16, 32,                                 // core and max threads",
                "    30, TimeUnit.SECONDS,                   // idle time for extra threads",
                "    new ArrayBlockingQueue<>(500),          // bounded queue = backpressure",
                "    Thread.ofPlatform().name(\"report-\", 0).factory(),",
                "    new ThreadPoolExecutor.CallerRunsPolicy() // slow the submitter instead of dropping",
                ");"
              ]) },
              { t: "table", headers: ["Factory method", "Hidden behaviour", "Production verdict"], rows: [
                ["<code class='tok'>newFixedThreadPool(n)</code>", "Unbounded queue", "Overload becomes unbounded memory and latency"],
                ["<code class='tok'>newCachedThreadPool()</code>", "Unbounded threads", "A burst can create thousands of OS threads"],
                ["<code class='tok'>newVirtualThreadPerTaskExecutor()</code>", "One virtual thread per task", "Great for blocking I/O; bound downstream calls separately"],
                ["Explicit <code class='tok'>ThreadPoolExecutor</code>", "Everything chosen by you", "Preferred for platform-thread pools"]
              ] },
              { t: "h", text: "Sizing" },
              { t: "ul", items: [
                "CPU-bound work: about one thread per core; more only adds context switching.",
                "Blocking work: <code class='tok'>cores \u00d7 (1 + wait / compute)</code> as a starting point, then load-test.",
                "Queue length is a latency budget: 500 queued tasks at 20 ms each is ten seconds of waiting.",
                "Separate pools for separate dependencies so one slow service cannot starve the rest \u2014 the bulkhead idea in <a class='inline' href='#/res/calls/bulkheads-rate-limits'>bulkheads and rate limits</a>."
              ] },
              { t: "h", text: "Shutdown and Spring" },
              { t: "code", lang: "java", code: J([
                "// Java 19+: ExecutorService is AutoCloseable; close() waits for tasks",
                "try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {",
                "  orders.forEach(o -> exec.submit(() -> notifier.send(o)));",
                "}",
                "",
                "// Spring: a managed executor bean with context propagation",
                "@Bean ThreadPoolTaskExecutor reportExecutor(TaskDecorator mdcDecorator) {",
                "  var ex = new ThreadPoolTaskExecutor();",
                "  ex.setCorePoolSize(8); ex.setMaxPoolSize(16); ex.setQueueCapacity(200);",
                "  ex.setThreadNamePrefix(\"report-\");",
                "  ex.setTaskDecorator(mdcDecorator); // copy MDC / tracing context to the worker",
                "  return ex;",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>@Async on a method called from the same class does nothing.</strong> Spring applies it through a proxy, and self-invocation bypasses the proxy. The same rule bites <code class='tok'>@Transactional</code> \u2014 see <a class='inline' href='#/data/tx/transactional-basics'>@Transactional basics</a>." },
              { t: "quiz", id: "conc-threads" },
              { t: "note", variant: "key", html: "<strong>Every pool needs a bound, a name and a rejection plan.</strong> Size for the work's wait-to-compute ratio, isolate dependencies, and propagate context explicitly." }
            ]
          }
        ]
      },
      {
        id: "sync",
        name: "Composition & Synchronization",
        icon: "blocks",
        lessons: [
          {
            id: "completable-future",
            title: "Composing async work with CompletableFuture",
            summary: "Fan out independent calls, chain dependent ones, handle failures and enforce deadlines without blocking the wrong pool.",
            minutes: 9,
            tags: ["completablefuture", "async", "timeouts"],
            blocks: [
              { t: "p", html: "<code class='tok'>CompletableFuture</code> represents a value that will arrive later and lets you compose what happens next. Its main use in services is <strong>fan-out</strong>: run independent calls in parallel and combine results, with a deadline." },
              { t: "code", lang: "java", code: J([
                "CompletableFuture<Price> price = CompletableFuture",
                "    .supplyAsync(() -> pricing.quote(sku), ioExecutor)",
                "    .orTimeout(300, TimeUnit.MILLISECONDS);",
                "",
                "CompletableFuture<Stock> stock = CompletableFuture",
                "    .supplyAsync(() -> inventory.check(sku), ioExecutor)",
                "    .completeOnTimeout(Stock.unknown(), 300, TimeUnit.MILLISECONDS); // degrade",
                "",
                "ProductView view = price",
                "    .thenCombine(stock, ProductView::new)",
                "    .exceptionally(ex -> ProductView.unavailable(sku))",
                "    .join();"
              ]) },
              { t: "table", headers: ["Method", "Use it to", "Analogy"], rows: [
                ["<code class='tok'>thenApply</code>", "Transform a result synchronously", "map"],
                ["<code class='tok'>thenCompose</code>", "Start another async step that depends on the result", "flatMap"],
                ["<code class='tok'>thenCombine</code>", "Join two independent futures", "zip"],
                ["<code class='tok'>allOf</code> / <code class='tok'>anyOf</code>", "Wait for many, or the first", "barrier / race"],
                ["<code class='tok'>exceptionally</code> / <code class='tok'>handle</code>", "Recover or map failures", "catch"],
                ["<code class='tok'>orTimeout</code> / <code class='tok'>completeOnTimeout</code>", "Fail or default after a deadline", "deadline"]
              ] },
              { t: "note", variant: "trap", html: "<strong>The default executor is the common pool.</strong> <code class='tok'>supplyAsync</code> without an executor runs on the JVM-wide ForkJoinPool, sized for CPU work. Blocking HTTP or JDBC calls there starve parallel streams and every other user. Always pass an executor for I/O." },
              { t: "note", variant: "warn", html: "<strong>Timeouts on the future do not cancel the call.</strong> <code class='tok'>orTimeout</code> completes the future exceptionally, but the underlying HTTP request keeps running. Set client-level timeouts too." },
              { t: "h", text: "Where this is heading" },
              { t: "p", html: "With virtual threads, plain blocking code inside one thread per call is often clearer than long future chains. <strong>Structured concurrency</strong> (a preview API in recent JDKs) adds scopes that cancel sibling tasks when one fails. Background: <a class='inline' href='../hld-lld-academy/index.html#/lld/concurrency-deep/async-patterns'>Blueprint: async patterns</a>." },
              { t: "note", variant: "key", html: "<strong>Fan out with explicit executors and deadlines.</strong> Use thenCompose for dependent steps, thenCombine for independent ones, and decide up front what a timeout degrades to." }
            ]
          },
          {
            id: "locks-atomics",
            title: "Locks, atomics and concurrent collections",
            summary: "synchronized vs ReentrantLock, compare-and-set atomics, LongAdder, atomic map operations, and avoiding deadlock.",
            minutes: 11,
            tags: ["locks", "atomics", "concurrenthashmap"],
            blocks: [
              { t: "p", html: "When threads must share mutable state, you need <strong>mutual exclusion</strong> (only one thread at a time) or <strong>lock-free atomics</strong> (retry on conflict). The widget shows why an unprotected <code class='tok'>count++</code> is wrong and what each fix costs." },
              { t: "widget", id: "concRace" },
              { t: "h", text: "Choosing a tool" },
              { t: "table", headers: ["Tool", "Good for", "Notes"], rows: [
                ["<code class='tok'>synchronized</code>", "Short critical sections", "Simple, released automatically, no timeout"],
                ["<code class='tok'>ReentrantLock</code>", "tryLock with timeout, fairness, interruptible waits", "Always unlock in finally"],
                ["<code class='tok'>ReadWriteLock</code>", "Read-mostly data", "Writer starvation is possible"],
                ["<code class='tok'>AtomicInteger</code> / <code class='tok'>AtomicReference</code>", "Single-variable updates", "Compare-and-set loop under the hood"],
                ["<code class='tok'>LongAdder</code>", "Hot counters read rarely", "Per-thread cells, summed on read"],
                ["<code class='tok'>ConcurrentHashMap</code>", "Shared maps and caches", "Use compute, merge and computeIfAbsent for atomic updates"]
              ] },
              { t: "code", lang: "java", code: J([
                "// check-then-act race: two threads may both load",
                "if (!cache.containsKey(id)) cache.put(id, load(id));",
                "",
                "// atomic per key",
                "Profile p = cache.computeIfAbsent(id, this::load);",
                "",
                "// atomic counter per key",
                "hits.merge(route, 1L, Long::sum);",
                "",
                "// a lock with a deadline instead of waiting forever",
                "if (lock.tryLock(200, TimeUnit.MILLISECONDS)) {",
                "  try { rebalance(); } finally { lock.unlock(); }",
                "} else {",
                "  throw new BusyException(\"rebalance in progress\");",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Never do I/O while holding a lock.</strong> A remote call inside a critical section makes every other thread wait for the network. Compute what you need, release the lock, then call out." },
              { t: "h", text: "Deadlock" },
              { t: "p", html: "Deadlock needs a cycle: thread 1 holds A and wants B, thread 2 holds B and wants A. Break it with a single global lock order, or with <code class='tok'>tryLock</code> plus back-off. Thread dumps print <code class='tok'>Found one Java-level deadlock</code> when it happens. Deeper treatment: <a class='inline' href='../hld-lld-academy/index.html#/lld/concurrency-deep/locks-and-deadlock'>Blueprint: locks and deadlock</a> and <a class='inline' href='../hld-lld-academy/index.html#/lld/concurrency-deep/lockfree-and-atomics'>Blueprint: lock-free and atomics</a>." },
              { t: "note", variant: "tip", html: "<strong>In a Spring service, the database is usually your lock.</strong> State shared across instances cannot be protected by a JVM lock at all; use row locks, optimistic versioning or unique constraints \u2014 see <a class='inline' href='#/data/tx/isolation-locking'>isolation and locking</a>." },
              { t: "quiz", id: "conc-sync" },
              { t: "note", variant: "key", html: "<strong>Make compound actions atomic, keep critical sections short.</strong> Use the map's atomic methods, LongAdder for hot counters, a fixed lock order, and never block on I/O while holding a lock." }
            ]
          }
        ]
      },
      {
        id: "loom",
        name: "Virtual Threads",
        icon: "bolt",
        lessons: [
          {
            id: "virtual-threads",
            title: "Virtual threads in practice",
            summary: "How virtual threads mount and unmount on carriers, enabling them in Spring Boot, pinning, and protecting downstream resources.",
            minutes: 10,
            tags: ["loom", "virtual-threads", "spring-boot"],
            blocks: [
              { t: "p", html: "A <strong>virtual thread</strong> (final in Java 21) is a thread managed by the JVM rather than the OS. When it blocks on I/O, the JVM <strong>unmounts</strong> it from its <strong>carrier</strong> platform thread and runs another one. Blocking becomes cheap, so the simple thread-per-request style scales to many thousands of concurrent requests." },
              { t: "widget", id: "concThroughput" },
              { t: "code", lang: "java", code: J([
                "// plain Java",
                "try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {",
                "  List<Future<Quote>> quotes = suppliers.stream()",
                "      .map(s -> exec.submit(() -> s.quote(sku))) // each call blocks its own cheap thread",
                "      .toList();",
                "}",
                "",
                "// Spring Boot 3.2+ on Java 21+",
                "// application.yml",
                "// spring:",
                "//   threads:",
                "//     virtual:",
                "//       enabled: true"
              ]) },
              { t: "h", text: "What changes, and what does not" },
              { t: "table", headers: ["Topic", "With virtual threads"], rows: [
                ["Request concurrency", "No longer capped by the server's thread pool"],
                ["CPU-bound work", "Unchanged: still limited by cores"],
                ["Database connections", "Still a fixed pool; it becomes the bottleneck you must protect"],
                ["ThreadLocal", "Works, but millions of threads with large ThreadLocals cost memory; prefer scoped values for new code"],
                ["Debugging", "Normal stack traces and thread dumps (use the JSON dump format)"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Pinning on JDK 21.</strong> A virtual thread that blocks inside a <code class='tok'>synchronized</code> block, or under a native frame, cannot unmount and holds its carrier. Under load this caps throughput. Find it with the JFR event <code class='tok'>jdk.VirtualThreadPinned</code>; use <code class='tok'>ReentrantLock</code>, or move to a JDK where synchronized no longer pins." },
              { t: "compare",
                bad: { title: "Misusing virtual threads", items: ["A fixed pool of 200 virtual threads", "Unbounded calls hammering a 20-connection database", "Expecting CPU-heavy work to speed up"] },
                good: { title: "Using them well", items: ["One virtual thread per task, never pooled", "A semaphore or bounded pool guarding each scarce dependency", "Timeouts on every blocking call"] } },
              { t: "code", lang: "java", code: J([
                "private final Semaphore partnerPermits = new Semaphore(20); // partner API allows 20 concurrent calls",
                "",
                "Quote quote(String sku) throws InterruptedException {",
                "  if (!partnerPermits.tryAcquire(100, TimeUnit.MILLISECONDS)) {",
                "    throw new BusyException(\"partner saturated\");",
                "  }",
                "  try { return partner.quote(sku); } finally { partnerPermits.release(); }",
                "}"
              ]) },
              { t: "note", variant: "key", html: "<strong>Virtual threads make waiting cheap, not resources infinite.</strong> Enable them for blocking I/O services, never pool them, and bound every scarce dependency explicitly." }
            ]
          },
          {
            id: "virtual-vs-reactive",
            title: "Virtual threads vs reactive programming",
            summary: "Compare Spring MVC on virtual threads with WebFlux and Reactor, and decide which model a service should use.",
            minutes: 8,
            tags: ["webflux", "reactor", "loom"],
            blocks: [
              { t: "p", html: "Reactive frameworks such as <strong>Project Reactor</strong> and <strong>Spring WebFlux</strong> were built to avoid blocking threads: a few event-loop threads juggle many requests as chains of callbacks. Virtual threads reach similar concurrency while letting you write ordinary blocking code." },
              { t: "table", headers: ["Concern", "MVC + virtual threads", "WebFlux / Reactor"], rows: [
                ["Programming model", "Sequential, imperative", "Operator chains (Mono / Flux)"],
                ["Stack traces and debugging", "Normal", "Fragmented; needs tooling"],
                ["Backpressure", "Implicit via bounded resources", "Explicit demand signalling end to end"],
                ["Streaming and push (SSE, WebSocket fan-out)", "Possible", "A natural fit"],
                ["Ecosystem", "JDBC, JPA, every blocking library", "Needs reactive drivers (R2DBC, reactive clients)"],
                ["Team learning curve", "Low", "Significant"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Never block an event loop.</strong> A JDBC call or <code class='tok'>block()</code> inside a WebFlux handler stalls one of a handful of threads and with it many requests. If you must call blocking code from reactive code, offload it to a bounded elastic scheduler." },
              { t: "h", text: "A decision rule" },
              { t: "ul", items: [
                "New request-response service on Java 21+: start with <strong>Spring MVC and virtual threads</strong>.",
                "Long-lived streams, high fan-in push, or end-to-end backpressure requirements: <strong>WebFlux</strong> earns its complexity.",
                "Existing healthy reactive service: no need to rewrite; the model still works.",
                "Either way, the hard limits are the same: database connections, downstream rate limits and timeouts."
              ] },
              { t: "table", headers: ["Level", "What they say"], rows: [
                ["Mid", "Virtual threads are lightweight threads"],
                ["Senior", "Explains unmounting, pinning and the shift of bottleneck to downstream pools; chooses MVC vs WebFlux per workload"],
                ["Staff", "Sets a platform default, migration plan and guardrails (semaphores, timeouts, pinning alerts) across services"]
              ] },
              { t: "quiz", id: "conc-loom" },
              { t: "note", variant: "key", html: "<strong>Default to blocking code on virtual threads; choose reactive for streaming and explicit backpressure.</strong> Both still need bounded downstream resources and timeouts." }
            ]
          },
          {
            id: "scoped-values-structured",
            title: "ThreadLocal, ScopedValue and structured concurrency",
            summary: "Carry request context safely across threads, replace long-lived ThreadLocals with scoped values, and fan out with scopes that cancel and clean up.",
            minutes: 10,
            tags: ["threadlocal", "scopedvalue", "structured-concurrency"],
            blocks: [
              { t: "p", html: "Request context \u2014 tenant, user, trace ids, a transaction \u2014 has to reach code deep in the call stack without passing it through every method. For twenty years the answer was <code class='tok'>ThreadLocal</code>. With virtual threads and concurrent fan-out, Java now offers better-shaped tools." },
              { t: "table", headers: ["", "ThreadLocal", "ScopedValue"], rows: [
                ["Mutability", "Set and change any time", "Bound once for a scope; immutable"],
                ["Lifetime", "Until removed (leaks on pooled threads)", "Exactly the dynamic extent of the call"],
                ["Child threads", "Copied only with InheritableThreadLocal", "Inherited cheaply by structured subtasks"],
                ["Cost with many threads", "A map per thread", "Small, designed for millions of virtual threads"],
                ["Status", "Everywhere, used by frameworks", "Final in recent JDKs (JDK 25)"]
              ] },
              { t: "code", lang: "java", code: J([
                "static final ScopedValue<Tenant> TENANT = ScopedValue.newInstance();",
                "",
                "// at the boundary (a filter or message listener)",
                "ScopedValue.where(TENANT, tenantFrom(request)).run(() -> chain.doFilter(request, response));",
                "",
                "// anywhere below, on this thread or in structured subtasks",
                "Tenant t = TENANT.get();   // throws NoSuchElementException if unbound: fail loudly"
              ]) },
              { t: "note", variant: "warn", html: "<strong>Frameworks still use ThreadLocal.</strong> Spring's transactions, security context and MDC are thread-bound today. Keep using them normally; reach for ScopedValue for your own new context, and clean up any ThreadLocal you set in a finally block." },
              { t: "h", text: "Structured concurrency" },
              { t: "p", html: "Fan-out with a raw executor makes it easy to leak work: one call fails, the others keep running, nobody cancels them. <strong>Structured concurrency</strong> ties subtasks to a lexical scope. The scope cannot close until its subtasks finish, a failure cancels the siblings, and thread dumps show the parent-child tree." },
              { t: "code", lang: "java", code: J([
                "// preview API: its shape changed across JDK releases; this is the JDK 25 form",
                "ProductView view(String sku) throws InterruptedException {",
                "  try (var scope = StructuredTaskScope.open()) {            // default: all must succeed",
                "    Subtask<Price> price = scope.fork(() -> pricing.quote(sku));",
                "    Subtask<Stock> stock = scope.fork(() -> inventory.check(sku));",
                "    scope.join();            // waits; if one failed, the other is cancelled and join throws",
                "    return new ProductView(price.get(), stock.get());",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "Each <code class='tok'>fork</code> runs in its own virtual thread by default.",
                "Scoped values bound before the scope are visible inside every subtask.",
                "Add deadlines with the scope's timeout configuration or client timeouts; cancellation interrupts the losers.",
                "Until the API is final, keep it behind a small wrapper so a JDK upgrade touches one class; <a class='inline' href='#/conc/sync/completable-future'>CompletableFuture</a> remains the stable alternative."
              ] },
              { t: "note", variant: "key", html: "<strong>Bind context for a scope, fork work inside a scope.</strong> Clean up every ThreadLocal you set, prefer ScopedValue for new context, and let structured scopes cancel siblings so no work outlives its request." }
            ]
          }
        ]
      }
    ]
  };
})();
