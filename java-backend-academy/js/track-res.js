/* =====================================================================
   ANVIL · Resilience & Microservices
   window.TRACKS.res — modules: calls / events / platform
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     resRetryBudget — retries vs load amplification
  ================================================================== */
  Widgets.resRetryBudget = function (mount) {
    K.shell(mount, "model", "Retry amplification",
      "A request passes through a chain of services, and each layer retries failed calls to the next. Choose how often the deepest dependency fails, how many retries each layer makes and how deep the chain is. Failures are treated as independent, which is optimistic during a real outage.");
    var p = 0.2, retries = 3, layers = 3;
    var readout = h("div", { class: "w-readout" });
    var stage = h("div", { class: "w-stage" });
    function paint() {
      var attempts = 0;
      for (var k = 0; k <= retries; k++) attempts += Math.pow(p, k);
      var mult = Math.pow(attempts, layers);
      var success = 1 - Math.pow(p, retries + 1);
      K.clear(stage);
      var maxW = 100;
      var w = Math.min(maxW, (Math.log10(mult) / Math.log10(Math.pow(4, 3))) * maxW);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-bottom:4px" }, "Load on the failing dependency, relative to no retries"));
      stage.appendChild(h("div", { style: "height:12px;border-radius:6px;background:var(--surface-2);overflow:hidden" },
        h("div", { style: "height:100%;width:" + Math.max(2, w) + "%;background:" + (mult > 3 ? "var(--rose)" : mult > 1.5 ? "var(--amber)" : "var(--accent)") })));
      K.clear(readout);
      readout.appendChild(K.ro("success per call", K.fmt(success * 100, 1) + "%"));
      readout.appendChild(h("span", { class: "ro", style: mult > 3 ? "color:var(--rose-ink)" : "" }, "load multiplier ", h("b", {}, "\u00d7" + K.fmt(mult, 2))));
      readout.appendChild(K.ro("worst-case attempts", K.fmt(Math.pow(retries + 1, layers))));
      var msg;
      if (p >= 0.6 && retries > 0) msg = "During an outage retries barely improve success but multiply load on a dependency that is already down. A circuit breaker or a retry budget should stop this.";
      else if (layers > 1 && retries > 1) msg = "Retrying at every layer multiplies attempts. Retry at one layer (usually closest to the failure), and let others fail fast.";
      else if (retries === 0) msg = "No retries: transient blips reach the user. One retry with jittered backoff usually removes most of them.";
      else msg = "For rare, transient failures a small retry count buys real success at little extra load.";
      readout.appendChild(K.wide(msg));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([[0.01, "1% failing"], [0.2, "20% failing"], [0.6, "60% (outage)"]], 1, function (v) { p = v; paint(); }),
      K.segment([[0, "0 retries"], [1, "1 retry"], [3, "3 retries"]], 2, function (v) { retries = v; paint(); }),
      K.segment([[1, "1 layer"], [3, "3 layers"]], 1, function (v) { layers = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     resBreaker — interactive circuit-breaker state machine
  ================================================================== */
  Widgets.resBreaker = function (mount) {
    K.shell(mount, "simulate", "Circuit breaker",
      "Configured like a typical Resilience4j breaker: a sliding window of the last 10 calls, open at a 50% failure rate after at least 5 calls, wait 10 s while open, then allow 3 trial calls in half-open. Choose whether the downstream is healthy, send calls and let time pass.");
    var WINDOW = 10, MIN_CALLS = 5, THRESHOLD = 0.5, WAIT = 10, TRIALS = 3;
    var state, window_, clock, openedAt, trials, rejected, healthy, log;
    function reset() { state = "CLOSED"; window_ = []; clock = 0; openedAt = 0; trials = []; rejected = 0; healthy = true; log = []; }
    reset();
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function note(s) { log.unshift("t=" + clock + "s  " + s); if (log.length > 6) log.pop(); }
    function failureRate(arr) { if (!arr.length) return 0; return arr.filter(function (x) { return !x; }).length / arr.length; }
    function call() {
      if (state === "OPEN") {
        if (clock - openedAt >= WAIT) { state = "HALF_OPEN"; trials = []; note("wait elapsed \u2192 HALF_OPEN"); }
        else { rejected++; note("rejected fast (CallNotPermitted) \u2192 fallback"); return; }
      }
      var ok = healthy;
      if (state === "HALF_OPEN") {
        trials.push(ok);
        note("trial call " + (ok ? "succeeded" : "failed"));
        if (trials.length >= TRIALS) {
          if (failureRate(trials) >= THRESHOLD) { state = "OPEN"; openedAt = clock; note("trials failing \u2192 OPEN again"); }
          else { state = "CLOSED"; window_ = []; note("trials healthy \u2192 CLOSED"); }
        }
        return;
      }
      window_.push(ok);
      if (window_.length > WINDOW) window_.shift();
      note("call " + (ok ? "succeeded" : "failed"));
      if (window_.length >= MIN_CALLS && failureRate(window_) >= THRESHOLD) { state = "OPEN"; openedAt = clock; note("failure rate " + Math.round(failureRate(window_) * 100) + "% \u2192 OPEN"); }
    }
    function paint() {
      K.clear(stage);
      var col = state === "CLOSED" ? "var(--lime)" : state === "OPEN" ? "var(--rose)" : "var(--amber)";
      var row = h("div", { style: "display:flex;gap:14px;align-items:center;flex-wrap:wrap" });
      row.appendChild(h("div", { style: "padding:10px 16px;border-radius:10px;border:2px solid " + col + ";font-weight:700;letter-spacing:0.04em" }, state.replace("_", "-")));
      var cells = h("div", { style: "display:flex;gap:4px" });
      var src = state === "HALF_OPEN" ? trials : window_;
      for (var i = 0; i < (state === "HALF_OPEN" ? TRIALS : WINDOW); i++) {
        var v = src[i];
        cells.appendChild(h("span", { style: "width:16px;height:16px;border-radius:4px;display:inline-block;background:" + (v === undefined ? "var(--surface-2)" : v ? "var(--lime)" : "var(--rose)") }));
      }
      row.appendChild(h("div", {}, h("div", { style: "font-size:0.72rem;color:var(--text-faint);margin-bottom:3px" }, state === "HALF_OPEN" ? "trial calls" : "sliding window (last 10)"), cells));
      stage.appendChild(row);
      stage.appendChild(h("pre", { style: "font-family:var(--font-mono);font-size:0.74rem;margin:10px 0 0;white-space:pre-wrap;color:var(--text-dim)" }, log.join("\n") || "No calls yet."));
      K.clear(readout);
      readout.appendChild(K.ro("clock", clock + " s"));
      readout.appendChild(K.ro("failure rate", Math.round(failureRate(state === "HALF_OPEN" ? trials : window_) * 100) + "%"));
      readout.appendChild(K.ro("rejected fast", rejected));
      if (state === "OPEN") readout.appendChild(K.ro("half-open in", Math.max(0, WAIT - (clock - openedAt)) + " s"));
      readout.appendChild(K.wide(state === "OPEN"
        ? "While open, calls fail immediately without touching the dependency: callers get a fallback in microseconds and the dependency gets room to recover."
        : state === "HALF_OPEN" ? "A few trial calls probe the dependency. Enough successes close the breaker; failures reopen it."
          : "Closed: calls flow normally while the breaker records outcomes."));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([[true, "Downstream healthy"], [false, "Downstream failing"]], 0, function (v) { healthy = v; paint(); }),
      K.btn("Send 1 call", "primary", function () { call(); paint(); }),
      K.btn("Send 5 calls", "", function () { for (var i = 0; i < 5; i++) call(); paint(); }),
      K.btn("Wait 5 s", "", function () { clock += 5; note("5 s pass"); paint(); }),
      K.btn("Reset", "ghost", function () { reset(); paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "res-calls": {
      title: "Resilient calls checkpoint",
      sub: "Timeouts, retries, circuit breakers, bulkheads and rate limits.",
      questions: [
        {
          q: "Which remote call configuration is the most dangerous default?",
          options: ["A 2 s read timeout", "No read timeout at all", "One retry with jitter", "A circuit breaker with a 50% threshold"],
          answer: 1,
          explain: "Without a timeout, a hung dependency holds your thread, connection and caller indefinitely, and the failure spreads upstream. Every remote call needs connect and read timeouts derived from the caller's budget."
        },
        {
          q: "Which requests are generally safe to retry automatically?",
          options: ["Any POST that failed", "Idempotent operations failing with transient errors such as timeouts, 503 or 429 with Retry-After", "Requests that returned 400", "Requests that returned 403"],
          answer: 1,
          explain: "Retrying is only safe if repeating the operation cannot cause harm and the failure might go away. Client errors will fail again; non-idempotent writes need an idempotency key first."
        },
        {
          q: "Why add random jitter to exponential backoff?",
          options: ["To make tests deterministic", "So many clients that failed together do not retry in synchronized waves that hit the recovering service at the same instant", "To increase the number of retries", "Jitter is required by HTTP"],
          answer: 1,
          explain: "Clients that failed at the same moment would otherwise retry at the same moments, creating load spikes. Randomizing the delay spreads retries out."
        },
        {
          q: "What does a circuit breaker in the OPEN state do?",
          options: ["Retries calls faster", "Rejects calls immediately without calling the dependency, returning an error or fallback, until a wait period passes", "Queues calls until the dependency recovers", "Opens more connections"],
          answer: 1,
          explain: "Failing fast protects callers from waiting on timeouts and gives the dependency time to recover. After the wait, half-open trial calls decide whether to close again."
        },
        {
          q: "Recommendations and checkout share one thread pool. Recommendations slows down and checkout starts timing out. Which pattern prevents this?",
          options: ["A bigger shared pool", "A bulkhead: separate, bounded concurrency per dependency", "Longer timeouts", "More retries"],
          answer: 1,
          explain: "Bulkheads isolate resources so one slow dependency can only exhaust its own compartment. A semaphore or dedicated pool per dependency keeps checkout's capacity intact."
        }
      ]
    },
    "res-events": {
      title: "Events and messaging checkpoint",
      sub: "Outbox, Kafka fundamentals and idempotent consumers.",
      questions: [
        {
          q: "A service saves an order and then publishes OrderPlaced to Kafka. Occasionally events go missing. What is the underlying issue?",
          options: ["Kafka loses messages by default", "A dual write: the database commit and the publish are separate, so a crash or failure between them loses one side", "The consumer is too slow", "The topic has too few partitions"],
          answer: 1,
          explain: "Two systems cannot be updated atomically without coordination. The transactional outbox writes the event to a table in the same transaction as the order, and a relay publishes it afterwards."
        },
        {
          q: "How does Kafka preserve the order of events for one order id?",
          options: ["It orders the whole topic globally", "Events with the same key go to the same partition, and order is guaranteed within a partition", "By timestamp sorting on the consumer", "It does not preserve order"],
          answer: 1,
          explain: "Ordering is per partition. Use the aggregate id as the message key so all of an order's events land in one partition and are consumed in sequence."
        },
        {
          q: "When should a consumer commit its offset?",
          options: ["As soon as the message is received", "After the message has been processed successfully", "Once per day", "Before processing, to avoid duplicates"],
          answer: 1,
          explain: "Committing after processing gives at-least-once delivery: a crash before the commit means the message is redelivered. Committing first risks losing messages, which is worse than duplicates you can handle."
        },
        {
          q: "With at-least-once delivery, how should a payment-capture consumer avoid charging twice?",
          options: ["Hope duplicates are rare", "Record processed message ids (or a business key) in the same transaction as the effect, and skip ids already recorded", "Use more partitions", "Disable retries in the producer"],
          answer: 1,
          explain: "Duplicates are normal with at-least-once delivery. A dedupe table with a unique key, written atomically with the effect, turns redelivery into a no-op."
        },
        {
          q: "A message fails processing every time because its payload is malformed. What should happen?",
          options: ["Retry forever", "After bounded retries, route it to a dead-letter topic with error details and alert, so the partition keeps moving", "Skip it silently", "Stop the consumer group"],
          answer: 1,
          explain: "A poison message retried forever blocks everything behind it in the partition. Bounded retries plus a dead-letter topic keep the flow going while preserving the message for investigation and replay."
        },
        {
          q: "What does the cooperative-sticky assignor change about rebalances?",
          options: ["Nothing, it is just a rename", "Consumers keep their partitions and only the moved ones are revoked, instead of every consumer stopping (eager stop-the-world)", "It disables rebalancing", "It guarantees exactly-once delivery"],
          answer: 1,
          explain: "Eager rebalancing revokes all partitions from everyone. Cooperative incremental rebalancing moves only what must move, so most of the group keeps consuming during a deploy or scale event."
        },
        {
          q: "Kafka exactly-once semantics (transactions, read_committed) covers which flow?",
          options: ["Any external side effect such as an HTTP call or a database write", "Consume from Kafka, process, produce to Kafka and commit offsets atomically in one Kafka transaction", "Only producer retries", "Messages between two clusters by default"],
          answer: 1,
          explain: "EOS makes the read-process-write loop within Kafka atomic. Side effects outside Kafka (a DB row, an email) still need idempotency or the outbox pattern."
        }
      ]
    },
    "res-platform": {
      title: "Microservice platform checkpoint",
      sub: "Discovery, configuration, gateways and sagas.",
      questions: [
        {
          q: "On Kubernetes, how do Spring services usually discover each other?",
          options: ["A Eureka server is mandatory", "Through Kubernetes Services and cluster DNS, with the platform load-balancing across pods", "By hardcoding pod IPs", "Through the database"],
          answer: 1,
          explain: "Kubernetes already provides stable service names and load balancing. Client-side registries like Eureka are mostly needed outside such platforms."
        },
        {
          q: "Why avoid two-phase commit across microservices?",
          options: ["It is not supported by Java", "It couples availability of all participants, holds locks across the network and is poorly supported by modern brokers and stores", "It is too fast", "It only works with MySQL"],
          answer: 1,
          explain: "2PC requires every participant to be up and to hold locks until the coordinator decides. Sagas trade atomicity for availability using local transactions and compensations."
        },
        {
          q: "In a saga, what is a compensating action?",
          options: ["A database rollback", "A new business operation that semantically undoes an earlier committed step, such as refunding a captured payment", "A retry of the same step", "A log message"],
          answer: 1,
          explain: "Each saga step commits locally, so it cannot be rolled back later. A compensation is a forward action that reverses its business effect, and it must itself be idempotent."
        },
        {
          q: "What is the main difference between orchestration and choreography in sagas?",
          options: ["Orchestration uses REST, choreography uses gRPC", "An orchestrator explicitly drives the steps and tracks state; in choreography each service reacts to events with no central coordinator", "Choreography cannot compensate", "Orchestration needs 2PC"],
          answer: 1,
          explain: "Orchestration makes the flow visible and easy to change in one place; choreography reduces coupling but spreads the flow across services, which gets hard to follow as steps grow."
        },
        {
          q: "Where should cross-cutting concerns such as authentication, rate limiting and routing for external clients usually live?",
          options: ["Duplicated in every service", "In an API gateway at the edge, while services still verify tokens and authorize requests themselves", "In the database", "In the client app only"],
          answer: 1,
          explain: "A gateway centralizes edge concerns, but services must not trust the network blindly: they still validate tokens and enforce their own authorization."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.res = {
    id: "res",
    name: "Resilience & Microservices",
    short: "RES",
    tagline: "Fail small, recover fast",
    color: "#fb7185",
    blurb: "Make services that survive their dependencies: timeouts and retries with budgets, circuit breakers, bulkheads and rate limits with Resilience4j; reliable events with the transactional outbox, Kafka and idempotent consumers; and the platform patterns of microservices \u2014 discovery, configuration, gateways and sagas.",
    modules: [
      {
        id: "calls",
        name: "Resilient Calls",
        icon: "shield",
        lessons: [
          {
            id: "timeouts-retries",
            title: "Timeouts, retries and backoff",
            summary: "Give every remote call a deadline, retry only what is safe and transient, back off with jitter, and avoid retry storms.",
            minutes: 10,
            tags: ["timeouts", "retries", "backoff", "resilience4j"],
            blocks: [
              { t: "p", html: "Every remote call can be slow or fail. Two controls decide whether that stays a local blip or becomes an outage: a <strong>timeout</strong> so you stop waiting, and a careful <strong>retry</strong> policy so transient failures recover without multiplying load." },
              { t: "h", text: "Timeouts on every call" },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "RestClient inventoryClient(RestClient.Builder builder, InventoryProperties props) {",
                "  HttpClient http = HttpClient.newBuilder()",
                "      .connectTimeout(Duration.ofMillis(300))",
                "      .build();",
                "  var factory = new JdkClientHttpRequestFactory(http);",
                "  factory.setReadTimeout(props.readTimeout());          // from the caller's budget, e.g. 800 ms",
                "  return builder",
                "      .baseUrl(props.baseUrl().toString())",
                "      .requestFactory(factory)",
                "      .build();",
                "}"
              ]) },
              { t: "ul", items: [
                "Derive timeouts from a <strong>budget</strong>: if your endpoint promises 1 s, a downstream read timeout of 5 s is meaningless.",
                "Propagate the remaining deadline downstream where the protocol allows it (gRPC does natively).",
                "Pool acquisition, DNS and TLS handshakes count too; set connect and pool timeouts as well as read."
              ] },
              { t: "h", text: "Retry with discipline" },
              { t: "widget", id: "resRetryBudget" },
              { t: "code", lang: "yaml", code: J([
                "resilience4j:",
                "  retry:",
                "    instances:",
                "      inventory:",
                "        max-attempts: 3                     # 1 call + 2 retries",
                "        wait-duration: 100ms",
                "        enable-exponential-backoff: true",
                "        exponential-backoff-multiplier: 2",
                "        enable-randomized-wait: true        # jitter",
                "        retry-exceptions:",
                "          - java.net.SocketTimeoutException",
                "          - org.springframework.web.client.HttpServerErrorException"
              ]) },
              { t: "compare",
                bad: { title: "Retry storms", items: ["Retries at every layer of the chain", "Fixed delays, all clients in lockstep", "Retrying 400s and non-idempotent POSTs"] },
                good: { title: "Disciplined retries", items: ["One layer retries, others fail fast", "Exponential backoff with jitter, small attempt cap", "Only idempotent, transient failures; honour Retry-After"] } },
              { t: "note", variant: "tip", html: "<strong>Recent Spring Framework versions include basic resilience annotations</strong> such as <code class='tok'>@Retryable</code> and concurrency limits in the core. Resilience4j remains the fuller toolkit with breakers, bulkheads, rate limiters and metrics." },
              { t: "note", variant: "key", html: "<strong>Deadline everything, retry sparingly.</strong> Timeouts come from the caller's budget; retries are few, jittered, limited to idempotent transient failures, and done at one layer only." }
            ]
          },
          {
            id: "circuit-breakers",
            title: "Circuit breakers with Resilience4j",
            summary: "Stop calling a failing dependency, fail fast with a fallback, probe for recovery, and compose breakers with retries and time limits.",
            minutes: 10,
            tags: ["circuit-breaker", "resilience4j", "fallback"],
            blocks: [
              { t: "p", html: "When a dependency is failing, continuing to call it wastes your threads and keeps it overloaded. A <strong>circuit breaker</strong> watches call outcomes and, past a failure threshold, <strong>opens</strong>: calls fail immediately until a probe shows the dependency is back." },
              { t: "diagram", id: "breaker-states", caption: "CLOSED records outcomes; OPEN rejects fast; HALF-OPEN lets a few trial calls decide." },
              { t: "widget", id: "resBreaker" },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class RecommendationGateway {",
                "",
                "  @CircuitBreaker(name = \"recommendations\", fallbackMethod = \"popular\")",
                "  @Retry(name = \"recommendations\")",
                "  public List<ProductCard> forCustomer(long customerId) {",
                "    return client.get().uri(\"/customers/{id}/recs\", customerId)",
                "        .retrieve().body(new ParameterizedTypeReference<>() {});",
                "  }",
                "",
                "  // same signature plus the exception: a cheap, safe degradation",
                "  List<ProductCard> popular(long customerId, Throwable cause) {",
                "    return popularCache.top(10);",
                "  }",
                "}"
              ]) },
              { t: "code", lang: "yaml", code: J([
                "resilience4j:",
                "  circuitbreaker:",
                "    instances:",
                "      recommendations:",
                "        sliding-window-type: COUNT_BASED",
                "        sliding-window-size: 20",
                "        minimum-number-of-calls: 10",
                "        failure-rate-threshold: 50",
                "        slow-call-duration-threshold: 500ms   # slow calls count as failures too",
                "        slow-call-rate-threshold: 50",
                "        wait-duration-in-open-state: 10s",
                "        permitted-number-of-calls-in-half-open-state: 3"
              ]) },
              { t: "ul", items: [
                "Resilience4j's annotation order wraps Retry around CircuitBreaker by default, so each retry attempt is recorded by the breaker and an open breaker stops retries quickly.",
                "Fallbacks must be cheap and safe: cached data, a default, or a clear 503. A fallback that calls another fragile service just moves the problem.",
                "Export breaker state and transitions as metrics and alert on prolonged OPEN."
              ] },
              { t: "note", variant: "trap", html: "<strong>A fallback that hides errors forever hides outages.</strong> If the breaker is open for an hour and users see stale defaults, someone needs to know. Count fallback invocations and alert on them." },
              { t: "p", html: "Patterns at system scale: <a class='inline' href='../hld-lld-academy/index.html#/hld/reliability/circuit-breakers-backpressure'>Blueprint: circuit breakers and backpressure</a>." },
              { t: "note", variant: "key", html: "<strong>Fail fast when a dependency is down, and probe before trusting it again.</strong> Count slow calls as failures, keep fallbacks cheap, and make breaker state visible." }
            ]
          },
          {
            id: "bulkheads-rate-limits",
            title: "Bulkheads, rate limits and load shedding",
            summary: "Isolate capacity per dependency, limit how fast callers can hit you or you hit others, and shed load before it sinks the service.",
            minutes: 9,
            tags: ["bulkhead", "rate-limiting", "load-shedding"],
            blocks: [
              { t: "p", html: "Timeouts and breakers react to failure. <strong>Bulkheads</strong> and <strong>rate limits</strong> bound how much damage any one dependency or caller can do in the first place, by capping concurrency and request rate." },
              { t: "table", headers: ["Pattern", "Limits", "Protects", "Typical tool"], rows: [
                ["Semaphore bulkhead", "Concurrent calls to one dependency", "Your threads and connections", "Resilience4j Bulkhead, Semaphore"],
                ["Thread-pool bulkhead", "Calls in a dedicated pool", "Isolation including thread starvation", "Resilience4j ThreadPoolBulkhead"],
                ["Client-side rate limiter", "Your call rate to a partner", "The partner's quota", "Resilience4j RateLimiter"],
                ["Server-side rate limit", "Each client's rate to you", "Your service from noisy neighbours", "Gateway, filter with token bucket"],
                ["Load shedding", "Total in-flight work", "Latency of the work you do accept", "Concurrency limit returning 503 fast"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "resilience4j:",
                "  bulkhead:",
                "    instances:",
                "      recommendations:",
                "        max-concurrent-calls: 20",
                "        max-wait-duration: 10ms     # do not queue long; fail fast and use the fallback",
                "  ratelimiter:",
                "    instances:",
                "      partner-pricing:",
                "        limit-for-period: 50",
                "        limit-refresh-period: 1s",
                "        timeout-duration: 0"
              ]) },
              { t: "ul", items: [
                "Size bulkheads from Little's law: target rate \u00d7 expected latency, plus headroom.",
                "Reply to rate-limited callers with <code class='tok'>429</code> and <code class='tok'>Retry-After</code>.",
                "Shed load at the edge, before work is done: rejecting early is cheap, timing out late is expensive.",
                "Prioritize: shed analytics and recommendations before checkout."
              ] },
              { t: "note", variant: "tip", html: "<strong>With virtual threads, bulkheads become essential.</strong> Thread pools used to cap concurrency implicitly. Now nothing does unless you add a semaphore per scarce dependency." },
              { t: "p", html: "Related: <a class='inline' href='../hld-lld-academy/index.html#/hld/api/rate-limiting'>Blueprint: rate limiting</a> and <a class='inline' href='../hld-lld-academy/index.html#/hld/reliability/load-shedding-degradation'>Blueprint: load shedding and degradation</a>." },
              { t: "quiz", id: "res-calls" },
              { t: "note", variant: "key", html: "<strong>Cap concurrency per dependency and rate per caller.</strong> Bulkheads contain slow dependencies, rate limits protect quotas, and early load shedding keeps accepted requests fast." }
            ]
          }
        ]
      },
      {
        id: "events",
        name: "Reliable Events",
        icon: "queue",
        lessons: [
          {
            id: "outbox",
            title: "The transactional outbox",
            summary: "Publish events reliably by writing them in the same transaction as the state change, then relaying them to the broker.",
            minutes: 10,
            tags: ["outbox", "events", "consistency"],
            blocks: [
              { t: "p", html: "Saving an order and publishing <code class='tok'>OrderPlaced</code> are two writes to two systems. If you commit and then crash before publishing, the event is lost; if you publish and the commit fails, you announced something that never happened. This is the <strong>dual-write problem</strong>." },
              { t: "diagram", id: "outbox-flow", caption: "The order and its event commit in one local transaction; a relay publishes afterwards and marks rows sent." },
              { t: "code", lang: "java", code: J([
                "@Transactional",
                "public OrderView place(PlaceOrder cmd) {",
                "  Order order = orders.save(Order.place(cmd));",
                "  outbox.save(OutboxEvent.of(",
                "      \"order\", order.id(), \"OrderPlaced\",",
                "      json.write(new OrderPlaced(order.id(), order.customerId(), order.total()))));",
                "  return mapper.toView(order);   // both rows commit, or neither",
                "}"
              ]) },
              { t: "code", lang: "sql", code: J([
                "CREATE TABLE outbox (",
                "  id             UUID PRIMARY KEY,",
                "  aggregate_type VARCHAR(50)  NOT NULL,",
                "  aggregate_id   VARCHAR(100) NOT NULL,   -- becomes the Kafka key: per-order ordering",
                "  type           VARCHAR(100) NOT NULL,",
                "  payload        JSONB        NOT NULL,",
                "  created_at     TIMESTAMP    NOT NULL,",
                "  published_at   TIMESTAMP",
                ");"
              ]) },
              { t: "table", headers: ["Relay style", "How", "Trade-off"], rows: [
                ["Polling publisher", "A scheduled job selects unpublished rows (with SKIP LOCKED), publishes, marks them", "Simple; adds polling latency and DB load"],
                ["Change data capture", "A connector such as Debezium tails the database log and publishes inserts", "Low latency, no polling; more infrastructure"]
              ] },
              { t: "ul", items: [
                "Delivery is <strong>at least once</strong>: a relay crash after publishing but before marking repeats the event. Consumers must be idempotent.",
                "Use the aggregate id as the message key to keep per-aggregate order.",
                "Purge or archive published rows on a schedule."
              ] },
              { t: "note", variant: "trap", html: "<strong>Publishing inside the transaction is not an outbox.</strong> Calling <code class='tok'>kafkaTemplate.send()</code> inside <code class='tok'>@Transactional</code> still publishes before the commit is known to succeed, and slows the transaction with network I/O." },
              { t: "p", html: "More on event reliability: <a class='inline' href='../hld-lld-academy/index.html#/hld/messaging/event-driven-reliability'>Blueprint: event-driven reliability</a>." },
              { t: "note", variant: "key", html: "<strong>One local transaction for state and event; publish afterwards.</strong> The outbox turns a dual write into an at-least-once relay, which idempotent consumers make safe." }
            ]
          },
          {
            id: "kafka-basics",
            title: "Kafka with Spring for Apache Kafka",
            summary: "Topics, partitions, keys and consumer groups; producer durability settings; listener error handling and dead-letter topics.",
            minutes: 11,
            tags: ["kafka", "spring-kafka", "messaging"],
            blocks: [
              { t: "p", html: "Kafka stores events in <strong>topics</strong> split into <strong>partitions</strong>. Each partition is an ordered, replicated log. Producers choose the partition by <strong>key</strong>; consumers in a <strong>consumer group</strong> divide the partitions among themselves and track their position with <strong>offsets</strong>." },
              { t: "table", headers: ["Concept", "What to remember"], rows: [
                ["Key", "Same key, same partition, ordered. Use the aggregate id."],
                ["Partitions", "Unit of parallelism: at most one consumer per partition per group"],
                ["Consumer group", "Each group gets every message once; groups are independent"],
                ["Offset commit", "Commit after processing for at-least-once"],
                ["Rebalance", "Partitions move when consumers join, leave or exceed max.poll.interval.ms"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  kafka:",
                "    bootstrap-servers: ${KAFKA_BOOTSTRAP}",
                "    producer:",
                "      acks: all                    # wait for in-sync replicas",
                "      properties:",
                "        enable.idempotence: true    # no duplicates from producer retries",
                "    consumer:",
                "      group-id: billing",
                "      auto-offset-reset: earliest",
                "      enable-auto-commit: false     # the listener container commits after processing"
              ]) },
              { t: "code", lang: "java", code: J([
                "@KafkaListener(topics = \"orders.v1\")",
                "void on(OrderPlaced event) {",
                "  billing.openInvoice(event);       // must be idempotent: redelivery happens",
                "}",
                "",
                "@Bean",
                "DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {",
                "  var recoverer = new DeadLetterPublishingRecoverer(template); // -> orders.v1-dlt",
                "  var handler = new DefaultErrorHandler(recoverer, new ExponentialBackOff(200, 2.0));",
                "  handler.addNotRetryableExceptions(DeserializationException.class, ValidationException.class);",
                "  return handler;",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Slow listeners trigger rebalances.</strong> If processing a batch takes longer than <code class='tok'>max.poll.interval.ms</code>, the consumer is considered dead, its partitions are reassigned and the batch is redelivered elsewhere. Keep handlers fast or reduce <code class='tok'>max.poll.records</code>." },
              { t: "note", variant: "tip", html: "<strong>Version your topics and schemas.</strong> Add fields compatibly, use a schema registry where available, and treat event contracts like API contracts. Background: <a class='inline' href='../hld-lld-academy/index.html#/hld/messaging/kafka-pubsub'>Blueprint: Kafka and pub/sub</a>." },
              { t: "note", variant: "key", html: "<strong>Key for order, commit after processing, dead-letter the poison.</strong> Configure durable producers, bounded retries with a DLT, and handlers fast enough to avoid rebalances." }
            ]
          },
          {
            id: "idempotent-consumers",
            title: "Idempotent consumers",
            summary: "Handle duplicates and redelivery safely with dedupe records, naturally idempotent writes and version checks.",
            minutes: 9,
            tags: ["idempotency", "consumers", "exactly-once"],
            blocks: [
              { t: "p", html: "Brokers, outbox relays and retries all deliver <strong>at least once</strong>. 'Exactly once' end to end is something you build: <strong>at-least-once delivery plus idempotent processing</strong>." },
              { t: "h", text: "Three techniques" },
              { t: "table", headers: ["Technique", "How", "Fits"], rows: [
                ["Dedupe record", "Insert the message id into processed_messages in the same transaction as the effect; a duplicate violates the key", "Any side effect in your database"],
                ["Naturally idempotent write", "Upsert or set state ('status = PAID') instead of increment", "State transitions, projections"],
                ["Version / sequence check", "Ignore events older than the stored version", "Out-of-order or replayed events"]
              ] },
              { t: "code", lang: "java", code: J([
                "@KafkaListener(topics = \"payments.v1\")",
                "@Transactional",
                "public void on(PaymentCaptured e) {",
                "  if (!processed.markIfNew(e.eventId())) {   // INSERT ... ON CONFLICT DO NOTHING; false if seen",
                "    return;                                    // duplicate: already applied",
                "  }",
                "  invoices.markPaid(e.invoiceId(), e.amount());",
                "}"
              ]) },
              { t: "ul", items: [
                "The dedupe insert and the effect must share a transaction; otherwise a crash between them breaks the guarantee.",
                "Side effects outside your database (emails, partner calls) need their own idempotency key passed downstream.",
                "Keep dedupe records for longer than the maximum redelivery window, then purge."
              ] },
              { t: "note", variant: "trap", html: "<strong>Increment-style handlers are the classic duplicate bug.</strong> <code class='tok'>balance = balance + amount</code> applied twice is wrong; recording the event id first, or storing the resulting state, is not." },
              { t: "quiz", id: "res-events" },
              { t: "note", variant: "key", html: "<strong>Assume every message arrives twice.</strong> Record processed ids atomically with the effect, prefer state-setting writes, and pass idempotency keys to external side effects." }
            ]
          },
          {
            id: "kafka-consumers-eos",
            title: "Kafka consumer groups, rebalancing and exactly-once",
            summary: "How partitions are assigned, making rebalances cheap with cooperative and static membership, scaling consumers, and what exactly-once really covers.",
            minutes: 11,
            tags: ["kafka", "rebalancing", "exactly-once"],
            blocks: [
              { t: "p", html: "A consumer group divides a topic's partitions among its members. A <strong>rebalance</strong> reassigns them whenever membership changes: a pod starts, stops, crashes, or takes longer than <code class='tok'>max.poll.interval.ms</code> between polls. During a classic rebalance the whole group pauses, so frequent rebalances look like throughput collapses and duplicate processing." },
              { t: "table", headers: ["Lever", "Effect"], rows: [
                ["partition.assignment.strategy = CooperativeStickyAssignor", "Incremental rebalances: only moved partitions are revoked"],
                ["group.instance.id (static membership)", "A restarting pod gets its partitions back without a rebalance, if it returns within session.timeout.ms"],
                ["max.poll.records / max.poll.interval.ms", "Keep a poll's work well inside the interval, or the member is evicted"],
                ["concurrency on the listener container", "More consumer threads in one pod, still at most one per partition"],
                ["Partition count", "The ceiling on parallelism; plan it up front, since adding partitions remaps keys"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  kafka:",
                "    consumer:",
                "      group-id: billing",
                "      max-poll-records: 200",
                "      properties:",
                "        partition.assignment.strategy: org.apache.kafka.clients.consumer.CooperativeStickyAssignor",
                "        group.instance.id: ${HOSTNAME}      # stable pod name, e.g. from a StatefulSet",
                "        max.poll.interval.ms: 300000",
                "    listener:",
                "      concurrency: 3                       # 3 consumers in this pod"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Scaling rule:</strong> pods &times; concurrency beyond the partition count leaves consumers idle. Watch <em>consumer lag</em> per partition: one hot partition (a skewed key) cannot be fixed by adding consumers." },
              { t: "h", text: "Delivery guarantees" },
              { t: "ul", items: [
                "<strong>At-most-once:</strong> commit before processing. Lost messages on crash; rarely what you want.",
                "<strong>At-least-once:</strong> commit after processing (the Spring default). Duplicates on crash or rebalance, so consumers must be <a class='inline' href='#/res/events/idempotent-consumers'>idempotent</a>.",
                "<strong>Exactly-once (EOS):</strong> an idempotent, transactional producer writes the outputs <em>and</em> the consumed offsets in one Kafka transaction; downstream consumers use <code class='tok'>isolation.level=read_committed</code>."
              ] },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  kafka:",
                "    producer:",
                "      transaction-id-prefix: billing-tx-   # enables a transactional KafkaTemplate",
                "    consumer:",
                "      isolation-level: read_committed",
                "# with a transaction manager on the listener container, consume -> produce -> offset commit is atomic"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Exactly-once stops at Kafka's edge.</strong> A database write or an HTTP call inside the listener is not part of the Kafka transaction. Use the outbox pattern for DB-to-Kafka, and idempotent handlers for Kafka-to-DB." },
              { t: "note", variant: "key", html: "<strong>Make rebalances rare and cheap, and duplicates harmless.</strong> Cooperative-sticky assignment, static membership and bounded poll work keep groups stable; EOS covers Kafka-to-Kafka flows, and idempotency covers everything else." }
            ]
          }
        ]
      },
      {
        id: "platform",
        name: "Microservice Platform",
        icon: "globe",
        lessons: [
          {
            id: "discovery-config",
            title: "Discovery, configuration and gateways",
            summary: "How services find each other and get configuration on Kubernetes, what Spring Cloud still adds, and the role of an API gateway.",
            minutes: 9,
            tags: ["kubernetes", "spring-cloud", "gateway"],
            blocks: [
              { t: "p", html: "Microservices need to find each other, receive configuration and expose a coherent edge to clients. On Kubernetes, much of this is a platform feature; Spring Cloud fills gaps when you are not on such a platform or need more control." },
              { t: "table", headers: ["Concern", "On Kubernetes", "Spring options"], rows: [
                ["Discovery", "Services and cluster DNS (<code class='tok'>http://inventory.shop.svc.example:8080</code>; <code class='tok'>.example</code> stands in for your cluster domain)", "Spring Cloud LoadBalancer, Eureka off-platform"],
                ["Configuration", "ConfigMaps, Secrets as env vars or files", "Config data imports, Spring Cloud Config Server"],
                ["Secrets", "Secrets, external secret operators, workload identity", "Vault integration"],
                ["Edge", "Ingress or a gateway", "Spring Cloud Gateway"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "# configuration from the platform, secrets as mounted files",
                "spring:",
                "  config:",
                "    import:",
                "      - optional:configtree:/etc/config/        # ConfigMap mounted as files",
                "      - optional:configtree:/run/secrets/app/   # Secret mounted as files",
                "app:",
                "  inventory:",
                "    base-url: http://inventory.shop.svc.example:8080   # a cluster DNS name, not a pod IP"
              ]) },
              { t: "h", text: "API gateway responsibilities" },
              { t: "ul", items: [
                "Routing and version-based traffic shifting for external clients.",
                "TLS termination, authentication at the edge, request size limits and rate limiting.",
                "Aggregation only when it is thin; business logic in a gateway becomes a shared bottleneck.",
                "Services still validate tokens and authorize every request: the internal network is not a trust boundary."
              ] },
              { t: "note", variant: "warn", html: "<strong>Live config refresh is a sharp tool.</strong> Changing settings without restart sounds attractive, but beans that read config once will not see it, and partial refresh across instances creates inconsistent behaviour. A rolling restart is often the safer refresh." },
              { t: "p", html: "When to split services at all: <a class='inline' href='../hld-lld-academy/index.html#/hld/architecture/monolith-microservices'>Blueprint: monolith vs microservices</a>; edge design: <a class='inline' href='../hld-lld-academy/index.html#/hld/api/api-gateway'>Blueprint: API gateway</a>." },
              { t: "note", variant: "key", html: "<strong>Use the platform for discovery and config, Spring for the rest.</strong> Keep gateways thin, secrets mounted not committed, and authorization inside every service." }
            ]
          },
          {
            id: "sagas",
            title: "Sagas and distributed workflows",
            summary: "Coordinate a business process across services with local transactions and compensations, via orchestration or choreography.",
            minutes: 11,
            tags: ["saga", "distributed-transactions", "workflow"],
            blocks: [
              { t: "p", html: "Placing an order may reserve stock, capture payment and book shipping \u2014 three services, three databases. There is no shared transaction. A <strong>saga</strong> runs the process as a sequence of local transactions; when a step fails, earlier steps are undone by <strong>compensating actions</strong>." },
              { t: "table", headers: ["Step", "Action", "Compensation"], rows: [
                ["1. Inventory", "Reserve items", "Release reservation"],
                ["2. Payments", "Capture payment", "Refund"],
                ["3. Shipping", "Book shipment", "Cancel booking"],
                ["4. Orders", "Mark CONFIRMED", "(final step, no compensation)"]
              ] },
              { t: "compare",
                bad: { title: "Choreography at scale", items: ["Each service reacts to others' events", "The flow exists only implicitly across code bases", "Hard to see where an order is stuck"] },
                good: { title: "Orchestration", items: ["One orchestrator drives steps and records state", "Timeouts and compensations in one place", "Easy to query 'which orders are stuck in payment?'"] } },
              { t: "code", lang: "java", code: J([
                "// orchestrator reacting to step results; state persisted per order",
                "@Transactional",
                "void on(PaymentFailed e) {",
                "  OrderSaga saga = sagas.require(e.orderId());",
                "  saga.fail(\"payment\", e.reason());",
                "  outbox.save(command(\"inventory\", new ReleaseReservation(e.orderId())));  // compensate",
                "  outbox.save(event(new OrderRejected(e.orderId(), e.reason())));",
                "}"
              ]) },
              { t: "ul", items: [
                "Every step and compensation must be <strong>idempotent</strong>; messages will repeat.",
                "Use explicit pending states (<code class='tok'>PENDING_PAYMENT</code>) so other requests see that work is in flight.",
                "Give each step a timeout, and decide what happens when a step neither succeeds nor fails.",
                "Some actions cannot be compensated (an email was sent): put them last, or design an apology action.",
                "Workflow engines such as Temporal or Camunda can host orchestrations when they grow complex."
              ] },
              { t: "note", variant: "trap", html: "<strong>Compensation is not rollback.</strong> Other processes may already have seen the intermediate state: someone else could not buy the reserved item. Design the business semantics for that, not just the code path." },
              { t: "p", html: "Theory and trade-offs: <a class='inline' href='../hld-lld-academy/index.html#/hld/architecture/distributed-transactions'>Blueprint: distributed transactions</a>." },
              { t: "quiz", id: "res-platform" },
              { t: "note", variant: "key", html: "<strong>Local transactions forward, compensations backward.</strong> Sagas need idempotent steps, explicit pending states, timeouts, and usually an orchestrator once more than a few services are involved." }
            ]
          }
        ]
      }
    ]
  };
})();
