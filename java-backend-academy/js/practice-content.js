/* Anvil practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.java / jvm / conc / boot / api /
   data / res / sec / test / prod. */
window.AnvilPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#ef4444",
      icon: "map",
      summary: "Outlines you can talk through end to end for the Spring backend design and incident problems that come up most."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
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
      summary: "The dimensions a Java backend round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Flags, settings and defaults worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#a78bfa",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "order-service",
      title: "Design an order service in Spring Boot",
      subtitle: "The classic backend design prompt: from HTTP request to committed order and published event.",
      timebox: "40 min",
      prompt: "Design the order-placement endpoint of a Spring Boot service: it validates a cart, reserves stock in an inventory service, charges a payment provider and publishes OrderPlaced for other teams. Clients are mobile apps on flaky networks.",
      related: [
        { label: "Idempotency keys", route: "#/api/rest/idempotency-keys" },
        { label: "Transactional outbox", route: "#/res/events/outbox" },
        { label: "Feature packaging", route: "#/boot/ioc/feature-packaging" }
      ],
      outline: [
        {
          title: "Clarify the contract",
          items: [
            "POST /orders with an Idempotency-Key header; 201 with Location on success, ProblemDetail on errors.",
            "Ask about volumes, latency targets and which steps may be asynchronous."
          ]
        },
        {
          title: "Structure the code",
          items: [
            "An orders feature package: thin controller, OrderService as the public API, repository and records for DTOs.",
            "Validation annotations for shape; credit and stock rules in the service."
          ]
        },
        {
          title: "Make retries safe",
          items: [
            "Claim the idempotency key with a unique insert; replay the stored response on retry.",
            "Forward the key to the payment provider so a crash between charge and commit is safe."
          ]
        },
        {
          title: "Keep transactions short and events reliable",
          items: [
            "No remote calls inside the database transaction; reserve and charge before or via a saga.",
            "Write OrderPlaced to an outbox table in the same transaction; relay to Kafka keyed by order id."
          ]
        },
        {
          title: "Contain failures and observe",
          items: [
            "Timeouts from the latency budget, one retry layer, breaker and bulkhead around the payment client.",
            "RED metrics per route, traces across inventory and payments, structured logs with order id."
          ]
        }
      ]
    },
    {
      id: "pool-exhaustion",
      title: "Latency spike: the connection pool is exhausted",
      subtitle: "An incident scenario testing diagnosis from metrics, dumps and code.",
      timebox: "30 min",
      prompt: "p99 latency of a Spring MVC service jumps from 120 ms to 30 s. Logs show 'Connection is not available, request timed out after 30000ms'. CPU is low. A release went out an hour ago.",
      related: [
        { label: "Connection pooling", route: "#/data/ops/connection-pooling" },
        { label: "@Transactional done right", route: "#/data/tx/transactional-basics" },
        { label: "JFR and thread dumps", route: "#/jvm/diagnose/jfr-dumps" }
      ],
      outline: [
        {
          title: "Stabilize first",
          items: [
            "Roll back the release if it correlates; check whether the database itself is healthy.",
            "Lower connection-timeout so requests fail fast instead of queueing for 30 s."
          ]
        },
        {
          title: "Find who holds connections",
          items: [
            "hikaricp_connections_pending and usage time; thread dumps showing threads inside transactions.",
            "Enable leak detection to log stack traces of long-held connections."
          ]
        },
        {
          title: "Likely root causes",
          items: [
            "A new remote HTTP call inside a @Transactional method, or a missing timeout on it.",
            "An N+1 query added to a hot path, or open-in-view rendering lazily loaded data."
          ]
        },
        {
          title: "Fix and prevent",
          items: [
            "Move remote calls outside the transaction; add timeouts; fix the fetch plan.",
            "Statement-count tests, a pool budget across the fleet, alerts on pending connections."
          ]
        }
      ]
    },
    {
      id: "virtual-threads-migration",
      title: "Move a service to virtual threads",
      subtitle: "A modernization scenario: what to change, what to measure, what breaks.",
      timebox: "30 min",
      prompt: "A Spring Boot 3 service on Java 21 handles 2,000 concurrent requests that mostly wait on two downstream HTTP APIs and PostgreSQL. The team wants to enable virtual threads. Plan it.",
      related: [
        { label: "Virtual threads in practice", route: "#/conc/loom/virtual-threads" },
        { label: "Bulkheads and rate limits", route: "#/res/calls/bulkheads-rate-limits" },
        { label: "Connection pooling", route: "#/data/ops/connection-pooling" }
      ],
      outline: [
        {
          title: "Enable and baseline",
          items: [
            "spring.threads.virtual.enabled=true behind a flag; load-test before and after at the same traffic.",
            "Record throughput, latency percentiles, pool pending and downstream error rates."
          ]
        },
        {
          title: "Protect what is still scarce",
          items: [
            "The DB pool and partner quotas now cap concurrency: add semaphores or bulkheads per dependency.",
            "Keep or tighten timeouts; unbounded concurrency amplifies slow dependencies."
          ]
        },
        {
          title: "Hunt pinning and thread-locals",
          items: [
            "JFR jdk.VirtualThreadPinned; replace synchronized around blocking I/O with ReentrantLock on JDK 21.",
            "Review heavy ThreadLocal caches that assumed a small fixed pool."
          ]
        },
        {
          title: "Roll out",
          items: [
            "Canary one instance, compare dashboards, then expand; keep the flag for fast rollback."
          ]
        }
      ]
    },
    {
      id: "breaking-api-change",
      title: "Ship a breaking API change without breaking clients",
      subtitle: "An evolution scenario across API, schema and consumers.",
      timebox: "25 min",
      prompt: "The customer API returns a single 'name' field. Product wants separate given and family names, and the database column must change too. Mobile clients update slowly.",
      related: [
        { label: "Versioning and OpenAPI", route: "#/api/contract/versioning-openapi" },
        { label: "Schema migrations", route: "#/data/ops/migrations" },
        { label: "Contract tests", route: "#/test/integration/contract-tests" }
      ],
      outline: [
        {
          title: "Additive first",
          items: [
            "Add givenName and familyName alongside name; keep name populated; no version bump needed.",
            "Mark name deprecated in OpenAPI and send Deprecation and Sunset headers."
          ]
        },
        {
          title: "Expand and contract the schema",
          items: [
            "Add new columns, write both, backfill in batches, switch reads, drop the old column in a later release."
          ]
        },
        {
          title: "Guard it in CI",
          items: [
            "OpenAPI diff against the released contract; consumer contract tests from the mobile and web teams."
          ]
        },
        {
          title: "Retire the old field",
          items: [
            "Track callers still reading name through metrics or logs; remove after the sunset date."
          ]
        }
      ]
    },
    {
      id: "memory-leak",
      title: "Pods restart with OOM every few hours",
      subtitle: "A JVM diagnostics scenario from symptom to fix.",
      timebox: "25 min",
      prompt: "A Spring service's pods are killed every few hours. Sometimes the logs show OutOfMemoryError: Java heap space, sometimes the container just disappears with exit code 137.",
      related: [
        { label: "Runtime data areas", route: "#/jvm/memory/memory-areas" },
        { label: "JFR and heap dumps", route: "#/jvm/diagnose/jfr-dumps" },
        { label: "Caching", route: "#/data/ops/caching" }
      ],
      outline: [
        {
          title: "Separate the two failures",
          items: [
            "Java heap OOM means the heap is full; exit 137 means the process exceeded the container limit.",
            "Check -Xmx or MaxRAMPercentage versus the limit, thread count, direct buffers and metaspace."
          ]
        },
        {
          title: "Collect evidence",
          items: [
            "HeapDumpOnOutOfMemoryError to a persistent volume; heap-after-GC trend from metrics; Native Memory Tracking."
          ]
        },
        {
          title: "Read the dump",
          items: [
            "Dominator tree by retained size: unbounded caches, maps keyed by request data, ThreadLocals in pools."
          ]
        },
        {
          title: "Fix and guard",
          items: [
            "Bound caches with size and TTL; leave native headroom; alert on heap-after-GC growth.",
            "Treat dumps as sensitive data and delete them after analysis."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "spring-internals-30",
      title: "Spring internals in 30 minutes",
      timebox: "30 min",
      prompt: "Explain what happens from SpringApplication.run to the first request being served, and where @Transactional fits in.",
      expected: [
        "Describes the application context building the bean graph, auto-configuration conditions and back-off.",
        "Explains bean post-processors creating proxies, and why self-invocation bypasses them.",
        "Covers the servlet filter chain, DispatcherServlet and thin controllers.",
        "Explains @Transactional at the service layer, rollback rules and REQUIRED vs REQUIRES_NEW."
      ],
      followups: [
        "Your own ObjectMapper bean replaced Boot's. Why, and how would you have found out?",
        "A @Transactional method's changes are not rolled back after a checked exception. Why?",
        "How would you debug which auto-configuration created a bean?"
      ],
      links: [
        { label: "Auto-configuration", route: "#/boot/config/auto-configuration" },
        { label: "Bean lifecycle and proxies", route: "#/boot/ioc/bean-lifecycle-scopes" },
        { label: "Propagation", route: "#/data/tx/propagation" }
      ]
    },
    {
      id: "concurrency-25",
      title: "Java concurrency in 25 minutes",
      timebox: "25 min",
      prompt: "A counter shared by request threads is sometimes wrong. Explain why and fix it, then discuss how you would size a thread pool for a blocking workload.",
      expected: [
        "Explains read-modify-write races and that volatile gives visibility, not atomicity.",
        "Offers AtomicLong, LongAdder or a lock with trade-offs, and atomic map methods.",
        "Uses cores \u00d7 (1 + wait/compute), bounded queues and rejection policies.",
        "Brings in virtual threads and where the bottleneck moves."
      ],
      followups: [
        "Two instances share the counter now. What changes?",
        "Why can a CompletableFuture without an executor hurt the whole JVM?"
      ],
      links: [
        { label: "Locks and atomics", route: "#/conc/sync/locks-atomics" },
        { label: "Executors", route: "#/conc/threads/executors" },
        { label: "Virtual threads", route: "#/conc/loom/virtual-threads" }
      ]
    },
    {
      id: "jpa-performance-25",
      title: "JPA performance in 25 minutes",
      timebox: "25 min",
      prompt: "A list endpoint backed by Spring Data JPA gets slower as data grows. Walk through how you would find and fix the problem.",
      expected: [
        "Counts SQL statements; recognizes N+1 and EAGER to-one defaults.",
        "Chooses entity graphs, join fetch, batch size or projections per use case.",
        "Fixes pagination: caps, stable sort, keyset at depth, no collection fetch with paging.",
        "Mentions open-in-view, indexes and statement-count tests."
      ],
      followups: [
        "Why does join fetch plus pagination trigger an in-memory warning?",
        "When would you skip JPA entirely for a query?"
      ],
      links: [
        { label: "N+1 and fetch plans", route: "#/data/jpa/n-plus-one" },
        { label: "Pagination", route: "#/api/contract/pagination" }
      ]
    },
    {
      id: "resilience-30",
      title: "Resilient microservices in 30 minutes",
      timebox: "30 min",
      prompt: "Your service depends on three downstream services and Kafka. How do you keep it healthy when one of them is slow or down, and how do you publish events reliably?",
      expected: [
        "Timeouts from a latency budget; retries only at one layer, idempotent and jittered.",
        "Circuit breakers with fallbacks; bulkheads per dependency; load shedding.",
        "Transactional outbox, keyed partitions, idempotent consumers and DLTs.",
        "Probes that do not cascade, and metrics that show breaker state."
      ],
      followups: [
        "Your retries made an outage worse. What happened?",
        "A consumer processed the same payment twice. Design the fix."
      ],
      links: [
        { label: "Timeouts and retries", route: "#/res/calls/timeouts-retries" },
        { label: "Circuit breakers", route: "#/res/calls/circuit-breakers" },
        { label: "Idempotent consumers", route: "#/res/events/idempotent-consumers" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Java and JVM fluency \u2014 language features, memory and GC, concurrency correctness",
      "Spring fluency \u2014 container, proxies, configuration and auto-configuration",
      "API and data design \u2014 contracts, validation, transactions and fetching",
      "Resilience and distributed thinking \u2014 timeouts, retries, events and consistency",
      "Operational maturity \u2014 security, observability, testing and shipping",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Uses Spring annotations by habit without explaining what they do or when they fail.",
        signals: [
          "Puts @Transactional on controllers or private methods and expects it to work.",
          "Returns JPA entities from controllers; no pagination.",
          "No timeouts on HTTP clients; retries everything.",
          "Database passwords in application.yml."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Builds correct services with good structure, but reliability stops at the service boundary.",
        signals: [
          "Constructor injection, feature packages, ProblemDetail errors, validated config records.",
          "Recognizes N+1 and fixes it with entity graphs or projections.",
          "Sets timeouts and a retry, but not idempotency keys or an outbox.",
          "Knows liveness and readiness exist but uses the same check for both."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Explains mechanisms, contains failures across services, and designs for operation.",
        signals: [
          "Explains proxies, propagation outcomes and happens-before precisely.",
          "Idempotency keys, outbox and idempotent consumers as a coherent design.",
          "Budgets pools and concurrency, including the shift with virtual threads.",
          "Brings SLOs, cardinality-safe metrics, contract tests and rollback plans unprompted."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "jvm-flags",
      title: "JVM flags for containers",
      summary: "The handful worth setting deliberately.",
      items: [
        "-XX:MaxRAMPercentage=75 \u2014 heap as a share of the container limit.",
        "-XX:+UseG1GC or -XX:+UseZGC \u2014 choose explicitly; small containers otherwise get Serial.",
        "-XX:+ExitOnOutOfMemoryError \u2014 let the orchestrator restart a broken JVM.",
        "-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/diag \u2014 evidence on a persistent volume.",
        "-XX:StartFlightRecording=maxage=30m \u2014 continuous JFR, dump with jcmd JFR.dump.",
        "-Xlog:gc*:file=gc.log \u2014 unified GC logging."
      ]
    },
    {
      id: "spring-defaults",
      title: "Spring Boot defaults to change",
      summary: "Settings whose defaults surprise people in production.",
      items: [
        "spring.jpa.open-in-view=false \u2014 default true.",
        "spring.jpa.hibernate.ddl-auto=validate \u2014 schema changes via Flyway or Liquibase.",
        "spring.datasource.hikari.connection-timeout \u2014 default 30 s; fail faster.",
        "server.shutdown=graceful \u2014 drain in-flight requests on SIGTERM.",
        "management.server.port \u2014 keep Actuator off the public port.",
        "spring.mvc.problemdetails.enabled=true \u2014 RFC 9457 errors for framework exceptions."
      ]
    },
    {
      id: "transactions",
      title: "@Transactional rules",
      summary: "Six facts that explain most transaction bugs.",
      items: [
        "Applied by a proxy: self-invocation, private and final methods are not transactional.",
        "Rolls back on RuntimeException and Error; checked exceptions commit unless rollbackFor.",
        "REQUIRED joins; an inner failure marks the whole transaction rollback-only.",
        "REQUIRES_NEW suspends and uses a second connection.",
        "readOnly = true for queries: no dirty checking, may route to replicas.",
        "No remote I/O inside; side effects after commit or via an outbox."
      ]
    },
    {
      id: "resilience4j",
      title: "Resilience4j starting points",
      summary: "Defaults to tune from measurements, not to copy blindly.",
      items: [
        "Retry: max-attempts 3, exponential backoff from 100 ms, randomized wait, transient exceptions only.",
        "CircuitBreaker: window 20, minimum calls 10, failure-rate 50%, slow-call threshold near your timeout.",
        "Bulkhead: max-concurrent-calls from rate \u00d7 latency, max-wait a few ms.",
        "TimeLimiter or client timeouts derived from the endpoint's latency budget.",
        "Export metrics and alert on prolonged OPEN state and fallback rate."
      ]
    }
  ],

  glossary: [
    {
      id: "happens-before",
      term: "Happens-before",
      definition: "The Java memory model relation guaranteeing that one thread's writes are visible to another, created by locks, volatile, thread start and join, and completed futures.",
      useIt: "Say which edge publishes the data: 'the volatile write of ready happens-before the read in the worker'.",
      links: [{ label: "Java memory model", route: "#/conc/threads/java-memory-model" }]
    },
    {
      id: "virtual-thread",
      term: "Virtual thread",
      definition: "A JVM-managed thread that unmounts from its carrier while blocked, making one thread per request cheap for I/O-bound services.",
      useIt: "Pair it with what still bounds concurrency: 'virtual threads, with a semaphore guarding the partner API'.",
      links: [{ label: "Virtual threads", route: "#/conc/loom/virtual-threads" }]
    },
    {
      id: "auto-configuration",
      term: "Auto-configuration",
      definition: "Conditional configuration classes loaded from the classpath that create default beans unless conditions fail or you define your own.",
      useIt: "Say which condition applied: 'the default backed off because of @ConditionalOnMissingBean'.",
      links: [{ label: "Auto-configuration", route: "#/boot/config/auto-configuration" }]
    },
    {
      id: "proxy",
      term: "Spring proxy",
      definition: "A wrapper created after bean initialization that adds behaviour such as transactions, caching, async and method security around external calls.",
      useIt: "Explain failures through it: 'the self-call bypassed the proxy, so no transaction started'.",
      links: [{ label: "Bean lifecycle and proxies", route: "#/boot/ioc/bean-lifecycle-scopes" }]
    },
    {
      id: "problem-detail",
      term: "ProblemDetail",
      definition: "Spring's implementation of RFC 9457 problem details: one machine-readable error shape with type, title, status, detail and instance.",
      useIt: "Mention what you add and what you hide: 'a traceId extension, never stack traces'.",
      links: [{ label: "ProblemDetail", route: "#/api/rest/problem-details" }]
    },
    {
      id: "idempotency-key",
      term: "Idempotency key",
      definition: "A client-supplied key per logical operation that lets the server detect retries and replay the original response.",
      useIt: "Say how it is claimed: 'atomically via a unique constraint, bound to a request hash'.",
      links: [{ label: "Idempotency keys", route: "#/api/rest/idempotency-keys" }]
    },
    {
      id: "keyset",
      term: "Keyset pagination",
      definition: "Paging by seeking past the last seen sort key with an index instead of skipping rows with OFFSET.",
      useIt: "Mention the tie-breaker: 'ordered by created_at, id with an opaque cursor'.",
      links: [{ label: "Pagination", route: "#/api/contract/pagination" }]
    },
    {
      id: "n-plus-one",
      term: "N+1 queries",
      definition: "One query for a list of parents followed by one query per parent when a lazy association is accessed in a loop.",
      useIt: "Name the fix per use case: 'an entity graph for the detail view, a projection for the list'.",
      links: [{ label: "Fetch plans", route: "#/data/jpa/n-plus-one" }]
    },
    {
      id: "dirty-checking",
      term: "Dirty checking",
      definition: "Hibernate comparing managed entities with their loaded snapshot at flush and issuing UPDATEs for changes.",
      useIt: "Use it to explain why save() is unnecessary for managed entities inside a transaction.",
      links: [{ label: "Persistence context", route: "#/data/jpa/persistence-context" }]
    },
    {
      id: "optimistic-locking",
      term: "Optimistic locking",
      definition: "Detecting concurrent updates with a version column checked in each UPDATE, failing the stale write instead of overwriting.",
      useIt: "Say how the conflict surfaces: 'mapped to 409 Conflict, client re-reads and retries'.",
      links: [{ label: "Isolation and locking", route: "#/data/tx/isolation-locking" }]
    },
    {
      id: "outbox",
      term: "Transactional outbox",
      definition: "Writing outgoing events to a table in the same transaction as the state change and relaying them to the broker afterwards.",
      useIt: "Pair it with consumers: 'at-least-once from the outbox, idempotent consumers downstream'.",
      links: [{ label: "Outbox", route: "#/res/events/outbox" }]
    },
    {
      id: "circuit-breaker",
      term: "Circuit breaker",
      definition: "A guard that stops calls to a failing dependency once a failure threshold is crossed, fails fast while open, and probes in half-open.",
      useIt: "Include the fallback and the metric: 'cached recommendations while open, alert on fallback rate'.",
      links: [{ label: "Circuit breakers", route: "#/res/calls/circuit-breakers" }]
    },
    {
      id: "bulkhead",
      term: "Bulkhead",
      definition: "Separate, bounded concurrency per dependency so one slow dependency cannot exhaust resources others need.",
      useIt: "Size it: 'twenty permits, from 100 requests per second times 200 ms'.",
      links: [{ label: "Bulkheads", route: "#/res/calls/bulkheads-rate-limits" }]
    },
    {
      id: "saga",
      term: "Saga",
      definition: "A cross-service business process built from local transactions with compensating actions instead of a distributed transaction.",
      useIt: "Say orchestration or choreography and why, and name a compensation.",
      links: [{ label: "Sagas", route: "#/res/platform/sagas" }]
    },
    {
      id: "audience",
      term: "Token audience",
      definition: "The aud claim naming which APIs a token is meant for; a resource server must reject tokens for other audiences.",
      useIt: "Use it when discussing token replay between services.",
      links: [{ label: "JWT validation", route: "#/sec/authn/jwt-validation" }]
    },
    {
      id: "readiness",
      term: "Readiness vs liveness",
      definition: "Readiness decides whether an instance receives traffic; liveness decides whether it is restarted.",
      useIt: "State what each checks: 'liveness only internal state; dependencies never in liveness'.",
      links: [{ label: "Health probes", route: "#/prod/observe/health-probes" }]
    },
    {
      id: "cardinality",
      term: "Metric cardinality",
      definition: "The number of distinct tag-value combinations of a metric, each stored as its own time series.",
      useIt: "Explain the boundary: 'route and status as tags; order id goes in traces and logs'.",
      links: [{ label: "Micrometer metrics", route: "#/prod/observe/micrometer-metrics" }]
    },
    {
      id: "mutation-score",
      term: "Mutation score",
      definition: "The share of small injected code changes detected by the test suite; a measure of assertion strength.",
      useIt: "Contrast it with coverage: 'ninety percent coverage, but boundary mutants survive'.",
      links: [{ label: "Mutation testing", route: "#/test/quality/mutation-testing" }]
    }
  ]
};
