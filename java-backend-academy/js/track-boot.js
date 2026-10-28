/* =====================================================================
   ANVIL · Spring Boot Core
   window.TRACKS.boot — modules: ioc / config
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     bootConfigPrecedence — which property source wins?
  ================================================================== */
  var SOURCES = [
    { id: "jar", label: "application.yml inside the jar", value: "2s", syntax: "app.payment.timeout: 2s" },
    { id: "jarProfile", label: "application-prod.yml inside the jar", value: "3s", syntax: "app.payment.timeout: 3s", profile: true },
    { id: "ext", label: "./config/application.yml next to the jar", value: "4s", syntax: "app.payment.timeout: 4s" },
    { id: "extProfile", label: "./config/application-prod.yml", value: "5s", syntax: "app.payment.timeout: 5s", profile: true },
    { id: "env", label: "OS environment variable", value: "6s", syntax: "APP_PAYMENT_TIMEOUT=6s" },
    { id: "sys", label: "Java system property", value: "7s", syntax: "-Dapp.payment.timeout=7s" },
    { id: "cli", label: "Command-line argument", value: "8s", syntax: "--app.payment.timeout=8s" }
  ];

  Widgets.bootConfigPrecedence = function (mount) {
    K.shell(mount, "explore", "Property precedence",
      "The property app.payment.timeout is defined in several places. Switch sources on and off, and toggle the prod profile, to see which value Spring Boot binds. Sources lower in the list override those above.");
    var on = { jar: true, jarProfile: true, ext: false, extProfile: false, env: true, sys: false, cli: false };
    var prod = true;
    var list = h("div", { class: "w-stage", style: "display:grid;gap:6px" });
    var readout = h("div", { class: "w-readout" });
    function winner() {
      var w = null;
      SOURCES.forEach(function (s) {
        if (!on[s.id]) return;
        if (s.profile && !prod) return;
        w = s;
      });
      return w;
    }
    function paint() {
      var w = winner();
      K.clear(list);
      SOURCES.forEach(function (s, idx) {
        var applies = on[s.id] && (!s.profile || prod);
        var isWin = w && w.id === s.id;
        var b = K.btn(on[s.id] ? "on" : "off", on[s.id] ? "primary" : "ghost", function () { on[s.id] = !on[s.id]; paint(); });
        b.style.minWidth = "52px";
        list.appendChild(h("div", {
          style: "display:flex;gap:10px;align-items:center;padding:6px 8px;border-radius:8px;border:1px " + (applies ? "solid " : "dashed ") + (isWin ? "var(--accent)" : "var(--line)")
        },
          b,
          h("span", { style: "font-size:0.72rem;color:var(--text-dim);min-width:18px" }, String(idx + 1)),
          h("span", { style: "flex:1;font-size:0.84rem;color:" + (applies ? "var(--text)" : "var(--text-dim)") }, s.label, s.profile && !prod ? " (profile inactive)" : !on[s.id] ? " (off)" : ""),
          h("code", { class: "tok" }, s.syntax),
          isWin ? h("span", { class: "w-pill" }, "wins") : null));
      });
      K.clear(readout);
      readout.appendChild(K.ro("active profile", prod ? "prod" : "default"));
      readout.appendChild(K.ro("bound value", w ? w.value : "none (startup fails if the record requires it)"));
      readout.appendChild(K.ro("from", w ? w.label : "\u2014"));
      readout.appendChild(K.wide("Rule of thumb: package defaults in the jar, environment differences in profiles or external config, and secrets and per-deployment overrides in environment variables injected by the platform."));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([[true, "prod profile active"], [false, "no profile"]], 0, function (v) { prod = v; paint(); }),
      K.btn("Reset", "ghost", function () { on = { jar: true, jarProfile: true, ext: false, extProfile: false, env: true, sys: false, cli: false }; paint(); })
    ));
    mount.appendChild(list);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "boot-ioc": {
      title: "Dependency injection and structure checkpoint",
      sub: "Injection style, bean lifecycle, proxies and feature packaging.",
      questions: [
        {
          q: "Why is constructor injection preferred over @Autowired fields?",
          options: ["It is faster at runtime", "Dependencies are explicit and final, the object is never half-built, and it can be constructed in a plain unit test", "Field injection is removed from Spring", "It avoids creating beans"],
          answer: 1,
          explain: "Constructor injection makes required collaborators visible in the signature, allows final fields, and lets tests call new with fakes. A long constructor is also an honest signal that the class does too much."
        },
        {
          q: "A @Transactional method is called from another method in the same bean, and no transaction starts. Why?",
          options: ["Transactions only work on interfaces", "Spring applies @Transactional through a proxy, and a call on this bypasses the proxy", "The method must be static", "@Transactional needs @Async"],
          answer: 1,
          explain: "Spring wraps the bean in a proxy that adds behaviour around external calls. Self-invocation goes straight to the target object. Move the method to another bean or restructure the call."
        },
        {
          q: "A singleton service needs a fresh instance of a prototype-scoped helper for each call. What works?",
          options: ["Inject the prototype bean into a field", "Inject ObjectProvider<Helper> and call getObject() per use", "Mark the service @Lazy", "Make the helper static"],
          answer: 1,
          explain: "A prototype injected into a singleton is created once, at injection time. ObjectProvider (or a factory) asks the container for a new instance whenever you need one."
        },
        {
          q: "Which statement about singleton beans is correct?",
          options: ["Each request gets its own singleton", "One instance is shared by all threads, so it must be stateless or thread-safe", "Singletons cannot have dependencies", "Singletons are created on first HTTP request"],
          answer: 1,
          explain: "The default scope gives one shared instance per container. Mutable instance fields on a singleton service are a classic concurrency bug; keep request state in local variables or method parameters."
        },
        {
          q: "What is the main benefit of packaging by feature (orders, payments) instead of by layer (controllers, services, repositories)?",
          options: ["Fewer classes", "Related code changes together, and package-private visibility can hide a feature's internals from the rest of the app", "Spring scans faster", "It removes the need for tests"],
          answer: 1,
          explain: "Feature packages keep a change inside one folder and allow you to expose only a small public API per feature. Layer packages force every class to be public and invite cross-feature coupling."
        }
      ]
    },
    "boot-config": {
      title: "Auto-configuration and configuration checkpoint",
      sub: "Conditions, property binding and precedence, secrets and Actuator.",
      questions: [
        {
          q: "You define your own ObjectMapper bean and Boot's default one disappears. Which mechanism causes this?",
          options: ["Bean overriding by name", "@ConditionalOnMissingBean on the auto-configured bean, so it backs off when you supply one", "Component scanning order", "A bug in Jackson"],
          answer: 1,
          explain: "Auto-configurations are guarded by conditions. Most default beans use @ConditionalOnMissingBean, so a user-defined bean of that type wins and the default is skipped."
        },
        {
          q: "How do you find out why an auto-configuration did or did not apply?",
          options: ["Read the Boot source code line by line", "Run with --debug or check the Actuator conditions endpoint for the condition evaluation report", "Delete and recreate the project", "Enable TRACE for all packages"],
          answer: 1,
          explain: "The condition evaluation report lists positive and negative matches with the reason for each, for example a missing class or an existing bean. It is the fastest route to 'why is this bean here?'."
        },
        {
          q: "The jar contains app.payment.timeout: 2s, and the platform sets the environment variable APP_PAYMENT_TIMEOUT=6s. Which value is bound?",
          options: ["2s", "6s", "Both, as a list", "Startup fails"],
          answer: 1,
          explain: "OS environment variables override config files packaged in the jar, and relaxed binding maps APP_PAYMENT_TIMEOUT to app.payment.timeout. That is why per-deployment values and secrets usually arrive as env vars."
        },
        {
          q: "What is the right way to provide the database password to a Spring Boot service?",
          options: ["Commit it in application-prod.yml", "Reference a placeholder such as ${DB_PASSWORD} and have the platform inject it from a secret manager or mounted secret", "Hardcode it in a @Configuration class", "Put it in the README for operators"],
          answer: 1,
          explain: "Secrets must never live in source or packaged config. A placeholder resolved from the environment, a mounted secret file or a secret manager keeps the value out of the repository and allows rotation."
        },
        {
          q: "Which Actuator exposure is the safe default for a public-facing service?",
          options: ["Expose every endpoint over HTTP", "Expose health (and selected metrics) only, ideally on a separate management port that is not publicly routed", "Disable Actuator entirely", "Expose env and heapdump for debugging"],
          answer: 1,
          explain: "Endpoints such as env, heapdump and loggers reveal or change sensitive state. Expose only what probes and scrapers need, keep the management port internal, and secure anything else."
        },
        {
          q: "Why bind configuration into a validated @ConfigurationProperties record rather than scattering @Value annotations?",
          options: ["@Value is deprecated", "Settings are typed, grouped, documented in one place and validated at startup, so a bad value fails fast", "Records load faster", "It hides properties from Actuator"],
          answer: 1,
          explain: "A record with @Validated and constraints such as @NotNull or @DurationMin turns a typo or missing value into a clear startup failure instead of a runtime surprise, and gives one place to see a feature's settings."
        }
      ]
    },
    "boot-jobs": {
      title: "Jobs and scheduling checkpoint",
      sub: "@Scheduled semantics, distributed locks and Spring Batch restartability.",
      questions: [
        {
          q: "A @Scheduled method runs a nightly cleanup. The service scales to 4 replicas. What happens by default?",
          options: ["Spring elects one replica automatically", "All 4 replicas run the job at the same time", "Only the oldest pod runs it", "The job is skipped"],
          answer: 1,
          explain: "@Scheduled is purely in-process. Every instance has its own scheduler, so you need a distributed lock (such as ShedLock) or a single external trigger."
        },
        {
          q: "What does ShedLock's lockAtMostFor protect against?",
          options: ["Jobs running too fast", "A node dying while holding the lock, which would otherwise block the job forever", "Clock drift between databases", "Duplicate bean definitions"],
          answer: 1,
          explain: "The lock row carries an expiry. If the holder crashes, the lock frees itself after lockAtMostFor. Set it well above the job's normal run time."
        },
        {
          q: "What is the difference between fixedRate and fixedDelay in @Scheduled?",
          options: ["None", "fixedRate measures from each start, fixedDelay from the previous completion", "fixedDelay runs in parallel", "fixedRate needs a cron expression"],
          answer: 1,
          explain: "With fixedDelay, a slow run pushes back the next one. With fixedRate, starts are on a fixed cadence and a slow run can be followed immediately by the next."
        },
        {
          q: "Why does Spring Batch use chunk-oriented processing with a JobRepository?",
          options: ["To use more memory", "To commit in chunks and record progress, so a failed job restarts from the last committed chunk instead of from the start", "To replace the database", "Because Kafka requires it"],
          answer: 1,
          explain: "Each chunk (read N, process, write N) commits in one transaction, and step execution state is persisted. Restarts resume, and skip/retry policies handle bad records."
        },
        {
          q: "By default, how many threads does Spring Boot's scheduler use for @Scheduled tasks?",
          options: ["One per method", "One (unless spring.task.scheduling.pool.size is raised, or virtual threads are enabled)", "Equal to CPU count", "Unlimited"],
          answer: 1,
          explain: "A single scheduling thread means one slow job delays every other job. Size the pool, or enable virtual threads, and keep scheduled methods short by handing work off."
        }
      ]
    },
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.boot = {
    id: "boot",
    name: "Spring Boot Core",
    short: "BOOT",
    tagline: "The container, the conventions, the configuration",
    color: "#84cc16",
    blurb: "Understand what Spring actually does for you: dependency injection and bean lifecycles, proxies and their traps, feature-first package structure, how auto-configuration decides what to create, typed and validated configuration with externalized secrets, and Actuator as the operational window into a service.",
    modules: [
      {
        id: "ioc",
        name: "Container & Structure",
        icon: "plug",
        lessons: [
          {
            id: "di-ioc",
            title: "Dependency injection and inversion of control",
            summary: "Let the container wire collaborators: constructor injection, stereotypes vs @Bean methods, choosing among candidates, and injecting strategies.",
            minutes: 9,
            tags: ["spring", "di", "ioc", "beans"],
            blocks: [
              { t: "p", html: "In <strong>inversion of control</strong>, your classes declare what they need and a container creates and connects them. Spring's container (the <code class='tok'>ApplicationContext</code>) builds a graph of <strong>beans</strong> at startup, which is why wiring mistakes fail fast before the first request." },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class CheckoutService {",
                "  private final PaymentGateway payments;",
                "  private final OrderRepository orders;",
                "",
                "  // single constructor: no @Autowired needed",
                "  CheckoutService(PaymentGateway payments, OrderRepository orders) {",
                "    this.payments = payments;",
                "    this.orders = orders;",
                "  }",
                "}"
              ]) },
              { t: "compare",
                bad: { title: "Field injection", items: ["Hidden dependencies, non-final fields", "Needs reflection or a Spring context to test", "Easy to keep adding collaborators unnoticed"] },
                good: { title: "Constructor injection", items: ["Dependencies visible and final", "Plain <code class='tok'>new</code> in unit tests", "A long constructor is an honest design smell"] } },
              { t: "h", text: "Declaring beans" },
              { t: "table", headers: ["Style", "Use when"], rows: [
                ["<code class='tok'>@Component</code>, <code class='tok'>@Service</code>, <code class='tok'>@Repository</code>, <code class='tok'>@RestController</code>", "Your own classes, discovered by component scanning"],
                ["<code class='tok'>@Bean</code> method in a <code class='tok'>@Configuration</code> class", "Third-party types, or construction logic such as configuring a client"],
                ["<code class='tok'>@Primary</code> / <code class='tok'>@Qualifier</code>", "Several beans implement the same type"],
                ["<code class='tok'>List&lt;T&gt;</code> or <code class='tok'>Map&lt;String, T&gt;</code> injection", "Strategy pattern: collect every implementation"]
              ] },
              { t: "code", lang: "java", code: J([
                "interface ShippingRule { boolean applies(Order o); Money cost(Order o); }",
                "",
                "@Component",
                "class ShippingCalculator {",
                "  private final List<ShippingRule> rules; // every ShippingRule bean, in @Order order",
                "  ShippingCalculator(List<ShippingRule> rules) { this.rules = rules; }",
                "",
                "  Money cost(Order o) {",
                "    return rules.stream().filter(r -> r.applies(o)).findFirst()",
                "        .orElseThrow(() -> new IllegalStateException(\"no rule for \" + o.id()))",
                "        .cost(o);",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "warn", html: "<strong>Circular dependencies are rejected by default.</strong> Since Boot 2.6, A needing B needing A fails at startup. Do not switch the check off; extract the shared responsibility into a third bean or publish an event." },
              { t: "p", html: "Depending on interfaces you own, and letting the container supply the implementation, is the dependency-inversion principle in practice: <a class='inline' href='../hld-lld-academy/index.html#/lld/solid/dip'>Blueprint: dependency inversion</a>." },
              { t: "note", variant: "key", html: "<strong>Declare needs in the constructor; let the container wire them.</strong> Prefer final constructor-injected dependencies, @Bean methods for third-party types, and collections of beans for strategies." }
            ]
          },
          {
            id: "bean-lifecycle-scopes",
            title: "Bean lifecycle, scopes and proxies",
            summary: "What happens between construction and readiness, singleton vs other scopes, and how proxies power @Transactional and friends.",
            minutes: 10,
            tags: ["lifecycle", "scopes", "aop", "proxies"],
            blocks: [
              { t: "p", html: "Every bean goes through the same lifecycle. Knowing it explains most surprising Spring behaviour, because many features are added by <strong>post-processors</strong> that wrap your object in a <strong>proxy</strong>." },
              { t: "ol", items: [
                "Instantiate the class (constructor injection happens here).",
                "Inject remaining dependencies and call aware callbacks.",
                "<code class='tok'>BeanPostProcessor</code> before-initialization hooks.",
                "Initialization: <code class='tok'>@PostConstruct</code>, then <code class='tok'>afterPropertiesSet</code>.",
                "After-initialization hooks: proxies for <code class='tok'>@Transactional</code>, <code class='tok'>@Async</code>, <code class='tok'>@Cacheable</code>, method security are created here.",
                "The bean is ready; on shutdown <code class='tok'>@PreDestroy</code> runs."
              ] },
              { t: "h", text: "Scopes" },
              { t: "table", headers: ["Scope", "Instances", "Watch out for"], rows: [
                ["singleton (default)", "One per container, shared by all threads", "Must be stateless or thread-safe"],
                ["prototype", "New one per injection or lookup", "Injected into a singleton, it is created only once"],
                ["request / session", "One per HTTP request or session", "Injected through a scoped proxy"]
              ] },
              { t: "h", text: "Proxies and their traps" },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class InvoiceService {",
                "  public void closeMonth() {",
                "    issue(); // self-call: goes to 'this', not the proxy -> no transaction!",
                "  }",
                "",
                "  @Transactional",
                "  public void issue() { /* ... */ }",
                "}"
              ]) },
              { t: "ul", items: [
                "Self-invocation skips the proxy, so <code class='tok'>@Transactional</code>, <code class='tok'>@Async</code> and <code class='tok'>@Cacheable</code> silently do nothing.",
                "Proxies cannot intercept <code class='tok'>final</code> or <code class='tok'>private</code> methods.",
                "Annotations on a method that is only called internally are a code-review red flag."
              ] },
              { t: "note", variant: "tip", html: "<strong>Need a fresh prototype from a singleton?</strong> Inject <code class='tok'>ObjectProvider&lt;T&gt;</code> and call <code class='tok'>getObject()</code> each time. Proxies are an instance of the decorator idea: <a class='inline' href='../hld-lld-academy/index.html#/lld/patterns/structural'>Blueprint: structural patterns</a>." },
              { t: "h", text: "Graceful shutdown" },
              { t: "code", lang: "yaml", code: J([
                "server:",
                "  shutdown: graceful          # stop accepting, finish in-flight requests",
                "spring:",
                "  lifecycle:",
                "    timeout-per-shutdown-phase: 20s"
              ]) },
              { t: "note", variant: "key", html: "<strong>Features arrive through proxies created after initialization.</strong> Keep singletons stateless, avoid self-invocation of proxied methods, and use ObjectProvider for per-use instances." }
            ]
          },
          {
            id: "feature-packaging",
            title: "Package by feature and keep controllers thin",
            summary: "Organize a Spring service around business capabilities, expose small public APIs, and keep web, domain and persistence concerns in their place.",
            minutes: 9,
            tags: ["architecture", "packaging", "modularity"],
            blocks: [
              { t: "p", html: "How you arrange packages decides how easily the code can change. Grouping by <strong>technical layer</strong> spreads one feature across four folders and forces everything public. Grouping by <strong>feature</strong> keeps a change local and lets Java's package-private visibility enforce boundaries." },
              { t: "code", lang: "text", code: J([
                "com.shop",
                "\u251c\u2500 orders/                    <- one business capability",
                "\u2502  \u251c\u2500 OrderController.java     (web: HTTP in, DTOs out)",
                "\u2502  \u251c\u2500 OrderService.java        (public API of the feature)",
                "\u2502  \u251c\u2500 Order.java               (domain, package-private where possible)",
                "\u2502  \u251c\u2500 OrderRepository.java     (persistence)",
                "\u2502  \u2514\u2500 dto/CreateOrderRequest.java",
                "\u251c\u2500 payments/",
                "\u2514\u2500 shared/                    <- small, stable, boring"
              ]) },
              { t: "h", text: "Thin controllers" },
              { t: "code", lang: "java", code: J([
                "@RestController",
                "@RequestMapping(\"/orders\")",
                "class OrderController {",
                "  private final OrderService orders;",
                "  OrderController(OrderService orders) { this.orders = orders; }",
                "",
                "  @PostMapping",
                "  ResponseEntity<OrderView> create(@Valid @RequestBody CreateOrderRequest req,",
                "                                   @RequestHeader(\"Idempotency-Key\") String key) {",
                "    OrderView view = orders.create(req.toCommand(), key); // all rules live in the service",
                "    return ResponseEntity.created(URI.create(\"/orders/\" + view.id())).body(view);",
                "  }",
                "}"
              ]) },
              { t: "table", headers: ["Layer", "Owns", "Must not"], rows: [
                ["Controller", "HTTP mapping, validation annotations, status codes", "Hold business rules or open transactions"],
                ["Service", "Use cases, transactions, invariants", "Return JPA entities to the web layer"],
                ["Repository", "Queries and persistence", "Call other features' repositories"],
                ["DTOs", "API shape (records)", "Leak into persistence"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Returning JPA entities from controllers couples your API to your schema.</strong> It also triggers lazy-loading surprises during JSON serialization. Map to response records at the service boundary." },
              { t: "note", variant: "tip", html: "<strong>Enforce boundaries with tests, not wiki pages.</strong> ArchUnit can fail the build when <code class='tok'>payments</code> reaches into <code class='tok'>orders</code> internals \u2014 see <a class='inline' href='#/test/quality/architecture-tests'>architecture tests</a>. Spring Modulith offers similar checks for module-style monoliths." },
              { t: "quiz", id: "boot-ioc" },
              { t: "note", variant: "key", html: "<strong>Package by feature, publish a small API, keep controllers thin.</strong> Business rules and transactions belong in services; the web layer maps HTTP to commands and results to DTOs." }
            ]
          }
        ]
      },
      {
        id: "config",
        name: "Auto-configuration & Config",
        icon: "compass",
        lessons: [
          {
            id: "auto-configuration",
            title: "How auto-configuration really works",
            summary: "Conditional configuration classes, backing off when you define your own beans, and reading the condition evaluation report.",
            minutes: 9,
            tags: ["auto-configuration", "conditions", "starters"],
            blocks: [
              { t: "p", html: "<code class='tok'>@SpringBootApplication</code> combines <code class='tok'>@Configuration</code>, <code class='tok'>@ComponentScan</code> and <code class='tok'>@EnableAutoConfiguration</code>. The last one loads a list of <strong>auto-configuration classes</strong> from every jar on the classpath, and each one only contributes beans if its <strong>conditions</strong> hold." },
              { t: "diagram", id: "boot-autoconfig", caption: "Candidates come from the imports files; conditions decide; your own beans always win." },
              { t: "table", headers: ["Condition", "Applies when", "Typical use"], rows: [
                ["<code class='tok'>@ConditionalOnClass</code>", "A class is on the classpath", "Configure Jackson only if Jackson is present"],
                ["<code class='tok'>@ConditionalOnMissingBean</code>", "You did not define one", "Default beans that back off"],
                ["<code class='tok'>@ConditionalOnProperty</code>", "A property has a value", "Feature switches"],
                ["<code class='tok'>@ConditionalOnWebApplication</code>", "Running as a web app", "Servlet or reactive web setup"]
              ] },
              { t: "code", lang: "java", code: J([
                "// META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports",
                "// lists: com.shop.audit.AuditAutoConfiguration",
                "",
                "@AutoConfiguration",
                "@ConditionalOnClass(AuditSink.class)",
                "@EnableConfigurationProperties(AuditProperties.class)",
                "public class AuditAutoConfiguration {",
                "  @Bean",
                "  @ConditionalOnMissingBean",
                "  AuditSink auditSink(AuditProperties props) {",
                "    return new HttpAuditSink(props.endpoint(), props.timeout());",
                "  }",
                "}"
              ]) },
              { t: "h", text: "Debugging it" },
              { t: "code", lang: "bash", code: J([
                "# print the condition evaluation report at startup",
                "java -jar app.jar --debug",
                "",
                "# or, with Actuator exposed internally",
                "curl -s http://localhost:8081/actuator/conditions"
              ]) },
              { t: "note", variant: "tip", html: "<strong>To change a default, define the bean or set a property \u2014 do not fight the framework.</strong> Excluding whole auto-configurations with <code class='tok'>exclude=</code> is a last resort and is easy to forget about later." },
              { t: "note", variant: "key", html: "<strong>Auto-configuration is conditional configuration you can inspect.</strong> Your beans win over defaults, properties tune them, and the condition report tells you exactly why something was or was not created." }
            ]
          },
          {
            id: "profiles-config",
            title: "Typed configuration, profiles and secrets",
            summary: "Bind settings into validated records, understand property precedence and profiles, and keep secrets out of code and packaged config.",
            minutes: 10,
            tags: ["configuration", "profiles", "secrets"],
            blocks: [
              { t: "p", html: "Configuration is the part of a service that changes between environments without a rebuild. Spring Boot reads it from many <strong>property sources</strong> and binds it into your objects. Get the binding typed and validated, and know which source wins." },
              { t: "code", lang: "java", code: J([
                "@Validated",
                "@ConfigurationProperties(prefix = \"app.payment\")",
                "public record PaymentProperties(",
                "    @NotNull URI baseUrl,",
                "    @NotNull @DurationMin(millis = 100) Duration timeout,",
                "    @Min(0) @Max(5) int maxRetries) {}",
                "",
                "// enable once: @ConfigurationPropertiesScan on the application class"
              ]) },
              { t: "code", lang: "yaml", code: J([
                "app:",
                "  payment:",
                "    base-url: https://payments.internal.example",
                "    timeout: 2s",
                "    max-retries: 2",
                "spring:",
                "  datasource:",
                "    url: ${DB_URL}",
                "    username: ${DB_USER}",
                "    password: ${DB_PASSWORD}   # injected by the platform, never committed"
              ]) },
              { t: "widget", id: "bootConfigPrecedence" },
              { t: "h", text: "Profiles" },
              { t: "p", html: "A profile activates extra config files and beans, for example <code class='tok'>application-prod.yml</code> or <code class='tok'>@Profile(\"local\")</code>. Use profiles for genuine environment differences, not as a second branching mechanism for business logic." },
              { t: "h", text: "Secrets" },
              { t: "ul", items: [
                "Never commit secrets in YAML, code or Dockerfiles; reference placeholders like <code class='tok'>${DB_PASSWORD}</code>.",
                "Let the platform inject them: Kubernetes secrets as env vars or mounted files (<code class='tok'>spring.config.import=configtree:/run/secrets/</code>), or a secret manager integration.",
                "Prefer short-lived credentials where the platform supports them, and rotate without a rebuild.",
                "Actuator's <code class='tok'>env</code> endpoint masks values by default; keep it that way and keep it internal."
              ] },
              { t: "note", variant: "trap", html: "<strong>Relaxed binding has rules.</strong> The env var <code class='tok'>APP_PAYMENT_MAXRETRIES</code> binds to <code class='tok'>app.payment.max-retries</code>: uppercase, dots become underscores, dashes are removed. A mistyped name is silently ignored unless validation requires the value." },
              { t: "note", variant: "key", html: "<strong>Type it, validate it, externalize it.</strong> Bind settings into validated records, keep defaults in the jar and environment differences outside it, and inject secrets through placeholders." }
            ]
          },
          {
            id: "actuator",
            title: "Actuator: the operational window",
            summary: "Health, metrics, info and loggers endpoints, safe exposure, a separate management port, and health groups for probes.",
            minutes: 8,
            tags: ["actuator", "operations", "health"],
            blocks: [
              { t: "p", html: "<strong>Spring Boot Actuator</strong> adds production endpoints: health, metrics, build info, runtime log-level changes and more. Platforms use them for probes and scraping; engineers use them in incidents. Because they reveal internals, exposure must be deliberate." },
              { t: "table", headers: ["Endpoint", "Gives you", "Expose?"], rows: [
                ["<code class='tok'>health</code>", "UP / DOWN plus component details and probe groups", "Yes, for probes"],
                ["<code class='tok'>prometheus</code> / <code class='tok'>metrics</code>", "Micrometer metrics", "Internally, for scrapers"],
                ["<code class='tok'>info</code>", "Build and git metadata", "Internally"],
                ["<code class='tok'>loggers</code>", "Read and change log levels at runtime", "Internally, secured"],
                ["<code class='tok'>env</code>, <code class='tok'>configprops</code>", "Resolved configuration (masked)", "Rarely, secured"],
                ["<code class='tok'>heapdump</code>, <code class='tok'>threaddump</code>", "Diagnostics", "Only behind strong access control"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "management:",
                "  server:",
                "    port: 8081                     # not routed by the public ingress",
                "  endpoints:",
                "    web:",
                "      exposure:",
                "        include: health,info,prometheus",
                "  endpoint:",
                "    health:",
                "      probes:",
                "        enabled: true              # /actuator/health/liveness and /readiness",
                "      show-details: when-authorized",
                "  info:",
                "    git:",
                "      mode: simple"
              ]) },
              { t: "note", variant: "warn", html: "<strong>heapdump over HTTP leaks secrets.</strong> A heap dump contains tokens, passwords and personal data held in memory. Never expose it publicly; most services should not expose it at all." },
              { t: "p", html: "Liveness and readiness are different questions with different consequences; the details live in <a class='inline' href='#/prod/observe/health-probes'>health probes</a>, and metrics in <a class='inline' href='#/prod/observe/micrometer-metrics'>Micrometer metrics</a>." },
              { t: "quiz", id: "boot-config" },
              { t: "note", variant: "key", html: "<strong>Expose the minimum on an internal port.</strong> Health for probes, Prometheus for scraping, info for builds \u2014 and treat env, loggers and heapdump as privileged operations." }
            ]
          }
        ]
      },
      {
        id: "jobs",
        name: "Jobs & Scheduling",
        icon: "queue",
        lessons: [
          {
            id: "scheduling-locks",
            title: "@Scheduled and distributed locks",
            summary: "In-process scheduling, why it runs on every replica, and how ShedLock or an external trigger keeps a job to one node.",
            minutes: 8,
            tags: ["scheduled", "shedlock", "cron"],
            blocks: [
              { t: "p", html: "<code class='tok'>@EnableScheduling</code> plus <code class='tok'>@Scheduled</code> is the quickest way to run periodic work: refreshing caches, purging expired rows, polling an outbox. It is also the easiest way to run a job four times when you scale to four pods." },
              { t: "code", lang: "java", code: J([
                "@Configuration",
                "@EnableScheduling",
                "@EnableSchedulerLock(defaultLockAtMostFor = \"PT10M\")",
                "class SchedulingConfig {",
                "  @Bean LockProvider lockProvider(DataSource ds) {",
                "    return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()",
                "        .withJdbcTemplate(new JdbcTemplate(ds)).usingDbTime().build());",
                "  }",
                "}",
                "",
                "@Component",
                "class ExpiredCartPurger {",
                "  @Scheduled(cron = \"0 15 2 * * *\", zone = \"UTC\")",
                "  @SchedulerLock(name = \"purgeExpiredCarts\", lockAtLeastFor = \"PT1M\", lockAtMostFor = \"PT15M\")",
                "  void purge() { carts.deleteExpiredBefore(Instant.now().minus(Duration.ofDays(30))); }",
                "}"
              ]) },
              { t: "table", headers: ["Setting", "Meaning", "Guidance"], rows: [
                ["fixedRate", "Start every N from the previous start", "Cadence-sensitive polling"],
                ["fixedDelay", "Wait N after the previous run ends", "Default choice; avoids pile-ups"],
                ["cron + zone", "Calendar schedule", "Always set the zone, usually UTC"],
                ["lockAtMostFor", "Lock expiry if the holder dies", "Comfortably above normal run time"],
                ["lockAtLeastFor", "Minimum hold time", "Stops a fast job re-running on a node with clock skew"]
              ] },
              { t: "note", variant: "trap", html: "<strong>One scheduler thread by default.</strong> A slow job blocks every other <code class='tok'>@Scheduled</code> method. Raise <code class='tok'>spring.task.scheduling.pool.size</code> or enable virtual threads, and make jobs idempotent: a lock reduces duplicates but a crash mid-run still means a partial run that must be safe to repeat." },
              { t: "ul", items: [
                "ShedLock is a mutual-exclusion lock, not a scheduler: it skips the run on nodes that lose the race.",
                "For heavy or business-critical jobs, prefer an external trigger (a Kubernetes CronJob, or a workflow engine) that has retries and history.",
                "Emit a metric with the last successful run time and alert when it goes stale."
              ] },
              { t: "note", variant: "key", html: "<strong>@Scheduled runs on every replica.</strong> Guard cluster-wide jobs with a lock or an external trigger, keep them idempotent, and monitor their last success." }
            ]
          },
          {
            id: "batch-processing",
            title: "Spring Batch in brief",
            summary: "Jobs, steps and chunks: restartable bulk processing with skip and retry, and when a plain loop is enough.",
            minutes: 7,
            tags: ["spring-batch", "etl", "chunks"],
            blocks: [
              { t: "p", html: "Spring Batch is for bulk work that must survive failure: importing a million-line file, a nightly settlement, a re-index. It records progress in a <strong>JobRepository</strong> (database tables), so a failed run restarts where it stopped." },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "Step importPrices(JobRepository repo, PlatformTransactionManager tx,",
                "                  FlatFileItemReader<PriceRow> reader, JdbcBatchItemWriter<Price> writer) {",
                "  return new StepBuilder(\"importPrices\", repo)",
                "      .<PriceRow, Price>chunk(500, tx)       // read 500, process, write 500, commit",
                "      .reader(reader)",
                "      .processor(row -> row.isValid() ? row.toPrice() : null)   // null = filter out",
                "      .writer(writer)",
                "      .faultTolerant().skip(ParseException.class).skipLimit(100)",
                "      .retry(TransientDataAccessException.class).retryLimit(3)",
                "      .build();",
                "}",
                "",
                "@Bean Job priceImport(JobRepository repo, Step importPrices) {",
                "  return new JobBuilder(\"priceImport\", repo).start(importPrices).build();",
                "}"
              ]) },
              { t: "ul", items: [
                "<strong>Job parameters</strong> identify a run (for example the file date). The same parameters cannot complete twice.",
                "<strong>Chunk size</strong> trades transaction length against round trips; 100 to 1000 is typical.",
                "Scale with partitioned steps, or run the job as its own short-lived process (a CronJob) rather than inside the API pods.",
                "For a few thousand rows with no restart requirement, a paged loop in a scheduled method is simpler."
              ] },
              { t: "quiz", id: "boot-jobs" },
              { t: "note", variant: "key", html: "<strong>Batch buys restartability.</strong> Chunks commit progress, skip and retry policies handle bad and flaky records, and job parameters stop duplicate runs. Run heavy jobs outside the request-serving pods." }
            ]
          }
        ]
      }
    ]
  };
})();
