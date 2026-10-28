/* =====================================================================
   CHISEL · Design in the Small
   window.TRACKS.design — modules: solid / composition / shape
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* designCouplingMeter — how design choices change the cost of a change */
  var KNOBS = [
    { key: "di", label: "Dependencies injected (not constructed inside)", w: 22 },
    { key: "iface", label: "Depends on a narrow interface, not a concrete class", w: 18 },
    { key: "pure", label: "Business rules in pure functions", w: 22 },
    { key: "noGlobal", label: "No global or static mutable state", w: 16 },
    { key: "comp", label: "Composition instead of a deep inheritance chain", w: 12 },
    { key: "smallApi", label: "Small public surface (most members private)", w: 10 }
  ];
  Widgets.designCouplingMeter = function (mount) {
    K.shell(mount, "coupling", "Coupling meter",
      "An OrderService needs a new payment provider. Toggle the design properties the codebase has and see how many files the change touches, how hard the change is to test, and how risky it is. A teaching model with made-up weights.");
    var on = { di: false, iface: false, pure: false, noGlobal: false, comp: false, smallApi: false };
    var controls = h("div", { class: "widget-controls", style: "display:grid;gap:6px" });
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:8px" });
    var readout = h("div", { class: "w-readout" });
    KNOBS.forEach(function (k) {
      controls.appendChild(K.toggle(k.label, on[k.key], function (v) { on[k.key] = v; paint(); }));
    });
    function paint() {
      clear(stage); clear(readout);
      var score = 0;
      KNOBS.forEach(function (k) { if (on[k.key]) score += k.w; });
      var files = Math.max(1, Math.round(14 - score * 0.13));
      var setup = score >= 60 ? "construct with a fake" : score >= 30 ? "patch a few modules" : "needs a live sandbox account";
      var risk = score >= 70 ? "low" : score >= 40 ? "medium" : "high";
      var tone = score >= 70 ? "good" : score >= 40 ? "meh" : "bad";
      stage.appendChild(h("div", { style: "height:16px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);overflow:hidden" },
        h("div", { style: "height:100%;width:" + Math.max(3, score) + "%;background:" + (tone === "good" ? K.GOOD_BG : tone === "meh" ? K.MEH_BG : K.BAD_BG) })));
      var advice = score >= 70 ? "Swapping the provider is a new adapter plus one line of wiring." :
        score >= 40 ? "Doable, but some call sites know too much about the old provider." :
        "The old provider is woven through the code: expect a risky, sprawling change.";
      stage.appendChild(K.badge(advice, tone));
      readout.appendChild(ro("design score", score + " / 100"));
      readout.appendChild(ro("files touched", files));
      readout.appendChild(ro("test setup", setup));
      readout.appendChild(ro("change risk", risk));
    }
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(readout);
    paint();
  };

  /* designCoreShellSplitter — sort lines into functional core or imperative shell */
  Widgets.designCoreShellSplitter = function (mount) {
    K.choiceDrill(mount, {
      pill: "core / shell",
      title: "Core or shell?",
      desc: "A subscription renewal job, line by line. Put each responsibility in the pure functional core (decisions, calculations) or the imperative shell (I/O, time, side effects).",
      choices: ["Functional core", "Imperative shell"],
      items: [
        { prompt: "Read all subscriptions due today from the database.", answer: 1, why: "Database access is I/O. The shell fetches data and hands plain values to the core." },
        { prompt: "Decide whether a subscription should renew, be paused, or be cancelled, given its status, payment history and today's date (passed in).", answer: 0, why: "A pure decision on values, with the date as a parameter. It is trivially testable with no doubles." },
        { prompt: "Compute the prorated price for a mid-cycle plan change.", answer: 0, why: "Arithmetic on inputs produces an output. Pure and deterministic." },
        { prompt: "Call the payment provider to charge the card.", answer: 1, why: "A side effect against an external system. The core can return a 'charge this amount' instruction; the shell performs it." },
        { prompt: "Build the list of emails to send (recipient, template, variables) from the renewal decisions.", answer: 0, why: "Producing a description of effects is still pure. Only sending them belongs in the shell." },
        { prompt: "Read the current time.", answer: 1, why: "The clock is an input from the outside world. Read it once in the shell and pass it in, so the core stays deterministic." }
      ]
    });
  };

  /* designSemverDrill — which version bump does this change need? */
  Widgets.designSemverDrill = function (mount) {
    K.choiceDrill(mount, {
      pill: "semver",
      title: "Pick the version bump",
      desc: "You maintain a library at version 2.4.1. For each change, choose the semantic-versioning bump your consumers need to see.",
      choices: ["Patch (2.4.2)", "Minor (2.5.0)", "Major (3.0.0)"],
      items: [
        { prompt: "Fix a rounding bug so totals now match the documented behaviour.", answer: 0, why: "A backward-compatible bug fix is a patch. Callers relying on documented behaviour are unaffected." },
        { prompt: "Add an optional `currency` parameter with a default that preserves current behaviour.", answer: 1, why: "New, backward-compatible functionality is a minor bump. Existing calls work unchanged." },
        { prompt: "Rename `getTotal()` to `total()` and remove the old name.", answer: 2, why: "Removing a public name breaks callers, so it is major. Ship the new name in a minor first, deprecate the old one, then remove it in the next major." },
        { prompt: "Mark `legacyFormat()` as deprecated with a warning; it still works.", answer: 1, why: "Deprecation without removal is compatible, typically announced in a minor release with the planned removal version." },
        { prompt: "Change a function to throw instead of returning null when the item is missing.", answer: 2, why: "Callers checking for null will now crash. A changed error contract is a breaking change even if the signature looks the same." },
        { prompt: "Upgrade an internal dependency with no change to your public API or behaviour.", answer: 0, why: "Invisible to consumers, so a patch is enough \u2014 unless the dependency leaks through your API, in which case its breaking changes are yours too." }
      ]
    });
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "design-interfaces": {
      title: "APIs & dependencies checkpoint",
      sub: "Backward compatibility, deprecation, semver and dependency hygiene.",
      questions: [
        { q: "Which change to a JSON API response is usually backward compatible?", options: ["Adding a new optional field", "Removing a field", "Renaming a field", "Changing a field from number to string"], answer: 0,
          explain: "Well-behaved clients ignore unknown fields, so additions are safe. Removals, renames and type changes break existing readers." },
        { q: "What is Postel's robustness principle as applied to APIs?", options: ["Reject everything unexpected", "Never version an API", "Be conservative in what you send and tolerant in what you accept", "Send as much data as possible"], answer: 2,
          explain: "Tolerant readers ignore unknown fields and producers avoid surprising changes. Taken too far it hides bugs, so pair it with clear contracts and contract tests." },
        { q: "A good deprecation process includes…", options: ["Deleting the endpoint without notice", "A comment in the code only", "Renaming it silently", "Announcing it, emitting warnings or headers, measuring remaining usage, and removing it only after a stated date when usage is near zero"], answer: 3,
          explain: "Consumers need time and signal. Usage metrics tell you who still depends on it so you can help them migrate before removal." },
        { q: "What does a lockfile guarantee?", options: ["The newest versions", "The exact same resolved dependency versions on every install", "No vulnerabilities", "Smaller bundles"], answer: 1,
          explain: "Lockfiles pin the full resolved tree, so builds are reproducible. Ranges in the manifest express what you accept; the lockfile records what you got." },
        { q: "What is the main risk of rarely updating dependencies?", options: ["None", "Builds get faster", "Updates pile up into large, risky jumps across breaking changes, and security fixes arrive late", "Lockfiles break"], answer: 2,
          explain: "Small, frequent updates with automated PRs and good tests are cheap. Years-behind upgrades become projects of their own." },
        { q: "Before adding a new third-party dependency you should check…", options: ["Maintenance activity, licence, transitive dependencies, security history and whether a few lines of your own code would do", "Only the star count", "Nothing", "The logo"], answer: 0,
          explain: "Every dependency is code you ship and must keep updated. Small utilities are often cheaper to write than to depend on." }
      ]
    },
    "design-solid": {
      title: "SOLID with nuance checkpoint",
      sub: "What each principle protects against, and when it is overkill.",
      questions: [
        { q: "The single responsibility principle is best read as…", options: ["Each class has one method", "Each file has one function", "Classes should be small", "A module should have one reason to change, meaning one group of people or concern driving its changes"], answer: 3,
          explain: "SRP is about change, not size. Mixing pricing rules and PDF layout means two different stakeholders keep editing the same code." },
        { q: "The open-closed principle is most valuable when…", options: ["Writing any code", "A known axis of variation keeps growing, such as new payment methods every quarter", "The code never changes", "You have one implementation"], answer: 1,
          explain: "Designing an extension point pays off where change is frequent and predictable. Adding one speculatively everywhere is YAGNI." },
        { q: "Which is a classic Liskov substitution violation?", options: ["A subclass throws 'not supported' for a method its base type promises to support", "A subclass adds a method", "Using an interface", "Overriding toString"], answer: 0,
          explain: "Callers written against the base type break when a subtype refuses part of the contract. The usual fix is a different abstraction, not more type checks." },
        { q: "Interface segregation suggests…", options: ["One big interface per service", "No interfaces at all", "Clients should depend on narrow interfaces containing only what they use", "Interfaces must have one method"], answer: 2,
          explain: "A report generator that only reads orders should not depend on an interface that can also delete them. Narrow interfaces reduce coupling and make doubles simple." },
        { q: "Dependency inversion means…", options: ["Calling dependencies in reverse order", "Using a DI framework", "Avoiding dependencies", "High-level policy depends on abstractions it owns; low-level details implement them"], answer: 3,
          explain: "The domain defines the port it needs, and infrastructure adapts to it. This keeps business rules free of database or framework details." }
      ]
    },
    "design-composition": {
      title: "Composition & DI checkpoint",
      sub: "Composition over inheritance and dependency injection.",
      questions: [
        { q: "What is the 'fragile base class' problem?", options: ["Base classes are slow", "Changes to a base class silently break subclasses that relied on its internals", "Base classes cannot be tested", "Subclasses cannot override"], answer: 1,
          explain: "Inheritance couples subclasses to implementation details of the parent. Composition couples only to an interface, so internals can change safely." },
        { q: "When is inheritance still a good fit?", options: ["Always prefer it", "To share any two lines of code", "For a genuine is-a relationship with a stable base, or framework hooks designed for subclassing", "Never"], answer: 2,
          explain: "'Composition over inheritance' is a default, not a ban. Shallow, stable hierarchies and designed extension points are fine." },
        { q: "Which is the simplest form of dependency injection?", options: ["Passing collaborators as constructor or function parameters", "A DI container with annotations", "A global service locator", "Static factories"], answer: 0,
          explain: "Constructor injection needs no framework and makes dependencies visible in the signature. Containers help with wiring at scale but are optional." },
        { q: "What is the composition root?", options: ["The base class", "The root folder", "The database", "The one place near the program's entry point where concrete objects are created and wired together"], answer: 3,
          explain: "Keeping construction in one place means the rest of the code only receives dependencies. Swapping an implementation becomes a one-line change." },
        { q: "Why is a service locator often considered an anti-pattern?", options: ["It is slow", "It hides dependencies inside method bodies, so signatures lie and tests need global setup", "It uses interfaces", "It cannot be tested at all"], answer: 1,
          explain: "With a locator you cannot see what a class needs without reading all of it. Explicit parameters document dependencies and make tests straightforward." }
      ]
    },
    "design-shape": {
      title: "Shaping code checkpoint",
      sub: "Functional core, illegal states and YAGNI.",
      questions: [
        { q: "In 'functional core, imperative shell', the core…", options: ["Contains pure decision logic that takes values and returns values, with no I/O", "Does all database access", "Is written in a functional language", "Handles HTTP"], answer: 0,
          explain: "Pure logic is easy to test with plain examples and properties. The shell gathers inputs, calls the core, and performs the resulting effects." },
        { q: "How should the core get the current time?", options: ["Call the system clock directly", "Use a global variable", "Receive it as a parameter from the shell", "Guess"], answer: 2,
          explain: "Time is an input from the outside world. Passing it in keeps the core deterministic and makes date edge cases easy to test." },
        { q: "'Make illegal states unrepresentable' means…", options: ["Validate input in the UI", "Use more booleans", "Throw exceptions everywhere", "Model data so invalid combinations cannot be constructed, for example a union of distinct states instead of several optional fields"], answer: 3,
          explain: "If 'shipped' requires a tracking number, a Shipped variant that carries one beats two independent fields. The type system then rules out a whole class of bugs." },
        { q: "YAGNI warns against…", options: ["Writing tests", "Building flexibility for requirements you do not have yet", "Refactoring", "Naming things"], answer: 1,
          explain: "Speculative abstractions cost effort now and complexity forever, and often guess wrong. Simple code that is easy to change beats anticipated flexibility." },
        { q: "What usually makes YAGNI safe to follow?", options: ["Luck", "Long design phases", "Good tests and small, refactorable code, so adding flexibility later is cheap", "Avoiding change"], answer: 2,
          explain: "Postponing a design decision is only cheap if changing the code later is cheap. Test coverage and clean structure are what make that true." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.design = {
    id: "design",
    name: "Design in the Small",
    short: "DSGN",
    tagline: "Code that is easy to change next month",
    color: "#c4b5fd",
    blurb: "Apply SOLID with judgement rather than ritual, prefer composition over inheritance, inject dependencies without a framework, split logic into a functional core and an imperative shell, make illegal states unrepresentable, and resist speculative generality.",
    modules: [
      {
        id: "solid",
        name: "SOLID with Nuance",
        icon: "cube",
        lessons: [
          {
            id: "srp-ocp",
            title: "Single responsibility and open-closed",
            summary: "One reason to change, and extension points only where change actually happens.",
            minutes: 11,
            tags: ["solid", "srp", "ocp", "design"],
            blocks: [
              { t: "p", html: "SOLID is five heuristics, not five laws. Each protects against a specific kind of painful change. Applied everywhere by rote, they produce interface soup; applied where that pain is real, they make code pleasant to change." },
              { t: "h", text: "Single responsibility: one reason to change" },
              { t: "p", html: "The useful reading is about <strong>who asks for changes</strong>. If finance changes the tax rules and design changes the invoice layout, a class that does both gets edited for two unrelated reasons \u2014 and those edits collide." },
              { t: "code", lang: "python", code:
                "# Two reasons to change in one place\n" +
                "class Invoice:\n" +
                "    def total(self): ...          # finance rules\n" +
                "    def render_pdf(self): ...     # layout and branding\n\n" +
                "# Split by reason to change\n" +
                "class Invoice:\n" +
                "    def total(self): ...\n\n" +
                "def render_invoice_pdf(invoice: Invoice) -> bytes: ..."
              },
              { t: "h", text: "Open-closed: extend without editing \u2014 where it pays" },
              { t: "code", lang: "javascript", code:
                "// A switch that grows every quarter is the signal\n" +
                "const PAYMENT_HANDLERS = {\n" +
                "  card:   chargeCard,\n" +
                "  wallet: chargeWallet,\n" +
                "  bank:   chargeBankTransfer,   // new methods are additions, not edits\n" +
                "};\n" +
                "function pay(method, amount) {\n" +
                "  const handler = PAYMENT_HANDLERS[method];\n" +
                "  if (!handler) throw new Error(`Unsupported payment method: ${method}`);\n" +
                "  return handler(amount);\n" +
                "}"
              },
              { t: "note", variant: "trap", html: "Adding a strategy interface for a rule that has never changed is speculative generality. Wait until the second or third variant appears, then extract the extension point with tests in place." },
              { t: "note", variant: "key", html: "<strong>Split by reason to change; add extension points along axes that actually vary.</strong> SOLID is a response to real change pressure, not a checklist." }
            ]
          },
          {
            id: "lsp-isp-dip",
            title: "Substitution, narrow interfaces and dependency inversion",
            summary: "Keep subtypes honest, give clients only what they need, and let policy own its abstractions.",
            minutes: 12,
            tags: ["solid", "lsp", "isp", "dip", "interfaces"],
            blocks: [
              { t: "h", text: "Liskov substitution: subtypes keep the promise" },
              { t: "p", html: "Code written against a type must keep working with any subtype. The violation to watch for is a subtype that weakens the contract: throws \"not supported\", ignores an argument, or returns something callers cannot handle." },
              { t: "code", lang: "java", code:
                "interface Storage { void write(String key, byte[] data); byte[] read(String key); }\n\n" +
                "class ReadOnlyArchive implements Storage {\n" +
                "    public void write(String key, byte[] data) {\n" +
                "        throw new UnsupportedOperationException();   // breaks callers of Storage\n" +
                "    }\n" +
                "    public byte[] read(String key) { /* ... */ return new byte[0]; }\n" +
                "}\n" +
                "// Better: split into Reader and Writer; the archive implements only Reader."
              },
              { t: "h", text: "Interface segregation: depend on what you use" },
              { t: "p", html: "The read-only report job should depend on <code class='tok'>OrderReader</code>, not on a 20-method <code class='tok'>OrderRepository</code> that can also delete. Narrow interfaces mean smaller blast radius and simpler test doubles." },
              { t: "h", text: "Dependency inversion: policy owns the port" },
              { t: "table", headers: ["Without inversion", "With inversion"], rows: [
                ["Domain imports the database client", "Domain defines <code class='tok'>OrderReader</code>; the database adapter implements it"],
                ["Changing the DB edits business rules", "Changing the DB is a new adapter"],
                ["Tests need a database", "Tests pass an in-memory fake"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas treats ports-and-adapters and the GoF patterns these principles lead to in its <em>Low-Level Design</em> track." },
              { t: "quiz", id: "design-solid" },
              { t: "note", variant: "key", html: "<strong>Subtypes must keep the contract, clients should see only what they use, and policy should own its abstractions.</strong> All three reduce how far a change spreads." }
            ]
          }
        ]
      },
      {
        id: "composition",
        name: "Composition & Dependencies",
        icon: "plug",
        lessons: [
          {
            id: "composition",
            title: "Composition over inheritance",
            summary: "Build behaviour by combining small objects or functions, and keep inheritance for the cases that genuinely fit.",
            minutes: 10,
            tags: ["composition", "inheritance", "design"],
            blocks: [
              { t: "p", html: "Inheritance shares code by making a subclass depend on its parent's <em>implementation</em>. Composition shares behaviour by depending on another object's <em>interface</em>. The difference shows up the first time the parent changes." },
              { t: "code", lang: "python", code:
                "# Inheritance explosion: every combination needs a class\n" +
                "class Notifier: ...\n" +
                "class EmailNotifier(Notifier): ...\n" +
                "class RetryingEmailNotifier(EmailNotifier): ...\n" +
                "class RateLimitedRetryingEmailNotifier(RetryingEmailNotifier): ...\n\n" +
                "# Composition: small pieces, combined at the edge\n" +
                "notifier = RateLimited(Retrying(EmailSender(smtp), attempts=3), per_minute=60)"
              },
              { t: "compare",
                bad: { title: "Deep inheritance", items: ["Class per combination of features", "Subclasses break when the parent changes", "Behaviour fixed at compile time", "Hard to test one layer alone"] },
                good: { title: "Composition", items: ["Combine small wrappers or functions", "Each piece depends only on an interface", "Assemble different combinations at runtime", "Test each piece with a fake inner"] } },
              { t: "h", text: "When inheritance is fine" },
              { t: "ul", items: [
                "A true and stable is-a relationship, kept shallow (one or two levels).",
                "Framework extension points designed to be subclassed.",
                "Sealed hierarchies that model a closed set of variants (often better as a union type)."
              ] },
              { t: "note", variant: "key", html: "<strong>Compose behaviour from small pieces behind interfaces.</strong> Keep inheritance shallow and for genuine, stable is-a relationships." }
            ]
          },
          {
            id: "dependency-injection",
            title: "Dependency injection without the magic",
            summary: "Pass collaborators in, wire them in one place, and reach for a container only when wiring gets big.",
            minutes: 10,
            tags: ["dependency-injection", "testability", "composition-root"],
            blocks: [
              { t: "p", html: "Dependency injection just means <strong>a component receives its collaborators instead of creating them</strong>. No framework required. The payoff: you can see what a component needs from its signature, and tests can hand it fakes." },
              { t: "code", lang: "javascript", code:
                "// Hidden dependencies: hard to test, hard to change\n" +
                "class OrderService {\n" +
                "  placeOrder(cart) {\n" +
                "    const gateway = new LivePaymentGateway(process.env.PAYMENTS_URL);\n" +
                "    const now = new Date();\n" +
                "    // ...\n" +
                "  }\n" +
                "}\n\n" +
                "// Injected: explicit, swappable, testable\n" +
                "class OrderService {\n" +
                "  constructor({ gateway, clock, orders }) {\n" +
                "    Object.assign(this, { gateway, clock, orders });\n" +
                "  }\n" +
                "}\n\n" +
                "// Composition root (app entry point): the only place that knows concrete types\n" +
                "const service = new OrderService({\n" +
                "  gateway: new LivePaymentGateway(config.paymentsUrl),\n" +
                "  clock: systemClock,\n" +
                "  orders: new SqlOrderRepository(db),\n" +
                "});"
              },
              { t: "table", headers: ["Style", "Verdict"], rows: [
                ["Constructor injection", "Default: required dependencies, visible, immutable"],
                ["Parameter injection", "Great for functions and single-use collaborators (e.g. now)"],
                ["Setter injection", "Optional dependencies only; easy to forget"],
                ["Service locator / globals", "Avoid: hides dependencies, couples to global setup"],
                ["DI container", "Useful when the object graph is large; keep it at the root"]
              ] },
              { t: "widget", id: "designCouplingMeter" },
              { t: "note", variant: "warn", html: "Configuration such as URLs and credentials should arrive through the composition root from environment variables or a secret store \u2014 never hardcoded inside components, and never committed." },
              { t: "quiz", id: "design-composition" },
              { t: "note", variant: "key", html: "<strong>Receive collaborators; do not construct them.</strong> Wire concrete types in one composition root, and add a container only when the wiring gets genuinely large." }
            ]
          }
        ]
      },
      {
        id: "shape",
        name: "Shaping Code",
        icon: "diamond",
        lessons: [
          {
            id: "core-shell",
            title: "Functional core, imperative shell",
            summary: "Push decisions into pure functions and keep I/O at the edges \u2014 the single most testable architecture in the small.",
            minutes: 12,
            tags: ["functional-core", "imperative-shell", "pure-functions", "testability"],
            blocks: [
              { t: "p", html: "Most hard-to-test code mixes two things: <strong>deciding</strong> what should happen and <strong>doing</strong> it. Separate them. A pure <strong>core</strong> takes values and returns values (including descriptions of effects). A thin <strong>shell</strong> reads inputs, calls the core, and performs the effects." },
              { t: "diagram", id: "core-shell", caption: "The shell gathers inputs (DB, clock, HTTP), calls the pure core, and executes the decisions it returns." },
              { t: "code", lang: "python", code:
                "# CORE: pure, deterministic, no I/O\n" +
                "def renewal_decision(sub, today, failed_payments):\n" +
                "    if sub.cancelled_at is not None:\n" +
                "        return Skip()\n" +
                "    if failed_payments >= 3:\n" +
                "        return Pause(reason=\"payment_failures\")\n" +
                "    if sub.renews_on <= today:\n" +
                "        return Charge(amount=sub.plan.price, notify=sub.email)\n" +
                "    return Skip()\n\n" +
                "# SHELL: thin, mostly wiring\n" +
                "def run_renewals(db, payments, mailer, clock):\n" +
                "    today = clock.today()\n" +
                "    for sub in db.subscriptions_due(today):\n" +
                "        decision = renewal_decision(sub, today, db.failed_payments(sub.id))\n" +
                "        execute(decision, payments, mailer)"
              },
              { t: "widget", id: "designCoreShellSplitter" },
              { t: "note", variant: "tip", html: "Test the core exhaustively with plain examples and property tests. Test the shell with a few integration tests. You need far fewer mocks than in an interleaved design." },
              { t: "note", variant: "key", html: "<strong>Decide in a pure core, act in a thin shell.</strong> Pass time and data in, return decisions out, and keep I/O at the edges." }
            ]
          },
          {
            id: "illegal-states",
            title: "Make illegal states unrepresentable",
            summary: "Use types and data shapes so invalid combinations cannot be built in the first place.",
            minutes: 10,
            tags: ["types", "modelling", "value-objects", "unions"],
            blocks: [
              { t: "p", html: "Every combination of fields your data model allows, some code must handle. If half of those combinations are nonsense, you are writing defensive checks forever \u2014 or forgetting them. Model the domain so the nonsense cannot be constructed." },
              { t: "code", lang: "javascript", code:
                "// Representable nonsense: shipped with no tracking number? delivered but not shipped?\n" +
                "{ status: \"delivered\", shippedAt: null, trackingNo: null, deliveredAt: \"2026-04-02\" }\n\n" +
                "// One variant per state, each carrying exactly the data it needs\n" +
                "// { kind: \"pending\" }\n" +
                "// { kind: \"shipped\",   trackingNo, shippedAt }\n" +
                "// { kind: \"delivered\", trackingNo, shippedAt, deliveredAt }\n" +
                "function ship(order, trackingNo, at) {\n" +
                "  if (order.kind !== \"pending\") throw new Error(\"Only pending orders can ship\");\n" +
                "  return { kind: \"shipped\", trackingNo, shippedAt: at };\n" +
                "}"
              },
              { t: "table", headers: ["Technique", "Example"], rows: [
                ["Tagged union / sealed type", "One variant per lifecycle state"],
                ["Value object with validation in the constructor", "<code class='tok'>Email</code>, <code class='tok'>Money(amount, currency)</code>, <code class='tok'>Percentage</code>"],
                ["Non-empty collection type", "An order always has at least one line"],
                ["Enums instead of strings", "No typo'd status values"],
                ["Parse, don't validate", "Turn raw input into a trusted type once at the boundary"]
              ] },
              { t: "note", variant: "tip", html: "\"Parse, don't validate\": a validator returns true or false and you must remember to call it. A parser returns either a trusted type or an error, so downstream code cannot receive unchecked data." },
              { t: "note", variant: "key", html: "<strong>Shape data so invalid states cannot exist.</strong> One variant per state, value objects that validate themselves, and parsing at the boundary." }
            ]
          },
          {
            id: "yagni",
            title: "YAGNI, simplicity and the rule of three",
            summary: "Resisting speculative design, and knowing when an abstraction has finally earned its place.",
            minutes: 9,
            tags: ["yagni", "simplicity", "abstraction", "duplication"],
            blocks: [
              { t: "p", html: "\"You aren't gonna need it\" is not anti-design. It says: do not pay today for flexibility you are guessing you will need. The guess is often wrong, and the wrong abstraction is more expensive than duplication." },
              { t: "table", headers: ["Speculative design", "What it costs"], rows: [
                ["Plugin system with one plugin", "Indirection on every read, no payoff"],
                ["Config option nobody sets", "A branch to test and document forever"],
                ["Generic base class for two similar things", "Coupling that fights the third, different case"],
                ["Microservice for a module with one caller", "Network, deployment and versioning costs"]
              ] },
              { t: "h", text: "The rule of three" },
              { t: "p", html: "Write it once. The second time, notice the duplication and tolerate it. The third time, you have enough examples to see what actually varies \u2014 now extract the abstraction, with tests in place." },
              { t: "compare",
                bad: { title: "Premature abstraction", items: ["Built from one example", "Parameters for imagined cases", "Every new case bends it further", "Hard to delete"] },
                good: { title: "Earned abstraction", items: ["Extracted from three real cases", "Captures what actually varies", "New cases fit naturally", "Small enough to replace"] } },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas's <em>Design Patterns</em> module shows the abstractions worth recognising once real variation appears; this track is about deciding <em>when</em>." },
              { t: "quiz", id: "design-shape" },
              { t: "note", variant: "key", html: "<strong>Build for today's requirements in code that is easy to change tomorrow.</strong> Let abstractions emerge from real repetition, and prefer duplication to the wrong abstraction." }
            ]
          }
        ]
      },
      {
        id: "interfaces",
        name: "APIs & Dependencies",
        icon: "plug",
        lessons: [
          {
            id: "api-design",
            title: "Interface design and backward compatibility",
            summary: "Design APIs that are hard to misuse, evolve them without breaking callers, and deprecate on purpose.",
            minutes: 12,
            tags: ["api-design", "backward-compatibility", "deprecation", "versioning"],
            blocks: [
              { t: "p", html: "An interface \u2014 a function signature, a class, an HTTP endpoint, an event schema \u2014 is a promise. Once other code depends on it, every change is a negotiation. Good interface design makes the promise <strong>small, clear and easy to keep</strong>." },
              { t: "h", text: "Designing the promise" },
              { t: "ul", items: [
                "<strong>Hard to misuse:</strong> named parameters or option objects instead of five positional booleans; types that rule out invalid calls.",
                "<strong>Small surface:</strong> expose the minimum; everything public must be supported forever.",
                "<strong>Explicit errors:</strong> document what fails and how; error contracts are part of the API.",
                "<strong>Consistent:</strong> the same names, pagination, and error shapes everywhere."
              ] },
              { t: "table", headers: ["Change", "Compatible?", "Notes"], rows: [
                ["Add an optional field / parameter with a safe default", "Yes", "The normal way to evolve"],
                ["Add a new endpoint or method", "Yes", ""],
                ["Remove or rename a field, endpoint or method", "No", "Use expand, migrate, contract"],
                ["Make an optional field required", "No", "Old callers do not send it"],
                ["Change a type or unit (seconds to ms)", "No", "Add a new field with the new meaning"],
                ["Change error behaviour (null to exception)", "No", "Often overlooked"],
                ["Add a new enum value that clients must handle", "Risky", "Strict clients may reject it"]
              ] },
              { t: "h", text: "Deprecation as a process" },
              { t: "ol", items: [
                "Ship the replacement first.",
                "Announce: changelog, docs, and a runtime signal (warning log, <code class='tok'>Deprecation</code> and <code class='tok'>Sunset</code> response headers).",
                "Measure who still calls the old path; help the biggest users migrate.",
                "Remove after the announced date, when usage is near zero \u2014 in a major version for libraries."
              ] },
              { t: "note", variant: "tip", html: "Contract tests (see the Testing Strategy track) turn compatibility from a hope into a check that runs in the provider's CI." },
              { t: "note", variant: "key", html: "<strong>Keep the promise small and evolve it additively.</strong> Breaking changes go through expand, migrate, contract with announced, measured deprecation." }
            ]
          },
          {
            id: "dependency-semver",
            title: "Dependency management and semantic versioning",
            summary: "What version numbers promise, how lockfiles and ranges work, and how to keep dependencies healthy.",
            minutes: 11,
            tags: ["dependencies", "semver", "lockfiles", "supply-chain"],
            blocks: [
              { t: "p", html: "Most of the code you ship was written by someone else. Managing it well is a daily engineering skill: knowing what a version number promises, pinning what you build, and updating in small, safe steps." },
              { t: "table", headers: ["Part", "Bump when", "Consumers expect"], rows: [
                ["MAJOR (3.0.0)", "Incompatible API change", "Read the migration notes"],
                ["MINOR (2.5.0)", "Backward-compatible feature", "Safe upgrade"],
                ["PATCH (2.4.2)", "Backward-compatible fix", "Safe upgrade"],
                ["0.y.z", "Anything may change", "No stability promise"]
              ] },
              { t: "widget", id: "designSemverDrill" },
              { t: "h", text: "Ranges, lockfiles and updates" },
              { t: "ul", items: [
                "<strong>Manifest ranges</strong> (e.g. <code class='tok'>^2.4.1</code>) state what you accept; the <strong>lockfile</strong> records exactly what was resolved. Commit the lockfile for applications.",
                "<strong>Automated update PRs</strong> keep each upgrade small; good tests make merging them routine.",
                "<strong>Group and schedule</strong> low-risk patch updates; review majors individually.",
                "<strong>Audit</strong> for known vulnerabilities and licences in CI."
              ] },
              { t: "compare",
                bad: { title: "Dependency drift", items: ["Upgrades once a year", "Unpinned builds differ per machine", "Abandoned packages nobody noticed", "A transitive dependency for left-padding a string"] },
                good: { title: "Dependency hygiene", items: ["Small weekly update PRs", "Lockfile committed, CI installs from it", "Owner and health check for key dependencies", "A few lines of own code instead of a trivial package"] } },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers software composition analysis, SBOMs and supply-chain controls in its <em>AppSec &amp; Vulnerability Management</em> track." },
              { t: "quiz", id: "design-interfaces" },
              { t: "note", variant: "key", html: "<strong>Version numbers are promises; lockfiles are receipts.</strong> Pin what you build, update little and often, and treat every new dependency as code you now maintain." }
            ]
          }
        ]
      }
    ]
  };
})();
