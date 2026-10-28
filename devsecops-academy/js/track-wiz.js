/* =====================================================================
   FORGE · Wiz Cloud Security
   window.TRACKS.wiz — modules: platform / shiftleft / operate

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   Block grammar: see the header of track-found.js.

   Product names, menus and CLI subcommands evolve between releases;
   the lessons say so where it matters and teach the durable concepts.
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

  function sevColor(sev) {
    return sev === "Critical" ? "var(--rose-ink)" : sev === "High" ? "var(--accent-ink)" : sev === "Medium" ? "var(--violet-ink)" : "var(--cyan-ink)";
  }

  var Widgets = {};

  /* ==================================================================
     1. wizToxic — "Build a toxic combination"
     Five risk factors on one VM. Each alone is a finding; together
     they form an attack path that becomes a high-severity issue.
  ================================================================== */
  var TOXIC_FACTORS = [
    { id: "exposed", on: "Internet-exposed", off: "Private subnet", node: "Internet" },
    { id: "vuln", on: "Critical CVE, exploit public", off: "Patched", node: "Exploitable CVE" },
    { id: "secret", on: "Cleartext cloud key on disk", off: "No secrets on disk", node: "Leaked key" },
    { id: "priv", on: "Role with admin rights", off: "Least-privilege role", node: "Admin role" },
    { id: "data", on: "Reaches bucket with PII", off: "No sensitive data", node: "PII bucket" }
  ];

  Widgets.wizToxic = function (mount) {
    shell(mount, "graph", "Build a toxic combination",
      "One VM, five risk factors. A scanner lists each one as a separate finding. A graph-based platform asks whether they connect into a path from the internet to sensitive data, and raises one prioritized issue when they do.");
    var state = { exposed: true, vuln: true, secret: false, priv: true, data: true };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls" });

    function paint() {
      var count = 0, i;
      for (i = 0; i < TOXIC_FACTORS.length; i++) if (state[TOXIC_FACTORS[i].id]) count++;
      var entry = state.exposed && state.vuln;
      var escalate = entry && (state.priv || state.secret);
      var impact = escalate && state.data;
      var sev = impact ? "Critical" : escalate ? "High" : entry ? "Medium" : count ? "Low" : "None";
      clear(stage);
      var path = h("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:6px" });
      var steps = [
        { label: "Internet", lit: state.exposed },
        { label: "VM: web-frontend", lit: entry },
        { label: state.secret ? "Leaked key" : "Instance role", lit: escalate },
        { label: "Admin-level access", lit: escalate },
        { label: "Bucket: customer-pii", lit: impact }
      ];
      for (i = 0; i < steps.length; i++) {
        var s = steps[i];
        path.appendChild(h("span", {
          style: "padding:6px 10px;border-radius:8px;font-size:0.8rem;font-family:var(--font-mono);border:1px solid " +
            (s.lit ? "var(--rose)" : "var(--line)") + ";background:" +
            (s.lit ? "color-mix(in srgb, var(--rose) 16%, transparent)" : "var(--surface-solid)") +
            ";color:" + (s.lit ? "var(--text)" : "var(--text-faint)")
        }, s.label));
        if (i < steps.length - 1) path.appendChild(h("span", { style: "color:" + (steps[i + 1].lit ? "var(--rose-ink)" : "var(--text-faint)") }, "\u2192"));
      }
      stage.appendChild(path);
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:10px;line-height:1.5" },
        impact ? "Complete attack path: exposed, exploitable, able to escalate, and able to reach sensitive data. This is the toxic combination to fix first — breaking any one link breaks the path."
          : escalate ? "An attacker could get in and escalate, but no sensitive data is reachable from here. Still a serious issue."
          : entry ? "Exposed and exploitable, but the workload cannot do much damage. Patch it; the rest of the graph limits blast radius."
          : count ? "Individual findings with no path from the internet. Real, but not where to spend this week."
          : "No risk factors on this workload."));
      clear(readout);
      readout.appendChild(ro("findings", count));
      readout.appendChild(ro("issues raised", impact || escalate || entry ? 1 : 0));
      readout.appendChild(h("span", { class: "ro" }, "issue severity ", h("b", { style: "color:" + (sev === "None" ? "var(--text-dim)" : sevColor(sev)) }, sev)));
    }

    for (var f = 0; f < TOXIC_FACTORS.length; f++) {
      (function (fac) {
        controls.appendChild(segment([[true, fac.on], [false, fac.off]], state[fac.id] ? 0 : 1, function (v) { state[fac.id] = v; paint(); }));
      })(TOXIC_FACTORS[f]);
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. wizPolicy — "Will wizcli fail the build?"
     A simulated scan result evaluated against a CI/CD policy.
  ================================================================== */
  var SCAN_RESULT = [
    { pkg: "openssl 3.0.7", sev: "Critical", fix: true },
    { pkg: "libxml2 2.9.14", sev: "High", fix: true },
    { pkg: "zlib 1.2.12", sev: "High", fix: false },
    { pkg: "jackson-databind 2.13.2", sev: "Medium", fix: true },
    { pkg: "busybox 1.35.0", sev: "Low", fix: false }
  ];
  var SEV_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

  Widgets.wizPolicy = function (mount) {
    shell(mount, "policy", "Will the Wiz CLI scan fail the build?",
      "A simulated image scan found five vulnerabilities. Choose how the CI/CD vulnerability policy is configured and see which findings violate it and what the pipeline does.");
    var threshold = "High", ignoreUnfixed = false, mode = "block";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var violations = 0, i;
      clear(stage);
      for (i = 0; i < SCAN_RESULT.length; i++) {
        var r = SCAN_RESULT[i];
        var hit = SEV_RANK[r.sev] >= SEV_RANK[threshold] && (!ignoreUnfixed || r.fix);
        if (hit) violations++;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:1fr 80px 90px 90px;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line);font-size:0.84rem" },
          h("span", { style: "font-family:var(--font-mono)" }, r.pkg),
          h("span", { style: "font-weight:700;color:" + sevColor(r.sev) }, r.sev),
          h("span", { style: "color:var(--text-dim)" }, r.fix ? "fix available" : "no fix yet"),
          h("span", { style: "font-weight:700;color:" + (hit ? "var(--rose-ink)" : "var(--text-faint)") }, hit ? "violates" : "allowed")));
      }
      var fails = violations > 0 && mode === "block";
      clear(readout);
      readout.appendChild(ro("violations", violations));
      readout.appendChild(ro("policy action", mode === "block" ? "block" : "audit only"));
      readout.appendChild(ro("exit code", fails ? "non-zero" : "0"));
      readout.appendChild(ro("stage", fails ? "FAILED — image not pushed" : violations ? "passed with warnings recorded" : "passed"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["Critical", "Fail on Critical"], ["High", "High and above"], ["Medium", "Medium and above"]], 1, function (v) { threshold = v; paint(); }),
      segment([[false, "Count unfixed"], [true, "Ignore unfixed"]], 0, function (v) { ignoreUnfixed = v; paint(); }),
      segment([["block", "Block"], ["audit", "Audit"]], 0, function (v) { mode = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. wizCompliance — "Leadership posture snapshot"
     Framework posture by project, with a remediation lever.
  ================================================================== */
  var COMPLIANCE = {
    payments: { label: "Payments", cis: 71, nist: 78, soc2: 84, pci: 66 },
    platform: { label: "Platform", cis: 88, nist: 85, soc2: 90, pci: 81 },
    analytics: { label: "Analytics", cis: 63, nist: 70, soc2: 76, pci: 58 }
  };
  var FRAMEWORKS = [["cis", "CIS benchmark"], ["nist", "NIST 800-53"], ["soc2", "SOC 2"], ["pci", "PCI DSS"]];

  Widgets.wizCompliance = function (mount) {
    shell(mount, "board", "Compliance posture by project",
      "A leadership board view: pass rate of mapped controls per framework for one project. Apply the top remediation campaign (enforce encryption, block public buckets, remove stale admin keys) to see the effect.");
    var project = "payments", campaign = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var p = COMPLIANCE[project] || COMPLIANCE.payments;
      var total = 0, i;
      clear(stage);
      for (i = 0; i < FRAMEWORKS.length; i++) {
        var key = FRAMEWORKS[i][0];
        var v = Math.min(100, p[key] + (campaign ? 12 : 0));
        total += v;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:120px 1fr 48px;gap:10px;align-items:center;padding:5px 0" },
          h("span", { style: "font-size:0.84rem" }, FRAMEWORKS[i][1]),
          h("span", { style: "display:block;height:10px;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + v + "%;background:" + (v >= 85 ? "var(--lime)" : v >= 70 ? "var(--accent)" : "var(--rose)") })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem" }, v + "%")));
      }
      var avg = Math.round(total / FRAMEWORKS.length);
      clear(readout);
      readout.appendChild(ro("project", p.label));
      readout.appendChild(ro("average posture", avg + "%"));
      readout.appendChild(ro("audit-ready (85%+)", avg >= 85 ? "yes" : "not yet"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["payments", "Payments"], ["platform", "Platform"], ["analytics", "Analytics"]], 0, function (v) { project = v; paint(); }),
      segment([[false, "Current"], [true, "After campaign"]], 0, function (v) { campaign = v; paint(); })
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
    "wiz-platform": {
      title: "Wiz platform checkpoint",
      sub: "CNAPP, agentless scanning, the Security Graph, posture and workload protection.",
      questions: [
        {
          q: "How does agentless workload scanning inspect a VM's disk without installing anything on it?",
          options: ["It SSHes into the VM", "It uses cloud APIs to snapshot the volumes and analyses the snapshots out-of-band", "It asks developers to upload images", "It reads the VM's memory remotely"],
          answer: 1,
          explain: "The platform connects with a read-only cloud role, takes snapshots of attached volumes, and scans them in a separate scanning environment. No agent, no performance impact on the workload, and full coverage including VMs nobody remembered."
        },
        {
          q: "What is a toxic combination?",
          options: ["Two scanners reporting the same CVE", "Several individually moderate risks on connected resources that together form a real attack path", "A failed deployment", "A misconfigured Jenkins plugin"],
          answer: 1,
          explain: "Exposure, an exploitable vulnerability, excessive permissions and access to sensitive data might each be medium on their own. Connected in the graph they create a path from the internet to your data, which becomes one critical issue."
        },
        {
          q: "In Wiz terminology, how do findings relate to issues?",
          options: ["They are synonyms", "Findings are individual raw results such as a CVE or a failed configuration rule; issues are correlated, prioritized risks raised when graph conditions combine", "Issues are only for Kubernetes", "Findings are tickets in Jira"],
          answer: 1,
          explain: "There can be thousands of findings. Issues are fewer, each with severity, status and the evidence chain — they are the work queue. Findings remain the detail and the audit trail."
        },
        {
          q: "Which capability answers 'which identities can effectively read this bucket, taking all policies into account'?",
          options: ["CSPM", "CIEM", "DAST", "SAST"],
          answer: 1,
          explain: "Cloud Infrastructure Entitlement Management calculates effective permissions across identity policies, resource policies, groups, roles and boundaries, and highlights unused or excessive ones."
        },
        {
          q: "What does DSPM add to cloud security?",
          options: ["Faster builds", "Discovery and classification of sensitive data in cloud data stores so risks can be ranked by what data is exposed", "Container signing", "Load balancing"],
          answer: 1,
          explain: "Data Security Posture Management finds where PII, payment data, health data and secrets live. Combined with the graph, an exposed resource that reaches sensitive data is ranked far above one that does not."
        },
        {
          q: "Why is an outpost or customer-hosted scanner deployment sometimes required?",
          options: ["It is faster to install", "Regulatory or data-residency rules require that snapshots never leave the customer's own cloud accounts", "Agentless scanning does not work otherwise", "It replaces the Security Graph"],
          answer: 1,
          explain: "In an outpost model, scanning runs in infrastructure the customer controls and only metadata is sent to the platform. It addresses data sovereignty concerns at the cost of running more infrastructure."
        }
      ]
    },
    "wiz-shiftleft": {
      title: "Wiz shift-left checkpoint",
      sub: "Wiz Code, wizcli in pipelines, admission control and runtime.",
      questions: [
        {
          q: "What should a Jenkins pipeline use to authenticate wizcli?",
          options: ["A personal admin user's password in the Jenkinsfile", "A dedicated service account's client id and secret stored as a Jenkins credential and bound with withCredentials", "No authentication; wizcli is anonymous", "An SSH key committed to the repo"],
          answer: 1,
          explain: "Create a service account with only the permissions needed to create scans, store its id and secret in the Jenkins credential store, and bind them as environment variables for the scan stage only."
        },
        {
          q: "Where are the rules that decide whether a wizcli scan passes defined?",
          options: ["Hardcoded inside wizcli", "In CI/CD policies configured centrally in the platform and referenced by name in the scan command", "In the Dockerfile", "In Jenkins global settings"],
          answer: 1,
          explain: "Central policies (vulnerability, IaC, secrets, sensitive data) let security teams change thresholds once for every pipeline. The scan names the policy and the CLI returns a failing exit code when it is violated."
        },
        {
          q: "What is code-to-cloud mapping in Wiz Code?",
          options: ["Copying code into the cloud", "Tracing a cloud resource or running image back to the repository, file and owner that defined it, so fixes go to the right team in code", "A Git branching strategy", "Deploying from IDEs"],
          answer: 1,
          explain: "When a misconfigured bucket is found in production, mapping it to the Terraform file and commit that created it means the fix is a PR in code rather than a console click that drifts back on the next apply."
        },
        {
          q: "What is the role of the admission controller in the Wiz flow?",
          options: ["It builds images", "It evaluates Kubernetes deployments at admission time against policies such as image trust or vulnerability thresholds, and can block or audit them", "It replaces the CI pipeline", "It manages Jira tickets"],
          answer: 1,
          explain: "Even if a pipeline is skipped, the cluster itself refuses non-compliant workloads. It is the backstop that guarantees only scanned, trusted images run."
        },
        {
          q: "What does a runtime sensor add that agentless scanning cannot?",
          options: ["Nothing", "Real-time visibility into process, file and network activity inside running workloads to detect active threats", "Faster snapshot scanning", "Source code scanning"],
          answer: 1,
          explain: "Snapshots show what is installed. A lightweight eBPF-based sensor shows what is happening now — a reverse shell, crypto-mining, unexpected outbound connections — which feeds cloud detection and response."
        }
      ]
    },
    "wiz-operate": {
      title: "Wiz operations checkpoint",
      sub: "Integrations, projects, boards, compliance and reporting.",
      questions: [
        {
          q: "What is a Wiz project primarily used for?",
          options: ["Storing build artifacts", "Scoping resources by business unit or application so issues, dashboards and access are owned by the right team", "Running pipelines", "Defining Kubernetes namespaces"],
          answer: 1,
          explain: "Projects group cloud accounts, subscriptions, clusters, tags or repos into ownership units. RBAC can be scoped to a project, so each team sees and remediates its own issues."
        },
        {
          q: "Which integration pattern gets a critical issue to the owning team fastest without flooding them?",
          options: ["Email every finding to everyone", "An automation rule that creates a Jira ticket in the owning project's board and posts to its Slack channel only for critical and high issues", "Weekly PDF exports", "No integration"],
          answer: 1,
          explain: "Route issues, not raw findings, filtered by severity and project. Two-way sync of ticket status keeps the platform and the tracker in agreement."
        },
        {
          q: "Why forward Wiz detections and issues to a SIEM?",
          options: ["To replace the SIEM", "So the SOC can correlate cloud threats with identity, endpoint and network signals in one place for investigation and response", "To store source code", "SIEMs require it for licensing"],
          answer: 1,
          explain: "The SIEM is where the SOC correlates and runs incident response. Cloud context from the platform enriches alerts there."
        },
        {
          q: "Which metric best shows leadership whether cloud risk is going down?",
          options: ["Total number of findings", "Trend of open critical issues and mean time to remediate by project, against SLA", "Number of scans per day", "Number of users in the platform"],
          answer: 1,
          explain: "Raw finding counts rise as coverage grows. Critical issue trend and MTTR against SLA, sliced by owning team, show whether the organization is actually reducing risk."
        },
        {
          q: "What does a compliance framework view such as CIS or PCI DSS show?",
          options: ["Pipeline durations", "The pass rate of the platform's rules mapped to each control in the framework, with drill-down to failing resources", "Code coverage", "Container sizes"],
          answer: 1,
          explain: "Built-in frameworks map configuration rules to controls. The score is evidence for audits, and each failing control drills down to the resources and owners to fix."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.wiz = {
    id: "wiz",
    name: "Wiz Cloud Security",
    short: "WIZ",
    tagline: "CNAPP from code to cloud to runtime",
    color: "#818cf8",
    blurb: "The deepest track. Understand a cloud-native application protection platform end to end: agentless scanning, the Security Graph and toxic combinations, CSPM, CWPP, CIEM, DSPM and KSPM, Wiz Code and wizcli in Jenkins, admission control and runtime defense, then integrations, projects, boards, compliance and leadership reporting.",
    modules: [
      {
        id: "platform",
        name: "Platform & Security Graph",
        icon: "diamond",
        lessons: [
          {
            id: "cnapp",
            title: "What a CNAPP is, and how Wiz scans agentlessly",
            summary: "Why point tools merged into one platform, and how agentless snapshot scanning reaches every workload.",
            minutes: 11,
            tags: ["practitioner", "wiz", "cnapp", "agentless"],
            blocks: [
              { t: "p", html: "A <strong>cloud-native application protection platform (CNAPP)</strong> combines what used to be separate products — cloud posture, workload scanning, identity analysis, data security, Kubernetes posture, code scanning and runtime detection — on a <strong>single inventory and risk model</strong>. Wiz is one of the best-known CNAPPs, built around agentless scanning and a security graph." },
              { t: "h", text: "Why consolidate?" },
              { t: "compare",
                bad: { title: "Separate point tools", items: ["Five consoles, five inventories, five severity scales", "A CVE tool cannot see that the VM is internet-facing", "A posture tool cannot see the CVE", "Teams drown in uncorrelated findings"] },
                good: { title: "One platform, one graph", items: ["Single inventory across clouds, clusters and code", "Every finding enriched with exposure, identity and data context", "Correlated issues ranked by real attack paths", "One owner model and one workflow"] } },
              { t: "h", text: "How agentless scanning works" },
              { t: "ol", items: [
                "<strong>Connect</strong> each cloud account, subscription or project with a read-only role (plus snapshot permissions). This is typically deployed with a template or Terraform by the cloud team.",
                "<strong>Inventory</strong>: the platform reads cloud APIs for every resource, its configuration, network path, identity and relationships.",
                "<strong>Snapshot scan</strong>: for VMs, container hosts and serverless packages, it snapshots disks and analyses them out-of-band — OS packages, libraries, secrets on disk, malware, end-of-life software, sensitive data.",
                "<strong>Graph</strong>: everything is written as nodes and edges in the Security Graph.",
                "<strong>Evaluate</strong>: configuration rules, vulnerability data and graph-based controls run continuously and raise findings and issues.",
                "<strong>Clean up</strong>: snapshots are deleted after analysis."
              ] },
              { t: "stat", items: [
                { v: "Minutes", k: "to first visibility after connecting an account — no rollout project" },
                { v: "100%", k: "workload coverage target: nothing depends on an agent being installed" },
                { v: "0", k: "performance impact on the scanned workload" }
              ] },
              { t: "table", headers: ["Agentless", "Agent / sensor-based"], rows: [
                ["Fast, complete coverage including forgotten resources", "Real-time runtime visibility"],
                ["Point-in-time (scan cadence, typically daily)", "Continuous, sees processes and network calls"],
                ["No operational burden on workload teams", "Deployment and lifecycle to manage"],
                ["Wiz's core scanning model", "Wiz runtime sensor, for detection and response"]
              ] },
              { t: "note", variant: "tip", html: "The two are complementary. Use agentless for complete posture and vulnerability coverage, and add the runtime sensor to the workloads where active threat detection matters most." },
              { t: "note", variant: "key", html: "<strong>A CNAPP is one inventory and one risk model across the cloud.</strong> Agentless snapshot scanning gets complete coverage in minutes; the graph turns that coverage into prioritized risk." }
            ]
          },
          {
            id: "security-graph",
            title: "The Security Graph, toxic combinations and attack paths",
            summary: "Model the cloud as a graph and rank risk by connected paths instead of single findings.",
            minutes: 12,
            tags: ["practitioner", "wiz", "security-graph", "toxic-combinations", "attack-paths", "issues"],
            blocks: [
              { t: "p", html: "The <strong>Security Graph</strong> represents every cloud object as a node — VMs, containers, functions, buckets, databases, identities, roles, keys, network interfaces, load balancers, Kubernetes resources, repositories — and every relationship as an edge: <em>exposes</em>, <em>runs</em>, <em>assumes</em>, <em>can read</em>, <em>contains</em>, <em>deployed from</em>." },
              { t: "diagram", id: "wiz-graph", caption: "Four ordinary findings connect into one path from the internet to customer data." },
              { t: "h", text: "Findings versus issues" },
              { t: "table", headers: ["", "Finding", "Issue"], rows: [
                ["What it is", "One raw result: a CVE on a package, a failed configuration rule, a secret on disk", "A prioritized risk raised when a control's graph conditions match"],
                ["Volume", "Thousands to millions", "Tens to hundreds"],
                ["Context", "About one resource", "About a path across resources"],
                ["Workflow", "Detail and evidence", "The queue: severity, status, owner, due date, ticket"],
                ["Example", "CVE on openssl on vm-web-01", "Publicly exposed VM with a critical exploitable CVE and an admin role that can read PII"]
              ] },
              { t: "h", text: "What makes a combination toxic" },
              { t: "table", headers: ["Factor", "Question the graph answers"], rows: [
                ["Exposure", "Is there an effective network path from the internet (load balancer, public IP, open security group)?"],
                ["Vulnerability", "Is there a critical or high CVE, ideally with a known exploit, on that workload?"],
                ["Identity", "Does the workload's role, or a key on its disk, grant high or admin privileges?"],
                ["Lateral movement", "Can those privileges reach other accounts, clusters or workloads?"],
                ["Data", "Can it read a store classified as holding sensitive data?"]
              ] },
              { t: "widget", id: "wizToxic" },
              { t: "h", text: "Querying the graph" },
              { t: "p", html: "Analysts explore the graph with a visual query builder: choose a starting node type, add relationships and conditions, and save the query as a custom control that raises issues. In plain words, the query reads like this:" },
              { t: "code", lang: "text", code:
                "FIND  virtual machines\n" +
                "WHERE exposed to the internet\n" +
                "AND   has vulnerability WITH severity = Critical AND has known exploit\n" +
                "AND   uses identity WHICH has admin permissions\n" +
                "AND   that identity CAN READ data store WITH sensitive data classification = PII\n" +
                "RAISE issue severity Critical, project = owner of the VM"
              },
              { t: "note", variant: "tip", html: "Fix the cheapest link. Removing an unnecessary admin role or closing an exposure often breaks the path faster than patching — then patch on the normal cadence." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'thousands of CVEs, where do we start' or 'which vulnerabilities actually matter' — answer with attack-path context, not CVSS sorting." },
              { t: "note", variant: "key", html: "<strong>Risk lives in connections, not in single findings.</strong> The graph links exposure, vulnerability, identity and data; issues surface only the paths an attacker could actually walk." }
            ]
          },
          {
            id: "posture",
            title: "Posture: CSPM, CIEM, DSPM and KSPM",
            summary: "Four posture lenses on the same graph: configuration, identities, data and Kubernetes.",
            minutes: 12,
            tags: ["practitioner", "wiz", "cspm", "ciem", "dspm", "kspm"],
            blocks: [
              { t: "table", headers: ["Capability", "Question", "Typical findings"], rows: [
                ["<strong>CSPM</strong> — Cloud Security Posture Management", "Is each cloud resource configured safely and compliantly?", "Public bucket, unencrypted disk, logging off, open management port, MFA not enforced"],
                ["<strong>CIEM</strong> — Cloud Infrastructure Entitlement Management", "Who can effectively do what, and is it more than they need?", "Unused admin role, cross-account trust to unknown account, long-lived access keys, privilege escalation paths"],
                ["<strong>DSPM</strong> — Data Security Posture Management", "Where is sensitive data, and who or what can reach it?", "PII in an unencrypted bucket, payment data in a test database, secrets in data stores"],
                ["<strong>KSPM</strong> — Kubernetes Security Posture Management", "Are clusters and workloads configured safely?", "Privileged pods, cluster-admin bindings, public API server, missing network policies"]
              ] },
              { t: "h", text: "CSPM: cloud configuration rules" },
              { t: "p", html: "Configuration rules evaluate each resource's settings against best practice and framework controls. A failed rule is a <strong>configuration finding</strong>; many rules support <strong>auto-remediation</strong> or produce a remediation snippet for the console, CLI or Terraform. Custom rules can be written in a policy language to encode internal standards." },
              { t: "h", text: "CIEM: effective permissions" },
              { t: "p", html: "Cloud permissions are the union and intersection of identity policies, resource policies, groups, permission boundaries, service control policies and role trust. CIEM computes the <strong>effective</strong> result, so you can answer 'who can read this bucket?' and 'what can this role really do?' — and compares granted with used permissions to propose right-sized policies." },
              { t: "h", text: "DSPM: data classification" },
              { t: "p", html: "During scanning, data stores (buckets, databases, file shares, snapshots) are sampled and classified — personal data, payment card data, health data, secrets. Classification becomes a graph property, so an exposure that reaches <em>classified</em> data is ranked above the same exposure on an empty bucket." },
              { t: "h", text: "KSPM: clusters as first-class citizens" },
              { t: "p", html: "Connecting clusters (managed or self-managed) brings Kubernetes objects into the graph: namespaces, workloads, service accounts, roles and bindings. Posture rules then catch risky manifests, and the graph links a pod to the node, the cloud role it can assume and the data that role reaches." },
              { t: "note", variant: "trap", html: "Posture findings without ownership become a dashboard nobody acts on. Map accounts and clusters to projects and owners before turning on notifications." },
              { t: "note", variant: "key", html: "<strong>CSPM configuration, CIEM identity, DSPM data, KSPM Kubernetes — one graph.</strong> Each lens alone is a list; together they rank which exposure leads to which data." }
            ]
          },
          {
            id: "workloads",
            title: "Workload protection and vulnerability management",
            summary: "CWPP, vulnerability prioritization, end-of-life software, and how container images connect to running workloads.",
            minutes: 10,
            tags: ["practitioner", "wiz", "cwpp", "vulnerability-management", "containers"],
            blocks: [
              { t: "p", html: "<strong>Cloud Workload Protection (CWPP)</strong> covers what runs: VMs, containers, serverless functions. Agentless scanning finds OS and library vulnerabilities, end-of-life runtimes, malware, and secrets on disk; the runtime sensor adds live behaviour." },
              { t: "h", text: "From image to running container" },
              { t: "ol", items: [
                "CI scans the image with wizcli before push and records the result.",
                "Registries connected to the platform are scanned continuously, so images get re-evaluated when new CVEs are published.",
                "Running containers are matched to their image digest, so a registry finding shows which clusters and namespaces are actually running it.",
                "Code-to-cloud mapping links the image back to its Dockerfile and repo for the fix."
              ] },
              { t: "h", text: "Prioritizing vulnerabilities" },
              { t: "table", headers: ["Signal", "Effect on priority"], rows: [
                ["Severity and known exploitation", "Base ranking"],
                ["Fix available", "Can it be resolved by an upgrade now?"],
                ["Running versus only in a registry", "A CVE in an unused image is low priority"],
                ["Internet exposure and attack path", "Raises the vulnerability into a toxic-combination issue"],
                ["Sensitive data reachable", "Raises impact"],
                ["End-of-life software", "No future fixes: plan the upgrade, not a patch"]
              ] },
              { t: "note", variant: "tip", html: "Most vulnerabilities in containers come from the base image. Fixing one base image and rebuilding often removes hundreds of findings across dozens of services at once." },
              { t: "quiz", id: "wiz-platform" },
              { t: "note", variant: "key", html: "<strong>Vulnerability management with context.</strong> Scan in CI, re-scan in the registry, map to what is actually running, and let exposure and data reach decide the order." }
            ]
          }
        ]
      },
      {
        id: "shiftleft",
        name: "Shift Left: Wiz Code & CLI",
        icon: "bolt",
        lessons: [
          {
            id: "wiz-code",
            title: "Wiz Code: repositories, IDE and code-to-cloud",
            summary: "Bring the same policies into source control and the IDE, and trace cloud risk back to the line that created it.",
            minutes: 10,
            tags: ["practitioner", "wiz", "wiz-code", "code-to-cloud", "shift-left"],
            blocks: [
              { t: "p", html: "<strong>Wiz Code</strong> extends the platform into the development lifecycle. It connects to version control to scan repositories, comments on pull requests, offers an IDE extension, and — the differentiator — maps cloud resources back to the code that defined them." },
              { t: "table", headers: ["Surface", "What it scans", "Feedback"], rows: [
                ["IDE extension", "IaC, secrets, vulnerable dependencies as you type", "Inline warnings, before commit"],
                ["Pull request scanning", "Changed IaC, dependencies, secrets, Dockerfiles", "PR comments and a status check"],
                ["Repository scanning", "Full repo contents and history on a schedule", "Findings in the platform, owned by project"],
                ["CI/CD with wizcli", "IaC directories, images, file systems", "Pass or fail exit code in the pipeline"]
              ] },
              { t: "h", text: "Code-to-cloud and cloud-to-code" },
              { t: "p", html: "When a production bucket is found public, the platform can show the Terraform resource, file, line, commit and author that created it. The fix becomes a pull request to that file — so the next <code class='tok'>terraform apply</code> does not revert a console hotfix." },
              { t: "compare",
                bad: { title: "Console hotfix", items: ["Engineer unticks 'public' in the console", "Next apply re-creates the public ACL", "Issue reopens, trust drops", "No record of why"] },
                good: { title: "Fix in code", items: ["Issue links to the Terraform line and owner", "PR changes the module, scanned by Wiz Code", "Apply makes the fix permanent", "Prevention policy blocks reintroduction"] } },
              { t: "note", variant: "tip", html: "Use the <em>same</em> policy names in IDE, PR, CI and cloud. A developer then sees exactly the rule that would raise an issue in production." },
              { t: "note", variant: "key", html: "<strong>One policy set from IDE to runtime, and a thread back from cloud to code.</strong> That is what makes shift-left fixes permanent." }
            ]
          },
          {
            id: "wizcli",
            title: "wizcli: IaC, image and directory scans with policies",
            summary: "Authenticate, scan, apply CI/CD policies and fail the build — command by command.",
            minutes: 12,
            tags: ["practitioner", "wiz", "wizcli", "iac", "container-scan", "policy"],
            blocks: [
              { t: "p", html: "<strong>wizcli</strong> is the command-line scanner for pipelines and developer machines. It authenticates with a service account, scans locally, evaluates results against <strong>CI/CD policies</strong> defined centrally in the platform, prints findings, uploads the scan for visibility, and returns a failing exit code when a blocking policy is violated." },
              { t: "h", text: "Set up once (platform side)" },
              { t: "ol", items: [
                "Create a dedicated <strong>service account</strong> for CI with only the permission to create scans. You receive a client id and a client secret — store them straight into the CI credential store.",
                "Define <strong>CI/CD policies</strong>: a vulnerability policy (severity threshold, ignore unfixed, package exceptions), an IaC policy (which rules, which severities), a secrets policy and optionally a sensitive-data policy.",
                "Set each policy to <em>audit</em> while you tune, then to <em>block</em>."
              ] },
              { t: "h", text: "The commands" },
              { t: "code", lang: "bash", code:
                "# authenticate (values injected by CI from its credential store)\n" +
                "wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\"\n\n" +
                "# 1. IaC: Terraform, CloudFormation, Kubernetes, Helm, Dockerfiles in a directory\n" +
                "wizcli iac scan --path infra/ --policy \"<WIZ_IAC_POLICY>\"\n\n" +
                "# 2. directory: dependencies, secrets and vulnerable files in the source tree\n" +
                "wizcli dir scan --path . --policy \"<WIZ_VULN_POLICY>\"\n\n" +
                "# 3. container image: build locally, scan BEFORE pushing\n" +
                "docker build -t registry.internal.example/payments-api:482 .\n" +
                "wizcli docker scan --image registry.internal.example/payments-api:482 \\\n" +
                "  --policy \"<WIZ_VULN_POLICY>\" --dockerfile Dockerfile\n\n" +
                "# 4. after push, tag the image digest so the platform links CI result to runtime\n" +
                "wizcli docker tag --image registry.internal.example/payments-api:482"
              },
              { t: "note", variant: "warn", html: "Subcommand names change between wizcli releases (newer versions group commands under a <code class='tok'>scan</code> verb, for example scanning a container image or a directory). Pin the CLI version in your build image and check <code class='tok'>wizcli --help</code> before copying commands." },
              { t: "h", text: "What decides pass or fail" },
              { t: "table", headers: ["Policy setting", "Effect"], rows: [
                ["Severity threshold", "Findings at or above it violate the policy"],
                ["Ignore unfixed", "Vulnerabilities with no available fix do not violate"],
                ["Exceptions / ignore rules", "Specific packages, CVEs or rules allowed, ideally with expiry"],
                ["Action: audit", "Violations recorded, exit code still passes"],
                ["Action: block", "Violations produce a non-zero exit code and fail the stage"]
              ] },
              { t: "widget", id: "wizPolicy" },
              { t: "note", variant: "tip", html: "Scan the image <em>before</em> pushing it. A failed scan then never leaves a vulnerable image in the registry for someone else to deploy." },
              { t: "note", variant: "key", html: "<strong>Authenticate with a scoped service account, name a central policy, trust the exit code.</strong> Security tunes the policy once; every pipeline enforces it." }
            ]
          },
          {
            id: "wiz-jenkins",
            title: "Wiz CLI in Jenkins with the credential store",
            summary: "A production-shaped Jenkinsfile stage: install, authenticate from credentials, scan, gate and report.",
            minutes: 12,
            tags: ["practitioner", "wiz", "wizcli", "jenkins", "credentials"],
            blocks: [
              { t: "p", html: "Store the Wiz service account in Jenkins as a <strong>Username with password</strong> credential (id: client id, password: client secret) under the id <code class='tok'>wiz-service-account</code>, scoped to the folder of the teams that need it. The Jenkinsfile only ever references the <em>id</em>." },
              { t: "code", lang: "groovy", code:
                "pipeline {\n" +
                "  agent { label 'linux-docker' }\n" +
                "  environment {\n" +
                "    IMAGE = \"registry.internal.example/payments-api:${env.BUILD_NUMBER}\"\n" +
                "  }\n" +
                "  stages {\n" +
                "    stage('Build image') {\n" +
                "      steps { sh 'docker build -t \"$IMAGE\" .' }\n" +
                "    }\n" +
                "    stage('Wiz CLI scans') {\n" +
                "      steps {\n" +
                "        // credentials come from the Jenkins credential store by id; nothing secret is in this file\n" +
                "        withCredentials([usernamePassword(credentialsId: 'wiz-service-account',\n" +
                "                                          usernameVariable: 'WIZ_CLIENT_ID',\n" +
                "                                          passwordVariable: 'WIZ_CLIENT_SECRET')]) {\n" +
                "          sh '''\n" +
                "            set +x\n" +
                "            wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\"\n" +
                "            wizcli iac scan    --path infra/ --policy \"<WIZ_IAC_POLICY>\"\n" +
                "            wizcli dir scan    --path .      --policy \"<WIZ_VULN_POLICY>\"\n" +
                "            wizcli docker scan --image \"$IMAGE\" --dockerfile Dockerfile \\\n" +
                "                               --policy \"<WIZ_VULN_POLICY>\"\n" +
                "          '''\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "    stage('Push and tag') {\n" +
                "      when { branch 'main' }\n" +
                "      steps {\n" +
                "        withCredentials([usernamePassword(credentialsId: 'registry-push',\n" +
                "                                          usernameVariable: 'REG_USER',\n" +
                "                                          passwordVariable: 'REG_TOKEN')]) {\n" +
                "          sh 'echo \"$REG_TOKEN\" | docker login registry.internal.example -u \"$REG_USER\" --password-stdin'\n" +
                "          sh 'docker push \"$IMAGE\"'\n" +
                "        }\n" +
                "        withCredentials([usernamePassword(credentialsId: 'wiz-service-account',\n" +
                "                                          usernameVariable: 'WIZ_CLIENT_ID',\n" +
                "                                          passwordVariable: 'WIZ_CLIENT_SECRET')]) {\n" +
                "          sh 'wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\" && wizcli docker tag --image \"$IMAGE\"'\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "  post {\n" +
                "    failure { echo 'Wiz policy or another gate failed: see the scan summary above and in the Wiz CI/CD scans view' }\n" +
                "  }\n" +
                "}"
              },
              { t: "h", text: "Why each line is shaped this way" },
              { t: "table", headers: ["Choice", "Reason"], rows: [
                ["<code class='tok'>withCredentials</code> + credential id", "The secret lives encrypted in Jenkins (or a vault behind it) and is masked in console output"],
                ["Triple-single-quoted <code class='tok'>sh '''…'''</code>", "The shell expands the variables; Groovy never interpolates the secret into the command string"],
                ["<code class='tok'>set +x</code>", "Prevents shell tracing from echoing the command line with expanded values"],
                ["Scan before push", "A failing image never reaches the registry"],
                ["Policies by name", "Thresholds are owned centrally in the platform, not tuned per Jenkinsfile"],
                ["<code class='tok'>docker tag</code> after push", "Links the CI scan to the image digest that will run, for admission control and runtime correlation"],
                ["Folder-scoped credential", "Only the teams that need Wiz scans can use the service account"]
              ] },
              { t: "note", variant: "tip", html: "Put this stage in the shared library (for example a <code class='tok'>wizScans(image: IMAGE)</code> step). Every service then gets the same, reviewed implementation and the platform team can upgrade the CLI once." },
              { t: "note", variant: "warn", html: "The Groovy <code class='tok'>environment</code> block above interpolates <code class='tok'>BUILD_NUMBER</code>, which is fine because it is not a secret. Never use Groovy interpolation for anything bound by <code class='tok'>withCredentials</code>." },
              { t: "note", variant: "key", html: "<strong>Credential id in the Jenkinsfile, secret in the store, expansion in the shell.</strong> Scan IaC, source and the image before push, then tag the digest so the cluster knows it was scanned." }
            ]
          },
          {
            id: "admission",
            title: "Admission controller, Wiz Defend and the runtime sensor",
            summary: "Enforce at deploy time, detect at run time, respond across the cloud.",
            minutes: 11,
            tags: ["advanced", "wiz", "admission-controller", "runtime-sensor", "wiz-defend", "cdr"],
            blocks: [
              { t: "h", text: "Admission controller: the deploy-time backstop" },
              { t: "p", html: "Pipelines can be bypassed: someone runs <code class='tok'>kubectl apply</code> by hand, or a third-party chart pulls an unscanned image. The Wiz admission controller, installed into each cluster with the Kubernetes integration, evaluates every create or update request against policies <strong>before</strong> the API server stores it." },
              { t: "table", headers: ["Policy type", "Example rule", "On violation"], rows: [
                ["Image trust / integrity", "Only images scanned by wizcli and tagged in the platform, or signed by our key", "Reject deployment"],
                ["Vulnerability", "No critical CVEs with a fix available", "Reject or audit"],
                ["Misconfiguration", "No privileged pods, no host networking, resource limits set", "Reject or audit"],
                ["Mode", "Start in audit (log and allow), then enforce (deny)", "Gradual rollout per namespace"]
              ] },
              { t: "code", lang: "text", code:
                "kubectl apply -f deploy.yaml\n" +
                "Error from server: admission webhook denied the request:\n" +
                "  image registry.internal.example/payments-api:483 violates policy \"Prod image trust\":\n" +
                "  image digest has no passing CI scan record\n" +
                "  remediation: run the pipeline to scan and tag the image, then redeploy"
              },
              { t: "h", text: "Runtime sensor" },
              { t: "p", html: "The <strong>runtime sensor</strong> is a lightweight eBPF-based component deployed as a DaemonSet on Kubernetes nodes or on VMs. It watches process execution, file access and network connections inside workloads and raises detections such as a shell spawned in a web container, a crypto-miner binary, access to cloud credential files, or connections to known-malicious destinations." },
              { t: "h", text: "Wiz Defend: cloud detection and response" },
              { t: "p", html: "Wiz Defend combines runtime sensor signals with <strong>cloud control-plane logs</strong> (for example cloud audit trails and Kubernetes audit logs) and threat intelligence. Detections are correlated on the graph into <strong>threats</strong> with a timeline — initial access, actions, affected resources, and the blast radius the graph already knows about." },
              { t: "ol", items: [
                "Detection: the sensor sees a reverse shell in the payments pod.",
                "Correlation: audit logs show the pod's role listing buckets minutes later.",
                "Context: the graph shows that role can read the PII bucket — high-impact threat.",
                "Response: notify the SOC in the SIEM, open an incident ticket, and run the response playbook (isolate the pod, revoke the role session, rotate keys).",
                "Prevention: the root-cause CVE becomes a CI policy exception that is no longer allowed; admission blocks the old image."
              ] },
              { t: "quiz", id: "wiz-shiftleft" },
              { t: "note", variant: "key", html: "<strong>CI prevents, admission enforces, runtime detects.</strong> The admission controller guarantees only scanned images run; the sensor and Wiz Defend catch what prevention missed, with graph context for impact." }
            ]
          }
        ]
      },
      {
        id: "operate",
        name: "Operate, Report & Integrate",
        icon: "grid",
        lessons: [
          {
            id: "integrations",
            title: "Integrations: Jira, Slack, SIEM and automation rules",
            summary: "Route the right issues to the right owners, and feed the SOC.",
            minutes: 10,
            tags: ["practitioner", "wiz", "jira", "slack", "siem", "automation"],
            blocks: [
              { t: "p", html: "A security platform is only as useful as the work it causes. <strong>Automation rules</strong> watch for events (an issue created, its severity changed, a threat detected) and trigger <strong>actions</strong> through integrations." },
              { t: "table", headers: ["Integration", "Typical use", "Design tip"], rows: [
                ["Jira (or another tracker)", "Create a ticket per issue in the owning team's project, with two-way status sync", "Filter by project and severity; include the remediation steps and resource links"],
                ["Slack / Teams", "Post critical issues and threats to the owning team's channel", "One channel per team, criticals only, or people mute it"],
                ["SIEM (Splunk, Sentinel, others)", "Stream detections, threats and audit logs to the SOC", "Map fields to the SIEM schema; correlate with identity and endpoint data"],
                ["SOAR / webhooks", "Trigger response playbooks", "Keep destructive actions behind human approval"],
                ["ServiceNow and ITSM", "Incident and change workflows", "Align severities with incident priority definitions"]
              ] },
              { t: "code", lang: "text", code:
                "Automation rule: route critical cloud issues\n" +
                "  trigger:  issue created OR severity raised\n" +
                "  filter:   severity in (Critical, High) AND project = Payments\n" +
                "  then:     create Jira ticket  -> project PAY, type Security Bug, due by SLA\n" +
                "            send Slack message  -> channel for the payments team\n" +
                "  sync:     ticket resolved -> issue status in progress until the next scan verifies the fix"
              },
              { t: "note", variant: "tip", html: "Let the next scan close the issue, not the ticket. If the ticket closes but the graph still shows the path, the issue should stay open and reopen the ticket." },
              { t: "note", variant: "key", html: "<strong>Route issues, not findings, to owners, by severity.</strong> Trackers carry the work, chat carries urgency, the SIEM carries detections to the SOC." }
            ]
          },
          {
            id: "dashboards",
            title: "Projects, boards, compliance frameworks and leadership reporting",
            summary: "Organize ownership, build dashboards, prove compliance and report risk trends upward.",
            minutes: 12,
            tags: ["practitioner", "wiz", "projects", "dashboards", "compliance", "reporting"],
            blocks: [
              { t: "h", text: "Projects: the ownership model" },
              { t: "p", html: "A <strong>project</strong> groups resources by business context — cloud accounts, subscriptions, clusters, namespaces, tags, repositories. Issues inherit the project, project-scoped roles limit what each team sees, and every dashboard can be filtered by project. Getting projects right is the first job of a rollout." },
              { t: "h", text: "Boards and dashboards" },
              { t: "table", headers: ["Audience", "Widgets that matter"], rows: [
                ["Engineering team", "My open issues by severity, top attack paths, images with fixable criticals, CI policy failures this week"],
                ["Security operations", "New critical issues today, threats detected, unassigned issues past SLA"],
                ["Cloud platform", "Coverage (connected accounts, scanned workloads), configuration rule failures by account"],
                ["Leadership", "Critical issue trend, MTTR by project versus SLA, compliance posture by framework, risk accepted"]
              ] },
              { t: "h", text: "Compliance frameworks" },
              { t: "p", html: "The platform ships framework mappings — <strong>CIS benchmarks</strong> for each cloud and Kubernetes, <strong>NIST 800-53</strong> and the NIST Cybersecurity Framework, <strong>SOC 2</strong>, <strong>PCI DSS</strong>, ISO 27001, HIPAA and more — that map configuration rules to controls. The posture score is the pass rate of mapped checks. You can also create a custom framework for internal standards." },
              { t: "widget", id: "wizCompliance" },
              { t: "h", text: "Risk prioritization in practice" },
              { t: "ol", items: [
                "Work the <strong>critical issues</strong> queue: attack paths to sensitive data first.",
                "Set SLAs per severity (for example critical 7 days, high 30 days) and report breaches.",
                "Run <strong>campaigns</strong> for systemic causes — a base image, a Terraform module, a missing org policy — rather than one ticket per resource.",
                "Track <strong>accepted risk</strong> explicitly with owner and expiry."
              ] },
              { t: "h", text: "A leadership report on one page" },
              { t: "table", headers: ["Metric", "This quarter", "Trend", "Comment"], rows: [
                ["Open critical issues", "14", "down from 41", "Base-image campaign removed most container criticals"],
                ["MTTR, critical", "5.2 days", "down from 12", "Within the 7-day SLA"],
                ["Cloud coverage", "98% of accounts", "up", "Two acquisition accounts pending"],
                ["PCI DSS posture", "86%", "up from 74%", "Encryption and logging gaps closed"],
                ["Accepted risks", "6", "flat", "All with owners and expiry dates"]
              ] },
              { t: "note", variant: "trap", html: "Total findings go <em>up</em> as coverage grows. Report critical issues, MTTR and posture trends — not raw counts — or progress will look like failure." },
              { t: "note", variant: "key", html: "<strong>Projects give ownership, boards give focus, frameworks give evidence.</strong> Report trends of critical issues and MTTR against SLA so leadership sees risk falling." }
            ]
          },
          {
            id: "end-to-end",
            title: "The end-to-end Wiz flow: code, pipeline, cluster, cloud, SOC",
            summary: "Put every Wiz capability in order and follow one change and one incident through it.",
            minutes: 12,
            tags: ["practitioner", "wiz", "end-to-end", "reference"],
            blocks: [
              { t: "p", html: "Here is the whole flow in the order a change travels, with the Wiz capability at each step." },
              { t: "table", headers: ["Step", "Where", "Wiz capability", "Outcome"], rows: [
                ["1. Write", "IDE", "Wiz Code IDE extension", "Misconfig flagged before commit"],
                ["2. Propose", "Pull request", "Wiz Code PR scanning", "Comment plus failing status check if policy violated"],
                ["3. Build", "Jenkins", "wizcli iac / dir / docker scan with CI/CD policies", "Stage fails on blocking policy"],
                ["4. Publish", "Registry", "wizcli docker tag; registry scanning", "Image digest linked to its scan; re-scanned as CVEs appear"],
                ["5. Deploy", "Kubernetes", "Admission controller", "Unscanned or non-compliant workloads rejected"],
                ["6. Run", "Cloud and clusters", "Agentless scanning, CSPM, CIEM, DSPM, KSPM, Security Graph", "Toxic combinations raised as prioritized issues"],
                ["7. Detect", "Workloads and control plane", "Runtime sensor and Wiz Defend", "Threats with timeline and blast radius"],
                ["8. Respond", "Tracker, chat, SIEM", "Automation rules and integrations", "Owner notified, SOC correlated, playbook run"],
                ["9. Improve", "Code again", "Code-to-cloud mapping", "Root cause fixed in the module or base image; policy tightened"],
                ["10. Report", "Boards", "Projects, compliance frameworks, trends", "Leadership sees MTTR, posture and risk trend"]
              ] },
              { t: "h", text: "Walkthrough: one risky change" },
              { t: "ol", items: [
                "A developer adds a Terraform bucket with public read for a demo. The IDE warns; they ignore it.",
                "The PR scan comments; a reviewer approves anyway for the demo branch.",
                "In Jenkins, <code class='tok'>wizcli iac scan</code> with the production IaC policy fails the main-branch build: public buckets are blocking.",
                "The developer changes the bucket to private with a pre-signed URL. The pipeline passes, the image is scanned, pushed and tagged.",
                "Admission verifies the image record and allows the deploy.",
                "Weeks later, a new critical CVE is published for a library in that image. Registry re-scan plus the graph show it is running internet-exposed with a role that reads PII: a critical issue opens.",
                "Automation creates a Jira ticket and a Slack alert for the payments team; code-to-cloud points to the Dockerfile base image.",
                "The team bumps the base image; the next scan verifies the fix and closes the issue. MTTR is recorded on the leadership board."
              ] },
              { t: "note", variant: "tip", html: "You can rehearse this whole flow — including a toxic combination and a failed Wiz policy — in the <a href='#/simulator'>pipeline simulator</a>." },
              { t: "quiz", id: "wiz-operate" },
              { t: "note", variant: "key", html: "<strong>Prevent in code and CI, enforce at admission, see everything agentlessly, detect at runtime, route to owners, report trends.</strong> Each step catches what the one before missed." }
            ]
          }
        ]
      }
    ]
  };
})();
