/* =====================================================================
   ANVIL · JVM Internals
   window.TRACKS.jvm — modules: memory / runtime / diagnose
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     jvmGcPause — illustrative GC pause model over a 60 s window
  ================================================================== */
  var COLLECTORS = {
    serial: { label: "Serial", young: function (H) { return 25 * Math.sqrt(H); }, full: function (H) { return 320 * H; }, concurrent: 0, note: "One thread does all the work. Fine for tiny heaps and batch jobs on one core; pauses grow with heap size." },
    parallel: { label: "Parallel", young: function (H) { return 25 * Math.sqrt(H) / 3; }, full: function (H) { return 320 * H / 4; }, concurrent: 0, note: "Many threads, still stop-the-world. Best raw throughput for batch work that tolerates long pauses." },
    g1: { label: "G1", young: function (H) { return Math.min(200, 12 * Math.sqrt(H)); }, full: null, concurrent: 3, note: "The default. Region-based, aims at a pause goal (200 ms by default) and collects old regions incrementally in mixed collections." },
    zgc: { label: "ZGC", young: function () { return 0.5; }, full: null, concurrent: 9, note: "Concurrent marking and relocation keep pauses well under a millisecond, paid for with CPU and memory headroom." }
  };

  function gcModel(kind, H, A) {
    var c = COLLECTORS[kind];
    var youngEvery = (H * 0.3) / A;           // seconds between young collections
    var promo = A * 0.05;                      // GB/s promoted to old
    var oldEvery = (H * 0.6) / promo;          // seconds until old gen fills
    var events = [];
    for (var t = youngEvery; t < 60; t += youngEvery) events.push({ t: t, ms: c.young(H), kind: "young" });
    for (var o = oldEvery; o < 60; o += oldEvery) {
      if (c.full) events.push({ t: o, ms: c.full(H), kind: "full" });
      else if (kind === "g1") events.push({ t: o, ms: Math.min(200, c.young(H) * 1.3), kind: "mixed" });
    }
    events.sort(function (a, b) { return a.t - b.t; });
    var total = 0, max = 0;
    events.forEach(function (e) { total += e.ms; if (e.ms > max) max = e.ms; });
    var pausedPct = total / 600;               // ms over 60 000 ms, as percent
    return { events: events, max: max, pausedPct: pausedPct, appPct: Math.max(0, 100 - pausedPct - c.concurrent), concurrent: c.concurrent, perSec: events.length / 60 };
  }

  Widgets.jvmGcPause = function (mount) {
    K.shell(mount, "model", "GC pause visualizer",
      "Pick a collector, heap size and allocation rate and see 60 seconds of stop-the-world pauses. This is an illustrative teaching model with made-up constants: the shape of the trade-off is the point, not the milliseconds.");
    var kind = "g1", H = 8, A = 1;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var m = gcModel(kind, H, A);
      K.clear(stage);
      var W = 600, HH = 130;
      var s = K.svg("svg", { viewBox: "0 0 " + W + " " + HH, width: "100%", role: "img", "aria-label": "Pause timeline" });
      s.appendChild(K.svg("line", { x1: 0, y1: HH - 18, x2: W, y2: HH - 18, stroke: "var(--line-strong)", "stroke-width": 1 }));
      m.events.forEach(function (e) {
        var x = (e.t / 60) * W;
        var hgt = Math.max(2, Math.min(HH - 24, (Math.log10(e.ms + 1) / Math.log10(20001)) * (HH - 24) * 1.25));
        var col = e.kind === "full" ? "var(--rose)" : e.kind === "mixed" ? "var(--amber)" : "var(--accent)";
        s.appendChild(K.svg("rect", { x: x - 1.5, y: HH - 18 - hgt, width: 3, height: hgt, fill: col, rx: 1 }));
      });
      for (var sec = 0; sec <= 60; sec += 10) {
        var tx = K.svg("text", { x: Math.min(W - 12, Math.max(8, (sec / 60) * W)), y: HH - 4, "font-size": 10, fill: "var(--text-faint)", "text-anchor": "middle" });
        tx.textContent = sec + "s";
        s.appendChild(tx);
      }
      stage.appendChild(s);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:4px" }, "Bar height is log-scaled pause length. Accent = young, amber = mixed, rose = full stop-the-world collection."));
      K.clear(readout);
      readout.appendChild(K.ro("collector", COLLECTORS[kind].label));
      readout.appendChild(K.ro("pauses / s", K.fmt(m.perSec, 1)));
      readout.appendChild(K.ro("longest pause", m.max >= 1000 ? K.fmt(m.max / 1000, 1) + " s" : K.fmt(m.max, m.max < 10 ? 1 : 0) + " ms"));
      readout.appendChild(K.ro("time paused", K.fmt(m.pausedPct, 2) + "%"));
      readout.appendChild(K.ro("concurrent GC CPU", m.concurrent + "%"));
      readout.appendChild(K.ro("left for the app", K.fmt(m.appPct, 1) + "%"));
      readout.appendChild(K.wide(COLLECTORS[kind].note));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["serial", "Serial"], ["parallel", "Parallel"], ["g1", "G1"], ["zgc", "ZGC"]], 2, function (v) { kind = v; paint(); }),
      K.segment([[2, "2 GB heap"], [8, "8 GB"], [32, "32 GB"]], 1, function (v) { H = v; paint(); }),
      K.segment([[0.2, "200 MB/s alloc"], [1, "1 GB/s"], [3, "3 GB/s"]], 1, function (v) { A = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     jvmContainerBudget — does the process fit the container?
  ================================================================== */
  Widgets.jvmContainerBudget = function (mount) {
    K.shell(mount, "model", "Container memory budget",
      "Pick a container memory limit, a heap percentage, a platform thread count and a CPU limit. The bar adds up the heap and typical native memory (rough, illustrative sizes) and shows what JVM ergonomics would choose.");
    var limit = 2048, pct = 75, threads = 200, cpu = 2;
    var bar = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var heap = limit * pct / 100;
      var parts = [
        ["heap", heap, "var(--accent)"],
        ["thread stacks", threads * 0.5, "var(--amber)"],
        ["metaspace", 130, "var(--violet)"],
        ["code cache", 50, "var(--cyan)"],
        ["GC structures", heap * 0.04, "var(--pink)"],
        ["direct buffers", 64, "var(--lime)"]
      ];
      var total = parts.reduce(function (n, p) { return n + p[1]; }, 0);
      var scale = Math.max(total, limit);
      K.clear(bar);
      var strip = h("div", { style: "position:relative;display:flex;height:22px;border-radius:6px;overflow:hidden;background:var(--surface-2)" });
      parts.forEach(function (p) { strip.appendChild(h("div", { title: p[0], style: "width:" + (p[1] / scale * 100) + "%;background:" + p[2] })); });
      strip.appendChild(h("div", { style: "position:absolute;top:0;bottom:0;width:2px;background:var(--text);left:" + (limit / scale * 100) + "%" }));
      bar.appendChild(strip);
      var legend = h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:0.76rem;color:var(--text-dim)" });
      parts.forEach(function (p) {
        legend.appendChild(h("span", {}, h("span", { style: "display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;background:" + p[2] }), p[0] + " " + K.fmt(p[1]) + " MB"));
      });
      legend.appendChild(h("span", {}, "| = container limit"));
      bar.appendChild(legend);
      var over = total > limit;
      var serial = cpu < 2 || limit < 1792;
      K.clear(readout);
      readout.appendChild(K.ro("process total", K.fmt(total) + " / " + K.fmt(limit) + " MB"));
      readout.appendChild(h("span", { class: "ro", style: over ? "color:var(--rose-ink)" : "color:var(--lime-ink)" }, over ? "OOM-killed (exit 137)" : "fits, headroom " + K.fmt(limit - total) + " MB"));
      readout.appendChild(K.ro("availableProcessors()", Math.max(1, Math.ceil(cpu))));
      readout.appendChild(K.ro("default collector", serial ? "Serial" : "G1"));
      readout.appendChild(K.wide(over
        ? "The heap alone may be fine, but the process does not fit. Lower the heap percentage, reduce platform threads (or use virtual threads), or raise the limit."
        : serial ? "Ergonomics fall back to Serial GC here. Set -XX:+UseG1GC explicitly, or give the container at least 2 CPUs and about 2 GB."
          : pct < 60 ? "Safe, but much of the limit is unused; the heap could be larger." : "A reasonable budget: heap as a share of the limit with room for native memory."));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([[1024, "1 GiB limit"], [2048, "2 GiB"], [4096, "4 GiB"]], 1, function (v) { limit = v; paint(); }),
      K.segment([[50, "heap 50%"], [75, "75%"], [95, "95%"]], 1, function (v) { pct = v; paint(); }),
      K.segment([[50, "50 threads"], [200, "200"], [800, "800"]], 1, function (v) { threads = v; paint(); }),
      K.segment([[1, "1 CPU"], [2, "2 CPU"], [4, "4 CPU"]], 1, function (v) { cpu = v; paint(); })
    ));
    mount.appendChild(bar);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "jvm-memory": {
      title: "Memory and GC checkpoint",
      sub: "Runtime data areas, generational collection and picking a collector.",
      questions: [
        {
          q: "A container has a 2 GiB memory limit and the JVM runs with -Xmx2g. It is OOM-killed by the kernel without any Java OutOfMemoryError. Why?",
          options: ["The heap leaked", "Heap plus metaspace, thread stacks, code cache and direct buffers exceeded the container limit", "The GC was too slow", "Kubernetes ignores -Xmx"],
          answer: 1,
          explain: "-Xmx caps only the Java heap. The JVM also needs native memory for metaspace, thread stacks, the JIT code cache, GC structures and direct buffers. Leave headroom, typically by sizing the heap as a percentage of the limit with -XX:MaxRAMPercentage."
        },
        {
          q: "Which idea makes generational garbage collection efficient?",
          options: ["Old objects die first", "Most objects die young, so collecting a small young space frequently reclaims most garbage cheaply", "All objects live equally long", "Generations avoid stop-the-world pauses entirely"],
          answer: 1,
          explain: "The weak generational hypothesis says most allocations become garbage quickly. Copying the few survivors out of a small young space is cheap, so frequent young collections reclaim most memory while the old generation is processed less often."
        },
        {
          q: "A latency-sensitive API needs consistently tiny GC pauses on a 32 GB heap and has spare CPU. Which collector is the natural first choice?",
          options: ["Serial", "Parallel", "ZGC", "No GC (Epsilon)"],
          answer: 2,
          explain: "ZGC does marking and relocation concurrently, keeping pauses well under a millisecond largely independent of heap size. The cost is extra CPU and memory headroom, which this scenario can afford."
        },
        {
          q: "What does a TLAB (thread-local allocation buffer) buy you?",
          options: ["It stores thread stacks", "Allocation becomes a pointer bump in a per-thread chunk of eden, with no locking", "It prevents objects from being promoted", "It is where metaspace lives"],
          answer: 1,
          explain: "Each thread gets a private slice of eden and allocates by bumping a pointer, so the common path needs no synchronization. That is why allocation in Java is cheap; the cost shows up later as GC work proportional to what survives."
        },
        {
          q: "Before changing GC flags for a service with long pauses, what should you usually check first?",
          options: ["Whether you can switch to Serial GC", "Allocation rate and live-set size, using GC logs or JFR", "The number of classes loaded", "The thread stack size"],
          answer: 1,
          explain: "Pause behaviour is driven by how fast you allocate and how much stays live. GC logs and JFR show both; reducing allocation or right-sizing the heap usually beats exotic flags, and you can only tune what you have measured."
        }
      ]
    },
    "jvm-runtime": {
      title: "Class loading and JIT checkpoint",
      sub: "Loaders, linking, initialization, tiered compilation and benchmarking.",
      questions: [
        {
          q: "A class compiled fine but at runtime you get NoClassDefFoundError, and earlier in the log an ExceptionInInitializerError for the same class. What happened?",
          options: ["The class was never on the classpath", "The static initializer threw the first time, so the class is marked unusable", "The JIT removed the class", "Two loaders loaded it"],
          answer: 1,
          explain: "If static initialization throws, the JVM reports ExceptionInInitializerError once and then refuses to initialize the class again, surfacing NoClassDefFoundError on later uses. The fix is in the static initializer, not the classpath."
        },
        {
          q: "In the parent-delegation model, what does a class loader do first when asked for a class?",
          options: ["Defines it from its own jar", "Asks its parent loader, and only loads it itself if the parent cannot", "Searches every loader in the JVM", "Compiles the source"],
          answer: 1,
          explain: "Delegation ensures core classes always come from the bootstrap and platform loaders, so an application jar cannot replace java.lang.String. A loader only defines a class itself after its parents fail to find it."
        },
        {
          q: "Why is the first minute of a freshly started JVM service often slower than steady state?",
          options: ["The heap starts full", "Code runs interpreted and in lower compilation tiers until profiling triggers optimized C2 compilation", "Class files are compressed", "The GC is disabled at startup"],
          answer: 1,
          explain: "HotSpot starts by interpreting, then compiles hot methods with C1 while gathering profiles, and finally recompiles the hottest ones with C2. Until that happens, throughput is lower; warmup traffic, CDS and AOT caches reduce the gap."
        },
        {
          q: "A microbenchmark loops one million times over a computation whose result is never used, and reports near-zero time. What is the most likely explanation?",
          options: ["The JIT eliminated the dead computation", "The CPU cache was warm", "System.nanoTime overflowed", "The GC ran concurrently"],
          answer: 0,
          explain: "The JIT can remove work whose result has no effect. Harnesses such as JMH prevent this by sinking results into a Blackhole, running warmup iterations and forking JVMs so you measure what you think you measure."
        },
        {
          q: "What does escape analysis allow the JIT to do?",
          options: ["Move objects to metaspace", "Avoid heap allocation for objects that never escape a method, replacing them with scalars", "Skip garbage collection permanently", "Load classes lazily"],
          answer: 1,
          explain: "If the compiler proves an object never leaves the method or thread, it can scalar-replace it: the fields live in registers or on the stack and no heap allocation happens. Small short-lived objects are often cheaper than they look."
        }
      ]
    },
    "jvm-diagnose": {
      title: "Profiling and diagnostics checkpoint",
      sub: "JFR, heap dumps and thread dumps in production.",
      questions: [
        {
          q: "Why can Java Flight Recorder usually stay enabled in production?",
          options: ["It only runs during GC", "It is built into the JVM and designed for low overhead, commonly around one percent with default settings", "It samples once per hour", "It writes nothing to disk"],
          answer: 1,
          explain: "JFR is an in-JVM event recorder engineered for low overhead, so a continuous recording with a bounded max age is a normal production setting. When an incident happens you dump the last minutes instead of trying to reproduce it."
        },
        {
          q: "In a heap dump, which number tells you how much memory would be freed if an object were collected?",
          options: ["Shallow size", "Retained size", "Instance count", "Class size"],
          answer: 1,
          explain: "Shallow size is the object itself; retained size includes everything kept alive only through it. The dominator tree sorted by retained size is usually the fastest route to a leak's root."
        },
        {
          q: "Requests hang. Three thread dumps taken five seconds apart show the same request threads BLOCKED waiting for the same monitor held by a thread stuck in a socket read. What is the root problem?",
          options: ["Too few CPU cores", "A remote call without a timeout made while holding a lock", "The heap is too small", "The JIT deoptimized the method"],
          answer: 1,
          explain: "Repeated dumps showing identical stacks indicate a real hang, not a slow moment. A blocking read with no timeout inside a synchronized section serializes every caller behind one dead connection; add timeouts and move I/O out of locks."
        },
        {
          q: "Heap dumps from production must be handled carefully because:",
          options: ["They are always corrupted", "They contain live object data, which can include personal data, tokens and passwords", "They disable the GC", "They can only be opened on the same host"],
          answer: 1,
          explain: "A heap dump is a snapshot of application memory, including request payloads, credentials and personal data. Store it like a secret, restrict access, and delete it when the investigation is over."
        },
        {
          q: "Which flag combination gives you evidence automatically the next time the service runs out of heap?",
          options: ["-XX:+UseSerialGC", "-XX:+HeapDumpOnOutOfMemoryError with -XX:HeapDumpPath pointing at a writable volume", "-Xss512k", "-XX:+DisableExplicitGC"],
          answer: 1,
          explain: "The JVM writes a heap dump at the moment of the OutOfMemoryError, which is exactly when the leak is largest. Point the path at a persistent volume in containers, or the file disappears with the pod."
        }
      ]
    },
    "jvm-perf": {
      title: "Containers, performance and incidents checkpoint",
      sub: "Container awareness, tuning method and common production failures.",
      questions: [
        {
          q: "A pod has a CPU limit of 1 and a 1 GiB memory limit, and no JVM flags are set. Which collector does the JVM pick?",
          options: ["G1", "ZGC", "Serial, because it sees fewer than two processors and under about 1.8 GB", "Parallel"],
          answer: 2,
          explain: "JVM ergonomics treat such a machine as a client-class environment and choose Serial GC. Pauses then grow with heap size. Set the collector explicitly, and consider whether a 1-CPU limit is realistic for a Spring service."
        },
        {
          q: "With a CPU limit of 2 on a 64-core node, what does a container-aware JVM report from Runtime.availableProcessors()?",
          options: ["64", "2", "1", "It depends on the heap size"],
          answer: 1,
          explain: "Container support reads cgroup limits, so GC threads, the common ForkJoinPool and default pool sizes follow the limit. -XX:ActiveProcessorCount can override it when needed."
        },
        {
          q: "What is the right first step when asked to 'make the service faster'?",
          options: ["Switch to ZGC", "Define the goal (for example p99 under 200 ms at 500 req/s), reproduce with a load test and profile to find the bottleneck", "Increase the thread pool", "Rewrite in reactive style"],
          answer: 1,
          explain: "Tuning without a measurable target and a profile is guessing. A load test reproduces the problem; JFR, metrics and traces show whether time goes to CPU, locks, GC, the pool or downstream calls."
        },
        {
          q: "Requests time out while CPU is low and thread dumps show all request threads WAITING in HikariPool.getConnection. What is the incident?",
          options: ["A memory leak", "Connection pool exhaustion: connections are held too long or leaked", "GC thrashing", "A deadlock in the JIT"],
          answer: 1,
          explain: "Threads parked waiting for connections, with idle CPU, point at the pool. Look for slow queries, remote calls inside transactions and leaks via leak detection; failing fast with a short connection timeout limits the blast radius."
        },
        {
          q: "CPU is at 100%, throughput has collapsed and GC logs show back-to-back full collections that reclaim little. What is happening?",
          options: ["Thread starvation", "GC thrashing: the live set nearly fills the heap, so the JVM spends most of its time collecting", "Connection leak", "Normal warmup"],
          answer: 1,
          explain: "When the live set approaches the heap size, collections free little and run constantly. The cause is a leak or an undersized heap; a heap dump shows which. ExitOnOutOfMemoryError and GC overhead limits help the JVM fail instead of limping."
        },
        {
          q: "Why is a load test that ramps straight to peak for 30 seconds a weak test?",
          options: ["It is too expensive", "It misses warmup effects, steady-state behaviour such as leaks and pool saturation over time, and the shape of real traffic", "Load tests must run for exactly an hour", "It always passes"],
          answer: 1,
          explain: "Useful load tests warm up, hold a realistic mix at target load long enough to expose leaks and queueing, then push beyond to find the breaking point. Watch latency percentiles, not averages."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.jvm = {
    id: "jvm",
    name: "JVM Internals",
    short: "JVM",
    tagline: "What your code actually runs on",
    color: "#f59e0b",
    blurb: "Look under the hood: where objects and threads live, how generational garbage collection works, how to choose between G1 and ZGC, how classes load and code gets compiled at runtime, and how to read JFR recordings, heap dumps and thread dumps when production misbehaves.",
    modules: [
      {
        id: "memory",
        name: "Memory & Garbage Collection",
        icon: "database",
        lessons: [
          {
            id: "memory-areas",
            title: "Runtime data areas: heap, stacks and native memory",
            summary: "Where objects, frames, class metadata and compiled code live, and why -Xmx is not your container's memory budget.",
            minutes: 9,
            tags: ["jvm", "heap", "metaspace", "containers"],
            blocks: [
              { t: "p", html: "A running JVM owns several memory areas. The <strong>heap</strong> holds objects and is shared by every thread. Each thread has its own <strong>stack</strong> of frames for local variables and calls. Outside the heap, <strong>metaspace</strong> stores class metadata and the <strong>code cache</strong> stores machine code produced by the JIT." },
              { t: "diagram", id: "jvm-memory", caption: "The heap is split into generations; metaspace, code cache and thread stacks are native memory outside -Xmx." },
              { t: "h", text: "What lives where" },
              { t: "table", headers: ["Area", "Holds", "Sized by", "Typical failure"], rows: [
                ["Heap", "All objects and arrays", "<code class='tok'>-Xmx</code> or <code class='tok'>-XX:MaxRAMPercentage</code>", "<code class='tok'>OutOfMemoryError: Java heap space</code>"],
                ["Thread stacks", "Frames: locals, operands, return addresses", "<code class='tok'>-Xss</code> per platform thread", "<code class='tok'>StackOverflowError</code>, or <code class='tok'>unable to create native thread</code>"],
                ["Metaspace", "Class metadata", "Grows by default; cap with <code class='tok'>-XX:MaxMetaspaceSize</code>", "<code class='tok'>OutOfMemoryError: Metaspace</code> (class loader leaks)"],
                ["Code cache", "JIT-compiled code", "<code class='tok'>-XX:ReservedCodeCacheSize</code>", "Compilation stops; throughput drops"],
                ["Direct buffers", "Off-heap NIO buffers (Netty, Kafka clients)", "<code class='tok'>-XX:MaxDirectMemorySize</code>", "<code class='tok'>OutOfMemoryError: Direct buffer memory</code>"]
              ] },
              { t: "h", text: "Containers: budget the whole process" },
              { t: "p", html: "The kernel kills a container when the <em>process</em> exceeds its memory limit, not when the heap does. A heap equal to the limit leaves nothing for stacks, metaspace or buffers, and the pod dies with exit code 137 and no Java error at all." },
              { t: "code", lang: "bash", code: J([
                "# let the JVM size the heap from the container limit, leaving headroom",
                "java -XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -jar app.jar",
                "",
                "# see what the JVM itself thinks it is using (enable tracking first)",
                "java -XX:NativeMemoryTracking=summary -jar app.jar &",
                "jcmd <pid> VM.native_memory summary"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Start around 70-75% of the limit for heap.</strong> Services with many threads, large direct buffers or heavy class loading need more headroom; measure with Native Memory Tracking rather than guessing." },
              { t: "compare",
                bad: { title: "Sizing by habit", items: ["<code class='tok'>-Xmx</code> equal to the container limit", "Unbounded thread pools, each thread reserving a stack", "OOM-killed pods with no heap dump to explain them"] },
                good: { title: "Sizing the process", items: ["Heap as a percentage of the limit", "Bounded pools, and virtual threads for blocking I/O", "<code class='tok'>ExitOnOutOfMemoryError</code> so the orchestrator restarts a broken JVM quickly"] } },
              { t: "note", variant: "key", html: "<strong>-Xmx is the heap, not the process.</strong> Budget heap, stacks, metaspace, code cache and buffers together, and size the heap as a share of the container limit." }
            ]
          },
          {
            id: "gc-basics",
            title: "Garbage collection fundamentals",
            summary: "Reachability, the generational hypothesis, copying and compacting, TLABs, safepoints and why allocation rate is your main lever.",
            minutes: 9,
            tags: ["gc", "generational", "safepoints"],
            blocks: [
              { t: "p", html: "A garbage collector does not find garbage. It finds <strong>live</strong> objects \u2014 everything reachable from the <strong>GC roots</strong> (thread stacks, static fields, JNI handles) \u2014 and treats the rest as free space. Its cost is driven by how much is live and how fast you create new objects." },
              { t: "h", text: "Most objects die young" },
              { t: "p", html: "Request DTOs, iterators, intermediate strings: most allocations are garbage within milliseconds. Generational collectors exploit this by allocating into a small young space (<strong>eden</strong>) and frequently copying the few survivors out. Objects that survive enough young collections are <strong>promoted</strong> to the old generation." },
              { t: "table", headers: ["Phase", "What happens", "Cost depends on"], rows: [
                ["Allocation", "Bump a pointer in the thread's TLAB inside eden", "Almost nothing"],
                ["Young (minor) GC", "Copy live young objects to a survivor space or old gen", "Live young objects, not eden size"],
                ["Old / mixed GC", "Mark live old objects, reclaim or compact regions", "Live set and fragmentation"],
                ["Full GC", "Stop everything and compact the whole heap", "Total live heap \u2014 the pause you want to avoid"]
              ] },
              { t: "h", text: "Stop-the-world and safepoints" },
              { t: "p", html: "Some GC phases need every application thread paused at a <strong>safepoint</strong>, a place where the JVM knows exactly where references are. Modern collectors shrink those pauses by doing marking (and for ZGC, relocation) concurrently, using barriers in compiled code to track what the application changes meanwhile." },
              { t: "code", lang: "bash", code: J([
                "# unified GC logging: one line per collection, with pause times",
                "java -Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags:filecount=5,filesize=20m -jar app.jar"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Allocation rate is the knob you control.</strong> Fewer temporary objects means fewer young collections and less promotion. Streams of boxed integers, string concatenation in hot loops and needless copying show up directly in GC time." },
              { t: "note", variant: "warn", html: "<strong>Never call System.gc() to fix memory.</strong> It requests a full collection and usually makes latency worse. If memory keeps growing, you have a leak or an undersized heap \u2014 find out which with a heap dump." },
              { t: "note", variant: "key", html: "<strong>GC cost tracks the live set and the allocation rate.</strong> Generational collectors make short-lived garbage cheap; long pauses come from big live sets, promotion pressure and full collections." }
            ]
          },
          {
            id: "gc-choosing",
            title: "Choosing a collector: G1, ZGC and friends",
            summary: "Match the collector to the workload's latency and throughput goals, and tune in the right order.",
            minutes: 10,
            tags: ["g1", "zgc", "tuning"],
            blocks: [
              { t: "p", html: "No collector is best at everything. Each trades <strong>pause time</strong>, <strong>throughput</strong> (share of CPU left for your code) and <strong>memory footprint</strong> against each other. Choose by the goal that hurts most when missed." },
              { t: "widget", id: "jvmGcPause" },
              { t: "table", headers: ["Collector", "Pauses", "Best for", "Watch out for"], rows: [
                ["Serial", "Stop-the-world, single thread", "Tiny heaps, one CPU, CLI tools", "Pauses grow with heap"],
                ["Parallel", "Stop-the-world, many threads", "Batch jobs that want maximum throughput", "Long full collections"],
                ["G1 (default)", "Short, targeted at a pause goal (200 ms default)", "General services from a few GB upwards", "Humongous objects, tuning by flag folklore"],
                ["ZGC", "Sub-millisecond, mostly concurrent", "Latency-sensitive services, large heaps", "Needs spare CPU and heap headroom"],
                ["Shenandoah", "Low, concurrent compaction", "Similar goals to ZGC, distribution-dependent", "Availability depends on your JDK build"]
              ] },
              { t: "code", lang: "bash", code: J([
                "# G1 with an explicit pause goal",
                "java -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:MaxRAMPercentage=75 -jar app.jar",
                "",
                "# ZGC (generational by default in recent JDKs; on JDK 21 add -XX:+ZGenerational)",
                "java -XX:+UseZGC -XX:MaxRAMPercentage=70 -jar app.jar"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Small containers get Serial GC silently.</strong> The JVM picks Serial when it sees fewer than two CPUs or under about 1.8 GB of memory. A service with a 1 CPU limit can end up with very different pauses than on your laptop; set the collector explicitly." },
              { t: "h", text: "Tune in this order" },
              { t: "ol", items: [
                "Measure: GC logs or JFR, allocation rate, live set after full marking, pause distribution.",
                "Reduce allocation and fix leaks in the code \u2014 the cheapest and most durable win.",
                "Right-size the heap relative to the live set (often two to four times the live set for G1).",
                "Pick the collector for the goal, then set one goal flag (<code class='tok'>MaxGCPauseMillis</code>), not twenty."
              ] },
              { t: "table", headers: ["Level", "What they say"], rows: [
                ["Mid", "Knows G1 is the default and that pauses exist"],
                ["Senior", "Chooses G1 vs ZGC from latency goals, sizes heap for containers and reads GC logs"],
                ["Staff", "Connects allocation patterns and live-set growth to SLOs and capacity cost, and sets fleet defaults"]
              ] },
              { t: "quiz", id: "jvm-memory" },
              { t: "note", variant: "key", html: "<strong>Choose the collector by the goal that hurts most.</strong> G1 for balanced services, ZGC for tight latency with spare CPU, Parallel for throughput batch \u2014 and always measure before touching flags." }
            ]
          }
        ]
      },
      {
        id: "runtime",
        name: "Class Loading & JIT",
        icon: "bolt",
        lessons: [
          {
            id: "class-loading",
            title: "Class loading, linking and initialization",
            summary: "How the JVM finds, verifies and initializes classes, why loader identity matters, and the errors that point at each phase.",
            minutes: 8,
            tags: ["classloader", "initialization"],
            blocks: [
              { t: "p", html: "A class becomes usable in three phases. <strong>Loading</strong> finds the bytes and creates the class. <strong>Linking</strong> verifies the bytecode, prepares static fields and resolves references. <strong>Initialization</strong> runs static initializers, lazily, on first active use." },
              { t: "h", text: "Delegation and identity" },
              { t: "ul", items: [
                "<strong>Bootstrap</strong> loader: core JDK classes such as <code class='tok'>java.lang.String</code>.",
                "<strong>Platform</strong> loader: other JDK modules.",
                "<strong>Application</strong> loader: your classpath or module path.",
                "Each loader asks its parent first, so you cannot accidentally replace a JDK class.",
                "A class's identity is its name <em>plus</em> its defining loader: the same class loaded twice by two loaders is two incompatible types."
              ] },
              { t: "h", text: "Reading the errors" },
              { t: "table", headers: ["Error", "Phase", "Usual cause"], rows: [
                ["<code class='tok'>ClassNotFoundException</code>", "Loading by name (reflection)", "Missing dependency or wrong scope"],
                ["<code class='tok'>NoClassDefFoundError</code>", "Linking or a failed earlier initialization", "Present at compile time, absent or broken at runtime"],
                ["<code class='tok'>ExceptionInInitializerError</code>", "Initialization", "A static initializer threw (bad config read at class load)"],
                ["<code class='tok'>NoSuchMethodError</code>", "Linking", "Two versions of a library; the older one won"],
                ["<code class='tok'>ClassCastException</code> X cannot be cast to X", "Identity", "Same class from two different loaders"]
              ] },
              { t: "note", variant: "trap", html: "<strong>NoSuchMethodError is usually a dependency conflict.</strong> Two versions of the same library are on the classpath and the build picked the wrong one. Inspect the resolved dependency tree before touching code." },
              { t: "h", text: "Spring Boot's executable jar" },
              { t: "p", html: "A Boot fat jar nests dependency jars inside <code class='tok'>BOOT-INF/lib</code>. A small launcher installs a class loader that reads those nested jars, which is why the jar runs with plain <code class='tok'>java -jar</code>. For faster startup, Boot can extract the jar and pair it with a <strong>class data sharing</strong> archive \u2014 see <a class='inline' href='#/prod/ship/packaging-containers'>packaging and containers</a>." },
              { t: "code", lang: "bash", code: J([
                "# which jar did a class actually come from?",
                "java -verbose:class -jar app.jar | grep 'com.fasterxml.jackson.databind.ObjectMapper'",
                "",
                "# Maven: show who brings a conflicting version",
                "mvn dependency:tree -Dincludes=com.fasterxml.jackson.core"
              ]) },
              { t: "note", variant: "key", html: "<strong>Load, link, initialize \u2014 and identity is name plus loader.</strong> Match the error to the phase, and suspect duplicate library versions before you suspect the JVM." }
            ]
          },
          {
            id: "jit-compilation",
            title: "JIT compilation, warmup and honest benchmarks",
            summary: "Tiered compilation, inlining and escape analysis, deoptimization, and how to measure performance without fooling yourself.",
            minutes: 10,
            tags: ["jit", "c2", "jmh", "warmup"],
            blocks: [
              { t: "p", html: "HotSpot does not compile your whole program up front. It starts by <strong>interpreting</strong> bytecode, watches which methods are hot, compiles them quickly with <strong>C1</strong>, keeps profiling, and recompiles the hottest code with the optimizing <strong>C2</strong> compiler. That is <strong>tiered compilation</strong>." },
              { t: "h", text: "What the optimizer does with profiles" },
              { t: "table", headers: ["Optimization", "Effect", "Why it matters for backend code"], rows: [
                ["Inlining", "Copies small callees into callers", "Removes call overhead and unlocks every other optimization"],
                ["Escape analysis", "Objects that never escape avoid heap allocation", "Small temporary objects are often free"],
                ["Speculative devirtualization", "Treats an interface call as the one implementation seen so far", "Fast as long as the guess holds"],
                ["Deoptimization", "Falls back to slower code when a guess breaks", "A new subtype or rare branch can briefly slow things down"]
              ] },
              { t: "h", text: "Warmup is real" },
              { t: "p", html: "A JVM that just started runs slower until the hot paths are compiled. Rolling deploys that send full traffic to a cold instance see latency spikes. Mitigations: readiness that waits for warmup, gradual traffic shift, class data sharing and ahead-of-time caches, or a native image when startup dominates." },
              { t: "h", text: "Benchmark with a harness" },
              { t: "code", lang: "java", code: J([
                "@State(Scope.Benchmark)",
                "@Warmup(iterations = 5) @Measurement(iterations = 5) @Fork(2)",
                "public class SkuParserBench {",
                "  String input = \"ACME-2026-000042\";",
                "",
                "  @Benchmark",
                "  public void parse(Blackhole bh) {",
                "    bh.consume(SkuParser.parse(input)); // stop dead-code elimination",
                "  }",
                "}"
              ]) },
              { t: "compare",
                bad: { title: "Hand-rolled timing", items: ["One loop with System.nanoTime around it", "Result unused, so the JIT deletes the work", "Measured during warmup in the same JVM as other tests"] },
                good: { title: "JMH", items: ["Separate warmup and measurement iterations", "Forked JVMs for clean profiles", "Blackhole consumes results; report error bars"] } },
              { t: "note", variant: "warn", html: "<strong>Microbenchmarks answer micro questions.</strong> A faster parser rarely moves end-to-end latency if the request waits 40 ms on the database. Profile the real service with JFR before optimizing a method." },
              { t: "quiz", id: "jvm-runtime" },
              { t: "note", variant: "key", html: "<strong>The JIT optimizes what it observes.</strong> Expect warmup, trust profiles over intuition, and measure with JMH and JFR instead of stopwatch loops." }
            ]
          }
        ]
      },
      {
        id: "diagnose",
        name: "Profiling & Diagnostics",
        icon: "wrench",
        lessons: [
          {
            id: "jfr-dumps",
            title: "JFR, heap dumps and thread dumps",
            summary: "Record production behaviour continuously with JFR, find leaks with heap dumps, and read thread dumps to explain hangs and deadlocks.",
            minutes: 12,
            tags: ["jfr", "heap-dump", "thread-dump", "jcmd"],
            blocks: [
              { t: "p", html: "When production misbehaves you need evidence, not guesses. Three artifacts cover most cases: a <strong>JFR recording</strong> for what the JVM was doing over time, a <strong>heap dump</strong> for what is in memory, and <strong>thread dumps</strong> for what every thread is waiting on right now. <code class='tok'>jcmd</code> produces all three." },
              { t: "h", text: "Java Flight Recorder" },
              { t: "p", html: "JFR is an event recorder built into the JVM: CPU samples, allocations, GC, lock contention, socket and file I/O, exceptions. With default settings its overhead is low enough to leave a continuous recording running and dump it after an incident." },
              { t: "code", lang: "bash", code: J([
                "# continuous recording kept in a ring buffer",
                "java -XX:StartFlightRecording=name=bg,maxage=30m,settings=default -jar app.jar",
                "",
                "# after an incident: write the last 30 minutes to disk",
                "jcmd <pid> JFR.dump name=bg filename=/diag/incident.jfr",
                "",
                "# a focused 60 s profile with more detail",
                "jcmd <pid> JFR.start duration=60s settings=profile filename=/diag/profile.jfr"
              ]) },
              { t: "p", html: "Open recordings in JDK Mission Control or <code class='tok'>jfr print</code>. Start with hot methods, allocation pressure by class, GC pauses, and the lock-contention view." },
              { t: "h", text: "Heap dumps for leaks" },
              { t: "code", lang: "bash", code: J([
                "# on demand (live objects only, triggers a full GC)",
                "jcmd <pid> GC.heap_dump /diag/heap.hprof",
                "",
                "# automatically at the moment of failure",
                "java -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/diag -jar app.jar"
              ]) },
              { t: "ul", items: [
                "Sort the <strong>dominator tree</strong> by <strong>retained size</strong>: the object at the top is what keeps the most memory alive.",
                "Classic culprits: unbounded caches and maps, listeners never removed, ThreadLocals in pooled threads, and huge result sets loaded into memory.",
                "Compare two dumps taken minutes apart to see what grows."
              ] },
              { t: "note", variant: "warn", html: "<strong>A heap dump is sensitive data.</strong> It contains request payloads, tokens and personal data. Store it on a restricted volume, transfer it securely and delete it after analysis." },
              { t: "h", text: "Thread dumps for hangs" },
              { t: "code", lang: "text", code: J([
                "\"http-nio-8080-exec-7\" #41 BLOCKED on java.lang.Object@5f1c",
                "   - waiting to lock <0x...5f1c> (a InventoryClient)",
                "   at com.shop.inventory.InventoryClient.reserve(InventoryClient.java:58)",
                "",
                "\"http-nio-8080-exec-2\" #36 RUNNABLE",
                "   - locked <0x...5f1c> (a InventoryClient)",
                "   at java.net.SocketInputStream.read(...)   <- no read timeout",
                "",
                "Found one Java-level deadlock:   <- printed when the JVM detects one"
              ]) },
              { t: "ol", items: [
                "Take three dumps a few seconds apart: <code class='tok'>jcmd &lt;pid&gt; Thread.print</code>.",
                "Threads stuck in the same frame across all three are the real story.",
                "Follow BLOCKED threads to the lock holder and see what the holder waits on.",
                "With virtual threads use <code class='tok'>jcmd &lt;pid&gt; Thread.dump_to_file -format=json /diag/threads.json</code>, which includes them."
              ] },
              { t: "note", variant: "tip", html: "<strong>Most hangs are a missing timeout.</strong> A remote call without a deadline, made while holding a lock or a pooled connection, turns one slow dependency into a frozen service. See <a class='inline' href='#/res/calls/timeouts-retries'>timeouts and retries</a>." },
              { t: "quiz", id: "jvm-diagnose" },
              { t: "note", variant: "key", html: "<strong>Record continuously, dump on failure, read in threes.</strong> JFR explains behaviour over time, heap dumps explain memory, and repeated thread dumps explain hangs." }
            ]
          }
        ]
      },
      {
        id: "perf",
        name: "Performance & Incidents",
        icon: "trend",
        lessons: [
          {
            id: "container-awareness",
            title: "The JVM in containers: memory, CPU and heap sizing",
            summary: "How the JVM reads cgroup limits, budgeting heap against native memory, CPU limits and ergonomics, and sizing flags that hold up.",
            minutes: 10,
            tags: ["containers", "heap-sizing", "cgroups", "kubernetes"],
            blocks: [
              { t: "p", html: "Modern JVMs are <strong>container-aware</strong>: they read cgroup memory and CPU limits instead of the host's resources. That is good, but the defaults are conservative and the JVM only controls part of the process's memory. Sizing is your job." },
              { t: "widget", id: "jvmContainerBudget" },
              { t: "h", text: "Memory: budget the process, not the heap" },
              { t: "ul", items: [
                "Default max heap is only 25% of the container limit; set <code class='tok'>-XX:MaxRAMPercentage</code> (commonly 60-80%) instead of a fixed <code class='tok'>-Xmx</code> that silently breaks when the limit changes.",
                "Native memory adds up: metaspace, code cache, GC structures (G1 uses a few percent of heap), thread stacks and direct buffers.",
                "Set <code class='tok'>-Xms</code> equal to max heap (or <code class='tok'>InitialRAMPercentage</code>) for services, so the heap does not grow and shrink under load.",
                "Requests and limits: give Java pods equal memory request and limit; overcommitted memory is how nodes start OOM-killing."
              ] },
              { t: "h", text: "CPU: limits change everything" },
              { t: "ul", items: [
                "<code class='tok'>availableProcessors()</code> follows the CPU limit, which sizes GC threads, the common pool and many library defaults.",
                "With fewer than two CPUs or under about 1.8 GB, ergonomics pick Serial GC. Set the collector explicitly.",
                "CPU throttling under a hard limit looks like random latency spikes; JIT compilation and GC at startup are frequent victims. Leave headroom or avoid tight CPU limits for latency-sensitive services.",
                "<code class='tok'>-XX:ActiveProcessorCount</code> overrides detection when the limit misleads the JVM."
              ] },
              { t: "code", lang: "bash", code: J([
                "# a sane starting point for a Spring service container",
                "JAVA_TOOL_OPTIONS=\"-XX:MaxRAMPercentage=75 -XX:InitialRAMPercentage=75 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/diag\"",
                "",
                "# check what the JVM decided inside the container",
                "java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|UseG1GC|UseSerialGC|ActiveProcessorCount'",
                "java -Xlog:os+container=info -version"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Exit code 137 with no Java error is the kernel, not the JVM.</strong> The process exceeded its limit; the heap may have been fine. Compare heap max with the limit and look at Native Memory Tracking before raising the heap." },
              { t: "note", variant: "key", html: "<strong>Size heap as a share of the limit and leave native headroom.</strong> Check what ergonomics chose, set the collector explicitly, and give latency-sensitive services CPU headroom instead of tight limits." }
            ]
          },
          {
            id: "performance-tuning",
            title: "Performance tuning and load testing",
            summary: "A repeatable method: set a target, load-test realistically, profile, change one thing, and verify, with the usual Spring hot spots.",
            minutes: 10,
            tags: ["performance", "load-testing", "profiling"],
            blocks: [
              { t: "p", html: "Performance work fails when it starts with a fix. It succeeds when it starts with a <strong>target</strong> and a <strong>measurement</strong>: 'p99 under 250 ms at 600 requests per second with 30% headroom', then a reproducible test that shows where the time goes." },
              { t: "ol", items: [
                "<strong>Define the goal</strong>: throughput, latency percentiles and error rate, tied to an SLO.",
                "<strong>Reproduce</strong> with a load test against a production-like environment and dataset.",
                "<strong>Profile</strong> under load: JFR for CPU, allocation and locks; metrics for pools and GC; traces for downstream time.",
                "<strong>Change one thing</strong>, rerun the same test, compare percentiles.",
                "<strong>Guard it</strong>: keep the test in CI or a scheduled pipeline so regressions surface."
              ] },
              { t: "h", text: "Load tests that tell the truth" },
              { t: "table", headers: ["Test", "Shape", "Finds"], rows: [
                ["Baseline", "Expected traffic mix, steady", "Normal latency and resource use"],
                ["Soak", "Target load for hours", "Leaks, pool creep, log or disk growth"],
                ["Stress", "Ramp past target until failure", "Breaking point and failure mode"],
                ["Spike", "Sudden burst", "Autoscaling lag, cold JVMs, queue limits"]
              ] },
              { t: "ul", items: [
                "Use an open workload model (arrival rate) as tools like Gatling or k6 support; closed loops of virtual users hide queueing because slow responses slow the load.",
                "Report percentiles and error rate, never just averages.",
                "Warm up before measuring, and test with realistic data volumes: an empty database hides N+1 and missing indexes.",
                "Watch the system under test, not just the client: GC, pool pending, CPU throttling, downstream latency."
              ] },
              { t: "h", text: "Where Spring services usually lose time" },
              { t: "table", headers: ["Symptom", "Common cause", "Lesson"], rows: [
                ["High DB time per request", "N+1 queries, missing indexes, big result sets", "<a class='inline' href='#/data/jpa/n-plus-one'>Fetch plans</a>"],
                ["Latency grows with load, CPU low", "Pool or thread exhaustion, lock contention", "<a class='inline' href='#/data/ops/connection-pooling'>Connection pools</a>"],
                ["Periodic spikes", "GC pauses, cache expiry stampedes", "<a class='inline' href='#/jvm/memory/gc-choosing'>Choosing a collector</a>"],
                ["High CPU in serialization", "Huge JSON payloads, reflection-heavy mapping", "Smaller DTOs, pagination"],
                ["Slow tail only", "Retries, downstream timeouts, cold instances", "<a class='inline' href='#/res/calls/timeouts-retries'>Timeouts and retries</a>"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Little's law sanity-checks every result.</strong> Concurrency = throughput \u00d7 latency. If 600 req/s at 200 ms needs 120 requests in flight, every pool on the path must hold that, or it becomes the queue." },
              { t: "note", variant: "key", html: "<strong>Target, reproduce, profile, change one thing, verify.</strong> Realistic open-model load tests with percentiles, profiles under load, and a regression guard beat flag tuning every time." }
            ]
          },
          {
            id: "production-incidents",
            title: "Common production incidents and how to triage them",
            summary: "Recognise OOM kills, heap exhaustion, GC thrashing, thread starvation, pool exhaustion and retry storms from their symptoms, and respond in the right order.",
            minutes: 11,
            tags: ["incidents", "oom", "thread-starvation", "triage"],
            blocks: [
              { t: "p", html: "Most Java backend incidents fall into a handful of patterns. Recognising the pattern from its symptoms saves the first, most expensive half hour. Mitigate first (roll back, scale, shed load), then diagnose with evidence." },
              { t: "table", headers: ["Incident", "Symptoms", "Evidence", "Typical fix"], rows: [
                ["Container OOM kill", "Pods restart, exit 137, no Java error", "Heap max vs limit, Native Memory Tracking", "Heap as % of limit, fewer threads, cap direct buffers"],
                ["Heap exhaustion / leak", "Heap after GC rises over hours, then OutOfMemoryError", "Heap dump dominator tree", "Bound caches, fix the retaining reference"],
                ["GC thrashing", "CPU pegged, throughput collapses, back-to-back full GCs", "GC logs, heap after GC near max", "Fix leak or enlarge heap; fail fast on OOM"],
                ["Thread starvation", "Latency climbs, CPU low, request threads all waiting", "Three thread dumps", "Timeouts, bulkheads, move blocking work off shared pools"],
                ["Connection pool exhaustion", "<code class='tok'>Connection is not available, request timed out</code>", "hikaricp pending, leak detection traces", "Short transactions, no remote calls in tx, fail fast"],
                ["Retry storm / cascade", "Downstream overloaded, traffic multiplied", "Request rate per layer, breaker metrics", "Single retry layer, breakers, load shedding"],
                ["Deadlock", "Specific requests hang forever", "Thread dump: Found one Java-level deadlock", "Lock ordering, tryLock with timeout"]
              ] },
              { t: "h", text: "A triage sequence" },
              { t: "ol", items: [
                "<strong>Stabilize</strong>: did a deploy just happen? Roll back. Is one dependency failing? Open its breaker or shed that feature.",
                "<strong>Scope</strong>: all instances or one, all endpoints or one, since when? Dashboards for RED metrics, saturation and recent changes.",
                "<strong>Capture evidence before restarting</strong>: thread dumps, a JFR dump, heap metrics; a restart destroys the state you need.",
                "<strong>Match the pattern</strong> from the table, confirm with the evidence, and fix the cause.",
                "<strong>Follow up</strong>: alert that would have caught it earlier, test or guard that prevents recurrence, short write-up."
              ] },
              { t: "code", lang: "bash", code: J([
                "# evidence kit for a misbehaving pod (before you restart it)",
                "jcmd 1 Thread.print > /diag/threads-1.txt; sleep 5; jcmd 1 Thread.print > /diag/threads-2.txt",
                "jcmd 1 JFR.dump name=bg filename=/diag/incident.jfr",
                "jcmd 1 GC.heap_info",
                "jcmd 1 VM.native_memory summary     # if NMT was enabled at startup"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Restarting first erases the evidence.</strong> Restarts are a valid mitigation, but take thread dumps and a JFR dump from at least one affected instance first, or the incident will come back unexplained." },
              { t: "note", variant: "tip", html: "<strong>Thread starvation also happens with virtual threads,</strong> just one level down: a pinned carrier pool or a saturated downstream semaphore. The evidence is the same \u2014 what is everyone waiting for? See <a class='inline' href='#/conc/loom/virtual-threads'>virtual threads</a>." },
              { t: "quiz", id: "jvm-perf" },
              { t: "note", variant: "key", html: "<strong>Mitigate, capture, match, fix, prevent.</strong> Know the signatures of OOM kills, leaks, GC thrashing, starvation and pool exhaustion, and grab dumps before any restart." }
            ]
          }
        ]
      }
    ]
  };
})();
