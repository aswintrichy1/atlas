/* =====================================================================
   PIXEL · Testing & Quality
   window.TRACKS.test — modules: strategy / components / quality
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#818cf8";

  /* ---------- testMix: shape of a test suite ---------- */
  Widgets.testMix = function (mount) {
    var h = WK.h;
    WK.shell(mount, "suite", "Shape your test suite",
      "Pick a suite shape and see the trade-off between run time, flakiness and confidence that the app really works.");
    var SHAPES = {
      cone: { name: "Ice-cream cone", stat: false, unit: 50, integ: 30, e2e: 200 },
      pyramid: { name: "Pyramid", stat: true, unit: 800, integ: 150, e2e: 20 },
      trophy: { name: "Trophy", stat: true, unit: 200, integ: 400, e2e: 25 }
    };
    var pick = "trophy";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var s = SHAPES[pick];
      var seconds = (s.unit * 0.005 + s.integ * 0.06 + (s.e2e * 8) / 4);
      var pass = Math.pow(1 - 0.0001, s.unit) * Math.pow(1 - 0.0005, s.integ) * Math.pow(1 - 0.01, s.e2e);
      var flake = (1 - pass) * 100;
      var conf = (s.stat ? 10 : 0) + Math.min(25, s.unit / 40) + Math.min(40, s.integ / 10) + Math.min(25, s.e2e);
      WK.clear(stage);
      var layers = [["Static (types + lint)", s.stat ? 1 : 0, s.stat ? "on" : "off"], ["Unit", s.unit, s.unit], ["Integration", s.integ, s.integ], ["End-to-end", s.e2e, s.e2e]];
      var max = 800;
      layers.forEach(function (l) {
        var w = l[0].indexOf("Static") === 0 ? (l[1] ? 100 : 2) : Math.max(2, (l[1] / max) * 100);
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:150px 1fr 50px;gap:10px;align-items:center;margin-bottom:6px;" },
          h("span", { style: "font-size:0.84rem;color:var(--text);" }, l[0]),
          h("div", { style: "height:14px;border-radius:7px;background:var(--line);overflow:hidden;" }, h("div", { style: "height:100%;width:" + w + "%;" + WK.tint(ACC, 50) })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);text-align:right;" }, String(l[2]))));
      });
      var note = pick === "cone" ? "Most confidence comes from slow, flaky browser tests; CI is slow and red for no reason." :
        pick === "pyramid" ? "Fast and stable, but many unit tests check implementation details and miss integration bugs." :
        "Static checks catch typos for free, integration tests cover real user behaviour, and a few end-to-end tests guard critical journeys.";
      stage.appendChild(h("p", { style: "margin:8px 0 0;font-size:0.86rem;color:var(--text);" }, note));
      WK.readout(readout, [["CI time (4 workers)", Math.round(seconds) + " s"], ["chance of a flaky run", flake.toFixed(0) + "%"], ["confidence", Math.round(conf) + " / 100"]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["cone", "Ice-cream cone"], ["pyramid", "Pyramid"], ["trophy", "Trophy"]], 2, function (v) { pick = v; paint(); }, "Suite shape")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- testQueryPicker: choose the right query ---------- */
  Widgets.testQueryPicker = function (mount) {
    var h = WK.h;
    WK.shell(mount, "queries", "Pick the right Testing Library query",
      "Choose what you need to find, then the query you would use. Feedback follows the priority: query the way users perceive the page.");
    var Q = ["getByRole", "getByLabelText", "getByText", "findByRole", "queryByRole", "getByTestId"];
    var TARGETS = [
      { label: "The \"Save\" button", best: "getByRole", code: "screen.getByRole('button', { name: /save/i })",
        fb: { getByLabelText: "Buttons are named by their content, not by a label element.", getByText: "Works, but finds text rather than a button; role also checks it is really a button.", findByRole: "Only needed if the button appears asynchronously.", queryByRole: "Use query* only to assert absence.", getByTestId: "A last resort: users never see test ids." } },
      { label: "The email input with a visible label", best: "getByLabelText", code: "screen.getByLabelText(/work email/i)",
        fb: { getByRole: "Also excellent: getByRole('textbox', { name: /work email/i }).", getByText: "Finds the label text, not the input.", findByRole: "Not async; no need to wait.", queryByRole: "Only for asserting absence.", getByTestId: "Skips the label, so it would not catch a broken label association." }, alsoGood: ["getByRole"] },
      { label: "A success message that appears after saving", best: "findByRole", code: "await screen.findByRole('status')  // or findByText(/saved/i)",
        fb: { getByRole: "Fails immediately: the message is not there yet. Use find* to wait.", getByLabelText: "Messages are not labelled form controls.", getByText: "Synchronous; it will not wait for the async update.", queryByRole: "Returns null now; you need to wait for it to appear.", getByTestId: "Synchronous and invisible to users." } },
      { label: "Assert the error banner is NOT shown", best: "queryByRole", code: "expect(screen.queryByRole('alert')).not.toBeInTheDocument()",
        fb: { getByRole: "Throws when the element is missing, so it cannot assert absence cleanly.", getByLabelText: "Not a labelled control.", getByText: "Throws when missing.", findByRole: "Waits and then rejects; slow and wrong intent.", getByTestId: "Throws when missing." } },
      { label: "A canvas chart with no accessible role or text", best: "getByTestId", code: "screen.getByTestId('revenue-chart')",
        fb: { getByRole: "Nothing to match: the canvas exposes no role. Better still, give it role=\"img\" and a name, then query by role.", getByLabelText: "No label exists.", getByText: "No text inside a canvas.", findByRole: "Nothing to match.", queryByRole: "Returns null; not what you want." } }
    ];
    var ti = 0, qi = -1;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var qSeg;
    function paint() {
      var t = TARGETS[ti];
      WK.clear(stage);
      if (qi < 0) {
        stage.appendChild(h("p", { style: "margin:0;font-size:0.86rem;color:var(--text-dim);" }, "Choose a query above to get feedback."));
        WK.readout(readout, [["target", t.label], ["verdict", "—"]]);
        return;
      }
      var q = Q[qi];
      var good = q === t.best || (t.alsoGood && t.alsoGood.indexOf(q) >= 0);
      var msg = q === t.best ? "Best choice." : t.fb[q];
      stage.appendChild(h("div", { style: WK.tint(good ? WK.GOOD : WK.MID, 16) + "border-radius:10px;padding:10px 12px;" },
        h("div", { style: "font-weight:600;font-size:0.9rem;" }, (good ? "✓ " : "↺ ") + q),
        h("div", { style: "font-size:0.86rem;margin-top:4px;" }, msg)));
      stage.appendChild(h("pre", { style: "margin:10px 0 0;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface-solid);color:var(--text);font-family:var(--font-mono);font-size:0.8rem;white-space:pre-wrap;" }, t.code));
      WK.readout(readout, [["target", t.label], ["verdict", good ? "good" : "try again"], ["recommended", t.best]]);
    }
    function buildQ() {
      var seg = WK.segment(Q.map(function (q, i) { return [i, q]; }), -1, function (v) { qi = v; paint(); }, "Query");
      return seg;
    }
    var qRow = h("div", { class: "widget-controls" });
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.select(TARGETS.map(function (t, i) { return [String(i), t.label]; }), "0", function (v) {
        ti = Number(v); qi = -1;
        WK.clear(qRow); qSeg = buildQ(); qRow.appendChild(qSeg); paint();
      }, "Target element")));
    qSeg = buildQ();
    qRow.appendChild(qSeg);
    mount.appendChild(qRow);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "test-strategy": {
      title: "Test strategy checkpoint",
      sub: "What to test and at which level.",
      questions: [
        { q: "Which principle guides frontend testing most?", options: ["Test every private function", "The more tests resemble how users use the software, the more confidence they give", "Aim for 100% line coverage", "Snapshot everything"], answer: 1,
          explain: "Tests that interact through the UI like a user survive refactors and catch real bugs. Implementation-detail tests break on harmless changes." },
        { q: "In the testing trophy, which layer usually gets the most investment?", options: ["End-to-end", "Integration tests of components working together", "Snapshot tests", "Manual QA"], answer: 1,
          explain: "Integration tests balance speed and confidence: they render real component trees with mocked network boundaries." },
        { q: "What is a sensible role for end-to-end browser tests?", options: ["Cover every edge case", "Guard a handful of critical user journeys such as sign-up and checkout", "Replace unit tests", "Test CSS colours"], answer: 1,
          explain: "End-to-end tests are slow and more flaky, so spend them on the flows where breaking would hurt most." },
        { q: "What do TypeScript and lint rules contribute to a test strategy?", options: ["Nothing", "A cheap static layer that catches typos, wrong types and hook-rule violations before tests run", "They replace tests", "They only format code"], answer: 1,
          explain: "Static analysis is the base of the trophy: instant feedback on a whole class of mistakes." }
      ]
    },
    "test-components": {
      title: "Component & E2E testing checkpoint",
      sub: "Testing Library, network mocks and Playwright.",
      questions: [
        { q: "Which Testing Library query should you reach for first?", options: ["getByTestId", "getByRole with an accessible name", "container.querySelector", "getByClassName"], answer: 1,
          explain: "Role plus name matches how users and assistive tech find elements, and it doubles as an accessibility check." },
        { q: "A message appears after a fetch resolves. Which query waits for it?", options: ["getByText", "findByText (or findByRole)", "queryByText", "getAllByText"], answer: 1,
          explain: "find* queries return a promise that retries until the element appears or a timeout passes." },
        { q: "Why mock at the network level (for example with a request-interception library) instead of mocking your fetch hook?", options: ["It is faster to write", "Components, hooks and data-fetching logic all run for real; only the server is replaced", "Hooks cannot be mocked", "It avoids async code"], answer: 1,
          explain: "Network-level mocks keep the test realistic and let the same handlers serve tests, Storybook and local development." },
        { q: "Why prefer user-event over fireEvent?", options: ["It is shorter", "It simulates full interactions (focus, keydown, input, keyup, click) like a real user", "fireEvent is deprecated", "It skips React updates"], answer: 1,
          explain: "Realistic event sequences catch bugs that a single synthetic event would miss." },
        { q: "An end-to-end test uses fixed sleeps like waitForTimeout(3000). What is better?", options: ["Longer sleeps", "Web-first assertions that auto-wait for a condition, such as expecting a heading to be visible", "Retry the whole suite", "Run tests serially"], answer: 1,
          explain: "Fixed sleeps are both slow and flaky. Auto-waiting assertions wait exactly as long as needed." }
      ]
    },
    "test-quality": {
      title: "Quality tooling checkpoint",
      sub: "Storybook, linting and CI gates.",
      questions: [
        { q: "What makes a component story useful beyond documentation?", options: ["Nothing", "Each story is a reusable fixture for visual review, interaction tests and accessibility checks", "Stories replace unit tests completely", "Stories run only in production"], answer: 1,
          explain: "Stories capture states (loading, empty, error) once and can be tested in several ways." },
        { q: "Which lint rule set catches missing effect dependencies and conditional hooks?", options: ["Prettier", "The React hooks rules", "A CSS linter", "A commit-message linter"], answer: 1,
          explain: "The hooks lint rules enforce the rules of hooks and exhaustive dependencies." },
        { q: "What is a good pull-request quality gate order?", options: ["Deploy first, test later", "Type-check and lint, then unit and integration tests, then build and a few end-to-end tests on a preview", "Only end-to-end tests", "Manual review only"], answer: 1,
          explain: "Run cheap, fast checks first so failures surface quickly, then spend time on slower suites." },
        { q: "How should you treat a flaky test?", options: ["Ignore it", "Quarantine it, track it, and fix the root cause (usually timing or shared state)", "Delete all tests", "Retry forever"], answer: 1,
          explain: "Flaky tests train people to ignore red builds. Isolate them quickly and fix the cause." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.test = {
    id: "test",
    name: "Testing & Quality",
    short: "TEST",
    tagline: "Confidence that survives refactors",
    color: ACC,
    blurb: "Write tests that resemble how people use your app. Plan a suite with the testing trophy, test components with Testing Library and user events, mock at the network boundary, cover critical journeys with Playwright, and back it all with stories, lint rules and CI gates.",
    modules: [
      {
        id: "strategy",
        name: "Strategy",
        icon: "grid",
        lessons: [
          {
            id: "test-strategy",
            title: "A testing strategy for frontends",
            summary: "Static checks, unit, integration and end-to-end — and how much of each.",
            minutes: 10,
            tags: ["trophy", "pyramid", "confidence"],
            blocks: [
              { t: "p", html: "Every test buys <strong>confidence</strong> at a cost in <strong>time</strong> and <strong>maintenance</strong>. A good strategy spends most effort where confidence per minute is highest." },
              { t: "diagram", id: "testing-trophy", caption: "The testing trophy: a static base, a thin unit layer, a wide integration middle, and a small end-to-end top." },
              { t: "widget", id: "testMix" },
              { t: "table", headers: ["Layer", "Tools", "Tests"], rows: [
                ["Static", "TypeScript, lint rules", "Typos, types, rules of hooks"],
                ["Unit", "Vitest or Jest", "Pure functions, reducers, formatters"],
                ["Integration", "Testing Library + network mocks", "Components and hooks together, like a user"],
                ["End-to-end", "Playwright", "Critical journeys in a real browser"]
              ] },
              { t: "h", text: "Where each kind of logic gets tested" },
              { t: "table", headers: ["Logic", "Best level", "Example assertion"], rows: [
                ["Pure function, reducer, formatter", "Unit", "formatPrice(1999, 'EUR') returns the localized string"],
                ["Component with data, loading and error", "Integration", "Shows an alert when the API returns 500"],
                ["Form validation and submission", "Integration", "Typing an invalid email marks the field invalid and blocks submit"],
                ["Routing, auth redirect, checkout", "End-to-end", "A signed-out user is sent to login, then back"],
                ["Visual states of a design-system component", "Stories + visual diff", "Disabled button renders unchanged"]
              ] },
              { t: "note", variant: "trap", html: "Coverage percentage is a weak target. 90% coverage of implementation details gives less confidence than 60% coverage of real user behaviour." },
              { t: "quiz", id: "test-strategy" },
              { t: "note", variant: "key", html: "<strong>Test behaviour, not implementation.</strong> Lean on static checks and integration tests, and keep end-to-end tests for the journeys that must never break." }
            ]
          }
        ]
      },
      {
        id: "components",
        name: "Component & E2E Tests",
        icon: "cube",
        lessons: [
          {
            id: "rtl",
            title: "Component tests with Testing Library",
            summary: "Render, interact like a user, assert on what the user sees.",
            minutes: 11,
            tags: ["testing-library", "queries", "user-event"],
            blocks: [
              { t: "p", html: "Testing Library deliberately hides component internals. You find elements by <strong>role, label and text</strong>, interact through <strong>user events</strong>, and assert on the resulting UI." },
              { t: "code", lang: "javascript", code:
                "import { render, screen } from \"@testing-library/react\";\n" +
                "import userEvent from \"@testing-library/user-event\";\n\n" +
                "test(\"adds a todo\", async () => {\n" +
                "  const user = userEvent.setup();\n" +
                "  render(<TodoApp />);\n" +
                "  await user.type(screen.getByRole(\"textbox\", { name: /new todo/i }), \"Write tests\");\n" +
                "  await user.click(screen.getByRole(\"button\", { name: /add/i }));\n" +
                "  expect(screen.getByRole(\"listitem\")).toHaveTextContent(\"Write tests\");\n" +
                "});" },
              { t: "widget", id: "testQueryPicker" },
              { t: "table", headers: ["Variant", "No match", "Async", "Use for"], rows: [
                ["getBy…", "Throws", "No", "Elements that should be there now"],
                ["queryBy…", "Returns null", "No", "Asserting absence"],
                ["findBy…", "Rejects after timeout", "Yes", "Elements that appear later"]
              ] },
              { t: "h", text: "A custom render with providers" },
              { t: "code", lang: "javascript", code:
                "// test-utils.tsx: every test gets fresh providers, no shared cache\n" +
                "export function renderWithProviders(ui, { route = \"/\" } = {}) {\n" +
                "  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });\n" +
                "  const user = userEvent.setup();\n" +
                "  const result = render(\n" +
                "    <QueryClientProvider client={client}>\n" +
                "      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>\n" +
                "    </QueryClientProvider>\n" +
                "  );\n" +
                "  return { user, ...result };\n" +
                "}" },
              { t: "table", headers: ["Async pitfall", "Symptom", "Fix"], rows: [
                ["Asserting before data arrives", "Passes locally, fails in CI", "await findBy… or waitFor around the assertion"],
                ["Side effects inside waitFor", "Clicks run many times", "Only assertions inside waitFor; act outside it"],
                ["Forgetting to await user events", "act() warnings, flaky state", "Always <code class='tok'>await user.click(…)</code>"],
                ["Retries on failing queries", "Error-state tests time out", "Disable retries in the test query client"],
                ["Fake timers left on", "Later tests hang", "Restore real timers in afterEach"]
              ] },
              { t: "note", variant: "trap", html: "Asserting on component state, hook internals or CSS class names couples tests to implementation, so harmless refactors turn the suite red." },
              { t: "note", variant: "key", html: "<strong>Query by role and name, act with user-event, assert on visible output.</strong> If a user cannot find it, your test should not either." }
            ]
          },
          {
            id: "mocking-network",
            title: "Mocking the network, not your code",
            summary: "Intercept requests at the boundary so real components, hooks and caches run in tests.",
            minutes: 9,
            tags: ["mocking", "network", "fixtures"],
            blocks: [
              { t: "p", html: "Mocking your own hooks or modules tests a fiction. Intercepting HTTP requests replaces only the server, so everything you ship actually runs." },
              { t: "code", lang: "javascript", code:
                "// handlers shared by tests, stories and local dev\n" +
                "export const handlers = [\n" +
                "  http.get(\"/api/projects\", () => HttpResponse.json([{ id: 1, name: \"Atlas\" }])),\n" +
                "];\n\n" +
                "test(\"shows an error when loading fails\", async () => {\n" +
                "  server.use(http.get(\"/api/projects\", () => new HttpResponse(null, { status: 500 })));\n" +
                "  renderWithClient(<Projects />);\n" +
                "  expect(await screen.findByRole(\"alert\")).toHaveTextContent(/could not load/i);\n" +
                "});" },
              { t: "ul", items: [
                "Give each test a fresh query client so cache state never leaks between tests.",
                "Test the unhappy paths: 500s, empty lists, slow responses, validation errors.",
                "Use fake timers for debounce and polling, and always restore them.",
                "Build fixtures with factory functions so each test states only what matters."
              ] },
              { t: "note", variant: "tip", html: "Generate request handlers and types from the API schema so mocks fail to compile when the contract changes." },
              { t: "note", variant: "key", html: "<strong>Mock at the network boundary.</strong> Real components, hooks and caches run; only the server is fake, and error paths get tested too." }
            ]
          },
          {
            id: "playwright-e2e",
            title: "End-to-end tests with Playwright",
            summary: "A few reliable browser tests for the journeys that matter most.",
            minutes: 10,
            tags: ["playwright", "e2e", "flakiness"],
            blocks: [
              { t: "p", html: "End-to-end tests drive a real browser against a running app. They catch what nothing else can — routing, auth, real network, browser quirks — at the price of speed." },
              { t: "code", lang: "javascript", code:
                "import { test, expect } from \"@playwright/test\";\n\n" +
                "test(\"checkout happy path\", async ({ page }) => {\n" +
                "  await page.goto(\"/products/trail-shoe\");\n" +
                "  await page.getByRole(\"button\", { name: \"Add to cart\" }).click();\n" +
                "  await page.getByRole(\"link\", { name: /cart/i }).click();\n" +
                "  await page.getByLabel(\"Card number\").fill(process.env.TEST_CARD_NUMBER ?? \"\");\n" +
                "  await page.getByRole(\"button\", { name: \"Pay\" }).click();\n" +
                "  await expect(page.getByRole(\"heading\", { name: /order confirmed/i })).toBeVisible();\n" +
                "});" },
              { t: "table", headers: ["Flake source", "Fix"], rows: [
                ["Fixed sleeps", "Auto-waiting web-first assertions"],
                ["Shared test accounts and data", "Seed isolated data per test"],
                ["CSS selectors tied to markup", "Role and label locators"],
                ["Third-party services", "Stub at the network layer or use sandboxes"],
                ["Order-dependent tests", "Each test sets up its own state"]
              ] },
              { t: "code", lang: "javascript", code:
                "// log in once, reuse the session in every test\n" +
                "setup(\"authenticate\", async ({ page }) => {\n" +
                "  await page.goto(\"/login\");\n" +
                "  await page.getByLabel(\"Email\").fill(process.env.E2E_USER ?? \"\");\n" +
                "  await page.getByLabel(\"Password\").fill(process.env.E2E_PASSWORD ?? \"\");\n" +
                "  await page.getByRole(\"button\", { name: \"Sign in\" }).click();\n" +
                "  await page.context().storageState({ path: \".auth/user.json\" });\n" +
                "});\n\n" +
                "// stub a flaky third party at the network layer\n" +
                "await page.route(\"**/recommendations*\", (route) =>\n" +
                "  route.fulfill({ json: { items: [] } }));" },
              { t: "ul", items: [
                "Run against a preview deployment per pull request, sharded across workers.",
                "Record traces on first retry so failures can be replayed step by step.",
                "Add an accessibility scan to key pages inside the same tests.",
                "Keep the session file out of version control."
              ] },
              { t: "note", variant: "warn", html: "Read test card numbers and credentials from CI secrets or environment variables, never commit them into test files." },
              { t: "quiz", id: "test-components" },
              { t: "note", variant: "key", html: "<strong>Few, focused, isolated end-to-end tests.</strong> Use role locators and auto-waiting assertions, seed data per test, and keep secrets in the environment." }
            ]
          }
        ]
      },
      {
        id: "quality",
        name: "Quality Tooling",
        icon: "broom",
        lessons: [
          {
            id: "storybook-linting",
            title: "Stories, linting and CI gates",
            summary: "Component states as fixtures, rules as guardrails, and a pipeline that fails fast.",
            minutes: 10,
            tags: ["storybook", "eslint", "ci", "visual-regression"],
            blocks: [
              { t: "p", html: "Quality tooling turns team agreements into automation. Stories pin down every visual state; lint rules encode the mistakes you never want to review again; CI enforces both." },
              { t: "code", lang: "javascript", code:
                "// Button.stories.tsx — each story is a fixture\n" +
                "export default { component: Button };\n" +
                "export const Primary = { args: { variant: \"primary\", children: \"Save\" } };\n" +
                "export const Loading = { args: { loading: true, children: \"Saving…\" } };\n" +
                "export const Disabled = { args: { disabled: true, children: \"Save\" } };" },
              { t: "table", headers: ["Gate", "Catches", "Speed"], rows: [
                ["Type-check", "Wrong props, nulls, API drift", "Seconds"],
                ["Lint (hooks, accessibility, imports)", "Rule violations, missing deps, unlabeled controls", "Seconds"],
                ["Unit + integration", "Behaviour regressions", "Under a few minutes"],
                ["Visual regression on stories", "Unintended UI changes", "Minutes"],
                ["End-to-end on a preview deploy", "Broken journeys", "Minutes"]
              ] },
              { t: "ul", items: [
                "Format automatically on commit so reviews never discuss whitespace.",
                "Run accessibility checks against every story.",
                "Quarantine flaky tests quickly and track them to zero.",
                "Make the main branch protected: all gates green before merge."
              ] },
              { t: "quiz", id: "test-quality" },
              { t: "note", variant: "key", html: "<strong>Automate agreements and fail fast.</strong> Cheap static gates first, behaviour tests next, visual and end-to-end checks on a preview before merge." }
            ]
          }
        ]
      }
    ]
  };
})();
