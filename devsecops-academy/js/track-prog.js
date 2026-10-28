/* =====================================================================
   FORGE · Program, Governance & Resilience
   window.TRACKS.prog — modules: people / governance / data / adjacent

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

  /* progSod — is this production change auditable? */
  Widgets.progSod = function (mount) {
    shell(mount, "audit", "Would this production change pass an audit?",
      "Set how the change was reviewed, approved and evidenced. Auditors look for independent review, authorized approval, and records produced by the system rather than by people.");
    var review = "peer", approver = "other", evidence = "auto", breakglass = "no";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var gaps = [];
      if (review === "none") gaps.push("no independent code review");
      if (approver === "self") gaps.push("author approved their own production change");
      if (evidence === "manual") gaps.push("evidence is screenshots, not system records");
      if (breakglass === "unreviewed") gaps.push("break-glass access used without after-the-fact review");
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:0;line-height:1.55" },
        gaps.length ? "Gaps: " + gaps.join("; ") + "." : "Independent review, separate authorized approver, automatic evidence and reviewed emergency access: this change is defensible."));
      clear(readout);
      readout.appendChild(ro("separation of duties", review !== "none" && approver === "other" ? "met" : "not met"));
      readout.appendChild(ro("audit result", gaps.length ? gaps.length + " finding(s)" : "no findings"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["peer", "Peer-reviewed PR"], ["none", "Pushed without review"]], 0, function (v) { review = v; paint(); }),
      segment([["other", "Approved by release approver"], ["self", "Approved by author"]], 0, function (v) { approver = v; paint(); }),
      segment([["auto", "Pipeline records and attestations"], ["manual", "Screenshots in a ticket"]], 0, function (v) { evidence = v; paint(); }),
      segment([["no", "No break-glass used"], ["reviewed", "Break-glass, reviewed"], ["unreviewed", "Break-glass, not reviewed"]], 0, function (v) { breakglass = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  Widgets.progDataRelease = function (mount) {
    shell(mount, "data release", "Choose the safe data-platform action",
      "Pick a change type. The result shows the minimum validation and rollback evidence expected before promotion.");
    var actions = {
      model: ["dbt build --select state:modified+", "manifest + run_results + test evidence", "Revert code and rebuild downstream models"],
      ddl: ["schemachange dry-run / ordered migration review", "version table + query history", "Forward-fix or restore from a pre-change clone"],
      infra: ["terraform plan with policy checks", "reviewed plan artifact + apply log", "Revert configuration and apply a reviewed plan"],
      data: ["zero-copy clone rehearsal + reconciliation", "row-count and quality comparisons", "Swap/restore clone only through an approved runbook"]
    };
    var stage = h("div", { class: "w-stage" });
    function paint(id) {
      var a = actions[id];
      clear(stage);
      stage.appendChild(h("p", {}, "Validate: ", h("b", {}, a[0])));
      stage.appendChild(h("p", {}, "Evidence: ", h("b", {}, a[1])));
      stage.appendChild(h("p", {}, "Rollback: ", h("b", {}, a[2])));
    }
    mount.appendChild(segment([["model", "dbt model"], ["ddl", "DDL migration"], ["infra", "Terraform"], ["data", "Data change"]], 0, paint));
    mount.appendChild(stage);
    paint("model");
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "prog-people": {
      title: "Culture & AI checkpoint",
      sub: "Champions, shared responsibility, golden paths and AI-assisted code.",
      questions: [
        { q: "What is a golden path?", options: ["A required approval chain", "A paved, supported way to build and ship a service — templates, pipeline, defaults — that is secure by default and easiest to use", "A list of banned tools", "A network route"], answer: 1,
          explain: "Golden paths make the secure way the easy way. Teams can leave the path, but then they own the extra controls." },
        { q: "What is the main job of a security champion?", options: ["Approve every PR personally", "Be the security-minded engineer inside a team who spreads practices, triages findings and connects the team to AppSec", "Run the SOC", "Write all threat models alone"], answer: 1,
          explain: "Champions scale a small AppSec team. They are engineers first, with time allocated for security work." },
        { q: "How should AI-generated code be treated in the pipeline?", options: ["Trusted because a model wrote it", "Exactly like human code: reviewed, scanned by the same SAST, SCA and secret gates, and owned by the committer", "Excluded from scanning", "Merged without tests"], answer: 1,
          explain: "Assistants can suggest insecure patterns, outdated or non-existent packages, and occasionally echo secrets. Same gates, same ownership." },
        { q: "In a typical DevSecOps RACI, who is accountable for fixing a finding in a service?", options: ["The security team", "The team that owns the service", "The auditors", "Nobody until an incident"], answer: 1,
          explain: "Security sets policy and helps; the owning team is accountable for fixing its own findings within SLA." },
        { q: "An AI assistant drafts a threat model for a design change. What makes the output useful evidence?", options: ["The model sounds confident", "A named reviewer challenges it and accepted claims are backed by tests, citations or explicit residual-risk decisions", "It is longer than the design", "It replaces the security review"], answer: 1,
          explain: "AI output is a candidate, not authority. A named human remains accountable, and each accepted claim should survive disagreement through a test, a source or a documented risk decision." }
      ]
    },
    "prog-governance": {
      title: "Governance & evidence checkpoint",
      sub: "Separation of duties, change management, break-glass, evidence and guardrails.",
      questions: [
        { q: "In a CI/CD world, what usually replaces a weekly change advisory board for routine changes?", options: ["Nothing", "Pre-approved standard changes enforced by the pipeline: peer review, passing gates and recorded approval produce the change record automatically", "Email approvals", "Deploying only on weekends"], answer: 1,
          explain: "The pipeline enforces and records the controls, so low-risk changes flow while high-risk ones still get extra review." },
        { q: "What makes break-glass access acceptable?", options: ["It is never logged", "Time-limited elevation, strong authentication, full session logging, and a mandatory review afterwards", "A shared root password", "Permanent admin access"], answer: 1,
          explain: "Emergencies need speed, but every use must be visible and reviewed." },
        { q: "Which is a preventive cloud guardrail?", options: ["A CNAPP finding about a public bucket", "An AWS Service Control Policy that denies disabling audit logging in every account", "A weekly report", "A Slack alert"], answer: 1,
          explain: "SCPs, Azure Policy deny effects and GCP Organization Policies prevent; CNAPP tools such as Wiz detect what is already there." },
        { q: "Why are pipeline run logs and attestations strong audit evidence?", options: ["They are colourful", "They are system-generated, timestamped, tamper-evident records showing each control ran for each change", "Auditors prefer PDFs", "They replace policies"], answer: 1,
          explain: "Evidence produced by the system for every change beats sampled screenshots for SOC 2, ISO 27001, PCI DSS and FedRAMP-style audits." }
      ]
    },
    "prog-data": {
      title: "Data & non-production checkpoint",
      sub: "Test data, log leaks, preview environments and migration credentials.",
      questions: [
        { q: "A team wants a copy of production customer data in staging for realistic tests. What is the better approach?", options: ["Copy it as is", "Use masked or synthetic data that preserves shape and edge cases without real personal data", "Email a CSV", "Give staging the production database credentials"], answer: 1,
          explain: "Non-production environments have weaker controls. Masking or synthetic data keeps tests realistic without exposing real people." },
        { q: "What is the risk of ephemeral preview environments?", options: ["None", "They are often created with public URLs and weaker auth, then forgotten — exposed copies of the app and sometimes data", "They are too slow", "They cannot run containers"], answer: 1,
          explain: "Give them authentication, short time-to-live, no production data, and inventory them so the CNAPP sees them." },
        { q: "How should a database migration job in CI get its credentials?", options: ["Hardcoded in the migration script", "A short-lived, migration-scoped credential from Vault or the cloud manager, issued to the pipeline identity", "The DBA's personal password", "A shared admin login"], answer: 1,
          explain: "Migrations need elevated rights briefly. Dynamic, scoped, expiring credentials avoid a standing admin secret in CI." },
        { q: "Why does a Jenkins step that uses set -x risk leaking secrets?", options: ["It disables masking of the console", "It prints each expanded command, which can include secret values or transformed copies the masker does not recognise", "It deletes logs", "It has no effect"], answer: 1,
          explain: "Tracing prints expanded commands. Wrap secret use in set +x and keep secrets out of transformations that defeat masking." },
        { q: "A build log contains a live token even though the line is later deleted. What is the first response?", options: ["Edit the old log", "Revoke or rotate the token at its provider, then investigate use and remove retained copies", "Rename the job", "Wait for log retention to expire"], answer: 1,
          explain: "Once a credential is printed, assume every log reader and export could hold it. Rotation is the fix; deletion reduces exposure but cannot prove the value was never copied." }
      ]
    },
    "prog-data-platform": {
      title: "Snowflake & dbt delivery checkpoint",
      sub: "schemachange, Terraform, dbt state, clones, RBAC, parameterized environments and rollback.",
      questions: [
        { q: "Why run dbt build --select state:modified+ in pull-request CI?", options: ["It deploys production immediately", "It builds changed resources and their downstream dependants, running tests in dependency order", "It skips tests", "It hardcodes the target database"], answer: 1,
          explain: "State comparison narrows feedback while the plus includes downstream impact. A scheduled full build still catches interactions outside the modified graph." },
        { q: "What is the safest way to target STG, test and production Snowflake environments?", options: ["Put database names and account ids in every model", "Pass target, database, role and warehouse through approved environment configuration with least-privileged credentials", "Use one administrator user everywhere", "Edit SQL manually before deploy"], answer: 1,
          explain: "Environment-specific identifiers belong in runtime configuration and protected deployment environments, keeping code portable and credentials scoped." },
        { q: "Before a shared table migration, what does a zero-copy clone provide?", options: ["A substitute for tests", "A fast point-in-time rollback and rehearsal surface without physically copying all data", "Automatic privilege escalation", "A public backup"], answer: 1,
          explain: "A clone is quick and storage-efficient, making it useful for rehearsal and recovery. It must still be access-controlled, named, retained and removed by policy." },
        { q: "What should happen when a SQL deployment driver splits statements?", options: ["Skip every statement that begins with a comment", "Treat a statement as executable when any line is non-empty and not a comment", "Execute only SELECT statements", "Remove procedure bodies"], answer: 1,
          explain: "A banner comment often precedes CREATE PROCEDURE, VIEW or DELETE. Skipping the whole chunk because its first line is a comment silently drops real changes." },
        { q: "Why is CREATE OR REPLACE PROCEDURE success not enough validation?", options: ["Snowflake never stores procedures", "Some procedure bodies are not fully validated until runtime, so inspect deployed DDL and execute a safe test path", "Procedures cannot use SQL", "It automatically rolls back"], answer: 1,
          explain: "Deployment success can prove the object was stored without proving every generated statement or branch runs. Retrieve the DDL and test representative execution safely." },
        { q: "Which dbt artifacts should CI retain?", options: ["Only console screenshots", "manifest.json, run_results.json and catalog/test evidence tied to the commit", "A developer password", "Only compiled SQL without metadata"], answer: 1,
          explain: "The manifest captures graph and compiled metadata; run results capture outcomes and timing. Together they support state selection, audit and diagnosis." }
      ]
    },
    "prog-adjacent": {
      title: "Resilience, mobile & vendor checkpoint",
      sub: "Toolchain backup and recovery, mobile DevSecOps and third-party risk.",
      questions: [
        { q: "Which backup property most improves ransomware resilience for the toolchain?", options: ["Backups on the same server", "Immutable or offline copies in a separate account, with restores tested regularly", "Daily emails", "Larger disks"], answer: 1,
          explain: "Attackers delete reachable backups first. Immutable, isolated copies and practiced restores are what make recovery possible." },
        { q: "What does MobSF do?", options: ["Signs Android apps", "Static and dynamic security analysis of mobile app packages", "Hosts app stores", "Manages Kubernetes"], answer: 1,
          explain: "Mobile Security Framework analyses APK and IPA files for insecure storage, hardcoded secrets, weak crypto and risky permissions." },
        { q: "A SaaS code-quality app asks for write access to every repository in the organization. What is the right response?", options: ["Approve; it is popular", "Review its need, grant least privilege (read-only, selected repos), record it in the third-party inventory and review periodically", "Share an admin token", "Install it on personal accounts"], answer: 1,
          explain: "Third-party integrations are part of your attack surface. Scope them, inventory them and remove them when unused." },
        { q: "Where should a mobile app's signing keystore live?", options: ["In the repository", "In a managed credential store or HSM, referenced by the pipeline by credential id", "On the release engineer's laptop", "Inside the app bundle"], answer: 1,
          explain: "A stolen signing key lets an attacker ship updates that look like yours. Keep it in managed storage and use it only from the pipeline." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.prog = {
    id: "prog",
    name: "Program, Governance & Resilience",
    short: "PROG",
    tagline: "Operating model, evidence, feedback, data and resilient delivery",
    color: "#f472b6",
    blurb: "The organizational side of DevSecOps: security champions, shared responsibility and golden paths; AI in the SDLC; separation of duties, change management, break-glass and audit evidence; monitoring, incident feedback and DORA; preventive cloud guardrails; safe non-production data and log hygiene; toolchain resilience; mobile DevSecOps; and third-party SaaS risk.",
    modules: [
      {
        id: "people",
        name: "Culture & Operating Model",
        icon: "compass",
        lessons: [
          {
            id: "culture-model",
            title: "Security champions, shared responsibility, RACI and golden paths",
            summary: "Who does what between dev, security and ops, and how platform engineering makes the secure way the easy way.",
            minutes: 10,
            tags: ["foundation", "culture", "champions", "raci", "platform-engineering"],
            blocks: [
              { t: "p", html: "Tools do not create DevSecOps; <strong>operating models</strong> do. The pattern that works: security sets policy and provides tooling, platform teams build paved roads, product teams own their findings, and champions connect them." },
              { t: "table", headers: ["Activity", "Dev team", "Security", "Platform / ops"], rows: [
                ["Define security policy and gate thresholds", "Consulted", "Accountable, responsible", "Consulted"],
                ["Build and run the shared pipeline", "Informed", "Consulted", "Accountable, responsible"],
                ["Fix findings in owned services", "Accountable, responsible", "Consulted", "Informed"],
                ["Approve exceptions", "Responsible (request)", "Accountable", "Informed"],
                ["Respond to incidents", "Responsible (fix)", "Accountable (coordinate)", "Responsible (contain)"],
                ["Cloud guardrails and CNAPP rollout", "Informed", "Accountable", "Responsible"]
              ] },
              { t: "h", text: "Security champions" },
              { t: "ul", items: [
                "One engineer per team with roughly 10–20% time for security work.",
                "Monthly guild sessions, early access to new rules, a direct line to AppSec.",
                "Owns triage of the team's queue and the threat-model workshop in planning."
              ] },
              { t: "h", text: "Golden paths and developer portals" },
              { t: "p", html: "A <strong>golden path</strong> is a supported template for a new service: repository scaffold, Dockerfile on the approved base, Helm chart passing restricted policies, a Jenkinsfile calling the shared library with every gate, and a registered owner. An <strong>internal developer portal</strong> (for example a Backstage-style catalog) exposes these templates and shows each service's owners, scorecards and open security issues." },
              { t: "note", variant: "key", html: "<strong>Security owns policy, platform owns the paved road, teams own their findings, champions connect them.</strong> Make the secure path the easiest path." }
            ]
          },
          {
            id: "ai-in-sdlc",
            title: "AI in the SDLC: pipeline controls and accountable review",
            summary: "Forge's canonical AI-in-SDLC lesson: use AI earlier, then make every claim pass normal engineering evidence and pipeline gates.",
            minutes: 11,
            tags: ["practitioner", "ai", "llm", "code-assistants", "governance"],
            blocks: [
              { t: "p", html: "AI can move security review earlier by drafting abuse cases, threat models, code-review questions, dependency summaries, negative tests and release notes. Every output is a <em>candidate</em> until normal engineering review accepts it; the pipeline angle is to turn accepted advice into repeatable checks." },
              { t: "table", headers: ["SDLC step", "Useful AI draft", "Evidence before acceptance"], rows: [
                ["Requirements", "Abuse cases, sensitive data, roles and trust boundaries", "Product and security review; each requirement becomes a testable statement"],
                ["Design", "STRIDE-style threats and control options", "Named reviewer challenges assumptions; residual risk has an owner"],
                ["Code review", "Injection sinks, missing authorization, unsafe parsing and secret handling", "Diff review plus SAST and focused tests"],
                ["Dependencies", "Advisory summary, affected paths and upgrade risk", "SCA result, reachability and lockfile evidence"],
                ["Testing", "Negative tests for authz, validation, rate limits and logging", "Tests run in CI and fail for the intended unsafe behavior"],
                ["Release", "Rollback notes, checklist deltas and residual-risk summary", "Approved promotion, signed artifact and retained run evidence"]
              ] },
              { t: "table", headers: ["Risk", "Example", "Control"], rows: [
                ["Insecure suggestions", "String-built SQL, disabled TLS checks, weak crypto", "Same SAST gate and review as human code"],
                ["Hallucinated or outdated packages", "A suggested dependency that does not exist (and may be squatted later)", "Dependency firewall, SCA, allow-lists"],
                ["Secrets in prompts", "Pasting a config file with keys into a chat tool", "Approved tools only; secret scanning on prompts where supported; training"],
                ["Licence and provenance uncertainty", "Generated code resembling licensed code", "Tool settings that filter matches; licence review for large blocks"],
                ["Over-trust", "Merging large generated changes without understanding them", "Committer owns the code; smaller PRs; tests required"]
              ] },
              { t: "ul", items: [
                "Use organization-approved assistants with data-retention terms you have reviewed.",
                "Never paste secrets, customer data or unreleased security details into prompts.",
                "Label AI-assisted PRs if your policy requires it, but gate them exactly like any other.",
                "Treat agents that can run commands or open PRs as pipeline identities: least privilege, audit logs, no production credentials."
              ] },
              { t: "note", variant: "trap", html: "Generated code and generated security advice can both be wrong. Require tests, human review, source citations where possible, and a clear owner for accepting residual risk." },
              { t: "note", variant: "tip", html: "The highest-value pattern is <strong>AI-assisted checklists from your own standards</strong>: provide the change description, ask which local controls need review, then verify each answer manually and encode stable checks in CI." },
              { t: "quiz", id: "prog-people" },
              { t: "note", variant: "key", html: "<strong>AI changes who types the code, not who owns it.</strong> Same review, same scanners, same gates — and no secrets in prompts." }
            ]
          }
        ]
      },
      {
        id: "governance",
        name: "Governance, Compliance & Evidence",
        icon: "map",
        lessons: [
          {
            id: "sod-change-mgmt",
            title: "Separation of duties, change management and break-glass",
            summary: "Who approves production, how change records come from the pipeline, and how emergency access stays accountable.",
            minutes: 10,
            tags: ["practitioner", "separation-of-duties", "change-management", "break-glass"],
            blocks: [
              { t: "p", html: "<strong>Separation of duties</strong> means no single person can both make and release a production change. In CI/CD it is enforced by the system: protected branches require someone else's review, and production promotion requires an approver from an authorized group who is not the author." },
              { t: "table", headers: ["Change type", "Controls", "Record"], rows: [
                ["Standard (most deploys)", "Peer review, all gates green, approved promotion", "Generated automatically from PR, build and approval"],
                ["Normal (higher risk: schema, auth, infra)", "Above plus security or architecture review", "Change ticket linked to the pipeline run"],
                ["Emergency", "Expedited approval, then retrospective review within a set window", "Incident and change record linked"]
              ] },
              { t: "widget", id: "progSod" },
              { t: "h", text: "Break-glass access" },
              { t: "ul", items: [
                "Just-in-time elevation through a privileged access tool, time-limited (for example one hour).",
                "MFA plus a reason; alert the security channel when it is used.",
                "Session recording or full audit logging into the SIEM.",
                "Mandatory review afterwards; any change made must be back-ported into code."
              ] },
              { t: "note", variant: "key", html: "<strong>Author, reviewer and approver are different people, and the pipeline proves it.</strong> Emergency access is fast, logged and always reviewed." }
            ]
          },
          {
            id: "audit-evidence",
            title: "Pipeline runs and attestations as audit evidence",
            summary: "Map pipeline controls to SOC 2, ISO 27001, PCI DSS and FedRAMP-style requirements.",
            minutes: 10,
            tags: ["practitioner", "audit", "soc2", "iso27001", "pci-dss", "fedramp", "compliance-as-code"],
            blocks: [
              { t: "table", headers: ["Pipeline control", "Evidence produced", "Typical framework theme"], rows: [
                ["Branch protection and reviews", "PR history with reviewer identities", "Change management (SOC 2, ISO 27001, PCI DSS)"],
                ["SAST, SCA, image and IaC scans", "Scan reports and gate results per build", "Secure development, vulnerability management"],
                ["Signing and provenance", "Signatures, SLSA provenance, SBOM attestations", "Integrity, supply chain (SSDF)"],
                ["Production approval", "Approver identity and timestamp", "Separation of duties"],
                ["Admission control", "Allow and deny decisions with policy ids", "Configuration management"],
                ["Runtime monitoring", "Alerts, issues and response tickets", "Monitoring and incident response"],
                ["Compliance as code", "InSpec or OpenSCAP scan results per host or image", "Hardening baselines (CIS, STIG-style)"]
              ] },
              { t: "p", html: "FedRAMP and similar government programs build on NIST 800-53 controls and add continuous monitoring expectations, so automated, retained evidence matters even more there." },
              { t: "code", lang: "text", code:
                "# compliance as code, briefly\n" +
                "inspec exec linux-baseline -t docker://payments-api-test --reporter json:inspec.json\n" +
                "oscap xccdf eval --profile <CIS_PROFILE_ID> --results oscap.xml <SCAP_CONTENT_FILE>"
              },
              { t: "note", variant: "tip", html: "Retain pipeline logs, scan results and attestations for the audit period in write-once storage. Evidence you cannot produce did not happen." },
              { t: "note", variant: "key", html: "<strong>Every pipeline run is an audit artifact.</strong> System-generated, retained, linked to the change — far stronger than screenshots." }
            ]
          },
          {
            id: "cloud-guardrails",
            title: "Preventive guardrails versus detective controls",
            summary: "AWS SCPs, Azure Policy and GCP Organization Policies prevent; Wiz detects and prioritizes.",
            minutes: 9,
            tags: ["practitioner", "guardrails", "scp", "azure-policy", "gcp-org-policy", "wiz"],
            blocks: [
              { t: "table", headers: ["Cloud", "Preventive mechanism", "Example guardrail"], rows: [
                ["AWS", "Service Control Policies in AWS Organizations", "Deny disabling audit logging; deny actions outside approved regions"],
                ["Azure", "Azure Policy with deny effects, assigned at management groups", "Deny public IPs on certain resource types; require encryption"],
                ["Google Cloud", "Organization Policy constraints", "Restrict public access to storage; disable service account key creation"]
              ] },
              { t: "compare",
                bad: { title: "Detective only", items: ["Every misconfiguration is created, then found", "Alert volume scales with mistakes", "Fixes race against attackers"] },
                good: { title: "Preventive plus detective", items: ["Guardrails stop the worst classes outright", "CNAPP finds what guardrails cannot express", "Findings feed new guardrails over time"] } },
              { t: "code", lang: "json", code:
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [{\n" +
                "    \"Sid\": \"DenyAuditLogTampering\",\n" +
                "    \"Effect\": \"Deny\",\n" +
                "    \"Action\": [\"cloudtrail:StopLogging\", \"cloudtrail:DeleteTrail\"],\n" +
                "    \"Resource\": \"*\"\n" +
                "  }]\n" +
                "}"
              },
              { t: "quiz", id: "prog-governance" },
              { t: "note", variant: "key", html: "<strong>Prevent what you can at the organization level, detect the rest with context.</strong> Guardrails stop classes of mistakes; Wiz finds and ranks what remains." }
            ]
          }
        ]
      },
      {
        id: "feedback",
        name: "Monitoring & Feedback",
        icon: "trend",
        lessons: [
          {
            id: "observability",
            title: "Observability: Prometheus, Grafana, ELK and Splunk",
            summary: "Metrics, logs and traces — and the security signals hiding in them.",
            minutes: 9,
            tags: ["practitioner", "prometheus", "grafana", "elk", "splunk", "observability"],
            blocks: [
              { t: "p", html: "Observability is the ability to ask new questions of a running system. It rests on three signal types — <strong>metrics</strong>, <strong>logs</strong> and <strong>traces</strong> — and for DevSecOps it is also where security problems first show up." },
              { t: "table", headers: ["Signal", "Tooling", "Security use"], rows: [
                ["Metrics", "Prometheus, cloud metrics; dashboards in Grafana", "Spikes in 401/403 rates, unusual egress, CPU from crypto-mining"],
                ["Logs", "ELK / OpenSearch, Splunk, Loki, cloud log services", "Auth events, admin actions, WAF blocks, audit trails"],
                ["Traces", "OpenTelemetry with Jaeger, Tempo or a vendor", "Unexpected call paths, data flows to new destinations"]
              ] },
              { t: "code", lang: "yaml", code:
                "# Prometheus alerting rule: authorization failures far above normal\n" +
                "groups:\n" +
                "  - name: security\n" +
                "    rules:\n" +
                "      - alert: AuthzFailureSpike\n" +
                "        expr: sum(rate(http_requests_total{status=\"403\"}[5m])) by (service) > 5 * sum(rate(http_requests_total{status=\"403\"}[1h] offset 1d)) by (service)\n" +
                "        for: 10m\n" +
                "        labels: { severity: page, team: payments }\n" +
                "        annotations:\n" +
                "          summary: 403 rate is more than 5x yesterday's baseline"
              },
              { t: "ul", items: [
                "Log security events in a structured form (JSON) with user, action, resource, outcome and request id.",
                "Never log secrets, tokens, full card numbers or session cookies; mask at the logger.",
                "Ship logs off the host quickly so an attacker cannot erase them; make the store append-only.",
                "Annotate dashboards with deploys so a change in behaviour links to a release."
              ] },
              { t: "note", variant: "key", html: "<strong>Your telemetry is your first intrusion detector.</strong> Structured, secret-free logs, metrics alerts on security ratios and deploy annotations turn observability into security feedback." }
            ]
          },
          {
            id: "siem-ir",
            title: "SIEM and incident response",
            summary: "From detection to post-incident review, and how lessons feed back into the pipeline.",
            minutes: 10,
            tags: ["practitioner", "siem", "incident-response", "soc"],
            blocks: [
              { t: "p", html: "A <strong>SIEM</strong> (Splunk, Microsoft Sentinel, Elastic Security, Google SecOps and others) collects security events from cloud audit logs, identity providers, endpoints, Kubernetes, the CNAPP and applications, then correlates them with detection rules. The SOC triages its alerts and runs incident response." },
              { t: "h", text: "Incident response lifecycle" },
              { t: "table", headers: ["Phase", "Key activities", "DevSecOps tie-in"], rows: [
                ["Prepare", "Runbooks, on-call, access, tabletop exercises", "Playbooks as code; break-glass access tested"],
                ["Detect and analyse", "Triage alerts, scope, severity", "CNAPP graph shows blast radius instantly"],
                ["Contain", "Revoke credentials, isolate workloads, block indicators", "Admission policy blocks the bad image; network policy isolates pods"],
                ["Eradicate", "Remove the cause: patch, rebuild, rotate", "Fix in code, rebuild from a clean pipeline"],
                ["Recover", "Restore service, monitor closely", "Redeploy known-good signed digest"],
                ["Post-incident review", "Blameless timeline, root cause, actions", "New gate, new detection rule, new policy"]
              ] },
              { t: "note", variant: "tip", html: "Every incident should produce at least one <em>preventive</em> control in the pipeline and one <em>detective</em> rule in the SIEM. That is how the DevSecOps loop learns." },
              { t: "note", variant: "warn", html: "Rebuild, do not clean. A compromised container or VM should be replaced from a trusted pipeline build, not patched in place." },
              { t: "note", variant: "key", html: "<strong>Contain first, then fix in code, then learn into the pipeline.</strong> The SIEM gives the SOC correlation; the pipeline gives the fix a permanent home." }
            ]
          },
          {
            id: "metrics",
            title: "DORA metrics and security metrics",
            summary: "Measure delivery and security together so neither is traded away silently.",
            minutes: 9,
            tags: ["practitioner", "dora", "metrics", "mttr"],
            blocks: [
              { t: "p", html: "The four <strong>DORA</strong> keys measure software delivery performance: two for throughput, two for stability. DevSecOps adds security metrics alongside, so teams cannot hit speed targets by skipping gates or hit security targets by blocking everything." },
              { t: "widget", id: "opsDora" },
              { t: "table", headers: ["Security metric", "What it shows", "Healthy direction"], rows: [
                ["MTTR for critical vulnerabilities", "Speed of removing real risk", "Down, within SLA"],
                ["Open critical issues (CNAPP)", "Exposure right now", "Down"],
                ["Gate block rate", "How often gates stop builds", "Stable; spikes indicate a new rule or regression"],
                ["False-positive rate", "Trust in the gates", "Low; high means gates get bypassed"],
                ["Scan coverage", "Repos, images and accounts actually scanned", "Up to near 100%"],
                ["Exceptions open and overdue", "Accepted risk hygiene", "Few, all with expiry"],
                ["Secrets detected in commits", "Developer hygiene and hook coverage", "Down; pre-commit catches before push"],
                ["Vulnerability escape rate", "Share of issues first found in production rather than in the pipeline", "Down"],
                ["Builds failing policy (%)", "How often changes violate a gate, per team or repo", "Down over time after an initial rise"],
                ["Signed-artifact coverage", "Share of running workloads with a verified signature and provenance", "Up to 100% in enforced namespaces"]
              ] },
              { t: "quiz", id: "prog-feedback" },
              { t: "note", variant: "key", html: "<strong>Throughput, stability and security on one scorecard.</strong> Report DORA with critical-vuln MTTR, coverage and false-positive rate so no dimension is sacrificed in secret." }
            ]
          }
        ]
      },
      {
        id: "data",
        name: "Data & Non-production",
        icon: "database",
        lessons: [
          {
            id: "nonprod-data",
            title: "Production data in dev and test, preview environments and DSPM",
            summary: "Masking, synthetic data, ephemeral environments that do not leak, and finding stray sensitive data.",
            minutes: 9,
            tags: ["practitioner", "test-data", "masking", "synthetic-data", "preview-environments", "dspm"],
            blocks: [
              { t: "table", headers: ["Approach", "How", "When"], rows: [
                ["Synthetic data", "Generated records that match schema and distributions", "Default for dev, CI and previews"],
                ["Masked copy", "Irreversible masking or tokenization of personal fields before leaving production", "Performance tests needing realistic volume"],
                ["Subset plus masking", "Small referentially consistent sample, masked", "Debugging specific data shapes"],
                ["Raw production copy", "Only with the same controls as production", "Rarely, with explicit approval"]
              ] },
              { t: "h", text: "Ephemeral preview environments" },
              { t: "ul", items: [
                "Require authentication (SSO proxy) even for previews.",
                "Short time-to-live with automatic teardown when the PR closes.",
                "Synthetic data only; no production credentials.",
                "Created under a tagged account or namespace so the CNAPP inventories them."
              ] },
              { t: "p", html: "<strong>Wiz DSPM</strong> classifies data stores across accounts, so a test bucket that quietly contains real card numbers or personal data shows up as a sensitive-data finding — and as a critical issue if it is also exposed." },
              { t: "note", variant: "key", html: "<strong>Non-production is not low-risk if it holds production data.</strong> Synthesize or mask, protect previews, and let DSPM find what slipped." }
            ]
          },
          {
            id: "build-log-leaks",
            title: "Secrets and PII in build logs; migration credentials in CI",
            summary: "Masking, log hygiene and short-lived database credentials for pipeline jobs.",
            minutes: 9,
            tags: ["practitioner", "logs", "masking", "database-migrations", "secrets"],
            blocks: [
              { t: "table", headers: ["Leak path", "Example", "Fix"], rows: [
                ["Shell tracing", "<code class='tok'>set -x</code> prints the expanded command with a token", "<code class='tok'>set +x</code> around secret use"],
                ["Groovy interpolation", "Double-quoted sh string embeds the secret", "Single-quoted sh; let the shell expand"],
                ["Debug output", "<code class='tok'>env</code>, <code class='tok'>printenv</code>, verbose HTTP clients", "Ban in pipeline lint; mask patterns"],
                ["Test fixtures", "Real customer records printed by failing tests", "Synthetic fixtures; redact in reporters"],
                ["Transformed secrets", "Base64 or URL-encoded token escapes masking", "Avoid transforming secrets in logs; rotate if seen"]
              ] },
              { t: "h", text: "Database migrations in CI" },
              { t: "p", html: "This lesson is the log-hygiene recap. The full lifecycle — scanning, central storage, identity-based delivery and leak response — lives in <a href='#/chain/identity/secrets-e2e'>secrets end to end</a>; practical Vault and cloud-manager patterns live in <a href='#/chain/identity/secrets-stores'>secret stores in practice</a>." },
              { t: "code", lang: "groovy", code:
                "stage('DB migrate') {\n" +
                "  steps {\n" +
                "    // dynamic, short-lived credential issued by Vault to this pipeline's identity\n" +
                "    withVault(configuration: [vaultUrl: 'https://vault.internal.example', vaultCredentialId: 'vault-approle-ci'],\n" +
                "              vaultSecrets: [[path: 'database/creds/payments-migrator',\n" +
                "                              secretValues: [[envVar: 'DB_USER', vaultKey: 'username'], [envVar: 'DB_PASS', vaultKey: 'password']]]]) {\n" +
                "      sh 'set +x; flyway -user=\"$DB_USER\" -password=\"$DB_PASS\" migrate'\n" +
                "    }\n" +
                "  }\n" +
                "}"
              },
              { t: "quiz", id: "prog-data" },
              { t: "note", variant: "key", html: "<strong>Logs are data with long retention and wide access.</strong> Mask, avoid tracing secrets, use synthetic fixtures, and give migrations expiring credentials." }
            ]
          }
        ]
      },
      {
        id: "data-platform",
        name: "Snowflake & dbt Delivery",
        icon: "database",
        lessons: [
          {
            id: "snowflake-change-delivery",
            title: "Snowflake change delivery with schemachange and Terraform",
            summary: "Version DDL and infrastructure, order changes predictably and keep environments in runtime configuration.",
            minutes: 12,
            tags: ["advanced", "snowflake", "schemachange", "terraform", "cicd"],
            blocks: [
              { t: "p", html: "Snowflake delivery has two complementary lanes: ordered SQL migrations for database objects and Terraform for account-level infrastructure such as roles, warehouses, integrations and grants. Keep ownership explicit so two tools do not fight over the same object." },
              { t: "table", headers: ["Lane", "Good fit", "Evidence"], rows: [
                ["schemachange", "Versioned DDL/DML and repeatable migrations", "Change-history table, query id and reviewed script"],
                ["Terraform", "Roles, grants, warehouses, integrations and policy objects", "Reviewed plan artifact, apply log and state"],
                ["dbt", "Transform models, tests, documentation and lineage", "Manifest, run results and test outcomes"]
              ] },
              { t: "code", lang: "text", code:
                "V1.8.0__add_order_status.sql       # ordered, immutable migration\n" +
                "R__secure_reporting_views.sql      # repeatable definition\n\n" +
                "TARGET_ACCOUNT=<FROM_ENVIRONMENT>\n" +
                "TARGET_DATABASE=<FROM_ENVIRONMENT>\n" +
                "DEPLOY_ROLE=<LEAST_PRIVILEGED_ROLE>" },
              { t: "ul", items: [
                "Plan or dry-run in a temporary database/clone before promotion.",
                "Protect the production environment with approval and a deployment-specific role; production analysis roles remain read-only.",
                "Parameterize account, database, schema, warehouse and role. Never bake environment-specific ids, run ids or dates into reusable SQL.",
                "Serialize migrations and record the exact commit, statement checksum and query ids."
              ] },
              { t: "note", variant: "key", html: "<strong>Code defines intent; the environment supplies identity and destination.</strong> Promotion changes configuration, not SQL text." }
            ]
          },
          {
            id: "dbt-ci",
            title: "dbt CI: build, test, artifacts and state-aware selection",
            summary: "Give changed models realistic feedback without rebuilding the warehouse blindly.",
            minutes: 12,
            tags: ["advanced", "dbt", "data-tests", "artifacts", "state"],
            blocks: [
              { t: "p", html: "A pull request should parse the project, lint SQL, resolve dependencies, build changed models in an isolated target and run generic plus singular tests. State comparison uses the prior production manifest to identify modified resources and downstream impact." },
              { t: "code", lang: "bash", code:
                "dbt deps --target ci\n" +
                "dbt parse --target ci\n" +
                "dbt build --target ci --select 'state:modified+' --state <PROD_ARTIFACT_DIR>\n" +
                "dbt docs generate --target ci" },
              { t: "table", headers: ["Artifact", "Why retain it"], rows: [
                ["manifest.json", "Graph, configuration, compiled metadata and state comparison"],
                ["run_results.json", "Status, timing, failures and adapter responses"],
                ["catalog.json", "Observed warehouse columns and types for documentation"],
                ["sources.json", "Freshness outcomes for declared sources"]
              ] },
              { t: "ul", items: [
                "Use slim CI for pull requests and a scheduled full build/test to catch broad interactions.",
                "Defer unchanged upstream models to a trusted environment only when access and data classification allow it.",
                "Treat warnings deliberately: promote selected warnings to errors, and expire justified exceptions.",
                "Make model contracts, not-null/unique/relationship tests and business assertions part of the release gate."
              ] },
              { t: "note", variant: "key", html: "<strong>State narrows the work; artifacts make the decision reproducible.</strong> CI should explain exactly which graph nodes changed, what ran and why promotion was allowed." }
            ]
          },
          {
            id: "snowflake-safe-promotion",
            title: "Clones, RBAC, rollback and safe promotion",
            summary: "Rehearse risky changes, prove least privilege and design a forward or restore path before execution.",
            minutes: 11,
            tags: ["advanced", "zero-copy-clone", "rbac", "rollback", "promotion"],
            blocks: [
              { t: "widget", id: "progDataRelease" },
              { t: "table", headers: ["Control", "Question it answers"], rows: [
                ["Zero-copy clone", "Can the change be rehearsed and can pre-change state be recovered quickly?"],
                ["Role hierarchy", "Can this deploy identity alter only the intended database objects?"],
                ["Query tags / history", "Which release issued each statement and what did it affect?"],
                ["Reconciliation", "Do counts, keys, freshness and business totals still agree?"],
                ["Rollback runbook", "Is rollback a forward fix, object restore, clone swap or code revert?"]
              ] },
              { t: "p", html: "Back up shared objects before mutation using the team's naming and retention convention. A clone can preserve a table or schema cheaply, but it also inherits sensitive data: apply the same classification, masking and access controls, then remove it when the rollback window closes." },
              { t: "note", variant: "warn", html: "Do not call a destructive reverse migration a rollback unless it has been rehearsed. For many schema changes, a compatible forward fix plus a code revert is safer than trying to reconstruct dropped data." },
              { t: "note", variant: "key", html: "<strong>Promotion is safe when the change, the identity, the evidence and the recovery path are all bounded before execution.</strong>" }
            ]
          },
          {
            id: "snowflake-deploy-gotchas",
            title: "Snowflake deployment gotchas and cross-app learning",
            summary: "Avoid silent skips, invalid runtime paths and environment literals that make a green deploy misleading.",
            minutes: 10,
            tags: ["advanced", "snowflake", "deployment", "procedures", "validation"],
            blocks: [
              { t: "ul", items: [
                "When splitting multi-statement SQL, do not skip a chunk merely because it begins with a comment banner. Execute it when any line contains non-comment content.",
                "A successful CREATE OR REPLACE of a SQL procedure does not prove every body path will run. Retrieve deployed DDL, verify expected tokens and execute a safe representative call.",
                "Keep generated SQL observable. If a wrapper catches statement errors and returns friendly JSON, run the generated statement independently during diagnosis.",
                "Use constant expressions in VALUES; move functions such as JSON parsing into SELECT expressions where the engine permits them.",
                "Validate object names and grants in the target environment after deploy, not just the local rendered SQL."
              ] },
              { t: "p", html: "Forge focuses on the delivery controls. For the data-engineering concepts behind warehouses, transformations, modeling and pipeline architecture, continue in the Glacier academy; this is a prose cross-reference, not a cross-app link." },
              { t: "quiz", id: "prog-data-platform" },
              { t: "note", variant: "key", html: "<strong>A green deploy is a hypothesis until the target object, grants and representative runtime path are verified.</strong>" }
            ]
          }
        ]
      },
      {
        id: "adjacent",
        name: "Resilience & Adjacent Topics",
        icon: "broom",
        lessons: [
          {
            id: "toolchain-dr",
            title: "Backup, disaster recovery and ransomware resilience for the toolchain",
            summary: "Jenkins, the artifact repository, Git and Vault are production systems; recover them like it.",
            minutes: 9,
            tags: ["practitioner", "backup", "disaster-recovery", "ransomware"],
            blocks: [
              { t: "table", headers: ["System", "Back up", "Recovery notes"], rows: [
                ["Git platform", "Repositories, wikis, settings, branch protections", "Developers' clones are not a backup of settings or protections"],
                ["Jenkins", "JCasC config, job definitions, credentials store with its keys", "Rebuild controllers from code; restore secrets separately and securely"],
                ["Artifact repository", "Binaries for every released version, metadata, permissions", "Production rollback depends on it"],
                ["Vault / secret manager", "Encrypted snapshots, unseal or recovery keys held separately", "Practice restore; protect recovery keys with split custody"],
                ["CNAPP and SIEM config", "Policies, projects, automation rules (as code where possible)", "Export and version"]
              ] },
              { t: "ul", items: [
                "Follow 3-2-1 with at least one <strong>immutable or offline</strong> copy in a separate account.",
                "Different credentials for backup administration than for daily operations.",
                "Test restores on a schedule and measure recovery time against your objective.",
                "Keep a minimal rebuild-from-code path for Jenkins and runners."
              ] },
              { t: "note", variant: "key", html: "<strong>If the toolchain is down, you cannot ship a fix.</strong> Immutable, isolated, tested backups for Git, CI, artifacts and secrets." }
            ]
          },
          {
            id: "mobile-devsecops",
            title: "Mobile app DevSecOps, briefly",
            summary: "MobSF, app signing keys, store releases and the mobile-specific checks.",
            minutes: 7,
            tags: ["practitioner", "mobile", "mobsf", "app-signing"],
            blocks: [
              { t: "table", headers: ["Stage", "Mobile-specific control"], rows: [
                ["Code", "Mobile SAST rules; no secrets or API keys embedded in the app (assume it will be decompiled)"],
                ["Build", "Reproducible builds; dependency scanning including mobile SDKs"],
                ["Analyze", "MobSF static and dynamic analysis of APK or IPA: storage, permissions, crypto, network config"],
                ["Sign", "Signing keys and certificates in a managed store or HSM; never on developer laptops"],
                ["Release", "Store review plus staged rollout; certificate pinning and app integrity checks where appropriate"]
              ] },
              { t: "code", lang: "groovy", code:
                "stage('Sign Android release') {\n" +
                "  steps {\n" +
                "    withCredentials([file(credentialsId: 'android-upload-keystore', variable: 'KEYSTORE'),\n" +
                "                     string(credentialsId: 'android-keystore-password', variable: 'KS_PASS')]) {\n" +
                "      sh './gradlew bundleRelease -Pandroid.injected.signing.store.file=\"$KEYSTORE\" -Pandroid.injected.signing.store.password=\"$KS_PASS\"'\n" +
                "    }\n" +
                "  }\n" +
                "}"
              },
              { t: "note", variant: "key", html: "<strong>Everything in the app binary is public.</strong> Keep secrets server-side, analyze the package, and guard signing keys like production credentials." }
            ]
          },
          {
            id: "vendor-saas-risk",
            title: "Third-party, vendor and SaaS integrations in the pipeline",
            summary: "Inventory, least privilege, review and removal for apps, plugins and services connected to delivery.",
            minutes: 8,
            tags: ["practitioner", "third-party-risk", "saas", "integrations"],
            blocks: [
              { t: "table", headers: ["Integration", "Typical access", "Least-privilege version"], rows: [
                ["Code quality or AI review app", "Read and write all repositories", "Read-only on selected repositories"],
                ["Chat notifications", "Post messages and read channels", "Post-only into specific channels"],
                ["Cloud cost or security SaaS", "Admin role in every account", "Read-only role via a scoped trust policy"],
                ["CI marketplace actions or plugins", "Run with the pipeline's token", "Pinned versions; minimal token permissions"],
                ["Scanner SaaS", "Upload code or images", "Data-handling terms reviewed; regional hosting as required"]
              ] },
              { t: "ol", items: [
                "Keep an inventory: what, who owns it, what access, what data.",
                "Review security posture and terms before approval; reassess yearly.",
                "Grant least privilege and short-lived tokens where the integration supports them.",
                "Monitor its activity in audit logs; alert on unusual scope use.",
                "Remove unused integrations and revoke their tokens."
              ] },
              { t: "quiz", id: "prog-adjacent" },
              { t: "note", variant: "key", html: "<strong>Every connected vendor is part of your pipeline's attack surface.</strong> Inventory, scope, monitor and remove." }
            ]
          }
        ]
      }
    ]
  };
})();
