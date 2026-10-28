/* =====================================================================
   ORBIT · DevOps & Release
   window.TRACKS.ops — modules: dx / release
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

  /* obDeployPlanner — recommended sf CLI sequence for a target, a content mix and an urgency */
  Widgets.obDeployPlanner = function (mount) {
    shell(mount, "planner", "Deploy planner",
      "Pick the target org, what the change contains and how much lead time you have. The planner prints the sf CLI sequence, the test level, whether quick deploy is available and the main risks.");
    var target = "prod", contents = "apex", urgency = "normal";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var TESTS = "--tests AccountServiceTest --tests AccountTriggerHandlerTest";

    function plan() {
      var alias = target === "prod" ? "prod" : "uat";
      var early = urgency === "early";
      var steps = [], level, quick, windowText, risks = [];
      if (target === "sandbox" && contents === "meta") {
        level = "NoTestRun";
        if (early) {
          steps.push(["Dry run days ahead to catch missing dependencies", "sf project deploy validate --source-dir force-app --test-level NoTestRun --target-org " + alias + " --wait 33"]);
          steps.push(["Deploy in the window", "sf project deploy start --source-dir force-app --test-level NoTestRun --target-org " + alias + " --wait 33"]);
          quick = "no: a validation that ran no tests is generally not quick-deployable, so redeploy";
          windowText = "dry run any time; deploy is fast";
          risks.push("The dry run proves components resolve, not that flows or validation rules behave.");
        } else {
          steps.push(["Deploy directly", "sf project deploy start --source-dir force-app --test-level NoTestRun --target-org " + alias + " --wait 33"]);
          quick = "not needed";
          windowText = "none";
          risks.push("No tests run, so smoke-test changed flows, layouts and validation rules by hand.");
        }
        risks.push("NoTestRun is only allowed in non-production orgs.");
      } else {
        level = "RunSpecifiedTests";
        var why = contents === "apex" ? "Validate with the covering tests" : "Validate with tests that exercise the affected automation";
        steps.push([why + (early ? " (up to 10 days ahead)" : ""),
          "sf project deploy validate --source-dir force-app --test-level RunSpecifiedTests " + TESTS + " --target-org " + alias + " --wait 33"]);
        steps.push(["Record the job id from the validate result", "sf project deploy report --job-id <validation-job-id> --target-org " + alias]);
        steps.push([early ? "Quick deploy inside the release window" : "Quick deploy right after review", "sf project deploy quick --job-id <validation-job-id> --target-org " + alias + " --wait 20"]);
        quick = "yes, within 10 days of a successful validation with passing tests";
        windowText = early ? "validate days ahead, quick deploy in minutes on the night" : "validate and quick deploy back to back";
        if (target === "prod" && contents === "apex") {
          risks.push("RunSpecifiedTests in production: the named tests must take every class and trigger in the deploy to 75% individually.");
        } else if (target === "prod") {
          risks.push("NoTestRun is not allowed in production; the house standard runs specified tests even for metadata-only releases.");
        } else {
          risks.push("Sandboxes do not enforce the 75% gate, but the house bar (90% new, 85% modified) is still read from this result.");
        }
        if (early) risks.push("Another deploy to the same org after validation can invalidate it; re-validate if the quick deploy is refused.");
        else risks.push("Tests run during the validate, so the slow part happens before the window, not during it.");
      }
      return { steps: steps, level: level, quick: quick, windowText: windowText, risks: risks, alias: alias };
    }

    function paint() {
      var p = plan();
      clear(stage);
      var list = h("ol", { class: "ob-steps" });
      for (var i = 0; i < p.steps.length; i++) {
        list.appendChild(h("li", { class: "ob-step" + (i === p.steps.length - 1 ? " is-active" : " is-done") },
          h("span", { class: "ob-num" }, String(i + 1)),
          h("div", { class: "ob-stack" }, h("span", {}, p.steps[i][0]), h("span", { class: "ob-mono" }, p.steps[i][1]))));
      }
      stage.appendChild(list);
      var riskBox = h("div", { class: "ob-stack", style: "margin-top:12px" });
      for (var r = 0; r < p.risks.length; r++) {
        riskBox.appendChild(h("div", { class: "ob-row" }, h("span", { class: "ob-chip warn" }, "risk"), h("span", { class: "ob-dim" }, p.risks[r])));
      }
      stage.appendChild(riskBox);
      clear(readout);
      readout.appendChild(ro("org alias", p.alias));
      readout.appendChild(ro("test level", p.level));
      readout.appendChild(ro("quick deploy", p.quick));
      readout.appendChild(ro("timing", p.windowText));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field" }, h("label", {}, "Target"),
        segment([["sandbox", "Sandbox"], ["prod", "Production"]], 1, function (v) { target = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Contents"),
        segment([["meta", "Metadata only, no Apex"], ["apex", "Includes Apex classes or triggers"]], 1, function (v) { contents = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Urgency"),
        segment([["normal", "Normal release window"], ["early", "Pre-validate days ahead"]], 0, function (v) { urgency = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ops-dx": {
      title: "Salesforce DX checkpoint",
      sub: "Source format, the sf CLI, scratch orgs and source tracking.",
      questions: [
        { q: "In a source-driven team, what is the system of record for metadata?",
          options: ["The Git repository; orgs are disposable targets built from it", "The production org; Git is a periodic backup", "Whichever sandbox the lead developer uses", "The most recent change set"], answer: 0,
          explain: "Source-driven development inverts the old model: the repository is the truth and every org, including production, is built from it. That is what makes reviews, rollbacks and repeatable environments possible. Changes made directly in an org must be retrieved and committed or they will be overwritten." },
        { q: "A CI job must authenticate to production without a browser. Which approach fits the house standard?",
          options: ["Store the integration user's password in the pipeline file", "Run sf org login web on the build agent", "sf org login jwt with the consumer key and key file supplied as CI secret variables such as $SF_CONSUMER_KEY and $SF_JWT_KEY_FILE", "Commit an auth URL file to the repository"], answer: 2,
          explain: "The JWT bearer flow lets a headless job authenticate with a certificate-backed connected app and no password. The key file and consumer key live in the CI secret store and arrive as environment variables. Anything committed to the repository or typed into a pipeline file should be treated as leaked." },
        { q: "What does source tracking give you in a scratch org or tracking-enabled sandbox?",
          options: ["Automatic production backups", "The CLI knows what changed locally and in the org, so deploy start and retrieve start move only the differences and flag conflicts", "A full audit trail of every user's clicks", "Automatic merging of conflicting changes"], answer: 1,
          explain: "With tracking on, the CLI compares local files and org changes since the last sync. You can preview with deploy preview and retrieve preview, and conflicts are reported rather than silently overwritten. It does not merge for you or replace Setup Audit Trail." },
        { q: "What is the maximum lifetime you can request for a scratch org?",
          options: ["1 day", "7 days", "90 days", "30 days"], answer: 3,
          explain: "Scratch orgs default to 7 days and can be requested for up to 30 with --duration-days. They are designed to be thrown away and recreated from source and a definition file. Long-lived shared environments are a sandbox job." },
        { q: "Which file declares package directories and the source API version for a DX project?",
          options: ["package.xml", "sfdx-project.json", ".forceignore", "project-scratch-def.json"], answer: 1,
          explain: "sfdx-project.json defines where source lives, which directory is the default, the sourceApiVersion and any package definitions. package.xml is a Metadata API manifest, .forceignore excludes files from sync, and the scratch definition describes org shape." }
      ]
    },
    "ops-release": {
      title: "Packaging and release checkpoint",
      sub: "Manifests, unlocked packages, pipelines and validate-then-quick-deploy.",
      questions: [
        { q: "You must remove an obsolete Apex class from production as part of a release. What does the deploy need?",
          options: ["Delete the file locally; the next deploy removes it automatically", "A package.xml with the class name and an empty body", "A destructive changes manifest passed with --pre-destructive-changes or --post-destructive-changes, treated as a reviewed, escalated change", "An anonymous Apex script that drops the class"], answer: 2,
          explain: "Deploys add and update; deletions need an explicit destructive manifest so they are intentional and reviewable. Pre or post controls whether removal happens before or after the main deploy. Destructive changes are escalated in the house workflow because they are hard to undo." },
        { q: "Which statement about quick deploy is accurate?",
          options: ["It promotes a successful validation, with tests passed, within 10 days, without rerunning tests", "It skips tests entirely, so it is the safest way to deploy Apex", "It can be used on any validation regardless of age", "It only works for unlocked packages"], answer: 0,
          explain: "Quick deploy reuses the test results of a recent successful validation, which moves the slow part out of the release window. The validation must have run tests that passed and met coverage, and it expires after 10 days. Later deploys to the same org can also invalidate it." },
        { q: "What must be true before an unlocked package version can be promoted to released?",
          options: ["It must have a namespace", "It must be installed in production first", "It must contain no Apex", "It was created with --code-coverage and its Apex reached at least 75% coverage"], answer: 3,
          explain: "Promotion requires that the version was built with code coverage calculated and that coverage meets 75%. Beta versions without coverage can be installed in scratch orgs and sandboxes but not promoted. Unlocked packages can be namespace-less." },
        { q: "In production, you deploy two Apex classes with RunSpecifiedTests and the org-wide coverage is 82%. The deploy still fails on coverage. Why?",
          options: ["RunSpecifiedTests is not allowed in production", "With RunSpecifiedTests, each class and trigger in the deploy must reach 75% from the specified tests, and one of them did not", "Org-wide coverage must be 90% for specified tests", "Quick deploy was not used"], answer: 1,
          explain: "Specified-test deploys swap the org-wide rule for a per-component rule measured only from the tests you named. A class that those tests barely touch fails the deploy even if the org overall is well covered. Add or name the right covering tests rather than switching to running every local test." },
        { q: "Where does the Code Analyzer gate belong in a Salesforce CI pipeline?",
          options: ["Before any validate or deploy, on the files the change touches, failing the job on any finding", "After the production deploy, as a report", "Only on the main branch nightly", "Inside the quick deploy step"], answer: 0,
          explain: "A scan is cheap and catches limit, security and design problems before an org spends minutes running tests. Gating at pull request time keeps findings out of main entirely. Running it after deploy turns a gate into a postmortem." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ops = {
    id: "ops",
    name: "DevOps & Release",
    short: "OPS",
    tagline: "Git as the truth, the CLI as the hands",
    color: "#fb923c",
    blurb: "Move from clicking in orgs to source-driven delivery. Learn the DX project model, the sf CLI, scratch orgs and source tracking, then ship with manifests or unlocked packages through a CI pipeline that scans, validates with specified tests, and quick-deploys to production in minutes.",
    modules: [
      {
        id: "dx",
        name: "Salesforce DX",
        icon: "wrench",
        lessons: [
          {
            id: "sfdx-model",
            title: "Source-driven development with Salesforce DX",
            summary: "Make Git the system of record, understand source versus metadata format, and pick between org-based and package-based delivery.",
            minutes: 9,
            tags: ["sfdx", "source-control", "devops"],
            blocks: [
              { t: "p", html: "For years the org <em>was</em> the codebase: you clicked changes into a sandbox and moved them with change sets. Salesforce DX flips that. The mental model is <strong>Git as the blueprint and orgs as buildings</strong>: every org is constructed from the repository, and anything built on site without updating the blueprint gets demolished at the next deploy." },
              { t: "h", text: "The project on disk" },
              { t: "code", lang: "text", code: [
                "orbit-crm/",
                "  sfdx-project.json          project definition",
                "  .forceignore               files the CLI never syncs",
                "  config/project-scratch-def.json",
                "  manifest/package.xml       optional Metadata API manifest",
                "  force-app/main/default/",
                "    classes/  triggers/  lwc/  flows/",
                "    objects/Account/fields/Tier__c.field-meta.xml",
                "    permissionsets/"
              ].join("\n") },
              { t: "code", lang: "text", code: [
                "{",
                "  \"packageDirectories\": [",
                "    { \"path\": \"force-app\", \"default\": true }",
                "  ],",
                "  \"name\": \"orbit-crm\",",
                "  \"namespace\": \"\",",
                "  \"sfdcLoginUrl\": \"https://login.orgs.example\",",
                "  \"sourceApiVersion\": \"64.0\"",
                "}"
              ].join("\n") },
              { t: "p", html: "Set <code class='tok'>sourceApiVersion</code> to the API version your orgs currently run; the value above is illustrative." },
              { t: "h", text: "Source format versus metadata format" },
              { t: "table", headers: ["Aspect", "Source format (DX)", "Metadata format (Metadata API)"], rows: [
                ["Custom object", "One file per field, list view, validation rule", "One large <code class='tok'>.object</code> file"],
                ["Merge conflicts", "Small and local", "Frequent, in giant XML files"],
                ["Used by", "<code class='tok'>sf project deploy start</code> and <code class='tok'>retrieve start</code>", "Manifest-driven tooling and older pipelines"],
                ["Convert", "<code class='tok'>sf project convert source</code>", "<code class='tok'>sf project convert mdapi</code>"]
              ] },
              { t: "note", variant: "tip", html: "Add org-generated noise to <code class='tok'>.forceignore</code> (for example profile files you do not manage in source, or local test artefacts) so retrieves stay focused on what your team owns." },
              { t: "h", text: "Delivery models" },
              { t: "table", headers: ["Tier", "Model", "Trade-off"], rows: [
                ["Naive", "Change sets between sandboxes", "No version history, no review, manual and unrepeatable"],
                ["Solid", "Org-based: one repo, CI deploys <code class='tok'>force-app</code> or a manifest to each org", "Simple and fast to adopt; the org still holds an undivided pile of metadata"],
                ["Standout", "Package-based: modules as unlocked packages with declared dependencies, versioned and installed", "Clear ownership and versioned releases, at the cost of untangling dependencies first"]
              ] },
              { t: "note", variant: "warn", html: "Hotfixes clicked straight into production break the model. If an emergency forces it, retrieve the change and commit it the same day, or the next release silently reverts it." },
              { t: "cue", html: "Talk source-driven development when you hear <em>\"we use change sets\"</em>, <em>\"someone overwrote my flow\"</em>, <em>\"which sandbox has the latest\"</em>, or <em>\"we can't tell what changed in the release\"</em>." },
              { t: "note", variant: "key", html: "<strong>The repository is the truth; orgs are built from it.</strong> Source format keeps diffs small, and you can grow from org-based deploys to unlocked packages as ownership boundaries become clear." }
            ]
          },
          {
            id: "sf-cli",
            title: "The sf CLI essentials",
            summary: "Authenticate, deploy, retrieve, test and query with the unified sf CLI, and know how it maps to legacy commands.",
            minutes: 10,
            tags: ["sf-cli", "sfdx", "automation"],
            blocks: [
              { t: "p", html: "The <code class='tok'>sf</code> CLI is the <strong>one pair of hands</strong> that touches every org. Commands follow a noun-verb shape (<code class='tok'>sf project deploy start</code>, <code class='tok'>sf org create scratch</code>), every command accepts <code class='tok'>--json</code> for scripting, and orgs are always addressed by alias, never by typing a username into a script." },
              { t: "h", text: "Authenticate" },
              { t: "code", lang: "bash", code: [
                "# interactive, on a laptop",
                "sf org login web --alias devhub --set-default-dev-hub",
                "sf org login web --alias uat",
                "",
                "# headless, in CI: values come from the CI secret store",
                "sf org login jwt \\",
                "  --client-id \"$SF_CONSUMER_KEY\" \\",
                "  --jwt-key-file \"$SF_JWT_KEY_FILE\" \\",
                "  --username \"$SF_DEPLOY_USERNAME\" \\",
                "  --instance-url \"$SF_INSTANCE_URL\" \\",
                "  --alias prod",
                "",
                "sf org list",
                "sf config set target-org uat"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Never commit passwords, auth URL files or private keys, and never echo them in logs. JWT key files and consumer keys belong in the CI secret store and reach the job as environment variables." },
              { t: "h", text: "Everyday commands" },
              { t: "table", headers: ["Job", "Command"], rows: [
                ["Deploy a folder", "<code class='tok'>sf project deploy start --source-dir force-app --target-org uat</code>"],
                ["Deploy a manifest", "<code class='tok'>sf project deploy start --manifest manifest/package.xml --target-org uat</code>"],
                ["Dry run with tests", "<code class='tok'>sf project deploy validate --source-dir force-app --test-level RunSpecifiedTests --tests AccountServiceTest --target-org uat</code>"],
                ["Retrieve one component", "<code class='tok'>sf project retrieve start --metadata ApexClass:AccountService --target-org uat</code>"],
                ["Build a manifest from source", "<code class='tok'>sf project generate manifest --source-dir force-app --output-dir manifest</code>"],
                ["Run tests", "<code class='tok'>sf apex run test --class-names AccountServiceTest --code-coverage --result-format human --wait 10</code>"],
                ["Query data", "<code class='tok'>sf data query --query \"SELECT Id, Name FROM Account LIMIT 5\" --target-org uat</code>"],
                ["Check a running deploy", "<code class='tok'>sf project deploy report --job-id &lt;id&gt;</code>"],
                ["Scan code", "<code class='tok'>sf code-analyzer run --rule-selector pmd:Recommended --target force-app</code>"]
              ] },
              { t: "h", text: "Legacy command map" },
              { t: "table", headers: ["Legacy sfdx (do not use in new scripts)", "Modern sf"], rows: [
                ["<code class='tok'>sfdx force:source:deploy</code>", "<code class='tok'>sf project deploy start</code>"],
                ["<code class='tok'>sfdx force:source:retrieve</code>", "<code class='tok'>sf project retrieve start</code>"],
                ["<code class='tok'>sfdx force:org:create</code>", "<code class='tok'>sf org create scratch</code>"],
                ["<code class='tok'>sfdx force:apex:test:run</code>", "<code class='tok'>sf apex run test</code>"],
                ["<code class='tok'>sfdx force:auth:jwt:grant</code>", "<code class='tok'>sf org login jwt</code>"]
              ] },
              { t: "note", variant: "tip", html: "Use <code class='tok'>--json</code> in automation and parse fields such as <code class='tok'>result.status</code> and the job id with a JSON tool. Human-readable output changes between releases; the JSON shape is far more stable." },
              { t: "compare",
                bad: { title: "Fragile script", items: ["Username and password in the script", "Parses table output with grep", "Relies on whatever default org is set", "Uses force: commands"] },
                good: { title: "Durable script", items: ["JWT with secrets from the CI store", "Parses --json output", "Passes --target-org alias explicitly", "Uses sf noun-verb commands"] } },
              { t: "cue", html: "Lean on these commands when you hear <em>\"how do we deploy from the pipeline\"</em>, <em>\"the script broke after a CLI upgrade\"</em>, or <em>\"what is the sf equivalent of force:source:deploy\"</em>." },
              { t: "note", variant: "key", html: "<strong>Alias every org, authenticate CI with JWT from secrets, script against --json.</strong> The sf noun-verb commands replace the legacy force: namespace." }
            ]
          },
          {
            id: "scratch-orgs",
            title: "Scratch orgs and source tracking",
            summary: "Disposable orgs built from a definition file, and the tracking that keeps local files and org changes in sync.",
            minutes: 9,
            tags: ["scratch-orgs", "source-tracking", "sfdx"],
            blocks: [
              { t: "p", html: "A scratch org is a <strong>hotel room, not a house</strong>. You check in with a definition of the room you need, push your source, work for days, and check out. Nothing important lives only in the room, so throwing it away costs nothing. Shared, long-lived environments such as UAT stay sandboxes; see <a href='#/plat/envs/sandboxes'>sandbox types</a>." },
              { t: "h", text: "Shape and create" },
              { t: "code", lang: "text", code: [
                "{",
                "  \"orgName\": \"Orbit feature org\",",
                "  \"edition\": \"Developer\",",
                "  \"features\": [\"EnableSetPasswordInApi\"],",
                "  \"settings\": {",
                "    \"lightningExperienceSettings\": { \"enableS1DesktopEnabled\": true }",
                "  }",
                "}"
              ].join("\n") },
              { t: "code", lang: "bash", code: [
                "sf org create scratch --definition-file config/project-scratch-def.json \\",
                "  --alias tiering-feature --duration-days 7 --set-default --target-dev-hub devhub",
                "sf project deploy start                    # push tracked local source",
                "sf org assign permset --name Account_Tiering",
                "sf data import tree --plan data/sample-plan.json",
                "sf org open",
                "# ... build in the org, then pull clicks back to source",
                "sf project retrieve preview",
                "sf project retrieve start",
                "sf org delete scratch --target-org tiering-feature --no-prompt"
              ].join("\n") },
              { t: "h", text: "How source tracking works" },
              { t: "ul", items: [
                "The CLI records what it last synced. <code class='tok'>sf project deploy start</code> with no arguments sends only local changes; <code class='tok'>sf project retrieve start</code> pulls only org-side changes.",
                "<code class='tok'>deploy preview</code> and <code class='tok'>retrieve preview</code> show what would move and flag <strong>conflicts</strong> when the same component changed on both sides.",
                "Tracking is available in scratch orgs and in Developer and Developer Pro sandboxes with tracking enabled.",
                "Tracking is a convenience for development orgs, not a release mechanism; releases still go through validated deploys."
              ] },
              { t: "table", headers: ["Choice", "Buys you", "Costs you"], rows: [
                ["Scratch org per feature", "Clean, reproducible shape; parallel work without collisions", "Setup scripts and sample data to maintain; daily and active-org allocations from the Dev Hub edition"],
                ["Shared developer sandbox", "Realistic configuration and data", "Developers step on each other; drift from source"],
                ["Tracking-enabled sandbox", "Source tracking with production-like config", "Refresh cadence and size limits still apply"]
              ] },
              { t: "note", variant: "trap", html: "If a feature only works after manual clicks in the scratch org, it is not in source yet. The test is simple: delete the org, recreate it from the definition file and scripts, and see whether the feature still works." },
              { t: "note", variant: "tip", html: "Keep a single setup script (create, deploy, assign permission sets, load data) in the repository. New joiners and CI both run the same script, so \"works on my org\" disappears." },
              { t: "cue", html: "Reach for scratch orgs when you hear <em>\"our dev sandbox is a mess\"</em>, <em>\"two features collided in the same org\"</em>, or <em>\"I can't reproduce it from source\"</em>." },
              { t: "quiz", id: "ops-dx" },
              { t: "note", variant: "key", html: "<strong>Scratch orgs are disposable and built from source; tracking moves only what changed.</strong> If deleting and recreating the org breaks the feature, the feature is not in Git yet." }
            ]
          }
        ]
      },
      {
        id: "release",
        name: "Packaging & Release",
        icon: "cube",
        lessons: [
          {
            id: "metadata-deploy",
            title: "Metadata API deploys and package.xml",
            summary: "Manifest-driven deploys, destructive changes and the transactional rules that govern a release.",
            minutes: 9,
            tags: ["metadata-api", "package-xml", "deploy"],
            blocks: [
              { t: "p", html: "Every deploy, whatever tool starts it, ends up as a <strong>Metadata API transaction</strong>: a zip of components the org applies as one unit. A manifest is the <strong>packing list</strong> for that zip. It names component types and members so you ship exactly what you mean, not whatever happens to be in the folder." },
              { t: "code", lang: "text", code: [
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
                "<!-- the root also carries the standard Metadata API xmlns; generate manifest writes it -->",
                "<Package>",
                "    <types>",
                "        <members>AccountService</members>",
                "        <members>AccountServiceTest</members>",
                "        <name>ApexClass</name>",
                "    </types>",
                "    <types>",
                "        <members>Account.Tier__c</members>",
                "        <name>CustomField</name>",
                "    </types>",
                "    <types>",
                "        <members>Account_Tiering</members>",
                "        <name>PermissionSet</name>",
                "    </types>",
                "    <version>64.0</version>",
                "</Package>"
              ].join("\n") },
              { t: "code", lang: "bash", code: [
                "sf project generate manifest --source-dir force-app --output-dir manifest",
                "sf project deploy start --manifest manifest/package.xml --target-org uat --wait 33",
                "",
                "# deletions are explicit and reviewed",
                "sf project deploy start --manifest manifest/package.xml \\",
                "  --post-destructive-changes manifest/destructiveChangesPost.xml --target-org uat"
              ].join("\n") },
              { t: "h", text: "Rules of the transaction" },
              { t: "ul", items: [
                "<strong>All or nothing in production.</strong> Any component error or failed test rolls the whole deploy back.",
                "<strong>Dependencies resolve inside the zip or the org.</strong> A permission set that references a new field must ship with the field or after it.",
                "<strong>Deletes need a destructive manifest.</strong> Pre-destructive runs before the main deploy, post-destructive after it.",
                "<strong>Profiles and permission sets deploy what you send</strong>, which for profiles can mean only the parts present in the file, so prefer permission sets."
              ] },
              { t: "table", headers: ["Order", "Component family", "Why here"], rows: [
                ["1", "Objects, fields, record types", "Everything else references them"],
                ["2", "Custom metadata, custom permissions, permission sets", "Configuration and access that code checks"],
                ["3", "Layouts, flexipages, flows", "Reference fields and permissions"],
                ["4", "Apex: selectors and utilities, then services and handlers, then controllers", "Compile-time dependencies"],
                ["5", "Triggers, then LWC", "Depend on handlers and controllers"]
              ] },
              { t: "note", variant: "warn", html: "Destructive changes, API renames and field type shrinks are hard or impossible to undo. In the house workflow they are escalated for explicit review rather than slipped into a routine release." },
              { t: "compare",
                bad: { title: "Deploy the world", items: ["Ship all of force-app every time", "Hidden changes ride along", "Long deploys and big blast radius"] },
                good: { title: "Deploy the change", items: ["Manifest or source-dir scoped to the change", "Reviewers see exactly what ships", "Shorter deploys, easier rollback"] } },
              { t: "cue", html: "Reach for a manifest when you hear <em>\"we need to delete a field\"</em>, <em>\"the deploy picked up someone else's change\"</em>, or <em>\"the permission set failed because the field didn't exist yet\"</em>." },
              { t: "note", variant: "key", html: "<strong>A deploy is one transaction; the manifest is its packing list.</strong> Scope it to the change, ship dependencies together, and make every deletion explicit." }
            ]
          },
          {
            id: "unlocked-packages",
            title: "Unlocked packages",
            summary: "Versioned, installable modules of metadata with declared dependencies, built from a Dev Hub.",
            minutes: 10,
            tags: ["packaging", "unlocked-packages", "sfdx"],
            blocks: [
              { t: "p", html: "An unlocked package is a <strong>sealed, labelled box</strong> of metadata. You build a version once, install that exact version in UAT and then production, and you can always ask an org which version of the box it has. Unlike managed packages, the contents stay editable in the org, which is flexible but means discipline must come from the team." },
              { t: "code", lang: "text", code: [
                "{",
                "  \"packageDirectories\": [",
                "    { \"path\": \"core\", \"package\": \"OrbitCore\", \"versionNumber\": \"1.4.0.NEXT\", \"default\": false },",
                "    { \"path\": \"force-app\", \"package\": \"OrbitSales\", \"versionNumber\": \"2.1.0.NEXT\", \"default\": true,",
                "      \"dependencies\": [ { \"package\": \"OrbitCore\", \"versionNumber\": \"1.4.0.LATEST\" } ] }",
                "  ],",
                "  \"namespace\": \"\",",
                "  \"sourceApiVersion\": \"64.0\",",
                "  \"packageAliases\": { \"OrbitCore\": \"<package-id-written-by-the-cli>\", \"OrbitSales\": \"<package-id-written-by-the-cli>\" }",
                "}"
              ].join("\n") },
              { t: "code", lang: "bash", code: [
                "sf package create --name OrbitCore --package-type Unlocked --path core --no-namespace --target-dev-hub devhub",
                "",
                "sf package version create --package OrbitCore --installation-key-bypass \\",
                "  --code-coverage --wait 30 --target-dev-hub devhub",
                "",
                "sf package install --package \"OrbitCore@1.4.0-1\" --target-org uat --wait 20",
                "sf package version promote --package \"OrbitCore@1.4.0-1\" --target-dev-hub devhub",
                "sf package install --package \"OrbitCore@1.4.0-1\" --target-org prod --wait 20"
              ].join("\n") },
              { t: "p", html: "Package aliases are written into <code class='tok'>sfdx-project.json</code> by the CLI when you create packages and versions; refer to versions by alias such as <code class='tok'>OrbitCore@1.4.0-1</code> in scripts instead of copying raw Ids around." },
              { t: "table", headers: ["Version state", "Can install in", "Requirement"], rows: [
                ["Beta (not promoted)", "Scratch orgs and sandboxes", "Build succeeds"],
                ["Released (promoted)", "Any org, including production", "Built with <code class='tok'>--code-coverage</code> and at least 75% Apex coverage"]
              ] },
              { t: "table", headers: ["Tier", "Packaging approach", "Trade-off"], rows: [
                ["Naive", "One giant unlocked package wrapping all of force-app", "Versioned, but every change rebuilds everything and nothing is really modular"],
                ["Solid", "A small core package (shared objects, utilities) plus feature packages depending on it", "Clear layering; requires moving metadata into the right directory"],
                ["Standout", "Packages aligned to team ownership with explicit dependency versions and CI that builds, installs and tests each version in a scratch org", "Independent release trains, at the cost of real dependency hygiene"]
              ] },
              { t: "note", variant: "warn", html: "Installation keys protect who can install a version. If you use one, pass it from a CI secret (for example <code class='tok'>--installation-key \"$PKG_INSTALL_KEY\"</code>), never as a literal in a script." },
              { t: "note", variant: "tip", html: "Org-dependent unlocked packages exist for metadata that cannot be cleanly separated from the org yet. They are a migration aid with weaker build-time validation, so plan to graduate from them." },
              { t: "cue", html: "Consider unlocked packages when you hear <em>\"which version is in production\"</em>, <em>\"two teams keep breaking each other's releases\"</em>, or <em>\"we want to roll back the whole feature\"</em>." },
              { t: "note", variant: "key", html: "<strong>Build a version once, install the same version everywhere, promote only with 75% coverage.</strong> Package boundaries should follow ownership, with dependencies declared rather than implied." }
            ]
          },
          {
            id: "cicd",
            title: "CI/CD pipelines for Salesforce",
            summary: "From pull request to production: scan, validate with specified tests, promote the same artifact, quick deploy.",
            minutes: 11,
            tags: ["cicd", "pipeline", "devops"],
            blocks: [
              { t: "p", html: "A Salesforce pipeline is a <strong>conveyor belt with inspection stations</strong>. The same change rides from a branch through review, scanning and test validation, lands in UAT, and reaches production only as a quick deploy of something already proven. Humans approve at defined points; nobody carries metadata by hand." },
              { t: "diagram", id: "sfdx-pipeline", caption: "Git holds the change in source format; the pull request gets review and the scanner gate; CI validates with tests; the same artifact goes to UAT; production receives a quick deploy of a validated job." },
              { t: "h", text: "Stages and gates" },
              { t: "ol", items: [
                "<strong>Pull request</strong>: peer review, plus <code class='tok'>sf code-analyzer run</code> on touched files with zero findings required.",
                "<strong>Validate</strong>: <code class='tok'>sf project deploy validate</code> against an integration org or scratch org with <code class='tok'>RunSpecifiedTests</code> naming the covering test classes; capture per-class coverage against the 90/85 house bar.",
                "<strong>Merge and deploy to UAT</strong>: the merged commit deploys to UAT for business testing; metadata-only changes may use <code class='tok'>NoTestRun</code> there.",
                "<strong>Validate production</strong> ahead of the window with the same specified tests.",
                "<strong>Approve and quick deploy</strong> with <code class='tok'>sf project deploy quick --job-id</code> after an explicit human go-ahead."
              ] },
              { t: "code", lang: "text", code: [
                "# pipeline.yml - illustrative; adapt to your CI system",
                "stages: [scan, validate, deploy]",
                "",
                "scan:",
                "  script:",
                "    - sf code-analyzer run --rule-selector pmd:Recommended --target force-app --output-file scan.json",
                "    - test \"$(jq '[.violations[]?] | length' scan.json)\" -eq 0",
                "",
                "validate_prod:",
                "  needs: [scan]",
                "  script:",
                "    - sf org login jwt --client-id \"$SF_CONSUMER_KEY\" --jwt-key-file \"$SF_JWT_KEY_FILE\"",
                "        --username \"$SF_DEPLOY_USERNAME\" --instance-url \"$SF_INSTANCE_URL\" --alias prod",
                "    - sf project deploy validate --source-dir force-app --test-level RunSpecifiedTests",
                "        --tests AccountServiceTest --tests AccountTriggerHandlerTest --target-org prod --json > validate.json",
                "    - jq -r '.result.id' validate.json > validation-id.txt",
                "",
                "deploy_prod:",
                "  needs: [validate_prod]",
                "  when: manual            # human approval gate",
                "  script:",
                "    - sf project deploy quick --job-id \"$(cat validation-id.txt)\" --target-org prod --wait 20"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Pipeline secrets (the JWT key file, consumer key, deploy username) come from the CI secret store as variables such as <code class='tok'>$SF_JWT_KEY_FILE</code> and <code class='tok'>$SF_CONSUMER_KEY</code>. Scope the connected app and integration user to deploy permissions only, and never print these values." },
              { t: "h", text: "Delta or full deploys" },
              { t: "table", headers: ["Tier", "What CI deploys", "Trade-off"], rows: [
                ["Naive", "Everything in force-app, running every local test", "Slow, and unrelated failures block every release"],
                ["Solid", "A delta built from the Git diff, validated with specified covering tests", "Fast and focused; you must keep the diff-to-manifest logic and test mapping correct"],
                ["Standout", "Delta deploys plus a scheduled full validate of main against a production-like sandbox", "Fast releases with a safety net that catches drift the deltas miss"]
              ] },
              { t: "note", variant: "tip", html: "Keep a simple mapping from production classes to their covering tests (by convention <code class='tok'>AccountService</code> to <code class='tok'>AccountServiceTest</code>, discovered by search when the test was not touched). The pipeline then builds the <code class='tok'>--tests</code> list automatically." },
              { t: "compare",
                bad: { title: "Hand-carried release", items: ["Someone deploys from a laptop at midnight", "Tests run during the window", "No record of what shipped"] },
                good: { title: "Pipeline release", items: ["CI validates days ahead", "Quick deploy takes minutes", "The job id and commit trace every release"] } },
              { t: "cue", html: "Design the pipeline when you hear <em>\"deploys take three hours\"</em>, <em>\"we found a PMD issue after go-live\"</em>, or <em>\"who approved this production change\"</em>." },
              { t: "note", variant: "key", html: "<strong>Scan, validate with specified tests, approve, quick deploy.</strong> Production only ever receives a job that CI already validated, from secrets CI never prints." }
            ]
          },
          {
            id: "deploy-validation",
            title: "Validate, quick deploy and test levels",
            summary: "Choose the right test level, move test time out of the release window, and know exactly which coverage rule applies.",
            minutes: 11,
            tags: ["deploy", "test-levels", "quick-deploy"],
            blocks: [
              { t: "p", html: "Think of a release as a <strong>dress rehearsal and a curtain call</strong>. The validate is the rehearsal: the org compiles everything and runs your tests without committing. Quick deploy is the curtain call: it reuses the rehearsal's results and commits in minutes. The test level decides how big the rehearsal is." },
              { t: "h", text: "Test levels" },
              { t: "table", headers: ["Level", "What runs", "Where it fits"], rows: [
                ["<code class='tok'>NoTestRun</code>", "No tests", "Non-production orgs only; metadata-only changes such as LWC, layouts or config"],
                ["<code class='tok'>RunSpecifiedTests</code>", "Only the named test classes; each class and trigger deployed must reach 75% from them", "The house standard whenever production Apex is in scope, and for production releases generally"],
                ["<code class='tok'>RunLocalTests</code>", "All tests outside managed packages; 75% org-wide", "Platform default for production deploys that contain Apex; not used in the house flow"],
                ["<code class='tok'>RunAllTestsInOrg</code>", "Everything, including managed package tests", "Rare; very slow"]
              ] },
              { t: "note", variant: "tip", html: "Recent releases also offer a newer test level that lets the platform choose relevant tests. The house standard does not use it, preferring explicit, reviewable test lists." },
              { t: "widget", id: "obDeployPlanner" },
              { t: "p", html: "Toggle the planner to production plus Apex plus pre-validate and you get the canonical release: validate with named tests days ahead, keep the job id, quick deploy on the night. Switch to sandbox plus metadata-only and the plan collapses to a single <code class='tok'>NoTestRun</code> deploy." },
              { t: "h", text: "Quick deploy rules" },
              { t: "ul", items: [
                "The validation must have <strong>succeeded with tests run and passing</strong>, and met the coverage rule for its test level.",
                "It stays usable for <strong>up to 10 days</strong>; after that, validate again.",
                "Another deploy to the same org in between can invalidate it, so coordinate release windows.",
                "Use <code class='tok'>sf project deploy quick --job-id &lt;id&gt;</code>, or <code class='tok'>--use-most-recent</code> when the most recent validation is unambiguous."
              ] },
              { t: "code", lang: "bash", code: [
                "sf project deploy validate --source-dir force-app \\",
                "  --test-level RunSpecifiedTests --tests AccountServiceTest --tests AccountTriggerHandlerTest \\",
                "  --target-org prod --wait 33 --json > validate.json",
                "",
                "sf project deploy report --job-id <validation-job-id> --target-org prod",
                "sf project deploy quick --job-id <validation-job-id> --target-org prod --wait 20"
              ].join("\n") },
              { t: "table", headers: ["Tier", "Release approach", "Outcome"], rows: [
                ["Naive", "Deploy start to production with RunLocalTests during the window", "Hours of tests on the night; an unrelated failing test blocks the release"],
                ["Solid", "Validate with RunSpecifiedTests, then quick deploy", "Fast window; you own the covering-test list"],
                ["Standout", "Scan gate, validate days ahead, coverage captured per class against 90/85, human approval, quick deploy, deploy result checked for every component", "Predictable minutes-long releases with evidence for each step"]
              ] },
              { t: "note", variant: "trap", html: "A green validate in a sandbox does not prove production coverage: sandboxes do not enforce the 75% rule. Validate against production itself before the window." },
              { t: "cue", html: "Bring up validate and quick deploy when you hear <em>\"our deploy window is too short\"</em>, <em>\"we failed coverage even though the org is at 80%\"</em>, or <em>\"can we skip tests for this small change in prod\"</em>." },
              { t: "quiz", id: "ops-release" },
              { t: "note", variant: "key", html: "<strong>NoTestRun for non-prod metadata, RunSpecifiedTests for anything with Apex or bound for production, quick deploy within 10 days.</strong> Specified tests must cover each deployed class and trigger to 75% on their own." }
            ]
          }
        ]
      }
    ]
  };
})();
