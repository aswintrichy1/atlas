/* =====================================================================
   FORGE · DevSecOps pipeline simulator  (route: #/simulator)
   window.ForgeSimulator = { mount(main) }

   Everything here is simulated in the browser: no network calls, no real
   tools, no real credentials. Credential names shown in logs are Jenkins
   credential ids, never values.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- DOM helpers ---------------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function each(arr, fn) { for (var i = 0; i < arr.length; i++) fn(arr[i], i); }
  function find(arr, fn) { for (var i = 0; i < arr.length; i++) if (fn(arr[i])) return arr[i]; return null; }
  function fmtMin(sec) {
    if (sec == null) return "\u2014";
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + "m " + (s < 10 ? "0" : "") + s + "s";
  }

  /* ---------------- model ---------------- */
  var SEV_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  var SLA_DAYS = { Critical: 7, High: 30, Medium: 90, Low: 180 };

  var STAGES = [
    { id: "commit", name: "Commit", group: "Source", tool: null, dur: 6 },
    { id: "integrity", name: "Pipeline integrity", group: "Source", tool: "integrity", dur: 8 },
    { id: "secrets", name: "Secret scan", group: "Source", tool: "secrets", dur: 9 },
    { id: "build", name: "Build", group: "Build", tool: null, dur: 70 },
    { id: "test", name: "Unit test", group: "Build", tool: null, dur: 55 },
    { id: "sonar", name: "SonarQube", group: "Build", tool: "sonar", dur: 60 },
    { id: "snyk", name: "Snyk SCA", group: "Build", tool: "snyk", dur: 35 },
    { id: "hadolint", name: "Dockerfile lint", group: "Docker", tool: "hadolint", dur: 5 },
    { id: "image", name: "Image build", group: "Docker", tool: null, dur: 80 },
    { id: "imgscan", name: "Image scan", group: "Docker", tool: "imgscan", dur: 45 },
    { id: "wiziac", name: "Wiz CLI IaC", group: "Docker", tool: "wiziac", dur: 20 },
    { id: "sign", name: "Sign & SBOM", group: "Release", tool: "sign", dur: 15 },
    { id: "push", name: "Push artifact", group: "Release", tool: null, dur: 25 },
    { id: "k8spolicy", name: "K8s policy", group: "Kubernetes", tool: "admission", dur: 12 },
    { id: "approval", name: "Prod approval", group: "Kubernetes", tool: "sod", dur: 240 },
    { id: "deploy", name: "Deploy", group: "Kubernetes", tool: null, dur: 90 },
    { id: "runtime", name: "Wiz runtime", group: "Runtime", tool: "runtime", dur: 30 }
  ];
  function stageIndex(id) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i; return -1; }

  var TOOLS = [
    { id: "integrity", label: "Pipeline integrity", sub: "trusted Jenkinsfile, plugin audit" },
    { id: "secrets", label: "Secret scan", sub: "gitleaks" },
    { id: "depfw", label: "Dependency firewall", sub: "Artifactory virtual repo rules" },
    { id: "logmask", label: "Build-log masking check", sub: "credential leak in console" },
    { id: "sonar", label: "SonarQube", sub: "quality gate" },
    { id: "snyk", label: "Snyk Open Source", sub: "SCA" },
    { id: "hadolint", label: "Hadolint", sub: "Dockerfile lint" },
    { id: "imgscan", label: "Image scan", sub: "Snyk Container + Wiz CLI" },
    { id: "wiziac", label: "Wiz CLI IaC", sub: "Terraform and manifests" },
    { id: "sign", label: "Sign & SBOM", sub: "cosign + Syft" },
    { id: "admission", label: "K8s admission", sub: "Kyverno + Wiz admission controller" },
    { id: "sod", label: "Separation of duties", sub: "second approver for prod" },
    { id: "runtime", label: "Wiz runtime", sub: "sensor, graph and dashboard" }
  ];

  /* detect: ordered list of [stageId, toolId, thresholdKind]; thresholdKind
     "snyk" / "wiz" means the finding only blocks at or above that policy. */
  var SCENARIOS = [
    { id: "secret", group: "Code & secrets", label: "Hardcoded cloud key in config", sev: "Critical", tool: "gitleaks", resource: "src/main/resources/application.yml:14",
      title: "Cloud access key committed in application.yml", detect: [["secrets", "secrets"], ["imgscan", "imgscan"]], fixable: true,
      runtime: { sev: "High", title: "Cloud key present on container filesystem" },
      hint: "Delete the literal, rotate the key at the provider, and read it at runtime from Vault or the Jenkins credential store.", fixMsg: "Key removed from code, rotated, referenced via credential id." },
    { id: "logsecret", group: "Code & secrets", label: "Secret printed in build log", sev: "High", tool: "log check", resource: "Jenkinsfile: stage Test",
      title: "Registry token echoed to console via Groovy interpolation", detect: [["test", "logmask"]], fixable: true, runtime: null,
      hint: "Bind with withCredentials, use single-quoted sh strings and set +x so the shell expands the value and Jenkins masks it. Rotate the exposed token.", fixMsg: "Switched to single-quoted sh with masked binding; token rotated." },
    { id: "sonar", group: "Code & secrets", label: "SQL injection + low coverage", sev: "High", tool: "SonarQube", resource: "OrderRepository.java:88",
      title: "New SQL injection; coverage on new code 58%", detect: [["sonar", "sonar"]], fixable: true, runtime: null,
      hint: "Use a parameterized query and add tests for the new code until coverage meets the gate.", fixMsg: "Parameterized query and tests added." },
    { id: "log4j", group: "Dependencies", label: "Log4Shell-style library CVE", sev: "Critical", tool: "Snyk", resource: "log4j-core 2.14.1",
      title: "log4j-core 2.14.1 remote code execution (CVE-2021-44228)", cvss: 10.0, epss: 0.94, kev: true, reach: true,
      detect: [["snyk", "snyk", "snyk"], ["imgscan", "imgscan", "wiz"]], fixable: true,
      runtime: { sev: "Critical", title: "Exploitable log4j-core in internet-facing pod" },
      hint: "Upgrade log4j-core to a fixed release (2.17.1 or later) through the shared dependency BOM.", fixMsg: "log4j-core upgraded to 2.17.1." },
    { id: "depconf", group: "Dependencies", label: "Dependency confusion package", sev: "Critical", tool: "Dependency firewall", resource: "@acme/payments-utils 99.0.0",
      title: "Internal package name resolved from the public registry at 99.0.0", detect: [["build", "depfw"], ["snyk", "snyk"]], fixable: true,
      runtime: { sev: "Critical", title: "Malicious package beaconing from running pod" },
      hint: "Route the internal scope only to the internal repository, reserve the name publicly, and pin versions in the lockfile.", fixMsg: "Scoped registry routing added; lockfile pinned to internal 2.3.1." },
    { id: "ppe", group: "Pipeline integrity", label: "Poisoned pipeline execution (fork PR)", sev: "Critical", tool: "Pipeline integrity", resource: "PR from fork: Jenkinsfile",
      title: "Fork PR modified the Jenkinsfile to print bound credentials", detect: [["integrity", "integrity"]], fixable: true,
      runtime: { sev: "Critical", title: "CI credential used from an unknown network" },
      hint: "Load the pipeline definition from the protected branch for fork PRs, run untrusted PRs without secrets, and require CODEOWNERS review on Jenkinsfile.", fixMsg: "Trusted Jenkinsfile from main; fork builds get no credentials." },
    { id: "plugin", group: "Pipeline integrity", label: "Unpinned vulnerable Jenkins plugin", sev: "High", tool: "Plugin audit", resource: "Jenkins controller",
      title: "Plugin pipeline-utility-x unpinned at a version with a known advisory", cvss: 8.1, epss: 0.12, kev: false, reach: true,
      detect: [["integrity", "integrity"]], fixable: true,
      runtime: { sev: "High", title: "Jenkins controller VM runs a vulnerable plugin (agentless scan)" },
      hint: "Pin plugins in a versioned plugins list, upgrade to the patched release, and remove plugins nobody uses.", fixMsg: "Plugin pinned to patched version; two unused plugins removed." },
    { id: "root", group: "Docker", label: "Dockerfile runs as root", sev: "Medium", tool: "Hadolint", resource: "Dockerfile",
      title: "No USER instruction: container runs as root", detect: [["hadolint", "hadolint"], ["k8spolicy", "admission"]], fixable: true,
      runtime: { sev: "High", title: "Sensor alert: shell spawned in root container" },
      hint: "Add a non-root USER (for example 10001) or use a nonroot distroless base, and set runAsNonRoot in the pod spec.", fixMsg: "USER 10001 added on a nonroot base." },
    { id: "layersecret", group: "Docker", label: "Secret baked into an image layer", sev: "High", tool: "Hadolint", resource: "Dockerfile: ARG NPM_TOKEN",
      title: "Token passed as build ARG and persisted in image history", detect: [["hadolint", "hadolint"], ["imgscan", "imgscan"]], fixable: true,
      runtime: { sev: "High", title: "Secret readable in a running image layer" },
      hint: "Use a BuildKit secret mount for build-time credentials so they never land in a layer, and rotate the token.", fixMsg: "BuildKit secret mount used; token rotated." },
    { id: "imgcve", group: "Docker", label: "Critical CVE in base image", sev: "Critical", tool: "Wiz CLI", resource: "base image openssl 3.0.1",
      title: "openssl 3.0.1 in base image (simulated SIM-2026-1042)", cvss: 9.8, epss: 0.41, kev: false, reach: true,
      detect: [["imgscan", "imgscan", "wiz"]], fixable: true,
      runtime: { sev: "Critical", title: "Critical openssl CVE running in exposed pod" },
      hint: "Rebuild on the patched minimal base image pinned by digest; one base-image fix clears it for every service.", fixMsg: "Rebuilt on patched distroless base by digest." },
    { id: "privpod", group: "Kubernetes", label: "Privileged pod with hostPath", sev: "Critical", tool: "Kyverno", resource: "deploy/payments-api",
      title: "securityContext privileged: true and hostPath / mounted", detect: [["k8spolicy", "admission"]], fixable: true,
      runtime: { sev: "Critical", title: "Privileged pod can reach the node filesystem" },
      hint: "Remove privileged and hostPath, drop all capabilities, and label the namespace for the restricted Pod Security Standard.", fixMsg: "Privileged and hostPath removed; restricted profile applied." },
    { id: "latest", group: "Kubernetes", label: "Image tag :latest in prod", sev: "Medium", tool: "Kyverno", resource: "deploy/payments-api",
      title: "Deployment references payments-api:latest", detect: [["k8spolicy", "admission"]], fixable: true,
      runtime: { sev: "Medium", title: "Mutable :latest tag running in production" },
      hint: "Deploy the signed digest the pipeline produced (image@sha256:...) and require digests in production.", fixMsg: "Manifest pinned to the signed digest." },
    { id: "netpol", group: "Kubernetes", label: "Missing NetworkPolicy", sev: "Medium", tool: "Kyverno", resource: "namespace/payments",
      title: "Namespace payments has no default-deny NetworkPolicy", detect: [["k8spolicy", "admission"]], fixable: true,
      runtime: { sev: "Medium", title: "Pods reachable from every namespace" },
      hint: "Add a default-deny NetworkPolicy and explicit allow rules for ingress and the database.", fixMsg: "Default-deny plus explicit allow policies added." },
    { id: "untrusted", group: "Kubernetes", label: "Admission block: unsigned image", sev: "High", tool: "Wiz admission", resource: "sidecar: public-registry/proxy",
      title: "Sidecar image from an untrusted registry with no signature", detect: [["k8spolicy", "admission"]], fixable: true,
      runtime: { sev: "High", title: "Unsigned image from an untrusted registry running" },
      hint: "Mirror the sidecar into the internal registry through the pipeline so it is scanned and signed, then reference it by digest.", fixMsg: "Sidecar mirrored, scanned and signed internally." },
    { id: "bucket", group: "Cloud", label: "Public S3 bucket in Terraform", sev: "High", tool: "Wiz CLI", resource: "aws_s3_bucket.customer_exports",
      title: "Bucket customer-exports allows public read", detect: [["wiziac", "wiziac", "wiz"]], fixable: true,
      runtime: { sev: "High", title: "Public bucket holding PII (CSPM + DSPM)" },
      hint: "Set the bucket private, enable the public access block, and share data with expiring pre-signed URLs.", fixMsg: "Bucket private; public access block on." },
    { id: "toxic", group: "Cloud", label: "Wiz toxic combination", sev: "Medium", tool: "Wiz graph", resource: "payments-api role",
      title: "Medium CVE passes CI, but pod is exposed with an admin role that reads PII", cvss: 6.5, epss: 0.22, kev: false, reach: true,
      detect: [], fixable: true,
      runtime: { sev: "Critical", title: "Toxic combination: internet \u2192 vulnerable pod \u2192 admin role \u2192 PII bucket" },
      hint: "Break the cheapest link: remove the admin policy from the workload role and restrict ingress, then patch on the normal cadence.", fixMsg: "Admin policy removed; ingress restricted to the load balancer." },
    { id: "sod", group: "Governance", label: "Prod approval by the author", sev: "High", tool: "SoD gate", resource: "release 482",
      title: "Production promotion approved by the change author only", detect: [["approval", "sod"]], fixable: true, runtime: null,
      hint: "Require approval from the release-approvers group by someone other than the author, recorded with the build.", fixMsg: "Second approver from release-approvers recorded." }
  ];
  var BASELINE = [
    { id: "jackson", baseline: true, sev: "Medium", tool: "Snyk", resource: "jackson-databind 2.13.2", title: "jackson-databind 2.13.2 deserialization issue (fix available)",
      cvss: 5.9, epss: 0.02, kev: false, reach: false, detect: [["snyk", "snyk", "snyk"], ["imgscan", "imgscan", "wiz"]], fixable: true,
      runtime: { sev: "Medium", title: "jackson-databind with available fix in running image" },
      hint: "Upgrade jackson-databind; or raise the threshold if Medium should not block this service.", fixMsg: "jackson-databind upgraded." },
    { id: "zlib", baseline: true, sev: "Medium", tool: "Wiz CLI", resource: "zlib 1.2.12", title: "zlib 1.2.12 (no fix released)",
      cvss: 5.3, epss: 0.01, kev: false, reach: false, detect: [["imgscan", "imgscan", "wiz"]], fixable: false,
      runtime: { sev: "Medium", title: "zlib CVE with no fix in running image" }, hint: "No fix exists yet; track it or accept with expiry.", fixMsg: "" },
    { id: "busybox", baseline: true, sev: "Low", tool: "Wiz CLI", resource: "busybox 1.35.0", title: "busybox 1.35.0 (no fix released)",
      cvss: 3.1, epss: 0.01, kev: false, reach: false, detect: [["imgscan", "imgscan", "wiz"]], fixable: false,
      runtime: { sev: "Low", title: "busybox CVE with no fix in running image" }, hint: "Low and unfixed: accept with expiry or move to distroless.", fixMsg: "" }
  ];
  var ALL = SCENARIOS.concat(BASELINE);
  function byId(id) { return find(ALL, function (s) { return s.id === id; }); }

  var EVIDENCE = [
    { label: "Protected source and trusted pipeline definition", stage: "integrity", fw: "SOC 2 change mgmt \u00b7 SLSA source" },
    { label: "Secret scanning", stage: "secrets", fw: "ISO 27001 secure dev \u00b7 PCI DSS" },
    { label: "Build-log credential masking", stage: "test", tool: "logmask", fw: "SOC 2 logical access" },
    { label: "Static analysis and quality gate", stage: "sonar", fw: "PCI DSS secure dev \u00b7 ISO 27001" },
    { label: "Dependency and supply-chain checks", stage: "snyk", fw: "SSDF \u00b7 PCI DSS vuln mgmt" },
    { label: "Container image lint and scan", stage: "imgscan", fw: "CIS Docker \u00b7 PCI DSS vuln mgmt" },
    { label: "IaC policy scan", stage: "wiziac", fw: "CIS cloud benchmarks" },
    { label: "Signed artifact, SBOM and provenance", stage: "sign", fw: "SLSA build \u00b7 SSDF" },
    { label: "Admission policy enforcement", stage: "k8spolicy", fw: "CIS Kubernetes \u00b7 NIST 800-53 CM" },
    { label: "Separation of duties on prod approval", stage: "approval", fw: "SOC 2 change mgmt \u00b7 PCI DSS" },
    { label: "Runtime monitoring", stage: "runtime", fw: "SOC 2 monitoring \u00b7 NIST 800-53 SI" }
  ];

  /* ---------------- instance ---------------- */
  var current = null;

  function defaults() {
    var tools = {};
    each(TOOLS, function (t) { tools[t.id] = true; });
    return {
      tools: tools,
      active: {},
      baselineFixed: {},
      snykThr: "High", wizThr: "High", coverageMin: 80, mode: "block", speed: 2,
      coverage: 84,
      accepted: {}, jira: {}, jiraSeq: 100,
      day: 1, simClock: 0,
      runs: [], failingSince: null, mttrSamples: [],
      run: null
    };
  }

  function mount(main) {
    if (current && current.destroy) current.destroy();
    document.title = "Pipeline simulator \u00b7 Forge";
    clear(main);
    var inst = createInstance(main);
    current = inst;
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function createInstance(main) {
    var S = defaults();
    var timer = null;
    var ui = {};
    var root = h("article", { class: "lesson sim-page" });
    main.appendChild(root);

    function destroy() { if (timer) clearTimeout(timer); timer = null; }
    function alive() { return root.isConnected; }

    /* ---------- layout ---------- */
    root.appendChild(h("header", { class: "sim-hero" },
      h("div", { class: "sim-kicker" }, "Simulator \u00b7 all data is simulated locally"),
      h("h1", {}, "DevSecOps pipeline simulator"),
      h("p", { class: "sim-lede" }, "Run a Jenkins pipeline from commit to Kubernetes runtime. Inject problems, switch tools off, tighten thresholds, and watch which gate catches each one, what escapes to production, and how the Wiz dashboard, triage queue, compliance evidence and DORA numbers react.")));

    ui.runBtn = h("button", { type: "button", class: "w-btn primary", onclick: onRun }, "Run pipeline");
    ui.pauseBtn = h("button", { type: "button", class: "w-btn", onclick: onPause, disabled: true }, "Pause");
    ui.resetBtn = h("button", { type: "button", class: "w-btn ghost", onclick: onReset }, "Reset");
    ui.status = h("span", { class: "sim-status" }, "Idle");
    root.appendChild(h("div", { class: "sim-toolbar" }, ui.runBtn, ui.pauseBtn, ui.resetBtn,
      speedSeg(), ui.status));

    ui.lane = h("div", { class: "sim-lane", role: "list" });
    root.appendChild(h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Pipeline"), ui.lane));

    ui.logStage = h("span", { class: "sim-log-stage" }, "No run yet");
    ui.log = h("pre", { class: "sim-log", "aria-live": "polite" });
    ui.result = h("div", { class: "sim-result" });
    root.appendChild(h("div", { class: "sim-grid" },
      h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Console ", ui.logStage), ui.log),
      h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Result"), ui.result)));

    root.appendChild(buildControls());

    ui.dash = h("div", { class: "sim-dash" });
    ui.triage = h("div", { class: "sim-triage" });
    ui.evidence = h("div", { class: "sim-evidence" });
    ui.metrics = h("div", { class: "sim-metrics" });
    root.appendChild(h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Wiz dashboard (simulated)"), ui.dash));
    root.appendChild(h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Vulnerability triage"), ui.triage));
    root.appendChild(h("div", { class: "sim-grid" },
      h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Compliance evidence (last run)"), ui.evidence),
      h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Metrics"), ui.metrics)));

    root.appendChild(h("div", { class: "note tip sim-note" }, h("div", { class: "note-body" },
      "Learn the theory behind each gate in the Wiz, Containers & Kubernetes and Pipeline Security tracks. Try audit mode with several scenarios on to see how much reaches runtime when gates only warn.")));

    function speedSeg() {
      var wrap = h("div", { class: "w-seg sim-speed", role: "group", "aria-label": "Speed" });
      each([[1, "1x"], [2, "2x"], [4, "4x"]], function (p) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (S.speed === p[0] ? " active" : "") }, p[1]);
        b.addEventListener("click", function () {
          S.speed = p[0];
          each(wrap.querySelectorAll(".w-seg-btn"), function (x) { x.classList.remove("active"); });
          b.classList.add("active");
        });
        wrap.appendChild(b);
      });
      return wrap;
    }

    function buildControls() {
      var groups = {};
      var order = [];
      each(SCENARIOS, function (s) { if (!groups[s.group]) { groups[s.group] = []; order.push(s.group); } groups[s.group].push(s); });
      ui.scenarioBoxes = {};
      var scen = h("div", { class: "sim-scen" });
      each(order, function (g) {
        var box = h("fieldset", { class: "sim-fs" }, h("legend", {}, g));
        each(groups[g], function (s) {
          var cb = h("input", { type: "checkbox" });
          cb.addEventListener("change", function () { S.active[s.id] = cb.checked; });
          ui.scenarioBoxes[s.id] = cb;
          box.appendChild(h("label", { class: "sim-check" }, cb, h("span", {}, s.label)));
        });
        scen.appendChild(box);
      });

      ui.toolBoxes = {};
      var tools = h("fieldset", { class: "sim-fs sim-tools" }, h("legend", {}, "Tools and gates"));
      each(TOOLS, function (t) {
        var cb = h("input", { type: "checkbox" });
        cb.checked = true;
        cb.addEventListener("change", function () { S.tools[t.id] = cb.checked; paintLane(); });
        ui.toolBoxes[t.id] = cb;
        tools.appendChild(h("label", { class: "sim-check" }, cb, h("span", {}, t.label, h("small", {}, " " + t.sub))));
      });

      function sel(label, opts, value, onChange) {
        var s = h("select", { class: "sim-select", "aria-label": label });
        each(opts, function (o) { var op = h("option", { value: o }, o); if (o === value) op.selected = true; s.appendChild(op); });
        s.addEventListener("change", function () { onChange(s.value); });
        return h("label", { class: "w-field sim-field" }, h("span", {}, label), s);
      }
      ui.covVal = h("b", {}, S.coverageMin + "%");
      var cov = h("input", { type: "range", min: "60", max: "90", step: "5", value: String(S.coverageMin), "aria-label": "Minimum coverage on new code" });
      cov.addEventListener("input", function () { S.coverageMin = Number(cov.value); ui.covVal.textContent = S.coverageMin + "%"; });
      ui.covRange = cov;

      ui.modeSel = sel("Gate mode", ["block", "audit"], S.mode, function (v) { S.mode = v; });
      ui.snykSel = sel("Snyk fails on", ["Critical", "High", "Medium"], S.snykThr, function (v) { S.snykThr = v; });
      ui.wizSel = sel("Wiz policy fails on", ["Critical", "High", "Medium"], S.wizThr, function (v) { S.wizThr = v; });
      var thr = h("fieldset", { class: "sim-fs sim-thr" }, h("legend", {}, "Thresholds"),
        ui.modeSel, ui.snykSel, ui.wizSel,
        h("label", { class: "w-field sim-field" }, h("span", {}, "Sonar min coverage ", ui.covVal), cov),
        h("p", { class: "sim-small" }, "Vulnerabilities with no fix never block (ignore-unfixed). Changes apply from the next stage that reads them."));

      return h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Scenarios, tools and thresholds"),
        h("div", { class: "sim-controls" }, scen, h("div", { class: "sim-side" }, tools, thr)));
    }

    /* ---------- lane ---------- */
    function stageState(id) {
      var r = S.run;
      return r && r.stage[id] ? r.stage[id] : (isSkipped(id) ? "skipped" : "pending");
    }
    function isSkipped(id) {
      var st = STAGES[stageIndex(id)];
      return !!(st.tool && !S.tools[st.tool]);
    }
    function paintLane() {
      clear(ui.lane);
      var lastGroup = null;
      each(STAGES, function (st) {
        if (st.group !== lastGroup) { ui.lane.appendChild(h("span", { class: "sim-group" }, st.group)); lastGroup = st.group; }
        var state = stageState(st.id);
        ui.lane.appendChild(h("div", { class: "sim-stage is-" + state, role: "listitem", title: st.name + ": " + state },
          h("span", { class: "sim-dot" }), h("span", { class: "sim-stage-name" }, st.name), h("span", { class: "sim-stage-st" }, state === "notrun" ? "not run" : state)));
      });
    }

    /* ---------- run engine ---------- */
    function activeList() {
      var list = [];
      each(SCENARIOS, function (s) { if (S.active[s.id]) list.push(s); });
      each(BASELINE, function (s) { if (!S.baselineFixed[s.id]) list.push(s); });
      return list;
    }

    function newRun() {
      S.run = {
        no: S.runs.length + 1, idx: 0, stage: {}, findings: [], caught: {}, lines: [], lineIdx: 0,
        paused: false, done: false, failed: null, simSec: 0, deployed: false, evidence: {}
      };
      clear(ui.log);
    }

    function thresholdRank(kind) { return SEV_RANK[kind === "snyk" ? S.snykThr : S.wizThr]; }

    function addFinding(s, stageId, status, sevOverride, titleOverride) {
      S.run.findings.push({ id: s.id, s: s, stage: stageId, status: status, sev: sevOverride || s.sev, title: titleOverride || s.title });
    }

    /* evaluate one stage: returns { lines: [[cls,text]], outcome: "passed"|"failed"|"warn"|"skipped", reason, hint, culprits } */
    function evaluate(st) {
      var L = [], out = { lines: L, outcome: "passed", culprits: [] };
      var blocks = S.mode === "block";
      function ln(cls, t) { L.push([cls, t]); }
      if (st.tool && !S.tools[st.tool]) {
        ln("dim", "[" + st.name + "] tool disabled: stage skipped");
        out.outcome = "skipped";
        return out;
      }
      var list = activeList();
      function detectHere(toolId) {
        var hits = [];
        each(list, function (s) {
          if (S.run.caught[s.id]) return;
          each(s.detect, function (d) {
            if (d[0] !== st.id) return;
            if (d[1] && !S.tools[d[1]]) return;
            if (toolId && d[1] !== toolId) return;
            var kind = d[2];
            if (kind) {
              var above = SEV_RANK[s.sev] >= thresholdRank(kind);
              if (!above || !s.fixable) {
                if (!find(S.run.findings, function (f) { return f.id === s.id; })) {
                  addFinding(s, st.id, "allowed");
                  ln("dim", "  allowed: " + s.title + " [" + s.sev + (s.fixable ? ", below policy threshold]" : ", no fix: ignore-unfixed]"));
                }
                return;
              }
            }
            if (hits.indexOf(s) === -1) hits.push(s);
          });
        });
        return hits;
      }
      function gate(hits, label) {
        if (!hits.length) return;
        each(hits, function (s) {
          S.run.caught[s.id] = true;
          addFinding(s, st.id, blocks ? "blocked" : "warned");
          ln(blocks ? "err" : "warn", "  " + (blocks ? "FAIL" : "WARN") + " " + label + ": " + s.title + " (" + s.resource + ")");
          out.culprits.push(s);
        });
        out.outcome = blocks ? "failed" : "warn";
      }

      switch (st.id) {
        case "commit":
          ln("", "Started by push to main: commit 3f9c2a1 \"Add export endpoint\"");
          ln("", "Checking out payments-api into ephemeral agent pod build-7xk2");
          ln("dim", "Branch protection: 1 approving review, required checks configured");
          break;
        case "integrity":
          ln("", "Loading Jenkinsfile from protected branch for untrusted change sources");
          ln("", "Auditing controller plugins against pinned plugins list");
          gate(detectHere(), "pipeline integrity");
          if (out.outcome === "passed") ln("ok", "  Pipeline definition trusted; all plugins pinned and current");
          break;
        case "secrets":
          ln("", "gitleaks detect --source . --redact --exit-code 1");
          gate(detectHere(), "gitleaks");
          if (out.outcome === "passed") ln("ok", "  no leaks found in 214 commits scanned");
          break;
        case "build":
          ln("", "./mvnw -B -ntp clean package  (resolving via artifactory virtual repo)");
          if (S.tools.depfw) {
            ln("dim", "Dependency firewall: internal scopes routed to internal repo only");
            gate(detectHere("depfw"), "dependency firewall");
          } else ln("dim", "Dependency firewall disabled: resolving from all upstreams");
          if (out.outcome === "passed") ln("ok", "  BUILD SUCCESS (142 dependencies)");
          break;
        case "test":
          ln("", "Running 486 unit tests");
          ln("ok", "  Tests run: 486, Failures: 0, Errors: 0");
          if (S.tools.logmask) {
            ln("dim", "Scanning console output for unmasked credential patterns");
            gate(detectHere("logmask"), "log masking");
          }
          if (S.active.logsecret && !S.tools.logmask && !S.run.caught.logsecret) ln("warn", "  + echo registry token: ****redacted-by-simulator****  (nobody checked this log)");
          break;
        case "sonar":
          ln("", "withSonarQubeEnv('sonar-main') { mvn sonar:sonar }");
          var cov = S.active.sonar ? 58 : S.coverage;
          ln("", "Coverage on new code: " + cov + "% (gate requires " + S.coverageMin + "%)");
          var hits = detectHere();
          if (!hits.length && cov < S.coverageMin) {
            hits = [{ id: "coverage", sev: "Medium", tool: "SonarQube", resource: "new code", title: "Coverage on new code " + cov + "% below " + S.coverageMin + "%", fixable: true,
              hint: "Add tests for the new code, or agree a lower gate centrally if this threshold is wrong for the service.", fixMsg: "Tests added for new code.", detect: [], runtime: null }];
          }
          gate(hits, "quality gate");
          ln("", "waitForQualityGate abortPipeline: true");
          if (out.outcome === "passed") ln("ok", "  Quality gate: PASSED");
          break;
        case "snyk":
          ln("", "withCredentials([string(credentialsId: 'snyk-api-token', ...)])");
          ln("", "snyk test --all-projects --severity-threshold=" + S.snykThr.toLowerCase() + " --fail-on=upgradable");
          gate(detectHere(), "snyk");
          if (out.outcome === "passed") ln("ok", "  no issues at or above " + S.snykThr + " with a fix");
          break;
        case "hadolint":
          ln("", "hadolint Dockerfile");
          gate(detectHere(), "hadolint");
          if (out.outcome === "passed") ln("ok", "  Dockerfile: no rule violations");
          break;
        case "image":
          ln("", "docker buildx build --platform linux/amd64 -t payments-api:482 .");
          ln("dim", "  [build 1/2] FROM eclipse-temurin:21-jdk@sha256:<DIGEST>");
          ln("dim", "  [stage-1 2/2] FROM distroless/java21:nonroot@sha256:<DIGEST>");
          ln("ok", "  image built: payments-api:482");
          break;
        case "imgscan":
          ln("", "snyk container test payments-api:482 --severity-threshold=" + S.snykThr.toLowerCase());
          ln("", "wizcli auth (credentials: wiz-service-account)  \u2192  authenticated");
          ln("", "wizcli docker scan --image payments-api:482 --policy \"<WIZ_VULN_POLICY>\"  [fails on " + S.wizThr + "]");
          gate(detectHere(), "image policy");
          if (out.outcome === "passed") ln("ok", "  image policy passed");
          break;
        case "wiziac":
          ln("", "wizcli iac scan --path infra/ --policy \"<WIZ_IAC_POLICY>\"  [fails on " + S.wizThr + "]");
          gate(detectHere(), "Wiz IaC policy");
          if (out.outcome === "passed") ln("ok", "  IaC policy passed (Terraform: 37 resources, Helm: 9 manifests)");
          break;
        case "sign":
          ln("", "syft payments-api@sha256:<DIGEST> -o cyclonedx-json > sbom.cdx.json");
          ln("", "cosign sign --key (credential: cosign-private-key) payments-api@sha256:<DIGEST>");
          ln("ok", "  signature and SBOM attestation recorded in transparency log");
          break;
        case "push":
          ln("", "docker push registry.internal.example/payments/payments-api@sha256:<DIGEST>  (credential: registry-push)");
          ln("", "wizcli docker tag --image payments-api:482");
          ln("ok", "  pushed; tag immutable");
          break;
        case "k8spolicy":
          ln("", "helm template payments ./chart | kyverno apply policies/ --resource -");
          ln("", "Wiz admission controller dry-run: image trust, vulnerabilities, misconfigurations");
          var kh = detectHere();
          if (!S.tools.sign && !S.run.caught.unsigned) {
            kh.push({ id: "unsigned", sev: "High", tool: "Wiz admission", resource: "payments-api@sha256:<DIGEST>", title: "Pipeline image has no signature (signing stage disabled)", fixable: true,
              hint: "Turn the Sign & SBOM stage back on: the image-trust policy only admits signed digests.", fixMsg: "Sign & SBOM stage re-enabled.", detect: [], runtime: null });
          }
          gate(kh, "admission policy");
          if (out.outcome === "passed") ln("ok", "  all policies satisfied: restricted PSS, digest pinned, signed, NetworkPolicy present");
          break;
        case "approval":
          ln("", "input message: 'Promote to production?', submitter: 'release-approvers'");
          gate(detectHere(), "separation of duties");
          if (out.outcome === "passed") ln("ok", "  approved by a release approver other than the author");
          break;
        case "deploy":
          ln("", "ci/bump-image.sh production payments-api@sha256:<DIGEST>  (credential: config-repo-deploy-key)");
          ln("", "Argo CD: sync payments-api-prod  \u2192  Synced, Healthy");
          ln("ok", "  rollout complete: 6/6 pods ready");
          S.run.deployed = true;
          break;
        case "runtime":
          ln("", "Agentless scan + runtime sensor: refreshing Security Graph");
          var opened = 0;
          each(list, function (s) {
            if (!s.runtime) {
              if (!S.run.caught[s.id]) addFinding(s, "escaped", "escaped");
              return;
            }
            if (findStatus(s.id) === "blocked") return;
            addFinding(s, "runtime", "open", s.runtime.sev, s.runtime.title);
            opened++;
            ln(SEV_RANK[s.runtime.sev] >= 3 ? "err" : "warn", "  ISSUE " + s.runtime.sev + ": " + s.runtime.title);
          });
          if (!opened) ln("ok", "  no new issues on this workload");
          var bad = find(S.run.findings, function (f) { return f.stage === "runtime" && SEV_RANK[f.sev] >= 3; });
          if (bad) {
            out.outcome = "warn";
            out.culprits = [];
            each(S.run.findings, function (f) { if (f.stage === "runtime" && SEV_RANK[f.sev] >= 3 && f.s.fixable) out.culprits.push(f.s); });
          }
          break;
      }
      return out;
    }

    function findStatus(id) {
      var f = find(S.run.findings, function (x) { return x.id === id && (x.status === "blocked" || x.status === "warned"); });
      return f ? f.status : null;
    }

    function onRun() {
      if (S.run && S.run.paused && !S.run.done) { S.run.paused = false; setButtons(); tick(); return; }
      if (S.run && !S.run.done) return;
      newRun();
      setButtons();
      startStage();
    }
    function onPause() {
      if (!S.run || S.run.done) return;
      S.run.paused = true;
      if (timer) clearTimeout(timer);
      timer = null;
      setButtons();
    }
    function onReset() {
      destroy();
      var keep = S.speed;
      S = defaults();
      S.speed = keep;
      each(SCENARIOS, function (s) { ui.scenarioBoxes[s.id].checked = false; });
      each(TOOLS, function (t) { ui.toolBoxes[t.id].checked = true; });
      ui.covRange.value = String(S.coverageMin); ui.covVal.textContent = S.coverageMin + "%";
      ui.modeSel.querySelector("select").value = S.mode;
      ui.snykSel.querySelector("select").value = S.snykThr;
      ui.wizSel.querySelector("select").value = S.wizThr;
      clear(ui.log);
      ui.logStage.textContent = "No run yet";
      setButtons();
      paintAll();
    }

    function setButtons() {
      var r = S.run;
      var running = r && !r.done && !r.paused;
      ui.runBtn.textContent = r && r.paused && !r.done ? "Resume" : "Run pipeline";
      ui.runBtn.disabled = !!running;
      ui.pauseBtn.disabled = !running;
      ui.status.textContent = !r ? "Idle" : r.done ? (r.failed ? "Failed at " + r.failed.stageName : r.risky ? "Deployed with risk" : "Passed") : r.paused ? "Paused" : "Running: " + STAGES[r.idx].name;
      ui.status.className = "sim-status" + (r && r.done ? (r.failed ? " is-failed" : r.risky ? " is-warn" : " is-passed") : "");
    }

    function startStage() {
      var r = S.run;
      var st = STAGES[r.idx];
      r.stage[st.id] = "running";
      r.current = evaluate(st);
      r.lines = [["head", "\u25b6 " + st.name]].concat(r.current.lines);
      r.lineIdx = 0;
      ui.logStage.textContent = "\u00b7 " + st.name;
      paintLane();
      setButtons();
      tick();
    }

    function tick() {
      timer = null;
      if (!alive()) { destroy(); return; }
      var r = S.run;
      if (!r || r.paused || r.done) return;
      if (r.lineIdx < r.lines.length) {
        var l = r.lines[r.lineIdx++];
        ui.log.appendChild(h("span", { class: "sim-l" + (l[0] ? " sim-l-" + l[0] : "") }, l[1] + "\n"));
        ui.log.scrollTop = ui.log.scrollHeight;
        timer = setTimeout(tick, Math.round(170 / S.speed));
        return;
      }
      finishStage();
    }

    function finishStage() {
      var r = S.run;
      var st = STAGES[r.idx];
      var res = r.current;
      r.stage[st.id] = res.outcome;
      if (res.outcome !== "skipped") { r.simSec += st.dur; r.evidence[st.id] = true; }
      if (res.outcome === "failed") {
        r.failed = { stageId: st.id, stageName: st.name, culprits: res.culprits };
        return endRun();
      }
      if (st.id === "runtime" && res.outcome === "warn") r.risky = res.culprits;
      r.idx++;
      paintLane();
      paintDash();
      if (r.idx >= STAGES.length) return endRun();
      timer = setTimeout(startStage, Math.round(240 / S.speed));
    }

    function endRun() {
      var r = S.run;
      r.done = true;
      for (var i = 0; i < STAGES.length; i++) {
        var id = STAGES[i].id;
        if (!r.stage[id]) r.stage[id] = isSkipped(id) ? "skipped" : "notrun";
      }
      S.simClock += r.simSec;
      var openHigh = 0;
      each(r.findings, function (f) { if (f.stage === "runtime" && SEV_RANK[f.sev] >= 3 && !isAccepted(f.id)) openHigh++; });
      var clean = !r.failed && !r.risky;
      if (!clean && S.failingSince == null) S.failingSince = S.simClock - r.simSec;
      if (clean && S.failingSince != null) { S.mttrSamples.push(S.simClock - S.failingSince); S.failingSince = null; }
      S.runs.push({ no: r.no, failed: !!r.failed, deployed: r.deployed, risky: !!r.risky, dur: r.simSec, openHigh: openHigh, findings: r.findings.length });
      paintAll();
      setButtons();
    }

    function applyFix() {
      var r = S.run;
      if (!r || !r.done) return;
      var targets = r.failed ? r.failed.culprits : (r.risky || []);
      each(targets, function (s) {
        if (s.id === "coverage") S.coverage = Math.max(S.coverage, S.coverageMin);
        else if (s.id === "unsigned") { S.tools.sign = true; ui.toolBoxes.sign.checked = true; }
        else if (s.baseline) S.baselineFixed[s.id] = true;
        else { S.active[s.id] = false; if (ui.scenarioBoxes[s.id]) ui.scenarioBoxes[s.id].checked = false; }
      });
      S.simClock += 25 * 60;
      S.day += 1;
      newRun();
      setButtons();
      startStage();
    }

    /* ---------- panels ---------- */
    function paintAll() { paintLane(); paintResult(); paintDash(); paintTriage(); paintEvidence(); paintMetrics(); }

    function paintResult() {
      clear(ui.result);
      var r = S.run;
      if (!r) {
        ui.result.appendChild(h("p", { class: "sim-muted" }, "Pick scenarios below (or none for a clean run) and press Run pipeline."));
        return;
      }
      if (!r.done) { ui.result.appendChild(h("p", { class: "sim-muted" }, "Run in progress\u2026")); return; }
      var list = r.failed ? r.failed.culprits : r.risky;
      var verdict = r.failed ? "FAILED at " + r.failed.stageName : r.risky ? "DEPLOYED, but Wiz raised High or Critical issues" : "PASSED: deployed clean";
      ui.result.appendChild(h("div", { class: "sim-verdict " + (r.failed ? "is-failed" : r.risky ? "is-warn" : "is-passed") }, verdict));
      if (list && list.length) {
        var ul = h("ul", { class: "sim-reasons" });
        each(list, function (s) {
          ul.appendChild(h("li", {}, h("b", {}, s.title), h("span", { class: "sim-hint" }, "Remediation: " + s.hint)));
        });
        ui.result.appendChild(ul);
        ui.result.appendChild(h("button", { type: "button", class: "w-btn primary", onclick: applyFix }, "Apply fix & re-run"));
      } else {
        var warned = 0;
        each(r.findings, function (f) { if (f.status === "warned") warned++; });
        ui.result.appendChild(h("p", { class: "sim-muted" }, warned ? warned + " finding(s) were only warned in audit mode; check the triage queue." : "Every enabled gate passed. Inject a scenario to see a gate fire."));
      }
    }

    function isAccepted(id) { return S.accepted[id] != null && S.accepted[id] >= S.day; }

    function openFindings() {
      var r = S.run;
      if (!r) return [];
      var out = [];
      each(r.findings, function (f) { if (f.stage === "runtime") out.push(f); });
      return out;
    }

    function paintDash() {
      clear(ui.dash);
      if (!S.tools.runtime) {
        ui.dash.appendChild(h("p", { class: "sim-muted" }, "Wiz runtime is disabled: no cloud visibility. Anything that escapes CI is invisible."));
        return;
      }
      var open = openFindings();
      var counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      each(open, function (f) { if (!isAccepted(f.id)) counts[f.sev]++; });
      var sevBox = h("div", { class: "sim-sevs" });
      each(["Critical", "High", "Medium", "Low"], function (k) {
        sevBox.appendChild(h("div", { class: "sim-sevcard sev-" + k.toLowerCase() }, h("b", {}, String(counts[k])), h("span", {}, k)));
      });

      var deployed = S.run && S.run.deployed;
      var has = function (id) { return !!find(open, function (f) { return f.id === id; }); };
      var vulnPod = has("log4j") || has("imgcve") || has("toxic");
      var adminRole = has("toxic");
      var pii = has("toxic") || has("bucket");
      var path = [
        ["Internet", deployed],
        ["Ingress", deployed],
        ["pod payments-api" + (vulnPod ? " (CVE)" : ""), deployed && vulnPod],
        ["role payments-app" + (adminRole ? " (admin)" : ""), adminRole],
        ["bucket customer-pii", pii]
      ];
      var pathEl = h("div", { class: "sim-path" });
      each(path, function (p, i) {
        pathEl.appendChild(h("span", { class: "sim-node" + (p[1] ? " lit" : "") }, p[0]));
        if (i < path.length - 1) pathEl.appendChild(h("span", { class: "sim-arrow" + (path[i + 1][1] && p[1] ? " lit" : "") }, "\u2192"));
      });
      var complete = deployed && vulnPod && adminRole && pii;

      var penalty = 0;
      var weights = { Critical: 12, High: 7, Medium: 3, Low: 1 };
      each(open, function (f) { if (!isAccepted(f.id)) penalty += weights[f.sev]; });
      var score = Math.max(0, 100 - penalty);

      var trend = h("div", { class: "sim-trend", "aria-label": "Open critical and high issues per run" });
      var last = S.runs.slice(-12);
      var max = 1;
      each(last, function (x) { if (x.openHigh > max) max = x.openHigh; });
      if (!last.length) trend.appendChild(h("span", { class: "sim-muted" }, "Trend appears after the first run."));
      each(last, function (x) {
        trend.appendChild(h("div", { class: "sim-bar-wrap", title: "Run " + x.no + ": " + x.openHigh + " open high/critical" },
          h("div", { class: "sim-bar" + (x.failed ? " is-failed" : ""), style: "height:" + Math.max(6, Math.round(x.openHigh / max * 100)) + "%" }),
          h("small", {}, "#" + x.no)));
      });

      var k8s = [];
      each(open, function (f) { if (/^(root|privpod|latest|netpol|untrusted|imgcve|layersecret)$/.test(f.id)) k8s.push(f); });
      var blockedK8s = S.run ? S.run.findings.filter(function (f) { return f.stage === "k8spolicy" && f.status !== "allowed"; }) : [];
      var imgFindings = S.run ? S.run.findings.filter(function (f) { return f.stage === "imgscan"; }) : [];
      var ctr = h("ul", { class: "sim-ctr" },
        h("li", {}, h("b", {}, String(imgFindings.length)), " image scan findings this run"),
        h("li", {}, h("b", {}, String(blockedK8s.length)), " admission decisions (blocked or warned)"),
        h("li", {}, h("b", {}, String(k8s.length)), " container or Kubernetes issues open at runtime"));

      ui.dash.appendChild(h("div", { class: "sim-dash-grid" },
        h("div", {}, h("h3", { class: "sim-h3" }, "Open issues by severity"), sevBox,
          h("h3", { class: "sim-h3" }, "Containers & Kubernetes"), ctr),
        h("div", {}, h("h3", { class: "sim-h3" }, "Attack path"), pathEl,
          h("p", { class: "sim-small" + (complete ? " sim-alert" : "") }, complete ? "Toxic combination: complete path from the internet to PII." : deployed ? "No complete path to sensitive data." : "Not deployed in this run."),
          h("h3", { class: "sim-h3" }, "Compliance score"),
          h("div", { class: "sim-score" }, h("b", {}, score + "%"), h("span", { class: "sim-meter" }, h("i", { style: "width:" + score + "%" })))),
        h("div", {}, h("h3", { class: "sim-h3" }, "Trend over runs"), trend)));
    }

    function slaDue(f) {
      var days = f.s.kev ? 7 : SLA_DAYS[f.sev];
      return "day " + (S.day + days) + " (" + days + "d)";
    }

    function paintTriage() {
      clear(ui.triage);
      var r = S.run;
      if (!r || !r.findings.length) {
        ui.triage.appendChild(h("p", { class: "sim-muted" }, "Findings from the last run appear here with CVSS, EPSS, known-exploited status, reachability and fix-by SLA."));
        return;
      }
      var table = h("table", { class: "data sim-table" });
      table.appendChild(h("thead", {}, h("tr", {},
        h("th", {}, "Finding"), h("th", {}, "Source"), h("th", {}, "Sev"), h("th", {}, "CVSS"), h("th", {}, "EPSS"),
        h("th", {}, "KEV"), h("th", {}, "Reachable"), h("th", {}, "SLA due"), h("th", {}, "Status"), h("th", {}, "Decide"))));
      var tb = h("tbody");
      var rows = r.findings.slice().sort(function (a, b) { return SEV_RANK[b.sev] - SEV_RANK[a.sev]; });
      each(rows, function (f) {
        var s = f.s;
        var status, actions = h("span", { class: "sim-muted" }, "\u2014");
        if (f.status === "open") {
          if (isAccepted(f.id)) status = "risk accepted until day " + S.accepted[f.id];
          else if (S.accepted[f.id] != null) status = "acceptance expired: open";
          else status = "open";
          if (S.jira[f.id]) status += " \u00b7 " + S.jira[f.id];
          actions = h("span", { class: "sim-actions" });
          if (!isAccepted(f.id)) actions.appendChild(h("button", { type: "button", class: "w-btn ghost sim-mini", onclick: function () { S.accepted[f.id] = S.day + 30; paintTriage(); paintDash(); } }, "Accept 30d"));
          if (!S.jira[f.id]) actions.appendChild(h("button", { type: "button", class: "w-btn ghost sim-mini", onclick: function () { S.jiraSeq++; S.jira[f.id] = "SEC-" + S.jiraSeq + " opened"; paintTriage(); } }, "Open Jira"));
        } else if (f.status === "blocked") status = "blocked in CI (" + stageName(f.stage) + ")";
        else if (f.status === "warned") status = "warned only (audit mode)";
        else if (f.status === "allowed") status = "allowed by policy";
        else status = "escaped: no runtime signal";
        tb.appendChild(h("tr", {},
          h("td", {}, f.title, h("small", { class: "sim-res" }, s.resource)),
          h("td", {}, s.tool),
          h("td", {}, h("span", { class: "sim-sev sev-" + f.sev.toLowerCase() }, f.sev)),
          h("td", {}, s.cvss != null ? s.cvss.toFixed(1) : "\u2014"),
          h("td", {}, s.epss != null ? Math.round(s.epss * 100) + "%" : "\u2014"),
          h("td", {}, s.kev ? "yes" : s.cvss != null ? "no" : "\u2014"),
          h("td", {}, s.reach != null ? (s.reach ? "yes" : "no") : "\u2014"),
          h("td", {}, f.status === "open" ? slaDue(f) : "\u2014"),
          h("td", {}, status),
          h("td", {}, actions)));
      });
      table.appendChild(tb);
      ui.triage.appendChild(h("div", { class: "table-wrap" }, table));
      ui.triage.appendChild(h("p", { class: "sim-small" }, "SLA: Critical or known-exploited 7 days, High 30, Medium 90, Low 180. Accepted risk expires automatically; re-run after the expiry day and the issue reopens."));
    }

    function stageName(id) { var i = stageIndex(id); return i >= 0 ? STAGES[i].name : id; }

    function paintEvidence() {
      clear(ui.evidence);
      var r = S.run;
      var ul = h("ul", { class: "sim-ev" });
      each(EVIDENCE, function (e) {
        var st = STAGES[stageIndex(e.stage)];
        var toolOff = (e.tool && !S.tools[e.tool]) || (st.tool && !S.tools[st.tool]);
        var state, cls;
        if (!r || !r.done) { state = "awaiting run"; cls = "pending"; }
        else if (toolOff) { state = "gap: control disabled"; cls = "gap"; }
        else if (r.evidence[e.stage]) { state = "evidence recorded"; cls = "ok"; }
        else { state = "not reached"; cls = "pending"; }
        ul.appendChild(h("li", { class: "is-" + cls }, h("span", { class: "sim-dot" }), h("span", {}, e.label, h("small", {}, e.fw)), h("b", {}, state)));
      });
      ui.evidence.appendChild(ul);
    }

    function paintMetrics() {
      clear(ui.metrics);
      var r = S.run;
      var runs = S.runs;
      var deploys = runs.filter(function (x) { return x.deployed; });
      var failedChanges = deploys.filter(function (x) { return x.risky; });
      var lead = deploys.length ? deploys.reduce(function (a, x) { return a + x.dur; }, 0) / deploys.length : null;
      var mttr = S.mttrSamples.length ? S.mttrSamples.reduce(function (a, x) { return a + x; }, 0) / S.mttrSamples.length : null;
      var gates = { passed: 0, failed: 0, warn: 0, skipped: 0 };
      var byTool = {};
      if (r && r.done) {
        each(STAGES, function (st) { var v = r.stage[st.id]; if (gates[v] != null) gates[v]++; });
        each(r.findings, function (f) { byTool[f.s.tool] = (byTool[f.s.tool] || 0) + 1; });
      }
      var dl = h("div", { class: "w-readout sim-readout" },
        ro("last run", r && r.done ? fmtMin(r.simSec) : "\u2014"),
        ro("stages passed", gates.passed), ro("failed", gates.failed), ro("warned", gates.warn), ro("skipped", gates.skipped));
      var tools = h("div", { class: "w-readout sim-readout" });
      var keys = Object.keys(byTool);
      if (!keys.length) tools.appendChild(ro("findings by tool", "none yet"));
      each(keys, function (k) { tools.appendChild(ro(k, byTool[k])); });
      var dora = h("div", { class: "w-readout sim-readout" },
        ro("deployments", deploys.length + " of " + runs.length + " runs"),
        ro("lead time", fmtMin(lead)),
        ro("change failure rate", deploys.length ? Math.round(failedChanges.length / deploys.length * 100) + "%" : "\u2014"),
        ro("MTTR", fmtMin(mttr)));
      ui.metrics.appendChild(h("h3", { class: "sim-h3" }, "Gates"));
      ui.metrics.appendChild(dl);
      ui.metrics.appendChild(h("h3", { class: "sim-h3" }, "Findings by tool (last run)"));
      ui.metrics.appendChild(tools);
      ui.metrics.appendChild(h("h3", { class: "sim-h3" }, "Simulated DORA"));
      ui.metrics.appendChild(dora);
      ui.metrics.appendChild(h("p", { class: "sim-small" }, "Simulated clock: stage durations plus 25 minutes per applied fix. A change fails when it deploys with High or Critical runtime issues."));
    }
    function ro(k, v) { return h("span", { class: "ro" }, k + " ", h("b", {}, String(v))); }

    paintAll();
    setButtons();
    return { destroy: destroy };
  }

  window.ForgeSimulator = { mount: mount };
})();
