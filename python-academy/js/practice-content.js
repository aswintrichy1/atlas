/* Pyxis practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.lang / idiom / types / pkg /
   test / conc / perf / web / data / prod. */
window.PyxisPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#fbbf24",
      icon: "map",
      summary: "Outlines you can talk through end to end for the Python service, pipeline and incident problems that come up most."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#60a5fa",
      icon: "quiz",
      summary: "Timed prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions a Python engineering round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fb923c",
      icon: "md",
      summary: "Commands, defaults and rules of thumb worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#c084fc",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "fastapi-orders",
      title: "Design an order API in FastAPI",
      subtitle: "From request model to committed row, with retries, pools and telemetry.",
      timebox: "40 min",
      prompt: "Design POST /orders for a FastAPI service backed by PostgreSQL. Mobile clients retry on flaky networks, a payment provider must be called, and other teams consume an OrderPlaced event. Expect 300 requests per second at peak across several pods.",
      related: [
        { label: "FastAPI typed endpoints", route: "#/web/fastapi/fastapi-basics" },
        { label: "Dependencies and sessions", route: "#/web/fastapi/dependency-injection" },
        { label: "Migrations and pools", route: "#/web/platform/migrations-pools" }
      ],
      outline: [
        {
          title: "Clarify the contract",
          items: [
            "Separate OrderIn and OrderOut models; 201 on create, 422 for invalid input, stable error codes for business failures.",
            "An Idempotency-Key header so client retries do not create duplicate orders."
          ]
        },
        {
          title: "Structure the code",
          items: [
            "Thin async handler; an order service owns the transaction; a repository wraps SQLAlchemy.",
            "Annotated dependency aliases for the session and current user; dependency_overrides in tests."
          ]
        },
        {
          title: "Keep I/O bounded",
          items: [
            "Async database driver and HTTP client created in the lifespan; timeouts on every outbound call.",
            "Payment call outside the database transaction, with the idempotency key forwarded to the provider."
          ]
        },
        {
          title: "Size the platform",
          items: [
            "Little's law: 300 rps \u00d7 20 ms \u2248 6 connections; pods \u00d7 workers \u00d7 (pool_size + max_overflow) under max_connections.",
            "Write the event to an outbox table in the same transaction; a relay publishes it."
          ]
        },
        {
          title: "Observe and ship",
          items: [
            "OpenTelemetry spans for request, queries and payment call; trace ID in structured logs.",
            "Readiness checks the database; liveness does not. Expand-and-contract migrations run as a deploy job."
          ]
        }
      ]
    },
    {
      id: "event-loop-stall",
      title: "Incident: the async service freezes under load",
      subtitle: "Diagnose a blocked event loop from symptoms, dumps and code.",
      timebox: "30 min",
      prompt: "An async FastAPI service has p99 latency jump from 80 ms to 8 s when traffic rises. CPU on each pod sits near 100% of one core. Health checks time out intermittently and pods restart. The last release added PDF generation to one endpoint.",
      related: [
        { label: "The event loop", route: "#/conc/asyncio/event-loop" },
        { label: "Executors", route: "#/conc/parallel/executors" },
        { label: "cProfile, py-spy and flame graphs", route: "#/perf/measure/cprofile" }
      ],
      outline: [
        {
          title: "Stabilise",
          items: [
            "Roll back or feature-flag the PDF endpoint; separate liveness from slow dependencies to stop restart storms."
          ]
        },
        {
          title: "Confirm the cause",
          items: [
            "py-spy dump on a live pod: the event loop thread is inside the PDF library, not in an await.",
            "Enable asyncio debug mode in staging to log slow callbacks over 100 ms."
          ]
        },
        {
          title: "Fix",
          items: [
            "Move CPU-heavy rendering to a ProcessPoolExecutor via run_in_executor, or to a background worker queue.",
            "Bound concurrency with a Semaphore so a burst cannot queue unlimited render jobs."
          ]
        },
        {
          title: "Prevent",
          items: [
            "A load test that asserts p99 with the endpoint mixed in; a lint or review rule against blocking calls in async def.",
            "Event loop lag as a metric with an alert."
          ]
        }
      ]
    },
    {
      id: "nightly-pipeline",
      title: "Design a nightly revenue pipeline",
      subtitle: "Incremental extraction, validation, engine choice and safe re-runs.",
      timebox: "40 min",
      prompt: "Each night, aggregate the previous day's orders (about 40 GB of Parquet in object storage) into a revenue table in Snowflake used by finance dashboards. Late-arriving orders up to 48 hours are common, and the job sometimes needs backfills for a month.",
      related: [
        { label: "Designing batch pipelines", route: "#/data/pipelines/pipeline-design" },
        { label: "Choosing a data engine", route: "#/data/frames/choosing-engine" },
        { label: "Snowpark for Python", route: "#/data/pipelines/snowpark" }
      ],
      outline: [
        {
          title: "Shape the run",
          items: [
            "Parameterise by run date and environment; extract with a 48-hour overlap window.",
            "Recompute affected dates and overwrite their partitions, or MERGE on order_id."
          ]
        },
        {
          title: "Choose the engine",
          items: [
            "If the data is staged into Snowflake, push down with Snowpark; otherwise Polars lazy or DuckDB on one machine handles 40 GB of Parquet.",
            "Avoid to_pandas on full tables; collect only aggregates."
          ]
        },
        {
          title: "Validate",
          items: [
            "Schema contract on ingest; uniqueness of order_id; non-negative amounts.",
            "Reconcile totals against the source and alert on volume swings."
          ]
        },
        {
          title: "Test and operate",
          items: [
            "Pure transform functions tested with tiny frames; SQL tested in DuckDB or Snowpark local testing.",
            "Backfills as a throttled loop over dates; freshness and row-count metrics per run."
          ]
        }
      ]
    },
    {
      id: "packaging-monorepo",
      title: "Untangle packaging for a growing codebase",
      subtitle: "Environments, locks, tooling and CI for several Python services.",
      timebox: "30 min",
      prompt: "Five services share a repository. Each has a requirements.txt edited by hand, CI installs whatever resolves today, and a minor library upgrade broke production last week. Propose a packaging and tooling setup.",
      related: [
        { label: "pip and uv", route: "#/pkg/envs/pip-uv" },
        { label: "Locking", route: "#/pkg/envs/locking" },
        { label: "pre-commit and CI", route: "#/pkg/build/pre-commit-ci" }
      ],
      outline: [
        {
          title: "Declare and lock",
          items: [
            "pyproject.toml per package with ranges for direct dependencies; one workspace lockfile with hashes.",
            "uv sync --locked in CI and images, so drift fails instead of shipping."
          ]
        },
        {
          title: "Shared code",
          items: [
            "Internal libraries as workspace packages installed editable in development, versioned when published."
          ]
        },
        {
          title: "Tooling",
          items: [
            "Ruff for lint and format, a type checker on changed packages, pre-commit running the same commands as CI."
          ]
        },
        {
          title: "Upgrades",
          items: [
            "Automated update PRs that refresh the lock, run the full matrix and pip-audit, merged deliberately."
          ]
        }
      ]
    },
    {
      id: "memory-leak-worker",
      title: "Incident: a worker is OOM-killed every few hours",
      subtitle: "Separate peak memory from retention and fix both.",
      timebox: "25 min",
      prompt: "A Celery-style worker processing invoices is killed for exceeding its 2 GiB container limit roughly every four hours. Restarts hide the problem, but in-flight jobs are lost each time.",
      related: [
        { label: "Memory profiling", route: "#/perf/measure/memory-profiling" },
        { label: "Caching without lying", route: "#/perf/speed/caching-perf" },
        { label: "Errors, retries and shutdown", route: "#/prod/config/errors-in-prod" }
      ],
      outline: [
        {
          title: "Classify",
          items: [
            "Steady growth over hours means retention; sudden spikes mean a large job loading everything at once."
          ]
        },
        {
          title: "Find the holder",
          items: [
            "tracemalloc snapshots diffed across batches; check unbounded lru_cache, module-level dicts and lists of results.",
            "If RSS grows but tracemalloc does not, look at native allocations with a native-aware profiler."
          ]
        },
        {
          title: "Fix",
          items: [
            "Bound caches, stream large files, and use slots or Arrow buffers for many small records.",
            "As a safety net, recycle workers after N tasks and acknowledge jobs only after completion so restarts are safe."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "data-model-25",
      title: "Python data model in 25 minutes",
      timebox: "25 min",
      prompt: "Explain what a = b = [] means, why a mutable default argument is a bug, and how __eq__ and __hash__ must relate for a class used as a dict key.",
      expected: [
        "Names refer to objects; assignment binds, never copies; is vs == distinguished.",
        "Defaults evaluated once at def time; the None-sentinel fix.",
        "Equal objects must hash equal; mutable fields in the hash break dict lookups.",
        "Mentions frozen dataclasses as a clean way to get value semantics."
      ],
      followups: [
        "Why does x += [1] behave differently for a list and a tuple held in a tuple?",
        "When would you implement __slots__?"
      ],
      links: [
        { label: "Names and objects", route: "#/lang/objects/names-objects" },
        { label: "Equality and hashing", route: "#/lang/objects/equality-hashing" }
      ]
    },
    {
      id: "asyncio-30",
      title: "asyncio in 30 minutes",
      timebox: "30 min",
      prompt: "Fetch 10,000 URLs from an internal service with at most 50 in flight, a 2-second timeout each, and clean cancellation if the whole job is aborted.",
      expected: [
        "One shared async client; a Semaphore or bounded worker pool for concurrency.",
        "asyncio.timeout per request and an overall deadline.",
        "TaskGroup for structured concurrency; CancelledError re-raised after cleanup.",
        "Results streamed or written in batches rather than held all in memory."
      ],
      followups: [
        "One response parser is CPU-heavy. What happens to the loop and how do you fix it?",
        "How do threads compare here, with and without the free-threaded build?"
      ],
      links: [
        { label: "Tasks and TaskGroups", route: "#/conc/asyncio/tasks-taskgroups" },
        { label: "Cancellation and timeouts", route: "#/conc/asyncio/cancellation-timeouts" },
        { label: "Backpressure", route: "#/conc/asyncio/backpressure" }
      ]
    },
    {
      id: "typing-25",
      title: "Typing a library API in 25 minutes",
      timebox: "25 min",
      prompt: "Type a small caching library: a get_or_load function generic over the value type, a pluggable storage backend, and a decorator that preserves the wrapped function's signature.",
      expected: [
        "Generic function with a type parameter linking loader return type and result.",
        "A Protocol for the storage backend so users need not inherit.",
        "ParamSpec for the decorator so arguments stay checked.",
        "A strategy for strictness: strict on the public API, gradual elsewhere."
      ],
      followups: [
        "Why is list[Cat] not a list[Animal], and what would you accept instead?",
        "When do you prefer TypedDict over a dataclass?"
      ],
      links: [
        { label: "Generics and TypeVar", route: "#/types/generics/generics-typevar" },
        { label: "Protocols", route: "#/types/generics/protocols" },
        { label: "Variance", route: "#/types/generics/variance" }
      ]
    },
    {
      id: "testing-25",
      title: "Testing strategy in 25 minutes",
      timebox: "25 min",
      prompt: "You inherit a service with 40% coverage and flaky tests that mock everything. Describe how you would make the suite trustworthy without stopping feature work.",
      expected: [
        "Mock only at process boundaries; use fakes and real dependencies in containers for integration.",
        "Fixture scopes chosen deliberately; isolation per test for state.",
        "Property-based tests for parsers and invariants; contract tests for service boundaries.",
        "Mutation testing on critical modules to find weak assertions rather than chasing coverage."
      ],
      followups: [
        "A test passes alone and fails in the full run. What do you check first?",
        "Where does patch need to point, and why?"
      ],
      links: [
        { label: "Fixtures", route: "#/test/pytest/fixtures" },
        { label: "Mocking", route: "#/test/pytest/mocking" },
        { label: "Mutation testing", route: "#/test/beyond/mutation-testing" }
      ]
    },
    {
      id: "dataframes-25",
      title: "pandas vs Polars in 25 minutes",
      timebox: "25 min",
      prompt: "A pandas job that joins two 15 GB Parquet datasets and aggregates them runs out of memory on a 32 GB machine. What are your options?",
      expected: [
        "Read only needed columns; filter before join; check join cardinality.",
        "Polars lazy with pushdown and streaming, or DuckDB with spilling.",
        "Push down to the warehouse if the data already lives there.",
        "Tests on small frames to prove the rewrite gives identical results."
      ],
      followups: [
        "Why can a lazy plan read less data than eager code?",
        "When would you keep pandas anyway?"
      ],
      links: [
        { label: "Polars and lazy plans", route: "#/data/frames/polars-lazy" },
        { label: "Arrow, Parquet and DuckDB", route: "#/data/frames/arrow-duckdb" },
        { label: "Testing data pipelines", route: "#/data/pipelines/pipeline-testing" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Language fluency \u2014 data model, mutability, scoping, iteration and idiomatic standard library use",
      "Type and API design \u2014 typing, generics, Protocols and clear contracts",
      "Tooling and packaging \u2014 environments, locks, lint, CI and reproducible builds",
      "Concurrency and performance \u2014 GIL, asyncio, profiling and cost models",
      "Services and data \u2014 web frameworks, databases, pipelines and validation",
      "Operational maturity and communication \u2014 config, secrets, observability, testing and trade-offs"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Writes working scripts but cannot yet explain the behaviour behind them or operate them safely.",
        signals: [
          "Surprised by aliasing and mutable defaults.",
          "Uses time.sleep or blocking clients inside async def.",
          "Installs packages globally; no lockfile.",
          "Credentials committed in settings files."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Builds typed, tested services and pipelines with good structure, but scale and failure handling are partial.",
        signals: [
          "Type hints, dataclasses and pytest fixtures used well; Ruff in CI.",
          "Chooses threads, processes or asyncio correctly for simple cases.",
          "Spots N+1 queries and fixes them with eager loading.",
          "Sets timeouts but not backpressure, pool arithmetic or idempotent writes."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Explains mechanisms precisely, measures before optimising, and designs for re-runs, failure and operation.",
        signals: [
          "Explains descriptors, MRO, variance and cancellation semantics accurately.",
          "Profiles with sampling tools and argues with Amdahl's law.",
          "Locked, reproducible builds; supply-chain controls; contract and mutation testing where they pay.",
          "Brings idempotency, validation contracts, SLOs and rollback plans unprompted."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "uv-commands",
      title: "uv everyday commands",
      summary: "The project workflow in eight commands.",
      items: [
        "uv init \u2014 new project with pyproject.toml.",
        "uv add httpx / uv add --dev pytest \u2014 declare and install, updating the lock.",
        "uv lock \u2014 resolve and write uv.lock without installing.",
        "uv sync --locked \u2014 install exactly the lock; fail if it is stale (use in CI).",
        "uv run pytest \u2014 run a command inside the project environment.",
        "uv python install 3.13 \u2014 fetch an interpreter.",
        "uv build \u2014 sdist and wheel.",
        "uv export --format requirements-txt \u2014 pinned file with hashes for other tools."
      ]
    },
    {
      id: "pytest-flags",
      title: "pytest flags worth remembering",
      summary: "Run, select and debug tests quickly.",
      items: [
        "-x stop at first failure; --lf rerun last failures; --ff failures first.",
        "-k \"expr\" select by name; -m slow select by marker.",
        "-q quieter output; -vv full assertion diffs.",
        "--pdb drop into the debugger on failure.",
        "--fixtures list available fixtures; --setup-show trace fixture setup.",
        "-p no:randomly or -p randomly to control ordering plugins; -n auto with xdist for parallel runs."
      ]
    },
    {
      id: "asyncio-rules",
      title: "asyncio rules",
      summary: "Six rules that prevent most async bugs.",
      items: [
        "Never block the loop: no time.sleep, sync HTTP or heavy CPU in async def.",
        "Keep a reference to every task, or use TaskGroup.",
        "Put a timeout on every await that touches the network.",
        "Re-raise CancelledError after cleanup; never swallow it.",
        "Bound concurrency with Semaphore or bounded queues.",
        "Offload CPU work with run_in_executor or to a worker process."
      ]
    },
    {
      id: "perf-numbers",
      title: "Rough performance numbers",
      summary: "Orders of magnitude for back-of-envelope estimates.",
      items: [
        "Python function call: ~50\u2013100 ns; attribute lookup: tens of ns.",
        "set or dict lookup: ~30\u201360 ns regardless of size; list scan: ~10 ns per element.",
        "Same-region network round trip: 0.1\u20131 ms; indexed DB query: 1\u201310 ms.",
        "Vectorised NumPy arithmetic: often 10\u2013100\u00d7 a Python loop.",
        "Int object: ~28 bytes; empty dict: ~64 bytes; slots instance much smaller than dict-based."
      ]
    },
    {
      id: "prod-checklist",
      title: "Production service checklist",
      summary: "Before a Python service takes real traffic.",
      items: [
        "Typed settings validated at startup; secrets from a secret store only.",
        "JSON logs with request and trace IDs; RED metrics per route.",
        "Timeouts on all I/O; bounded retries with jitter; pool sizes from arithmetic.",
        "Separate liveness and readiness; graceful SIGTERM handling.",
        "Multi-stage non-root image built from the lockfile; vulnerability scan in CI.",
        "Backward-compatible migrations; rollback rehearsed."
      ]
    }
  ],

  glossary: [
    {
      id: "aliasing",
      term: "Aliasing",
      definition: "Two or more names referring to the same object, so a mutation through one is visible through all of them.",
      useIt: "Name the shared object: 'both config dicts alias one object, so the test's change leaked into the next test'.",
      links: [{ label: "Mutability and aliasing", route: "#/lang/objects/mutability-aliasing" }]
    },
    {
      id: "dunder",
      term: "Dunder method",
      definition: "A double-underscore method such as __len__ or __iter__ that lets a class plug into built-in syntax and protocols.",
      useIt: "Tie it to the protocol: 'implementing __iter__ makes the class usable in for loops and comprehensions'.",
      links: [{ label: "Dunder protocols", route: "#/lang/objects/dunder-protocols" }]
    },
    {
      id: "closure",
      term: "Closure",
      definition: "A function that keeps references to variables from the enclosing scope where it was defined, looked up when it runs.",
      useIt: "Mention late binding: 'the lambdas close over i, so they all see its final value'.",
      links: [{ label: "Scope and closures", route: "#/lang/runtime/scope-closures" }]
    },
    {
      id: "decorator",
      term: "Decorator",
      definition: "A callable that takes a function or class and returns a replacement, applied with @ syntax at definition time.",
      useIt: "Say what it preserves: 'the decorator uses functools.wraps and ParamSpec so metadata and signature survive'.",
      links: [{ label: "Decorators", route: "#/lang/runtime/decorators" }]
    },
    {
      id: "descriptor",
      term: "Descriptor",
      definition: "An object defining __get__, __set__ or __delete__ that controls attribute access when stored on a class.",
      useIt: "Connect it to familiar features: 'property and bound methods are descriptors'.",
      links: [{ label: "Descriptors and properties", route: "#/lang/runtime/descriptors-properties" }]
    },
    {
      id: "mro",
      term: "Method resolution order",
      definition: "The linearised class order Python searches for attributes, which super() follows in multiple inheritance.",
      useIt: "Be precise: 'super() calls the next class in the MRO, which may not be the parent you see'.",
      links: [{ label: "Classes and MRO", route: "#/lang/runtime/classes-mro" }]
    },
    {
      id: "generator",
      term: "Generator",
      definition: "A function using yield that returns a lazy iterator, producing values on demand and keeping its state between them.",
      useIt: "Emphasise memory: 'the generator streams rows, so peak memory is one row, not the file'.",
      links: [{ label: "Generators", route: "#/idiom/iteration/generators" }]
    },
    {
      id: "context-manager",
      term: "Context manager",
      definition: "An object used with with whose __exit__ always runs, guaranteeing cleanup on success and on exceptions.",
      useIt: "Name the resource and the guarantee: 'the lock is released even if the body raises'.",
      links: [{ label: "Context managers", route: "#/idiom/iteration/context-managers" }]
    },
    {
      id: "narrowing",
      term: "Type narrowing",
      definition: "A type checker refining a broad type after a check such as isinstance or is None, so later code sees a precise type.",
      useIt: "Show the check: 'after the None guard, the checker knows user is User'.",
      links: [{ label: "Unions and narrowing", route: "#/types/basics/unions-narrowing" }]
    },
    {
      id: "protocol",
      term: "Protocol",
      definition: "A structural type: any object with the required methods and attributes satisfies it, without inheriting.",
      useIt: "Contrast with ABCs: 'callers pass anything with read(); they do not need to subclass our base'.",
      links: [{ label: "Protocols", route: "#/types/generics/protocols" }]
    },
    {
      id: "variance",
      term: "Variance",
      definition: "How subtyping of type arguments maps to subtyping of generic types: covariant, contravariant or invariant.",
      useIt: "Use the example: 'list is invariant, so accept Sequence[Animal] if you only read'.",
      links: [{ label: "Variance", route: "#/types/generics/variance" }]
    },
    {
      id: "lockfile",
      term: "Lockfile",
      definition: "A record of the exact versions and hashes of every resolved dependency, used for reproducible installs.",
      useIt: "Tie it to CI: 'CI installs with --locked, so it fails if the lock is stale instead of upgrading silently'.",
      links: [{ label: "Locking", route: "#/pkg/envs/locking" }]
    },
    {
      id: "wheel",
      term: "Wheel",
      definition: "A built distribution that installs by unpacking, tagged for the Python versions and platforms it supports.",
      useIt: "Mention tags: 'there is no wheel for this platform, so pip falls back to building the sdist'.",
      links: [{ label: "Wheels and sdists", route: "#/pkg/build/wheels-sdists" }]
    },
    {
      id: "fixture",
      term: "Fixture",
      definition: "A pytest-managed provider of test setup and teardown, requested by parameter name and cached per scope.",
      useIt: "State the scope: 'the database container is session-scoped; each test gets a function-scoped transaction'.",
      links: [{ label: "Fixtures", route: "#/test/pytest/fixtures" }]
    },
    {
      id: "property-test",
      term: "Property-based test",
      definition: "A test that checks an invariant over many generated inputs and shrinks any failure to a minimal case.",
      useIt: "Name the property: 'decode(encode(x)) == x for any valid record'.",
      links: [{ label: "Property-based testing", route: "#/test/beyond/property-based" }]
    },
    {
      id: "mutation-score",
      term: "Mutation score",
      definition: "The share of injected code changes that the test suite detects; surviving mutants reveal weak assertions.",
      useIt: "Contrast with coverage: 'coverage was 95% but half the mutants survived, so assertions are thin'.",
      links: [{ label: "Mutation testing", route: "#/test/beyond/mutation-testing" }]
    },
    {
      id: "gil",
      term: "GIL",
      definition: "CPython's global interpreter lock, allowing one thread at a time to execute Python bytecode in an interpreter.",
      useIt: "Be specific: 'the GIL limits CPU-bound threads, but our workload waits on I/O, which releases it'.",
      links: [{ label: "The GIL", route: "#/conc/parallel/gil" }]
    },
    {
      id: "event-loop",
      term: "Event loop",
      definition: "The asyncio scheduler that runs coroutines until they await and resumes them when their I/O or timer is ready.",
      useIt: "Describe the failure mode: 'the sync call blocked the loop, so every request in the worker stalled'.",
      links: [{ label: "The event loop", route: "#/conc/asyncio/event-loop" }]
    },
    {
      id: "structured-concurrency",
      term: "Structured concurrency",
      definition: "Running child tasks inside a scope that waits for all of them and cancels siblings on failure, as asyncio.TaskGroup does.",
      useIt: "Point at lifetimes: 'no task outlives the request because they all run in a TaskGroup'.",
      links: [{ label: "Tasks and TaskGroups", route: "#/conc/asyncio/tasks-taskgroups" }]
    },
    {
      id: "backpressure",
      term: "Backpressure",
      definition: "Slowing or rejecting producers when consumers fall behind, so queues and memory stay bounded.",
      useIt: "Name the bound: 'the queue has maxsize 100, so the producer awaits instead of growing memory'.",
      links: [{ label: "Backpressure", route: "#/conc/asyncio/backpressure" }]
    },
    {
      id: "flame-graph",
      term: "Flame graph",
      definition: "A visualisation of sampled stacks where width shows share of time, used to find where CPU goes.",
      useIt: "Read it out loud: 'json encoding is a wide plateau with no children, so that is our self time'.",
      links: [{ label: "cProfile, py-spy and flame graphs", route: "#/perf/measure/cprofile" }]
    },
    {
      id: "n-plus-one",
      term: "N+1 query",
      definition: "One query for a list plus one more for each row's related data, so query count grows with result size.",
      useIt: "Give the fix: 'selectinload turns 201 queries into 2'.",
      links: [{ label: "SQLAlchemy 2.0 essentials", route: "#/web/platform/sqlalchemy" }]
    },
    {
      id: "pushdown",
      term: "Predicate and projection pushdown",
      definition: "An optimiser moving filters and column selection into the data scan so less data is read at all.",
      useIt: "Tie to the engine: 'the lazy Polars plan reads three columns and skips row groups by statistics'.",
      links: [{ label: "Polars and lazy plans", route: "#/data/frames/polars-lazy" }]
    },
    {
      id: "idempotent",
      term: "Idempotent",
      definition: "An operation that produces the same final state whether it runs once or many times with the same input.",
      useIt: "Say how: 'the job overwrites the run date's partition, so a retry cannot duplicate rows'.",
      links: [{ label: "Designing batch pipelines", route: "#/data/pipelines/pipeline-design" }]
    },
    {
      id: "data-contract",
      term: "Data contract",
      definition: "An agreed, code-enforced schema and set of quality rules at a boundary between data producers and consumers.",
      useIt: "State the response: 'rows failing the contract go to quarantine and the run alerts'.",
      links: [{ label: "Data validation and contracts", route: "#/data/pipelines/data-validation" }]
    },
    {
      id: "twelve-factor",
      term: "Twelve-factor config",
      definition: "Keeping configuration in the environment so one build artefact runs unchanged in every environment.",
      useIt: "Add validation: 'settings come from the environment and are validated once at startup'.",
      links: [{ label: "Typed, layered configuration", route: "#/prod/config/twelve-factor-config" }]
    }
  ]
};
