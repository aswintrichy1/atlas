/* =====================================================================
   FORGE · AppSec & Vulnerability Management
   window.TRACKS.vuln — modules: appsec / vulnmgmt

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Block grammar: see the header of track-found.js.
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

  /* vulnSla — fix-by decision from severity, KEV, EPSS, reachability, exposure */
  Widgets.vulnSla = function (mount) {
    shell(mount, "triage", "From finding to fix-by date",
      "Combine the signals a mature program uses. Known exploitation overrides severity; reachability and exposure decide whether a High is urgent or routine.");
    var sev = "High", kev = false, epss = "low", reach = true, exposed = true;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var base = { Critical: 4, High: 3, Medium: 2, Low: 1 }[sev];
      var score = base + (epss === "high" ? 1 : 0) + (reach ? 0 : -1) + (exposed ? 0 : -1);
      if (kev) score = Math.max(score, 5);
      var tier, days, owner;
      if (score >= 5) { tier = "Emergency"; days = 3; owner = "owning team plus incident channel"; }
      else if (score >= 4) { tier = "Urgent"; days = 7; owner = "owning team, this sprint"; }
      else if (score >= 3) { tier = "Standard"; days = 30; owner = "owning team backlog"; }
      else if (score >= 2) { tier = "Routine"; days = 90; owner = "patch cycle or base-image campaign"; }
      else { tier = "Track"; days = 180; owner = "accept with expiry or fix opportunistically"; }
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:0;line-height:1.55" },
        (kev ? "Listed as known exploited: treat as an emergency regardless of score. " : "") +
        (!reach ? "Not reachable lowers priority but needs a VEX statement or time-boxed exception. " : "") +
        (!exposed ? "No internet exposure reduces likelihood. " : "") + "Route to: " + owner + "."));
      clear(readout);
      readout.appendChild(ro("tier", tier));
      readout.appendChild(ro("fix within", days + " days"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["Critical", "Critical"], ["High", "High"], ["Medium", "Medium"], ["Low", "Low"]], 1, function (v) { sev = v; paint(); }),
      segment([[false, "Not in KEV"], [true, "In KEV"]], 0, function (v) { kev = v; paint(); }),
      segment([["low", "EPSS low"], ["high", "EPSS high"]], 0, function (v) { epss = v; paint(); }),
      segment([[true, "Reachable"], [false, "Not reachable"]], 0, function (v) { reach = v; paint(); }),
      segment([[true, "Internet-exposed"], [false, "Internal"]], 0, function (v) { exposed = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "vuln-appsec": {
      title: "Application security testing checkpoint",
      sub: "OWASP Top 10, API Top 10, ASVS, review, IAST, RASP and fuzzing.",
      questions: [
        { q: "An API returns another customer's order when the order id in the URL is changed. Which OWASP API risk is this?", options: ["Broken object level authorization", "Security misconfiguration", "Unrestricted resource consumption", "Server-side request forgery"], answer: 0,
          explain: "BOLA is the most common API flaw: the server checks that the caller is logged in but not that the object belongs to them." },
        { q: "How is OWASP ASVS best used?", options: ["As a scanner", "As a verification checklist of security requirements chosen by level, used in design, stories and test plans", "As a CVE database", "As a CI plugin"], answer: 1,
          explain: "ASVS turns 'secure' into testable requirements per level, which is ideal for acceptance criteria." },
        { q: "What distinguishes IAST from SAST and DAST?", options: ["It reads code without running it", "An agent inside the running app observes real data flows during tests, reporting the vulnerable line with runtime evidence", "It attacks from outside only", "It scans containers"], answer: 1,
          explain: "IAST instruments the application during functional or DAST testing; precision is high, coverage depends on tests." },
        { q: "What does fuzzing do?", options: ["Formats code", "Feeds large volumes of malformed or random inputs to find crashes and unexpected behaviour", "Signs images", "Reviews pull requests"], answer: 1,
          explain: "Coverage-guided fuzzers are very effective on parsers and protocol handlers, and fit into CI on a schedule." }
      ]
    },
    "vuln-mgmt": {
      title: "Vulnerability management checkpoint",
      sub: "Prioritization, SLAs, exceptions, noise, ASPM and shift-right.",
      questions: [
        { q: "A Medium-severity CVE appears in the CISA Known Exploited Vulnerabilities catalogue. What should happen?", options: ["Keep the Medium SLA", "Escalate to the fastest fix SLA: active exploitation outweighs the base score", "Ignore it", "Suppress it permanently"], answer: 1,
          explain: "KEV means attackers are using it now. Most programs treat KEV entries as emergency fixes regardless of CVSS." },
        { q: "What makes a good risk acceptance?", options: ["A verbal OK", "A documented owner, reason, compensating controls and an expiry date after which the finding reopens", "Permanent suppression in the scanner UI", "Deleting the finding"], answer: 1,
          explain: "Time-boxed, owned, justified exceptions keep accepted risk visible and force re-evaluation." },
        { q: "What problem does ASPM solve?", options: ["Building containers", "Correlating findings from SAST, SCA, container, IaC and cloud into one deduplicated, prioritized, owned view", "Replacing code review", "Running DAST"], answer: 1,
          explain: "Application security posture management unifies signals and context so teams work one queue instead of six." },
        { q: "What is the vulnerability escape rate?", options: ["How fast scans run", "The share of vulnerabilities first found in production rather than by pre-production gates", "The number of scanners", "Average CVSS"], answer: 1,
          explain: "A falling escape rate shows that shift-left gates are catching issues earlier." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.vuln = {
    id: "vuln",
    name: "AppSec & Vulnerability Management",
    short: "VULN",
    tagline: "Write secure code, test it every way, and run the fix loop",
    color: "#fbbf24",
    blurb: "Complete the application security testing map — OWASP Top 10, API Top 10, ASVS, secure code review, API and licence testing, IDE plugins, IAST, RASP, fuzzing, threat modeling, pen tests, bug bounty and chaos engineering — then run vulnerability management as a lifecycle with CVSS, EPSS, KEV, reachability, SLAs, exceptions, ASPM and production feedback.",
    modules: [
      {
        id: "appsec",
        name: "Application Security Testing",
        icon: "wrench",
        lessons: [
          {
            id: "secure-coding-owasp",
            title: "Secure coding with OWASP Top 10, API Top 10 and ASVS",
            summary: "The recurring web and API flaws, and ASVS as the requirements checklist that prevents them.",
            minutes: 12,
            tags: ["practitioner", "owasp-top-10", "api-security", "asvs", "secure-coding"],
            blocks: [
              { t: "table", headers: ["Web risk theme", "Coding defense"], rows: [
                ["Broken access control", "Deny by default; check ownership server-side on every request"],
                ["Cryptographic failures", "TLS everywhere; vetted libraries; no home-grown crypto; protect keys in a KMS"],
                ["Injection (SQL, OS, LDAP, template)", "Parameterized queries, safe APIs, context-aware output encoding"],
                ["Insecure design", "Threat model new features; abuse cases in stories"],
                ["Security misconfiguration", "Hardened defaults as code; no debug endpoints in prod"],
                ["Vulnerable and outdated components", "SCA gates, SBOM, upgrade cadence"],
                ["Identification and authentication failures", "MFA, rate limiting, secure session handling"],
                ["Software and data integrity failures", "Signed artifacts, safe deserialization, protected pipelines"],
                ["Logging and monitoring failures", "Structured security events, alerting, no secrets in logs"],
                ["Server-side request forgery", "Allow-list outbound destinations; block metadata endpoints"]
              ] },
              { t: "table", headers: ["API risk theme", "What it looks like"], rows: [
                ["Broken object level authorization", "Change an id in the path, get someone else's object"],
                ["Broken authentication", "Weak token validation, no expiry, credential stuffing"],
                ["Broken object property level authorization", "Mass assignment or over-exposed fields in responses"],
                ["Unrestricted resource consumption", "No limits on size, rate or cost per request"],
                ["Broken function level authorization", "A normal user calls an admin endpoint"],
                ["Unrestricted access to sensitive business flows", "Bots automating purchases or sign-ups"],
                ["Server-side request forgery", "API fetches a URL the caller controls"],
                ["Security misconfiguration", "Verbose errors, permissive CORS"],
                ["Improper inventory management", "Old API versions and shadow endpoints still live"],
                ["Unsafe consumption of APIs", "Trusting third-party API responses without validation"]
              ] },
              { t: "h", text: "ASVS as a checklist" },
              { t: "p", html: "The <strong>Application Security Verification Standard</strong> lists testable requirements in chapters (authentication, session management, access control, validation, cryptography, error handling, data protection, API, configuration) at three levels. Pick a level per application — L1 for basic, L2 for most business apps, L3 for high assurance — and use the requirements as acceptance criteria and test cases." },
              { t: "compare",
                bad: { title: "Vague story", items: ["'Make the export endpoint secure'", "Done when the PR is merged", "Tested by whoever has time"] },
                good: { title: "ASVS-backed story", items: ["Access check on export id, session timeout, output encoding, audit log entry", "Each mapped to an ASVS requirement", "Each has an automated or manual test"] } },
              { t: "note", variant: "key", html: "<strong>Know the recurring flaws, and write requirements that prevent them.</strong> The Top 10 lists are awareness; ASVS is the checklist you build and test against." }
            ]
          },
          {
            id: "code-review-checklist",
            title: "Secure code review checklist",
            summary: "What a reviewer checks in a security-relevant pull request, in priority order.",
            minutes: 9,
            tags: ["practitioner", "code-review", "checklist"],
            blocks: [
              { t: "ol", items: [
                "<strong>Trust boundaries</strong>: new endpoints, consumers, file uploads, outbound calls?",
                "<strong>Authorization</strong>: every data access checks the caller's right to that specific object and function.",
                "<strong>Input handling</strong>: validated by allow-list; parameterized queries; no string-built commands.",
                "<strong>Output handling</strong>: context-correct encoding; no sensitive fields in responses or errors.",
                "<strong>Secrets and config</strong>: no literals; credential ids or secret-manager references only.",
                "<strong>Crypto</strong>: approved libraries and algorithms; no custom schemes; keys not in code.",
                "<strong>Dependencies</strong>: new packages justified, maintained, licence-compatible, pinned.",
                "<strong>Logging</strong>: security events logged; no tokens, passwords or full card numbers.",
                "<strong>Error handling</strong>: fail closed; no stack traces to users.",
                "<strong>Pipeline and infrastructure files</strong>: Jenkinsfile, Dockerfile, Helm, Terraform changes get platform or security review."
              ] },
              { t: "table", headers: ["Signal in the diff", "Ask"], rows: [
                ["<code class='tok'>findById(request.getParameter(\"id\"))</code>", "Where is the ownership check?"],
                ["<code class='tok'>\"SELECT … WHERE name = '\" + name + \"'\"</code>", "Why not a bound parameter?"],
                ["<code class='tok'>catch (Exception e) { return e.toString(); }</code>", "Does this leak internals?"],
                ["New <code class='tok'>@PermitAll</code> or wildcard CORS", "Who approved making this public?"]
              ] },
              { t: "note", variant: "tip", html: "Keep the checklist in the PR template and require a security champion's review when the diff touches authentication, authorization, crypto, or pipeline files." },
              { t: "note", variant: "key", html: "<strong>Boundaries, authorization, input, output, secrets — in that order.</strong> Scanners find patterns; reviewers find missing checks." }
            ]
          },
          {
            id: "api-security",
            title: "API security testing and licence compliance in the pipeline",
            summary: "Schema-driven DAST for APIs, contract and authorization tests, and SCA licence policy.",
            minutes: 10,
            tags: ["practitioner", "api-testing", "zap", "license-compliance"],
            blocks: [
              { t: "table", headers: ["Test type", "Tool examples", "Catches"], rows: [
                ["Schema-driven DAST", "ZAP API scan from OpenAPI or GraphQL", "Injection, error leaks, missing headers per endpoint"],
                ["Authorization matrix tests", "Unit or integration tests per role and object owner", "BOLA and function-level authorization gaps"],
                ["Contract tests", "Schema validation in CI", "Over-exposed fields, undocumented endpoints"],
                ["Rate and size limits", "Load tests with abusive patterns", "Unrestricted resource consumption"],
                ["Inventory", "Gateway and CNAPP API discovery", "Shadow and zombie APIs"]
              ] },
              { t: "code", lang: "bash", code:
                "# ZAP API scan driven by the service's OpenAPI document, against staging only\n" +
                "docker run --rm -v \"$PWD:/zap/wrk\" zaproxy/zap-stable \\\n" +
                "  zap-api-scan.py -t /zap/wrk/openapi.yaml -f openapi -r api-report.html -c api-rules.conf"
              },
              { t: "h", text: "Dependency and licence compliance" },
              { t: "p", html: "SCA tools also report <strong>licences</strong>. Define a policy — allowed (MIT, Apache-2.0, BSD), review needed (LGPL, MPL), not allowed for distributed products (AGPL or strong copyleft, depending on legal advice) — and gate on it the same way you gate on CVEs. Unknown licences are findings too." },
              { t: "note", variant: "tip", html: "Write one authorization test per role and endpoint. It is the cheapest reliable defense against the most common API flaw, and no scanner can infer your business rules." },
              { t: "note", variant: "key", html: "<strong>Drive DAST from the API schema, test authorization explicitly, gate on licences as well as CVEs.</strong>" }
            ]
          },
          {
            id: "dev-inner-loop",
            title: "Before the PR: IDE plugins for SAST, secrets and IaC",
            summary: "SonarLint (SonarQube for IDE), Snyk and Wiz Code in the editor with the same rules as CI.",
            minutes: 8,
            tags: ["practitioner", "ide", "sonarlint", "snyk", "wiz-code"],
            blocks: [
              { t: "table", headers: ["Plugin", "Finds while typing", "Connected mode"], rows: [
                ["SonarQube for IDE (formerly SonarLint)", "Bugs, code smells, security hotspots, taint issues", "Binds to the server's quality profile so rules match CI"],
                ["Snyk IDE extension", "Vulnerable dependencies, Snyk Code SAST, IaC issues", "Uses the organization's Snyk policies"],
                ["Wiz Code IDE extension", "IaC misconfigurations, secrets, vulnerable packages", "Same policies as wizcli and PR scanning"],
                ["gitleaks pre-commit hook", "Secrets in staged changes", "Same rules file as the CI secret stage"]
              ] },
              { t: "ul", items: [
                "Bind IDE plugins to the central rule sets; a local-only rule set creates arguments, not fixes.",
                "IDE feedback is advisory and fast; CI gates are the enforcement.",
                "Measure adoption: the share of findings fixed before the PR is opened."
              ] },
              { t: "note", variant: "key", html: "<strong>The cheapest fix happens before the commit.</strong> Same rules in the IDE, the PR and CI make shift-left consistent." }
            ]
          },
          {
            id: "iast-rasp-fuzz",
            title: "IAST, RASP and fuzzing",
            summary: "Instrumented testing, in-app runtime protection and malformed-input testing, briefly.",
            minutes: 8,
            tags: ["advanced", "iast", "rasp", "fuzzing"],
            blocks: [
              { t: "table", headers: ["Technique", "How", "Strength", "Limit"], rows: [
                ["IAST", "Agent instruments the app during tests and watches data flow", "Precise, low false positives, exact line", "Only sees code paths the tests exercise; language agents"],
                ["RASP", "Agent in production detects and blocks attacks inside the app", "Context-aware blocking (for example a real SQL injection reaching the driver)", "Performance and operational risk; not a substitute for fixing"],
                ["Fuzzing", "Generate malformed inputs, often coverage-guided", "Finds crashes and parser bugs nobody imagined", "Needs harnesses; best for parsers and protocols"]
              ] },
              { t: "p", html: "A complete testing map: <strong>SAST</strong> reads code, <strong>SCA</strong> checks dependencies, <strong>DAST</strong> attacks from outside, <strong>IAST</strong> watches from inside during tests, <strong>fuzzing</strong> stresses inputs, <strong>RASP</strong> defends at runtime, and humans cover design and business logic." },
              { t: "note", variant: "key", html: "<strong>Each technique sees a different slice.</strong> Add IAST where tests are rich, fuzz parsers, and treat RASP as a seatbelt, not a repair." }
            ]
          },
          {
            id: "beyond-scanners",
            title: "Testing beyond scanners: threat modeling, pen tests, bug bounty, chaos",
            summary: "Human-led and resilience testing at the points in the lifecycle where they pay off.",
            minutes: 9,
            tags: ["advanced", "threat-modeling", "pentest", "bug-bounty", "chaos-engineering"],
            blocks: [
              { t: "table", headers: ["Practice", "When", "Output"], rows: [
                ["Threat modeling workshop", "Sprint planning for features that add trust boundaries", "Threats, mitigations as stories, abuse-case tests"],
                ["Penetration test", "Release gate for major features and annually", "Findings with proof, retested before closure"],
                ["Bug bounty or vulnerability disclosure program", "Continuously after launch", "Researcher reports with a triage SLA"],
                ["Security chaos engineering", "Scheduled game days", "Evidence that detections and responses work"]
              ] },
              { t: "h", text: "A 45-minute sprint threat modeling workshop" },
              { t: "ol", items: [
                "Draw the data flow for the new feature (5 minutes).",
                "Walk STRIDE per element and boundary (20 minutes).",
                "Rank by likelihood and impact (10 minutes).",
                "Write mitigations as stories with acceptance tests (10 minutes)."
              ] },
              { t: "p", html: "Security chaos experiments inject controlled faults — disable a log forwarder, add a suspicious process in a test pod, revoke a certificate — and check that alerts fire and runbooks work. Run them in non-production first and with clear stop conditions." },
              { t: "quiz", id: "vuln-appsec" },
              { t: "note", variant: "key", html: "<strong>Scanners find known patterns; people find design flaws; chaos proves detection works.</strong> Schedule each where it gives the most signal." }
            ]
          }
        ]
      },
      {
        id: "vulnmgmt",
        name: "Vulnerability Management",
        icon: "trend",
        lessons: [
          {
            id: "vuln-lifecycle",
            title: "The vulnerability management lifecycle",
            summary: "CVSS, EPSS, CISA KEV, reachability and Wiz context; fix-by SLAs and ownership routing.",
            minutes: 12,
            tags: ["practitioner", "cvss", "epss", "kev", "reachability", "sla", "wiz"],
            blocks: [
              { t: "ol", items: [
                "<strong>Discover</strong>: scanners in IDE, PR, CI, registry, cloud and runtime.",
                "<strong>Deduplicate and correlate</strong>: one record per vulnerability per asset, linked across tools.",
                "<strong>Prioritize</strong> with severity, exploitation and context.",
                "<strong>Assign</strong> to the owning team with a fix-by date.",
                "<strong>Remediate</strong> in code (upgrade, rebuild, config) or mitigate.",
                "<strong>Verify</strong> by rescan; close only when the evidence shows it is gone.",
                "<strong>Report</strong> MTTR, SLA compliance and escape rate."
              ] },
              { t: "table", headers: ["Signal", "Question", "Notes"], rows: [
                ["CVSS", "How severe in the worst case?", "Base score; does not know your environment"],
                ["EPSS", "How likely is exploitation in the next 30 days?", "Probability from observed exploitation data"],
                ["CISA KEV", "Is it being exploited in the wild now?", "Binary and strong: escalate"],
                ["Reachability", "Does our code path call it?", "Call-graph analysis in SCA tools"],
                ["Wiz context", "Exposed? Privileged identity? Sensitive data reachable?", "Toxic combinations become critical issues"]
              ] },
              { t: "widget", id: "vulnSla" },
              { t: "table", headers: ["Priority", "Fix-by SLA (example)"], rows: [
                ["Known exploited, or critical with an attack path", "3–7 days"],
                ["Critical", "7–15 days"],
                ["High", "30 days"],
                ["Medium", "90 days"],
                ["Low", "180 days or next major upgrade"]
              ] },
              { t: "p", html: "<strong>Ownership routing</strong> uses Wiz projects (accounts, clusters, namespaces, repos mapped to teams) so each issue lands in the right team's Jira board automatically. The <strong>Wiz board filtered to the team's project</strong> — open critical issues, due-soon items, newly exposed workloads — becomes the daily working view." },
              { t: "note", variant: "key", html: "<strong>Severity, exploitation, reachability, context, then an owner and a date.</strong> A vulnerability without a fix-by date and an owner is just a number." }
            ]
          },
          {
            id: "noise-exceptions",
            title: "Alert noise, false positives and time-boxed exceptions",
            summary: "Dedupe, correlate, suppress with expiry, and use VEX to explain not-affected decisions.",
            minutes: 10,
            tags: ["practitioner", "noise", "false-positives", "exceptions", "vex"],
            blocks: [
              { t: "table", headers: ["Technique", "Removes", "Guardrail"], rows: [
                ["Deduplication", "The same CVE from three scanners on one image", "Keep the source list for evidence"],
                ["Correlation", "Thirty findings that share one root cause (a base image)", "Track the campaign to closure"],
                ["Suppression with expiry", "A known, accepted finding for a period", "Owner, reason, expiry, review"],
                ["False-positive marking", "A rule firing on safe code", "Second reviewer; feed back to rule tuning"],
                ["VEX statements", "CVEs in the SBOM that do not affect the product", "Justification such as component not present or not reachable"]
              ] },
              { t: "h", text: "Risk acceptance record" },
              { t: "code", lang: "yaml", code:
                "# exceptions/payments-api.yaml — reviewed in a PR like any other change\n" +
                "- finding: SIM-2026-0815            # simulated identifier\n" +
                "  asset: payments-api\n" +
                "  decision: accept\n" +
                "  reason: vulnerable function not reachable; WAF rule blocks the input pattern\n" +
                "  compensating_controls: [waf-rule-1182, network-policy-default-deny]\n" +
                "  owner: payments-team-lead\n" +
                "  approved_by: appsec-champion\n" +
                "  expires: 2026-12-31               # finding reopens automatically after this date"
              },
              { t: "compare",
                bad: { title: "Noise that gets gates disabled", items: ["Every scanner blocks independently", "Ignores clicked in a UI forever", "False positives never fed back", "Thousands of raw findings on dashboards"] },
                good: { title: "Signal teams trust", items: ["One deduplicated, correlated queue", "Exceptions in code with expiry", "Rule tuning from false-positive reviews", "Issues and campaigns, not raw counts"] } },
              { t: "note", variant: "key", html: "<strong>Fewer, truer, owned findings.</strong> Deduplicate, correlate, suppress only with an expiry, and publish VEX for not-affected decisions." }
            ]
          },
          {
            id: "aspm",
            title: "ASPM: one pane for application security posture",
            summary: "Correlating SAST, SCA, container, IaC and cloud findings, with Wiz as the primary example.",
            minutes: 9,
            tags: ["practitioner", "aspm", "wiz", "correlation"],
            blocks: [
              { t: "p", html: "<strong>Application security posture management</strong> pulls findings from every testing tool into one model of applications, owners and assets, then deduplicates and prioritizes with runtime and cloud context. The point is one queue per team instead of one console per tool." },
              { t: "table", headers: ["Input", "Example sources", "Context ASPM adds"], rows: [
                ["Code", "SonarQube, Semgrep, CodeQL, Snyk Code", "Which deployed service contains the vulnerable code"],
                ["Dependencies", "Snyk, Trivy, Dependabot", "Is the package in a running, exposed image?"],
                ["Containers", "Image scans in CI and registries", "Which clusters run the digest"],
                ["IaC", "Checkov, wizcli iac", "Which cloud resources were created from it"],
                ["Cloud and runtime", "CNAPP posture, runtime sensor", "Exposure, identity and data on the graph"]
              ] },
              { t: "p", html: "In Wiz, code-to-cloud mapping connects repositories (Wiz Code), pipeline scans (wizcli) and the cloud graph, so a SAST or SCA finding can be ranked by whether the code actually runs somewhere exposed. Other vendors in the ASPM category include Apiiro and ArmorCode; the evaluation questions are the same: coverage of your tools, quality of ownership mapping, and context depth." },
              { t: "note", variant: "key", html: "<strong>ASPM is correlation plus ownership plus context.</strong> One prioritized queue per team, traced from code to cloud." }
            ]
          },
          {
            id: "shift-right",
            title: "Shift right: production findings back into the backlog and the gate",
            summary: "Falco and Wiz runtime signals become Jira work and new pipeline policies.",
            minutes: 9,
            tags: ["advanced", "shift-right", "falco", "wiz-runtime", "jira", "feedback"],
            blocks: [
              { t: "ol", items: [
                "<strong>Detect</strong> in production: Wiz runtime or Falco alert, CNAPP issue, bug bounty report, incident.",
                "<strong>Triage</strong>: confirm, scope with the graph, decide severity and SLA.",
                "<strong>Route</strong>: automation creates a Jira issue for the owning team with evidence and code-to-cloud links.",
                "<strong>Fix</strong> in code, base image or module — not in the console.",
                "<strong>Prevent</strong>: add or tighten a CI policy (wizcli, Snyk, Kyverno) so the same class is blocked next build.",
                "<strong>Detect better</strong>: add a SIEM or Falco rule if detection was late."
              ] },
              { t: "table", headers: ["Production finding", "Backlog item", "New gate"], rows: [
                ["Public bucket created by Terraform", "Fix module default; add public access block", "wizcli IaC policy blocks public ACLs"],
                ["Shell spawned in a root container", "Rebuild non-root; drop capabilities", "Kyverno runAsNonRoot enforced; Hadolint USER rule"],
                ["Critical CVE in a base image across 40 services", "Base-image campaign", "Vulnerability policy blocks the old base digest"],
                ["Leaked token found in logs", "Rotate; fix the logging statement", "Log masking check fails the build"]
              ] },
              { t: "quiz", id: "vuln-mgmt" },
              { t: "note", variant: "key", html: "<strong>Every production finding should make the pipeline smarter.</strong> Ticket the fix, then add the gate that would have caught it." }
            ]
          }
        ]
      }
    ]
  };
})();
