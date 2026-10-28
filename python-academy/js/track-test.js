/* =====================================================================
   PYXIS · Testing Python
   window.TRACKS.test — modules: pytest / beyond
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     fixtureGraph — pytest fixture resolution, scopes and teardown
  ================================================================== */
  var SCOPE_RANK = { "function": 0, "module": 1, "session": 2 };
  var TESTS = [
    { id: "signup", label: "test_signup", file: "test_api.py", uses: ["client"] },
    { id: "profile", label: "test_profile", file: "test_api.py", uses: ["client", "user"] },
    { id: "engine", label: "test_engine_ping", file: "test_db.py", uses: ["db_engine"] }
  ];
  function fixtures(engineScope, clientScope) {
    return {
      settings: { scope: "session", deps: [] },
      db_engine: { scope: engineScope, deps: ["settings"] },
      db_session: { scope: "function", deps: ["db_engine"] },
      client: { scope: clientScope, deps: ["db_session", "settings"] },
      user: { scope: "function", deps: ["db_session"] }
    };
  }
  function order(fx, names) {
    var seen = {}, out = [], err = null;
    function visit(n, parent) {
      if (err) return;
      var f = fx[n];
      if (parent && SCOPE_RANK[f.scope] < SCOPE_RANK[fx[parent].scope]) {
        err = "ScopeMismatch: You tried to access the " + f.scope + " scoped fixture " + n + " with a " + fx[parent].scope + " scoped request object (requested by " + parent + ")";
        return;
      }
      if (seen[n]) return;
      f.deps.forEach(function (d) { visit(d, n); });
      seen[n] = true; out.push(n);
    }
    names.forEach(function (n) { visit(n, null); });
    return { order: out, err: err };
  }
  function suiteCounts(fx) {
    /* count instantiations across the three tests, honouring cache keys per scope */
    var cache = {}, counts = {};
    var err = null;
    TESTS.forEach(function (t) {
      var r = order(fx, t.uses);
      if (r.err) { err = r.err; return; }
      r.order.forEach(function (n) {
        var sc = fx[n].scope;
        var key = sc === "session" ? n : sc === "module" ? n + "@" + t.file : n + "@" + t.id;
        if (!cache[key]) { cache[key] = true; counts[n] = (counts[n] || 0) + 1; }
      });
    });
    return { counts: counts, err: err };
  }

  Widgets.fixtureGraph = function (mount) {
    K.shell(mount, "graph", "Fixture graph and scopes",
      "Three tests request fixtures by name. pytest resolves the dependency graph, sets fixtures up dependencies-first, caches them per scope, and tears them down in reverse. Change scopes and see what happens.");
    var test = TESTS[1], engineScope = "session", clientScope = "function";
    var row1 = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center" });
    var row2 = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center" });
    var graph = h("div", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.78rem;display:grid;gap:4px;color:var(--text)" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var fx = fixtures(engineScope, clientScope);
      K.clear(graph);
      Object.keys(fx).forEach(function (n) {
        graph.appendChild(h("div", {}, n + "  [" + fx[n].scope + "]" + (fx[n].deps.length ? "  \u2190 " + fx[n].deps.join(", ") : "")));
      });
      var r = order(fx, test.uses);
      var s = suiteCounts(fx);
      K.clear(readout);
      readout.appendChild(K.ro("test", test.label));
      if (r.err || s.err) {
        readout.appendChild(h("span", { class: "ro", style: "color:var(--rose-ink)" }, "result ", h("b", {}, "error at setup")));
        readout.appendChild(K.wide(r.err || s.err));
        readout.appendChild(K.wide("A fixture may only depend on fixtures with the same or a wider scope. A module-scoped client cannot hold a per-test database session."));
        return;
      }
      readout.appendChild(K.ro("setup", r.order.join(" \u2192 ")));
      readout.appendChild(K.ro("teardown", r.order.slice().reverse().join(" \u2192 ")));
      readout.appendChild(K.ro("db_engine created", (s.counts.db_engine || 0) + "\u00d7 in 3 tests"));
      readout.appendChild(K.ro("db_session created", (s.counts.db_session || 0) + "\u00d7"));
      readout.appendChild(K.wide(engineScope === "session"
        ? "The expensive engine is built once per run and shared; each test still gets a fresh session, so state does not leak between tests."
        : "A function-scoped engine rebuilds the connection pool for every test that needs it. Correct, but slow: widen the scope of expensive, stateless resources."));
    }
    row1.appendChild(K.segment(TESTS.map(function (t) { return [t.id, t.label]; }), 1, function (id) {
      test = TESTS.filter(function (t) { return t.id === id; })[0]; paint();
    }));
    row2.appendChild(h("span", { style: "font-size:0.82rem;color:var(--text-dim)" }, "db_engine scope"));
    row2.appendChild(K.segment([["session", "session"], ["function", "function"]], 0, function (v) { engineScope = v; paint(); }));
    row2.appendChild(h("span", { style: "font-size:0.82rem;color:var(--text-dim)" }, "client scope"));
    row2.appendChild(K.segment([["function", "function"], ["module", "module"]], 0, function (v) { clientScope = v; paint(); }));
    mount.appendChild(row1);
    mount.appendChild(row2);
    mount.appendChild(graph);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "test-pytest": {
      title: "pytest fundamentals checkpoint",
      sub: "Assertions, parametrize, fixtures and mocking.",
      questions: [
        {
          q: "How does pytest show the values involved when a plain assert x == y fails?",
          options: ["It rewrites assert statements in test modules at import time to capture and display intermediate values","It does not; you need assertEqual","It re-runs the test in debug mode","It reads the source with a regex"],
          answer: 0,
          explain: "pytest's assertion rewriting instruments asserts in test files and conftest.py, so a plain assert gives a detailed diff. That is why helpers in other modules need register_assert_rewrite to get the same output."
        },
        {
          q: "A session-scoped fixture requests a function-scoped fixture. What happens?",
          options: ["The function fixture is promoted to session","It works but leaks state","The test is skipped","pytest raises ScopeMismatch at setup"],
          answer: 3,
          explain: "A wider-scoped fixture outlives narrower ones, so it cannot hold a reference to something that is torn down after each test. Dependencies must have the same or a wider scope."
        },
        {
          q: "Where does code after yield in a fixture run?",
          options: ["Before the test","Only if the test passes","During teardown, after the tests using that fixture instance finish, even if they failed","Never"],
          answer: 2,
          explain: "yield fixtures split setup and teardown. Teardown runs in reverse order of setup and runs on failure too, which makes them the cleanest way to release resources."
        },
        {
          q: "Module app.service does from app.clients import fetch. Which patch target makes the service use a fake?",
          options: ["app.clients.fetch","app.service.fetch","fetch","builtins.fetch"],
          answer: 1,
          explain: "Patch where the name is looked up, not where it is defined. After from-import, app.service holds its own reference, so patching app.clients.fetch leaves the service calling the real function."
        },
        {
          q: "Why pass autospec=True (or use create_autospec) when mocking a class?",
          options: ["Faster mocks","The mock enforces the real signatures, so calls with wrong arguments or misspelled methods fail instead of silently succeeding","It records calls","It enables async"],
          answer: 1,
          explain: "A bare MagicMock accepts any attribute and any call, so tests keep passing after the real API changes. Autospec keeps mocks honest to the real interface."
        },
        {
          q: "A test passes alone but fails when the full suite runs. What is the most likely cause?",
          options: ["Shared state leaking between tests, such as a module-level cache, a wider-scoped mutable fixture, or test order dependence","Slow hardware","pytest randomness","Assertion rewriting"],
          answer: 0,
          explain: "Order-dependent failures nearly always come from state that outlives a test. Find it by running with random ordering or bisecting the suite, then reset or narrow the scope of that state."
        }
      ]
    },
    "test-beyond": {
      title: "Beyond unit tests checkpoint",
      sub: "Property-based, integration, contract and mutation testing.",
      questions: [
        {
          q: "What is the strongest property to test for an encode/decode pair?",
          options: ["encode never raises","Output is a string","It is fast","decode(encode(x)) == x for all valid x (round-trip)"],
          answer: 3,
          explain: "Round-trip properties catch a huge range of bugs with one line, because any information lost or corrupted by either side breaks equality. Hypothesis then searches for inputs that violate it."
        },
        {
          q: "Hypothesis finds a failing input of 300 characters. What does it report?",
          options: ["The 300-character input","Only a stack trace","A shrunk, minimal input that still fails, such as a single unusual character","A random different input each run"],
          answer: 2,
          explain: "Shrinking simplifies failing examples automatically, and the example database replays them on later runs. You debug the smallest case instead of a wall of noise."
        },
        {
          q: "Why run repository tests against a real PostgreSQL (for example via testcontainers) instead of SQLite?",
          options: ["SQLite is slower","SQLite cannot run SQLAlchemy","Dialect, constraint, locking, JSON and transaction behaviour differ, so tests on another engine can pass while production fails","It is required by pytest"],
          answer: 2,
          explain: "Integration tests are valuable exactly because they exercise the real dependency. A substitute engine removes the behaviour you were trying to test."
        },
        {
          q: "What does a consumer-driven contract test protect against?",
          options: ["Slow APIs","A provider changing a response in a way that breaks a specific consumer, detected in the provider's CI before deploy","SQL injection","Flaky UI tests"],
          answer: 1,
          explain: "Consumers publish the interactions they rely on; the provider verifies them on every build. That catches breaking changes without a full end-to-end environment."
        },
        {
          q: "Your suite has 95% line coverage but a mutation testing run shows 40% of mutants survive. What does that mean?",
          options: ["Much of the code is executed by tests but its behaviour is not actually asserted","The mutation tool is broken","Coverage is overcounting","You need more integration tests only"],
          answer: 0,
          explain: "Coverage proves lines ran; mutation score shows whether tests notice when behaviour changes. Surviving mutants point at weak assertions and untested boundaries."
        },
        {
          q: "Which is a sensible place to run mutation testing?",
          options: ["On every keystroke","Only in production","Never; it has no value","Nightly or on changed modules in CI, focused on critical business logic, because it is slow"],
          answer: 3,
          explain: "Mutation testing reruns the suite many times. Scope it to high-value code and run it on a schedule or against the diff, then use survivors as a to-do list for better assertions."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.test = {
    id: "test",
    name: "Testing Python",
    short: "TEST",
    tagline: "Tests that catch bugs, not just lines",
    color: "#fb7185",
    blurb: "pytest assertions, parametrization and markers, the fixture graph and scopes, mocking at the right seam, test design and flakiness, then property-based testing with Hypothesis, integration tests against real dependencies, contract tests, and mutation testing.",
    modules: [
      {
        id: "pytest",
        name: "pytest fundamentals",
        icon: "grid",
        lessons: [
          L("pytest-basics", "pytest: assertions, parametrize and markers", "Plain asserts with rich failure output, one test body over many cases, and markers that select what runs.", 8, ["pytest", "parametrize", "markers"], [
            B.p("pytest discovers <code class='tok'>test_*.py</code> files and <code class='tok'>test_*</code> functions, and lets you use a plain <code class='tok'>assert</code>. It rewrites those asserts at import time so a failure prints both sides and a diff. No assertion methods to memorise."),
            B.code("python", [
              "import pytest",
              "from billing.pricing import discount, parse_amount",
              "",
              "@pytest.mark.parametrize(",
              "    (\"total\", \"member\", \"expected\"),",
              "    [(99, False, 0), (100, False, 10), (100, True, 15), (101, True, 15)],",
              "    ids=[\"below\", \"boundary-guest\", \"boundary-member\", \"above\"],",
              ")",
              "def test_discount(total, member, expected):",
              "    assert discount(total, member) == expected",
              "",
              "def test_parse_rejects_garbage():",
              "    with pytest.raises(ValueError, match=r\"not a number\"):",
              "        parse_amount(\"12,3x\")",
              "",
              "def test_tax():",
              "    assert 0.1 + 0.2 == pytest.approx(0.3)"
            ]),
            B.table(["Built-in fixture / tool", "Use"], [
              ["<code class='tok'>tmp_path</code>", "A fresh temporary directory per test"],
              ["<code class='tok'>monkeypatch</code>", "Set env vars, attributes or dict items, undone after the test"],
              ["<code class='tok'>capsys</code> / <code class='tok'>caplog</code>", "Capture stdout/stderr or log records"],
              ["<code class='tok'>@pytest.mark.slow</code>", "Custom marker; select with <code class='tok'>-m \"not slow\"</code>"],
              ["<code class='tok'>--strict-markers</code>", "Typos in marker names become errors"],
              ["<code class='tok'>-x</code>, <code class='tok'>--lf</code>, <code class='tok'>-k expr</code>", "Stop on first failure, rerun last failures, select by name"]
            ]),
            B.tip("Use <code class='tok'>ids=</code> or <code class='tok'>pytest.param(..., id=\"...\")</code> for parametrized cases. A failure named <code class='tok'>test_discount[boundary-guest]</code> tells you the bug before you open the file."),
            B.cue("<strong>Spotting it in a prompt:</strong> five copy-pasted tests differing by one value. Collapse them into one parametrized test with named cases."),
            B.key("<strong>Plain asserts, parametrized tables, strict markers.</strong> pytest's defaults let tests read like specifications.")
          ]),
          L("fixtures", "Fixtures, scopes and the fixture graph", "Fixtures are dependency injection for tests: requested by name, built dependencies-first, cached per scope and torn down in reverse.", 9, ["fixtures", "scope", "conftest"], [
            B.p("A test asks for a fixture by naming it as a parameter. pytest builds a graph: each fixture may request others, so a <code class='tok'>client</code> can depend on a <code class='tok'>db_session</code>, which depends on a <code class='tok'>db_engine</code>. Setup walks the graph dependencies-first; teardown runs in reverse."),
            B.code("python", [
              "# conftest.py: shared by every test below this directory",
              "import pytest",
              "",
              "@pytest.fixture(scope=\"session\")",
              "def db_engine(settings):",
              "    engine = create_engine(settings.database_url)",
              "    yield engine",
              "    engine.dispose()",
              "",
              "@pytest.fixture",
              "def db_session(db_engine):",
              "    with db_engine.connect() as conn:",
              "        tx = conn.begin()",
              "        session = Session(bind=conn)",
              "        yield session",
              "        session.close()",
              "        tx.rollback()          # every test starts clean",
              "",
              "@pytest.fixture",
              "def client(db_session, settings):",
              "    app.dependency_overrides[get_session] = lambda: db_session",
              "    yield TestClient(app)",
              "    app.dependency_overrides.clear()"
            ]),
            B.widget("fixtureGraph"),
            B.table(["Scope", "Created", "Use for"], [
              ["function (default)", "Once per test", "Anything mutable: sessions, objects under test"],
              ["class / module", "Once per class or file", "Moderately expensive read-only setup"],
              ["package / session", "Once per run", "Engines, containers, compiled assets"]
            ]),
            B.trap("<code class='tok'>autouse=True</code> fixtures run for every test in scope whether or not they are requested. They are convenient for resetting global state and confusing for everything else: a reader cannot see them in the test signature."),
            B.cue("<strong>Interview cue:</strong> \"Widen scope for expensive, stateless resources; keep anything mutable function-scoped, and roll back per test\" answers the classic slow-suite versus isolation tension."),
            B.key("<strong>Fixtures are a dependency graph with lifetimes.</strong> Request by name, yield for teardown, share expensive things, isolate mutable things.")
          ]),
          L("mocking", "Mocking, monkeypatch and fakes", "Replace slow or side-effecting boundaries, patch where names are looked up, and prefer honest fakes over mocks that accept anything.", 9, ["mock", "patch", "fakes"], [
            B.p("Test doubles let you isolate the code under test from the network, the clock and other slow or non-deterministic collaborators. The skill is choosing <strong>which seam</strong> to replace and <strong>which kind</strong> of double to use."),
            B.table(["Double", "What it is", "Best for"], [
              ["Fake", "A working lightweight implementation (in-memory repo)", "Domain logic tests; reusable and honest"],
              ["Stub", "Returns canned answers", "Driving a branch: \"the gateway declines\""],
              ["Mock", "Records calls for assertions", "Verifying an interaction is the point: \"an email was sent\""],
              ["Spy", "Wraps the real object and records", "Rare: checking a real call happened"]
            ]),
            B.code("python", [
              "from unittest.mock import create_autospec, patch",
              "from app import service",
              "from app.clients import PaymentClient",
              "",
              "def test_charge_declined():",
              "    client = create_autospec(PaymentClient, instance=True)",
              "    client.charge.return_value = {\"status\": \"declined\"}",
              "    result = service.checkout(order, payments=client)   # injected",
              "    assert result.state == \"payment_failed\"",
              "    client.charge.assert_called_once_with(order.total, currency=\"EUR\")",
              "",
              "def test_uses_patched_lookup():",
              "    with patch(\"app.service.fetch_rates\", return_value={\"EUR\": 1.0}):",
              "        assert service.convert(10, \"EUR\") == 10",
              "",
              "def test_env(monkeypatch):",
              "    monkeypatch.setenv(\"FEATURE_X\", \"1\")"
            ]),
            B.warn("<strong>Patch where the name is used.</strong> After <code class='tok'>from app.clients import fetch_rates</code>, the service module has its own reference; patching <code class='tok'>app.clients.fetch_rates</code> changes nothing for it."),
            B.cmp("Mock-heavy tests", ["Assert every internal call", "Break on harmless refactors", "Pass while the real API has changed"],
                  "Seam-based tests", ["Inject collaborators via parameters or Protocols", "Use fakes for repositories, autospec mocks at true boundaries", "Assert outcomes, verify only meaningful interactions"]),
            B.tip("Use <code class='tok'>AsyncMock</code> for coroutine functions, and freeze time with an injected clock (or a time-travel library) rather than patching <code class='tok'>datetime</code> in a dozen modules."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"our tests mock everything and still miss bugs\" calls for fewer mocks: real objects inside the boundary, fakes for storage, and a few integration tests."),
            B.key("<strong>Replace boundaries, not internals.</strong> Inject collaborators, autospec your mocks, patch at the lookup site, and prefer fakes for anything stateful.")
          ]),
          L("test-design", "Test design and flaky tests", "Arrange-act-assert, one behaviour per test, deterministic inputs, and a playbook for hunting order and timing dependencies.", 8, ["design", "flaky", "isolation"], [
            B.p("A good test reads as a specification: <strong>arrange</strong> the world, <strong>act</strong> once, <strong>assert</strong> the observable outcome. When it fails, its name and its assertion should tell you which behaviour broke without opening the code under test."),
            B.code("python", [
              "def test_expired_coupon_is_rejected(clock, coupons):",
              "    # arrange",
              "    coupon = coupons.create(code=\"SPRING\", expires_at=clock.now() - timedelta(seconds=1))",
              "    # act",
              "    result = apply_coupon(cart_with_total(50), \"SPRING\", clock=clock)",
              "    # assert",
              "    assert result.error == \"coupon_expired\"",
              "    assert result.total == 50"
            ]),
            B.table(["Flakiness source", "Symptom", "Fix"], [
              ["Shared mutable state", "Fails only in the full run", "Function-scoped fixtures, rollback, reset caches"],
              ["Order dependence", "Fails when run in a different order", "Random ordering in CI to expose it, then isolate"],
              ["Real time and sleeps", "Fails under load", "Inject a clock; poll with a deadline instead of fixed sleeps"],
              ["Randomness", "Fails one run in fifty", "Seed it, or use property-based tests that report the seed"],
              ["Network and external services", "Fails when a sandbox is down", "Fakes or local containers; mark true end-to-end tests separately"],
              ["Parallel runs (xdist)", "Fails with -n auto", "Unique temp paths, databases or schemas per worker"]
            ]),
            B.warn("Retrying flaky tests automatically hides real race conditions in your code as well as in your tests. Quarantine with an owner and a deadline instead of adding blanket reruns."),
            B.ul([
              "Name tests after behaviour: <code class='tok'>test_refund_restores_stock</code>, not <code class='tok'>test_refund_2</code>.",
              "Keep the test pyramid honest: many fast unit tests, fewer integration tests, a handful of end-to-end checks.",
              "Make tests fast enough to run before every push; slow suites stop being run."
            ]),
            B.quiz("test-pytest"),
            B.cue("<strong>Interview cue:</strong> when asked about a flaky suite, list the usual suspects (shared state, time, order, network, parallelism) and the tool to expose each. It shows a method, not luck."),
            B.key("<strong>One behaviour, deterministic inputs, observable outcome.</strong> Treat every flaky test as a bug with an owner, not something to rerun.")
          ])
        ]
      },
      {
        id: "beyond",
        name: "Beyond unit tests",
        icon: "shield",
        lessons: [
          L("property-based", "Property-based testing with Hypothesis", "State a rule that must hold for all inputs and let the library search for counterexamples, then shrink them to the smallest failing case.", 9, ["hypothesis", "properties", "shrinking"], [
            B.p("Example-based tests check the cases you thought of. <strong>Property-based tests</strong> state an invariant and let a generator throw hundreds of inputs at it, including the empty, huge, negative and Unicode-heavy ones you forgot. When something fails, Hypothesis <strong>shrinks</strong> it to a minimal example."),
            B.code("python", [
              "from hypothesis import given, example, strategies as st",
              "",
              "@given(st.text())",
              "@example(\"\")                                     # always also try this",
              "def test_slug_round_trip(s):",
              "    assert decode_slug(encode_slug(s)) == s",
              "",
              "@given(st.lists(st.integers()))",
              "def test_sort_properties(xs):",
              "    out = my_sort(xs)",
              "    assert len(out) == len(xs)                    # nothing lost",
              "    assert all(a <= b for a, b in zip(out, out[1:]))  # ordered",
              "    assert sorted(out) == sorted(xs)              # same multiset"
            ]),
            B.table(["Property pattern", "Example"], [
              ["Round-trip", "parse(render(x)) == x; loads(dumps(x)) == x"],
              ["Invariant", "Balance never negative; output always sorted"],
              ["Oracle", "Fast implementation equals slow obvious one"],
              ["Idempotence", "normalise(normalise(x)) == normalise(x)"],
              ["Metamorphic", "Adding an unrelated item does not change a total"]
            ]),
            B.tip("Stateful testing (<code class='tok'>RuleBasedStateMachine</code>) generates sequences of operations, such as deposit, withdraw, refund, against a model. It is excellent at finding ordering bugs in caches, queues and state machines."),
            B.p("Trade-off: properties take more thought than examples, and some domains have no crisp invariant. Generated tests are also slower. Keep example tests for documented cases and add properties where bugs hide in input space: parsers, serialisers, money and date arithmetic."),
            B.cue("<strong>Spotting it in a prompt:</strong> any parser, encoder, or \"normalise this input\" function. Lead with a round-trip or idempotence property."),
            B.key("<strong>Describe the rule; let the machine find the counterexample.</strong> Round-trips, invariants and oracles catch the bugs your examples never imagined.")
          ]),
          L("integration-tests", "Integration tests with real dependencies", "Exercise the actual database, queue and HTTP layers in disposable environments, isolated per test and fast enough to run on every pull request.", 9, ["integration", "testcontainers", "http"], [
            B.p("Unit tests prove your logic; <strong>integration tests</strong> prove your code agrees with the things it talks to: SQL dialects, constraints, serialisation, HTTP status handling, message formats. They are worth their extra cost only when they use the <em>real</em> dependency."),
            B.code("python", [
              "import pytest",
              "from testcontainers.postgres import PostgresContainer",
              "",
              "@pytest.fixture(scope=\"session\")",
              "def pg_url():",
              "    with PostgresContainer(\"postgres:16-alpine\") as pg:",
              "        url = pg.get_connection_url()",
              "        run_migrations(url)          # same migrations as production",
              "        yield url",
              "",
              "def test_unique_email_enforced(db_session):",
              "    db_session.add(User(email=\"a@shop.example\"))",
              "    db_session.flush()",
              "    db_session.add(User(email=\"a@shop.example\"))",
              "    with pytest.raises(IntegrityError):",
              "        db_session.flush()"
            ]),
            B.table(["Dependency", "Integration approach"], [
              ["Relational DB", "Container with real engine; migrations applied; transaction rollback per test"],
              ["Outbound HTTP", "Local test server or a transport-level mock (respx for httpx); never the real partner in CI"],
              ["Message broker", "Container, unique topic or queue per test"],
              ["Object storage", "Local emulator container, unique bucket per run"],
              ["Time", "Injected clock or a time-freezing library"]
            ]),
            B.warn("Integration suites become slow and flaky when tests share data. Give each test its own transaction, schema or namespace, and generate unique keys rather than relying on fixed IDs."),
            B.p("Trade-off: containers add startup seconds and need Docker in CI. Reuse one container per session, run tests in parallel with per-worker databases, and keep the number of integration tests proportional to the number of integration <em>risks</em>, not the number of functions."),
            B.cue("<strong>Interview cue:</strong> \"I test against the same engine and migrations as production, with a rollback per test\" is the answer interviewers want to the SQLite-versus-Postgres question."),
            B.key("<strong>Integration tests earn their cost only with real dependencies.</strong> Disposable containers, production migrations, per-test isolation.")
          ]),
          L("contract-tests", "Contract testing for APIs and events", "Pin the agreement between services, consumer-driven or schema-driven, so breaking changes fail in CI instead of in production.", 8, ["contracts", "openapi", "schemas"], [
            B.p("Between services, the risk is not your logic but the <strong>agreement</strong>: field names, types, status codes, optionality, event shapes. Contract tests make that agreement executable, so either side breaking it fails a build."),
            B.table(["Style", "How it works", "Good when"], [
              ["Consumer-driven contracts", "Consumers record the requests and responses they rely on; the provider verifies them in CI", "Many teams, independent deploys"],
              ["Schema-driven (OpenAPI / JSON Schema)", "The provider publishes a schema; tests check responses conform, and generated requests probe edge cases", "Public APIs, one provider many unknown consumers"],
              ["Event schemas with a registry", "Producers register schemas; compatibility rules block breaking changes", "Kafka and similar event streams"]
            ]),
            B.code("python", [
              "# schema conformance for a FastAPI app, as a plain pytest test",
              "from jsonschema import validate",
              "",
              "def test_order_response_matches_contract(client, order_schema):",
              "    resp = client.get(\"/orders/o-1\")",
              "    assert resp.status_code == 200",
              "    validate(instance=resp.json(), schema=order_schema)",
              "",
              "def test_openapi_has_no_breaking_change(current_spec, published_spec):",
              "    removed = set(published_spec[\"paths\"]) - set(current_spec[\"paths\"])",
              "    assert not removed, f\"removed endpoints: {removed}\""
            ]),
            B.cmp("Breaking", ["Removing or renaming a field", "Making an optional request field required", "Changing a type or enum meaning"],
                  "Usually safe", ["Adding an optional response field", "Adding an endpoint", "Accepting a wider set of inputs"]),
            B.tip("Generating a schema from your models (pydantic, FastAPI's OpenAPI) and diffing it against the last published version in CI is a cheap first contract test, even before you adopt a dedicated tool."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"we found out the mobile app broke after deploying the API\" is a missing contract test. Propose consumer contracts or schema diffs in the provider's pipeline."),
            B.key("<strong>Make the agreement executable.</strong> Verify consumer expectations or schema compatibility in the provider's CI, before deploy.")
          ]),
          L("mutation-testing", "Mutation testing and coverage honesty", "Coverage says what ran; mutation testing says whether your tests would notice if the code were wrong.", 8, ["mutation", "coverage", "quality"], [
            B.p("Line coverage is easy to inflate: call the function, assert nothing meaningful, and the lines count as covered. <strong>Mutation testing</strong> flips that around. A tool makes small changes to your code (mutants), such as <code class='tok'>&gt;=</code> to <code class='tok'>&gt;</code>, <code class='tok'>+</code> to <code class='tok'>-</code>, or <code class='tok'>True</code> to <code class='tok'>False</code>, and reruns the tests. A mutant that no test kills marks behaviour nobody is checking."),
            B.code("bash", [
              "pytest --cov=billing --cov-branch --cov-report=term-missing",
              "mutmut run --paths-to-mutate src/billing/pricing.py",
              "mutmut results            # list surviving mutants",
              "mutmut show 17            # see the exact change that survived"
            ]),
            B.stat([["95%", "line coverage"], ["60%", "mutation score"], ["35", "surviving mutants to review"]]),
            B.table(["Surviving mutant", "Usually means"], [
              ["Boundary changed (>= to >)", "No test sits exactly on the boundary"],
              ["Return value replaced", "Callers' tests never assert the value"],
              ["Condition forced True", "One branch's behaviour is untested"],
              ["Statement deleted", "A side effect nobody verifies (an audit log, a cache invalidation)"],
              ["Equivalent mutant", "The change does not alter behaviour; mark and ignore"]
            ]),
            B.tip("Use branch coverage, not just line coverage, and treat it as a floor and a map of untested code, never as a target to game."),
            B.p("Trade-off: mutation runs multiply suite time by the number of mutants. Scope them to critical modules and changed files, run nightly, and use the surviving list as a backlog for sharper assertions."),
            B.quiz("test-beyond"),
            B.cue("<strong>Interview cue:</strong> \"Coverage tells me what executed; mutation score tells me what is actually specified\" shows you know why high coverage still ships bugs."),
            B.key("<strong>Coverage is a map, mutation score is a grade.</strong> Use branch coverage to find gaps and targeted mutation runs to prove the tests would notice a wrong answer.")
          ])
        ]
      }
    ]
  };
})();
