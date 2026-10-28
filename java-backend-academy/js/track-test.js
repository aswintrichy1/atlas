/* =====================================================================
   ANVIL · Testing & Quality
   window.TRACKS.test — modules: unit / integration / quality
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     testMutation — line coverage vs mutation score
  ================================================================== */
  function original(total, member) { return total >= 100 ? (member ? 15 : 10) : (member ? 5 : 0); }
  var MUTANTS = [
    { id: "M1", desc: "Boundary: >= becomes >", fn: function (t, m) { return t > 100 ? (m ? 15 : 10) : (m ? 5 : 0); } },
    { id: "M2", desc: "Swap member and non-member rates above 100", fn: function (t, m) { return t >= 100 ? (m ? 10 : 15) : (m ? 5 : 0); } },
    { id: "M3", desc: "Member discount below 100 returns 0", fn: function (t, m) { return t >= 100 ? (m ? 15 : 10) : 0; } },
    { id: "M4", desc: "Non-member rate above 100 returns 0", fn: function (t, m) { return t >= 100 ? (m ? 15 : 0) : (m ? 5 : 0); } },
    { id: "M5", desc: "Condition always true (>= 0)", fn: function (t, m) { return t >= 0 ? (m ? 15 : 10) : (m ? 5 : 0); } }
  ];
  var TESTS = [
    { id: "T1", label: "discount(150, member) == 15", args: [150, true], check: function (r) { return r === 15; } },
    { id: "T2", label: "discount(50, guest) == 0", args: [50, false], check: function (r) { return r === 0; } },
    { id: "T3", label: "discount(100, guest) == 10  (boundary)", args: [100, false], check: function (r) { return r === 10; } },
    { id: "T4", label: "discount(50, member) == 5", args: [50, true], check: function (r) { return r === 5; } },
    { id: "T5", label: "discount(150, guest) >= 0  (weak assertion)", args: [150, false], check: function (r) { return r >= 0; } }
  ];
  function branchOf(t, m) { return (t >= 100 ? "high" : "low") + "-" + (m ? "member" : "guest"); }

  Widgets.testMutation = function (mount) {
    K.shell(mount, "experiment", "Coverage vs mutation score",
      "The method under test returns a discount percentage. Pick which tests exist. Branch coverage counts which paths ran; mutation testing changes the code in small ways and checks whether any test notices.");
    var on = { T1: true, T2: true, T3: false, T4: false, T5: true };
    var code = h("pre", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.78rem;margin:0;white-space:pre-wrap" },
      J(["int discount(int total, boolean member) {", "  return total >= 100 ? (member ? 15 : 10)", "                      : (member ? 5 : 0);", "}"]));
    var tests = h("div", { class: "w-stage", style: "display:grid;gap:6px" });
    var muts = h("div", { class: "w-stage", style: "display:grid;gap:4px" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var selected = TESTS.filter(function (t) { return on[t.id]; });
      K.clear(tests);
      TESTS.forEach(function (t) {
        var b = K.btn(on[t.id] ? "on" : "off", on[t.id] ? "primary" : "ghost", function () { on[t.id] = !on[t.id]; paint(); });
        b.style.minWidth = "52px";
        tests.appendChild(h("div", { style: "display:flex;gap:10px;align-items:center;font-size:0.82rem" }, b, h("code", { class: "tok" }, t.id), h("span", {}, t.label)));
      });
      var branches = {};
      selected.forEach(function (t) { branches[branchOf(t.args[0], t.args[1])] = true; });
      var cov = Object.keys(branches).length / 4;
      var killed = 0;
      K.clear(muts);
      MUTANTS.forEach(function (m) {
        var killer = null;
        selected.forEach(function (t) {
          if (!killer && !t.check(m.fn(t.args[0], t.args[1]))) killer = t.id;
        });
        if (killer) killed++;
        muts.appendChild(h("div", { style: "display:flex;gap:10px;font-size:0.8rem" },
          h("b", { style: "min-width:64px;color:" + (killer ? "var(--lime-ink)" : "var(--rose-ink)") }, killer ? "killed" : "survived"),
          h("code", { class: "tok" }, m.id),
          h("span", {}, m.desc + (killer ? " \u2014 by " + killer : ""))));
      });
      var baseline = selected.every(function (t) { return t.check(original(t.args[0], t.args[1])); });
      K.clear(readout);
      readout.appendChild(K.ro("tests", selected.length));
      readout.appendChild(K.ro("branch coverage", Math.round(cov * 100) + "%"));
      readout.appendChild(h("span", { class: "ro", style: killed < MUTANTS.length ? "color:var(--rose-ink)" : "color:var(--lime-ink)" }, "mutation score ", h("b", {}, killed + " / " + MUTANTS.length)));
      readout.appendChild(K.ro("original passes", baseline ? "yes" : "no"));
      readout.appendChild(K.wide(cov >= 0.75 && killed < 3
        ? "High coverage, weak tests: code ran, but assertions do not pin its behaviour. The boundary at exactly 100 and the weak >= 0 assertion are where mutants hide."
        : killed === MUTANTS.length ? "Every mutant is caught: the tests specify the behaviour, including the boundary." : "Add tests for the paths and boundaries where mutants survive."));
    }
    mount.appendChild(code);
    mount.appendChild(tests);
    mount.appendChild(muts);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "test-unit": {
      title: "Unit testing checkpoint",
      sub: "JUnit 5 structure, parameterized tests, time, and mocking well.",
      questions: [
        {
          q: "A test for 'orders expire after 30 minutes' calls Thread.sleep. What is the better design?",
          options: ["Sleep for less time", "Inject a java.time.Clock into the code and use a fixed or offset clock in the test", "Mark the test @Disabled", "Run it only nightly"],
          answer: 1,
          explain: "Time is a dependency. With an injected Clock, tests set the exact instant they need and run instantly and deterministically."
        },
        {
          q: "Which JUnit 5 feature best covers 'discount for totals 99, 100 and 101'?",
          options: ["Three copy-pasted tests", "@ParameterizedTest with @CsvSource of inputs and expected values", "@RepeatedTest(3)", "A loop inside one test"],
          answer: 1,
          explain: "Parameterized tests run one test body per row and report each case separately, which makes boundary tables readable and failures precise."
        },
        {
          q: "When is a mock the wrong tool?",
          options: ["For a remote payment gateway", "For value objects and simple in-memory collaborators, where using the real object is easier and more faithful", "For a repository in a service unit test", "For a message publisher"],
          answer: 1,
          explain: "Mocks are for boundaries with side effects or slowness. Mocking records, mappers or pure functions couples tests to implementation and tests less real behaviour."
        },
        {
          q: "A test verifies five different interactions on mocks for a single method call. What smell might that indicate?",
          options: ["Excellent coverage", "Testing implementation details: the test will break on harmless refactors; assert outcomes instead where possible", "Mockito misuse that throws errors", "Missing @Transactional"],
          answer: 1,
          explain: "Verifying every call pins how the code works rather than what it achieves. Prefer asserting returned values and state, and verify only interactions that are the point, such as 'a payment was requested'."
        },
        {
          q: "In Spring Boot 3.4 and later, which annotation replaces the deprecated @MockBean in Spring tests?",
          options: ["@Mock", "@MockitoBean", "@InjectMocks", "@SpyBean"],
          answer: 1,
          explain: "Spring Framework's @MockitoBean (and @MockitoSpyBean) replace Boot's @MockBean and @SpyBean. Plain @Mock remains the tool for unit tests without a Spring context."
        }
      ]
    },
    "test-integration": {
      title: "Integration testing checkpoint",
      sub: "Slice tests, Testcontainers and contract tests.",
      questions: [
        {
          q: "What does @WebMvcTest load?",
          options: ["The entire application including the database", "The MVC layer \u2014 controllers, advice, converters, filters and security \u2014 without services and repositories, which you supply as mocks", "Only JPA repositories", "Nothing; it is a unit test annotation"],
          answer: 1,
          explain: "Slice tests load a focused part of the context, so they start fast and test framework wiring such as JSON mapping, validation and error handling for real."
        },
        {
          q: "Why prefer a Testcontainers PostgreSQL over an in-memory H2 for repository tests?",
          options: ["H2 is slower", "The real engine behaves like production: SQL dialect, constraints, locking, JSON types and migrations", "Testcontainers needs no Docker", "H2 cannot run JPA"],
          answer: 1,
          explain: "Tests against a different database pass while production fails on dialect differences, missing features or different locking. Testcontainers runs the same engine and version you ship against."
        },
        {
          q: "What does @ServiceConnection on a container field do in Spring Boot?",
          options: ["Opens a VPN", "Derives the connection properties such as the JDBC URL and credentials from the running container automatically", "Shares the container across machines", "Starts the application in a container"],
          answer: 1,
          explain: "Boot's service connections replace hand-written @DynamicPropertySource plumbing: the container's host, port and generated credentials become the datasource or broker settings."
        },
        {
          q: "Why do many test classes with slightly different @MockitoBean sets slow down a suite?",
          options: ["Mockito is slow", "Each distinct configuration creates a new application context, defeating Spring's test context cache", "They run in parallel", "They require Testcontainers"],
          answer: 1,
          explain: "Spring caches contexts by configuration. Every unique combination of mocks, properties and profiles builds a new context. Standardize test configurations to reuse contexts."
        },
        {
          q: "What do consumer-driven contract tests catch that provider-only tests miss?",
          options: ["Performance regressions", "Changes in the provider that break what a specific consumer actually relies on, before deployment", "Database deadlocks", "UI layout bugs"],
          answer: 1,
          explain: "The consumer records its expectations; the provider's build verifies them. A provider change that breaks a real consumer fails in CI rather than in production."
        }
      ]
    },
    "test-quality": {
      title: "Test quality checkpoint",
      sub: "Mutation testing and architecture rules.",
      questions: [
        {
          q: "A module has 95% line coverage but a 40% mutation score. What does that suggest?",
          options: ["The tests are excellent", "Much of the code runs during tests, but assertions do not check its behaviour closely", "Mutation testing is broken", "Coverage tools double count"],
          answer: 1,
          explain: "Coverage says code executed; mutation score says tests noticed when it changed. Surviving mutants point at missing assertions and untested boundaries."
        },
        {
          q: "Why run mutation testing incrementally on changed code in CI rather than the whole codebase on every build?",
          options: ["It only works on new code", "It is computationally expensive; focusing on changed classes gives fast, actionable feedback", "Old code cannot be mutated", "It requires a production database"],
          answer: 1,
          explain: "Each mutant reruns tests. Running PIT on the diff keeps feedback quick while gradually improving the codebase where people are working."
        },
        {
          q: "What is an equivalent mutant?",
          options: ["A mutant killed by two tests", "A change that does not alter observable behaviour, so no test can kill it", "A mutant in test code", "A duplicate test"],
          answer: 1,
          explain: "Some mutations produce code that behaves identically. They inflate the survivor count and should be reviewed and ignored rather than chased."
        },
        {
          q: "Which rule is a good fit for an ArchUnit test?",
          options: ["Response time under 200 ms", "Classes in ..web.. must not access classes in ..persistence.. directly", "Every method has a Javadoc", "The database has an index"],
          answer: 1,
          explain: "ArchUnit checks structural rules on compiled classes: dependencies between packages, layering, naming and annotations. It turns architecture decisions into failing builds."
        },
        {
          q: "You introduce ArchUnit to a legacy codebase with hundreds of existing violations. What is the practical approach?",
          options: ["Fix everything before merging", "Freeze current violations so only new ones fail the build, then pay down the frozen list over time", "Give up on the rule", "Disable the test in CI"],
          answer: 1,
          explain: "Frozen rules record existing violations and fail only on new ones. The architecture stops getting worse immediately, and improvement can be incremental."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.test = {
    id: "test",
    name: "Testing & Quality",
    short: "TEST",
    tagline: "Tests that catch real bugs",
    color: "#f472b6",
    blurb: "Build a test suite that is fast and trustworthy: focused JUnit 5 unit tests with sensible mocking, Spring slice tests, real dependencies with Testcontainers, consumer-driven contracts between services, mutation testing to measure whether tests actually check anything, and ArchUnit rules that keep the architecture honest.",
    modules: [
      {
        id: "unit",
        name: "Unit Tests",
        icon: "diamond",
        lessons: [
          {
            id: "junit5",
            title: "JUnit 5 and readable tests",
            summary: "Arrange-act-assert, descriptive names, parameterized boundary tests, AssertJ, and deterministic time.",
            minutes: 8,
            tags: ["junit5", "assertj", "unit-tests"],
            blocks: [
              { t: "p", html: "A good unit test is <strong>fast</strong>, <strong>deterministic</strong>, and reads like a specification. When it fails, its name and assertion should tell you what behaviour broke without opening the production code." },
              { t: "code", lang: "java", code: J([
                "class DiscountPolicyTest {",
                "  private final DiscountPolicy policy = new DiscountPolicy();",
                "",
                "  @ParameterizedTest(name = \"total {0}, member {1} -> {2}%\")",
                "  @CsvSource({",
                "      \"99,  false, 0\",",
                "      \"100, false, 10\",   // boundary",
                "      \"100, true,  15\",",
                "      \"50,  true,  5\"",
                "  })",
                "  void discountByTotalAndMembership(int total, boolean member, int expected) {",
                "    assertThat(policy.discount(total, member)).isEqualTo(expected);",
                "  }",
                "",
                "  @Test",
                "  void rejectsNegativeTotals() {",
                "    assertThatThrownBy(() -> policy.discount(-1, false))",
                "        .isInstanceOf(IllegalArgumentException.class)",
                "        .hasMessageContaining(\"total\");",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "Structure each test as <strong>arrange, act, assert</strong>; one behaviour per test.",
                "Name tests after behaviour (<code class='tok'>rejectsNegativeTotals</code>), not methods (<code class='tok'>testDiscount2</code>).",
                "Use <code class='tok'>@Nested</code> classes to group scenarios such as 'when the cart is empty'.",
                "AssertJ's fluent assertions give far better failure messages than bare <code class='tok'>assertTrue</code>."
              ] },
              { t: "h", text: "Make time and randomness inputs" },
              { t: "code", lang: "java", code: J([
                "class ReservationService {",
                "  private final Clock clock;",
                "  ReservationService(Clock clock) { this.clock = clock; }",
                "  boolean isExpired(Reservation r) {",
                "    return r.createdAt().plus(Duration.ofMinutes(30)).isBefore(Instant.now(clock));",
                "  }",
                "}",
                "",
                "// test",
                "var clock = Clock.fixed(Instant.parse(\"2026-03-01T10:31:00Z\"), ZoneOffset.UTC);",
                "assertThat(new ReservationService(clock).isExpired(reservationAt(\"2026-03-01T10:00:00Z\"))).isTrue();"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Thread.sleep in tests is a flake generator.</strong> It is slow on fast machines and still too short on loaded CI runners. Inject a Clock for time logic and use Awaitility with a timeout for genuinely asynchronous assertions." },
              { t: "note", variant: "key", html: "<strong>Fast, deterministic, specific.</strong> Name tests by behaviour, table-drive boundaries with parameterized tests, and turn time and randomness into injected inputs." }
            ]
          },
          {
            id: "mockito",
            title: "Mocking with Mockito, without over-mocking",
            summary: "When to mock, stub or fake; Mockito essentials; argument captors; and mocks in Spring tests.",
            minutes: 9,
            tags: ["mockito", "test-doubles"],
            blocks: [
              { t: "p", html: "Test doubles replace collaborators that are slow, non-deterministic or have side effects. Used well they isolate the logic under test; overused they produce tests that pass while the system is broken." },
              { t: "table", headers: ["Double", "What it is", "Good for"], rows: [
                ["Stub", "Returns canned answers", "Feeding inputs: 'the customer has a credit limit of 500'"],
                ["Mock", "Records calls so you can verify them", "Outputs that are side effects: 'a payment was requested'"],
                ["Fake", "Working lightweight implementation", "In-memory repository or clock; often clearer than mocks"],
                ["Real object", "The actual class", "Value objects, mappers, pure functions"]
              ] },
              { t: "code", lang: "java", code: J([
                "@ExtendWith(MockitoExtension.class)",
                "class CheckoutServiceTest {",
                "  @Mock PaymentGateway payments;",
                "  @Mock OrderRepository orders;",
                "  @InjectMocks CheckoutService checkout;",
                "",
                "  @Test",
                "  void chargesTheOrderTotalWithTheIdempotencyKey() {",
                "    when(orders.save(any())).thenAnswer(inv -> inv.getArgument(0));",
                "    when(payments.charge(any())).thenReturn(PaymentResult.approved(\"auth-1\"));",
                "",
                "    checkout.place(cartWithTotal(\"42.50\"), \"key-123\");",
                "",
                "    ArgumentCaptor<ChargeRequest> charge = ArgumentCaptor.forClass(ChargeRequest.class);",
                "    verify(payments).charge(charge.capture());",
                "    assertThat(charge.getValue().amount()).isEqualByComparingTo(\"42.50\");",
                "    assertThat(charge.getValue().idempotencyKey()).isEqualTo(\"key-123\");",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "Mockito's strict stubs (the default with the extension) fail tests that stub calls never made, keeping tests honest.",
                "Do not mock types you do not own, such as an HTTP client; wrap them in your own gateway interface and mock that, or use a stub server.",
                "In Spring context tests, <code class='tok'>@MockitoBean</code> replaces a bean with a mock (it superseded <code class='tok'>@MockBean</code>)."
              ] },
              { t: "note", variant: "warn", html: "<strong>A test that mirrors the implementation line by line tests nothing.</strong> If every refactor breaks tests while behaviour stays the same, the tests verify how, not what. Assert outcomes; verify only the interactions that matter." },
              { t: "quiz", id: "test-unit" },
              { t: "note", variant: "key", html: "<strong>Mock boundaries, use real objects inside.</strong> Stub inputs, verify meaningful side effects, prefer fakes for repositories and clocks, and keep tests focused on behaviour." }
            ]
          }
        ]
      },
      {
        id: "integration",
        name: "Integration Tests",
        icon: "blocks",
        lessons: [
          {
            id: "slice-tests",
            title: "Spring slice tests",
            summary: "Test the web, JPA and JSON layers with focused contexts, and keep the test context cache working for you.",
            minutes: 9,
            tags: ["webmvctest", "datajpatest", "spring-test"],
            blocks: [
              { t: "p", html: "A full <code class='tok'>@SpringBootTest</code> starts everything and is slow. <strong>Slice tests</strong> start only the part of the context relevant to one layer, so you can test real framework behaviour \u2014 request mapping, validation, JSON, security, queries \u2014 quickly." },
              { t: "table", headers: ["Annotation", "Loads", "Use it to test"], rows: [
                ["<code class='tok'>@WebMvcTest</code>", "Controllers, advice, filters, security, Jackson", "Status codes, validation, ProblemDetail shape, authorization rules"],
                ["<code class='tok'>@DataJpaTest</code>", "JPA, repositories, a datasource, migrations", "Queries, mappings, fetch plans, constraints"],
                ["<code class='tok'>@JsonTest</code>", "Jackson configuration", "Serialization contracts of DTOs"],
                ["<code class='tok'>@RestClientTest</code>", "RestClient / RestTemplate with a mock server", "Your HTTP gateway's requests and error mapping"],
                ["<code class='tok'>@SpringBootTest</code>", "Everything", "A few end-to-end flows"]
              ] },
              { t: "code", lang: "java", code: J([
                "@WebMvcTest(OrderController.class)",
                "class OrderControllerTest {",
                "  @Autowired MockMvcTester mvc;",
                "  @MockitoBean OrderService orders;",
                "",
                "  @Test",
                "  void invalidBodyReturnsProblemDetailWithFieldErrors() {",
                "    assertThat(mvc.post().uri(\"/orders\")",
                "            .with(jwt())",
                "            .contentType(MediaType.APPLICATION_JSON)",
                "            .content(\"{\\\"lines\\\": []}\"))",
                "        .hasStatus(HttpStatus.BAD_REQUEST)",
                "        .bodyJson().extractingPath(\"$.title\").isEqualTo(\"Bad Request\");",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Protect the context cache.</strong> Spring reuses an application context across test classes with identical configuration. Every unique mix of <code class='tok'>@MockitoBean</code>s, properties and profiles builds a new one. Share a small set of base configurations." },
              { t: "note", variant: "key", html: "<strong>Slice per layer, full context sparingly.</strong> @WebMvcTest for HTTP behaviour, @DataJpaTest for queries, a few @SpringBootTest flows \u2014 and standard configurations so contexts are cached." }
            ]
          },
          {
            id: "testcontainers",
            title: "Real dependencies with Testcontainers",
            summary: "Run PostgreSQL, Kafka and friends in throwaway containers, wire them with @ServiceConnection, and reuse them across tests.",
            minutes: 9,
            tags: ["testcontainers", "integration-tests", "postgres"],
            blocks: [
              { t: "p", html: "<strong>Testcontainers</strong> starts real infrastructure in Docker for the duration of a test run. Your repository tests run against the same PostgreSQL version as production, your listener tests against a real Kafka broker." },
              { t: "code", lang: "java", code: J([
                "@DataJpaTest",
                "@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)",
                "@Testcontainers",
                "class OrderRepositoryTest {",
                "",
                "  @Container",
                "  @ServiceConnection   // JDBC URL, username and generated password come from the container",
                "  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(\"postgres:16-alpine\");",
                "",
                "  @Autowired OrderRepository orders;",
                "",
                "  @Test",
                "  void reserveIsAtomicUnderTheStockConstraint() {",
                "    // runs real Flyway migrations and real SQL against PostgreSQL",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "Static containers start once per test class; a shared base class or singleton pattern starts them once per run.",
                "No credentials are configured by hand: the container generates them and <code class='tok'>@ServiceConnection</code> wires them in.",
                "The same container definitions can power local development via Boot's Testcontainers support at dev time.",
                "Pin image versions to match production, and run migrations in tests exactly as in deploys."
              ] },
              { t: "compare",
                bad: { title: "H2 stand-in", items: ["Different SQL dialect and functions", "Different locking and isolation", "Migrations written twice or not tested"] },
                good: { title: "Same engine as production", items: ["Constraints, JSON types and indexes behave for real", "Flyway migrations verified on every build", "Concurrency tests mean something"] } },
              { t: "note", variant: "warn", html: "<strong>CI needs a container runtime.</strong> Make sure build agents provide Docker or a compatible runtime, and cache images to keep builds quick." },
              { t: "note", variant: "key", html: "<strong>Test against what you run.</strong> Testcontainers plus @ServiceConnection gives real databases and brokers in tests with no hand-managed configuration or credentials." }
            ]
          },
          {
            id: "contract-tests",
            title: "Contract tests between services",
            summary: "Catch breaking changes between consumers and providers in CI with consumer-driven contracts and schema checks.",
            minutes: 8,
            tags: ["contract-testing", "pact", "spring-cloud-contract"],
            blocks: [
              { t: "p", html: "End-to-end tests across many services are slow, flaky and find problems late. <strong>Contract tests</strong> check the agreement between two services in isolation: does the provider still give each consumer what it relies on?" },
              { t: "ol", items: [
                "The consumer writes a test against a mock provider describing the requests it makes and the fields it uses.",
                "That produces a contract file, shared through a broker or repository.",
                "The provider's build replays every consumer's contract against the real provider code.",
                "A deploy gate checks that the versions about to be deployed are compatible."
              ] },
              { t: "table", headers: ["Approach", "Strength", "Limit"], rows: [
                ["Consumer-driven contracts (for example Pact)", "Tests what consumers actually use", "Needs both teams' buy-in"],
                ["Provider contracts (Spring Cloud Contract)", "Provider-owned DSL generates tests and stubs", "Consumers may use fields not in the contract"],
                ["OpenAPI diff and schema validation", "Cheap, catches structural breaks", "No knowledge of real consumer usage"],
                ["End-to-end tests", "Exercise the real system", "Slow, flaky, late feedback"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Contracts apply to events too.</strong> Message contracts check that a producer's OrderPlaced still has what billing reads. Pair them with schema compatibility rules in your registry." },
              { t: "p", html: "Related: the API evolution rules in <a class='inline' href='#/api/contract/versioning-openapi'>versioning and OpenAPI</a>." },
              { t: "quiz", id: "test-integration" },
              { t: "note", variant: "key", html: "<strong>Verify agreements, not whole systems.</strong> Consumer contracts replayed in provider builds catch breaking changes early; keep only a thin layer of end-to-end tests." }
            ]
          }
        ]
      },
      {
        id: "quality",
        name: "Quality Gates",
        icon: "broom",
        lessons: [
          {
            id: "mutation-testing",
            title: "Mutation testing with PIT",
            summary: "Measure whether tests detect changes in behaviour, read surviving mutants, and run it incrementally in CI.",
            minutes: 8,
            tags: ["mutation-testing", "pitest", "coverage"],
            blocks: [
              { t: "p", html: "Line coverage only proves code <em>ran</em> during tests. <strong>Mutation testing</strong> introduces small bugs (mutants) into the code \u2014 flip a condition, change a boundary, return a constant \u2014 and reruns the tests. A mutant that no test notices <strong>survives</strong>, and points at a missing assertion." },
              { t: "widget", id: "testMutation" },
              { t: "code", lang: "xml", code: J([
                "<plugin>",
                "  <groupId>org.pitest</groupId>",
                "  <artifactId>pitest-maven</artifactId>",
                "  <configuration>",
                "    <targetClasses><param>com.shop.pricing.*</param></targetClasses>",
                "    <mutationThreshold>75</mutationThreshold>",
                "    <withHistory>true</withHistory>   <!-- incremental analysis between runs -->",
                "  </configuration>",
                "  <dependencies>",
                "    <dependency>",
                "      <groupId>org.pitest</groupId>",
                "      <artifactId>pitest-junit5-plugin</artifactId>",
                "    </dependency>",
                "  </dependencies>",
                "</plugin>"
              ]) },
              { t: "ul", items: [
                "Start with core domain logic (pricing, rules, state machines), not configuration or generated code.",
                "Run on changed code in pull requests; run the full analysis on a schedule.",
                "Review survivors: some are <strong>equivalent mutants</strong> that cannot change behaviour and can be ignored.",
                "Use the score as a conversation starter, not a vanity metric."
              ] },
              { t: "note", variant: "key", html: "<strong>Coverage shows what ran; mutation score shows what is checked.</strong> Surviving mutants reveal missing assertions and untested boundaries in the code that matters most." }
            ]
          },
          {
            id: "architecture-tests",
            title: "Architecture tests with ArchUnit",
            summary: "Turn package boundaries and layering rules into failing tests, and adopt them in legacy code with frozen violations.",
            minutes: 8,
            tags: ["archunit", "architecture", "modularity"],
            blocks: [
              { t: "p", html: "Architecture diagrams drift from code within weeks. <strong>ArchUnit</strong> expresses rules as JUnit tests over compiled classes, so a forbidden dependency fails the build the day it is introduced." },
              { t: "code", lang: "java", code: J([
                "@AnalyzeClasses(packages = \"com.shop\", importOptions = ImportOption.DoNotIncludeTests.class)",
                "class ArchitectureTest {",
                "",
                "  @ArchTest",
                "  static final ArchRule featuresAreFreeOfCycles =",
                "      slices().matching(\"com.shop.(*)..\").should().beFreeOfCycles();",
                "",
                "  @ArchTest",
                "  static final ArchRule controllersDoNotTouchRepositories =",
                "      noClasses().that().areAnnotatedWith(RestController.class)",
                "          .should().dependOnClassesThat().areAssignableTo(Repository.class);",
                "",
                "  @ArchTest",
                "  static final ArchRule noFieldInjection =",
                "      noFields().should().beAnnotatedWith(Autowired.class)",
                "          .because(\"use constructor injection\");",
                "",
                "  @ArchTest",
                "  static final ArchRule transactionsLiveInServices =",
                "      methods().that().areAnnotatedWith(Transactional.class)",
                "          .should().beDeclaredInClassesThat().areAnnotatedWith(Service.class);",
                "}"
              ]) },
              { t: "ul", items: [
                "Encode the decisions from <a class='inline' href='#/boot/ioc/feature-packaging'>feature packaging</a>: features talk through their public API only.",
                "For existing code, wrap rules with <code class='tok'>FreezingArchRule.freeze(...)</code>: current violations are recorded, new ones fail.",
                "Add a <code class='tok'>because(...)</code> to every rule so a failing build explains itself.",
                "Spring Modulith offers similar verification specifically for module boundaries in a Spring application."
              ] },
              { t: "note", variant: "tip", html: "<strong>Rules are documentation that cannot go stale.</strong> New team members learn the architecture from failing tests with explanations. Clean-code background: <a class='inline' href='../hld-lld-academy/index.html#/lld/principles/clean-code'>Blueprint: clean code</a>." },
              { t: "quiz", id: "test-quality" },
              { t: "note", variant: "key", html: "<strong>Make architecture executable.</strong> ArchUnit rules with clear reasons keep packages acyclic and layers honest, and frozen rules let legacy code improve without a big bang." }
            ]
          }
        ]
      }
    ]
  };
})();
