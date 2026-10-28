/* =====================================================================
   PYXIS · Idioms & Standard Library
   window.TRACKS.idiom — modules: iteration / stdlib
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     generatorLab — eager lists vs a lazy generator pipeline
  ================================================================== */
  var SOURCE = [12, 7, 30, 5, 18, 9, 24, 3, 15, 6, 21, 10];
  function keep(v) { return v % 3 === 0; }

  function runPipeline(lazy, take) {
    var trace = [], read = 0, parsed = 0, kept = 0, out = [], peak = 0;
    if (!lazy) {
      var rows = SOURCE.slice(); read = rows.length; trace.push("read_all() built a list of " + rows.length);
      var nums = rows.map(function (v) { return v; }); parsed = nums.length; trace.push("parse() built a list of " + nums.length);
      var good = nums.filter(keep); kept = good.length; trace.push("filter() built a list of " + good.length);
      out = good.slice(0, take); trace.push("take(" + take + ") sliced " + out.length);
      peak = rows.length + nums.length + good.length;
    } else {
      for (var i = 0; i < SOURCE.length && out.length < take; i++) {
        read++; parsed++;
        var v = SOURCE[i];
        if (keep(v)) { kept++; out.push(v); trace.push("next(): read " + v + " \u2192 kept"); }
        else trace.push("next(): read " + v + " \u2192 dropped");
      }
      if (out.length < take) trace.push("source exhausted: StopIteration");
      else trace.push("take satisfied: upstream never asked for more");
      peak = 1;
    }
    return { trace: trace, read: read, parsed: parsed, kept: kept, out: out, peak: peak };
  }

  Widgets.generatorLab = function (mount) {
    K.shell(mount, "simulator", "Eager lists vs lazy generators",
      "A four-stage pipeline: read, parse, filter multiples of three, take the first n. Compare how much work and memory each style spends when you only need a few results.");
    var lazy = true, take = 3;
    var controls = h("div", { class: "w-stage", style: "display:flex;gap:12px;flex-wrap:wrap;align-items:center" });
    var traceBox = h("div", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.78rem;display:grid;gap:2px;color:var(--text)" });
    var readout = h("div", { class: "w-readout" });
    var takeLabel = h("b", {}, String(take));
    function paint() {
      var r = runPipeline(lazy, take);
      takeLabel.textContent = String(take);
      K.clear(traceBox);
      r.trace.forEach(function (t, i) { traceBox.appendChild(h("div", {}, (i + 1) + ". " + t)); });
      K.clear(readout);
      readout.appendChild(K.ro("style", lazy ? "generator pipeline" : "list at every stage"));
      readout.appendChild(K.ro("records read", r.read + " / " + SOURCE.length));
      readout.appendChild(K.ro("items held at peak", r.peak));
      readout.appendChild(K.ro("result", "[" + r.out.join(", ") + "]"));
      readout.appendChild(K.wide(lazy
        ? "Each next() pulls one item through every stage. Work stops the moment take() is satisfied, and only one item is in flight."
        : "Every stage materialises its whole output before the next starts. Memory grows with input size, and records you never needed were still read and parsed."));
    }
    controls.appendChild(K.segment([["lazy", "Generators"], ["eager", "Lists"]], 0, function (v) { lazy = v === "lazy"; paint(); }));
    controls.appendChild(K.labeled("take n", K.range(1, 6, 1, take, function (v) { take = v; paint(); })));
    controls.appendChild(h("span", { style: "font-size:0.82rem;color:var(--text-dim)" }, "n = ", takeLabel));
    mount.appendChild(controls);
    mount.appendChild(traceBox);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "idiom-iteration": {
      title: "Iteration and context managers checkpoint",
      sub: "Iterators, generators, itertools and with-blocks.",
      questions: [
        {
          q: "You pass a generator to a function that loops over it twice. What happens on the second loop?",
          options: ["It restarts from the beginning","It yields nothing, because the generator is an exhausted iterator","It raises RuntimeError","It yields the items in reverse"],
          answer: 1,
          explain: "Generators are iterators: one pass, then exhausted. If a consumer needs several passes, give it a re-iterable (a list or a class whose __iter__ builds a fresh generator), or materialise once deliberately."
        },
        {
          q: "itertools.groupby(rows, key=city) returns several groups for the same city. Why?",
          options: ["groupby only groups consecutive items, so the input must be sorted by the same key first","groupby is buggy with strings","It needs a dict as input","key must be a lambda"],
          answer: 0,
          explain: "groupby is a streaming operation that starts a new group whenever the key changes. Sort by the key first, or use a defaultdict(list) when you cannot sort."
        },
        {
          q: "What does sum(x * x for x in data) avoid compared with sum([x * x for x in data])?",
          options: ["Nothing; they compile identically","Type checking","The GIL","Building a full intermediate list in memory"],
          answer: 3,
          explain: "The generator expression feeds sum one value at a time, so memory stays constant regardless of input size. The list comprehension materialises every square first."
        },
        {
          q: "In a @contextmanager function, why wrap the yield in try/finally?",
          options: ["It is required syntax","To make it async","So cleanup runs even when the with-block raises, since the exception is thrown into the generator at the yield","To suppress all exceptions"],
          answer: 2,
          explain: "An exception in the with-body is re-raised inside the generator at the yield point. Without finally, the code after yield never runs and the resource leaks."
        },
        {
          q: "What does returning True from __exit__ do?",
          options: ["Signals that cleanup succeeded","Re-raises the exception","Suppresses the exception raised in the with-block","Nothing"],
          answer: 2,
          explain: "A truthy return from __exit__ tells Python the exception was handled. Accidentally returning True hides bugs, so most context managers return None or False."
        },
        {
          q: "You must open a variable number of files and close all of them reliably. Which tool fits?",
          options: ["Nested with statements generated by exec","contextlib.ExitStack","A list of open() calls and a finally that closes them by hand","atexit"],
          answer: 1,
          explain: "ExitStack lets you enter context managers dynamically and unwinds them all in reverse order, even if entering one of them fails halfway."
        }
      ]
    },
    "idiom-stdlib": {
      title: "Standard library checkpoint",
      sub: "collections, pathlib, datetime and exceptions.",
      questions: [
        {
          q: "You need a FIFO buffer that keeps only the last 1,000 events with O(1) appends at both ends. Which structure?",
          options: ["collections.deque(maxlen=1000)","list with pop(0)","queue.PriorityQueue","dict"],
          answer: 0,
          explain: "deque supports O(1) append and pop at both ends, and maxlen automatically discards the oldest item. list.pop(0) shifts every element, which is O(n)."
        },
        {
          q: "Which is the correct way to get the current time for storage?",
          options: ["datetime.now()","datetime.utcnow()","time.time() formatted as a local string","datetime.now(timezone.utc)"],
          answer: 3,
          explain: "datetime.now() returns a naive local time, and utcnow() returns a naive datetime that merely happens to be UTC (and is deprecated since 3.12). An aware UTC datetime is unambiguous and converts cleanly to any zone at the edge."
        },
        {
          q: "Two aware datetimes in the same ZoneInfo zone straddle a DST change. What does b - a measure?",
          options: ["Real elapsed time","It raises an error","Always zero","Wall-clock difference, because same-tzinfo subtraction ignores the offsets"],
          answer: 3,
          explain: "When both operands share a tzinfo, Python subtracts the naive wall times. Convert both to UTC first to measure elapsed time, or use time.monotonic() for durations inside a process."
        },
        {
          q: "Why pass encoding=\"utf-8\" to open() and Path.read_text()?",
          options: ["It is faster","UTF-8 is required for binary files","The default encoding depends on the platform locale, so the same code can read files differently on different machines","It enables compression"],
          answer: 2,
          explain: "Until UTF-8 mode is the default for every version you support, the implicit encoding comes from the locale, which is a classic source of Windows-only or container-only bugs. Being explicit makes behaviour portable."
        },
        {
          q: "What does raise ParseError(\"bad row\") from err give you?",
          options: ["It discards err","It records err as __cause__, so the traceback shows both and says the first directly caused the second","It retries the operation","It converts err into a warning"],
          answer: 1,
          explain: "Explicit chaining preserves the root cause while presenting a domain-level error. Use from None only when the original exception is genuinely noise for the caller."
        },
        {
          q: "Why is except Exception: preferred over a bare except: in a worker loop?",
          options: ["A bare except also catches BaseException subclasses such as KeyboardInterrupt, SystemExit and asyncio.CancelledError","It is faster","Bare except is a syntax error","Exception includes more types"],
          answer: 0,
          explain: "Swallowing BaseException makes processes impossible to stop cleanly and breaks asyncio cancellation. Catch Exception, or narrower types, and let control-flow exceptions propagate."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.idiom = {
    id: "idiom",
    name: "Idioms & Standard Library",
    short: "STD",
    tagline: "Write the Python other Python developers expect",
    color: "#818cf8",
    blurb: "The iterator protocol, generators and lazy pipelines, comprehensions and itertools, context managers, and the batteries you should reach for first: collections, pathlib, datetime with zoneinfo, and a disciplined exception style.",
    modules: [
      {
        id: "iteration",
        name: "Iteration & generators",
        icon: "trend",
        lessons: [
          L("iterators", "The iterator protocol", "Iterables produce iterators; iterators produce values until StopIteration. Everything from for-loops to unpacking runs on these two methods.", 7, ["iterator", "iterable", "protocol"], [
            B.p("An <strong>iterable</strong> is anything with <code class='tok'>__iter__</code> that returns a fresh iterator. An <strong>iterator</strong> has <code class='tok'>__next__</code>, returns values until it raises <code class='tok'>StopIteration</code>, and its own <code class='tok'>__iter__</code> returns itself. A list is iterable and can be looped many times; the iterator you get from it is one-shot."),
            B.code("python", [
              "nums = [1, 2, 3]",
              "it = iter(nums)      # list_iterator",
              "next(it), next(it)   # (1, 2)",
              "list(it)             # [3]",
              "list(it)             # []  -- exhausted",
              "",
              "# what a for-loop really does",
              "it = iter(nums)",
              "while True:",
              "    try:",
              "        x = next(it)",
              "    except StopIteration:",
              "        break",
              "    ..."
            ]),
            B.table(["Consumer", "Uses the protocol"], [
              ["<code class='tok'>for</code>, comprehensions", "iter() then next() until StopIteration"],
              ["Unpacking <code class='tok'>a, *rest = x</code>", "Iterates fully"],
              ["<code class='tok'>in</code>", "__contains__ if defined, else iterates"],
              ["<code class='tok'>sum, min, max, any, all, sorted</code>", "Iterate once; any/all short-circuit"],
              ["<code class='tok'>zip, map, filter, enumerate</code>", "Return lazy iterators themselves"]
            ]),
            B.trap("Functions that accept \"an iterable\" and iterate twice (for example, validating then processing) silently do nothing the second time when handed a generator. Either document that you need a re-iterable or call <code class='tok'>list()</code> once, on purpose."),
            B.tip("<code class='tok'>zip(a, b, strict=True)</code> (3.10+) raises if the inputs have different lengths instead of silently truncating, which catches a whole class of alignment bugs."),
            B.cue("<strong>Interview cue:</strong> \"iterables give iterators; iterators are exhausted once\" explains most surprising empty-result bugs in one breath."),
            B.key("<strong>Two methods power every loop.</strong> Return a new iterator from __iter__ when your object should be re-iterable, and treat any iterator as single-use.")
          ]),
          L("generators", "Generators and lazy pipelines", "yield turns a function into a pausable iterator, letting you stream large inputs through composable stages in constant memory.", 9, ["generators", "yield", "lazy"], [
            B.p("Calling a function containing <code class='tok'>yield</code> does not run its body. It returns a generator object; each <code class='tok'>next()</code> runs the body until the next <code class='tok'>yield</code>, hands out a value, and freezes the frame with all its locals. That pause is what makes streaming cheap."),
            B.code("python", [
              "from pathlib import Path",
              "from typing import Iterator",
              "",
              "def read_lines(path: Path) -> Iterator[str]:",
              "    with path.open(encoding=\"utf-8\") as fh:",
              "        yield from fh                 # delegate to the file iterator",
              "",
              "def parse(lines):",
              "    for line in lines:",
              "        if line.strip():",
              "            yield line.rstrip(\"\\n\").split(\",\")",
              "",
              "def errors_only(rows):",
              "    return (r for r in rows if r[2] == \"ERROR\")   # generator expression",
              "",
              "from itertools import islice",
              "first_ten = list(islice(errors_only(parse(read_lines(Path(\"app.log\")))), 10))"
            ]),
            B.widget("generatorLab"),
            B.cmp("Materialise lists", ["Re-iterable, indexable, len() works", "Memory grows with input", "All work done up front even if you need a few rows"],
                  "Generator pipeline", ["Constant memory, starts producing immediately", "Single pass; no len or indexing", "Errors surface late, when a consumer pulls"]),
            B.warn("A generator that holds a resource (a file, a cursor) only releases it when it finishes or is closed. If a consumer stops early, the <code class='tok'>with</code> inside the generator waits until garbage collection. Use <code class='tok'>contextlib.closing(gen)</code> or close it explicitly in long-running services."),
            B.p("Advanced: <code class='tok'>gen.send(value)</code> resumes with a value, <code class='tok'>gen.throw()</code> raises inside it, and a <code class='tok'>return x</code> in a generator becomes <code class='tok'>StopIteration.value</code>, which <code class='tok'>yield from</code> hands back to the delegating generator. These mechanics are the ancestors of async/await."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"process a 50 GB log file\" or \"stream rows from an API with pagination\" is a generator question. Sketch stages as small generators and compose them."),
            B.key("<strong>yield pauses a frame.</strong> Build pipelines from small generators for constant memory, and remember they are single-pass and release resources only when finished or closed.")
          ]),
          L("itertools-comprehensions", "Comprehensions and itertools", "Comprehensions for building collections, itertools for streaming combinators, and the readability line you should not cross.", 8, ["comprehensions", "itertools", "walrus"], [
            B.p("A comprehension describes a collection in one expression: <code class='tok'>[f(x) for x in xs if p(x)]</code>, plus dict, set and generator forms. In Python 3 each comprehension has its own scope, so the loop variable does not leak."),
            B.code("python", [
              "by_id = {u.id: u for u in users}",
              "domains = {email.split(\"@\")[1] for email in emails}",
              "matrix_t = [[row[i] for row in m] for i in range(len(m[0]))]",
              "",
              "# walrus: compute once, filter and keep",
              "clean = [y for x in raw if (y := normalise(x)) is not None]"
            ]),
            B.table(["itertools", "Does", "Typical use"], [
              ["<code class='tok'>islice</code>", "Slice any iterator lazily", "Peek at the first n of a stream"],
              ["<code class='tok'>chain.from_iterable</code>", "Flatten one level", "Pages of results into one stream"],
              ["<code class='tok'>groupby</code>", "Group consecutive equal keys", "Runs in sorted data"],
              ["<code class='tok'>pairwise</code> (3.10)", "Overlapping pairs", "Deltas between consecutive readings"],
              ["<code class='tok'>batched</code> (3.12)", "Fixed-size tuples", "Bulk inserts of 500 rows"],
              ["<code class='tok'>accumulate</code>", "Running totals or maxima", "Cumulative revenue"],
              ["<code class='tok'>product, combinations</code>", "Cartesian and combinatorial", "Test matrices"],
              ["<code class='tok'>tee</code>", "Split one iterator into n", "Rarely: buffers everything the fastest consumer is ahead by"]
            ]),
            B.cmp("Clever one-liner", ["Three nested fors and two ifs", "Side effects inside the expression", "Hard to debug or annotate"],
                  "Readable code", ["One loop and one filter per comprehension", "A named helper generator for complex steps", "A plain for loop when you need statements"]),
            B.tip("If you would need a comment to explain a comprehension, write a loop or a named generator function instead. Readability is the idiom."),
            B.cue("<strong>Interview cue:</strong> reaching for <code class='tok'>batched</code>, <code class='tok'>pairwise</code> or <code class='tok'>Counter</code> instead of index arithmetic shows standard-library fluency; mention the version they arrived in if your team pins older Pythons."),
            B.key("<strong>Comprehensions build; itertools streams.</strong> Keep each expression to one idea, and drop to a loop as soon as it stops reading like a sentence.")
          ]),
          L("context-managers", "Context managers and ExitStack", "with guarantees cleanup; contextmanager makes writing one a five-line job; ExitStack handles a dynamic number of resources.", 8, ["with", "contextlib", "exitstack"], [
            B.p("<code class='tok'>with expr as x:</code> calls <code class='tok'>__enter__</code>, runs the body, then always calls <code class='tok'>__exit__(exc_type, exc, tb)</code>, whether the body returned, raised, or hit <code class='tok'>break</code>. That is try/finally, packaged and reusable."),
            B.code("python", [
              "from contextlib import contextmanager, ExitStack, suppress",
              "import time",
              "",
              "@contextmanager",
              "def timed(label: str):",
              "    start = time.perf_counter()",
              "    try:",
              "        yield",
              "    finally:",
              "        elapsed = time.perf_counter() - start",
              "        log.info(\"timed\", extra={\"label\": label, \"ms\": round(elapsed * 1000, 1)})",
              "",
              "with ExitStack() as stack:",
              "    files = [stack.enter_context(open(p, encoding=\"utf-8\")) for p in paths]",
              "    stack.callback(cleanup_temp_dir)",
              "    ...                       # all closed in reverse order on exit",
              "",
              "with suppress(FileNotFoundError):",
              "    Path(\"stale.lock\").unlink()"
            ]),
            B.table(["Tool", "Purpose"], [
              ["<code class='tok'>contextlib.contextmanager</code>", "Write a context manager as a generator"],
              ["<code class='tok'>ExitStack</code> / <code class='tok'>AsyncExitStack</code>", "Dynamic or conditional resources"],
              ["<code class='tok'>suppress(*excs)</code>", "Ignore specific, expected exceptions"],
              ["<code class='tok'>closing(obj)</code>", "Call obj.close() for things without __exit__"],
              ["<code class='tok'>nullcontext()</code>", "A do-nothing stand-in when a resource is optional"]
            ]),
            B.trap("Returning a truthy value from <code class='tok'>__exit__</code> swallows the exception. In a generator-based manager, catching an exception around <code class='tok'>yield</code> without re-raising does the same. Suppress only what you name."),
            B.p("Trade-off: context managers tie lifetime to lexical scope. That is perfect for files, locks, transactions and temporary settings; it is awkward for resources that must outlive a block, such as a connection pool, which belongs in an application lifespan hook instead."),
            B.quiz("idiom-iteration"),
            B.cue("<strong>Spotting it in a prompt:</strong> any \"make sure X is always released/restored/rolled back\" requirement. Answer with a context manager and say which exceptions it lets through."),
            B.key("<strong>with is try/finally you can name and reuse.</strong> Put cleanup in finally, suppress nothing by accident, and use ExitStack when the count of resources is dynamic.")
          ])
        ]
      },
      {
        id: "stdlib",
        name: "Batteries worth knowing",
        icon: "wrench",
        lessons: [
          L("collections-module", "collections: the right container", "Counter, defaultdict, deque, namedtuple and ChainMap each replace a page of hand-written bookkeeping.", 7, ["collections", "deque", "counter"], [
            B.p("Before writing a helper class, check <code class='tok'>collections</code>. Each type encodes a common access pattern with C-level speed and a well-known name, which makes your intent obvious to reviewers."),
            B.table(["Type", "Replaces", "Watch out for"], [
              ["<code class='tok'>Counter</code>", "dict of manual counts; <code class='tok'>most_common(n)</code>", "Missing keys read as 0; arithmetic drops non-positive counts"],
              ["<code class='tok'>defaultdict(list)</code>", "<code class='tok'>setdefault</code> grouping", "Merely reading a missing key inserts it"],
              ["<code class='tok'>deque(maxlen=n)</code>", "list with pop(0); ring buffers", "Indexing the middle is O(n)"],
              ["<code class='tok'>OrderedDict</code>", "LRU tracking via <code class='tok'>move_to_end</code>", "Plain dicts already keep insertion order (3.7+)"],
              ["<code class='tok'>ChainMap</code>", "Layered lookups (CLI > env > defaults)", "Writes go to the first mapping only"],
              ["<code class='tok'>namedtuple</code>", "Tuples with field names", "Prefer typing.NamedTuple or a dataclass for typed code"]
            ]),
            B.code("python", [
              "from collections import Counter, defaultdict, deque",
              "",
              "top = Counter(word.lower() for word in words).most_common(3)",
              "",
              "by_team = defaultdict(list)",
              "for user in users:",
              "    by_team[user.team].append(user)",
              "",
              "recent = deque(maxlen=100)",
              "recent.append(event)     # oldest silently dropped at 101"
            ]),
            B.stat([["O(1)", "deque append/pop at either end"], ["O(n)", "list.pop(0) or insert(0, x)"], ["3.7+", "dicts preserve insertion order"]]),
            B.tip("For a sorted container with fast insertion, the standard library offers <code class='tok'>bisect</code> on a list (O(n) insert, O(log n) search) and <code class='tok'>heapq</code> for priority queues. Reach for a third-party sorted container only when profiling says so."),
            B.cue("<strong>Interview cue:</strong> naming <code class='tok'>deque</code> for a sliding window or <code class='tok'>Counter</code> for frequency problems signals you know the cost model, not just the syntax."),
            B.key("<strong>Pick the container by access pattern.</strong> Counter counts, defaultdict groups, deque queues, ChainMap layers, and a plain dict already remembers order.")
          ]),
          L("pathlib-io", "pathlib, files and encodings", "Treat paths as objects, always name the encoding, and write files atomically so a crash never leaves half a config behind.", 8, ["pathlib", "io", "encoding"], [
            B.p("<code class='tok'>pathlib.Path</code> models a filesystem path as an object with operators and methods, replacing string concatenation and a scattering of <code class='tok'>os.path</code> calls. It is cross-platform by construction."),
            B.code("python", [
              "from pathlib import Path",
              "import os, tempfile",
              "",
              "root = Path(__file__).resolve().parent",
              "cfg = root / \"config\" / \"app.toml\"",
              "text = cfg.read_text(encoding=\"utf-8\")",
              "for p in (root / \"data\").glob(\"*.csv\"):",
              "    print(p.stem, p.stat().st_size)",
              "",
              "def write_atomic(path: Path, data: str) -> None:",
              "    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name, suffix=\".tmp\")",
              "    try:",
              "        with os.fdopen(fd, \"w\", encoding=\"utf-8\") as fh:",
              "            fh.write(data)",
              "            fh.flush()",
              "            os.fsync(fh.fileno())",
              "        os.replace(tmp, path)       # atomic rename on the same filesystem",
              "    except BaseException:",
              "        Path(tmp).unlink(missing_ok=True)",
              "        raise"
            ]),
            B.table(["Need", "Use"], [
              ["Text with a known encoding", "<code class='tok'>open(p, encoding=\"utf-8\")</code>"],
              ["Bytes", "<code class='tok'>open(p, \"rb\")</code> / <code class='tok'>read_bytes()</code>"],
              ["Huge file", "Iterate the file object line by line"],
              ["CSV", "<code class='tok'>csv</code> module with <code class='tok'>newline=\"\"</code>"],
              ["Temporary files", "<code class='tok'>tempfile.TemporaryDirectory()</code> as a context manager"],
              ["Package data", "<code class='tok'>importlib.resources.files(pkg)</code>, not __file__ hacks"]
            ]),
            B.warn("The implicit text encoding comes from the locale. Code that works on a developer laptop can fail in a minimal container or on Windows. Pass <code class='tok'>encoding=\"utf-8\"</code> explicitly until every Python you support defaults to UTF-8 mode, and consider enabling <code class='tok'>-X warn_default_encoding</code> in CI."),
            B.trap("Path traversal: joining a user-supplied name onto a base directory can escape it via <code class='tok'>..</code> or an absolute path. Resolve the result and check <code class='tok'>candidate.is_relative_to(base)</code> before opening."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"a crash left a corrupt file\" means atomic writes: temp file in the same directory, fsync, os.replace."),
            B.key("<strong>Paths are objects, text has an encoding, writes should be atomic.</strong> Those three habits remove most file-handling bugs before they ship.")
          ]),
          L("datetime-zones", "datetime, zoneinfo and time", "Store aware UTC, convert at the edges, measure durations with a monotonic clock, and know how DST bends arithmetic.", 8, ["datetime", "timezone", "zoneinfo"], [
            B.p("A <strong>naive</strong> datetime has no timezone; an <strong>aware</strong> one carries a <code class='tok'>tzinfo</code>. Mixing them raises on comparison, which is a good thing. The production rule is simple: <strong>aware UTC inside the system, local time only at the user's edge.</strong>"),
            B.code("python", [
              "from datetime import datetime, timedelta, timezone",
              "from zoneinfo import ZoneInfo",
              "import time",
              "",
              "now = datetime.now(timezone.utc)                 # store this",
              "local = now.astimezone(ZoneInfo(\"Asia/Kolkata\"))   # show this",
              "parsed = datetime.fromisoformat(\"2026-03-29T01:30:00+00:00\")",
              "",
              "start = time.monotonic()        # durations: immune to clock changes",
              "do_work()",
              "elapsed = time.monotonic() - start"
            ]),
            B.table(["Pitfall", "Why it bites", "Do instead"], [
              ["<code class='tok'>datetime.utcnow()</code>", "Naive value that only looks like UTC; deprecated in 3.12", "<code class='tok'>datetime.now(timezone.utc)</code>"],
              ["Fixed offsets like +05:00 for a city", "Offsets change with DST and politics", "IANA names via <code class='tok'>ZoneInfo</code>"],
              ["Same-zone subtraction across DST", "Python subtracts wall times when tzinfo is identical", "Convert both to UTC first"],
              ["<code class='tok'>time.time()</code> for timeouts", "Wall clock can jump (NTP, manual changes)", "<code class='tok'>time.monotonic()</code>"],
              ["Ambiguous local times", "1:30 happens twice when clocks fall back", "Use the <code class='tok'>fold</code> attribute, or avoid local arithmetic"]
            ]),
            B.code("python", [
              "tz = ZoneInfo(\"Europe/Berlin\")",
              "a = datetime(2026, 3, 28, 12, tzinfo=tz)",
              "b = a + timedelta(days=1)       # 12:00 next day, wall clock",
              "(b - a)                         # 1 day, 0:00:00 (wall clock)",
              "(b.astimezone(timezone.utc) - a.astimezone(timezone.utc))   # 23:00:00 elapsed"
            ]),
            B.tip("Serialize timestamps as ISO 8601 with an explicit offset (<code class='tok'>isoformat()</code> on an aware value). It sorts lexically in UTC, round-trips with <code class='tok'>fromisoformat</code>, and every downstream system can parse it."),
            B.cue("<strong>Interview cue:</strong> for scheduling questions, separate \"instant in time\" (UTC) from \"wall-clock intention\" (\"9am in the user's zone\"). Store the intention with its zone name when it must recur."),
            B.key("<strong>UTC inside, local at the edge, monotonic for durations.</strong> And remember that same-zone datetime arithmetic is wall-clock arithmetic.")
          ]),
          L("errors-exceptions", "Exceptions with intent", "A clean hierarchy, explicit chaining, narrow handlers, notes and ExceptionGroup let failures carry meaning instead of noise.", 9, ["exceptions", "chaining", "exceptiongroup"], [
            B.p("Python favours <strong>EAFP</strong>, easier to ask forgiveness than permission: try the operation and handle the specific failure, instead of checking every precondition first. That only works if your handlers are narrow and your own exceptions say what went wrong in domain language."),
            B.code("python", [
              "class BillingError(Exception):",
              "    \"\"\"Base for errors callers of the billing module may handle.\"\"\"",
              "class CardDeclined(BillingError):",
              "    def __init__(self, reason: str, retryable: bool):",
              "        super().__init__(reason)",
              "        self.reason, self.retryable = reason, retryable",
              "",
              "def charge(order):",
              "    try:",
              "        resp = gateway.charge(order.total)",
              "    except TimeoutError as err:",
              "        err.add_note(f\"order={order.id}\")        # 3.11+",
              "        raise BillingError(\"gateway timeout\") from err",
              "    if resp.declined:",
              "        raise CardDeclined(resp.reason, resp.retryable)"
            ]),
            B.table(["Construct", "Meaning"], [
              ["<code class='tok'>raise X from err</code>", "Explicit cause (<code class='tok'>__cause__</code>); traceback says \"direct cause\""],
              ["Raise inside except without from", "Implicit context (<code class='tok'>__context__</code>); \"during handling ... another exception\""],
              ["<code class='tok'>raise X from None</code>", "Hide the context when it is pure noise"],
              ["<code class='tok'>err.add_note(...)</code>", "Attach context without changing the type"],
              ["<code class='tok'>ExceptionGroup</code> + <code class='tok'>except*</code>", "Several independent failures at once, e.g. from a TaskGroup"]
            ]),
            B.code("python", [
              "try:",
              "    async with asyncio.TaskGroup() as tg:",
              "        tg.create_task(sync_users())",
              "        tg.create_task(sync_orders())",
              "except* ConnectionError as group:",
              "    for exc in group.exceptions:",
              "        log.warning(\"sync failed\", exc_info=exc)"
            ]),
            B.cmp("Noisy handling", ["<code class='tok'>except:</code> or <code class='tok'>except Exception: pass</code>", "Log and re-raise at every layer", "Stringly-typed errors parsed by callers"],
                  "Intentional handling", ["Catch the narrowest type where you can act", "Log once, at the boundary that decides", "A small hierarchy with useful attributes"]),
            B.trap("<code class='tok'>KeyboardInterrupt</code>, <code class='tok'>SystemExit</code> and <code class='tok'>asyncio.CancelledError</code> derive from <code class='tok'>BaseException</code>. A bare <code class='tok'>except:</code> catches them and turns Ctrl-C or task cancellation into a hang."),
            B.quiz("idiom-stdlib"),
            B.cue("<strong>Interview cue:</strong> \"I catch where I can act, chain with from to keep the cause, and log once at the boundary\" is a complete error-handling philosophy in one sentence."),
            B.key("<strong>Exceptions are part of your API.</strong> Define a small hierarchy, chain causes, catch narrowly, and never swallow BaseException.")
          ])
        ]
      }
    ]
  };
})();
