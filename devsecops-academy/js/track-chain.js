/* =====================================================================
   FORGE · Pipeline Security & Supply Chain
   window.TRACKS.chain — modules: harden / identity / supply

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

  /* chainPpe — how exposed is this pipeline to poisoned pipeline execution? */
  Widgets.chainPpe = function (mount) {
    shell(mount, "threat", "Poisoned pipeline execution exposure",
      "Choose who can open pull requests, where the pipeline definition is read from for those PRs, and what the PR build can reach. The model names the attack that remains possible.");
    var source = "fork", def = "pr", secrets = "yes";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var risk, kind, text;
      if (def === "pr" && secrets === "yes") {
        risk = source === "fork" ? "Critical" : "High";
        kind = source === "fork" ? "Public PPE" : "Direct PPE";
        text = "The PR author controls the Jenkinsfile that runs with real credentials. One edited stage can print or send every bound secret.";
      } else if (def === "pr") {
        risk = "Medium"; kind = "Direct PPE (no secrets)";
        text = "Attacker-controlled steps still run on your agent: they can probe the network or poison caches, but no credentials are bound.";
      } else if (secrets === "yes") {
        risk = "Medium"; kind = "Indirect PPE";
        text = "The pipeline definition is trusted, but build scripts, Makefiles or test files from the PR still execute with secrets. Keep secrets out of PR builds.";
      } else {
        risk = "Low"; kind = "Contained";
        text = "Trusted definition, no secrets, ephemeral agent: the PR can only break its own build.";
      }
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.88rem;line-height:1.55;margin:0" }, text));
      clear(readout);
      readout.appendChild(ro("attack", kind));
      readout.appendChild(ro("risk", risk));
      readout.appendChild(ro("CI/CD risk", "poisoned pipeline execution"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["fork", "Anyone (fork PRs)"], ["internal", "Org members only"]], 0, function (v) { source = v; paint(); }),
      segment([["pr", "Jenkinsfile from PR branch"], ["trusted", "Jenkinsfile from main"]], 0, function (v) { def = v; paint(); }),
      segment([["yes", "Secrets bound in PR builds"], ["no", "No secrets in PR builds"]], 0, function (v) { secrets = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "chain-harden": {
      title: "Securing the pipeline checkpoint",
      sub: "OWASP CI/CD risks, poisoned pipelines, dependency abuse and Jenkins hardening.",
      questions: [
        { q: "An attacker opens a pull request that edits the Jenkinsfile so the build prints bound credentials. Which risk is this?", options: ["Insufficient logging", "Poisoned pipeline execution", "Typosquatting", "Improper artifact integrity validation"], answer: 1,
          explain: "Poisoned pipeline execution is running attacker-controlled pipeline logic with the pipeline's privileges. Editing the pipeline file directly is the direct variant." },
        { q: "Your build resolves an internal package name from the public registry because a higher version was published there. What is this called?", options: ["Dependency confusion", "Credential stuffing", "Drift", "Canary release"], answer: 0,
          explain: "Dependency confusion abuses resolver precedence. Route internal scopes only to the internal repository, reserve names publicly, and pin versions in lockfiles." },
        { q: "Which Jenkins setting most reduces the blast radius of a malicious build?", options: ["More executors on the controller", "Zero executors on the controller and ephemeral agents per build", "One shared admin credential", "Disabling CSRF protection"], answer: 1,
          explain: "Builds on the controller can read its home directory and credential store. Ephemeral agents keep each build isolated and disposable." },
        { q: "What does insufficient flow control mean in CI/CD?", options: ["The pipeline is too slow", "A single actor can push code or artifacts all the way to production without an independent check", "Too many stages", "Logs are too verbose"], answer: 1,
          explain: "Flow control means approvals, protected branches and gates that one identity cannot bypass alone." }
      ]
    },
    "chain-identity": {
      title: "Pipeline identity & secrets checkpoint",
      sub: "OIDC workload identity, least privilege, SPIFFE, end-to-end secrets and secret stores.",
      questions: [
        { q: "Why prefer OIDC federation from CI to the cloud over a stored access key?", options: ["It is faster to type", "Each job gets a short-lived token scoped to that repo and branch, so there is no long-lived key to leak", "Keys are not supported", "OIDC disables logging"], answer: 1,
          explain: "The cloud trusts a signed identity token from the CI provider and issues temporary credentials limited by claims such as repository and branch." },
        { q: "What does SPIFFE provide?", options: ["A container registry", "A standard for workload identities (SPIFFE IDs and short-lived SVID credentials), with SPIRE as a reference implementation", "A secrets scanner", "A Jenkins plugin"], answer: 1,
          explain: "SPIFFE gives every workload a verifiable identity it can use for mTLS or token exchange, without shared static secrets." },
        { q: "What should be the first secrets gate in a pipeline?", options: ["Runtime monitoring", "Secret scanning on commit and in CI (for example gitleaks)", "DAST", "Annual audit"], answer: 1,
          explain: "Scanning stops new secrets entering history. Stores, rotation and workload identity then remove the need for them." },
        { q: "How should Kubernetes workloads get secrets from Vault or a cloud secret manager?", options: ["Commit base64 Secrets to Git", "Through an operator such as External Secrets or a CSI driver, authenticated by the pod's service account identity", "Bake them into the image", "Email them to the team"], answer: 1,
          explain: "The workload authenticates with its own identity and the operator syncs or mounts the value; Git only holds a reference." },
        { q: "Why are dynamic secrets from Vault safer than static database passwords?", options: ["They are longer", "They are generated per consumer with a short lease and revoked automatically, so a leaked value expires quickly and is traceable", "They are stored in Git", "They never change"], answer: 1,
          explain: "Dynamic secrets limit both the window and the blast radius of a leak and give per-consumer audit. Static shared passwords live for years and are shared by everyone." }
      ]
    },
    "chain-supply": {
      title: "Supply chain integrity checkpoint",
      sub: "Attack points, SBOMs, Sigstore signing, SLSA levels, in-toto, provenance and VEX.",
      questions: [
        { q: "What is the main purpose of an SBOM in an incident like a newly disclosed critical library CVE?", options: ["It patches the library automatically", "It lets you answer 'where do we run this component and which version' in minutes instead of days", "It replaces vulnerability scanning", "It encrypts the artifact"], answer: 1,
          explain: "An SBOM is an inventory. When a CVE drops, querying stored SBOMs tells you every image and service containing the affected version, so triage starts immediately. It does not fix anything by itself." },
        { q: "In keyless signing with Sigstore, what does Fulcio do?", options: ["Stores container images", "Issues a short-lived certificate bound to an OIDC identity", "Scans for secrets", "Runs the build"], answer: 1,
          explain: "Fulcio is the certificate authority that binds a signing key to an identity from an OIDC provider for a few minutes. The signature is recorded in the Rekor transparency log, so there is no long-lived private key to steal." },
        { q: "At SLSA Build Level 2, what is required beyond Level 1?", options: ["Nothing; levels are cosmetic", "The build runs on a hosted platform that generates signed provenance", "Every developer must sign every commit with a hardware key", "The artifact must be open source"], answer: 1,
          explain: "Level 1 only requires provenance to exist. Level 2 requires a hosted build platform that produces signed, authenticated provenance, so a consumer can trust where and how the artifact was built. Level 3 hardens the platform itself." },
        { q: "What does Rekor add to cosign signing?", options: ["Image compression", "A public, append-only transparency log of signatures that anyone can audit", "A registry", "Vulnerability scanning"], answer: 1,
          explain: "Rekor records signing events so misuse of an identity is detectable and keyless signatures can be verified later." },
        { q: "What is a VEX document for?", options: ["Listing every package", "Stating whether a known vulnerability actually affects a product, such as not affected because the code is not present or not reachable", "Signing images", "Running tests"], answer: 1,
          explain: "The SBOM says what is inside; VEX says which listed CVEs matter. Together they cut noise for consumers." },
        { q: "Which SLSA property matters most for proving an artifact came from your reviewed source?", options: ["Image size", "Signed provenance generated by a hardened build platform the build itself cannot tamper with", "Number of tests", "Semantic versioning"], answer: 1,
          explain: "Higher SLSA build levels require provenance produced by the platform, not by user-controlled steps, so it cannot be forged by the build." },
        { q: "What does in-toto describe?", options: ["Kubernetes networking", "A layout of the expected supply chain steps and signed link metadata proving each step ran as specified", "A Docker base image", "A SIEM"], answer: 1,
          explain: "in-toto attestations are also the envelope format used for SLSA provenance and SBOM attestations." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.chain = {
    id: "chain",
    name: "Pipeline Security & Supply Chain",
    short: "CHAIN",
    tagline: "Secure the delivery system itself",
    color: "#fb7185",
    blurb: "The pipeline holds the keys to production, so it is a target. Learn the OWASP Top 10 CI/CD security risks, poisoned pipeline execution and dependency abuse, Jenkins hardening, OIDC workload identity, and Forge's single home for secrets management (scanning to Vault to rotation) and software supply-chain integrity (SBOMs, Sigstore signing, SLSA provenance, in-toto and VEX).",
    modules: [
      {
        id: "harden",
        name: "Securing the Pipeline",
        icon: "shield",
        lessons: [
          {
            id: "cicd-top10",
            title: "The OWASP Top 10 CI/CD security risks",
            summary: "Ten ways delivery systems get abused, and the control that answers each.",
            minutes: 12,
            tags: ["practitioner", "owasp", "cicd-risks", "pipeline-security"],
            blocks: [
              { t: "p", html: "Attackers increasingly skip the application and go after the <strong>pipeline</strong>: it can read source, holds deploy credentials and pushes straight to production. OWASP's CI/CD risk list names the ten recurring ways that happens." },
              { t: "diagram", id: "cicd-attack-surface", caption: "Every hop in the delivery chain is an attack surface: source, dependencies, build system, artifacts and deployment." },
              { t: "table", headers: ["Risk", "What goes wrong", "Primary control"], rows: [
                ["1. Insufficient flow control", "One identity can push code or artifacts to prod with no independent check", "Protected branches, required reviews, promotion approvals"],
                ["2. Inadequate identity and access management", "Stale accounts, shared logins, over-broad roles across SCM, CI and registries", "SSO everywhere, least privilege, regular access reviews"],
                ["3. Dependency chain abuse", "Dependency confusion, typosquatting, hijacked maintainer accounts", "Controlled proxy, scoped routing, lockfiles, allow-lists"],
                ["4. Poisoned pipeline execution", "Attacker-controlled pipeline logic runs with pipeline privileges", "Trusted pipeline definitions, no secrets in untrusted builds"],
                ["5. Insufficient pipeline-based access controls (PBAC)", "Every job can reach every secret, network and host", "Per-pipeline credentials, isolated agents, network segmentation"],
                ["6. Insufficient credential hygiene", "Long-lived secrets, secrets in logs or images, no rotation", "Credential store or vault, masking, OIDC, rotation"],
                ["7. Insecure system configuration", "Unpatched CI servers, default settings, builds on the controller", "Hardening baselines, patching, configuration as code"],
                ["8. Ungoverned use of third-party services", "SaaS apps and CI plugins granted broad repo or org access", "Inventory, least-privilege app permissions, plugin governance"],
                ["9. Improper artifact integrity validation", "Unsigned or swapped artifacts deployed", "Signing, provenance, digest pinning, admission verification"],
                ["10. Insufficient logging and visibility", "No audit trail of who changed pipelines, secrets or approvals", "Central audit logs into the SIEM, alerting on pipeline changes"]
              ] },
              { t: "note", variant: "tip", html: "Map your pipeline against this list once a quarter. Each row should name an owner and the evidence that the control is working." },
              { t: "note", variant: "key", html: "<strong>The pipeline is production infrastructure.</strong> Flow control, identity, dependencies, pipeline definitions, credentials, configuration, third parties, artifact integrity and logging all need owners and controls." }
            ]
          },
          {
            id: "ppe-deps",
            title: "Poisoned pipeline execution and dependency chain abuse",
            summary: "Direct, indirect and public PPE; dependency confusion and typosquatting; and the defenses.",
            minutes: 11,
            tags: ["practitioner", "ppe", "dependency-confusion", "typosquatting"],
            blocks: [
              { t: "h", text: "Poisoned pipeline execution (PPE)" },
              { t: "table", headers: ["Variant", "How the attacker gets code to run", "Defense"], rows: [
                ["Direct PPE", "Edits the pipeline file itself (Jenkinsfile, workflow YAML) in a branch or PR", "Load the definition from the protected branch for untrusted changes; CODEOWNERS on pipeline files"],
                ["Indirect PPE", "Leaves the pipeline file alone but edits files it runs: build scripts, Makefiles, test configs", "No secrets in PR builds; run untrusted code only on isolated, ephemeral agents"],
                ["Public PPE (3PE)", "Any outsider opens a PR from a fork on a public repo", "Require approval before running fork PRs; never expose secrets to fork builds"]
              ] },
              { t: "widget", id: "chainPpe" },
              { t: "h", text: "Dependency chain abuse" },
              { t: "ul", items: [
                "<strong>Dependency confusion</strong>: an internal package name is published publicly at a higher version and the resolver prefers it.",
                "<strong>Typosquatting</strong>: a malicious package with a near-identical name waits for a typo.",
                "<strong>Account takeover / protestware</strong>: a legitimate maintainer account is hijacked or a maintainer ships a harmful release.",
                "<strong>Install scripts</strong>: packages run code at install time, inside your build agent."
              ] },
              { t: "code", lang: "text", code:
                "# .npmrc — route the internal scope ONLY to the internal repository\n" +
                "@acme:registry=https://artifactory.internal.example/artifactory/api/npm/npm-internal/\n" +
                "registry=https://artifactory.internal.example/artifactory/api/npm/npm-virtual/\n" +
                "# CI: npm ci --ignore-scripts for packages that do not need install hooks"
              },
              { t: "note", variant: "trap", html: "A virtual repository that merges internal and public sources can still prefer the public version. Configure scope or namespace routing and exclusion patterns, not just ordering." },
              { t: "note", variant: "key", html: "<strong>Untrusted code must never run with trusted credentials.</strong> Trusted pipeline definitions, no secrets in PR builds, and scoped dependency routing close the two most common pipeline attacks." }
            ]
          },
          {
            id: "jenkins-hardening",
            title: "Jenkins hardening checklist",
            summary: "Controller versus agents, script approval, CSRF, plugin pinning, audit trails and ephemeral agents.",
            minutes: 10,
            tags: ["practitioner", "jenkins", "hardening", "plugins"],
            blocks: [
              { t: "table", headers: ["Area", "Hardened setting", "Why"], rows: [
                ["Controller", "Zero executors; no builds on the built-in node", "The controller holds credentials and their encryption keys"],
                ["Agents", "Ephemeral Kubernetes pod or cloud agents per build; agent-to-controller access control on", "Builds cannot persist, cross-read workspaces or attack the controller"],
                ["Authentication", "SSO with MFA; no local admin accounts in daily use", "Joiners and leavers handled centrally"],
                ["Authorization", "Role-based or matrix authorization scoped by folder", "Teams see only their jobs and credentials"],
                ["Script security", "Groovy sandbox on; script approvals reviewed, not rubber-stamped", "Approved signatures run unsandboxed with controller privileges"],
                ["CSRF", "Crumb issuer enabled (default in current releases); never disable it", "Stops cross-site requests triggering jobs or config changes"],
                ["Plugins", "Minimal set pinned in a versioned plugins list, updated on a cadence, advisories monitored", "Plugins are the most common source of Jenkins vulnerabilities"],
                ["Configuration", "Configuration as Code (JCasC) in a reviewed repo", "Reproducible, reviewable, restorable configuration"],
                ["Pipeline changes", "CODEOWNERS on Jenkinsfile and shared-library repos; audit trail plugin to the SIEM", "Pipeline edits are production changes"],
                ["Network", "Controller not internet-facing; agents egress through a proxy allow-list", "Limits exfiltration and inbound attack"]
              ] },
              { t: "code", lang: "yaml", code:
                "# jenkins.yaml (Configuration as Code) — excerpt\n" +
                "jenkins:\n" +
                "  numExecutors: 0\n" +
                "  crumbIssuer:\n" +
                "    standard:\n" +
                "      excludeClientIPFromCrumb: false\n" +
                "  remotingSecurity:\n" +
                "    enabled: true\n" +
                "security:\n" +
                "  scriptApproval:\n" +
                "    approvedSignatures: []    # approvals reviewed in this repo, not in the UI"
              },
              { t: "note", variant: "tip", html: "Scan the Jenkins controller VM like any other workload: agentless CNAPP scanning catches vulnerable plugins and Java runtimes on it." },
              { t: "quiz", id: "chain-harden" },
              { t: "note", variant: "key", html: "<strong>Empty controller, disposable agents, pinned plugins, configuration as code, audited pipeline changes.</strong> That is a Jenkins you can defend." }
            ]
          }
        ]
      },
      {
        id: "identity",
        name: "Identity & Secrets for Pipelines",
        icon: "plug",
        lessons: [
          {
            id: "pipeline-identity",
            title: "Pipeline identity: OIDC, least privilege, SPIFFE and SSO",
            summary: "Replace long-lived cloud keys with short-lived, scoped workload identity.",
            minutes: 10,
            tags: ["advanced", "oidc", "workload-identity", "spiffe", "sso"],
            blocks: [
              { t: "p", html: "Every pipeline job needs to act <em>as someone</em>: to pull code, push images and deploy. The safest identity is one that is <strong>issued per job, scoped narrowly, and expires in minutes</strong>." },
              { t: "ol", items: [
                "The CI system issues the job a signed OIDC token with claims such as repository, branch and environment.",
                "The cloud provider trusts that issuer and maps claims to a role through a trust policy.",
                "The job exchanges the token for temporary cloud credentials limited to that role.",
                "Credentials expire when the job ends; there is nothing to store, rotate or leak."
              ] },
              { t: "code", lang: "text", code:
                "Trust policy (conceptual)\n" +
                "  allow  token issuer   = <CI_OIDC_ISSUER>\n" +
                "  where  audience       = sts\n" +
                "  and    subject        = repo:acme/payments-api:ref:refs/heads/main\n" +
                "  grant  role           = deploy-payments-staging   (push to one registry repo, nothing else)"
              },
              { t: "table", headers: ["Concept", "Use it for"], rows: [
                ["OIDC workload identity", "CI to cloud, CI to Vault, without stored keys"],
                ["Least privilege per pipeline", "Separate roles for build, push, deploy-staging, deploy-prod"],
                ["SPIFFE / SPIRE", "Service-to-service identity inside clusters and across platforms (short-lived SVIDs for mTLS)"],
                ["SSO with MFA", "Humans into SCM, Jenkins, registries, Vault and the CNAPP; one off-boarding switch"]
              ] },
              { t: "note", variant: "warn", html: "Scope trust policies to repository <em>and</em> branch or environment. A policy that trusts any repo in the organization lets any PR assume the production role." },
              { t: "note", variant: "key", html: "<strong>Identity per job, scoped by claims, expiring with the job.</strong> OIDC removes the cloud keys that are the most common pipeline secret leak." }
            ]
          },
          {
            id: "secrets-e2e",
            title: "Secrets management end to end",
            summary: "The one place Forge teaches secrets: scan, store, deliver by identity and rotate, from laptop to cluster.",
            minutes: 12,
            tags: ["practitioner", "secrets", "vault", "external-secrets", "rotation"],
            blocks: [
              { t: "p", html: "Other lessons touch secrets where they show up — a pre-commit hook, a Jenkins credential binding, a database migration, a Kubernetes Secret. This lesson is the whole lifecycle in one place. The rule underneath all of it: <strong>Git and images hold references; values live only in a manager and in process memory.</strong>" },
              { t: "h", text: "The hierarchy of secret hygiene" },
              { t: "ol", items: [
                "<strong>No secret at all</strong>: workload identity federation (OIDC from CI to cloud, IAM roles for pods). See <a href='#/chain/identity/pipeline-identity'>pipeline identity</a>.",
                "<strong>Dynamic, short-lived</strong>: generated per consumer, auto-revoked at lease end.",
                "<strong>Static but rotated</strong>: stored centrally, rotated automatically on a schedule.",
                "<strong>Static, manually managed</strong>: last resort; document an owner and a rotation date.",
                "<strong>Hardcoded</strong>: never."
              ] },
              { t: "h", text: "Controls at every stage" },
              { t: "table", headers: ["Stage", "Control", "Tools"], rows: [
                ["Developer machine", "Pre-commit secret scan", "gitleaks hook, IDE plugins"],
                ["Source control", "Push protection and history scanning", "Platform secret scanning, TruffleHog"],
                ["CI", "Secrets referenced by id, masked, single-quoted shell use", "Jenkins credentials, vault plugin, OIDC"],
                ["Build artifacts", "No secrets in layers, args or SBOM", "BuildKit secret mounts, image scanning"],
                ["Kubernetes", "Sync from a manager; never plain Secrets in Git", "External Secrets Operator, Secrets Store CSI driver, Sealed Secrets"],
                ["Cluster storage", "etcd encryption at rest, RBAC on Secret objects", "KMS provider for Kubernetes"],
                ["Lifecycle", "Automatic rotation, short leases, revocation on leaver", "Vault dynamic secrets, cloud secret manager rotation"]
              ] },
              { t: "p", html: "The first two rows are scanning, covered hands-on in <a href='#/pipe/git/hooks-secrets'>pre-commit hooks and secret scanning</a>. The CI row is the Jenkins credential binding from <a href='#/pipe/ci/shared-libs-creds'>shared libraries and credentials</a>; log masking pitfalls are in <a href='#/prog/data/build-log-leaks'>secrets and PII in build logs</a>. The stores themselves — Vault, AWS Secrets Manager and dynamic credentials — are the <a href='#/chain/identity/secrets-stores'>next lesson</a>." },
              { t: "h", text: "Kubernetes: deliver by reference" },
              { t: "ul", items: [
                "Never commit plain Secret manifests; base64 is encoding, not encryption.",
                "Sync from Vault or a cloud manager with External Secrets, mount with the Secrets Store CSI driver, or commit only Sealed Secrets ciphertext.",
                "Enable etcd encryption at rest with a KMS provider and restrict <code class='tok'>get/list secrets</code> in RBAC."
              ] },
              { t: "code", lang: "yaml", code:
                "apiVersion: external-secrets.io/v1\n" +
                "kind: ExternalSecret\n" +
                "metadata:\n" +
                "  name: payments-db\n" +
                "  namespace: payments\n" +
                "spec:\n" +
                "  refreshInterval: 1h\n" +
                "  secretStoreRef: { name: vault-payments, kind: SecretStore }\n" +
                "  target: { name: payments-db }      # Kubernetes Secret created in-cluster only\n" +
                "  data:\n" +
                "    - secretKey: password\n" +
                "      remoteRef: { key: secret/payments/db, property: password }"
              },
              { t: "note", variant: "tip", html: "Sealed Secrets lets you commit an <em>encrypted</em> Secret that only the in-cluster controller can decrypt. It suits GitOps, but rotation is still manual — prefer an external manager for anything high value." },
              { t: "h", text: "When a secret leaks anyway" },
              { t: "ol", items: [
                "Revoke or rotate it at the provider — this is the actual fix.",
                "Check the provider's audit logs for use since the leak.",
                "Remove it from history if the repo is shared widely, then invalidate caches and forks where possible.",
                "Move the value into the manager and replace every copy with a reference.",
                "Add a scanner rule or test so the same pattern cannot recur."
              ] },
              { t: "note", variant: "key", html: "<strong>Scan first, store centrally, deliver by identity, rotate automatically.</strong> Git holds references; values live only in the manager and in memory." }
            ]
          },
          {
            id: "secrets-stores",
            title: "Secret stores in practice: Vault, AWS Secrets Manager and dynamic credentials",
            summary: "Central storage, short-lived credentials on demand, and how Jenkins and Kubernetes read from a store.",
            minutes: 10,
            tags: ["practitioner", "vault", "secrets-manager", "dynamic-secrets", "jenkins"],
            blocks: [
              { t: "p", html: "A secrets manager stores credentials encrypted, controls who can read them, audits every read, and ideally <strong>issues short-lived credentials on demand</strong> so long-lived secrets disappear entirely. This is the store layer of <a href='#/chain/identity/secrets-e2e'>secrets management end to end</a>." },
              { t: "table", headers: ["Capability", "HashiCorp Vault", "AWS Secrets Manager"], rows: [
                ["Static secrets", "KV engine (versioned)", "Secrets with versions and staging labels"],
                ["Dynamic secrets", "Database, cloud and PKI engines issue per-request credentials", "Rotation via Lambda for supported databases"],
                ["Auth for workloads", "Kubernetes, AppRole, OIDC/JWT, cloud IAM", "IAM roles (including IRSA / Pod Identity on EKS)"],
                ["Kubernetes delivery", "Agent injector, CSI driver, Vault Secrets Operator", "Secrets Store CSI driver, External Secrets Operator"]
              ] },
              { t: "h", text: "Static versus dynamic secrets" },
              { t: "p", html: "A static secret is a value someone created and everyone shares until it is rotated. A <strong>dynamic secret</strong> is minted per consumer on request — Vault's database engine creates a real database user with a lease of minutes and drops it when the lease ends. A leaked dynamic credential expires on its own and its audit trail names exactly one consumer." },
              { t: "code", lang: "bash", code:
                "# Read at runtime by reference — the value never lands in code or images\n" +
                "aws secretsmanager get-secret-value --secret-id prod/payments/db --query SecretString --output text\n" +
                "vault kv get -field=db_password secret/ci/payments\n" +
                "vault read database/creds/payments-readonly   # dynamic: new user, short lease"
              },
              { t: "h", text: "Pulling secrets from Vault in Jenkins" },
              { t: "code", lang: "groovy", code:
                "// Vault plugin: Jenkins authenticates with an AppRole credential stored by id\n" +
                "withVault(configuration: [vaultUrl: 'https://vault.internal.example',\n" +
                "                          vaultCredentialId: 'vault-approle-ci'],\n" +
                "          vaultSecrets: [[path: 'secret/ci/payments',\n" +
                "                          secretValues: [[envVar: 'DB_PASSWORD', vaultKey: 'db_password']]]]) {\n" +
                "  sh './run-migrations.sh'   // DB_PASSWORD is masked in the console\n" +
                "}"
              },
              { t: "p", html: "Better still, let the job authenticate to Vault with its own OIDC token (the JWT auth method) instead of a stored AppRole secret, so even the bootstrap credential disappears." },
              { t: "note", variant: "warn", html: "Kubernetes Secret objects are only base64-encoded by default. Enable encryption at rest for etcd, restrict RBAC on secrets, or sync from an external manager instead." },
              { t: "quiz", id: "chain-identity" },
              { t: "note", variant: "key", html: "<strong>The best secret is one that does not exist; the next best expires in minutes.</strong> Prefer workload identity, then dynamic secrets, then rotated static ones — never hardcoded." }
            ]
          }
        ]
      },
      {
        id: "supply",
        name: "Supply Chain Integrity",
        icon: "blocks",
        lessons: [
          {
            id: "supply-chain",
            title: "Software supply-chain attacks and where to defend",
            summary: "Why attackers target the build instead of the app, the five attack points, and the control that answers each.",
            minutes: 9,
            tags: ["foundation", "supply-chain", "provenance", "threat-model"],
            blocks: [
              { t: "p", html: "Your software is mostly other people's software, built by machines you trust implicitly. A supply-chain attack compromises that trust: a malicious dependency, a poisoned build step, a tampered artifact, a stolen publishing token. One compromise reaches every downstream consumer." },              { t: "table", headers: ["Attack point", "Example pattern", "Control"], rows: [
                ["Source", "Unreviewed commit pushed with a stolen token", "Branch protection, required review, signed commits"],
                ["Dependencies", "Typosquatted or hijacked package", "Private proxy registry, pinning, SCA, allow-lists"],
                ["Build", "Compromised build script injects a backdoor", "Hosted, isolated, ephemeral builders; provenance"],
                ["Artifact", "Image swapped in the registry", "Sign by digest, verify at admission"],
                ["Deploy", "Pipeline identity abused to push arbitrary images", "GitOps pull model, least-privilege deploy identity"]
              ] },
              { t: "h", text: "Three pieces of evidence" },
              { t: "p", html: "Every control in the table produces, or checks, one of three kinds of evidence that travel with an artifact. The rest of this module takes them one at a time." },
              { t: "table", headers: ["Evidence", "Answers", "Lesson"], rows: [
                ["SBOM", "What is inside this artifact?", "<a href='#/chain/supply/sbom-signing'>SBOMs and signing with Sigstore</a>"],
                ["Signature", "Did we produce it, and has it changed since?", "<a href='#/chain/supply/sbom-signing'>SBOMs and signing with Sigstore</a>"],
                ["Provenance", "Which commit, builder and parameters made it?", "<a href='#/chain/supply/slsa-provenance'>SLSA, provenance, in-toto and VEX</a>"]
              ] },
              { t: "p", html: "<strong>Provenance</strong> is a signed statement: <em>this digest was built from this commit, by this builder, with these parameters</em>. Consumers verify it before deploy, the same way they verify a signature. The dependency-side attacks in the second row — confusion, typosquatting, install scripts — are covered in <a href='#/chain/harden/ppe-deps'>poisoned pipeline execution and dependency chain abuse</a>." },
              { t: "note", variant: "key", html: "<strong>Trust the artifact only as far as you can trace it.</strong> Signed provenance from an isolated builder turns 'we think this is our build' into something a machine can verify." }
            ]
          },
          {
            id: "sbom-signing",
            title: "SBOMs (CycloneDX, SPDX) and signing with Sigstore",
            summary: "Produce an inventory for every artifact, sign it by digest, and verify both at deploy.",
            minutes: 10,
            tags: ["practitioner", "sbom", "cyclonedx", "spdx", "sigstore", "cosign"],
            blocks: [
              { t: "p", html: "An <strong>SBOM</strong> (software bill of materials) lists every component in an artifact with its version and identifiers. A <strong>signature</strong> proves the artifact and its attestations came from you and have not changed. Together they let a deploy step ask two questions automatically: <em>is this ours?</em> and <em>what is in it?</em>" },
              { t: "table", headers: ["Format", "Steward", "Strengths"], rows: [
                ["CycloneDX", "OWASP", "Security-focused; supports VEX, services, and dependency graphs"],
                ["SPDX", "Linux Foundation (ISO/IEC 5962)", "Strong licence-compliance heritage; widely required in procurement"]
              ] },
              { t: "h", text: "Keyless signing with Sigstore" },
              { t: "ul", items: [
                "<strong>cosign</strong> — the CLI that signs and verifies images and attestations.",
                "<strong>Fulcio</strong> — issues a short-lived certificate bound to an OIDC identity (your CI's workload identity).",
                "<strong>Rekor</strong> — a public, append-only transparency log recording the signature, so misuse of an identity is detectable and keyless signatures can be verified after the certificate expires."
              ] },
              { t: "p", html: "cosign also works with a long-lived key pair held in a credential store or KMS, which suits air-gapped estates. Keyless removes the key to protect but makes the OIDC identity the thing to scope tightly." },
              { t: "code", lang: "bash", code:
                "# generate an SBOM for the built image (syft shown; Trivy and others work too)\n" +
                "syft registry.internal.example/payments/api@sha256:<DIGEST> -o cyclonedx-json > sbom.cdx.json\n\n" +
                "# sign the image BY DIGEST, never by a mutable tag\n" +
                "cosign sign --yes registry.internal.example/payments/api@sha256:<DIGEST>\n\n" +
                "# attach the SBOM as a signed attestation\n" +
                "cosign attest --yes --type cyclonedx --predicate sbom.cdx.json \\\n" +
                "  registry.internal.example/payments/api@sha256:<DIGEST>\n\n" +
                "# at deploy or admission: verify identity, not just 'a signature exists'\n" +
                "cosign verify \\\n" +
                "  --certificate-identity-regexp '^ci@build\\.internal\\.example$' \\\n" +
                "  --certificate-oidc-issuer <OIDC_ISSUER> \\\n" +
                "  registry.internal.example/payments/api@sha256:<DIGEST>"
              },
              { t: "note", variant: "trap", html: "Signing a tag such as <code class='tok'>:latest</code> signs whatever the tag points to at that instant. Always sign and deploy by <strong>digest</strong>." },
              { t: "note", variant: "tip", html: "Store SBOMs next to the artifact in the registry. When the next library CVE lands, you query SBOMs instead of rebuilding images to find out what is affected." },
              { t: "note", variant: "key", html: "<strong>Inventory, sign, verify — by digest.</strong> An SBOM tells you what is inside; a verified signature tells you who built it; admission control makes both mandatory." }
            ]
          },
          {
            id: "slsa-provenance",
            title: "SLSA levels, provenance, in-toto and VEX",
            summary: "Prove where an artifact came from, gate promotion on that proof, and state which of its CVEs matter.",
            minutes: 12,
            tags: ["advanced", "slsa", "provenance", "in-toto", "vex"],
            blocks: [
              { t: "p", html: "<strong>SLSA</strong> (Supply-chain Levels for Software Artifacts) grades how much you can trust a build's provenance. Each level adds a requirement on the <em>build platform</em>, not on your application code." },
              { t: "table", headers: ["SLSA build level", "Requirement", "What it stops"], rows: [
                ["L0", "No guarantees", "Nothing"],
                ["L1", "Provenance exists describing how the artifact was built", "Mistakes; enables inventory and debugging"],
                ["L2", "Provenance is signed by a hosted build platform", "Tampering after the build"],
                ["L3", "Hardened platform: builds isolated from each other, signing keys out of reach of build steps", "Tampering during the build, forged provenance"]
              ] },
              { t: "note", variant: "warn", html: "A self-hosted Jenkins agent that persists between builds and is shared across teams makes Level 3 isolation hard. Ephemeral, per-build agents are the usual first step." },
              { t: "h", text: "Attesting provenance" },
              { t: "p", html: "Provenance and SBOMs are attached to the image digest as signed <em>attestations</em> with the same cosign tooling introduced in <a href='#/chain/supply/sbom-signing'>SBOMs and signing</a>. Verification checks the signer identity, not merely that some signature exists." },
              { t: "code", lang: "bash", code:
                "# attest provenance and SBOM, then verify before deploy\n" +
                "cosign attest --yes --type slsaprovenance --predicate provenance.json registry.internal.example/payments-api@sha256:<DIGEST>\n" +
                "cosign attest --yes --type cyclonedx     --predicate sbom.cdx.json   registry.internal.example/payments-api@sha256:<DIGEST>\n" +
                "cosign verify-attestation --type slsaprovenance \\\n" +
                "  --certificate-identity <PIPELINE_IDENTITY> --certificate-oidc-issuer <OIDC_ISSUER> \\\n" +
                "  registry.internal.example/payments-api@sha256:<DIGEST>"
              },
              { t: "h", text: "in-toto and VEX" },
              { t: "p", html: "<strong>in-toto</strong> defines the attestation envelope and a way to declare which steps a supply chain must contain and who may perform them. <strong>VEX</strong> (Vulnerability Exploitability eXchange) accompanies an SBOM and states, per CVE, whether the product is <em>affected</em>, <em>not affected</em> (with a justification such as code not present or not reachable), <em>fixed</em>, or <em>under investigation</em>." },
              { t: "h", text: "Promotion with evidence" },
              { t: "p", html: "Promotion gates check attestations, not just tags: only a digest with valid provenance from the approved builder, a passing scan attestation and an SBOM may move from staging to production repositories — and admission verifies the same evidence again in the cluster." },
              { t: "quiz", id: "chain-supply" },
              { t: "note", variant: "key", html: "<strong>Provenance says where it came from, signatures say nobody changed it, VEX says which CVEs matter.</strong> Verify all three at promotion and at admission." }
            ]
          }
        ]
      }
    ]
  };
})();
