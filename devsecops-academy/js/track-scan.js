/* =====================================================================
   FORGE · Security Testing Gates
   window.TRACKS.scan — modules: sast / sca / runtime

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   Block grammar: see the header of track-found.js.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
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
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
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

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  var Widgets = {};

  /* ==================================================================
     1. scanQualityGate — "Does this PR pass the gate?"
     A SonarQube-style gate evaluated on new code only.
  ================================================================== */
  Widgets.scanQualityGate = function (mount) {
    shell(mount, "gate", "Quality gate on new code",
      "Set the measured values for a pull request. The gate applies four conditions to new code only, the way a clean-as-you-code gate does, and shows which condition fails.");
    var coverage = 82, bugs = 0, hotspots = 100, dup = 2;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var conds = [
        { name: "Coverage on new code", rule: "at least 80%", val: coverage + "%", ok: coverage >= 80 },
        { name: "New bugs and vulnerabilities", rule: "0", val: String(bugs), ok: bugs === 0 },
        { name: "Security hotspots reviewed", rule: "100%", val: hotspots + "%", ok: hotspots >= 100 },
        { name: "Duplicated lines on new code", rule: "at most 3%", val: dup + "%", ok: dup <= 3 }
      ];
      var failed = 0, i;
      clear(stage);
      for (i = 0; i < conds.length; i++) {
        var c = conds[i];
        if (!c.ok) failed++;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:1fr 110px 70px 70px;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);font-size:0.86rem" },
          h("span", {}, c.name),
          h("span", { style: "color:var(--text-dim)" }, c.rule),
          h("span", { style: "font-family:var(--font-mono)" }, c.val),
          h("span", { style: "font-weight:700;color:" + (c.ok ? "var(--lime-ink)" : "var(--rose-ink)") }, c.ok ? "pass" : "fail")));
      }
      clear(readout);
      readout.appendChild(ro("gate", failed ? "FAILED" : "PASSED"));
      readout.appendChild(ro("conditions failing", failed + " of 4"));
      readout.appendChild(ro("pipeline", failed ? "waitForQualityGate aborts the build" : "continues to SCA stage"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[62, "Coverage 62%"], [82, "82%"], [91, "91%"]], 1, function (v) { coverage = v; paint(); }),
      segment([[0, "0 new bugs"], [1, "1 new bug"], [3, "3 new bugs"]], 0, function (v) { bugs = v; paint(); }),
      segment([[100, "Hotspots 100%"], [50, "Hotspots 50%"]], 0, function (v) { hotspots = v; paint(); }),
      segment([[2, "Dup 2%"], [7, "Dup 7%"]], 0, function (v) { dup = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. scanPrioritizer — "Which CVE first?"
     Deterministic risk score: severity x exploit likelihood x context.
  ================================================================== */
  Widgets.scanPrioritizer = function (mount) {
    shell(mount, "triage", "Prioritize a vulnerability with context",
      "CVSS alone ranks by worst-case severity. Add exploit likelihood (an EPSS-style probability), whether the vulnerable code is reachable, and whether the workload is exposed to the internet to get a fix-by decision.");
    var cvss = 9.8, epss = "high", reach = "yes", exposed = "yes";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var e = epss === "high" ? 1 : epss === "med" ? 0.6 : 0.25;
      var r = reach === "yes" ? 1 : 0.35;
      var x = exposed === "yes" ? 1 : 0.5;
      var score = Math.round(cvss * e * r * x * 10) / 10;
      var tier = score >= 7 ? "P1 — fix within 48 hours" : score >= 4 ? "P2 — fix this sprint" : score >= 2 ? "P3 — next regular patch cycle" : "P4 — track, accept or suppress with expiry";
      clear(stage);
      var pct = Math.round(score / 10 * 100);
      stage.appendChild(h("div", { style: "height:14px;border-radius:7px;background:var(--surface-solid);overflow:hidden" },
        h("i", { style: "display:block;height:100%;width:" + pct + "%;background:" + (score >= 7 ? "var(--rose)" : score >= 4 ? "var(--accent)" : "var(--cyan)") })));
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:8px" },
        "Contextual score " + score.toFixed(1) + " from CVSS " + cvss.toFixed(1) + ". Reachability and exposure are what cloud-context tools add on top of a plain scanner."));
      clear(readout);
      readout.appendChild(ro("contextual score", score.toFixed(1) + " / 10"));
      readout.appendChild(ro("decision", tier));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[9.8, "CVSS 9.8"], [7.5, "7.5"], [5.3, "5.3"]], 0, function (v) { cvss = v; paint(); }),
      segment([["high", "Exploited widely"], ["med", "Exploit public"], ["low", "No known exploit"]], 0, function (v) { epss = v; paint(); }),
      segment([["yes", "Reachable"], ["no", "Not reachable"]], 0, function (v) { reach = v; paint(); }),
      segment([["yes", "Internet-exposed"], ["no", "Internal only"]], 0, function (v) { exposed = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "scan-sast": {
      title: "SAST & SonarQube checkpoint",
      sub: "Rules, profiles, gates, coverage and the Jenkins integration.",
      questions: [
        {
          q: "What does SAST analyse?",
          options: ["A running application over HTTP", "Source code or bytecode without executing it", "Only third-party dependencies", "Cloud account configuration"],
          answer: 1,
          explain: "Static analysis reads code to find patterns such as injection sinks fed by untrusted input. DAST tests the running app; SCA inspects dependencies; CSPM inspects cloud configuration."
        },
        {
          q: "In SonarQube, what is the difference between a quality profile and a quality gate?",
          options: ["They are the same thing", "A profile is the set of rules applied during analysis; a gate is the pass or fail conditions on the resulting metrics", "A gate picks languages; a profile picks branches", "Profiles are only for coverage"],
          answer: 1,
          explain: "The quality profile decides which rules raise issues. The quality gate decides whether the project's measures (new issues, coverage, duplication, hotspots reviewed) are acceptable."
        },
        {
          q: "Why do modern gates focus on new code rather than overall code?",
          options: ["Old code has no bugs", "It lets teams stop adding debt immediately without being blocked by years of legacy findings", "Overall metrics cannot be computed", "It is required by law"],
          answer: 1,
          explain: "Gating on new code means every change must be clean, so overall quality improves steadily. Gating on overall code blocks everyone on legacy issues and gets the gate disabled."
        },
        {
          q: "In a Jenkinsfile, what does waitForQualityGate abortPipeline: true do?",
          options: ["Starts the SonarQube server", "Waits for SonarQube's webhook with the gate result and fails the build if the gate failed", "Uploads coverage", "Skips analysis on branches"],
          answer: 1,
          explain: "Analysis runs asynchronously on the server. waitForQualityGate pauses until SonarQube reports the gate status through its webhook, then aborts the pipeline on failure."
        },
        {
          q: "What is a security hotspot in SonarQube?",
          options: ["A confirmed vulnerability", "Security-sensitive code that a human must review to decide whether it is safe", "A slow test", "A duplicated block"],
          answer: 1,
          explain: "Hotspots flag code that may be fine in context, such as a regex or cookie setting. A reviewer marks each safe or fixed; gates commonly require all hotspots on new code to be reviewed."
        }
      ]
    },
    "scan-sca": {
      title: "SCA & Snyk checkpoint",
      sub: "Dependencies, containers, IaC, thresholds and alternatives.",
      questions: [
        {
          q: "What is the difference between snyk test and snyk monitor?",
          options: ["They are aliases", "test scans now and returns a pass or fail exit code; monitor uploads a snapshot so Snyk keeps alerting on newly disclosed issues", "monitor fixes issues automatically", "test only works on containers"],
          answer: 1,
          explain: "Use test as the pipeline gate. Use monitor after a successful build of the deployed branch so you are notified when a new CVE affects what is already in production."
        },
        {
          q: "Which flag makes snyk test fail only for high and critical issues?",
          options: ["--all-projects", "--severity-threshold=high", "--json", "--dev"],
          answer: 1,
          explain: "--severity-threshold sets the minimum severity that produces a failing exit code. Combine it with --fail-on=upgradable if you only want to block when a fix exists."
        },
        {
          q: "Why is a transitive dependency vulnerability harder to fix?",
          options: ["It is always low severity", "You do not declare it directly, so you must upgrade the parent that pulls it in or override the version", "Scanners cannot see it", "It only affects tests"],
          answer: 1,
          explain: "Transitive packages come in through your direct dependencies. Fixing them means upgrading the parent, or pinning or overriding the transitive version and testing for compatibility."
        },
        {
          q: "Which tool is an open-source scanner covering container images, file systems, IaC and SBOM generation?",
          options: ["Trivy", "Jenkins", "Argo CD", "Grafana"],
          answer: 0,
          explain: "Trivy scans images, file systems, repos and IaC, and can emit SBOMs. Grype is a similar image and SBOM vulnerability scanner; Dependabot raises upgrade PRs."
        },
        {
          q: "A critical CVE is in a library function your code never calls. What is a reasonable action?",
          options: ["Ignore it forever", "Lower its priority based on reachability, record a time-boxed exception with justification, and upgrade in the normal cycle", "Delete the scanner", "Block all deployments company-wide"],
          answer: 1,
          explain: "Reachability lowers real risk but code paths change. A documented, expiring exception keeps the decision visible and revisited rather than silently suppressed."
        }
      ]
    },
    "scan-runtime": {
      title: "DAST & IaC checkpoint",
      sub: "Testing the running app, scanning infrastructure code and plans, and keeping exceptions honest.",
      questions: [
        {
          q: "Where in the pipeline does DAST typically run?",
          options: ["Before compilation", "Against a deployed test or staging environment", "Only in production", "Inside the IDE"],
          answer: 1,
          explain: "DAST needs a running application to send requests to. Run a quick baseline scan on every staging deploy and a fuller authenticated scan on a schedule."
        },
        {
          q: "Checkov reports that a Terraform S3 bucket allows public reads. When is the cheapest time to fix it?",
          options: ["After the data leaks", "At the pull request, before terraform apply creates the bucket", "During the annual audit", "After production deploy"],
          answer: 1,
          explain: "IaC scanning catches misconfigurations before they exist in the cloud. Fixing a line of HCL is far cheaper than finding a public bucket in production."
        },
        {
          q: "An authenticated DAST scan needs a test account password. Where should the pipeline get it?",
          options: ["Hardcode it in the ZAP command", "Fetch it at runtime from the credential store or secrets manager by reference", "Commit it to the rules file", "Use a real customer's account"],
          answer: 1,
          explain: "The scan account is still a credential. Reference it from the store at runtime, use a dedicated test identity, and only scan environments you own and are authorized to test."
        },
        {
          q: "Why scan the Terraform plan JSON as well as the HCL source?",
          options: ["Plans are smaller", "The plan shows computed and module-resolved values that static code scanning cannot see", "HCL cannot be scanned", "It removes the need for review"],
          answer: 1,
          explain: "Variables, module defaults and computed attributes are only resolved in the plan. Scanning both catches misconfigurations that never appear literally in the source."
        },
        {
          q: "A Checkov rule fires on a bucket that is intentionally public for a static website. What is the best way to handle it?",
          options: ["Disable the rule globally", "Add an inline, justified skip on that resource so the exception is visible in the diff", "Delete the scanner stage", "Ignore the build failure"],
          answer: 1,
          explain: "Inline skips with a reason keep each exception reviewable and scoped to one resource. Global disables silently remove the protection for everything else."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.scan = {
    id: "scan",
    name: "Security Testing Gates",
    short: "SCAN",
    tagline: "SAST, SCA, DAST and IaC gates that fail the build",
    color: "#a78bfa",
    blurb: "Turn scanners into dependable gates: SonarQube and other SAST tools, Snyk and other SCA tools, DAST with ZAP and Burp, and IaC scanning with Checkov, tfsec and KICS. Policy as code (OPA, Gatekeeper, Kyverno) lives in the Containers track and secrets management in the Supply Chain track.",
    modules: [
      {
        id: "sast",
        name: "SAST & SonarQube",
        icon: "broom",
        lessons: [
          {
            id: "sast-basics",
            title: "SAST fundamentals and tool landscape",
            summary: "What static analysis finds, where it is weak, and how Checkmarx, Semgrep, CodeQL and Fortify compare.",
            minutes: 9,
            tags: ["foundation", "sast", "semgrep", "codeql", "checkmarx", "fortify"],
            blocks: [
              { t: "p", html: "<strong>Static Application Security Testing</strong> analyses source or compiled code without running it. Good SAST engines trace <strong>data flow</strong> from untrusted <em>sources</em> (request parameters, headers, files) to dangerous <em>sinks</em> (SQL execution, shell commands, HTML output) and report paths with no sanitizer in between." },
              { t: "compare",
                bad: { title: "Where SAST struggles", items: ["False positives on code that is safe in context", "Business-logic flaws such as broken authorization", "Runtime configuration and deployed environment issues", "Dynamic or reflection-heavy frameworks"] },
                good: { title: "Where SAST shines", items: ["Injection classes: SQL, command, path traversal, XSS", "Hardcoded credentials and weak crypto calls", "Runs on every PR in minutes", "Points to the exact line and data path"] } },
              { t: "table", headers: ["Tool", "Model", "Strength", "Typical fit"], rows: [
                ["SonarQube / SonarCloud", "Rules plus taint analysis; quality and security", "Quality gates, technical debt, broad language support", "Default code quality and SAST gate"],
                ["Checkmarx", "Commercial, deep data-flow queries", "Enterprise policy, broad language coverage", "Regulated enterprises"],
                ["Semgrep", "Pattern rules that look like code", "Fast, easy custom rules, good PR feedback", "Teams writing their own guardrails"],
                ["CodeQL", "Code as a queryable database", "Precise variant analysis, powerful custom queries", "GitHub-centric orgs, research-grade checks"],
                ["Fortify", "Commercial static analyzer", "Mature rule packs, audit workflow", "Long-standing enterprise programs"]
              ] },
              { t: "code", lang: "yaml", code:
                "# A Semgrep rule: block string-built SQL in a Java DAO\n" +
                "rules:\n" +
                "  - id: java-sql-string-concat\n" +
                "    languages: [java]\n" +
                "    severity: ERROR\n" +
                "    message: Build SQL with PreparedStatement parameters, not string concatenation\n" +
                "    pattern: $STMT.executeQuery(\"...\" + $INPUT)"
              },
              { t: "note", variant: "tip", html: "Tune for precision first. Developers forgive a missed finding far more readily than ten false alarms per PR — noisy tools get muted." },
              { t: "note", variant: "key", html: "<strong>SAST follows untrusted data from source to sink in code you wrote.</strong> Pick the engine your teams will actually tune and act on; run it on every pull request." }
            ]
          },
          {
            id: "sonarqube",
            title: "SonarQube: rules, quality profiles, gates, coverage and debt",
            summary: "How SonarQube models code health and how to build a gate developers respect.",
            minutes: 10,
            tags: ["foundation", "sonarqube", "quality-gate", "coverage", "technical-debt"],
            blocks: [
              { t: "table", headers: ["Concept", "What it is", "Who owns it"], rows: [
                ["Rule", "One check, e.g. 'SQL built from user input'", "Sonar, plus your custom rules"],
                ["Quality profile", "The set of rules active for a language", "Central AppSec or platform team"],
                ["Issue", "A rule violation: bug, vulnerability or code smell", "The developer"],
                ["Security hotspot", "Sensitive code needing human review", "Developer plus security reviewer"],
                ["Quality gate", "Pass/fail conditions on measures", "Central team, one default gate"],
                ["New code period", "What counts as new: since previous version, a branch, or N days", "Project setting"]
              ] },
              { t: "h", text: "Coverage and technical debt" },
              { t: "p", html: "SonarQube does not run tests; it <strong>imports coverage reports</strong> (JaCoCo for Java, lcov for JavaScript, coverage.xml for Python). <strong>Technical debt</strong> is the estimated remediation effort for code smells, and the <strong>maintainability rating</strong> (A to E) is the debt ratio against development cost." },
              { t: "widget", id: "scanQualityGate" },
              { t: "h", text: "Analysing a project" },
              { t: "code", lang: "properties", code:
                "# sonar-project.properties (non-Maven projects)\n" +
                "sonar.projectKey=payments-api\n" +
                "sonar.sources=src\n" +
                "sonar.tests=test\n" +
                "sonar.javascript.lcov.reportPaths=coverage/lcov.info\n" +
                "# the server URL and token come from the CI environment, never from this file"
              },
              { t: "note", variant: "trap", html: "Coverage gates are easy to game with assertion-free tests. Pair a coverage threshold with review of test quality, and consider mutation testing for critical modules." },
              { t: "note", variant: "key", html: "<strong>Profiles decide what is flagged; the gate decides what blocks.</strong> Keep one central gate, measured on new code, with zero new vulnerabilities and all hotspots reviewed." }
            ]
          },
          {
            id: "sonar-jenkins",
            title: "SonarQube in Jenkins: withSonarQubeEnv and waitForQualityGate",
            summary: "Wire analysis and the gate into a declarative pipeline without exposing the token.",
            minutes: 8,
            tags: ["practitioner", "sonarqube", "jenkins", "quality-gate"],
            blocks: [
              { t: "p", html: "The SonarQube Scanner plugin stores the server URL and an authentication token (a Jenkins credential) under a named server configuration. <code class='tok'>withSonarQubeEnv</code> injects them into the step; <code class='tok'>waitForQualityGate</code> blocks on the server's webhook." },
              { t: "code", lang: "groovy", code:
                "stage('SonarQube analysis') {\n" +
                "  steps {\n" +
                "    // 'sonar-main' is the server config in Manage Jenkins; its token is a stored credential\n" +
                "    withSonarQubeEnv('sonar-main') {\n" +
                "      sh './mvnw -B -ntp sonar:sonar -Dsonar.projectKey=payments-api'\n" +
                "    }\n" +
                "  }\n" +
                "}\n" +
                "stage('Quality gate') {\n" +
                "  steps {\n" +
                "    timeout(time: 10, unit: 'MINUTES') {\n" +
                "      waitForQualityGate abortPipeline: true\n" +
                "    }\n" +
                "  }\n" +
                "}"
              },
              { t: "ol", items: [
                "Configure a webhook in SonarQube pointing at Jenkins' sonarqube-webhook endpoint so the gate result is pushed back.",
                "Wrap the wait in a timeout so a lost webhook cannot hang the pipeline forever.",
                "For PRs, enable pull-request decoration so issues appear as review comments.",
                "Use a project-scoped analysis token, not a personal admin token."
              ] },
              { t: "note", variant: "warn", html: "Passing <code class='tok'>-Dsonar.login=&lt;token&gt;</code> literally on the command line puts the token in logs and process listings. Let <code class='tok'>withSonarQubeEnv</code> inject it." },
              { t: "quiz", id: "scan-sast" },
              { t: "note", variant: "key", html: "<strong>Analyse inside withSonarQubeEnv, block on waitForQualityGate, wrap it in a timeout.</strong> The token stays in the credential store and the gate result decides the build." }
            ]
          }
        ]
      },
      {
        id: "sca",
        name: "SCA & Snyk",
        icon: "blocks",
        lessons: [
          {
            id: "sca-basics",
            title: "Software composition analysis and dependency risk",
            summary: "Direct and transitive dependencies, CVEs, licences, and how to prioritize fixes.",
            minutes: 9,
            tags: ["foundation", "sca", "cve", "cvss", "epss", "licenses"],
            blocks: [
              { t: "p", html: "Most of a modern application is <strong>other people's code</strong>. SCA builds the dependency tree from manifests and lockfiles (or from an SBOM), then matches each package and version against vulnerability databases and licence data." },
              { t: "stat", items: [
                { v: "70–90%", k: "typical share of an app's code that comes from open-source dependencies" },
                { v: "Transitive", k: "where most vulnerable packages sit — pulled in by something you chose" },
                { v: "Licence", k: "the other SCA finding: copyleft terms can conflict with distribution" }
              ] },
              { t: "h", text: "Severity is not priority" },
              { t: "table", headers: ["Signal", "Answers", "Source"], rows: [
                ["CVSS base score", "How bad if exploited, worst case", "Vulnerability record"],
                ["EPSS probability", "How likely exploitation is in the near term", "Exploit prediction model"],
                ["Known exploited", "Is it being exploited now?", "Government and vendor catalogues"],
                ["Reachability", "Does your code call the vulnerable function?", "SCA tools with call-graph analysis"],
                ["Exposure", "Is the workload internet-facing, privileged, holding sensitive data?", "Cloud context (CNAPP)"]
              ] },
              { t: "widget", id: "scanPrioritizer" },
              { t: "note", variant: "key", html: "<strong>CVSS says how bad; context says how urgent.</strong> Combine exploit likelihood, reachability and exposure to decide what to fix this week." }
            ]
          },
          {
            id: "snyk",
            title: "Snyk: Open Source, Code, Container and IaC in the pipeline",
            summary: "The four Snyk products, the commands, thresholds and Jenkins wiring.",
            minutes: 10,
            tags: ["practitioner", "snyk", "sca", "container", "iac"],
            blocks: [
              { t: "table", headers: ["Product", "Scans", "CLI command"], rows: [
                ["Snyk Open Source", "Dependency manifests and lockfiles", "<code class='tok'>snyk test</code>"],
                ["Snyk Code", "Your source code (SAST)", "<code class='tok'>snyk code test</code>"],
                ["Snyk Container", "Image OS packages and app dependencies, base-image advice", "<code class='tok'>snyk container test &lt;image&gt;</code>"],
                ["Snyk IaC", "Terraform, CloudFormation, Kubernetes, Helm", "<code class='tok'>snyk iac test</code>"]
              ] },
              { t: "code", lang: "bash", code:
                "# authenticate from an environment variable the CI injects from its credential store\n" +
                "snyk auth \"$SNYK_TOKEN\"\n\n" +
                "snyk test --all-projects --severity-threshold=high --fail-on=upgradable\n" +
                "snyk code test --severity-threshold=high\n" +
                "snyk container test registry.internal.example/payments-api:482 --file=Dockerfile --severity-threshold=critical\n" +
                "snyk iac test infra/ --severity-threshold=medium\n\n" +
                "# on the main branch only, after the gate passes: keep watching what shipped\n" +
                "snyk monitor --all-projects --project-environment=production"
              },
              { t: "h", text: "Jenkins stage" },
              { t: "code", lang: "groovy", code:
                "stage('Snyk') {\n" +
                "  steps {\n" +
                "    withCredentials([string(credentialsId: 'snyk-api-token', variable: 'SNYK_TOKEN')]) {\n" +
                "      sh 'snyk test --all-projects --severity-threshold=high --sarif-file-output=snyk.sarif'\n" +
                "    }\n" +
                "  }\n" +
                "  post { always { archiveArtifacts artifacts: 'snyk.sarif', allowEmptyArchive: true } }\n" +
                "}"
              },
              { t: "table", headers: ["Exit code", "Means", "Pipeline should"], rows: [
                ["0", "No issues at or above threshold", "Continue"],
                ["1", "Issues found at or above threshold", "Fail the stage"],
                ["2 or 3", "CLI error or no supported projects", "Fail loudly — a broken scan is not a pass"]
              ] },
              { t: "note", variant: "tip", html: "Use a <code class='tok'>.snyk</code> policy file for justified, expiring ignores so exceptions are reviewed in PRs, not clicked away in a UI." },
              { t: "note", variant: "key", html: "<strong>test gates, monitor watches.</strong> Set thresholds per product, treat scanner errors as failures, and keep ignores in versioned policy with expiry dates." }
            ]
          },
          {
            id: "sca-alternatives",
            title: "Alternatives: Trivy, Grype, Dependabot, OWASP Dependency-Check, Black Duck",
            summary: "Open-source and commercial options, and how they fit together.",
            minutes: 8,
            tags: ["practitioner", "trivy", "grype", "dependabot", "dependency-check", "black-duck"],
            blocks: [
              { t: "table", headers: ["Tool", "Type", "Covers", "Notes"], rows: [
                ["Trivy", "Open source", "Images, file systems, repos, IaC, Kubernetes, SBOM output", "Single binary, fast, widely embedded in registries"],
                ["Grype (with Syft)", "Open source", "Images and SBOMs; Syft generates the SBOM", "Clean SBOM-first workflow"],
                ["Dependabot", "Platform feature", "Alerts plus automated upgrade PRs", "Fixing, not just finding"],
                ["OWASP Dependency-Check", "Open source", "Java, .NET and more against vulnerability feeds", "Long-standing, Jenkins plugin available"],
                ["Black Duck", "Commercial", "Deep licence compliance, snippet matching", "Legal and M&amp;A diligence use cases"],
                ["Snyk", "Commercial", "SCA, SAST, container, IaC with fix advice", "Developer-first workflow"]
              ] },
              { t: "code", lang: "bash", code:
                "trivy image --severity HIGH,CRITICAL --exit-code 1 registry.internal.example/payments-api:482\n" +
                "trivy fs --scanners vuln,secret,misconfig --exit-code 1 .\n" +
                "syft registry.internal.example/payments-api:482 -o cyclonedx-json > sbom.json\n" +
                "grype sbom:sbom.json --fail-on high"
              },
              { t: "note", variant: "tip", html: "Generate the SBOM once at build time and scan the SBOM later. When a new CVE lands you can answer 'are we affected?' across every release without rebuilding anything." },
              { t: "quiz", id: "scan-sca" },
              { t: "note", variant: "key", html: "<strong>Finders and fixers work together.</strong> A scanner gates the build, an upgrade bot keeps dependencies fresh, and the SBOM lets you re-check old releases instantly." }
            ]
          }
        ]
      },
      {
        id: "runtime",
        name: "DAST & IaC",
        icon: "shield",
        lessons: [
          {
            id: "dast",
            title: "DAST with ZAP and Burp Suite",
            summary: "Test the running app from the outside: baseline scans in CI, deeper authenticated scans on a schedule.",
            minutes: 9,
            tags: ["practitioner", "dast", "zap", "burp"],
            blocks: [
              { t: "p", html: "<strong>Dynamic Application Security Testing</strong> crawls and attacks a running application over HTTP, the way an external attacker would. It finds what only exists at runtime: missing security headers, misconfigured TLS, server errors leaking stack traces, and injection that SAST missed." },
              { t: "table", headers: ["Mode", "What it does", "Where"], rows: [
                ["Baseline / passive", "Spider and observe responses; no attacks", "Every staging deploy, minutes"],
                ["Full / active", "Send attack payloads to every parameter", "Nightly against a dedicated test env"],
                ["API scan", "Drive tests from an OpenAPI or GraphQL schema", "Per API change"],
                ["Manual (Burp Suite)", "Expert-driven interception and testing", "Pen tests, high-risk features"]
              ] },
              { t: "code", lang: "bash", code:
                "# ZAP baseline against staging; fail the stage on WARN or above per the rules file\n" +
                "docker run --rm -v \"$PWD:/zap/wrk\" zaproxy/zap-stable \\\n" +
                "  zap-baseline.py -t https://staging.payments.example \\\n" +
                "  -c zap-rules.conf -r zap-report.html -I"
              },
              { t: "ul", items: [
                "Scan only environments you own and are authorized to test; active scans can modify data.",
                "Authenticated scans need a test account — fetch its password from the credential store at runtime.",
                "Tune a rules file so known-accepted alerts are ignored explicitly, not by turning the scan off."
              ] },
              { t: "note", variant: "key", html: "<strong>DAST sees what attackers see.</strong> Run a quick passive scan on every deploy to staging and a deep authenticated scan on a schedule against an environment you own." }
            ]
          },
          {
            id: "iac-security",
            title: "IaC security: Checkov, tfsec and KICS",
            summary: "Catch public buckets, open security groups and privileged pods before they exist.",
            minutes: 9,
            tags: ["advanced", "iac", "checkov", "tfsec", "kics", "terraform"],
            blocks: [
              { t: "p", html: "Infrastructure as code means cloud misconfigurations are <strong>bugs in a text file</strong>, so you can find them in a pull request. IaC scanners check Terraform, CloudFormation, Kubernetes manifests, Helm charts and Dockerfiles against hundreds of built-in policies." },
              { t: "compare",
                bad: { title: "Misconfigured", items: ["<code class='tok'>acl = \"public-read\"</code> on a data bucket", "Security group ingress 0.0.0.0/0 on port 22", "Pod with <code class='tok'>privileged: true</code>", "Encryption at rest disabled"] },
                good: { title: "Hardened", items: ["Public access block on, bucket private", "Ingress only from a bastion or load balancer", "runAsNonRoot, drop ALL capabilities", "KMS-encrypted storage, logging on"] } },
              { t: "table", headers: ["Tool", "Coverage", "Command"], rows: [
                ["Checkov", "Terraform (code and plan), CloudFormation, K8s, Helm, Dockerfile, more", "<code class='tok'>checkov -d infra/ --compact</code>"],
                ["tfsec (now folded into Trivy)", "Terraform", "<code class='tok'>tfsec infra/</code> or <code class='tok'>trivy config infra/</code>"],
                ["KICS", "Many IaC formats, query-based", "<code class='tok'>kics scan -p infra/</code>"],
                ["Wiz CLI / Snyk IaC", "IaC plus organizational policies from the platform", "<code class='tok'>wizcli iac scan</code> / <code class='tok'>snyk iac test</code>"]
              ] },
              { t: "code", lang: "bash", code:
                "terraform plan -out=tfplan && terraform show -json tfplan > tfplan.json\n" +
                "checkov -f tfplan.json --framework terraform_plan --hard-fail-on HIGH,CRITICAL"
              },
              { t: "p", html: "CloudFormation templates are scanned the same way (<code class='tok'>checkov -d cfn/</code> or <code class='tok'>cfn-lint</code> plus <code class='tok'>cfn-nag</code>). For what the infrastructure becomes, <strong>compliance as code</strong> tools such as Chef InSpec and OpenSCAP check built hosts and images against hardening baselines (CIS, STIG-style) and emit machine-readable results that double as audit evidence." },
              { t: "note", variant: "tip", html: "Suppress with an inline, justified skip (for example a Checkov skip comment with a reason) rather than disabling a check globally. Reviewers then see each exception in the diff." },
              { t: "p", html: "Built-in scanner rules cover common misconfigurations. Organization-specific rules — approved regions, mandatory tags, allowed registries — are better written once as <strong>policy as code</strong> and run both here in CI (for example OPA's <code class='tok'>conftest</code> against the plan JSON) and at Kubernetes admission. That shared-policy model, with OPA, Gatekeeper and Kyverno, is taught in <a href='#/ctr/posture/policy-as-code'>policy as code and admission control</a>." },
              { t: "quiz", id: "scan-runtime" },
              { t: "note", variant: "key", html: "<strong>Every cloud misconfiguration you catch in a PR is an incident you never have.</strong> Scan code and the plan, fail on high severity, and keep exceptions inline and justified." }
            ]
          }
        ]
      }
    ]
  };
})();
