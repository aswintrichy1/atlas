/* =====================================================================
   FORGE · Capstone
   window.TRACKS.ops — module: capstone

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
     1. opsDora — "Where does this team sit on the four keys?"
     Each metric maps to a tier 3..0; the overall tier is the weakest.
  ================================================================== */
  var DORA_TIERS = ["Low", "Medium", "High", "Elite"];
  var DORA = [
    { id: "df", name: "Deployment frequency", opts: [[3, "On demand"], [2, "Weekly"], [1, "Monthly"], [0, "Every few months"]] },
    { id: "lt", name: "Lead time for changes", opts: [[3, "Under a day"], [2, "Under a week"], [1, "Under a month"], [0, "Months"]] },
    { id: "cfr", name: "Change failure rate", opts: [[3, "Under 5%"], [2, "5–15%"], [1, "16–30%"], [0, "Over 30%"]] },
    { id: "mttr", name: "Time to restore", opts: [[3, "Under an hour"], [2, "Under a day"], [1, "Under a week"], [0, "Longer"]] }
  ];

  Widgets.opsDora = function (mount) {
    shell(mount, "metrics", "Four keys, plus security",
      "Place a team on each delivery metric. The overall tier is set by the weakest metric, because speed without stability (or the reverse) is not high performance. The security readouts show the paired metrics to report alongside.");
    var val = { df: 2, lt: 2, cfr: 2, mttr: 2 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" });

    function paint() {
      var min = 3, sum = 0, i;
      clear(stage);
      for (i = 0; i < DORA.length; i++) {
        var v = val[DORA[i].id];
        if (v < min) min = v;
        sum += v;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:170px 1fr 60px;gap:10px;align-items:center;padding:4px 0" },
          h("span", { style: "font-size:0.84rem" }, DORA[i].name),
          h("span", { style: "display:block;height:10px;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + Math.round((v + 1) / 4 * 100) + "%;background:" + (v === 3 ? "var(--lime)" : v === 2 ? "var(--cyan)" : v === 1 ? "var(--accent)" : "var(--rose)") })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, DORA_TIERS[v])));
      }
      var vulnMttr = min >= 3 ? "2 days" : min === 2 ? "9 days" : min === 1 ? "30 days" : "90+ days";
      var gateTime = min >= 2 ? "under 10 min" : "30+ min";
      clear(readout);
      readout.appendChild(ro("overall tier", DORA_TIERS[min]));
      readout.appendChild(ro("balance", sum - min * 4 === 0 ? "even" : "uneven: fix the weakest key"));
      readout.appendChild(ro("typical critical-vuln MTTR", vulnMttr));
      readout.appendChild(ro("security gate time", gateTime));
    }

    for (var d = 0; d < DORA.length; d++) {
      (function (m) {
        controls.appendChild(segment(m.opts, 3 - val[m.id], function (v) { val[m.id] = v; paint(); }));
      })(DORA[d]);
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "prog-feedback": {
      title: "Monitoring, SIEM & metrics checkpoint",
      sub: "Observability, incident response, DORA and security metrics.",
      questions: [
        {
          q: "Which pairing is correct?",
          options: ["Prometheus stores logs, Grafana stores metrics", "Prometheus scrapes and stores time-series metrics; Grafana visualizes metrics, logs and traces from many sources", "Grafana replaces the SIEM", "Prometheus is a ticketing tool"],
          answer: 1,
          explain: "Prometheus is a pull-based metrics database with alerting rules. Grafana is a visualization layer over Prometheus, log stores and tracing backends."
        },
        {
          q: "What distinguishes a SIEM from a log platform such as ELK used for debugging?",
          options: ["Nothing", "A SIEM normalizes security events from many sources, correlates them with detection rules and threat intel, and drives SOC investigation and response", "A SIEM only stores metrics", "ELK cannot store logs"],
          answer: 1,
          explain: "Many SIEMs are built on log platforms, but the value is in correlation, detection content, retention for investigations and case management."
        },
        {
          q: "Which of these is one of the four DORA metrics?",
          options: ["Lines of code per day", "Change failure rate", "Number of microservices", "Story points delivered"],
          answer: 1,
          explain: "The four keys are deployment frequency, lead time for changes, change failure rate and time to restore service. They balance throughput with stability."
        },
        {
          q: "In incident response, what comes immediately after detecting and analysing a confirmed cloud credential compromise?",
          options: ["Write the post-mortem", "Containment: revoke the credential and its active sessions, isolate affected workloads", "Wait for more evidence for a week", "Delete all logs"],
          answer: 1,
          explain: "The usual phases are prepare, detect and analyse, contain, eradicate, recover, then learn. Containment limits damage first; eradication and recovery follow, and lessons feed back into the pipeline."
        },
        {
          q: "Which security metric best complements DORA for a DevSecOps program?",
          options: ["Number of scanner licences", "Mean time to remediate critical vulnerabilities and the percentage of builds blocked by gates", "Number of meetings", "Total findings ever found"],
          answer: 1,
          explain: "MTTR for criticals shows how fast risk is removed; gate block rate and false-positive rate show whether gates are effective and trusted."
        }
      ]
    },
    "ops-capstone": {
      title: "Capstone checkpoint",
      sub: "The reference pipeline, the full Jenkinsfile and rolling it out.",
      questions: [
        {
          q: "In the reference pipeline, why does the Wiz image scan run before the push to the registry?",
          options: ["It is faster", "So a policy-violating image never lands in a registry where it could be deployed", "Wiz cannot scan registries", "Pushing requires a scan"],
          answer: 1,
          explain: "Gating before publish keeps the registry clean. Registry scanning still matters for newly published CVEs against images already pushed."
        },
        {
          q: "Which stage provides tamper-evidence for the deployed artifact?",
          options: ["Unit tests", "SBOM generation and signing the image digest, verified at admission", "Lint", "DAST"],
          answer: 1,
          explain: "Signing binds the digest to the pipeline's identity; the admission controller verifies the signature before running it, so a swapped image is rejected."
        },
        {
          q: "How should a new blocking gate be introduced to 200 existing repositories?",
          options: ["Enable block mode everywhere on day one", "Start in audit mode, measure, fix or except legacy findings, move to warn, then block on new code", "Let each team decide whether to have security gates", "Email a policy PDF"],
          answer: 1,
          explain: "Progressive enforcement avoids mass pipeline failures that get gates disabled. Gating on new code lets legacy debt be handled through campaigns."
        },
        {
          q: "Where should the production promotion approval come from?",
          options: ["Whoever is online", "A protected input or environment approval restricted to an authorized group, recorded with the build", "A comment in Slack", "The developer who wrote the change, alone"],
          answer: 1,
          explain: "A recorded approval by an authorized person other than the author enforces separation of duties and creates audit evidence. In GitOps it is the review on the config-repo PR."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ops = {
    id: "ops",
    name: "Capstone",
    short: "OPS",
    tagline: "Build and roll out the whole secure delivery system",
    color: "#34d399",
    blurb: "Put every Forge track together: a reference DevSecOps pipeline, a complete Jenkinsfile using only credential-store references, and a practical playbook for rolling it out progressively across an organization.",
    modules: [
      {
        id: "capstone",
        name: "Capstone",
        icon: "map",
        lessons: [
          {
            id: "reference-pipeline",
            title: "The reference DevSecOps pipeline",
            summary: "Every gate from commit to runtime in one picture, with what each stage blocks.",
            minutes: 11,
            tags: ["advanced", "capstone", "reference-architecture", "pipeline"],
            blocks: [
              { t: "p", html: "This is the pipeline the whole atlas has been building toward. Each stage has a single job, a tool, a gate condition and an owner for the policy." },
              { t: "diagram", id: "reference-pipeline", caption: "Commit to runtime: fast checks first, expensive checks later, enforcement at admission, detection in production." },
              { t: "table", headers: ["Stage", "Tool examples", "Blocks when", "Policy owner"], rows: [
                ["Pre-commit", "gitleaks hook, formatters", "Secret or private key staged", "AppSec"],
                ["PR checks", "Branch protection, CODEOWNERS, Wiz Code PR scan", "Missing review, failing checks", "Platform"],
                ["Secret scan", "gitleaks / TruffleHog", "Any verified secret", "AppSec"],
                ["Build and unit test", "Maven / Gradle / npm", "Compile or test failure", "Team"],
                ["SAST and quality", "SonarQube + waitForQualityGate", "Quality gate failed on new code", "AppSec + Team"],
                ["SCA", "Snyk / Trivy", "High+ with fix available", "AppSec"],
                ["IaC and image scan", "wizcli iac / dir / docker scan", "Blocking Wiz CI/CD policy violated", "Cloud security"],
                ["SBOM and sign", "Syft, cosign", "Signing fails", "Platform"],
                ["Publish", "Artifactory / Harbor / ECR, immutable tags", "Push or promotion rule fails", "Platform"],
                ["Deploy to staging", "Helm via Argo CD", "Sync or health check fails", "Team"],
                ["DAST", "ZAP baseline", "High alert", "AppSec"],
                ["Promote to production", "Approval + GitOps PR", "No authorized approval", "Change owner"],
                ["Admission", "Wiz admission controller, Kyverno", "Unscanned, unsigned or non-compliant", "Cloud security"],
                ["Runtime", "Wiz sensor and Defend, SIEM", "(detects, does not block the build)", "SOC"]
              ] },
              { t: "h", text: "Design principles" },
              { t: "ul", items: [
                "Fast and cheap first: secret scan and lint fail in seconds, before expensive builds.",
                "Parallelize independent scanners to keep total gate time under about ten minutes.",
                "Build once, scan once, sign once, promote the same digest.",
                "Every gate's policy is versioned and owned centrally; exceptions are in code with expiry.",
                "Enforcement is layered: CI blocks, admission backstops, runtime detects."
              ] },
              { t: "note", variant: "tip", html: "Watch this pipeline run, fail and recover in the <a href='#/simulator'>DevSecOps simulator</a>: inject a hardcoded secret, a critical CVE or a toxic combination and apply the fix." },
              { t: "note", variant: "key", html: "<strong>Cheap checks first, one artifact throughout, layered enforcement at the end.</strong> That ordering keeps feedback fast and guarantees production only runs what passed every gate." }
            ]
          },
          {
            id: "full-jenkinsfile",
            title: "The complete Jenkinsfile",
            summary: "A full declarative pipeline for the reference flow, using only credential-store references.",
            minutes: 14,
            tags: ["practitioner", "capstone", "jenkinsfile", "credentials"],
            blocks: [
              { t: "p", html: "Every credential below is a <strong>Jenkins credential id</strong> resolved at runtime by <code class='tok'>withCredentials</code> or the scanner plugin. Values in angle brackets such as <code class='tok'>&lt;WIZ_VULN_POLICY&gt;</code> are names you set for your organization; none of them is a secret." },
              { t: "code", lang: "groovy", code:
                "// Jenkinsfile — reference DevSecOps pipeline (illustrative; adapt names to your org)\n" +
                "pipeline {\n" +
                "  agent { kubernetes { inheritFrom 'build-pod' } }       // ephemeral pod per build\n" +
                "  options {\n" +
                "    timestamps(); timeout(time: 45, unit: 'MINUTES')\n" +
                "    buildDiscarder(logRotator(numToKeepStr: '50')); disableConcurrentBuilds()\n" +
                "  }\n" +
                "  environment {\n" +
                "    APP      = 'payments-api'\n" +
                "    REGISTRY = 'registry.internal.example'\n" +
                "    IMAGE    = \"registry.internal.example/payments/payments-api:${env.GIT_COMMIT.take(12)}\"\n" +
                "  }\n" +
                "  stages {\n" +
                "    stage('Checkout') { steps { checkout scm } }\n\n" +
                "    stage('Secret scan') {\n" +
                "      steps { sh 'gitleaks detect --source . --redact --exit-code 1' }\n" +
                "    }\n\n" +
                "    stage('Build & unit test') {\n" +
                "      steps { sh './mvnw -B -ntp clean verify' }\n" +
                "      post  { always { junit 'target/surefire-reports/*.xml' } }\n" +
                "    }\n\n" +
                "    stage('SonarQube') {\n" +
                "      steps {\n" +
                "        withSonarQubeEnv('sonar-main') {                   // token from the server config credential\n" +
                "          sh './mvnw -B -ntp sonar:sonar -Dsonar.projectKey=payments-api'\n" +
                "        }\n" +
                "        timeout(time: 10, unit: 'MINUTES') { waitForQualityGate abortPipeline: true }\n" +
                "      }\n" +
                "    }\n\n" +
                "    stage('SCA (Snyk)') {\n" +
                "      steps {\n" +
                "        withCredentials([string(credentialsId: 'snyk-api-token', variable: 'SNYK_TOKEN')]) {\n" +
                "          sh 'snyk test --all-projects --severity-threshold=high --fail-on=upgradable'\n" +
                "        }\n" +
                "      }\n" +
                "    }\n\n" +
                "    stage('Build image') {\n" +
                "      steps { sh 'docker build -t \"$IMAGE\" .' }\n" +
                "    }\n\n" +
                "    stage('Wiz CLI') {\n" +
                "      steps {\n" +
                "        withCredentials([usernamePassword(credentialsId: 'wiz-service-account',\n" +
                "                                          usernameVariable: 'WIZ_CLIENT_ID',\n" +
                "                                          passwordVariable: 'WIZ_CLIENT_SECRET')]) {\n" +
                "          sh '''\n" +
                "            set +x\n" +
                "            wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\"\n" +
                "            wizcli iac scan    --path infra/ --policy \"<WIZ_IAC_POLICY>\"\n" +
                "            wizcli dir scan    --path .      --policy \"<WIZ_VULN_POLICY>\"\n" +
                "            wizcli docker scan --image \"$IMAGE\" --dockerfile Dockerfile --policy \"<WIZ_VULN_POLICY>\"\n" +
                "          '''\n" +
                "        }\n" +
                "      }\n" +
                "    }\n\n" +
                "    stage('Push, SBOM & sign') {\n" +
                "      when { branch 'main' }\n" +
                "      steps {\n" +
                "        withCredentials([usernamePassword(credentialsId: 'registry-push',\n" +
                "                                          usernameVariable: 'REG_USER', passwordVariable: 'REG_TOKEN'),\n" +
                "                         file(credentialsId: 'cosign-private-key', variable: 'COSIGN_KEY'),\n" +
                "                         string(credentialsId: 'cosign-key-password', variable: 'COSIGN_PASSWORD')]) {\n" +
                "          sh '''\n" +
                "            set +x\n" +
                "            echo \"$REG_TOKEN\" | docker login \"$REGISTRY\" -u \"$REG_USER\" --password-stdin\n" +
                "            docker push \"$IMAGE\"\n" +
                "            DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' \"$IMAGE\")\n" +
                "            syft \"$DIGEST\" -o cyclonedx-json > sbom.cdx.json\n" +
                "            cosign sign --yes --key \"$COSIGN_KEY\" \"$DIGEST\"\n" +
                "            cosign attest --yes --key \"$COSIGN_KEY\" --type cyclonedx --predicate sbom.cdx.json \"$DIGEST\"\n" +
                "          '''\n" +
                "        }\n" +
                "        withCredentials([usernamePassword(credentialsId: 'wiz-service-account',\n" +
                "                                          usernameVariable: 'WIZ_CLIENT_ID', passwordVariable: 'WIZ_CLIENT_SECRET')]) {\n" +
                "          sh 'wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\" && wizcli docker tag --image \"$IMAGE\"'\n" +
                "        }\n" +
                "        archiveArtifacts artifacts: 'sbom.cdx.json'\n" +
                "      }\n" +
                "    }\n\n" +
                "    stage('Deploy to staging (GitOps)') {\n" +
                "      when { branch 'main' }\n" +
                "      steps {\n" +
                "        withCredentials([sshUserPrivateKey(credentialsId: 'config-repo-deploy-key', keyFileVariable: 'GIT_KEY')]) {\n" +
                "          sh './ci/bump-image.sh staging \"$IMAGE\"'      // commits the new digest to the config repo\n" +
                "        }\n" +
                "      }\n" +
                "    }\n\n" +
                "    stage('DAST (ZAP baseline)') {\n" +
                "      when { branch 'main' }\n" +
                "      steps { sh './ci/zap-baseline.sh https://staging.payments.example' }\n" +
                "    }\n\n" +
                "    stage('Promote to production') {\n" +
                "      when { branch 'main' }\n" +
                "      steps {\n" +
                "        input message: 'Promote this digest to production?', submitter: 'release-approvers'\n" +
                "        withCredentials([sshUserPrivateKey(credentialsId: 'config-repo-deploy-key', keyFileVariable: 'GIT_KEY')]) {\n" +
                "          sh './ci/bump-image.sh production \"$IMAGE\"'   // Argo CD syncs; admission verifies scan and signature\n" +
                "        }\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "  post {\n" +
                "    failure { echo 'A gate failed: the stage log names the tool and the policy that blocked' }\n" +
                "    cleanup { cleanWs() }\n" +
                "  }\n" +
                "}"
              },
              { t: "h", text: "Credential map" },
              { t: "table", headers: ["Credential id", "Kind", "Used by", "Scope"], rows: [
                ["sonar-main (server config)", "Secret text token", "withSonarQubeEnv", "Project analysis token"],
                ["snyk-api-token", "Secret text", "snyk test", "Service account, test-only"],
                ["wiz-service-account", "Username with password", "wizcli auth", "Create-scans permission only"],
                ["registry-push", "Username with password", "docker push", "Push to the team's repository only"],
                ["cosign-private-key / cosign-key-password", "Secret file / secret text", "cosign sign and attest", "Signing only; better: a KMS key or keyless signing"],
                ["config-repo-deploy-key", "SSH private key", "bump-image.sh", "Write to the config repo, branch-protected"]
              ] },
              { t: "note", variant: "warn", html: "The <code class='tok'>IMAGE</code> line uses Groovy interpolation of the commit hash, which is not secret. Everything bound by <code class='tok'>withCredentials</code> is used only inside single-quoted shell strings." },
              { t: "note", variant: "tip", html: "In practice, most of this file moves into a shared library step such as <code class='tok'>standardJavaPipeline</code>, and the service's Jenkinsfile shrinks to five lines of configuration." },
              { t: "note", variant: "key", html: "<strong>Ids, not secrets; single-quoted shells; one digest end to end.</strong> The pipeline scans, signs and promotes a single artifact, and no credential value ever appears in source." }
            ]
          },
          {
            id: "rollout-playbook",
            title: "Rolling DevSecOps out across an organization",
            summary: "A phased plan: visibility, guardrails, enforcement and continuous improvement.",
            minutes: 10,
            tags: ["practitioner", "capstone", "rollout", "program"],
            blocks: [
              { t: "p", html: "Tools are the easy part. A DevSecOps program succeeds when teams trust the gates, own their findings and can ship as fast as before. Roll it out in phases." },
              { t: "table", headers: ["Phase", "Weeks", "Goals", "Exit criteria"], rows: [
                ["1. See", "1–4", "Connect clouds to the CNAPP, scan all repos, inventory pipelines, define projects and owners", "Coverage above 90%; every account mapped to an owner"],
                ["2. Guide", "4–10", "Add scanners in audit mode, PR comments, IDE plugins, security champions per team", "Baseline false-positive rate measured; champions named"],
                ["3. Guard", "10–20", "Block on secrets and critical-with-fix; quality gate on new code; admission in audit", "Gate time under 10 minutes; exception process live"],
                ["4. Enforce", "20–30", "Wiz CI policies and admission to block for production; signed images required", "No unscanned image runs in production"],
                ["5. Improve", "Ongoing", "Campaigns for systemic fixes, metrics reviews, new detections from incidents", "Critical MTTR within SLA, trending down"]
              ] },
              { t: "h", text: "Exception process" },
              { t: "ol", items: [
                "Request in code (policy file or inline skip) with reason, owner and expiry date.",
                "Review by a security champion or AppSec, in the same PR.",
                "Automatic reminders before expiry; expired exceptions fail the gate again.",
                "Exceptions reported on the leadership board."
              ] },
              { t: "compare",
                bad: { title: "Programs that stall", items: ["Block everything on day one", "Security owns every finding", "Dashboards without owners", "Exceptions by email, forever"] },
                good: { title: "Programs that stick", items: ["Audit, warn, then block", "Teams own findings; security owns policy", "Projects map every resource to a team", "Exceptions in code with expiry"] } },
              { t: "quiz", id: "ops-capstone" },
              { t: "note", variant: "key", html: "<strong>See, guide, guard, enforce, improve.</strong> Visibility and trust come before blocking; ownership and expiring exceptions keep the program alive after launch." }
            ]
          }
        ]
      }
    ]
  };
})();
