/* =====================================================================
   CHISEL · Testing Strategy
   window.TRACKS.test — modules: strategy / practice / advanced
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* testPortfolioBalancer — shape a test suite and see the trade-offs */
  var LEVELS = [
    { key: "unit", label: "Unit", speed: 0.02, confidence: 1, brittle: 0.2 },
    { key: "integration", label: "Integration", speed: 0.6, confidence: 3, brittle: 0.5 },
    { key: "contract", label: "Contract", speed: 0.3, confidence: 2.5, brittle: 0.3 },
    { key: "e2e", label: "End-to-end", speed: 12, confidence: 5, brittle: 3 }
  ];
  var PRESETS = [
    ["pyramid", "Pyramid", { unit: 400, integration: 60, contract: 20, e2e: 8 }],
    ["trophy", "Trophy", { unit: 120, integration: 200, contract: 30, e2e: 10 }],
    ["cone", "Ice-cream cone", { unit: 30, integration: 20, contract: 0, e2e: 150 }]
  ];
  Widgets.testPortfolioBalancer = function (mount) {
    K.shell(mount, "balancer", "Test portfolio balancer",
      "Drag the counts to shape a suite for a typical web service. Watch feedback time, the share of confidence coming from slow tests, and how many tests flake per run. The numbers are a teaching model, not a benchmark.");
    var counts = Object.assign({}, PRESETS[0][2]);
    var controls = h("div", { class: "widget-controls" });
    var sliders = h("div", { class: "w-stage", style: "display:grid;gap:10px" });
    var bars = h("div", { style: "display:grid;gap:6px;margin-top:12px" });
    var verdict = h("div", { style: "margin-top:10px" });
    var readout = h("div", { class: "w-readout" });
    var inputs = {};
    controls.appendChild(K.segment(PRESETS.map(function (p) { return [p[0], p[1]]; }), 0, function (key) {
      var p = PRESETS.filter(function (x) { return x[0] === key; })[0];
      counts = Object.assign({}, p[2]);
      LEVELS.forEach(function (l) { inputs[l.key].value = counts[l.key]; });
      paint();
    }));
    LEVELS.forEach(function (l) {
      var val = h("b", {}, String(counts[l.key]));
      var input = h("input", { type: "range", min: "0", max: "500", step: "5", value: String(counts[l.key]), "aria-label": l.label + " test count", style: "width:100%;accent-color:var(--amber)" });
      input.addEventListener("input", function () { counts[l.key] = Number(input.value); paint(); });
      inputs[l.key] = input;
      inputs[l.key + "_v"] = val;
      sliders.appendChild(h("label", { style: "display:grid;grid-template-columns:110px 1fr 48px;gap:10px;align-items:center;font-size:0.84rem;color:var(--text)" },
        h("span", {}, l.label), input, val));
    });
    function paint() {
      clear(bars); clear(readout); clear(verdict);
      var total = 0, secs = 0, conf = 0, slowConf = 0, flakes = 0;
      LEVELS.forEach(function (l) {
        var c = counts[l.key];
        inputs[l.key + "_v"].textContent = String(c);
        total += c; secs += c * l.speed; conf += c * l.confidence;
        if (l.key === "e2e") slowConf += c * l.confidence;
        flakes += c * l.brittle / 100;
      });
      var max = Math.max.apply(null, LEVELS.map(function (l) { return counts[l.key]; }).concat([1]));
      LEVELS.slice().reverse().forEach(function (l) {
        var pct = Math.round((counts[l.key] / max) * 100);
        bars.appendChild(h("div", { style: "display:flex;justify-content:center" },
          h("div", { style: "height:22px;border-radius:6px;border:1px solid var(--line);background:rgba(212,163,115,0.22);width:" + Math.max(pct, 2) + "%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-family:var(--font-mono);color:var(--text)" }, l.label + " " + counts[l.key])));
      });
      var mins = secs / 60;
      var slowShare = conf ? Math.round((slowConf / conf) * 100) : 0;
      var msg, tone;
      if (!total) { msg = "No tests: every change is a guess."; tone = "bad"; }
      else if (counts.e2e > counts.unit + counts.integration) { msg = "Ice-cream cone: slow, flaky feedback and failures that do not say where the bug is."; tone = "bad"; }
      else if (mins > 20) { msg = "Too slow for every push. Move scenarios down a level or split the suite into a fast gate and a later stage."; tone = "meh"; }
      else if (counts.integration + counts.contract === 0) { msg = "Lots of units, no integration: the parts may each work and still not fit together."; tone = "meh"; }
      else { msg = "Balanced: fast feedback on most changes, with a thin layer of slow tests on critical journeys."; tone = "good"; }
      verdict.appendChild(K.badge(msg, tone));
      readout.appendChild(ro("tests", total));
      readout.appendChild(ro("suite time", mins < 1 ? Math.round(secs) + " s" : mins.toFixed(1) + " min"));
      readout.appendChild(ro("confidence from E2E", slowShare + "%"));
      readout.appendChild(ro("expected flaky failures / run", flakes.toFixed(1)));
    }
    mount.appendChild(controls); mount.appendChild(sliders); mount.appendChild(bars); mount.appendChild(verdict); mount.appendChild(readout);
    paint();
  };

  /* testMutationLab — which mutants does this test suite kill? */
  var MUTANTS = [
    { label: "age >= 18  \u2192  age > 18", killedBy: ["boundary"], why: "Only a test at exactly 18 notices the boundary moved." },
    { label: "return true  \u2192  return false (adult branch)", killedBy: ["adult", "boundary"], why: "Any test asserting an adult is allowed kills this one." },
    { label: "age >= 18  \u2192  true", killedBy: ["minor"], why: "Needs a test where the answer should be false." },
    { label: "&& hasConsent  \u2192  || hasConsent", killedBy: ["noConsent"], why: "Needs an adult without consent, expecting a refusal." },
    { label: "delete the hasConsent check", killedBy: ["noConsent"], why: "Same gap: nothing exercises the missing-consent case." }
  ];
  var TESTS = [
    ["adult", "adult (30) with consent \u2192 allowed"],
    ["minor", "minor (12) with consent \u2192 refused"],
    ["boundary", "exactly 18 with consent \u2192 allowed"],
    ["noConsent", "adult (30) without consent \u2192 refused"]
  ];
  Widgets.testMutationLab = function (mount) {
    K.shell(mount, "mutation", "Mutation lab",
      "The function allows signup when age >= 18 && hasConsent. Toggle which tests exist and see which deliberately injected bugs (mutants) your suite would catch. Line coverage is 100% with just the first test.");
    var on = { adult: true, minor: false, boundary: false, noConsent: false };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:6px" });
    var readout = h("div", { class: "w-readout" });
    TESTS.forEach(function (t) {
      controls.appendChild(K.toggle(t[1], on[t[0]], function (v) { on[t[0]] = v; paint(); }));
    });
    stage.appendChild(K.mono("function canSignUp(age, hasConsent) {\n  if (age >= 18 && hasConsent) return true;\n  return false;\n}"));
    var list = h("div", { style: "display:grid;gap:6px;margin-top:8px" });
    stage.appendChild(list);
    function paint() {
      clear(list); clear(readout);
      var killed = 0;
      MUTANTS.forEach(function (m) {
        var dead = m.killedBy.some(function (k) { return on[k]; });
        if (dead) killed++;
        list.appendChild(h("div", { style: "display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:" + (dead ? K.GOOD_BG : K.BAD_BG) + ";font-size:0.84rem;color:var(--text)" },
          h("strong", { style: "font-family:var(--font-mono);font-size:0.78rem" }, m.label),
          h("span", {}, dead ? "killed" : "survived \u2014 " + m.why)));
      });
      var anyTest = TESTS.some(function (t) { return on[t[0]]; });
      readout.appendChild(ro("tests", TESTS.filter(function (t) { return on[t[0]]; }).length));
      readout.appendChild(ro("line coverage", anyTest ? "100%" : "0%"));
      readout.appendChild(ro("mutants killed", killed + " / " + MUTANTS.length));
      readout.appendChild(ro("mutation score", Math.round((killed / MUTANTS.length) * 100) + "%"));
    }
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(readout);
    paint();
  };

  /* testDoubleSorter — name the test double */
  Widgets.testDoubleSorter = function (mount) {
    K.choiceDrill(mount, {
      pill: "doubles",
      title: "Name that test double",
      desc: "Each snippet replaces a real collaborator in a test. Which kind of double is it?",
      choices: ["Dummy", "Stub", "Spy", "Mock", "Fake"],
      items: [
        { prompt: "An in-memory repository backed by a dictionary, with real save and find behaviour.", code: "class InMemoryOrders:\n    def __init__(self): self.rows = {}\n    def save(self, o): self.rows[o.id] = o\n    def find(self, oid): return self.rows.get(oid)", answer: 4,
          why: "A fake has a working, simplified implementation. It is often the most readable double because tests interact with it like the real thing." },
        { prompt: "A rates provider that always returns 1.1 so the test can check currency maths.", code: "rates = lambda currency: 1.1", answer: 1,
          why: "A stub supplies canned answers to queries. The test asserts on the system's output, not on how the stub was called." },
        { prompt: "A logger passed only because the constructor requires one; the test never looks at it.", code: "svc = Checkout(cart, logger=None_Logger())", answer: 0,
          why: "A dummy fills a parameter slot and is never used. If it starts mattering, the test is checking something it does not name." },
        { prompt: "An email sender that records each message so the test can assert one was sent to the buyer afterwards.", code: "sent = []\nsender = lambda msg: sent.append(msg)\n...\nassert sent[0].to == \"buyer@shop.example\"", answer: 2,
          why: "A spy records interactions for the test to inspect after the fact. It suits commands (side effects) rather than queries." },
        { prompt: "A double configured up front to expect exactly one charge(42) call and fail the test on anything else.", code: "gateway.expect(\"charge\").with_args(42).once()", answer: 3,
          why: "A mock carries pre-programmed expectations and verifies them itself. Powerful, but it couples the test to the interaction, so use it for real boundaries only." }
      ]
    });
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "test-contracts": {
      title: "Snapshots & contracts checkpoint",
      sub: "Snapshot and golden tests, consumer-driven contracts.",
      questions: [
        { q: "What is the main danger of snapshot tests?", options: ["Large snapshots get updated without reading, so the test approves whatever the code now does", "They are slow", "They cannot run in CI", "They need a database"], answer: 0,
          explain: "A snapshot is only as good as the review of its diff. Keep snapshots small and focused, and treat 'update all snapshots' as a code change needing review." },
        { q: "Which output is a good fit for a golden-file test?", options: ["A random UUID", "The current time", "A generated SQL migration or rendered config file from fixed inputs", "A network response from production"], answer: 2,
          explain: "Golden files suit deterministic, structured output where a readable diff shows exactly what changed. Volatile values must be fixed or scrubbed first." },
        { q: "In consumer-driven contract testing (Pact-style), who writes the contract?", options: ["The provider team alone", "A QA team after release", "Nobody", "The consumer, by recording the requests it makes and the response fields it relies on"], answer: 3,
          explain: "The consumer states its real needs; the provider verifies it still meets every consumer's contract in its own CI. Fields no consumer uses can then change freely." },
        { q: "What does 'can I deploy?' check in a contract-testing workflow?", options: ["Server CPU", "Whether the version about to ship has verified contracts with the versions of its counterparts already in that environment", "Code coverage", "Linter results"], answer: 1,
          explain: "A broker records which consumer and provider versions are compatible. Deploys are gated on that matrix, so incompatible pairs never reach the same environment." },
        { q: "Why do contract tests use loose matchers such as 'any string' for values?", options: ["To pass more easily", "Because values are secret", "So the contract pins shape and type the consumer relies on, not incidental example data", "To speed up tests"], answer: 2,
          explain: "Pinning exact example values makes contracts brittle. Matchers express what actually matters to the consumer." }
      ]
    },
    "test-strategy": {
      title: "Test strategy checkpoint",
      sub: "Why test, test shapes, and choosing levels.",
      questions: [
        { q: "What is the main job of an automated test suite?", options: ["Give fast, trustworthy feedback that a change did not break behaviour you care about", "Reach 100% coverage", "Replace code review", "Document every line"], answer: 0,
          explain: "Tests are a feedback and confidence tool. Coverage, documentation and design pressure are useful side effects, not the goal." },
        { q: "The 'ice-cream cone' anti-pattern is…", options: ["Many unit tests, few E2E", "Only contract tests", "Tests written after release", "Mostly slow UI or end-to-end tests with few fast tests underneath"], answer: 3,
          explain: "An inverted shape gives slow, flaky feedback and failures that do not localise the bug. Most teams drift there by adding a UI test for every bug." },
        { q: "The testing trophy shifts weight toward which level?", options: ["Manual testing", "Integration tests that exercise several real units together", "End-to-end tests", "Static analysis only"], answer: 1,
          explain: "The trophy argues integration tests give the best confidence per cost in many UI and service codebases, with static checks at the base. Pyramid and trophy agree that E2E should be a thin top." },
        { q: "A contract test between a consumer and a provider service checks…", options: ["That the provider still honours the requests and responses the consumer relies on", "The provider's database schema", "The consumer's UI", "Network latency"], answer: 0,
          explain: "Contract tests catch breaking API changes without spinning up both systems together. The consumer's expectations become the provider's test." },
        { q: "Which statement about coverage is most accurate?", options: ["High coverage proves the code is correct", "Coverage should always be 100%", "Low coverage shows where tests are missing, but high coverage does not show the tests assert anything useful", "Coverage measures test speed"], answer: 2,
          explain: "Coverage tells you which lines ran, not whether a wrong result would fail a test. Use it to find gaps and mutation testing to judge strength." },
        { q: "A good reason to write a test at the end-to-end level is…", options: ["Every bug fix", "Testing string formatting", "Checking an if-statement boundary", "A critical user journey whose failure would be severe and that crosses many components"], answer: 3,
          explain: "E2E tests are expensive, so spend them on the few journeys that matter most, such as checkout or login. Push detailed logic checks down to cheaper levels." }
      ]
    },
    "test-practice": {
      title: "TDD, doubles & flakiness checkpoint",
      sub: "Red-green-refactor, choosing doubles and killing flaky tests.",
      questions: [
        { q: "In TDD, why write the test first and watch it fail?", options: ["It is faster to type", "It proves the test can fail, and makes you design the API from the caller's side", "Tools require it", "To raise coverage"], answer: 1,
          explain: "A test you have never seen fail might not test anything. Writing it first also forces you to decide how the code will be called before deciding how it works." },
        { q: "When is a mock (expectation-verifying double) the right choice?", options: ["For every collaborator", "For value objects", "When the behaviour under test is a side effect on a boundary, such as sending a payment", "For pure functions"], answer: 2,
          explain: "Mocks verify interactions, which matters for commands to external systems. Mocking internal collaborators couples tests to implementation and makes refactoring painful." },
        { q: "A test passes locally but fails 1 run in 20 on CI. The best first response is…", options: ["Quarantine it with an owner and ticket, then find the nondeterminism", "Add an automatic retry and move on", "Delete it silently", "Ignore it"], answer: 0,
          explain: "Retries hide real races and erode trust in the suite. Quarantine keeps the main signal green while someone fixes the root cause." },
        { q: "Which is the most common root cause of flaky tests?", options: ["Too many assertions", "Long test names", "Using a fake", "Uncontrolled time, ordering, shared state or async waits with fixed sleeps"], answer: 3,
          explain: "Flakiness comes from nondeterminism the test does not control. Inject clocks, isolate data, and wait on conditions instead of sleeping." },
        { q: "What does the 'refactor' step in red-green-refactor allow?", options: ["Changing behaviour", "Improving the design of code and tests while staying green", "Skipping tests", "Adding features"], answer: 1,
          explain: "Once green, you clean up with the test as a safety net. Skipping this step is how TDD codebases end up with well-tested messes." }
      ]
    },
    "test-advanced": {
      title: "Advanced testing checkpoint",
      sub: "Property-based tests, mutation testing and testing data pipelines.",
      questions: [
        { q: "A property-based test asserts…", options: ["An invariant that must hold for many generated inputs", "One hand-picked example", "That a property exists on an object", "UI properties"], answer: 0,
          explain: "Generators explore inputs you would not think of, and shrinking reduces a failure to a minimal example. Typical properties are round-trips, invariants and equivalence with a simpler model." },
        { q: "A surviving mutant tells you…", options: ["The build is broken", "The test is flaky", "A deliberate bug was introduced and no test failed, so that behaviour is under-tested", "Coverage is low"], answer: 2,
          explain: "Mutation testing measures whether tests would catch real changes in logic. Survivors point at missing assertions or missing cases, often at boundaries." },
        { q: "Which is a good first test for a SQL transformation that builds a daily revenue table?", options: ["Run it in production and eyeball the dashboard", "Check the query parses", "Count rows only", "Seed a tiny input fixture, run the query, and assert the exact expected output rows"], answer: 3,
          explain: "Small, known inputs with exact expected outputs catch join fan-out, null handling and boundary bugs. Row counts alone miss wrong values." },
        { q: "Data quality checks in a pipeline (not null, unique keys, accepted values, freshness) are best run…", options: ["Once a year", "On every run, failing or alerting before bad data reaches consumers", "Only when someone complains", "Only in development"], answer: 1,
          explain: "Data changes even when code does not, so tests on code alone are not enough. Runtime checks act as assertions on the data itself." },
        { q: "Why is mutation testing usually run less often than unit tests?", options: ["It is inaccurate", "It needs production data", "It runs the suite once per mutant, so it is expensive", "It only works in Java"], answer: 2,
          explain: "Each mutant needs a test run, so cost multiplies quickly. Teams run it nightly or only on changed files." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.test = {
    id: "test",
    name: "Testing Strategy",
    short: "TEST",
    tagline: "Confidence per minute of feedback",
    color: "#5eead4",
    blurb: "Decide what to test at which level, drive design with TDD, use the right test double for the job, eliminate flaky tests, and go beyond examples with property-based and mutation testing \u2014 including how to test SQL and data pipelines.",
    modules: [
      {
        id: "strategy",
        name: "Strategy & Shape",
        icon: "grid",
        lessons: [
          {
            id: "why-test",
            title: "Why we test, and what a good test is",
            summary: "Tests as fast feedback and a safety net, and the properties that make a test worth keeping.",
            minutes: 8,
            tags: ["testing", "fundamentals", "feedback"],
            blocks: [
              { t: "p", html: "Automated tests exist to answer one question quickly and reliably: <strong>did this change break anything I care about?</strong> Every other benefit \u2014 living documentation, design pressure, easier onboarding \u2014 follows from that." },
              { t: "h", text: "Properties of a test worth keeping" },
              { t: "table", headers: ["Property", "Meaning", "Smell when missing"], rows: [
                ["Fast", "Runs in milliseconds to seconds", "People stop running it locally"],
                ["Deterministic", "Same code, same result, every time", "Retries, 'just re-run it'"],
                ["Isolated", "Does not depend on other tests or order", "Passes alone, fails in the suite"],
                ["Behaviour-focused", "Asserts outcomes, not internals", "Breaks on every refactor"],
                ["Readable", "Name and body state the rule", "Nobody knows if a failure matters"],
                ["Fails for one reason", "One behaviour per test", "A red test needs debugging to interpret"]
              ] },
              { t: "code", lang: "python", code:
                "def test_free_shipping_applies_at_threshold():\n" +
                "    # Arrange\n" +
                "    cart = Cart(items=[Item(price=50.00)])\n" +
                "    # Act\n" +
                "    total = checkout_total(cart, free_shipping_from=50.00)\n" +
                "    # Assert\n" +
                "    assert total == 50.00"
              },
              { t: "note", variant: "tip", html: "Name tests as sentences about behaviour: <code class='tok'>free_shipping_applies_at_threshold</code> tells a reader the rule; <code class='tok'>test_checkout_3</code> tells them nothing." },
              { t: "note", variant: "key", html: "<strong>A test is worth keeping if it is fast, deterministic and asserts behaviour.</strong> Its value is the confidence it gives per second of feedback." }
            ]
          },
          {
            id: "pyramid-trophy",
            title: "Pyramid vs trophy: shaping a suite",
            summary: "Two popular models of how many tests to write at each level, what they agree on, and the shape to avoid.",
            minutes: 11,
            tags: ["test-pyramid", "testing-trophy", "strategy"],
            blocks: [
              { t: "p", html: "Test levels trade <strong>speed and precision</strong> against <strong>realism</strong>. A unit test is fast and points to the exact broken line; an end-to-end test is slow but proves the whole system works for a user. A suite's shape is how you spend across that trade-off." },
              { t: "diagram", id: "test-shapes", caption: "Pyramid, trophy and the ice-cream cone anti-pattern: width is the number of tests at each level." },
              { t: "table", headers: ["", "Pyramid", "Trophy"], rows: [
                ["Base", "Wide band of unit tests", "Static analysis: types, linters"],
                ["Largest band", "Unit", "Integration"],
                ["Top", "Thin E2E layer", "Thin E2E layer"],
                ["Fits best when", "Logic is rich and easy to isolate", "Most bugs live in wiring, UI and data access"]
              ] },
              { t: "p", html: "Both models are sound, and they agree on the important things: most feedback should be fast, E2E should be a thin layer for critical journeys, and the <strong>ice-cream cone</strong> (mostly slow UI tests) is the shape to avoid." },
              { t: "widget", id: "testPortfolioBalancer" },
              { t: "note", variant: "trap", html: "Teams drift into the cone one bug at a time: \"add an E2E test so this never happens again\". Ask instead which <em>lowest</em> level could have caught it, and write the test there." },
              { t: "note", variant: "key", html: "<strong>Shape follows where your bugs live.</strong> Pyramid or trophy, keep most tests fast, keep E2E thin and focused on critical journeys, and never let the cone form." }
            ]
          },
          {
            id: "test-levels",
            title: "Unit, integration, contract and end-to-end",
            summary: "What each level proves, what it costs, and a working definition of each that a team can agree on.",
            minutes: 12,
            tags: ["unit-tests", "integration-tests", "contract-tests", "e2e"],
            blocks: [
              { t: "p", html: "Teams argue endlessly about what counts as a unit or integration test. The useful definitions are about <strong>what is real</strong> in the test and <strong>what the failure tells you</strong>." },
              { t: "table", headers: ["Level", "What is real", "What it proves", "Typical cost"], rows: [
                ["Unit", "One module; collaborators replaced or pure", "The logic is right", "Milliseconds"],
                ["Integration", "Your code plus real infrastructure (DB, queue, filesystem)", "The pieces fit: SQL, mappings, config", "Seconds"],
                ["Contract", "One side of an API, against the other side's recorded expectations", "Neither side broke the other", "Seconds, no shared env"],
                ["End-to-end", "The whole deployed system via its UI or public API", "A user journey works", "Minutes, plus flakiness"]
              ] },
              { t: "h", text: "Contract tests in one picture" },
              { t: "code", lang: "javascript", code:
                "// Consumer side: record what we rely on\n" +
                "contract(\"orders-ui needs GET /orders/{id}\", {\n" +
                "  request:  { method: \"GET\", path: \"/orders/42\" },\n" +
                "  response: { status: 200, body: { id: 42, status: like(\"SHIPPED\"), total: like(19.99) } },\n" +
                "});\n\n" +
                "// Provider side, in the provider's CI: replay every consumer contract\n" +
                "// against the real service; a renamed field fails here, before deploy."
              },
              { t: "note", variant: "tip", html: "Integration tests against the real database engine (run in a container) catch far more than tests against an in-memory substitute with a different SQL dialect." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, shows where each level runs in a pipeline in its <em>Pipeline Engineering</em> track." },
              { t: "quiz", id: "test-strategy" },
              { t: "note", variant: "key", html: "<strong>Define levels by what is real and what a failure tells you.</strong> Units prove logic, integration proves fit, contracts prevent breaking neighbours, E2E proves the journey." }
            ]
          }
        ]
      },
      {
        id: "practice",
        name: "TDD, Doubles & Flakiness",
        icon: "bolt",
        lessons: [
          {
            id: "tdd",
            title: "Test-driven development",
            summary: "Red, green, refactor \u2014 what TDD is for, a worked cycle, and where it fits less well.",
            minutes: 12,
            tags: ["tdd", "red-green-refactor", "design"],
            blocks: [
              { t: "p", html: "TDD is a short loop: write a failing test for the next small behaviour (<strong>red</strong>), write the simplest code that passes (<strong>green</strong>), then clean up code and tests while staying green (<strong>refactor</strong>). Each loop takes minutes." },
              { t: "code", lang: "python", code:
                "# RED: the next behaviour, stated as a test\n" +
                "def test_empty_cart_total_is_zero():\n" +
                "    assert Cart().total() == 0\n\n" +
                "# GREEN: simplest thing that passes\n" +
                "class Cart:\n" +
                "    def total(self): return 0\n\n" +
                "# RED again: force the real logic\n" +
                "def test_total_sums_item_prices():\n" +
                "    cart = Cart(); cart.add(price=3); cart.add(price=4)\n" +
                "    assert cart.total() == 7\n\n" +
                "# GREEN, then REFACTOR names and duplication with both tests as a net"
              },
              { t: "h", text: "What TDD actually buys you" },
              { t: "ul", items: [
                "<strong>Design from the caller's side.</strong> You decide the API before the implementation, so awkward interfaces show up immediately.",
                "<strong>Tests you have seen fail.</strong> A test written after the code may pass for the wrong reason.",
                "<strong>Small steps.</strong> You are never more than a few minutes from working code.",
                "<strong>A suite as a by-product</strong>, rather than a chore at the end that gets cut."
              ] },
              { t: "h", text: "Where it fits less well" },
              { t: "p", html: "Exploratory spikes (you do not yet know what to build \u2014 throw the spike away, then TDD the real thing), visual layout, and thin glue code over a framework. Outside-in TDD starts from an acceptance test and works inward; inside-out starts from core logic. Both are valid." },
              { t: "note", variant: "trap", html: "Skipping the refactor step gives you a well-tested mess. The refactor step is where design improves; green is only half-done." },
              { t: "note", variant: "key", html: "<strong>Red, green, refactor \u2014 in minutes, not hours.</strong> TDD is a design and feedback habit; the test suite is the receipt." }
            ]
          },
          {
            id: "test-doubles",
            title: "Test doubles: dummies, stubs, spies, mocks and fakes",
            summary: "The five kinds of stand-in, when each is right, and why over-mocking makes tests brittle.",
            minutes: 11,
            tags: ["test-doubles", "mocks", "stubs", "fakes"],
            blocks: [
              { t: "p", html: "A <strong>test double</strong> replaces a real collaborator that is slow, nondeterministic or dangerous. 'Mock' is often used for all of them, but the distinctions matter because they lead to very different tests." },
              { t: "table", headers: ["Double", "What it does", "Use it for"], rows: [
                ["Dummy", "Fills a parameter, never used", "Required arguments irrelevant to the test"],
                ["Stub", "Returns canned answers", "Queries: rates, config, feature flags"],
                ["Spy", "Records calls for later assertions", "Commands where you check after the fact"],
                ["Mock", "Pre-programmed expectations, verifies itself", "Strict protocols at a real boundary"],
                ["Fake", "Working lightweight implementation", "Repositories, queues, clocks"]
              ] },
              { t: "widget", id: "testDoubleSorter" },
              { t: "h", text: "Mock roles, not objects" },
              { t: "compare",
                bad: { title: "Over-mocked", items: ["Mocks every internal class", "Asserts call order and argument shapes", "Breaks on every refactor", "Passes while the real wiring is broken"] },
                good: { title: "Well-placed doubles", items: ["Doubles only at boundaries you own an interface for", "Asserts outcomes for queries, interactions for commands", "Survives internal refactors", "Backed by a few integration tests on the real thing"] } },
              { t: "note", variant: "tip", html: "Prefer a fake for things you query and save (a repository); prefer a spy or mock for things you tell to do something (send, charge, publish). Never mock types you do not own \u2014 wrap them in an adapter and double the adapter." },
              { t: "note", variant: "key", html: "<strong>Stub queries, verify commands, fake infrastructure.</strong> Put doubles at boundaries, not between every pair of classes." }
            ]
          },
          {
            id: "flaky-tests",
            title: "Flaky tests: causes and cures",
            summary: "Why nondeterministic tests are worse than no tests, the usual root causes, and a team policy that works.",
            minutes: 10,
            tags: ["flaky-tests", "ci", "determinism"],
            blocks: [
              { t: "p", html: "A flaky test passes and fails on the same code. One flake teaches the team that red might not mean broken; a dozen teach them to ignore red entirely. At that point the suite has stopped doing its only job." },
              { t: "table", headers: ["Root cause", "Symptom", "Cure"], rows: [
                ["Fixed sleeps around async work", "Fails on slow CI machines", "Wait on a condition with a timeout"],
                ["Real clock or timezone", "Fails at midnight, month end, DST", "Inject a clock; pin the timezone"],
                ["Shared or leftover data", "Fails depending on test order", "Unique data per test; reset state"],
                ["Unseeded randomness", "Fails rarely, unreproducibly", "Seed and log the seed"],
                ["Real network calls", "Fails when a third party is slow", "Stub at the boundary; contract-test it"],
                ["Unordered collections", "Assertion on order fails sometimes", "Sort or compare as sets"]
              ] },
              { t: "code", lang: "javascript", code:
                "// Flaky: assumes the toast appears within 500 ms\n" +
                "await sleep(500);\n" +
                "expect(screen.getByText(\"Saved\")).toBeVisible();\n\n" +
                "// Deterministic: wait for the condition, with a ceiling\n" +
                "await waitFor(() => expect(screen.getByText(\"Saved\")).toBeVisible(), { timeout: 5000 });"
              },
              { t: "h", text: "A policy that works" },
              { t: "ol", items: [
                "Detect: track per-test pass rates across CI runs.",
                "Quarantine: move a flaky test out of the blocking gate, with an owner and a ticket.",
                "Fix or delete within an agreed time; a quarantined test nobody fixes is just a deleted test that still costs CPU."
              ] },
              { t: "quiz", id: "test-practice" },
              { t: "note", variant: "key", html: "<strong>A flaky test is a bug, either in the test or the code.</strong> Control time, data, order and waits; quarantine with an owner instead of retrying forever." }
            ]
          }
        ]
      },
      {
        id: "advanced",
        name: "Beyond Examples",
        icon: "database",
        lessons: [
          {
            id: "property-based",
            title: "Property-based testing",
            summary: "State rules that hold for all inputs and let a generator hunt for counterexamples.",
            minutes: 11,
            tags: ["property-based-testing", "generators", "invariants"],
            blocks: [
              { t: "p", html: "Example tests check the cases you thought of. A <strong>property-based test</strong> states a rule that must hold for <em>every</em> valid input, generates hundreds of inputs, and \u2014 when one fails \u2014 <strong>shrinks</strong> it to the smallest counterexample." },
              { t: "code", lang: "python", code:
                "from hypothesis import given, strategies as st\n\n" +
                "@given(st.lists(st.integers()))\n" +
                "def test_sort_is_ordered_and_keeps_elements(xs):\n" +
                "    out = my_sort(xs)\n" +
                "    assert all(a <= b for a, b in zip(out, out[1:]))   # ordered\n" +
                "    assert sorted(out) == sorted(xs)                     # same multiset\n\n" +
                "@given(st.text())\n" +
                "def test_encode_decode_round_trip(s):\n" +
                "    assert decode(encode(s)) == s"
              },
              { t: "h", text: "Properties that are easy to find" },
              { t: "table", headers: ["Pattern", "Example"], rows: [
                ["Round-trip", "parse(format(x)) == x; decode(encode(x)) == x"],
                ["Invariant", "A balance never goes negative; output length equals input length"],
                ["Idempotence", "normalize(normalize(x)) == normalize(x)"],
                ["Oracle / model", "Fast implementation agrees with a slow, obviously correct one"],
                ["Commutativity", "Applying discounts in any order gives the same total"]
              ] },
              { t: "note", variant: "tip", html: "When a property fails, keep the shrunk counterexample as an ordinary example test. It documents an edge case you did not know existed." },
              { t: "note", variant: "key", html: "<strong>Examples check what you imagined; properties explore what you did not.</strong> Start with round-trips and invariants, and keep the counterexamples as regression tests." }
            ]
          },
          {
            id: "mutation-testing",
            title: "Mutation testing: testing your tests",
            summary: "Inject small bugs on purpose and see whether the suite notices \u2014 a far better signal than coverage.",
            minutes: 10,
            tags: ["mutation-testing", "coverage", "test-quality"],
            blocks: [
              { t: "p", html: "Coverage tells you which lines ran. It cannot tell you whether a wrong result would fail a test. <strong>Mutation testing</strong> answers that directly: a tool makes small changes (mutants) \u2014 flip <code class='tok'>&gt;=</code> to <code class='tok'>&gt;</code>, replace <code class='tok'>&amp;&amp;</code> with <code class='tok'>||</code>, return a constant \u2014 and runs your tests against each one." },
              { t: "widget", id: "testMutationLab" },
              { t: "table", headers: ["Result", "Meaning", "Action"], rows: [
                ["Killed", "A test failed against the mutant", "Good: the suite guards this behaviour"],
                ["Survived", "All tests passed with the bug in place", "Add a case or a sharper assertion"],
                ["Equivalent", "The mutant cannot change behaviour", "Mark and ignore"],
                ["Timed out", "The mutant caused an infinite loop", "Usually counts as killed"]
              ] },
              { t: "note", variant: "tip", html: "Run mutation testing on changed files in a PR, or nightly on the core domain. Running it on the whole codebase on every push is rarely worth the CPU." },
              { t: "note", variant: "key", html: "<strong>Coverage shows what ran; mutation score shows what is guarded.</strong> Surviving mutants point at exactly the missing assertion." }
            ]
          },
          {
            id: "data-testing",
            title: "Testing SQL and data pipelines",
            summary: "Unit-testing transformations with tiny fixtures, and asserting on the data itself at runtime.",
            minutes: 12,
            tags: ["sql", "data-pipelines", "data-quality", "testing"],
            blocks: [
              { t: "p", html: "Data pipelines fail in two ways: the <strong>code</strong> is wrong (a join fans out, a filter drops nulls), or the <strong>data</strong> changes under correct code (a new status value, a late file). You need tests for both." },
              { t: "h", text: "1. Test transformations with tiny fixtures" },
              { t: "code", lang: "sql", code:
                "-- fixture: three orders, one refunded, one with a NULL region\n" +
                "WITH orders(order_id, region, amount, status, order_date) AS (\n" +
                "  SELECT 1, 'EU', 100.00, 'PAID',     DATE '2026-03-01' UNION ALL\n" +
                "  SELECT 2, 'EU',  40.00, 'REFUNDED', DATE '2026-03-01' UNION ALL\n" +
                "  SELECT 3, NULL,  25.00, 'PAID',     DATE '2026-03-01'\n" +
                ")\n" +
                "SELECT COALESCE(region, 'UNKNOWN') AS region, SUM(amount) AS revenue\n" +
                "FROM orders WHERE status = 'PAID'\n" +
                "GROUP BY 1 ORDER BY 1;\n" +
                "-- expected exactly: ('EU', 100.00), ('UNKNOWN', 25.00)"
              },
              { t: "p", html: "Assert the exact output rows, not just a count. Include the nasty cases on purpose: NULLs, duplicates, a key that appears in one table but not the other, a boundary date." },
              { t: "h", text: "2. Assert on the data every run" },
              { t: "table", headers: ["Check", "Catches"], rows: [
                ["Not null on required columns", "Upstream schema drift, broken joins"],
                ["Unique primary key", "Fan-out from a bad join; duplicate loads"],
                ["Accepted values", "A new status nobody handles"],
                ["Referential integrity", "Orphan rows after partial loads"],
                ["Row count vs source within tolerance", "Dropped or doubled batches"],
                ["Freshness (max timestamp age)", "Silent upstream outages"]
              ] },
              { t: "code", lang: "sql", code:
                "-- A check that should return zero rows; any row fails the run\n" +
                "SELECT order_id, COUNT(*) AS n\n" +
                "FROM fct_daily_revenue\n" +
                "GROUP BY order_id\n" +
                "HAVING COUNT(*) > 1;"
              },
              { t: "note", variant: "warn", html: "Never test pipelines against production data you are not allowed to copy. Build synthetic fixtures, or masked samples in a lower environment, and keep credentials out of test code \u2014 read them from the environment or a secret store." },
              { t: "h", text: "3. Declarative data tests (dbt and expectation suites)" },
              { t: "p", html: "Transformation frameworks such as dbt let you declare tests next to the model, and expectation-suite tools let you state rules about a dataset that run on every load. The idea is the same: <strong>assertions about data, versioned with the code</strong>." },
              { t: "code", lang: "text", code:
                "# models/schema.yml (dbt-style)\n" +
                "models:\n" +
                "  - name: fct_daily_revenue\n" +
                "    columns:\n" +
                "      - name: order_id\n" +
                "        tests: [not_null, unique]\n" +
                "      - name: status\n" +
                "        tests:\n" +
                "          - accepted_values: { values: [PAID, REFUNDED, CANCELLED] }\n" +
                "      - name: customer_id\n" +
                "        tests:\n" +
                "          - relationships: { to: ref('dim_customers'), field: customer_id }\n\n" +
                "# expectation-suite style, run after each load\n" +
                "expect_column_values_to_be_between(revenue, min_value=0)\n" +
                "expect_table_row_count_to_be_between(min_value=0.9 * yesterday, max_value=1.1 * yesterday)"
              },
              { t: "table", headers: ["Severity", "When to use", "Effect"], rows: [
                ["error", "Broken keys, nulls in required columns", "Stop the pipeline before consumers see it"],
                ["warn", "Volume drift, new rare values", "Alert a human; keep loading"]
              ] },
              { t: "quiz", id: "test-advanced" },
              { t: "note", variant: "key", html: "<strong>Test the code with tiny fixtures and exact outputs; test the data with checks on every run.</strong> Correct SQL on surprising data still produces wrong numbers." }
            ]
          }
        ]
      },
      {
        id: "contracts",
        name: "Snapshots & Contracts",
        icon: "share",
        lessons: [
          {
            id: "snapshot-golden",
            title: "Snapshot and golden-file testing",
            summary: "Approving large outputs with a reviewed diff \u2014 and keeping it from becoming rubber-stamping.",
            minutes: 10,
            tags: ["snapshot-testing", "golden-files", "approval-testing"],
            blocks: [
              { t: "p", html: "A <strong>snapshot</strong> or <strong>golden-file</strong> test records an output once, you review it, and future runs fail if the output differs. It is ideal for outputs that are tedious to assert field by field: rendered components, generated code, config, reports, CLI help text." },
              { t: "code", lang: "javascript", code:
                "test(\"invoice email renders totals and line items\", () => {\n" +
                "  const html = renderInvoiceEmail(fixtureInvoice, { now: FIXED_DATE });\n" +
                "  expect(html).toMatchSnapshot();   // diff shown on change; update deliberately\n" +
                "});"
              },
              { t: "table", headers: ["Do", "Avoid"], rows: [
                ["Small, focused snapshots (one component state)", "Whole-page snapshots with thousands of lines"],
                ["Fixed clocks, seeds and ids", "Timestamps and random values in output"],
                ["Review snapshot diffs in PRs like code", "Blanket 'update all snapshots' to get green"],
                ["Pair with a few explicit assertions on what matters", "Snapshots as the only test of logic"],
                ["Readable serialisation (sorted keys, pretty-printed)", "Binary or minified output"]
              ] },
              { t: "note", variant: "trap", html: "When every change touches the snapshot, people stop reading the diff. If a snapshot changes in most PRs, it is too broad: split it or replace it with targeted assertions." },
              { t: "note", variant: "tip", html: "Golden files are also how characterization tests pin legacy behaviour \u2014 see the Refactoring track's legacy-code module." },
              { t: "note", variant: "key", html: "<strong>Snapshots are approvals, so review them.</strong> Keep them small, deterministic and readable, and back them with explicit assertions for the logic that matters." }
            ]
          },
          {
            id: "contract-pact",
            title: "Consumer-driven contract testing",
            summary: "How Pact-style contracts let services deploy independently without a shared end-to-end environment.",
            minutes: 12,
            tags: ["contract-testing", "pact", "microservices", "apis"],
            blocks: [
              { t: "p", html: "End-to-end environments with every service deployed are slow, flaky and always half broken. <strong>Consumer-driven contracts</strong> replace much of that: each consumer records what it needs from a provider, and the provider proves it still delivers \u2014 each side testing alone." },
              { t: "ol", items: [
                "<strong>Consumer test:</strong> the consumer's code runs against a mock provider configured with expected interactions. Passing produces a contract file.",
                "<strong>Publish:</strong> the contract goes to a broker, tagged with the consumer version.",
                "<strong>Provider verification:</strong> the provider's CI replays every consumer's interactions against the real provider and reports results.",
                "<strong>Can I deploy?</strong> Before deploying either side, check the broker that the versions in the target environment are compatible."
              ] },
              { t: "code", lang: "javascript", code:
                "// Consumer side (orders-ui)\n" +
                "provider\n" +
                "  .given(\"order 42 exists\")                          // provider state\n" +
                "  .uponReceiving(\"a request for order 42\")\n" +
                "  .withRequest({ method: \"GET\", path: \"/orders/42\" })\n" +
                "  .willRespondWith({ status: 200, body: {\n" +
                "    id: integer(42), status: string(\"SHIPPED\"), total: decimal(19.99) } });\n\n" +
                "// Provider side (orders-service CI): verify all published contracts\n" +
                "// against the running service, with a hook that sets up 'order 42 exists'."
              },
              { t: "table", headers: ["Contract tests catch", "They do not replace"], rows: [
                ["Renamed or removed fields consumers use", "Functional tests of the provider's logic"],
                ["Changed status codes and types", "A few E2E smoke tests of critical journeys"],
                ["Broken request formats", "Performance and security testing"]
              ] },
              { t: "note", variant: "tip", html: "Contracts should describe what the consumer <em>uses</em>, with type matchers rather than exact example values. Over-specified contracts block harmless provider changes." },
              { t: "quiz", id: "test-contracts" },
              { t: "note", variant: "key", html: "<strong>Let consumers state their needs and providers prove them.</strong> Contract tests plus a deploy gate let services ship independently without a giant shared test environment." }
            ]
          }
        ]
      }
    ]
  };
})();
