/* =====================================================================
   PYXIS · Concurrency & asyncio
   window.TRACKS.conc — modules: parallel / asyncio
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     threadVsProcess — a deliberately simple wall-clock model
  ================================================================== */
  var TASKS = 8, CORES = 4;
  var WORK = { cpu: { cpu: 100, io: 0, label: "CPU-bound (hashing, parsing)" }, io: { cpu: 0, io: 100, label: "I/O-bound (HTTP calls)" }, mixed: { cpu: 50, io: 50, label: "Mixed (fetch then parse)" } };
  function model(work, exec, workers, freeThreaded) {
    var w = WORK[work], cpu = w.cpu, io = w.io;
    var seq = TASKS * (cpu + io);
    var rounds = Math.ceil(TASKS / workers);
    var wall, note;
    if (exec === "seq") { wall = seq; note = "One task at a time: the baseline."; }
    else if (exec === "threads") {
      var cpuWall = freeThreaded ? TASKS * cpu / Math.min(workers, CORES) : TASKS * cpu * (workers > 1 && cpu ? 1.05 : 1);
      wall = Math.max(cpuWall, rounds * (cpu + io));
      note = freeThreaded
        ? "Free-threaded build: threads run Python bytecode in parallel up to the core count, so CPU work scales too (when the code and its extensions are thread-safe)."
        : (cpu && !io ? "With the GIL, only one thread runs Python bytecode at a time. CPU-bound threads take turns and add switching overhead." : "Threads release the GIL while waiting on I/O, so waits overlap. CPU portions still run one at a time.");
    } else if (exec === "procs") {
      var startup = 40 + 6 * workers, ipc = 2 * TASKS;
      wall = startup + ipc + Math.max(TASKS * cpu / Math.min(workers, CORES), rounds * (cpu + io));
      note = "Each process has its own interpreter and GIL, so CPU work runs on every core. You pay for process start-up and for pickling arguments and results.";
    } else {
      wall = TASKS * cpu + rounds * io;
      note = cpu && !io ? "asyncio is single-threaded: CPU work blocks the event loop and gains nothing." : (cpu ? "Waits overlap, but every CPU slice blocks the loop for all other tasks. Offload CPU with to_thread or a process pool." : "Thousands of concurrent waits cost almost nothing; the concurrency limit (semaphore) sets the rounds.");
    }
    return { wall: Math.round(wall), seq: seq, speedup: seq / wall, note: note };
  }

  Widgets.threadVsProcess = function (mount) {
    K.shell(mount, "model", "Threads vs processes vs asyncio",
      "Eight tasks on a four-core machine. Choose the workload and the execution model, then change the worker count. A simplified model, but the shape matches what you will measure.");
    var work = "cpu", exec = "threads", workers = 4, ft = false;
    var r1 = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap" });
    var r2 = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center" });
    var bars = h("div", { class: "w-stage", style: "display:grid;gap:6px" });
    var readout = h("div", { class: "w-readout" });
    var wLabel = h("b", {}, String(workers));
    function bar(label, ms, max, strong) {
      var pct = Math.max(2, Math.round(ms / max * 100));
      return h("div", { style: "display:grid;grid-template-columns:120px 1fr 70px;gap:8px;align-items:center;font-size:0.8rem;color:var(--text)" },
        h("span", {}, label),
        h("div", { style: "height:12px;border-radius:6px;background:var(--surface-2);overflow:hidden" },
          h("div", { style: "height:100%;width:" + pct + "%;background:" + (strong ? "var(--accent)" : "var(--line-strong)") })),
        h("span", { style: "font-family:var(--font-mono)" }, ms + " ms"));
    }
    function paint() {
      var m = model(work, exec, workers, ft);
      wLabel.textContent = String(workers);
      K.clear(bars);
      var max = Math.max(m.seq, m.wall);
      bars.appendChild(bar("sequential", m.seq, max, false));
      bars.appendChild(bar(exec === "seq" ? "sequential" : exec === "threads" ? "threads" : exec === "procs" ? "processes" : "asyncio", m.wall, max, true));
      K.clear(readout);
      readout.appendChild(K.ro("workload", WORK[work].label));
      readout.appendChild(K.ro("wall time", m.wall + " ms"));
      readout.appendChild(K.ro("speed-up", K.fmt(m.speedup, 2) + "\u00d7"));
      readout.appendChild(K.ro("interpreter", ft ? "free-threaded" : "with GIL"));
      readout.appendChild(K.wide(m.note));
    }
    r1.appendChild(K.segment([["cpu", "CPU-bound"], ["io", "I/O-bound"], ["mixed", "Mixed"]], 0, function (v) { work = v; paint(); }));
    r1.appendChild(K.segment([["seq", "Sequential"], ["threads", "Threads"], ["procs", "Processes"], ["async", "asyncio"]], 1, function (v) { exec = v; paint(); }));
    r2.appendChild(K.labeled("workers / concurrency", K.range(1, 8, 1, workers, function (v) { workers = v; paint(); })));
    r2.appendChild(h("span", { style: "font-size:0.82rem;color:var(--text-dim)" }, "n = ", wLabel));
    r2.appendChild(K.segment([["gil", "GIL build"], ["ft", "Free-threaded"]], 0, function (v) { ft = v === "ft"; paint(); }));
    mount.appendChild(r1);
    mount.appendChild(r2);
    mount.appendChild(bars);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     asyncTimeline — what the event loop is doing, millisecond by millisecond
  ================================================================== */
  var MODES = {
    sequential: {
      label: "await one by one",
      code: ["a = await fetch(\"A\")   # 300 ms I/O", "b = await fetch(\"B\")   # 200 ms I/O", "parse(a, b)           # 150 ms CPU"],
      rows: [
        { name: "fetch A", segs: [["wait", 0, 300]] },
        { name: "fetch B", segs: [["wait", 300, 500]] },
        { name: "parse", segs: [["run", 500, 650]] }
      ],
      total: 650, outcome: "ok",
      note: "Each await suspends until that one result arrives, so independent I/O runs back to back. Correct, but slow."
    },
    gather: {
      label: "gather / TaskGroup",
      code: ["async with asyncio.TaskGroup() as tg:", "    ta = tg.create_task(fetch(\"A\"))", "    tb = tg.create_task(fetch(\"B\"))", "    tp = tg.create_task(parse_async())"],
      rows: [
        { name: "fetch A", segs: [["wait", 0, 300]] },
        { name: "fetch B", segs: [["wait", 0, 200]] },
        { name: "parse", segs: [["run", 0, 150]] }
      ],
      total: 300, outcome: "ok",
      note: "Waits overlap: total time is the slowest branch, not the sum. The short CPU step fits inside time the loop would spend idle anyway."
    },
    blocking: {
      label: "time.sleep in a coroutine",
      code: ["async def report():", "    time.sleep(0.4)        # blocks the loop!", "    ...", "await asyncio.gather(fetch(\"A\"), fetch(\"B\"), report())"],
      rows: [
        { name: "fetch A", segs: [["wait", 0, 300], ["late", 300, 400]] },
        { name: "fetch B", segs: [["wait", 0, 200], ["late", 200, 400]] },
        { name: "report", segs: [["block", 0, 400]] }
      ],
      total: 400, outcome: "ok",
      note: "A blocking call freezes the whole loop. B's response arrived at 200 ms but nothing could process it until 400 ms: every other request on this loop just got slower."
    },
    thread: {
      label: "to_thread for blocking work",
      code: ["async def report():", "    await asyncio.to_thread(render_pdf)   # 400 ms, off-loop", "await asyncio.gather(fetch(\"A\"), fetch(\"B\"), report())"],
      rows: [
        { name: "fetch A", segs: [["wait", 0, 300]] },
        { name: "fetch B", segs: [["wait", 0, 200]] },
        { name: "report", segs: [["off", 0, 400]] }
      ],
      total: 400, outcome: "ok",
      note: "The blocking call runs in a worker thread, so the loop stays responsive and each fetch completes on time. Total time is the slowest branch."
    },
    timeout: {
      label: "asyncio.timeout(0.25)",
      code: ["async with asyncio.timeout(0.25):", "    async with asyncio.TaskGroup() as tg:", "        tg.create_task(fetch(\"A\"))   # needs 300 ms", "        tg.create_task(fetch(\"B\"))"],
      rows: [
        { name: "fetch A", segs: [["wait", 0, 250], ["cancel", 250, 262]] },
        { name: "fetch B", segs: [["wait", 0, 200]] }
      ],
      total: 262, outcome: "TimeoutError",
      note: "At 250 ms the deadline fires: CancelledError is raised inside fetch A at its await, its finally blocks run, and the timeout context converts that into TimeoutError for the caller."
    }
  };
  var SEG_COLOR = { wait: "var(--accent-2)", run: "var(--accent)", block: "var(--rose)", late: "var(--line-strong)", off: "var(--violet)", cancel: "var(--rose)" };
  var SEG_LABEL = { wait: "awaiting I/O", run: "running on loop", block: "blocking the loop", late: "ready but loop busy", off: "running in thread", cancel: "cancelling" };

  Widgets.asyncTimeline = function (mount) {
    K.shell(mount, "timeline", "Event loop timeline",
      "Three operations on one event loop. Switch strategies and read the timeline: where time is spent waiting, running, blocked, or cancelled.");
    var mode = "sequential";
    var ctl = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap" });
    var codeBox = h("pre", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.78rem;margin:0;white-space:pre-wrap;color:var(--text)" });
    var lanes = h("div", { class: "w-stage", style: "display:grid;gap:8px" });
    var legend = h("div", { class: "w-stage", style: "display:flex;gap:14px;flex-wrap:wrap;font-size:0.76rem;color:var(--text-dim)" });
    var readout = h("div", { class: "w-readout" });
    Object.keys(SEG_LABEL).forEach(function (k) {
      legend.appendChild(h("span", { style: "display:inline-flex;gap:6px;align-items:center" },
        h("i", { style: "display:inline-block;width:14px;height:10px;border-radius:3px;background:" + SEG_COLOR[k] }), SEG_LABEL[k]));
    });
    function paint() {
      var m = MODES[mode], span = 700;
      codeBox.textContent = m.code.join("\n");
      K.clear(lanes);
      m.rows.forEach(function (row) {
        var track = h("div", { style: "position:relative;height:16px;border-radius:6px;background:var(--surface-2)" });
        row.segs.forEach(function (s) {
          track.appendChild(h("div", { title: SEG_LABEL[s[0]] + " " + s[1] + "\u2013" + s[2] + " ms", style: "position:absolute;top:0;bottom:0;left:" + (s[1] / span * 100) + "%;width:" + ((s[2] - s[1]) / span * 100) + "%;border-radius:6px;background:" + SEG_COLOR[s[0]] }));
        });
        var end = row.segs[row.segs.length - 1][2];
        lanes.appendChild(h("div", { style: "display:grid;grid-template-columns:80px 1fr 64px;gap:8px;align-items:center;font-size:0.8rem;color:var(--text)" },
          h("span", {}, row.name), track, h("span", { style: "font-family:var(--font-mono)" }, end + " ms")));
      });
      K.clear(readout);
      readout.appendChild(K.ro("strategy", m.label));
      readout.appendChild(K.ro("total", m.total + " ms"));
      readout.appendChild(h("span", { class: "ro", style: m.outcome === "ok" ? "" : "color:var(--rose-ink)" }, "outcome ", h("b", {}, m.outcome)));
      readout.appendChild(K.wide(m.note));
    }
    ctl.appendChild(K.segment(Object.keys(MODES).map(function (k) { return [k, MODES[k].label]; }), 0, function (v) { mode = v; paint(); }));
    mount.appendChild(ctl);
    mount.appendChild(codeBox);
    mount.appendChild(lanes);
    mount.appendChild(legend);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "conc-parallel": {
      title: "GIL, threads and processes checkpoint",
      sub: "What the GIL locks, pools, start methods and races.",
      questions: [
        {
          q: "Eight threads each run a pure-Python CPU loop on a standard CPython build. Roughly what speed-up do you get on 8 cores?",
          options: ["About 1x or slightly worse, because the GIL lets only one thread execute Python bytecode at a time","About 8x","About 4x","It deadlocks"],
          answer: 0,
          explain: "The GIL serialises bytecode execution, so CPU-bound threads take turns and add switching overhead. Use processes, native code that releases the GIL, or a free-threaded build for CPU parallelism."
        },
        {
          q: "Why do threads still help for I/O-bound work under the GIL?",
          options: ["They do not","The GIL is disabled for sockets","Threads use separate interpreters","Blocking I/O calls release the GIL while waiting, so other threads can run during the wait"],
          answer: 3,
          explain: "Socket reads, file I/O, sleeps and many C extensions release the GIL around blocking work. Waits overlap even though bytecode execution does not."
        },
        {
          q: "Does the GIL make counter += 1 on a shared int thread-safe?",
          options: ["Yes, the GIL makes all operations atomic","Only for small ints","No: += compiles to several bytecodes, and a thread switch between load and store loses updates","Only on Linux"],
          answer: 2,
          explain: "The GIL protects the interpreter's internals, not your invariants. Read-modify-write sequences need a Lock, an atomic structure such as a Queue, or a design with no shared mutable state."
        },
        {
          q: "With the spawn start method, why must process-pool code sit under if __name__ == \"__main__\":?",
          options: ["It is a style rule","Child processes import the main module afresh; without the guard each child would start its own pool recursively","To enable pickling","Spawn is not supported otherwise on Linux"],
          answer: 1,
          explain: "Spawn starts a fresh interpreter that re-imports your module to find the target function. Module-level pool creation then runs again in every child, which fails or forks endlessly."
        },
        {
          q: "What must be true of arguments sent to a ProcessPoolExecutor task?",
          options: ["They must be strings","They must be picklable, and large ones cost serialisation time and memory on both sides","They must be NumPy arrays","Nothing; processes share memory"],
          answer: 1,
          explain: "Processes do not share Python objects; arguments and results are pickled through a pipe. Send small inputs (paths, IDs), use chunksize for many small tasks, or use shared memory for large arrays."
        },
        {
          q: "Two threads acquire lock A then B, and B then A, respectively. What is the standard fix?",
          options: ["Always acquire locks in one global order (or hold one lock), so no wait cycle can form","Use RLock everywhere","Add sleeps","Use daemon threads"],
          answer: 0,
          explain: "Deadlock needs a cycle in the wait graph. A consistent acquisition order removes the cycle. Better still, reduce shared state and communicate through queues."
        }
      ]
    },
    "conc-asyncio": {
      title: "asyncio checkpoint",
      sub: "The event loop, TaskGroup, cancellation and backpressure.",
      questions: [
        {
          q: "A coroutine calls requests.get() (a blocking library) inside an async handler. What is the effect?",
          options: ["Nothing; await makes it async","It raises a RuntimeError","It runs in a thread automatically","It blocks the entire event loop, stalling every other task on it until the call returns"],
          answer: 3,
          explain: "asyncio is cooperative: only await points yield control. A blocking call never yields, so the loop cannot run anything else. Use an async client, or asyncio.to_thread for unavoidable blocking calls."
        },
        {
          q: "What does asyncio.TaskGroup do when one child task raises?",
          options: ["Ignores it","Retries the failed task","Cancels the remaining children, waits for them, then raises an ExceptionGroup containing the failures","Returns the exception as a result"],
          answer: 2,
          explain: "TaskGroup gives structured concurrency: no child outlives the block and no failure is lost. gather without return_exceptions does not cancel siblings on failure, which can leave work running."
        },
        {
          q: "Why keep a reference to tasks created with asyncio.create_task for fire-and-forget work?",
          options: ["For style","To enable cancellation only","The loop holds only a weak reference, so an unreferenced task can be garbage collected before it finishes","It makes them faster"],
          answer: 2,
          explain: "Store background tasks in a set and discard them in a done callback, or better, run them in a TaskGroup owned by something with a lifespan."
        },
        {
          q: "Your code catches asyncio.CancelledError in a worker and continues the loop. What breaks?",
          options: ["Nothing","Cancellation, timeouts and shutdown: the task refuses to stop, so asyncio.timeout and TaskGroup cleanup hang or misbehave","Only logging","The GIL"],
          answer: 1,
          explain: "CancelledError is how asyncio asks a task to stop. Clean up in finally and re-raise. Catch it only to do bounded cleanup, never to keep running."
        },
        {
          q: "A producer reads a fast Kafka topic and a consumer writes to a slow database via an asyncio.Queue(). Memory keeps growing. What is the fix?",
          options: ["A bounded queue, asyncio.Queue(maxsize=n), so the producer awaits put() and slows to the consumer's pace","A bigger server","More logging","Use a list instead"],
          answer: 0,
          explain: "An unbounded queue converts overload into unbounded memory. A bounded queue propagates backpressure: the fast side waits instead of piling up work."
        },
        {
          q: "You fan out 10,000 HTTP calls with gather. The partner starts returning 429s and your sockets run out. What should you add?",
          options: ["Nothing; gather handles it","A longer timeout","time.sleep between calls","A concurrency limit such as asyncio.Semaphore(50) around each call, plus client connection limits and retries with backoff"],
          answer: 3,
          explain: "Unbounded concurrency overwhelms both your process and the dependency. A semaphore caps in-flight requests; connection limits and backoff make the client a good citizen."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.conc = {
    id: "conc",
    name: "Concurrency & asyncio",
    short: "CONC",
    tagline: "Pick the right kind of parallel",
    color: "#38bdf8",
    blurb: "What the GIL actually locks and what free-threading changes, threads versus processes versus asyncio, executor pools, locks and queues, then the event loop, TaskGroup and structured concurrency, cancellation and timeouts, and backpressure.",
    modules: [
      {
        id: "parallel",
        name: "GIL, threads & processes",
        icon: "bolt",
        lessons: [
          L("gil", "The GIL and what it really locks", "One thread at a time executes Python bytecode per interpreter; I/O and many C extensions release it, and free-threaded builds remove it.", 9, ["gil", "free-threading", "cpython"], [
            B.p("CPython's <strong>global interpreter lock</strong> ensures that, within one interpreter, only one thread executes Python bytecode at any moment. It keeps reference counting and interpreter internals simple and fast for single-threaded code. It is released around blocking I/O and by many C extensions during heavy native work."),
            B.diagram("gil-threads", "Threads hand the GIL back and forth; blocking I/O releases it so waits overlap."),
            B.table(["Workload", "Threads under the GIL", "Why"], [
              ["Network and disk I/O", "Scale well", "Waiting releases the GIL"],
              ["NumPy, compression, hashing big buffers", "Often scale", "These C routines release the GIL internally"],
              ["Pure-Python loops", "Do not scale", "Bytecode execution is serialised"],
              ["Mixed", "Scale until CPU share dominates", "Only the waits overlap"]
            ]),
            B.h("Free-threading and subinterpreters"),
            B.p("PEP 703 introduced an optional <strong>free-threaded</strong> CPython build (first shipped experimentally in 3.13 as <code class='tok'>python3.13t</code> and officially supported from 3.14) where threads run bytecode truly in parallel. It costs some single-threaded speed and requires extensions to be built and audited for it. Separately, subinterpreters with their own GIL offer isolation with in-process parallelism. Check your dependencies before betting on either."),
            B.trap("The GIL is not a thread-safety guarantee for your code. <code class='tok'>counter += 1</code> is a load, an add and a store; a switch between them loses updates. Protect shared mutable state with locks, or avoid sharing it."),
            B.code("python", [
              "import sys, sysconfig",
              "sys.getswitchinterval()                    # 0.005: how often threads may be asked to yield",
              "sysconfig.get_config_var(\"Py_GIL_DISABLED\")  # 1 on a free-threaded build",
              "getattr(sys, \"_is_gil_enabled\", lambda: True)()   # runtime check on 3.13+"
            ]),
            B.cue("<strong>Interview cue:</strong> \"The GIL serialises bytecode, not I/O. Threads for waiting, processes or native code for computing, and free-threading is an option you validate per dependency.\""),
            B.key("<strong>The GIL limits CPU parallelism, not concurrency.</strong> I/O overlaps fine; CPU-heavy Python needs processes, native code, or a validated free-threaded build.")
          ]),
          L("threads-processes", "Threads vs processes vs asyncio", "Match the execution model to the workload: asyncio for many waits, threads for blocking libraries, processes for CPU.", 9, ["threads", "multiprocessing", "asyncio"], [
            B.p("There are three main ways to do several things at once in Python. They differ in what they share, what they cost to start, and which workloads they speed up. Choosing wrong does not just waste resources: it can make things slower."),
            B.widget("threadVsProcess"),
            B.table(["", "asyncio", "Threads", "Processes"], [
              ["Parallel CPU?", "No", "No (GIL); yes on free-threaded", "Yes"],
              ["Cost per unit", "Tiny (a coroutine)", "A thread stack (MBs of virtual memory)", "A whole interpreter"],
              ["Shared memory", "Everything, single thread", "Everything: races possible", "Nothing by default: pickled messages"],
              ["Scales to", "Tens of thousands of waits", "Tens to hundreds", "Roughly the core count"],
              ["Needs", "Async-aware libraries end to end", "Thread-safe code", "Picklable work, a main guard"]
            ]),
            B.cmp("Common mismatch", ["Thread pool for pure-Python number crunching", "asyncio with a blocking database driver", "A process per tiny task"],
                  "Better fit", ["Process pool or vectorised NumPy", "Async driver, or to_thread at the edge", "Batch tiny tasks with chunksize or keep them in-process"]),
            B.tip("It is fine to combine them: an asyncio server that offloads CPU work to a <code class='tok'>ProcessPoolExecutor</code> via <code class='tok'>loop.run_in_executor</code>, and blocking SDK calls via <code class='tok'>asyncio.to_thread</code>."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"we added threads and it got slower\" is CPU-bound work under the GIL. \"Our async API stalls under load\" is a blocking call on the loop."),
            B.key("<strong>Waiting: asyncio or threads. Computing: processes or native code.</strong> Measure, because the workload decides, not the fashion.")
          ]),
          L("executors", "concurrent.futures and pools", "One interface for thread and process pools: submit, map, as_completed, timeouts, and orderly shutdown.", 8, ["executor", "futures", "pool"], [
            B.p("<code class='tok'>concurrent.futures</code> gives threads and processes the same API. You submit callables and get <strong>Futures</strong>: handles you can wait on, add callbacks to, or ask for a result with a timeout. Swapping thread for process pool is often a one-line change, which makes experiments cheap."),
            B.code("python", [
              "from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed",
              "",
              "def fetch(url: str) -> bytes: ...",
              "def checksum(path: str) -> str: ...",
              "",
              "with ThreadPoolExecutor(max_workers=16) as pool:",
              "    futures = {pool.submit(fetch, u): u for u in urls}",
              "    for fut in as_completed(futures, timeout=30):",
              "        url = futures[fut]",
              "        try:",
              "            body = fut.result()",
              "        except Exception as exc:",
              "            log.warning(\"fetch failed\", extra={\"url\": url, \"err\": repr(exc)})",
              "",
              "if __name__ == \"__main__\":",
              "    with ProcessPoolExecutor() as pool:            # defaults to the CPU count",
              "        sums = list(pool.map(checksum, paths, chunksize=64))"
            ]),
            B.table(["API", "Behaviour"], [
              ["<code class='tok'>map(fn, items)</code>", "Results in input order; the first exception is raised when you reach it"],
              ["<code class='tok'>as_completed(futs)</code>", "Yields futures as they finish: lowest latency to first result"],
              ["<code class='tok'>fut.result(timeout=)</code>", "Waits for one result; the work itself keeps running if you time out"],
              ["<code class='tok'>shutdown(cancel_futures=True)</code>", "Drops queued work on exit (3.9+); running tasks still finish"],
              ["<code class='tok'>chunksize</code>", "Batches items per process message, cutting pickling overhead"]
            ]),
            B.warn("A timeout on <code class='tok'>result()</code> does not stop the thread. Python cannot kill threads; long-running work must check a cancellation flag (a <code class='tok'>threading.Event</code>) or run in a process you can terminate."),
            B.p("Sizing: for I/O-bound thread pools, start with the number of concurrent waits the dependency can tolerate, not your core count. For CPU-bound process pools, start at the core count your container is actually allowed to use, which may be less than <code class='tok'>os.cpu_count()</code>; <code class='tok'>os.process_cpu_count()</code> (3.13) respects affinity."),
            B.cue("<strong>Interview cue:</strong> mention that futures cannot cancel running threads and how you would make long work cooperative. It shows you have debugged a stuck shutdown."),
            B.key("<strong>One API, two pools.</strong> Use as_completed for responsiveness, chunksize for processes, size by the bottleneck, and make long work cancellable yourself.")
          ]),
          L("sync-primitives", "Locks, queues and race conditions", "Protect invariants, prefer message passing, and learn the handful of primitives that cover most real needs.", 8, ["lock", "queue", "race"], [
            B.p("A <strong>race condition</strong> exists when the result depends on how threads interleave. The cure is either to make the critical section exclusive (a lock) or, usually better, to stop sharing mutable state and pass messages through a thread-safe queue."),
            B.code("python", [
              "import threading, queue",
              "",
              "class Counter:",
              "    def __init__(self) -> None:",
              "        self._n = 0",
              "        self._lock = threading.Lock()",
              "    def incr(self) -> None:",
              "        with self._lock:             # read-modify-write is now atomic",
              "            self._n += 1",
              "",
              "jobs: queue.Queue[str | None] = queue.Queue(maxsize=100)   # bounded",
              "def worker() -> None:",
              "    while (job := jobs.get()) is not None:",
              "        try:",
              "            handle(job)",
              "        finally:",
              "            jobs.task_done()"
            ]),
            B.table(["Primitive", "Use for"], [
              ["<code class='tok'>Lock</code>", "Mutual exclusion around a short critical section"],
              ["<code class='tok'>RLock</code>", "Re-entrant locking by the same thread (often a design smell)"],
              ["<code class='tok'>Event</code>", "A one-way signal: stop, ready, shutdown"],
              ["<code class='tok'>Semaphore</code>", "Cap concurrent access to a resource"],
              ["<code class='tok'>Condition</code>", "Wait for a predicate on shared state"],
              ["<code class='tok'>queue.Queue</code>", "Producer/consumer hand-off with built-in locking and backpressure"]
            ]),
            B.trap("Holding a lock while doing I/O or calling unknown code (callbacks, logging handlers that hit the network) is how latency spikes and deadlocks happen. Keep critical sections tiny, and acquire multiple locks in one global order."),
            B.tip("Free-threaded builds make data races in your own code more likely to surface, because more interleavings become possible. Code that was \"accidentally safe\" under the GIL may not be."),
            B.quiz("conc-parallel"),
            B.cue("<strong>Spotting it in a prompt:</strong> totals that come out slightly low under load. That is a lost update; show the lock or the queue-based redesign."),
            B.key("<strong>Share less, lock briefly, queue the rest.</strong> Locks protect invariants; bounded queues decouple threads and supply backpressure.")
          ])
        ]
      },
      {
        id: "asyncio",
        name: "asyncio in depth",
        icon: "queue",
        lessons: [
          L("event-loop", "The event loop and coroutines", "A single thread runs ready callbacks; await is the only place a coroutine gives the loop a chance to run something else.", 9, ["event-loop", "coroutines", "await"], [
            B.p("An <strong>event loop</strong> is a scheduler running on one thread. It keeps a queue of ready work and a set of I/O watchers. A <strong>coroutine</strong> runs until it hits <code class='tok'>await</code> on something not yet complete, then suspends; the loop runs other ready work and resumes the coroutine when its I/O is done. Nothing pre-empts a running coroutine."),
            B.diagram("asyncio-loop", "One loop, one thread: tasks run until they await, then the loop picks the next ready task."),
            B.code("python", [
              "import asyncio, httpx",
              "",
              "async def fetch(client: httpx.AsyncClient, url: str) -> int:",
              "    resp = await client.get(url)     # suspends; loop runs others",
              "    return resp.status_code",
              "",
              "async def main() -> None:",
              "    async with httpx.AsyncClient(timeout=5) as client:",
              "        codes = await asyncio.gather(*(fetch(client, u) for u in urls))",
              "",
              "asyncio.run(main())                 # creates, runs and closes the loop"
            ]),
            B.widget("asyncTimeline"),
            B.table(["Term", "Is"], [
              ["Coroutine function", "<code class='tok'>async def f()</code>; calling it returns a coroutine object and runs nothing"],
              ["Coroutine", "The paused computation; must be awaited or wrapped in a task"],
              ["Task", "A coroutine scheduled on the loop to run concurrently"],
              ["Future", "A low-level placeholder for a result that will be set later"],
              ["Awaitable", "Anything usable with await: coroutines, tasks, futures"]
            ]),
            B.warn("Forgetting <code class='tok'>await</code> creates a coroutine that never runs; Python warns \"coroutine was never awaited\". Calling a blocking function without awaiting anything blocks every task on the loop. Turn on <code class='tok'>asyncio.run(main(), debug=True)</code> in development to log slow callbacks."),
            B.cue("<strong>Interview cue:</strong> \"asyncio is cooperative multitasking on one thread: await is a yield point, so one blocking call stalls every request on that loop.\""),
            B.key("<strong>Concurrency happens only at await.</strong> Keep coroutines non-blocking, use async libraries end to end, and offload anything that must block.")
          ]),
          L("tasks-taskgroups", "Tasks, gather and TaskGroup", "Run coroutines concurrently with a structure that guarantees no task is leaked and no failure is lost.", 8, ["tasks", "taskgroup", "structured-concurrency"], [
            B.p("To run coroutines at the same time you schedule them as <strong>tasks</strong>. The question is who owns them: who waits for them, who cancels them when something fails, and who sees their exceptions. <strong>Structured concurrency</strong> answers: the block that started them, always."),
            B.code("python", [
              "async def load_dashboard(user_id: str) -> Dashboard:",
              "    async with asyncio.TaskGroup() as tg:          # 3.11+",
              "        profile = tg.create_task(get_profile(user_id))",
              "        orders = tg.create_task(get_orders(user_id))",
              "        recs = tg.create_task(get_recommendations(user_id))",
              "    # here every task has finished, or all were cancelled and an ExceptionGroup was raised",
              "    return Dashboard(profile.result(), orders.result(), recs.result())"
            ]),
            B.table(["Tool", "On failure", "Use when"], [
              ["<code class='tok'>TaskGroup</code>", "Cancels siblings, raises ExceptionGroup", "Default for related concurrent work"],
              ["<code class='tok'>gather(*aws)</code>", "First exception propagates; others keep running", "Legacy code, simple fan-out"],
              ["<code class='tok'>gather(..., return_exceptions=True)</code>", "Exceptions returned as values", "Best-effort batches where partial success is fine"],
              ["<code class='tok'>asyncio.wait(..., FIRST_COMPLETED)</code>", "You decide", "Racing replicas, custom policies"],
              ["<code class='tok'>create_task</code> alone", "Nobody sees it unless you keep a reference and await it", "Background work owned by a long-lived component"]
            ]),
            B.trap("A fire-and-forget <code class='tok'>asyncio.create_task(send_email())</code> with no stored reference may be garbage collected mid-flight, and its exception is only logged when it is destroyed. Keep tasks in a set with a done-callback that discards them, or give them a TaskGroup owned by the application lifespan."),
            B.p("Trade-off: TaskGroup's all-or-nothing semantics are right for \"I need all three results\". When partial results are acceptable, such as recommendations being optional, isolate that task: wrap it with its own try/except and timeout so its failure does not cancel the essentials."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"tasks keep running after the request was cancelled\" or \"errors vanish in background tasks\". Both are unstructured concurrency; move the tasks into a TaskGroup."),
            B.key("<strong>Every task needs an owner.</strong> Use TaskGroup by default, isolate optional branches explicitly, and never leave a task unreferenced.")
          ]),
          L("cancellation-timeouts", "Cancellation and timeouts", "Cancellation is an exception delivered at an await; timeouts are cancellation with a deadline. Both depend on you not swallowing it.", 9, ["cancellation", "timeout", "shield"], [
            B.p("<code class='tok'>task.cancel()</code> does not stop a task immediately. It schedules a <code class='tok'>CancelledError</code> to be raised <strong>at the task's next await</strong>. Your code's <code class='tok'>finally</code> blocks and <code class='tok'>async with</code> exits run, then the error propagates. Timeouts in asyncio are built on exactly this mechanism."),
            B.code("python", [
              "async def call_partner(payload) -> dict:",
              "    try:",
              "        async with asyncio.timeout(2.0):             # 3.11+",
              "            resp = await client.post(\"/quote\", json=payload)",
              "            return resp.json()",
              "    except TimeoutError:",
              "        metrics.incr(\"partner.timeout\")",
              "        raise PartnerUnavailable() from None",
              "",
              "async def worker(queue):",
              "    while True:",
              "        job = await queue.get()",
              "        try:",
              "            await process(job)",
              "        except asyncio.CancelledError:",
              "            await requeue(job)    # bounded cleanup...",
              "            raise                 # ...then let cancellation continue",
              "        finally:",
              "            queue.task_done()"
            ]),
            B.table(["Tool", "Behaviour"], [
              ["<code class='tok'>asyncio.timeout(s)</code>", "Context manager deadline; converts the internal cancellation into TimeoutError"],
              ["<code class='tok'>asyncio.wait_for(aw, s)</code>", "Same idea for a single awaitable"],
              ["<code class='tok'>asyncio.shield(aw)</code>", "Protects the inner operation from outer cancellation; the caller still stops waiting"],
              ["<code class='tok'>task.cancel(); await task</code>", "Request then wait for the cancellation to finish"]
            ]),
            B.trap("<code class='tok'>except Exception</code> does not catch <code class='tok'>CancelledError</code> (it is a BaseException since 3.8), but <code class='tok'>except BaseException</code> or a bare <code class='tok'>except</code> does. Swallowing it makes timeouts never fire and shutdown hang."),
            B.warn("Cancellation only lands at an await. A coroutine stuck in a CPU loop or a blocking call cannot be cancelled until it reaches one; that is another reason to keep blocking work off the loop."),
            B.cue("<strong>Interview cue:</strong> \"Every outbound call gets a deadline, cancellation propagates, and cleanup lives in finally\" is the resilience answer for async services."),
            B.key("<strong>Cancellation is an exception at the next await.</strong> Put deadlines on every external call, clean up in finally, and always re-raise CancelledError.")
          ]),
          L("backpressure", "Backpressure, semaphores and bounded queues", "When producers outpace consumers, something must wait. Make it the producer, not your memory or your dependency.", 9, ["backpressure", "semaphore", "queue"], [
            B.p("<strong>Backpressure</strong> is the property that a slow stage slows down the stages feeding it. Without it, overload turns into unbounded queues, rising memory and latency, and eventually an OOM kill or a dependency you knocked over. In asyncio, the main tools are bounded queues and semaphores."),
            B.code("python", [
              "sem = asyncio.Semaphore(50)                     # max 50 in-flight calls",
              "",
              "async def enrich(client, row):",
              "    async with sem:",
              "        return await client.get(f\"/customers/{row.id}\")",
              "",
              "async def pipeline(source):",
              "    q: asyncio.Queue[Row | None] = asyncio.Queue(maxsize=1000)",
              "    async def producer():",
              "        async for row in source:",
              "            await q.put(row)                    # waits when the queue is full",
              "        for _ in range(WORKERS):",
              "            await q.put(None)",
              "    async def consumer():",
              "        while (row := await q.get()) is not None:",
              "            await write(await enrich(client, row))",
              "    async with asyncio.TaskGroup() as tg:",
              "        tg.create_task(producer())",
              "        for _ in range(WORKERS):",
              "            tg.create_task(consumer())"
            ]),
            B.table(["Mechanism", "Limits", "Effect under overload"], [
              ["Bounded <code class='tok'>asyncio.Queue(maxsize)</code>", "Work buffered between stages", "Producer awaits put(); memory stays flat"],
              ["<code class='tok'>Semaphore(n)</code>", "Concurrent operations", "Excess callers wait their turn"],
              ["Client connection limits", "Sockets to a host", "Protects you and the partner"],
              ["Load shedding (reject fast, 429/503)", "Admission at the edge", "Callers retry later instead of timing out"],
              ["Batching", "Round trips", "Higher throughput per call"]
            ]),
            B.stat([["50", "in-flight calls, not 10,000"], ["1000", "items buffered max"], ["flat", "memory under overload"]]),
            B.tip("Size limits from the bottleneck: if the database handles about 200 concurrent writes well, the whole pipeline's write concurrency should not exceed that, however many workers you run."),
            B.quiz("conc-asyncio"),
            B.cue("<strong>Spotting it in a prompt:</strong> \"memory grows until the pod is killed\" in a streaming service. Look for an unbounded queue or an uncapped gather."),
            B.key("<strong>Bound every buffer and every fan-out.</strong> Bounded queues and semaphores turn overload into waiting, which is the only failure mode you can survive.")
          ])
        ]
      }
    ]
  };
})();
