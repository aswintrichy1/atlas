/* Forge practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.found / pipe / scan / wiz / ops. */
window.ForgePractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#f97316",
      icon: "map",
      summary: "Outlines you can talk through end to end for the DevSecOps design and incident problems that come up most."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
      icon: "quiz",
      summary: "Timed prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions a DevSecOps or cloud-security round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Stage orders, commands and thresholds worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#818cf8",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "greenfield-pipeline",
      title: "Design a secure pipeline for a new service",
      subtitle: "The most common DevSecOps design prompt: commit to production with gates that teams will not bypass.",
      timebox: "40 min",
      prompt: "A team is launching a containerized payments API on Kubernetes in AWS. Design its CI/CD pipeline with security built in, using Jenkins.",
      related: [
        { label: "Reference pipeline", route: "#/ops/capstone/reference-pipeline" },
        { label: "Complete Jenkinsfile", route: "#/ops/capstone/full-jenkinsfile" },
        { label: "Wiz CLI in Jenkins", route: "#/wiz/shiftleft/wiz-jenkins" }
      ],
      outline: [
        {
          title: "Clarify constraints first",
          items: [
            "Ask about regulatory scope (PCI DSS for payments), deploy frequency, and which tools are already licensed.",
            "Confirm who owns policy (AppSec, cloud security) and who owns fixes (the team)."
          ]
        },
        {
          title: "Order stages cheapest first",
          items: [
            "Pre-commit and CI secret scan, then build and unit test, then SAST with a quality gate on new code, then SCA.",
            "Build the image, scan IaC, directory and image with wizcli before pushing; push only on pass.",
            "Generate an SBOM, sign the digest, promote the same digest through environments."
          ]
        },
        {
          title: "Enforce in layers",
          items: [
            "Branch protection and CODEOWNERS on the Jenkinsfile.",
            "GitOps deploy so CI never holds cluster credentials.",
            "Admission controller rejects unscanned or unsigned images; runtime sensor detects what slipped through."
          ]
        },
        {
          title: "Secrets and identity",
          items: [
            "Every secret referenced by Jenkins credential id, scoped per folder, used in single-quoted shell strings.",
            "Prefer OIDC federation and vault-issued short-lived credentials over static keys."
          ]
        },
        {
          title: "Close with metrics and rollout",
          items: [
            "Gate time budget under ten minutes, DORA keys plus critical-vuln MTTR.",
            "Audit mode, then warn, then block; exceptions in code with expiry."
          ]
        }
      ]
    },
    {
      id: "cve-fire-drill",
      title: "A critical library CVE drops on Friday",
      subtitle: "An incident-style scenario testing prioritization and the SBOM.",
      timebox: "30 min",
      prompt: "A remotely exploitable CVE is published in a widely used Java logging library. Leadership asks within the hour: are we affected, where, and when will it be fixed?",
      related: [
        { label: "SBOM and signing", route: "#/chain/supply/sbom-signing" },
        { label: "SCA basics", route: "#/scan/sca/sca-basics" },
        { label: "Security Graph", route: "#/wiz/platform/security-graph" }
      ],
      outline: [
        {
          title: "Find exposure in minutes",
          items: [
            "Query stored SBOMs and the CNAPP inventory for the package and vulnerable versions — no rebuilds needed.",
            "Split results into running in production, in registries only, and in source only."
          ]
        },
        {
          title: "Prioritize by path",
          items: [
            "Internet-exposed, reachable, with access to sensitive data first: those are the toxic combinations.",
            "Apply compensating controls (WAF rule, disable the feature flag, network policy) while patches build."
          ]
        },
        {
          title: "Fix through the pipeline",
          items: [
            "Bump the version in a shared BOM or base image so one change fixes many services.",
            "Add a blocking CI policy for the vulnerable versions so nothing reintroduces them."
          ]
        },
        {
          title: "Report",
          items: [
            "Affected count, fixed count and ETA per project; hourly at first, then daily until closed."
          ]
        }
      ]
    },
    {
      id: "wiz-rollout",
      title: "Roll out Wiz across 300 cloud accounts",
      subtitle: "A program-design scenario: coverage, ownership, enforcement and reporting.",
      timebox: "35 min",
      prompt: "Your company has just bought Wiz. You have 300 cloud accounts, 40 Kubernetes clusters and 900 repositories. Plan the first six months.",
      related: [
        { label: "CNAPP and agentless scanning", route: "#/wiz/platform/cnapp" },
        { label: "Projects, boards and compliance", route: "#/wiz/operate/dashboards" },
        { label: "Rollout playbook", route: "#/ops/capstone/rollout-playbook" }
      ],
      outline: [
        {
          title: "Month 1: coverage and ownership",
          items: [
            "Connect every cloud organization with templated read-only roles; connect clusters and VCS.",
            "Build projects from account structure and tags; assign owners before notifications go live."
          ]
        },
        {
          title: "Months 2–3: prioritize and route",
          items: [
            "Work critical toxic-combination issues first; automation rules to Jira and Slack per project.",
            "Stand up leadership boards: critical trend, MTTR by project, compliance posture."
          ]
        },
        {
          title: "Months 3–5: shift left",
          items: [
            "Add wizcli to the shared Jenkins library in audit mode; tune CI/CD policies; then block criticals with fixes.",
            "Enable Wiz Code PR scanning and the IDE extension for the same policies."
          ]
        },
        {
          title: "Months 5–6: enforce and detect",
          items: [
            "Admission controller in audit, then enforce for production namespaces.",
            "Runtime sensor on crown-jewel workloads; Wiz Defend detections into the SIEM."
          ]
        }
      ]
    },
    {
      id: "leaked-key",
      title: "A cloud access key leaked in a public repo",
      subtitle: "Incident response under time pressure, then prevention.",
      timebox: "25 min",
      prompt: "A security researcher reports that a CI access key for your production AWS account was pushed to a public fork two days ago. Walk through your response.",
      related: [
        { label: "Pre-commit and secret scanning", route: "#/pipe/git/hooks-secrets" },
        { label: "SIEM and incident response", route: "#/prog/feedback/siem-ir" },
        { label: "Secrets management", route: "#/chain/identity/secrets-e2e" }
      ],
      outline: [
        {
          title: "Contain",
          items: [
            "Deactivate the key immediately and revoke active sessions; do not wait for analysis.",
            "Check whether the identity could create other keys or roles, and look for those too."
          ]
        },
        {
          title: "Investigate",
          items: [
            "Pull cloud audit logs for the key since the commit time; look for unknown regions, new identities, data access.",
            "Use the CNAPP graph to see what the identity could reach — that is the possible blast radius."
          ]
        },
        {
          title: "Eradicate and recover",
          items: [
            "Remove anything the attacker created; rotate any secrets the identity could read.",
            "Replace the static key with OIDC federation from CI so there is no key to leak."
          ]
        },
        {
          title: "Prevent",
          items: [
            "Pre-commit hooks, push protection and org-wide history scanning with verification.",
            "Blameless review; a SIEM detection for key use from unexpected networks."
          ]
        }
      ]
    },
    {
      id: "actions-release-review",
      title: "Review a GitHub Actions production workflow",
      subtitle: "Find the trust boundaries before approving the release.",
      timebox: "30 min",
      prompt: "A repository is moving from Jenkins to GitHub Actions. Review its pull-request checks and production release design for identity, dependencies, runners and evidence.",
      related: [
        { label: "Actions foundations", route: "#/pipe/actions/actions-foundations" },
        { label: "OIDC and runner security", route: "#/pipe/actions/actions-identity-security" },
        { label: "Trusted release", route: "#/pipe/actions/actions-security-release" }
      ],
      outline: [
        { title: "Split trust", items: ["Keep fork code on unprivileged hosted or ephemeral runners with no secrets.", "Separate scan, build and release jobs with explicit permissions."] },
        { title: "Remove standing authority", items: ["Use OIDC bound to repository, workflow, ref and approved environment.", "Protect production with independent approval and deployment concurrency."] },
        { title: "Trust dependencies and outputs", items: ["Pin third-party actions to full commit SHAs.", "Treat caches as untrusted; retain reports, digest and provenance as artifacts."] }
      ]
    },
    {
      id: "snowflake-dbt-release",
      title: "Promote a Snowflake and dbt change safely",
      subtitle: "Plan model, DDL and infrastructure changes as one controlled release.",
      timebox: "35 min",
      prompt: "A pull request changes dbt models, a table definition and grants. Design CI, promotion evidence and rollback without hardcoding environment identifiers.",
      related: [
        { label: "Snowflake delivery", route: "#/prog/data-platform/snowflake-change-delivery" },
        { label: "dbt CI", route: "#/prog/data-platform/dbt-ci" },
        { label: "Safe promotion", route: "#/prog/data-platform/snowflake-safe-promotion" }
      ],
      outline: [
        { title: "Validate in isolation", items: ["Build state:modified+ in an isolated target and retain manifest/run results.", "Rehearse ordered SQL and Terraform plan against an approved clone or test environment."] },
        { title: "Promote with bounded identity", items: ["Supply account, database, role and warehouse from protected environment configuration.", "Serialize migrations and retain query ids, plan, tests and approvals."] },
        { title: "Prove recovery", items: ["Create the required pre-change backup/clone before shared mutation.", "Choose a rehearsed forward fix, code revert or restore path and reconcile business totals."] }
      ]
    }
  ],

  interview: [
    {
      id: "pipeline-design-40",
      title: "Secure CI/CD design in 40 minutes",
      timebox: "40 min",
      prompt: "Design a CI/CD pipeline for a Kubernetes microservice with security gates. Explain the order of stages and what each one blocks.",
      expected: [
        "Orders stages cheapest first and parallelizes scanners to protect developer feedback time.",
        "Explains build once, promote the same digest, with immutable tags.",
        "Handles secrets by credential id and workload identity, never in source.",
        "Layers enforcement: CI gates, admission control, runtime detection.",
        "States how gates are rolled out (audit, warn, block) and how exceptions expire."
      ],
      followups: [
        "Your gates add 25 minutes. What do you cut or parallelize?",
        "A team bypasses the pipeline with kubectl. What stops them?",
        "How do you know your gates are trusted rather than ignored?"
      ],
      links: [
        { label: "Reference pipeline", route: "#/ops/capstone/reference-pipeline" },
        { label: "Admission and runtime", route: "#/wiz/shiftleft/admission" }
      ]
    },
    {
      id: "wiz-deep-dive-30",
      title: "Wiz and CNAPP deep dive in 30 minutes",
      timebox: "30 min",
      prompt: "Explain how Wiz decides which cloud risks matter most, and how you would use it to reduce risk across a large estate.",
      expected: [
        "Describes agentless scanning with cloud APIs and disk snapshots, and its trade-off with a runtime sensor.",
        "Explains the Security Graph and toxic combinations, and the difference between findings and issues.",
        "Covers CSPM, CIEM, DSPM and KSPM as lenses on the same graph.",
        "Connects shift-left (Wiz Code, wizcli policies) with admission control and code-to-cloud.",
        "Talks about projects, ownership, MTTR and leadership reporting."
      ],
      followups: [
        "Why not just sort vulnerabilities by CVSS?",
        "Data must never leave your accounts. What changes in the deployment?",
        "How do you stop the same misconfiguration coming back after a console fix?"
      ],
      links: [
        { label: "Security Graph", route: "#/wiz/platform/security-graph" },
        { label: "Wiz Code", route: "#/wiz/shiftleft/wiz-code" },
        { label: "End-to-end Wiz flow", route: "#/wiz/operate/end-to-end" }
      ]
    },
    {
      id: "jenkins-secrets-20",
      title: "Jenkins credentials in 20 minutes",
      timebox: "20 min",
      prompt: "How do you handle secrets in a Jenkins pipeline? Show a stage that authenticates a scanner without exposing its credentials.",
      expected: [
        "Uses withCredentials with a credential id and explains masking.",
        "Explains why single-quoted sh strings matter versus Groovy interpolation.",
        "Mentions folder scoping, ephemeral agents, and no executors on the controller.",
        "Proposes vault integration or OIDC for short-lived credentials."
      ],
      followups: [
        "A developer prints env in a debug step. What leaks, and how do you prevent it?",
        "How would you rotate the scanner's secret without touching 300 Jenkinsfiles?"
      ],
      links: [
        { label: "Shared libraries and credentials", route: "#/pipe/ci/shared-libs-creds" },
        { label: "Wiz CLI in Jenkins", route: "#/wiz/shiftleft/wiz-jenkins" }
      ]
    },
    {
      id: "supply-chain-25",
      title: "Software supply chain in 25 minutes",
      timebox: "25 min",
      prompt: "What is software supply chain security, and what would you implement first?",
      expected: [
        "Names the attack surfaces: source, dependencies, build system, artifacts, deploy.",
        "Explains SBOMs (CycloneDX, SPDX), signing with Sigstore cosign, and provenance (SLSA levels).",
        "Prioritizes: controlled dependency proxy, lockfiles, pinned CI actions, signed artifacts verified at admission.",
        "Mentions frameworks (NIST SSDF, SLSA) as structure, not as the goal."
      ],
      followups: [
        "A popular package publishes a malicious version. Which control catches it first?",
        "What does SLSA provenance prove that a signature alone does not?"
      ],
      links: [
        { label: "Supply chain", route: "#/chain/supply/supply-chain" },
        { label: "SBOM and signing", route: "#/chain/supply/sbom-signing" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Pipeline design — stage order, speed and artifact flow",
      "Security depth — right tool for each risk, and its limits",
      "Cloud and runtime — posture, identity, admission and detection",
      "Secrets and identity hygiene",
      "Operational thinking — ownership, exceptions, metrics and rollout",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Lists tools but not why they are ordered or what each one blocks.",
        signals: [
          "Puts every scanner in one serial stage at the end.",
          "Treats scanner output as the outcome rather than a gate decision.",
          "Stores tokens in pipeline files or environment configuration in the repo.",
          "Sorts vulnerabilities by CVSS only."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Designs a sensible pipeline with gates and handles secrets correctly, but enforcement stops at CI.",
        signals: [
          "Orders stages cheapest first and fails builds on clear thresholds.",
          "Uses a credential store and explains masking.",
          "Knows SBOM and signing exist but not how they are verified at deploy.",
          "Mentions dashboards without saying who owns which issues."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Layers prevention, enforcement and detection, prioritizes by attack path, and plans adoption.",
        signals: [
          "Build once, sign, promote one digest; admission verifies scan and signature.",
          "Explains toxic combinations and code-to-cloud fixes.",
          "Rolls gates out progressively with expiring exceptions in code.",
          "Reports DORA alongside critical MTTR and false-positive rate."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "stage-order",
      title: "Reference stage order",
      summary: "Cheapest and fastest first, enforcement last.",
      items: [
        "1. Pre-commit: gitleaks hook, formatters.",
        "2. Checkout and secret scan (gitleaks / TruffleHog).",
        "3. Build and unit tests (mvn / gradle / npm ci).",
        "4. SAST and quality gate (SonarQube, waitForQualityGate).",
        "5. SCA (snyk test, Trivy).",
        "6. Build image; wizcli iac, dir and docker scan before push.",
        "7. Push, SBOM (Syft), sign and attest (cosign), wizcli docker tag.",
        "8. GitOps deploy to staging; DAST baseline.",
        "9. Approved promotion of the same digest to production.",
        "10. Admission controller; runtime sensor and SIEM."
      ]
    },
    {
      id: "wizcli-commands",
      title: "wizcli quick reference",
      summary: "Verify against wizcli --help for your pinned version.",
      items: [
        "wizcli auth --id \"$WIZ_CLIENT_ID\" --secret \"$WIZ_CLIENT_SECRET\" — values from the CI credential store.",
        "wizcli iac scan --path infra/ --policy \"<WIZ_IAC_POLICY>\" — Terraform, CloudFormation, K8s, Helm.",
        "wizcli dir scan --path . --policy \"<WIZ_VULN_POLICY>\" — dependencies, secrets and files.",
        "wizcli docker scan --image <IMAGE> --dockerfile Dockerfile --policy \"<WIZ_VULN_POLICY>\".",
        "wizcli docker tag --image <IMAGE> — link the pushed digest to the scan.",
        "Non-zero exit code when a blocking policy is violated; audit policies record but pass."
      ]
    },
    {
      id: "scanner-flags",
      title: "Scanner thresholds",
      summary: "The flags that turn a scan into a gate.",
      items: [
        "snyk test --severity-threshold=high --fail-on=upgradable",
        "trivy image --severity HIGH,CRITICAL --exit-code 1 <IMAGE>",
        "checkov -d infra/ --hard-fail-on HIGH,CRITICAL",
        "gitleaks detect --source . --redact --exit-code 1",
        "grype sbom:sbom.json --fail-on high",
        "waitForQualityGate abortPipeline: true (inside a timeout)"
      ]
    },
    {
      id: "jenkins-secrets",
      title: "Jenkins secret hygiene",
      summary: "Five rules that prevent almost every pipeline leak.",
      items: [
        "Reference secrets by credential id with withCredentials or credentials().",
        "Use single-quoted sh strings so the shell, not Groovy, expands secrets.",
        "set +x before commands that take secrets; never print env.",
        "Scope credentials to folders; zero executors on the controller; ephemeral agents.",
        "Prefer OIDC or vault-issued short-lived credentials over static tokens."
      ]
    }
  ],

  glossary: [
    {
      id: "shift-left",
      term: "Shift left",
      definition: "Moving security checks earlier in the lifecycle — design, IDE, pull request, CI — where fixes are cheapest.",
      useIt: "Pair it with 'shift everywhere': earlier checks do not replace admission control and runtime detection.",
      links: [{ label: "DevSecOps", route: "#/found/sdlc/devsecops" }]
    },
    {
      id: "quality-gate",
      term: "Quality gate",
      definition: "A set of pass or fail conditions on measured results that decides whether a pipeline may continue.",
      useIt: "Say which conditions, measured on new code, and what happens on failure — the gate is the decision, not the scan.",
      links: [{ label: "SonarQube", route: "#/scan/sast/sonarqube" }]
    },
    {
      id: "sbom",
      term: "SBOM",
      definition: "A software bill of materials: a machine-readable list of every component and version in an artifact, in formats such as CycloneDX or SPDX.",
      useIt: "Use it to answer 'are we affected?' for a new CVE across every release without rebuilding.",
      links: [{ label: "SBOM and signing", route: "#/chain/supply/sbom-signing" }]
    },
    {
      id: "slsa",
      term: "SLSA",
      definition: "A framework of levels for build integrity and provenance: who built an artifact, from what source, on what builder.",
      useIt: "Mention provenance when asked how you know the artifact in production came from your reviewed source.",
      links: [{ label: "Supply chain", route: "#/chain/supply/supply-chain" }]
    },
    {
      id: "cnapp",
      term: "CNAPP",
      definition: "Cloud-native application protection platform: posture, workload, identity, data, Kubernetes and code security on one inventory and risk model.",
      useIt: "Explain the value as correlation — one graph — not as a bundle of features.",
      links: [{ label: "CNAPP", route: "#/wiz/platform/cnapp" }]
    },
    {
      id: "toxic-combination",
      term: "Toxic combination",
      definition: "Several individually moderate risks on connected resources that together form a viable attack path.",
      useIt: "Use it to justify fixing the cheapest link in a path before patching every high CVE.",
      links: [{ label: "Security Graph", route: "#/wiz/platform/security-graph" }]
    },
    {
      id: "issue-vs-finding",
      term: "Issue vs finding",
      definition: "In Wiz, a finding is one raw result; an issue is a prioritized, correlated risk raised when graph conditions match.",
      useIt: "Route issues to owners; keep findings as evidence. Raw finding counts are not a progress metric.",
      links: [{ label: "Security Graph", route: "#/wiz/platform/security-graph" }]
    },
    {
      id: "ciem",
      term: "CIEM",
      definition: "Cloud infrastructure entitlement management: computing effective permissions and right-sizing them.",
      useIt: "Bring it up when asked who can access a resource, or how to reduce blast radius without patching.",
      links: [{ label: "Posture lenses", route: "#/wiz/platform/posture" }]
    },
    {
      id: "dspm",
      term: "DSPM",
      definition: "Data security posture management: discovering and classifying sensitive data in cloud stores and who can reach it.",
      useIt: "Use it to rank exposures by what data they lead to.",
      links: [{ label: "Posture lenses", route: "#/wiz/platform/posture" }]
    },
    {
      id: "admission-controller",
      term: "Admission controller",
      definition: "A Kubernetes webhook that evaluates create or update requests against policy before the API server persists them.",
      useIt: "Name it as the backstop that holds even when someone bypasses the pipeline.",
      links: [{ label: "Admission and runtime", route: "#/wiz/shiftleft/admission" }]
    },
    {
      id: "gitops",
      term: "GitOps",
      definition: "Declaring desired state in Git and letting an in-cluster agent such as Argo CD or Flux pull and reconcile it.",
      useIt: "Point out that CI no longer needs cluster credentials and every deploy is a reviewed commit.",
      links: [{ label: "GitOps", route: "#/pipe/deploy/gitops" }]
    },
    {
      id: "policy-as-code",
      term: "Policy as code",
      definition: "Security and compliance rules written as versioned, tested code and evaluated automatically.",
      useIt: "Show the same rule running in CI and at admission so there is no enforcement gap.",
      links: [{ label: "Policy as code", route: "#/ctr/posture/policy-as-code" }]
    },
    {
      id: "dora",
      term: "DORA metrics",
      definition: "Deployment frequency, lead time for changes, change failure rate and time to restore service.",
      useIt: "Report them next to security metrics such as critical-vuln MTTR so speed and safety are traded openly.",
      links: [{ label: "Metrics", route: "#/prog/feedback/metrics" }]
    },
    {
      id: "build-once",
      term: "Build once, promote many",
      definition: "Building a single immutable artifact and promoting the same digest through environments.",
      useIt: "Use it to argue that scan and signature evidence stays valid all the way to production.",
      links: [{ label: "Versioning and promotion", route: "#/pipe/build/versioning-promotion" }]
    }
  ]
};
