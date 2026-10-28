/* =====================================================================
   ANVIL · Production
   window.TRACKS.prod — modules: observe / ship
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     prodPackaging — startup, size and memory trade-offs
  ================================================================== */
  var PACKAGING = {
    fat: { label: "Fat jar on a JDK image", size: 450, startup: 4.0, rss: 380, peak: 100, build: 0.5,
      note: "Simplest. Every change rebuilds one big layer, and the full JDK ships tools you never use in production." },
    layered: { label: "Layered jar on a JRE", size: 230, startup: 3.8, rss: 360, peak: 100, build: 0.6,
      note: "Dependencies, snapshot dependencies and your code sit in separate image layers. A code change pushes only a small top layer." },
    cds: { label: "Layered + CDS archive", size: 250, startup: 2.2, rss: 330, peak: 100, build: 1.0,
      note: "A training run at build time records loaded classes into a class data sharing archive, cutting startup and some memory with no code changes." },
    aot: { label: "JVM AOT cache", size: 270, startup: 1.4, rss: 340, peak: 100, build: 1.5,
      note: "Recent JDKs can also cache linked classes and profiling from a training run. Still a normal JVM with JIT, so peak throughput is unchanged." },
    native: { label: "GraalVM native image", size: 110, startup: 0.08, rss: 90, peak: 85, build: 5,
      note: "Starts in milliseconds with a small footprint, but builds are slow, reflection needs hints, and peak throughput is typically lower without profile-guided optimization." }
  };

  Widgets.prodPackaging = function (mount) {
    K.shell(mount, "compare", "Packaging trade-offs",
      "Compare ways to ship the same Spring Boot service. Numbers are illustrative for a mid-sized service, chosen to show relative direction; measure your own.");
    var which = "layered";
    var bars = h("div", { class: "w-stage", style: "display:grid;gap:8px" });
    var readout = h("div", { class: "w-readout" });
    function bar(label, value, max, unit, lowerIsBetter) {
      var pct = Math.max(2, Math.min(100, (value / max) * 100));
      return h("div", {},
        h("div", { style: "display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-dim)" }, h("span", {}, label + (lowerIsBetter ? " (lower is better)" : " (higher is better)")), h("b", { style: "color:var(--text)" }, value + " " + unit)),
        h("div", { style: "height:10px;border-radius:5px;background:var(--surface-2);overflow:hidden" }, h("div", { style: "height:100%;width:" + pct + "%;background:var(--accent)" })));
    }
    function paint() {
      var p = PACKAGING[which];
      K.clear(bars);
      bars.appendChild(bar("Image size", p.size, 450, "MB", true));
      bars.appendChild(bar("Startup to ready", p.startup, 4, "s", true));
      bars.appendChild(bar("Memory (RSS) at idle", p.rss, 380, "MB", true));
      bars.appendChild(bar("Peak throughput", p.peak, 100, "%", false));
      bars.appendChild(bar("Build time", p.build, 5, "min", true));
      K.clear(readout);
      readout.appendChild(K.ro("option", p.label));
      readout.appendChild(K.wide(p.note));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment(Object.keys(PACKAGING).map(function (k) { return [k, PACKAGING[k].label]; }), 1, function (v) { which = v; paint(); })
    ));
    mount.appendChild(bars);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "prod-observe": {
      title: "Observability checkpoint",
      sub: "Metrics, tracing, structured logs and health probes.",
      questions: [
        {
          q: "A developer adds a customerId tag to an HTTP request timer. Why is this dangerous?",
          options: ["Tags are not supported on timers", "Unbounded tag values create a new time series per customer, exploding metric cardinality, memory and cost", "It slows down requests", "Prometheus rejects numbers"],
          answer: 1,
          explain: "Each distinct tag combination is its own series. Use bounded tags such as route, method, status and outcome; put per-entity detail in traces and logs."
        },
        {
          q: "Which metrics form the RED method for a request-driven service?",
          options: ["Rate, errors, duration", "RAM, energy, disk", "Retries, events, deployments", "Reads, edits, deletes"],
          answer: 0,
          explain: "Request rate, error rate and duration distribution per endpoint describe what users experience. Pair them with resource saturation metrics (USE) for the infrastructure."
        },
        {
          q: "How do logs and traces get correlated in a Spring Boot service with Micrometer Tracing?",
          options: ["Manually adding ids in every log call", "The current traceId and spanId are put into the logging context (MDC) and included in log output, and traceparent headers propagate them across services", "By timestamps only", "They cannot be correlated"],
          answer: 1,
          explain: "Micrometer Tracing propagates W3C trace context over HTTP and messaging and exposes ids to the logging system. Structured logs then carry traceId fields you can pivot on."
        },
        {
          q: "A liveness probe checks the database, and the database has a brief outage. What happens?",
          options: ["Nothing", "Kubernetes restarts every pod, turning a database blip into a full outage and a restart storm when it recovers", "Traffic is routed elsewhere gracefully", "The database is restarted"],
          answer: 1,
          explain: "Liveness should only answer 'is this process broken beyond repair?'. Dependency problems belong, carefully, in readiness, which removes the pod from traffic without restarting it."
        },
        {
          q: "During shutdown, what should happen before the application stops accepting requests?",
          options: ["Nothing; just exit", "Readiness reports out-of-service so load balancers stop sending traffic, then in-flight requests drain with graceful shutdown", "Liveness fails first", "The JVM triggers a full GC"],
          answer: 1,
          explain: "Kubernetes removes endpoints asynchronously. A short preStop delay plus graceful shutdown lets traffic stop arriving before the server stops, avoiding errors on every deploy."
        }
      ]
    },
    "prod-ship": {
      title: "Shipping checkpoint",
      sub: "Container images, native images and production readiness.",
      questions: [
        {
          q: "Why build Spring Boot images with layered jars (or Buildpacks) instead of copying one fat jar?",
          options: ["Fat jars do not run in containers", "Dependencies change rarely and land in cached lower layers, so a code change rebuilds and pushes only a small top layer", "Layered jars are encrypted", "It enables native compilation"],
          answer: 1,
          explain: "Image layers are cached by content. Separating dependencies from application classes makes builds and pulls faster and reduces registry storage."
        },
        {
          q: "Which Dockerfile practice is a security problem?",
          options: ["Running as a non-root user", "Using a JRE base image", "Copying a .env file with credentials into the image", "A multi-stage build"],
          answer: 2,
          explain: "Anything copied into an image is readable by anyone who can pull it, and lives in its layers forever. Inject secrets at runtime from the platform instead."
        },
        {
          q: "When is a GraalVM native image most attractive?",
          options: ["Long-running services where peak throughput matters most", "Scale-to-zero, serverless or CLI workloads where startup time and memory footprint dominate", "Applications that rely heavily on runtime bytecode generation", "When builds must be as fast as possible"],
          answer: 1,
          explain: "Native images start in milliseconds and use little memory, ideal when instances start often. Builds are slower, dynamic features need hints, and peak throughput is often lower than a warmed-up JIT."
        },
        {
          q: "What does a native image's closed-world assumption mean for your code?",
          options: ["No network access", "Everything reachable must be known at build time; reflection, proxies and resources used dynamically need hints", "Only one thread is allowed", "The garbage collector is disabled"],
          answer: 1,
          explain: "The native compiler includes only what it can prove is reachable. Spring's AOT processing generates many hints automatically; your own reflective code needs RuntimeHints."
        },
        {
          q: "Which item belongs on a production readiness checklist for a new Spring service?",
          options: ["Maximum log verbosity in production", "Defined SLOs with alerts, timeouts on all outbound calls, graceful shutdown, and a tested rollback path", "Actuator heapdump exposed publicly for debugging", "ddl-auto=update for convenience"],
          answer: 1,
          explain: "Readiness is about operating the service safely: knowing when it is unhealthy, containing dependency failures, deploying without errors and being able to undo a bad release."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.prod = {
    id: "prod",
    name: "Production",
    short: "PROD",
    tagline: "Observable, shippable, operable",
    color: "#fbbf24",
    blurb: "Run Spring Boot services you can see into and ship with confidence: Micrometer metrics with sane cardinality, distributed tracing and structured logs that correlate, liveness and readiness that do not cause outages, efficient container images, when GraalVM native images pay off, and a production readiness checklist.",
    modules: [
      {
        id: "observe",
        name: "Observability",
        icon: "trend",
        lessons: [
          {
            id: "micrometer-metrics",
            title: "Metrics with Micrometer",
            summary: "Counters, timers and gauges, RED metrics per endpoint, histograms for latency SLOs, and keeping tag cardinality bounded.",
            minutes: 9,
            tags: ["micrometer", "metrics", "prometheus"],
            blocks: [
              { t: "p", html: "<strong>Micrometer</strong> is the metrics facade Spring Boot uses: you record measurements once and export them to Prometheus or other backends. Boot already instruments HTTP requests, JVM memory and GC, connection pools, caches and more; your job is to add the business signals and keep the data affordable." },
              { t: "table", headers: ["Meter", "Measures", "Example"], rows: [
                ["Counter", "Things that happen", "orders placed, payments declined"],
                ["Timer", "How long things take, plus count", "checkout duration, partner call latency"],
                ["Gauge", "A current value", "queue depth, cache size"],
                ["Distribution summary", "Sizes that are not times", "order value, payload bytes"]
              ] },
              { t: "code", lang: "java", code: J([
                "@Component",
                "class CheckoutMetrics {",
                "  private final Counter placed;",
                "  private final MeterRegistry registry;",
                "",
                "  CheckoutMetrics(MeterRegistry registry) {",
                "    this.registry = registry;",
                "    this.placed = Counter.builder(\"shop.orders.placed\").register(registry);",
                "  }",
                "",
                "  void declined(String reason) {   // bounded set: insufficient_funds, fraud, expired_card, other",
                "    registry.counter(\"shop.payments.declined\", \"reason\", reason).increment();",
                "  }",
                "}"
              ]) },
              { t: "code", lang: "yaml", code: J([
                "management:",
                "  metrics:",
                "    tags:",
                "      application: orders-service",
                "    distribution:",
                "      percentiles-histogram:",
                "        http.server.requests: true      # histogram buckets for server-side percentiles",
                "      slo:",
                "        http.server.requests: 100ms,300ms,1s"
              ]) },
              { t: "note", variant: "trap", html: "<strong>High-cardinality tags can take down your metrics system.</strong> Tagging with user ids, order ids, raw URLs or exception messages creates a series per value. Use bounded tags (route template, method, status, outcome) and keep per-request detail in traces." },
              { t: "ul", items: [
                "Alert on RED per endpoint: <strong>r</strong>ate, <strong>e</strong>rror ratio, <strong>d</strong>uration percentiles against SLO.",
                "Add saturation signals: pool pending connections, executor queue size, GC pause time, heap after GC.",
                "Prefer histograms over client-side percentiles so you can aggregate across instances.",
                "The Observation API instruments a block once for metrics and tracing together."
              ] },
              { t: "note", variant: "key", html: "<strong>Measure what users feel, with bounded tags.</strong> RED metrics per route, saturation of pools and queues, histograms for SLOs \u2014 and never an unbounded identifier as a tag." }
            ]
          },
          {
            id: "tracing-logging",
            title: "Distributed tracing and structured logging",
            summary: "Propagate trace context across services with Micrometer Tracing and OpenTelemetry, emit structured logs with trace ids, and keep context across threads.",
            minutes: 10,
            tags: ["tracing", "opentelemetry", "logging"],
            blocks: [
              { t: "p", html: "Metrics tell you <em>that</em> checkout is slow; a <strong>trace</strong> shows <em>where</em> the time went across services, and <strong>logs</strong> explain what happened at each step. The glue is a trace id that travels with the request and appears in every log line." },
              { t: "code", lang: "yaml", code: J([
                "management:",
                "  tracing:",
                "    sampling:",
                "      probability: 0.1            # sample 10% in production; tune by traffic",
                "  otlp:",
                "    tracing:",
                "      endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}",
                "logging:",
                "  structured:",
                "    format:",
                "      console: ecs                 # JSON logs with traceId / spanId fields"
              ]) },
              { t: "ul", items: [
                "Micrometer Tracing with the OpenTelemetry bridge propagates W3C <code class='tok'>traceparent</code> headers on RestClient, WebClient and messaging automatically when clients are built from Boot's builders.",
                "Structured JSON logs (built in since Boot 3.4) carry trace ids as fields, so a log search pivots straight to the trace.",
                "Add business keys you search by, such as order id, to the span or to MDC \u2014 not as metric tags.",
                "Context does not cross threads by itself: use Boot-managed executors, a <code class='tok'>TaskDecorator</code>, or the context-propagation library for custom pools."
              ] },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class CheckoutService {",
                "  private static final Logger log = LoggerFactory.getLogger(CheckoutService.class);",
                "",
                "  OrderView place(PlaceOrder cmd) {",
                "    log.atInfo()",
                "       .addKeyValue(\"orderId\", cmd.orderId())",
                "       .addKeyValue(\"itemCount\", cmd.lines().size())",
                "       .log(\"order placed\");    // traceId and spanId are added by the logging context",
                "    ...",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "warn", html: "<strong>Logs are a data store with weaker controls.</strong> Never log tokens, passwords, full card numbers or whole request bodies. Mask personal data and keep log levels disciplined: INFO for business events, DEBUG off in production." },
              { t: "p", html: "Observability as a system discipline: <a class='inline' href='../hld-lld-academy/index.html#/hld/reliability/observability'>Blueprint: observability</a>." },
              { t: "note", variant: "key", html: "<strong>One trace id from edge to database, in every log line.</strong> Propagate context through HTTP, messaging and threads, log structured key-values, and keep secrets out." }
            ]
          },
          {
            id: "health-probes",
            title: "Liveness, readiness and graceful shutdown",
            summary: "Design health checks that help the platform rather than cause outages, and deploy without dropping requests.",
            minutes: 9,
            tags: ["health", "kubernetes", "probes"],
            blocks: [
              { t: "p", html: "Kubernetes asks your service three different questions. Answering them with the same endpoint is one of the most common causes of self-inflicted outages." },
              { t: "table", headers: ["Probe", "Question", "On failure", "Should include"], rows: [
                ["Startup", "Has it finished starting?", "Keep waiting, then restart", "Application context ready"],
                ["Liveness", "Is the process broken beyond repair?", "Restart the container", "Internal state only (deadlock, broken state)"],
                ["Readiness", "Should it receive traffic now?", "Remove from load balancing, no restart", "Warmup done, critical local resources, shutdown in progress"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "# application.yml",
                "management:",
                "  endpoint:",
                "    health:",
                "      probes:",
                "        enabled: true",
                "      group:",
                "        readiness:",
                "          include: readinessState,db     # think hard before adding shared dependencies",
                "server:",
                "  shutdown: graceful",
                "",
                "# deployment.yaml (excerpt)",
                "livenessProbe:  { httpGet: { path: /actuator/health/liveness,  port: 8081 }, periodSeconds: 10, failureThreshold: 3 }",
                "readinessProbe: { httpGet: { path: /actuator/health/readiness, port: 8081 }, periodSeconds: 5 }",
                "startupProbe:   { httpGet: { path: /actuator/health/liveness,  port: 8081 }, failureThreshold: 30, periodSeconds: 2 }",
                "lifecycle:      { preStop: { sleep: { seconds: 5 } } }   # let endpoint removal propagate"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Never put downstream dependencies in liveness.</strong> If the database blips and liveness checks it, every pod restarts at once, caches go cold and the recovery stampedes the database. Liveness is about this process only." },
              { t: "ul", items: [
                "Adding a shared dependency to readiness can still take every pod out of rotation at once; often it is better to stay ready and fail individual requests fast with a breaker.",
                "Spring Boot's <code class='tok'>AvailabilityChangeEvent</code> lets code mark the app refusing traffic, for example during a long cache warmup.",
                "On SIGTERM: readiness goes down, the preStop delay lets load balancers notice, graceful shutdown drains in-flight requests, then the JVM exits."
              ] },
              { t: "quiz", id: "prod-observe" },
              { t: "note", variant: "key", html: "<strong>Liveness restarts, readiness reroutes \u2014 keep them separate.</strong> Liveness checks only the process, readiness reflects the ability to serve, and graceful shutdown plus preStop makes deploys invisible." }
            ]
          }
        ]
      },
      {
        id: "ship",
        name: "Shipping",
        icon: "cube",
        lessons: [
          {
            id: "packaging-containers",
            title: "Container images for Spring Boot",
            summary: "Layered jars or Buildpacks, small non-root runtime images, startup improvements with CDS, and keeping secrets out of images.",
            minutes: 10,
            tags: ["docker", "buildpacks", "cds"],
            blocks: [
              { t: "p", html: "A Spring Boot jar runs anywhere with a JVM, but how you package it into an image changes build speed, image size, startup time and security posture." },
              { t: "widget", id: "prodPackaging" },
              { t: "code", lang: "bash", code: J([
                "# Cloud Native Buildpacks: no Dockerfile, layered and non-root by default",
                "./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=registry.shop.example/orders:1.42.0"
              ]) },
              { t: "code", lang: "dockerfile", code: J([
                "# build stage: extract the jar into layers",
                "FROM eclipse-temurin:21-jre AS build",
                "WORKDIR /build",
                "COPY target/orders.jar app.jar",
                "RUN java -Djarmode=tools -jar app.jar extract --layers --launcher --destination extracted",
                "",
                "# runtime stage: small JRE, non-root, layers ordered by change frequency",
                "FROM eclipse-temurin:21-jre",
                "RUN useradd --system --uid 10001 app",
                "USER 10001",
                "WORKDIR /app",
                "COPY --from=build /build/extracted/dependencies/ ./",
                "COPY --from=build /build/extracted/spring-boot-loader/ ./",
                "COPY --from=build /build/extracted/snapshot-dependencies/ ./",
                "COPY --from=build /build/extracted/application/ ./",
                "ENV JAVA_TOOL_OPTIONS=\"-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError\"",
                "ENTRYPOINT [\"java\", \"org.springframework.boot.loader.launch.JarLauncher\"]"
              ]) },
              { t: "ul", items: [
                "Run as a non-root user and keep the root filesystem read-only where possible.",
                "Use a JRE (or a jlink-trimmed runtime), not a full JDK, in the final image.",
                "Speed up startup with a <strong>CDS archive</strong> created by a training run (<code class='tok'>-XX:ArchiveClassesAtExit</code> with <code class='tok'>-Dspring.context.exit=onRefresh</code>), or a JVM AOT cache on recent JDKs.",
                "Generate an SBOM and scan images in CI; rebuild regularly to pick up base-image patches."
              ] },
              { t: "note", variant: "trap", html: "<strong>Secrets baked into images leak to everyone who can pull them.</strong> No credentials in <code class='tok'>COPY</code>, <code class='tok'>ENV</code> or build args; layers keep them even if a later step deletes the file. Inject at runtime." },
              { t: "p", html: "Delivery pipelines and container platforms: <a class='inline' href='../hld-lld-academy/index.html#/hld/production-readiness/containers-delivery'>Blueprint: containers and delivery</a>." },
              { t: "note", variant: "key", html: "<strong>Layered, small, non-root, secret-free.</strong> Use Buildpacks or an extracted layered jar on a JRE, add CDS or an AOT cache for startup, and scan what you ship." }
            ]
          },
          {
            id: "graalvm-native",
            title: "GraalVM native images",
            summary: "How Spring AOT and native compilation work, their closed-world constraints, and when the trade-off is worth it.",
            minutes: 9,
            tags: ["graalvm", "native-image", "aot"],
            blocks: [
              { t: "p", html: "A <strong>native image</strong> compiles your application and the parts of the JDK it uses into a single executable ahead of time. No JIT warmup, no class loading at startup: it is ready in tens of milliseconds and uses a fraction of the memory." },
              { t: "h", text: "How Spring gets there" },
              { t: "ol", items: [
                "<strong>Spring AOT</strong> processing runs at build time, evaluates configuration and conditions, and generates code and hints for bean definitions.",
                "GraalVM performs static analysis from the entry point under a <strong>closed-world assumption</strong>: only reachable code is included.",
                "Reflection, proxies, resources and serialization used dynamically must be declared as hints; Spring and many libraries supply theirs."
              ] },
              { t: "code", lang: "bash", code: J([
                "# build a native executable (GraalVM installed) using the native profile",
                "./mvnw -Pnative native:compile",
                "",
                "# or a native container image with Buildpacks",
                "./mvnw -Pnative spring-boot:build-image",
                "",
                "# run tests compiled natively, to catch missing hints",
                "./mvnw -PnativeTest test"
              ]) },
              { t: "code", lang: "java", code: J([
                "class PricingHints implements RuntimeHintsRegistrar {",
                "  @Override",
                "  public void registerHints(RuntimeHints hints, ClassLoader cl) {",
                "    hints.reflection().registerType(LegacyRuleSet.class, MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);",
                "    hints.resources().registerPattern(\"pricing/rules/*.json\");",
                "  }",
                "}",
                "// @ImportRuntimeHints(PricingHints.class) on a configuration class"
              ]) },
              { t: "table", headers: ["Choose native when", "Stay on the JVM when"], rows: [
                ["Scale-to-zero or serverless with frequent cold starts", "Long-running services where peak throughput matters"],
                ["Many small instances where memory cost dominates", "Heavy use of runtime bytecode generation or dynamic class loading"],
                ["CLIs and short jobs", "Fast build cycles matter more than startup"],
                ["Startup SLOs a warm JVM cannot meet", "Your libraries lack native support"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Profile conditions are fixed at build time.</strong> Spring AOT evaluates configuration during the build, so beans that depend on profiles or properties changing at runtime may not behave as on the JVM. Test the native artifact, not just the JVM build." },
              { t: "note", variant: "key", html: "<strong>Native trades build-time effort for startup and memory.</strong> Use it where cold starts and footprint dominate, supply hints for dynamic code, and test the native binary itself." }
            ]
          },
          {
            id: "production-checklist",
            title: "Production readiness checklist",
            summary: "The questions to answer before a Spring service takes real traffic, across configuration, security, resilience, data, observability and operations.",
            minutes: 10,
            tags: ["production-readiness", "slo", "operations"],
            blocks: [
              { t: "p", html: "Shipping is the start of operating. This checklist pulls the course together into what reviewers ask before a service takes real traffic. Each item links back to where it is taught." },
              { t: "table", headers: ["Area", "Ready when"], rows: [
                ["Configuration", "Typed, validated settings; secrets injected as <code class='tok'>${...}</code> placeholders; nothing environment-specific in the jar (<a class='inline' href='#/boot/config/profiles-config'>config</a>)"],
                ["Security", "Deny-by-default chain, token audience checks, object-level authorization, Actuator internal (<a class='inline' href='#/sec/authz/method-security'>method security</a>)"],
                ["API", "ProblemDetail errors, idempotency keys on unsafe retries, paginated lists (<a class='inline' href='#/api/rest/idempotency-keys'>idempotency</a>)"],
                ["Resilience", "Timeouts on every call, bounded retries, breakers and bulkheads on fragile dependencies (<a class='inline' href='#/res/calls/timeouts-retries'>timeouts</a>)"],
                ["Data", "Versioned migrations compatible with N-1, short transactions, budgeted pools, no N+1 on hot paths (<a class='inline' href='#/data/ops/migrations'>migrations</a>)"],
                ["Events", "Outbox for published events, idempotent consumers, DLT with alerts (<a class='inline' href='#/res/events/outbox'>outbox</a>)"],
                ["Observability", "RED metrics and SLO alerts, traces with sampling, structured logs without secrets (<a class='inline' href='#/prod/observe/micrometer-metrics'>metrics</a>)"],
                ["Runtime", "Heap sized for the container, collector chosen, JFR continuous recording, heap dump on OOM (<a class='inline' href='#/jvm/memory/memory-areas'>memory</a>)"],
                ["Deployment", "Separate liveness and readiness, graceful shutdown, rollback tested (<a class='inline' href='#/prod/observe/health-probes'>probes</a>)"],
                ["Tests", "Slice tests, Testcontainers, contract tests and architecture rules in CI (<a class='inline' href='#/test/integration/testcontainers'>Testcontainers</a>)"]
              ] },
              { t: "h", text: "Before launch" },
              { t: "ul", items: [
                "Define SLOs (for example 99.9% of checkout requests succeed under 300 ms) and alert on error-budget burn rather than raw thresholds.",
                "Load-test to the expected peak plus headroom; find which pool or dependency saturates first.",
                "Write a short runbook: dashboards, common failures, how to roll back, who owns which dependency.",
                "Rehearse a rollback and a dependency outage in a staging environment."
              ] },
              { t: "note", variant: "tip", html: "<strong>Error budgets turn reliability into a decision.</strong> When the budget is spent, slow features and fix reliability; when it is healthy, ship faster. See <a class='inline' href='../hld-lld-academy/index.html#/hld/reliability/slo-error-budgets'>Blueprint: SLOs and error budgets</a>." },
              { t: "table", headers: ["Level", "What they say"], rows: [
                ["Mid", "The service works and has tests and a health endpoint"],
                ["Senior", "Walks the checklist with evidence: SLO alerts, timeouts, pool budgets, rollback rehearsed"],
                ["Staff", "Turns the checklist into paved-road templates and automated checks across every team's services"]
              ] },
              { t: "quiz", id: "prod-ship" },
              { t: "note", variant: "key", html: "<strong>Ready means operable, not just working.</strong> Validated config, secured endpoints, contained failures, safe data changes, visible behaviour and a rehearsed rollback \u2014 before the first real user." }
            ]
          }
        ]
      }
    ]
  };
})();
