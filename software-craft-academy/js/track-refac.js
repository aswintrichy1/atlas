/* =====================================================================
   CHISEL · Refactoring & Legacy Code
   window.TRACKS.refac — modules: smells / legacy / scale
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* refacStepper — walk a refactoring one green step at a time */
  var STEPS = [
    { move: "Starting point", note: "One function computes shipping with nested conditionals and magic numbers. Before touching it, a characterization test pins today's outputs for every region and weight band.",
      loc: 16, branches: 6,
      code: "function shipping(o) {\n  let c = 0;\n  if (o.country === \"US\") {\n    if (o.weight < 1) c = 5;\n    else if (o.weight < 5) c = 9;\n    else c = 15;\n  } else if (o.country === \"CA\") {\n    if (o.weight < 1) c = 8;\n    else c = 14;\n  } else {\n    c = 25;\n  }\n  if (o.express) c = c * 2;\n  return c;\n}" },
    { move: "Rename variables", note: "Rename `o` to `order` and `c` to `cost`. A pure rename is the safest move there is: behaviour cannot change, so tests stay green.",
      loc: 16, branches: 6,
      code: "function shipping(order) {\n  let cost = 0;\n  if (order.country === \"US\") {\n    if (order.weight < 1) cost = 5;\n    else if (order.weight < 5) cost = 9;\n    else cost = 15;\n  } else if (order.country === \"CA\") {\n    if (order.weight < 1) cost = 8;\n    else cost = 14;\n  } else {\n    cost = 25;\n  }\n  if (order.express) cost = cost * 2;\n  return cost;\n}" },
    { move: "Extract function", note: "Pull the region logic into `baseRate(order)`. The express rule stays behind, now visibly separate from the rate table.",
      loc: 17, branches: 6,
      code: "function shipping(order) {\n  const cost = baseRate(order);\n  return order.express ? cost * 2 : cost;\n}\n\nfunction baseRate(order) {\n  if (order.country === \"US\") {\n    if (order.weight < 1) return 5;\n    if (order.weight < 5) return 9;\n    return 15;\n  }\n  if (order.country === \"CA\") {\n    return order.weight < 1 ? 8 : 14;\n  }\n  return 25;\n}" },
    { move: "Replace conditional with table", note: "The nested ifs are really data: weight bands per country. Encode them as a table and a tiny lookup. Run the characterization test \u2014 still green.",
      loc: 15, branches: 3,
      code: "const RATE_BANDS = {\n  US: [[1, 5], [5, 9], [Infinity, 15]],\n  CA: [[1, 8], [Infinity, 14]],\n};\nconst INTERNATIONAL_RATE = 25;\n\nfunction baseRate(order) {\n  const bands = RATE_BANDS[order.country];\n  if (!bands) return INTERNATIONAL_RATE;\n  const [, rate] = bands.find(([maxKg]) => order.weight < maxKg);\n  return rate;\n}" },
    { move: "Name the magic number", note: "The `* 2` for express becomes `EXPRESS_MULTIPLIER`. Now a product manager can read the pricing rules without reading control flow.",
      loc: 15, branches: 3,
      code: "const EXPRESS_MULTIPLIER = 2;\n\nfunction shipping(order) {\n  const cost = baseRate(order);\n  return order.express ? cost * EXPRESS_MULTIPLIER : cost;\n}" },
    { move: "Add the new behaviour", note: "Only now add the feature that started all this: a Mexico rate band. It is a one-line data change instead of another nested branch, and it gets its own new test.",
      loc: 16, branches: 3,
      code: "const RATE_BANDS = {\n  US: [[1, 5], [5, 9], [Infinity, 15]],\n  CA: [[1, 8], [Infinity, 14]],\n  MX: [[2, 10], [Infinity, 18]],   // new: one line of data\n};" }
  ];
  Widgets.refacStepper = function (mount) {
    K.shell(mount, "step-through", "Refactoring step-through",
      "Make the change easy, then make the easy change. Step through six small moves; after every one the test suite stays green, so you could stop and ship at any step.");
    var i = 0;
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:10px" });
    var readout = h("div", { class: "w-readout" });
    var prev = K.btn("\u2190 Previous", function () { if (i > 0) { i--; paint(); } }, "ghost");
    var next = K.btn("Next step \u2192", function () { if (i < STEPS.length - 1) { i++; paint(); } }, "primary");
    var reset = K.btn("Restart", function () { i = 0; paint(); }, "ghost");
    controls.appendChild(prev); controls.appendChild(next); controls.appendChild(reset);
    function paint() {
      var s = STEPS[i];
      clear(stage); clear(readout);
      stage.appendChild(h("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" },
        K.badge("step " + (i + 1) + " of " + STEPS.length, "meh"), K.badge("tests: green", "good"),
        h("strong", { style: "color:var(--text)" }, s.move)));
      stage.appendChild(K.para(s.note));
      stage.appendChild(K.mono(s.code));
      prev.disabled = i === 0;
      next.disabled = i === STEPS.length - 1;
      readout.appendChild(ro("step", (i + 1) + "/" + STEPS.length));
      readout.appendChild(ro("move", s.move));
      readout.appendChild(ro("branches", s.branches));
      readout.appendChild(ro("lines shown", s.loc));
      readout.appendChild(ro("behaviour changed", i === STEPS.length - 1 ? "yes (new feature)" : "no"));
    }
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(readout);
    paint();
  };

  /* refacSeamPicker — match the hard-to-test situation with a technique */
  Widgets.refacSeamPicker = function (mount) {
    K.choiceDrill(mount, {
      pill: "seams",
      title: "Pick the seam",
      desc: "Each scenario is untested legacy code you need to change today. Choose the least risky technique to get the change under test.",
      choices: ["Sprout method", "Wrap method", "Extract interface", "Parameterize constructor"],
      items: [
        { prompt: "A 600-line method needs one new rule: skip discounts for wholesale accounts. The method is impossible to instantiate in a test.", answer: 0,
          why: "Write the new rule as a fresh, fully tested method and call it from one line inside the old code. You avoid restructuring code you cannot yet test." },
        { prompt: "Every call to sendInvoice() must now also write an audit record, and you must not disturb the existing logic.", answer: 1,
          why: "Rename the old method, create a new one with the original name that calls the audit step and then the old body. The addition is isolated and testable." },
        { prompt: "A class news up a concrete PaymentGateway that calls a real bank. Your test needs to observe the charge without hitting the network.", answer: 2,
          why: "Introduce an interface the class depends on, implemented by the real gateway, so a test can supply a fake. This is an object seam." },
        { prompt: "A ReportService creates its own Clock and Database inside the constructor, so tests cannot control time or data.", answer: 3,
          why: "Add a constructor that accepts the collaborators and keep the old one delegating with the real defaults. Existing callers do not change; tests pass fakes." },
        { prompt: "A new tax calculation must be added to a deeply nested loop in a function that also writes files.", answer: 0,
          why: "Sprout the calculation as a pure function with its own tests and call it from the loop. The file-writing tangle stays untouched for now." }
      ]
    });
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "refac-smells": {
      title: "Smells & safe steps checkpoint",
      sub: "Code smells, green-to-green refactoring and parallel change.",
      questions: [
        { q: "What is the defining property of a refactoring?", options: ["It changes structure without changing observable behaviour", "It makes code faster", "It removes tests", "It adds a feature"], answer: 0,
          explain: "Refactoring is behaviour-preserving restructuring. Mixing it with behaviour change makes both harder to review and turns every test failure into a mystery." },
        { q: "You are halfway through a refactoring and a test goes red. What is the safest move?", options: ["Push through and fix it at the end", "Delete the test", "Revert to the last green state and take a smaller step", "Comment out the assertion"], answer: 2,
          explain: "Small steps are only safe if you go back to green quickly. Reverting a two-minute step is cheap; debugging a tangle of ten half-done steps is not." },
        { q: "Which smell is 'shotgun surgery'?", options: ["One class that does everything", "A method with too many parameters", "Commented-out code", "A single logical change requires small edits in many classes"], answer: 3,
          explain: "When one concept is smeared across many places, every change becomes a scavenger hunt. The usual fix is to move the pieces together." },
        { q: "Renaming a widely used public API field without breaking clients is best done with…", options: ["A big-bang rename on one Friday", "Parallel change: add the new field, migrate clients, then remove the old one", "A comment asking clients to update", "Changing it in the database only"], answer: 1,
          explain: "Expand, migrate, contract lets old and new coexist so every step is deployable and reversible. The removal happens only after nothing reads the old field." },
        { q: "Feature envy describes a method that…", options: ["Is called too often", "Has no tests", "Uses another object's data more than its own", "Was copied from another project"], answer: 2,
          explain: "If a method keeps reaching into another object's fields, the behaviour probably belongs on that object. Moving it raises cohesion." },
        { q: "Why separate refactoring commits from behaviour-change commits?", options: ["Reviewers can verify the refactor is behaviour-neutral and focus judgement on the real change", "Git requires it", "It makes history longer", "To avoid CI"], answer: 0,
          explain: "A pure refactor commit can be reviewed quickly with tests as evidence. Mixed commits force the reviewer to separate the two mentally, which is where bugs slip through." }
      ]
    },
    "refac-legacy": {
      title: "Legacy code checkpoint",
      sub: "The change algorithm, seams and characterization tests.",
      questions: [
        { q: "A useful working definition of legacy code is…", options: ["Code older than five years", "Code in an old language", "Code written by someone else", "Code without tests that you need to change"], answer: 3,
          explain: "Age does not make code hard to change; lack of a safety net does. Without tests, every change is a gamble, which is the real problem to solve." },
        { q: "What does a characterization test assert?", options: ["What the code should do according to the spec", "What the code currently does, even if that looks wrong", "That the code is fast", "That the code has no bugs"], answer: 1,
          explain: "It pins current behaviour so you notice any change while refactoring. Suspicious behaviour gets a note or a ticket, not a silent fix in the middle of a refactor." },
        { q: "What is a seam?", options: ["A place where you can change behaviour without editing the code at that point", "A merge conflict", "A database join", "A comment marker"], answer: 0,
          explain: "Seams let a test substitute a collaborator: an interface parameter, a constructor argument, a config value. Finding or creating one is usually the first step to testing legacy code." },
        { q: "Approval (golden master) testing works by…", options: ["Asking a manager to approve each release", "Running tests in production", "Recording a large output once, reviewing it, and failing when future output differs", "Mocking every dependency"], answer: 2,
          explain: "It captures broad behaviour quickly when writing precise assertions would take days. The catch is noisy diffs if the output contains timestamps or random ids, so scrub those first." },
        { q: "In the legacy change algorithm, what comes right before writing tests?", options: ["Deploying", "Rewriting the module", "Deleting dead code", "Finding test points and breaking the dependencies that block them"], answer: 3,
          explain: "You identify where to observe behaviour, then make the minimal, careful edits needed to get that code into a test harness. Only then do you change it with confidence." }
      ]
    },
    "refac-scale": {
      title: "Refactoring at scale checkpoint",
      sub: "Strangler fig, branch by abstraction, flags and codemods.",
      questions: [
        { q: "What makes the strangler fig approach safer than a full rewrite?", options: ["It is faster to code", "Traffic moves to the new system incrementally, so each step is small, observable and reversible", "It needs no tests", "It avoids a facade"], answer: 1,
          explain: "A rewrite delivers nothing until the end and often never finishes. Strangling moves one capability at a time behind a facade, with real traffic validating each step." },
        { q: "Branch by abstraction replaces a component by…", options: ["Creating a long-lived Git branch", "Copying the repo", "Introducing an abstraction over the old component, building the new one behind it, switching callers, then removing the old", "Forking the library"], answer: 2,
          explain: "All the work happens on main behind an interface, so there is no long-lived branch to merge. Each step ships and can be rolled back." },
        { q: "What is a codemod?", options: ["An automated, syntax-aware transformation applied across many files", "A code review bot", "A coding standard", "A database migration"], answer: 0,
          explain: "Codemods operate on the syntax tree to make the same mechanical change everywhere, such as renaming an API. They make large refactors consistent and reviewable as a script plus its output." },
        { q: "Why must release flags used during a migration eventually be deleted?", options: ["Flags slow down the CPU", "Auditors forbid them", "They break Git", "Each stale flag doubles the paths to reason about and becomes a hidden configuration risk"], answer: 3,
          explain: "Temporary flags turn into permanent branches in logic. Give each one an owner and an expiry, and remove it once the rollout is complete." },
        { q: "During a strangler migration, how do you know a legacy route can be deleted?", options: ["The new code compiles", "Monitoring shows no traffic reaches it and the new path has run cleanly for an agreed period", "The team is tired of it", "It is the oldest code"], answer: 1,
          explain: "Deletion is the payoff, but only evidence justifies it. Zero traffic plus a stable period on the new path is the signal that removal is safe." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.refac = {
    id: "refac",
    name: "Refactoring & Legacy Code",
    short: "REFAC",
    tagline: "Change code you are afraid of, safely",
    color: "#f4845f",
    blurb: "Read code smells for what they predict, refactor in tiny steps that keep the tests green, get untested legacy code under test with characterization tests and seams, and migrate whole systems with the strangler fig, branch by abstraction and codemods.",
    modules: [
      {
        id: "smells",
        name: "Smells & Safe Steps",
        icon: "broom",
        lessons: [
          {
            id: "code-smells",
            title: "Code smells and when they matter",
            summary: "A working catalogue of smells, what each one predicts about future change, and when to leave it alone.",
            minutes: 10,
            tags: ["smells", "refactoring", "design"],
            blocks: [
              { t: "p", html: "A code smell is not a bug. It is a <strong>prediction</strong>: this shape of code tends to make certain future changes expensive or risky. That framing matters, because it tells you when a smell is worth fixing \u2014 when the change it predicts is the change you are about to make." },
              { t: "table", headers: ["Smell", "What it looks like", "What it predicts", "Typical move"], rows: [
                ["Long function", "Scroll to read one function", "Every change risks unrelated paths", "Extract function"],
                ["Large class", "Dozens of fields, several responsibilities", "Merge conflicts, unclear ownership", "Extract class"],
                ["Duplicated logic", "Same rule in three places", "Fix it in one, forget the other two", "Extract and reuse \u2014 if they change together"],
                ["Shotgun surgery", "One change touches ten files", "Missed spots, slow changes", "Move related pieces together"],
                ["Divergent change", "One class edited for unrelated reasons", "Conflicts between teams", "Split by reason to change"],
                ["Feature envy", "Method mostly uses another object's data", "Rules scattered away from data", "Move method"],
                ["Primitive obsession", "Strings and floats for money, ids, emails", "Validation repeated or forgotten", "Introduce value object"],
                ["Long parameter list", "Seven positional arguments", "Misordered calls, flag arguments", "Parameter object"],
                ["Speculative generality", "Hooks and options nobody uses", "Complexity with no payoff", "Inline, delete"]
              ] },
              { t: "h", text: "When to leave a smell alone" },
              { t: "ul", items: [
                "The code is stable and nobody needs to change it \u2014 smells in untouched code cost nothing today.",
                "You are not about to touch that area; fix smells on the path of your current change (the 'campsite rule'), not everywhere.",
                "The 'duplication' is coincidental: two rules that look alike but belong to different owners."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"every time we change X we also have to change Y and Z\", \"nobody wants to touch this file\", \"we fixed it but the bug came back somewhere else\" \u2014 these are smells described in human words." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Many smell fixes end in a classic design pattern (strategy, state, template method). The Blueprint atlas catalogues those in its <em>Low-Level Design \u203a Design Patterns</em> module; here we focus on getting there safely." },
              { t: "note", variant: "key", html: "<strong>A smell is a forecast, not a verdict.</strong> Fix the smells that stand between you and the change you are making now, and leave stable code in peace." }
            ]
          },
          {
            id: "safe-steps",
            title: "Safe refactoring: tiny steps, always green",
            summary: "The rhythm that makes refactoring boring and safe: test, small move, test, commit.",
            minutes: 11,
            tags: ["refactoring", "tdd", "small-steps"],
            blocks: [
              { t: "p", html: "Refactoring is safe for exactly one reason: you can tell at every moment whether behaviour changed. That requires two things \u2014 <strong>tests that cover the code you are moving</strong>, and <strong>steps small enough</strong> that a red test points straight at the cause." },
              { t: "h", text: "The loop" },
              { t: "ol", items: [
                "Make sure the tests are green before you start. If there are none, write characterization tests first.",
                "Make one mechanical move: rename, extract, inline, move, introduce parameter.",
                "Run the tests. Green? Commit. Red? Revert, then take a smaller step.",
                "Repeat. Ship whenever you like \u2014 every commit is a working system."
              ] },
              { t: "widget", id: "refacStepper" },
              { t: "h", text: "The moves you use most" },
              { t: "table", headers: ["Move", "When", "Risk if done by hand"], rows: [
                ["Rename", "A name no longer fits", "Very low with editor support"],
                ["Extract function / variable", "A block deserves a name", "Low; watch captured variables"],
                ["Inline", "An indirection adds nothing", "Low"],
                ["Move function / field", "Behaviour lives far from its data", "Medium; callers in other modules"],
                ["Introduce parameter object", "Long or repeating parameter lists", "Medium"],
                ["Replace conditional with polymorphism or a table", "A switch that grows with every feature", "Medium; needs good tests"]
              ] },
              { t: "note", variant: "tip", html: "\"Make the change easy, then make the easy change.\" Refactor first in commits of their own, then add the feature in a separate commit. Reviewers can check the refactor is neutral and spend their attention on the behaviour change." },
              { t: "compare",
                bad: { title: "Big-bang refactor", items: ["Two days on a branch", "Tests red for hours", "One huge PR nobody can review", "Conflicts with every other branch"] },
                good: { title: "Green steps", items: ["Dozens of small commits", "Tests green after each", "Merge daily", "Stop at any point with a working system"] } },
              { t: "note", variant: "key", html: "<strong>Never be more than one small step from green.</strong> Test, make one mechanical move, test, commit \u2014 and revert instead of debugging when a step goes red." }
            ]
          },
          {
            id: "parallel-change",
            title: "Parallel change: expand, migrate, contract",
            summary: "Changing an interface that other code (or other teams) depend on, without a breaking release.",
            minutes: 9,
            tags: ["parallel-change", "expand-contract", "migrations", "apis"],
            blocks: [
              { t: "p", html: "Inside one function you can rename freely. Across a public API, a database column or a message schema you cannot, because callers you do not control will break. <strong>Parallel change</strong> splits one breaking change into three non-breaking ones." },
              { t: "table", headers: ["Phase", "What you do", "State of the world"], rows: [
                ["Expand", "Add the new form alongside the old (new column, new field, new method)", "Both work; old callers unaffected"],
                ["Migrate", "Move callers and data to the new form, one at a time; dual-write if needed", "Usage shifts; monitor the old path"],
                ["Contract", "Remove the old form once nothing uses it", "Only the new form remains"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Expand: add the new column, backfill, keep both in sync\n" +
                "ALTER TABLE customers ADD COLUMN email_normalized VARCHAR(320);\n" +
                "UPDATE customers SET email_normalized = LOWER(TRIM(email)) WHERE email_normalized IS NULL;\n\n" +
                "-- Migrate: application writes both columns and reads the new one\n" +
                "-- (deploy, watch dashboards for reads of the old column)\n\n" +
                "-- Contract: only after nothing reads or writes the old column\n" +
                "ALTER TABLE customers DROP COLUMN email;"
              },
              { t: "note", variant: "warn", html: "Each phase is its own deployment. If you expand and contract in one release, you have rebuilt the breaking change with extra steps \u2014 old application instances still running during the rollout will fail." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Parallel change takes longer in calendar time and leaves temporary duplication in the code. You are buying the ability to deploy and roll back at every step. For an internal function with three callers in one repo, a single atomic refactor is simpler." },
              { t: "quiz", id: "refac-smells" },
              { t: "note", variant: "key", html: "<strong>Never break callers you cannot see.</strong> Expand, migrate and contract in separate deploys, and delete the old path only when monitoring proves nobody uses it." }
            ]
          }
        ]
      },
      {
        id: "legacy",
        name: "Legacy Code",
        icon: "wrench",
        lessons: [
          {
            id: "legacy-definition",
            title: "Legacy code and the change algorithm",
            summary: "Why lack of tests, not age, makes code legacy \u2014 and the five-step routine for changing it anyway.",
            minutes: 9,
            tags: ["legacy-code", "testing", "change"],
            blocks: [
              { t: "p", html: "Call code <strong>legacy</strong> when you need to change it and have no tests telling you whether you broke it. A brand-new service without tests is legacy the day it ships; a twenty-year-old library with a thorough suite is not." },
              { t: "h", text: "The change algorithm" },
              { t: "ol", items: [
                "<strong>Identify the change points</strong> \u2014 where exactly must the code change?",
                "<strong>Find test points</strong> \u2014 where can you observe the behaviour you care about?",
                "<strong>Break dependencies</strong> \u2014 make the minimum careful edits that let that code run in a test.",
                "<strong>Write tests</strong> \u2014 characterization tests that pin current behaviour.",
                "<strong>Make the change and refactor</strong> \u2014 now with a safety net."
              ] },
              { t: "p", html: "Step 3 is the uncomfortable one: you must edit untested code to make it testable. Keep those edits mechanical and tiny (extract an interface, add a constructor parameter), lean on the editor's automated refactorings, and pair or review them carefully." },
              { t: "stat", items: [
                { v: "minutes", k: "to change well-tested code" },
                { v: "days", k: "to change the same code without tests, mostly spent being careful" }
              ] },
              { t: "compare",
                bad: { title: "Edit and pray", items: ["Change the code, click around manually", "Deploy and watch error rates", "Next person repeats the fear"] },
                good: { title: "Cover and modify", items: ["Pin behaviour first", "Change with tests as the safety net", "Leave the area better covered than you found it"] } },
              { t: "note", variant: "trap", html: "The urge to rewrite the whole module is strongest on day one, when you understand it least. Pin behaviour and refactor first; you will learn what the code actually does, including the business rules nobody wrote down." },
              { t: "note", variant: "key", html: "<strong>Legacy means untested, not old.</strong> Find where to observe it, break just enough dependencies to test it, pin what it does, then change it." }
            ]
          },
          {
            id: "seams",
            title: "Seams: sprout, wrap and break dependencies",
            summary: "Places where you can swap behaviour without editing the code there, and the techniques that create them.",
            minutes: 11,
            tags: ["seams", "dependency-breaking", "legacy-code", "testability"],
            blocks: [
              { t: "p", html: "A <strong>seam</strong> is a place where you can alter behaviour without editing the code at that point. Tests need seams so they can replace slow, random or dangerous collaborators \u2014 the clock, the network, the bank \u2014 with controllable stand-ins." },
              { t: "table", headers: ["Seam type", "How behaviour is swapped", "Example"], rows: [
                ["Object seam", "Pass a different implementation of an interface", "Constructor takes <code class='tok'>PaymentGateway</code>; tests pass a fake"],
                ["Parameter seam", "Pass a value or function instead of reaching for a global", "<code class='tok'>isExpired(token, now)</code> instead of calling <code class='tok'>Date.now()</code> inside"],
                ["Configuration seam", "Environment or config selects an implementation", "Point the client at a local stub server"],
                ["Link / module seam", "Replace a module at import or link time", "Module mocking in a test runner \u2014 powerful, but hides the dependency"]
              ] },
              { t: "h", text: "Two techniques for adding code safely" },
              { t: "code", lang: "java", code:
                "// SPROUT: write the new logic as a new, tested unit; call it from one line\n" +
                "List<Line> eligible = DiscountRules.excludeWholesale(lines, account); // new + tested\n" +
                "applyLegacyDiscounts(eligible);                                         // untouched\n\n" +
                "// WRAP: keep the old body, add behaviour around it\n" +
                "public void sendInvoice(Invoice inv) {\n" +
                "    auditLog.record(\"invoice.sent\", inv.id());   // new, tested via fake AuditLog\n" +
                "    sendInvoiceLegacy(inv);                       // old body, renamed\n" +
                "}"
              },
              { t: "widget", id: "refacSeamPicker" },
              { t: "h", text: "Parameterize constructor: the workhorse" },
              { t: "code", lang: "python", code:
                "class ReportService:\n" +
                "    def __init__(self, db=None, clock=None):\n" +
                "        # old callers keep working; tests inject fakes\n" +
                "        self.db = db or ProductionDatabase()\n" +
                "        self.clock = clock or SystemClock()"
              },
              { t: "note", variant: "warn", html: "Module-level mocking (patching imports) is a seam too, but it couples tests to file layout and hides dependencies. Use it to get the first test in, then refactor toward explicit parameters." },
              { t: "note", variant: "key", html: "<strong>To test it, you need a seam; to get a seam, make the dependency a parameter.</strong> Sprout new logic, wrap new behaviour around old, and inject collaborators through constructors." }
            ]
          },
          {
            id: "characterization",
            title: "Characterization and approval tests",
            summary: "Pinning what the code does today \u2014 bugs included \u2014 so you can refactor without changing it by accident.",
            minutes: 10,
            tags: ["characterization-tests", "approval-testing", "golden-master"],
            blocks: [
              { t: "p", html: "A normal test asserts what code <em>should</em> do. A <strong>characterization test</strong> asserts what it <em>does</em>. You write it by calling the code, observing the output, and writing that output into the assertion \u2014 even when it looks wrong." },
              { t: "code", lang: "python", code:
                "def test_characterize_late_fee():\n" +
                "    # Observed today. 31 days late gives 15.0, not the 15.5 the wiki claims.\n" +
                "    # Pinned as-is; ticket BILL-482 tracks whether this is a bug.\n" +
                "    assert late_fee(balance=100.0, days_late=31) == 15.0\n" +
                "    assert late_fee(balance=100.0, days_late=0) == 0.0\n" +
                "    assert late_fee(balance=0.0, days_late=90) == 0.0"
              },
              { t: "h", text: "Approval (golden master) testing" },
              { t: "p", html: "When output is large \u2014 a rendered report, a generated config, a CSV export \u2014 record it once to a file, review it by eye, and commit it. The test fails when output differs, showing a diff you approve or reject." },
              { t: "table", headers: ["Problem", "Fix"], rows: [
                ["Timestamps and random ids make every run differ", "Inject a fixed clock and seed; scrub volatile fields before comparing"],
                ["Huge diffs nobody reads", "Keep golden files small and focused; one scenario per file"],
                ["Approving changes without looking", "Review golden-file diffs in code review like any other change"],
                ["Tests pass but miss branches", "Generate inputs that cover each branch; use coverage to find gaps"]
              ] },
              { t: "note", variant: "trap", html: "Do not \"fix\" suspicious behaviour while characterizing. You do not yet know who depends on it. Pin it, raise a ticket, and change it deliberately in its own commit." },
              { t: "quiz", id: "refac-legacy" },
              { t: "note", variant: "key", html: "<strong>First pin what is, then change what should be.</strong> Characterization and approval tests turn unknown behaviour into a safety net you can refactor against." }
            ]
          }
        ]
      },
      {
        id: "scale",
        name: "Refactoring at Scale",
        icon: "map",
        lessons: [
          {
            id: "strangler-fig",
            title: "The strangler fig migration",
            summary: "Replace a system one capability at a time behind a facade, instead of betting on a big rewrite.",
            minutes: 10,
            tags: ["strangler-fig", "migration", "architecture", "rewrite"],
            blocks: [
              { t: "p", html: "Full rewrites have a grim track record: the old system keeps changing while you chase it, nothing ships for months, and the new system rediscovers every edge case the old one had already handled. The <strong>strangler fig</strong> grows the new system around the old one and lets it wither, route by route." },
              { t: "diagram", id: "strangler-fig", caption: "A facade sends each route to either the new service or the legacy system; migrated routes grow, legacy routes shrink." },
              { t: "h", text: "The steps" },
              { t: "ol", items: [
                "Put a <strong>facade</strong> (proxy, gateway, router) in front of the legacy system. At first it forwards everything.",
                "Pick one thin capability with clear inputs and outputs. Build it in the new system.",
                "Route that capability's traffic through the new system \u2014 often shadowing first (compare results without serving them), then a percentage, then all.",
                "Repeat for the next capability. Data ownership moves along with behaviour.",
                "Delete legacy code paths once monitoring shows they receive no traffic."
              ] },
              { t: "table", headers: ["Tier", "Approach", "Why"], rows: [
                ["Naive", "Rewrite everything, cut over on one weekend", "Months of no value, one enormous risky switch"],
                ["Solid", "Facade plus route-by-route migration", "Each step small, observable, reversible"],
                ["Standout", "Route-by-route plus shadow traffic comparison and explicit data-ownership handover", "Proves equivalence with real traffic before users depend on it"]
              ] },
              { t: "note", variant: "warn", html: "The hardest part is usually <strong>data</strong>, not code. Decide for each entity which system is the source of truth at each phase, and avoid long periods where both write the same records." },
              { t: "note", variant: "key", html: "<strong>Strangle, do not rewrite.</strong> Put a facade in front, move one capability at a time with real traffic as proof, and delete the old path when nothing reaches it." }
            ]
          },
          {
            id: "branch-by-abstraction",
            title: "Branch by abstraction, flags and codemods",
            summary: "Large internal replacements on main, behind an interface, with mechanical changes done by scripts.",
            minutes: 10,
            tags: ["branch-by-abstraction", "feature-flags", "codemods", "large-scale-change"],
            blocks: [
              { t: "p", html: "Some refactors are too big for one PR: replacing an ORM, swapping a logging library, changing how every service reads config. A long-lived branch for that work will rot. <strong>Branch by abstraction</strong> keeps the work on main, behind an interface, shipping every day." },
              { t: "ol", items: [
                "Introduce an abstraction that the old implementation satisfies. Move callers onto it.",
                "Build the new implementation behind the same abstraction.",
                "Switch callers or traffic to the new implementation, ideally with a flag you can flip back.",
                "Remove the old implementation and, if it no longer earns its keep, the abstraction."
              ] },
              { t: "h", text: "Release flags, used responsibly" },
              { t: "table", headers: ["Practice", "Why"], rows: [
                ["Each flag has an owner and an expiry date", "Stops temporary branches in logic becoming permanent"],
                ["Default to the safe path if config is missing", "A flag-service outage should not change behaviour"],
                ["Test both paths while both exist", "Otherwise the fallback rots unnoticed"],
                ["Delete the flag and the dead path promptly", "Each live flag doubles the states to reason about"]
              ] },
              { t: "h", text: "Codemods for the mechanical part" },
              { t: "code", lang: "bash", code:
                "# Preview a syntax-aware rename across the repo, then apply it\n" +
                "codemod run rename-logger --from oldLog.info --to logger.info --dry-run src/\n" +
                "codemod run rename-logger --from oldLog.info --to logger.info src/\n" +
                "git diff --stat     # review the script and a sample of its output, not 400 files by eye"
              },
              { t: "p", html: "A codemod turns a thousand-file change into a small, reviewable program plus its output. Review the transformation logic carefully, spot-check results, and run the full test suite \u2014 then merge quickly before the codebase drifts." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers rollout mechanics such as canary and blue-green deployment in its <em>Pipeline Engineering \u203a Deployment</em> module." },
              { t: "quiz", id: "refac-scale" },
              { t: "note", variant: "key", html: "<strong>Big changes, small steps, all on main.</strong> Hide the swap behind an abstraction, switch with a flag you will delete, and let scripts do the mechanical edits." }
            ]
          }
        ]
      }
    ]
  };
})();
