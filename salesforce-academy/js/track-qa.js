/* =====================================================================
   ORBIT · Testing & Quality
   window.TRACKS.qa — modules: apex-tests / lwc-tests / static
   Self-contained: registers its own widgets, quizzes and track data.
   ===================================================================== */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }

  var Widgets = {};

  /* obCoverageCalc — per-class and aggregate Apex coverage against the platform and house bars */
  Widgets.obCoverageCalc = function (mount) {
    shell(mount, "calculator", "Apex coverage calculator",
      "Choose how far the tests for each class go. Every class has a fixed number of executable lines; the calculator shows per-class coverage, the aggregate, and which gates you would pass.");
    var LEVELS = [[0, "No tests"], [1, "Happy path"], [2, "+ negative"], [3, "+ bulk"]];
    var CLASSES = [
      { name: "AccountTriggerHandler", kind: "trigger handler", isNew: true, total: 40, covered: [0, 26, 34, 39], level: 1 },
      { name: "AccountService", kind: "service", isNew: true, total: 80, covered: [0, 52, 70, 76], level: 2 },
      { name: "AccountSelector", kind: "selector", isNew: false, total: 30, covered: [0, 24, 27, 28], level: 1 },
      { name: "AccountController", kind: "controller", isNew: false, total: 50, covered: [0, 30, 44, 45], level: 1 }
    ];
    var TRIGGER_LINES = 2;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function pct(c, t) { return t > 0 ? Math.round((c / t) * 1000) / 10 : 0; }

    function paint() {
      var sumC = 0, sumT = 0, houseOk = true, failing = [];
      var grid = h("div", { class: "ob-grid" });
      for (var i = 0; i < CLASSES.length; i++) {
        var c = CLASSES[i];
        var cov = c.covered[c.level];
        var p = pct(cov, c.total);
        var bar = c.isNew ? 90 : 85;
        var state = p >= bar ? "ok" : (p >= 75 ? "warn" : "bad");
        if (p < bar) { houseOk = false; failing.push(c.name); }
        sumC += cov; sumT += c.total;
        var meter = h("div", { class: "ob-meter" + (state === "bad" ? " over" : (state === "warn" ? " near" : "")) }, h("i", { style: "width:" + p + "%" }));
        grid.appendChild(h("div", { class: "ob-card" + (state === "ok" ? " is-ok" : (state === "bad" ? " is-bad" : "")) },
          h("h4", {}, c.name),
          h("div", { class: "ob-dim" }, c.kind + " · " + (c.isNew ? "new" : "modified") + " · " + cov + "/" + c.total + " lines · bar " + bar + "%"),
          h("div", { style: "margin:8px 0" }, meter),
          h("span", { class: "ob-chip " + state }, p + "% " + (state === "ok" ? "meets house bar" : (state === "warn" ? "above 75%, below house bar" : "below 75%")))));
      }
      var trigCovered = CLASSES[0].level > 0 ? TRIGGER_LINES : 0;
      sumC += trigCovered; sumT += TRIGGER_LINES;
      grid.appendChild(h("div", { class: "ob-card" + (trigCovered > 0 ? " is-ok" : " is-bad") },
        h("h4", {}, "AccountTrigger"),
        h("div", { class: "ob-dim" }, "logic-free trigger · " + trigCovered + "/" + TRIGGER_LINES + " lines"),
        h("span", { class: "ob-chip " + (trigCovered > 0 ? "ok" : "bad") }, trigCovered > 0 ? "covered by any test that does Account DML" : "no test fires it")));
      var agg = pct(sumC, sumT);
      clear(stage);
      stage.appendChild(grid);
      stage.appendChild(h("p", { class: "ob-dim", style: "margin:12px 0 0" },
        "Coverage proves " + sumC + " of " + sumT + " lines executed. It does not prove a single assertion checked the result: a test with no Assert calls scores exactly the same."));
      clear(readout);
      readout.appendChild(ro("aggregate", agg + "% (" + sumC + "/" + sumT + ")"));
      readout.appendChild(ro("75% deploy gate", agg >= 75 ? "pass" : "fail"));
      readout.appendChild(ro("every trigger covered", trigCovered > 0 ? "yes" : "no"));
      readout.appendChild(ro("house bar (90 new / 85 modified)", houseOk ? "met" : "missed: " + failing.join(", ")));
    }

    var controls = h("div", { class: "widget-controls" });
    for (var i = 0; i < CLASSES.length; i++) {
      (function (c) {
        controls.appendChild(h("div", { class: "w-field" },
          h("label", {}, c.name),
          segment(LEVELS, c.level, function (v) { c.level = v; paint(); })));
      })(CLASSES[i]);
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "qa-apex-tests": {
      title: "Apex testing checkpoint",
      sub: "Test isolation, data factories, mocks and what coverage really measures.",
      questions: [
        { q: "A test inserts 200 Accounts, then calls a service that enqueues a Queueable. Where must the service call sit so the Queueable actually runs before your assertions?",
          options: ["Anywhere in the method; async jobs always run at the end of a test", "Before Test.startTest(), so the job is queued early", "Between Test.startTest() and Test.stopTest()", "After Test.stopTest(), inside a System.runAs block"], answer: 2,
          explain: "Test.stopTest() forces asynchronous work queued since Test.startTest() to complete synchronously. Code that enqueues outside that window may never execute in the test, so assertions would check stale data. The window also gives the act phase its own fresh governor limits." },
        { q: "Your selector runs WITH USER_MODE. The test inserts data as the default test user and fails with a 'No such column' error on a new custom field. What is the correct fix?",
          options: ["Create a user in @TestSetup, assign the feature permission set, and do the DML and the act phase inside System.runAs", "Switch the selector to system mode for test context only", "Annotate the test with seeAllData=true so it sees the field", "Insert a PermissionSetAssignment for UserInfo.getUserId() inside the test"], answer: 0,
          explain: "User mode enforces field-level security, so the running user must actually hold FLS on the field. Assigning a permission set to the current test user does not refresh their access in that transaction, while a freshly created, permissioned user under System.runAs does. Weakening the selector or using org data hides the real defect." },
        { q: "Which pattern correctly tests the non-200 branch of a callout?",
          options: ["Point the Named Credential at a staging endpoint during the test run", "Wrap the call in try/catch and assert true in the catch", "Use Test.isRunningTest() in production code to return a fake error", "Register a second HttpCalloutMock that returns status 503 with Test.setMock, then assert the error result the code returns"], answer: 3,
          explain: "Tests cannot make real callouts, so every response shape you handle needs its own mock. A mock returning 503 drives the error branch and lets you assert the business outcome, such as a logged failure or a retry flag. Test.isRunningTest branches put test logic into production code and leave the real branch uncovered." },
        { q: "What does @TestSetup guarantee about the records it creates?",
          options: ["They are committed to the org and visible to later test classes", "They are created once per class and each test method sees a fresh copy, with changes rolled back between methods", "They are created again before every test method, which is slower but isolated", "They are only visible to methods annotated with isParallel=true"], answer: 1,
          explain: "The platform runs the setup method once per test class, then restores that baseline for every test method. A test that updates or deletes setup records cannot leak changes into its siblings. Nothing in a test is ever committed to the org." },
        { q: "A deploy reports 92% coverage for a new service class, but a bug ships anyway. Which statement best explains how that is possible?",
          options: ["Coverage below 95% is never safe for services", "The platform measures coverage only for triggers", "Coverage counts executed lines; it says nothing about whether tests asserted the right outcomes or exercised bulk and negative cases", "Coverage is measured in system mode so sharing bugs are invisible"], answer: 2,
          explain: "A line counts as covered the moment it runs, even if no assertion checks what it produced. The house bar of 90% for new classes is a floor for scenario completeness, not proof of correctness. Assert business outcomes, negative paths and a 200-record bulk case to make coverage meaningful." }
      ]
    },
    "qa-lwc-tests": {
      title: "LWC Jest checkpoint",
      sub: "Mounting, wire adapters, imperative mocks and assertions that survive refactors.",
      questions: [
        { q: "A component gets its data with @wire(getRisks). The test calls getRisks.emit(...) and fails with 'emit is not a function'. Why?",
          options: ["emit only works after jest.useFakeTimers()", "The bare @salesforce/apex import is auto-mocked as a plain jest.fn; a wired Apex method needs jest.mock with createApexTestWireAdapter", "Wire adapters only work in a scratch org", "The component must be created with new RiskList() instead of createElement"], answer: 1,
          explain: "Apex imports are stubbed as simple functions, which is enough for imperative calls but has no emit or error methods. Replacing the module through jest.mock with createApexTestWireAdapter gives you an adapter you can push data and errors through. Deprecated register* helpers are not the fix because they are removed in newer versions of the utility." },
        { q: "After changing a tracked property in a test, the DOM assertion still sees the old value. What is missing?",
          options: ["A setTimeout of 0 ms before asserting", "A call to jest.runAllTimers()", "Re-creating the element", "An await Promise.resolve() so the re-render microtask flushes"], answer: 3,
          explain: "LWC batches re-renders onto a microtask, so the DOM updates after the current synchronous code finishes. Awaiting a resolved promise lets that render run before you assert. Timer-based waits are banned by the house rules because they make tests slow and flaky." },
        { q: "Which selector strategy is most resilient when querying elements in a component's template?",
          options: ["Stable data-id attributes queried through element.shadowRoot", "Positional selectors such as querySelectorAll('p')[1]", "SLDS class names such as .slds-text-heading_small", "Reaching into base component internals for their inner input"], answer: 0,
          explain: "A data-id expresses test intent and survives markup and styling changes. Tag positions and SLDS classes change whenever someone restyles the component, and base component internals are stubs in Jest anyway. If the template lacks a data-id, add one rather than inventing a brittle selector." },
        { q: "What does the house standard require for every imperative Apex call a component makes?",
          options: ["One test that checks the mock was called", "A snapshot test of the rendered HTML", "A resolve test and a reject test, each asserting what the user sees", "A real call against a sandbox using a test user"], answer: 2,
          explain: "Both outcomes are reachable in production, so both need a test: data rendering on success and an error message or toast on failure. Asserting only that the mock was called proves wiring, not behaviour. Jest never talks to an org; every Apex call is mocked." },
        { q: "Which package and coverage bar apply to LWC unit tests in this workflow?",
          options: ["@salesforce/sfdx-lwc-jest, at least 80% statements per touched bundle", "Any Jest preset, 75% org-wide like Apex", "@salesforce/sfdx-lwc-jest, 100% branches per bundle", "Browser-based UI tests only, no unit coverage bar"], answer: 0,
          explain: "The sfdx-lwc-jest package wires the LWC compiler, base component stubs and Salesforce module mocks into Jest. The house bar is 80% statements for every bundle you touch. The 75% figure is the Apex production deploy gate and does not apply to Jest." }
      ]
    },
    "qa-static": {
      title: "Static analysis checkpoint",
      sub: "Code Analyzer, PMD rules, SonarQube gates and the zero-suppression policy.",
      questions: [
        { q: "PMD flags a SOQL query inside a helper method that is called from a for loop. The developer says the query itself is not in a loop. What is the right response?",
          options: ["Add // NOPMD with a comment explaining the false positive", "Raise the rule's threshold in the ruleset", "Accept it because indirect queries do not count against limits", "Restructure: collect the Ids, query once before the loop into a Map, and pass the Map to the helper"], answer: 3,
          explain: "Each call still issues a query, so 101 iterations still blow the 100-query synchronous limit. The house policy bans suppressions and threshold changes; the fix is the accumulate, query once, map, process pattern. Restructuring also makes the safe pattern obvious to the scanner." },
        { q: "Which command is the scanner gate for Apex and LWC in this workflow?",
          options: ["sf apex run test --code-coverage", "sf code-analyzer run, with zero violations required on touched files", "sf project deploy validate --test-level NoTestRun", "A SonarQube scan alone, with Code Analyzer optional"], answer: 1,
          explain: "Code Analyzer runs the PMD rules locally and in CI against the files you touched, and the gate is zero findings, not just exit code 0. Tests and validates come later and measure different things. SonarQube adds trend tracking and quality gates but does not replace the local scan." },
        { q: "A SonarQube quality gate is configured on new code. What is it best at catching?",
          options: ["Regressions introduced by this change, such as new critical issues, duplicated literals or coverage on new lines below target", "Whether the code compiles against the org", "Runtime governor limit failures in production", "Missing permission set assignments"], answer: 0,
          explain: "Gating on new code stops quality from sliding without forcing a rewrite of legacy debt. It tracks issues, duplication and imported coverage for the diff. Compilation and limits are proven by deploys and tests, not by static analysis." },
        { q: "Which finding is a security rule rather than a style rule?",
          options: ["FieldDeclarationsShouldBeAtStart", "OneDeclarationPerLine", "ApexSharingViolations on a class with no sharing keyword", "IfStmtsMustUseBraces"], answer: 2,
          explain: "A class without a sharing declaration may run without record-level sharing depending on its caller, which can expose records. The fix is with sharing by default or inherited sharing for utilities. The other three are readability rules that matter but cannot leak data." },
        { q: "Your method has a cognitive complexity of 19 and the rule limit is 15. What does the house standard expect?",
          options: ["Raise the limit to 20 for this class", "Suppress the rule because the logic is inherently complex", "Move the method into a test class where rules are relaxed", "Extract helpers or guard clauses until the method is at or under 15"], answer: 3,
          explain: "Complexity limits are zero tolerance in this workflow, and test classes get the full rule set too. Splitting map-building from per-record validation or using early returns usually gets under the limit. The resulting smaller methods are also easier to cover with focused tests." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.qa = {
    id: "qa",
    name: "Testing & Quality",
    short: "QA",
    tagline: "Tests that prove behaviour, not just coverage",
    color: "#4ade80",
    blurb: "Write Apex tests that assert business outcomes as a correctly permissioned user, build reusable test data, mock callouts and dependencies, and treat coverage as a floor rather than a goal. Then test Lightning Web Components with Jest and gate every change with Code Analyzer and SonarQube, with zero suppressions.",
    modules: [
      {
        id: "apex-tests",
        name: "Apex Testing",
        icon: "shield",
        lessons: [
          {
            id: "istest-basics",
            title: "@IsTest fundamentals",
            summary: "Test isolation, the startTest window, runAs and the Assert class: the skeleton every Apex test shares.",
            minutes: 10,
            tags: ["apex", "testing", "istest"],
            blocks: [
              { t: "p", html: "Picture every Apex test as a <strong>sealed room</strong>. It starts with an empty data set, builds exactly what it needs, runs one behaviour, checks the outcome, and the platform rolls everything back when the door closes. Nothing you insert is ever committed, and nothing in the org leaks in unless you open the door with <code class='tok'>seeAllData=true</code>, which you should not." },
              { t: "p", html: "Tests are not optional ceremony. Production deploys that contain Apex run tests, and the platform refuses the deploy unless at least <strong>75% of Apex lines across the org</strong> are covered and every trigger has some coverage. The house bar is higher, but the first job is understanding the skeleton." },
              { t: "h", text: "The skeleton" },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "private class AccountServiceTest {",
                "    private static final String PERM_SET = 'Account_Tiering';",
                "    private static final String MSG_TIER = 'High-revenue accounts should be tiered Gold';",
                "",
                "    @TestSetup",
                "    static void setup() {",
                "        TestDataFactory.createUserWithPermSet(PERM_SET);",
                "    }",
                "",
                "    /** @description Tests applyTiers when revenue is above the Gold floor, expects Gold */",
                "    @IsTest",
                "    static void applyTiersHighRevenueSetsGold() {",
                "        User u = TestDataFactory.getPermissionedUser();",
                "        System.runAs(u) {",
                "            List<Account> accts = TestDataFactory.createAccounts(1, 5000000);",
                "            Test.startTest();",
                "            AccountService.getInstance().applyTiers(accts);",
                "            Test.stopTest();",
                "            Account result = [SELECT Tier__c FROM Account WHERE Id = :accts[0].Id WITH USER_MODE LIMIT 1];",
                "            Assert.areEqual('Gold', result.Tier__c, MSG_TIER);",
                "        }",
                "    }",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Element", "What it does", "Why it matters"], rows: [
                ["<code class='tok'>@IsTest</code> on class and method", "Marks test code; excluded from coverage and from the org's code size limit", "The legacy <code class='tok'>testMethod</code> keyword is obsolete; use the annotation"],
                ["<code class='tok'>@TestSetup</code>", "Creates baseline data once per class, restored before each method", "Faster suites and no cross-test leakage"],
                ["<code class='tok'>System.runAs(u)</code>", "Runs the block as a specific user, enforcing their sharing and, in user mode, their FLS", "Proves the feature works for the people who will actually use it"],
                ["<code class='tok'>Test.startTest()</code> / <code class='tok'>stopTest()</code>", "Fresh governor limits for the act phase; async work queued inside runs at stopTest", "Setup cost does not eat the limits you are trying to measure"],
                ["<code class='tok'>Assert</code> class", "<code class='tok'>areEqual</code>, <code class='tok'>isTrue</code>, <code class='tok'>isNull</code>, <code class='tok'>fail</code> with a message", "Clear expected-versus-actual output; legacy <code class='tok'>System.assert*</code> is banned in new code"]
              ] },
              { t: "note", variant: "trap", html: "<code class='tok'>@IsTest(seeAllData=true)</code> makes the test depend on whatever data the target org happens to hold. It passes in one sandbox and fails in production, and the scanner flags it. Build every record yourself." },
              { t: "h", text: "Arrange, act, assert" },
              { t: "ol", items: [
                "<strong>Arrange</strong> inside <code class='tok'>System.runAs</code>: create the records this scenario needs, as the permissioned user, so triggers fire with the right access.",
                "<strong>Act</strong> between <code class='tok'>Test.startTest()</code> and <code class='tok'>Test.stopTest()</code>: call exactly one method under test.",
                "<strong>Assert</strong> a business outcome: a field value, a record count, a returned value. Re-query what you check."
              ] },
              { t: "compare",
                bad: { title: "Coverage theatre", items: ["Calls the method and asserts nothing", "Wraps the call in try/catch and asserts true", "Runs as the default test user", "Names like testMethod1"] },
                good: { title: "Behaviour proof", items: ["Asserts the tier, the count, the error message", "Lets unexpected exceptions fail the test", "Runs as a user holding the shipped permission set", "Names like applyTiersHighRevenueSetsGold"] } },
              { t: "stat", items: [
                { v: "75%", k: "org-wide platform deploy floor" },
                { v: "90% / 85%", k: "house bar: new / modified class" },
                { v: "200", k: "records in a bulk test" }
              ] },
              { t: "note", variant: "tip", html: "Expected-exception tests are the one place a try/catch belongs: call the method, follow it with <code class='tok'>Assert.fail('Expected ...')</code>, and assert the exception message in the catch." },
              { t: "cue", html: "Reach for this skeleton when you hear <em>\"write a test for this trigger\"</em>, <em>\"why does my test pass locally but fail in prod\"</em>, or <em>\"the async job never runs in my test\"</em>." },
              { t: "note", variant: "key", html: "<strong>Isolated data, one behaviour, a permissioned user, a real assertion.</strong> Say out loud that the startTest window resets limits and flushes async work, and that seeAllData is never the answer." }
            ]
          },
          {
            id: "test-data",
            title: "Test data factories and @TestSetup",
            summary: "Build data once, build it the same way everywhere, and build it as the right user.",
            minutes: 9,
            tags: ["apex", "testing", "test-data"],
            blocks: [
              { t: "p", html: "The mental model is a <strong>kitchen with one recipe book</strong>. Every test needs Accounts, Contacts and a user, and if each test cooks its own you end up with 40 slightly different Accounts, half of which break the day someone adds a required field. A data factory is the single recipe book; <code class='tok'>@TestSetup</code> is the prep done once before service." },
              { t: "h", text: "A factory that respects security" },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "public class TestDataFactory {",
                "    private static final String EMAIL_PREFIX = 'orbit.tester';",
                "    private static final String EMAIL_DOMAIN = '@example.test';",
                "",
                "    public static User createUserWithPermSet(String permSetName) {",
                "        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];",
                "        String uniq = String.valueOf(Crypto.getRandomInteger()).remove('-');",
                "        User u = new User(",
                "            Alias = 'ot' + uniq.right(5), LastName = 'Tester',",
                "            Email = EMAIL_PREFIX + uniq + EMAIL_DOMAIN,",
                "            Username = EMAIL_PREFIX + uniq + EMAIL_DOMAIN + '.orbit',",
                "            ProfileId = p.Id, EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'en_US',",
                "            LocaleSidKey = 'en_US', TimeZoneSidKey = 'America/Los_Angeles');",
                "        insert u;",
                "        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];",
                "        insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id);",
                "        return u;",
                "    }",
                "",
                "    public static User getPermissionedUser() {",
                "        return [SELECT Id FROM User WHERE Email LIKE 'orbit.tester%@example.test' LIMIT 1];",
                "    }",
                "",
                "    public static List<Account> createAccounts(Integer count, Decimal revenue) {",
                "        List<Account> accts = new List<Account>();",
                "        for (Integer i = 0; i < count; i++) {",
                "            accts.add(new Account(Name = 'Orbit Test ' + i, AnnualRevenue = revenue));",
                "        }",
                "        insert accts;",
                "        return accts;",
                "    }",
                "}"
              ].join("\n") },
              { t: "p", html: "Notice what the factory avoids: no hardcoded Profile or record Ids (it queries by name), one DML per object type rather than one per record, and test emails on the reserved <code class='tok'>@example.test</code> domain so nothing can ever reach a real inbox." },
              { t: "table", headers: ["Tier", "Approach", "What breaks"], rows: [
                ["Naive", "Each test builds records inline with <code class='tok'>new Account(...)</code>", "A new required field or validation rule breaks dozens of tests at once"],
                ["Solid", "Shared factory plus <code class='tok'>@TestSetup</code> for the baseline", "Still fails under user-mode code if data is created as the default test user"],
                ["Standout", "Factory creates a permissioned user in setup; each test inserts its business data inside <code class='tok'>System.runAs</code>", "Little: triggers fire with real FLS, setup is cheap, and fixes land in one place"]
              ] },
              { t: "note", variant: "warn", html: "Inserting a User and an Account in the same transaction context throws <code class='tok'>MIXED_DML_OPERATION</code>, because setup and non-setup objects cannot share a transaction. Create the user in <code class='tok'>@TestSetup</code> and the business records inside <code class='tok'>System.runAs</code> in the test method." },
              { t: "h", text: "Why business data goes inside runAs" },
              { t: "p", html: "If an Account trigger calls a user-mode selector and you insert the Account outside <code class='tok'>runAs</code>, the trigger runs as the default test user, who lacks the permission set. The test then fails with a field-access error that has nothing to do with the behaviour you meant to test. When in doubt, do every insert and update inside <code class='tok'>runAs</code>." },
              { t: "ul", items: [
                "<strong>Keep setup lean on heavy objects.</strong> Opportunity and Case often carry flows and triggers; large graphs in setup can burn most of the 100-query budget before <code class='tok'>startTest</code>.",
                "<strong>Use <code class='tok'>Test.loadData</code></strong> with a static resource CSV when a scenario genuinely needs many related rows.",
                "<strong>Make test literals constants.</strong> A <code class='tok'>private static final String</code> per literal keeps duplicated-string scanner rules quiet and intent obvious.",
                "<strong>Bulk-verify without loops of queries.</strong> One aggregate query into a <code class='tok'>Map&lt;Id, Integer&gt;</code>, then assert per record from the map."
              ] },
              { t: "note", variant: "tip", html: "The permission set you assign in tests should be the one the feature ships in <code class='tok'>force-app/main/default/permissionsets/</code>. Never invent a test-only permission set; include the real one in your validate scope." },
              { t: "cue", html: "Use a factory and a permissioned setup user when you hear <em>\"MIXED_DML_OPERATION\"</em>, <em>\"No such column in my test only\"</em>, <em>\"we added a required field and 60 tests broke\"</em>, or <em>\"Too many SOQL queries in setup\"</em>." },
              { t: "note", variant: "key", html: "<strong>One recipe book, cooked once, served as the right user.</strong> Factory for consistency, @TestSetup for speed, and System.runAs around business DML so triggers see real permissions." }
            ]
          },
          {
            id: "mocking",
            title: "Mocking callouts and dependencies",
            summary: "HttpCalloutMock, StubProvider and the other test doubles that let you test code which talks to things you do not control.",
            minutes: 10,
            tags: ["apex", "testing", "mocks"],
            blocks: [
              { t: "p", html: "Tests run in a <strong>sealed room with no phone line</strong>. Apex tests cannot make real HTTP callouts, so any code path that calls out needs a stand-in that answers the phone with a scripted response. The same idea extends to your own classes: swap a selector for a stub and you can force error branches that real data would never reach." },
              { t: "h", text: "HTTP callouts" },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "public class PaymentsApiMock implements HttpCalloutMock {",
                "    private final Integer status;",
                "    private final String body;",
                "    public PaymentsApiMock(Integer status, String body) {",
                "        this.status = status;",
                "        this.body = body;",
                "    }",
                "    public HttpResponse respond(HttpRequest req) {",
                "        Assert.isTrue(req.getEndpoint().startsWith('callout:Payments_API'), 'Must use the Named Credential');",
                "        HttpResponse res = new HttpResponse();",
                "        res.setStatusCode(status);",
                "        res.setHeader('Content-Type', 'application/json');",
                "        res.setBody(body);",
                "        return res;",
                "    }",
                "}",
                "",
                "// in the test method, inside System.runAs",
                "Test.setMock(HttpCalloutMock.class, new PaymentsApiMock(503, '{\"error\":\"unavailable\"}'));",
                "Test.startTest();",
                "PaymentResult result = PaymentService.getInstance().charge(order.Id);",
                "Test.stopTest();",
                "Assert.areEqual('RETRY_SCHEDULED', result.status, 'A 503 should schedule a retry');"
              ].join("\n") },
              { t: "p", html: "Write one mock per response shape you handle: 200 with a happy body, a 4xx validation failure, a 5xx outage, and a timeout simulated by throwing <code class='tok'>CalloutException</code> from <code class='tok'>respond</code>. Each one is a separate test that asserts what the caller does next." },
              { t: "note", variant: "trap", html: "DML followed by a callout in the same transaction fails with an uncommitted-work error, and tests are no exception. Insert your fixtures before <code class='tok'>Test.startTest()</code> and make the callout inside the start/stop window; in practice that ordering keeps setup DML from blocking the mocked callout. In production code, the same rule pushes callouts ahead of DML or into a Queueable." },
              { t: "h", text: "The test double toolbox" },
              { t: "table", headers: ["Dependency", "Test double", "Typical assertion"], rows: [
                ["REST or HTTP callout", "<code class='tok'>Test.setMock(HttpCalloutMock.class, ...)</code>", "Status handling, parsed fields, retry flag"],
                ["SOAP callout from a generated stub", "<code class='tok'>Test.setMock(WebServiceMock.class, ...)</code>", "Response mapped to the domain object"],
                ["Your own selector or service", "<code class='tok'>Test.createStub(Type, StubProvider)</code> or an injected mock instance", "Catch block runs, fallback returned, error logged"],
                ["SOSL search", "<code class='tok'>Test.setFixedSearchResults(ids)</code>", "Search returns empty in tests unless you set results"],
                ["Platform events", "<code class='tok'>Test.getEventBus().deliver()</code>", "Subscriber trigger ran and changed records"],
                ["Change Data Capture", "<code class='tok'>Test.enableChangeDataCapture()</code> then deliver", "Change event handler processed the change"]
              ] },
              { t: "h", text: "Stubbing your own classes" },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "private class FailingSelectorStub implements System.StubProvider {",
                "    public Object handleMethodCall(Object stubbedObject, String stubbedMethodName,",
                "            Type returnType, List<Type> paramTypes, List<String> paramNames, List<Object> args) {",
                "        throw new QueryException('Simulated selector failure');",
                "    }",
                "}",
                "",
                "AccountSelector stub = (AccountSelector) Test.createStub(AccountSelector.class, new FailingSelectorStub());",
                "AccountService.getInstance().setSelector(stub);"
              ].join("\n") },
              { t: "p", html: "The trade-off is design pressure: a stub only works if the service receives its selector through a seam (a setter, a constructor argument, or a mock-instance hook on a singleton). That seam costs a few lines but turns the hardest-to-reach <code class='tok'>catch</code> blocks into ordinary tests." },
              { t: "note", variant: "warn", html: "Avoid <code class='tok'>Test.isRunningTest()</code> branches in production code. They leave the real branch untested and hide behaviour differences between test and production." },
              { t: "cue", html: "Mock it when you hear <em>\"Methods defined as TestMethod do not support Web service callouts\"</em>, <em>\"I can't make the catch block run\"</em>, <em>\"SOSL returns nothing in my test\"</em>, or <em>\"how do I test the subscriber\"</em>." },
              { t: "note", variant: "key", html: "<strong>One mock per response shape, one seam per dependency.</strong> Callout mocks prove error handling, stubs force catch blocks, and neither requires test-only branches in production code." }
            ]
          },
          {
            id: "coverage",
            title: "Coverage strategy beyond 75%",
            summary: "How coverage is measured, why 75% is a floor, and how to reach the house bar with tests that mean something.",
            minutes: 11,
            tags: ["apex", "coverage", "testing"],
            blocks: [
              { t: "p", html: "Treat coverage as a <strong>smoke detector, not a fire inspection</strong>. Low coverage reliably tells you something is untested. High coverage tells you only that lines ran, not that anyone checked what they did. The platform gate and the house bar are both floors you clear on the way to real scenario coverage." },
              { t: "h", text: "How the numbers are computed" },
              { t: "ul", items: [
                "Coverage is <strong>executed lines divided by executable lines</strong>. Comments, blank lines and declarations without logic do not count; test classes are excluded entirely.",
                "A production deploy with Apex requires <strong>75% across the org</strong> and some coverage on every trigger when you run local or all tests.",
                "With <code class='tok'>RunSpecifiedTests</code>, the specified tests must take <strong>each class and trigger in the deploy</strong> to 75% individually.",
                "The house bar is stricter: <strong>at least 90% per new class</strong> and <strong>at least 85% per modified class</strong>, captured from the validate result rather than a local run."
              ] },
              { t: "widget", id: "obCoverageCalc" },
              { t: "p", html: "On the default settings the aggregate lands at 75.2%: it squeaks past the platform floor while all four classes miss the house bar (the service sits at 87.5%, just short of 90% for a new class). Drop the controller back to no tests and the aggregate falls to 60.4%, which fails the deploy. The trigger is covered for free the moment any test inserts an Account." },
              { t: "table", headers: ["Tier", "Strategy", "Outcome"], rows: [
                ["Naive", "Write tests until the org reaches 75%, starting with the easiest classes", "Passes the deploy, leaves risky classes thin, and invites assertion-free tests"],
                ["Solid", "Per-class targets at the house bar, measured from the validate result", "Every touched class is tested, though some lines may be covered without being checked"],
                ["Standout", "Plan scenarios per method (happy, negative, permission, bulk, exception), then read uncovered lines and map each to a forcing recipe", "Coverage follows naturally and every covered line is backed by an assertion"]
              ] },
              { t: "h", text: "Why lines stay red" },
              { t: "table", headers: ["Uncovered construct", "Forcing recipe"], rows: [
                ["<code class='tok'>catch</code> block in a service", "Inject a stub selector that throws, then assert the fallback"],
                ["Guard clause such as an early return on null input", "Pass the null or empty input and assert nothing changed"],
                ["<code class='tok'>switch on</code> default arm", "Pass a value outside the case list"],
                ["Non-200 callout branch", "Register a mock that returns 4xx or 5xx"],
                ["Partial-success DML branch", "Use <code class='tok'>Database.insert(records, false)</code> with one record that fails validation"],
                ["Code after a throw or return", "Dead code: remove it rather than chase it"]
              ] },
              { t: "code", lang: "bash", code: [
                "# fast local hint while authoring (not the gate)",
                "sf apex run test --class-names AccountServiceTest --code-coverage --result-format human --wait 10 --target-org dev-sandbox",
                "",
                "# the measurement the house gate trusts: per-class coverage from a validate",
                "sf project deploy validate --source-dir force-app --test-level RunSpecifiedTests \\",
                "  --tests AccountServiceTest --tests AccountTriggerHandlerTest --target-org uat --wait 33"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Never weaken a test to get green: no deleted assertions, no swallowed exceptions, no <code class='tok'>seeAllData</code>, no <code class='tok'>@TestVisible</code> added only to reach a private method. If a private overload has no public path, it is dead code." },
              { t: "cue", html: "Talk coverage strategy when you hear <em>\"we're at 74% and the release is tonight\"</em>, <em>\"coverage is stuck at 89%\"</em>, or <em>\"our tests are green but prod broke\"</em>." },
              { t: "quiz", id: "qa-apex-tests" },
              { t: "note", variant: "key", html: "<strong>75% is the platform floor; 90/85 is the house floor; assertions are the actual goal.</strong> Plan scenarios per method, read the uncovered lines, and force each one with a specific recipe." }
            ]
          }
        ]
      },
      {
        id: "lwc-tests",
        name: "LWC Testing",
        icon: "cube",
        lessons: [
          {
            id: "lwc-jest",
            title: "LWC Jest testing",
            summary: "Mount components in Node, drive wire adapters and imperative Apex mocks, and assert what the user sees.",
            minutes: 12,
            tags: ["lwc", "jest", "testing"],
            blocks: [
              { t: "p", html: "LWC unit tests run in <strong>Node with a simulated DOM</strong>, not in an org. Think of it as a puppet theatre: you mount the component, play the parts of Lightning Data Service and Apex yourself through mocks, and watch what renders. Nothing talks to Salesforce, which is why the tests are fast and deterministic." },
              { t: "h", text: "Setup" },
              { t: "code", lang: "bash", code: [
                "npm install --save-dev @salesforce/sfdx-lwc-jest",
                "# package.json scripts: \"test:unit\": \"sfdx-lwc-jest\"",
                "npm run test:unit -- --coverage"
              ].join("\n") },
              { t: "p", html: "The <code class='tok'>@salesforce/sfdx-lwc-jest</code> package supplies the LWC compiler transform, stubs for base components such as <code class='tok'>lightning-button</code>, and mocks for <code class='tok'>@salesforce/*</code> imports. Tests live in <code class='tok'>lwc/&lt;component&gt;/__tests__/&lt;component&gt;.test.js</code>." },
              { t: "h", text: "Mount, drive, assert" },
              { t: "code", lang: "javascript", code: [
                "import { createElement } from 'lwc';",
                "import RiskList from 'c/riskList';",
                "import getRisks from '@salesforce/apex/RiskController.getRisks';",
                "",
                "jest.mock(",
                "    '@salesforce/apex/RiskController.getRisks',",
                "    () => {",
                "        const { createApexTestWireAdapter } = require('@salesforce/wire-service-jest-util');",
                "        return { default: createApexTestWireAdapter(jest.fn()) };",
                "    },",
                "    { virtual: true }",
                ");",
                "",
                "const ACCOUNT_ID = 'accountIdPlaceholder';",
                "",
                "describe('c-risk-list', () => {",
                "    afterEach(() => {",
                "        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);",
                "        jest.clearAllMocks();",
                "    });",
                "",
                "    it('renders one row per risk returned by the wire', async () => {",
                "        const el = createElement('c-risk-list', { is: RiskList });",
                "        el.recordId = ACCOUNT_ID;",
                "        document.body.appendChild(el);",
                "        getRisks.emit([{ Id: 'r1', Name: 'Late delivery' }, { Id: 'r2', Name: 'Credit hold' }]);",
                "        await Promise.resolve();",
                "        const rows = el.shadowRoot.querySelectorAll('[data-id=\"risk-row\"]');",
                "        expect(rows.length).toBe(2);",
                "    });",
                "",
                "    it('shows the error panel when the wire fails', async () => {",
                "        const el = createElement('c-risk-list', { is: RiskList });",
                "        document.body.appendChild(el);",
                "        getRisks.error({ body: { message: 'INSUFFICIENT_ACCESS' } }, 403);",
                "        await Promise.resolve();",
                "        const panel = el.shadowRoot.querySelector('[data-id=\"error-panel\"]');",
                "        expect(panel.textContent).toContain('INSUFFICIENT_ACCESS');",
                "    });",
                "});"
              ].join("\n") },
              { t: "h", text: "Choosing the right mock" },
              { t: "table", headers: ["How the component uses it", "Test setup", "Assert both"], rows: [
                ["<code class='tok'>@wire(apexMethod, ...)</code>", "<code class='tok'>jest.mock</code> plus <code class='tok'>createApexTestWireAdapter</code>", "<code class='tok'>.emit(data)</code> and <code class='tok'>.error(...)</code>"],
                ["Imperative <code class='tok'>apexMethod({...}).then(...)</code>", "Auto-mock as <code class='tok'>jest.fn</code>; <code class='tok'>mockResolvedValue</code> / <code class='tok'>mockRejectedValue</code>", "Success render and error message"],
                ["<code class='tok'>@wire(getRecord, ...)</code> from the UI API", "The LDS adapters already support <code class='tok'>.emit</code> and <code class='tok'>.error</code>", "Field values shown, not-found handling"],
                ["Message Service <code class='tok'>publish</code>", "Auto-mocked <code class='tok'>jest.fn</code>", "<code class='tok'>toHaveBeenCalledWith</code> the channel and payload"]
              ] },
              { t: "note", variant: "trap", html: "Calling <code class='tok'>.emit()</code> on a bare Apex import throws because the default auto-mock is a plain function. Deprecated helpers such as <code class='tok'>registerApexTestWireAdapter</code> are removed in newer releases of the wire utility; use the <code class='tok'>create*TestWireAdapter</code> plus <code class='tok'>jest.mock</code> pattern." },
              { t: "h", text: "Rules that keep tests honest" },
              { t: "ul", items: [
                "Set <code class='tok'>@api</code> properties <strong>before</strong> <code class='tok'>appendChild</code>, then <code class='tok'>await Promise.resolve()</code> after every state change. No <code class='tok'>setTimeout</code> waits.",
                "Query through <code class='tok'>el.shadowRoot</code> with <code class='tok'>data-id</code> selectors; never positional tag selectors or base component internals.",
                "Assert on <code class='tok'>textContent</code> and public properties, plus <code class='tok'>detail</code>, <code class='tok'>bubbles</code> and <code class='tok'>composed</code> on custom events when the contract says so.",
                "Assert accessibility attributes the acceptance criteria name, such as a label on an input or <code class='tok'>role=\"alert\"</code> on an error region.",
                "Reach at least <strong>80% statements per touched bundle</strong>."
              ] },
              { t: "compare",
                bad: { title: "Fragile test", items: ["Asserts the mock was called and stops", "Selects the second paragraph tag", "Waits 0 ms with a timer", "Hard-codes an 18-character record Id"] },
                good: { title: "Durable test", items: ["Asserts the rendered rows and the error panel", "Selects by data-id", "Awaits a resolved promise", "Uses a named fixture constant"] } },
              { t: "note", variant: "tip", html: "Keep realistic LDS payloads as JSON files under <code class='tok'>__tests__/data/</code> rather than building deep record shapes inline. They double as documentation of what the component expects." },
              { t: "cue", html: "Reach for these patterns when you hear <em>\"emit is not a function\"</em>, <em>\"my assertion sees the old DOM\"</em>, <em>\"how do I test the toast\"</em>, or <em>\"the test broke when we restyled the card\"</em>." },
              { t: "quiz", id: "qa-lwc-tests" },
              { t: "note", variant: "key", html: "<strong>Mount with createElement, play the data layer with the right mock, flush with a resolved promise, assert what the user sees.</strong> Both the success and failure path of every wire and every imperative call." }
            ]
          }
        ]
      },
      {
        id: "static",
        name: "Static Analysis",
        icon: "broom",
        lessons: [
          {
            id: "pmd-sonar",
            title: "PMD, Code Analyzer and SonarQube",
            summary: "Run the scanner on every touched file, fix findings in source with zero suppressions, and gate new code in SonarQube.",
            minutes: 11,
            tags: ["pmd", "code-analyzer", "sonarqube"],
            blocks: [
              { t: "p", html: "Static analysis is the <strong>spell-checker that also knows the building code</strong>. It reads source without running it and flags patterns that will break under load, leak data or rot into unmaintainable code. In this workflow the scanner is a hard gate: it runs before any validate or deploy, and the only acceptable number of findings is zero." },
              { t: "h", text: "The tools and their jobs" },
              { t: "table", headers: ["Tool", "Runs where", "Best at"], rows: [
                ["<strong>Salesforce Code Analyzer</strong> (<code class='tok'>sf code-analyzer</code>)", "Locally and in CI, scoped to touched files", "Running the PMD Apex rules, plus copy-paste detection, as the pre-deploy gate"],
                ["<strong>PMD rules</strong>", "Inside Code Analyzer", "Security (sharing, CRUD/FLS, SOQL injection), performance (operations in loops), design limits, naming"],
                ["<strong>SonarQube</strong>", "Server-side on every PR and branch", "Quality gates on new code, duplication, trend dashboards, imported coverage"]
              ] },
              { t: "code", lang: "bash", code: [
                "sf plugins install code-analyzer        # once per machine or CI image",
                "",
                "sf code-analyzer run \\",
                "  --rule-selector pmd:Recommended \\",
                "  --target force-app/main/default/classes/AccountService.cls \\",
                "  --target force-app/main/default/classes/AccountServiceTest.cls \\",
                "  --view detail \\",
                "  --output-file .sf-cache/account-tiering-scan.json",
                "",
                "# the gate is the violation count, not the exit code",
                "jq '[.violations[]?] | length' .sf-cache/account-tiering-scan.json"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Exit code 0 does not mean clean. Read the output file and require zero violations, and treat a scanner that fails to run or writes no file as a failed gate, never as \"no findings\". The older <code class='tok'>sf scanner run</code> command is legacy." },
              { t: "h", text: "Rules you will meet weekly" },
              { t: "table", headers: ["Rule", "What it catches", "Fix in source"], rows: [
                ["<code class='tok'>AvoidSoqlInLoops</code> / <code class='tok'>OperationWithLimitsInLoop</code>", "SOQL, DML, callouts or async enqueues inside loops, including in tests", "Accumulate Ids, query once into a Map, process"],
                ["<code class='tok'>ApexSharingViolations</code>", "Class with no sharing keyword", "<code class='tok'>with sharing</code>, or <code class='tok'>inherited sharing</code> for selectors and utilities"],
                ["<code class='tok'>ApexCRUDViolation</code>", "SOQL or DML without CRUD/FLS enforcement", "<code class='tok'>WITH USER_MODE</code> and <code class='tok'>AccessLevel.USER_MODE</code>"],
                ["<code class='tok'>ApexSOQLInjection</code>", "Input concatenated into dynamic SOQL", "Bind variables or <code class='tok'>Database.queryWithBinds</code>"],
                ["<code class='tok'>AvoidHardcodingId</code>", "15 or 18 character record Ids in code", "Query by DeveloperName, or Custom Metadata"],
                ["<code class='tok'>CognitiveComplexity</code> / <code class='tok'>CyclomaticComplexity</code>", "Methods above 15", "Extract helpers, guard clauses, <code class='tok'>switch on</code>"],
                ["<code class='tok'>ExcessiveParameterList</code>", "Too many parameters (rulesets often cap at 4)", "Introduce a request DTO"],
                ["Duplicated string literal", "The same literal three or more times", "A <code class='tok'>private static final String</code> constant"],
                ["<code class='tok'>AvoidDebugStatements</code>", "<code class='tok'>System.debug</code> left in code", "Use the logging framework"]
              ] },
              { t: "h", text: "Zero suppressions" },
              { t: "p", html: "The house policy bans <code class='tok'>@SuppressWarnings('PMD...')</code>, <code class='tok'>// NOPMD</code> and <code class='tok'>// NOSONAR</code>, and it bans calling a finding a false positive. If the scanner cannot follow your security pattern across three assignments, simplify the code until the pattern is visible at the flagged line. The cost is occasional restructuring; the payoff is a gate everyone trusts." },
              { t: "table", headers: ["Tier", "Posture", "Result"], rows: [
                ["Naive", "Run the scanner occasionally on the whole repo and triage by severity", "Thousands of legacy findings; nobody reads them"],
                ["Solid", "Scan touched files in CI and block on new critical findings", "New code improves, but minor issues and suppressions creep in"],
                ["Standout", "Scan touched files before every validate, require zero findings at every severity, ban suppressions, and gate new code in SonarQube", "A clean, trusted signal and a codebase that gets better with each change"]
              ] },
              { t: "note", variant: "tip", html: "Feed Apex coverage into SonarQube by exporting test results as JSON (for example with <code class='tok'>sf apex run test --code-coverage --result-format json --output-dir</code>), so the new-code coverage condition reflects reality. Exact importer settings depend on your SonarQube plugin." },
              { t: "cue", html: "Bring up the scanner gate when you hear <em>\"it's a false positive, just NOPMD it\"</em>, <em>\"the build passed but the scan had warnings\"</em>, or <em>\"how do we stop quality sliding without rewriting legacy code\"</em>." },
              { t: "quiz", id: "qa-static" },
              { t: "note", variant: "key", html: "<strong>Scan every touched file, fix findings in source, suppress nothing, gate new code.</strong> Code Analyzer is the pre-deploy gate; SonarQube keeps the trend honest." }
            ]
          }
        ]
      }
    ]
  };
})();
