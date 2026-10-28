/* =====================================================================
   FORGE · Pipeline Engineering
   window.TRACKS.pipe — modules: git / ci / build / deploy

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
     1. pipeBranching — "Pick a branching strategy"
     Deterministic scoring over three team traits.
  ================================================================== */
  var BRANCH_STRATS = [
    { id: "trunk", label: "Trunk-based", why: "Short-lived branches (hours to a day) merged to main behind feature flags; main is always releasable." },
    { id: "ghflow", label: "GitHub flow", why: "One long-lived main, a branch per change, PR review, deploy from main after merge." },
    { id: "gitflow", label: "GitFlow", why: "develop plus main, with feature, release and hotfix branches; suits versioned releases you support in parallel." }
  ];
  function branchScore(cadence, versions, maturity) {
    var s = { trunk: 0, ghflow: 0, gitflow: 0 };
    if (cadence === "daily") { s.trunk += 3; s.ghflow += 2; }
    if (cadence === "weekly") { s.ghflow += 3; s.trunk += 1; s.gitflow += 1; }
    if (cadence === "quarterly") { s.gitflow += 3; }
    if (versions === "one") { s.trunk += 2; s.ghflow += 2; }
    if (versions === "many") { s.gitflow += 3; }
    if (maturity === "high") { s.trunk += 3; s.ghflow += 1; }
    if (maturity === "medium") { s.ghflow += 2; s.trunk += 1; }
    if (maturity === "low") { s.ghflow += 1; s.gitflow += 2; }
    return s;
  }

  Widgets.pipeBranching = function (mount) {
    shell(mount, "advisor", "Pick a branching strategy",
      "Set release cadence, how many versions you support at once, and how strong your automated tests are. The scores show why no strategy wins everywhere.");
    var cadence = "daily", versions = "one", maturity = "high";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var s = branchScore(cadence, versions, maturity);
      var best = BRANCH_STRATS[0], i;
      for (i = 0; i < BRANCH_STRATS.length; i++) if (s[BRANCH_STRATS[i].id] > s[best.id]) best = BRANCH_STRATS[i];
      clear(stage);
      for (i = 0; i < BRANCH_STRATS.length; i++) {
        var st = BRANCH_STRATS[i];
        var on = st.id === best.id;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:130px minmax(80px,2fr) 40px;gap:12px;align-items:center;padding:6px 0;" + (on ? "font-weight:700" : "") },
          h("span", { style: "font-size:0.86rem" }, st.label),
          h("span", { style: "display:block;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:10px;border-radius:6px;width:" + Math.round(s[st.id] / 8 * 100) + "%;background:" + (on ? "var(--accent)" : "var(--text-faint)") })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem" }, String(s[st.id]))));
      }
      clear(readout);
      readout.appendChild(ro("recommended", best.label));
      readout.appendChild(ro("score", s[best.id] + " / 8"));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, best.why));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["daily", "Deploy daily"], ["weekly", "Weekly"], ["quarterly", "Quarterly"]], 0, function (v) { cadence = v; paint(); }),
      segment([["one", "One live version"], ["many", "Many supported versions"]], 0, function (v) { versions = v; paint(); }),
      segment([["high", "Strong tests"], ["medium", "Some tests"], ["low", "Weak tests"]], 0, function (v) { maturity = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. pipeRollout — "Deployment strategy trade-offs"
     Deterministic model: strategy x exposure -> users hit, infra cost,
     rollback time. Illustrative numbers for a 100k-user service.
  ================================================================== */
  var ROLLOUTS = {
    recreate: { label: "Recreate", cost: 1.0, rollback: "minutes (redeploy)", downtime: "yes", fixedExposure: 100 },
    rolling: { label: "Rolling", cost: 1.25, rollback: "minutes (roll back batches)", downtime: "no", fixedExposure: null },
    bluegreen: { label: "Blue/green", cost: 2.0, rollback: "seconds (switch traffic)", downtime: "no", fixedExposure: 100 },
    canary: { label: "Canary", cost: 1.1, rollback: "seconds (drop canary weight)", downtime: "no", fixedExposure: null }
  };

  Widgets.pipeRollout = function (mount) {
    shell(mount, "model", "What a bad release costs, by strategy",
      "A release with a latent bug reaches production. Pick a strategy and how much traffic the new version gets before you detect the problem. The model is for a 100,000-user service.");
    var strat = "canary", exposure = 5;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var r = ROLLOUTS[strat] || ROLLOUTS.canary;
      var pct = r.fixedExposure != null ? r.fixedExposure : exposure;
      var users = Math.round(100000 * pct / 100);
      clear(stage);
      var bar = h("div", { style: "display:flex;height:28px;border-radius:8px;overflow:hidden;border:1px solid var(--line)" },
        h("span", { style: "width:" + pct + "%;background:color-mix(in srgb, var(--rose) 55%, transparent)" }),
        h("span", { style: "flex:1;background:color-mix(in srgb, var(--cyan) 22%, transparent)" }));
      stage.appendChild(bar);
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:8px" },
        r.label + ": " + pct + "% of traffic on the faulty version when the alert fires" +
        (r.fixedExposure != null ? " (this strategy switches all traffic at once)." : ".")));
      clear(readout);
      readout.appendChild(ro("users affected", users.toLocaleString("en-US")));
      readout.appendChild(ro("infra during deploy", r.cost.toFixed(2) + "x"));
      readout.appendChild(ro("rollback", r.rollback));
      readout.appendChild(ro("downtime", r.downtime));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["recreate", "Recreate"], ["rolling", "Rolling"], ["bluegreen", "Blue/green"], ["canary", "Canary"]], 3, function (v) { strat = v; paint(); }),
      segment([[1, "1%"], [5, "5%"], [25, "25%"], [50, "50%"]], 1, function (v) { exposure = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  Widgets.pipeActionsTrust = function (mount) {
    shell(mount, "trust model", "GitHub Actions permission planner",
      "Choose a job. The widget shows the smallest useful token permission set and the trust boundary to review.");
    var jobs = {
      test: { perms: "contents: read", risk: "Untrusted pull-request code must not receive secrets or write permissions." },
      scan: { perms: "contents: read, security-events: write", risk: "Grant SARIF upload only to the scanner job; keep source access read-only." },
      deploy: { perms: "contents: read, id-token: write", risk: "Use an approved environment and OIDC; do not add a long-lived cloud key." },
      release: { perms: "contents: write, id-token: write, attestations: write", risk: "Restrict to protected tags and independent approval; pin every third-party action." }
    };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint(id) {
      var j = jobs[id];
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:.9rem;line-height:1.55" }, j.risk));
      clear(readout);
      readout.appendChild(ro("permissions", j.perms));
    }
    mount.appendChild(segment([["test", "Test"], ["scan", "Scan"], ["deploy", "Deploy"], ["release", "Release"]], 0, paint));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint("test");
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "pipe-git": {
      title: "Git & source control checkpoint",
      sub: "Branching, protection, signed commits and secret scanning.",
      questions: [
        {
          q: "A team deploys several times a day from one live version and has strong automated tests. Which branching strategy fits best?",
          options: ["GitFlow with release branches", "Trunk-based development with feature flags", "A long-lived branch per developer", "No version control for config"],
          answer: 1,
          explain: "Trunk-based development keeps branches very short and main always releasable, which is what high-frequency deploys need. GitFlow's release branches add ceremony that pays off only when you maintain several released versions."
        },
        {
          q: "Which branch protection rule most directly stops a single compromised account from pushing straight to production code?",
          options: ["Requiring a pull request with at least one approving review from someone else", "Allowing force pushes", "Enabling issue templates", "Using a longer branch name"],
          answer: 0,
          explain: "Required review means no single identity can land code alone, which is the core of separation of duties in source control. Pair it with required status checks and blocked force pushes."
        },
        {
          q: "A developer accidentally committed a cloud access key and then deleted it in the next commit. What is the right response?",
          options: ["Nothing; the latest commit is clean", "Rotate the key immediately, then purge it from history and confirm no misuse", "Make the repository private", "Rename the file"],
          answer: 1,
          explain: "The key is still in Git history and possibly in clones and caches, so assume it is compromised. Rotation is the fix; rewriting history only reduces further exposure. Check provider logs for use of the key."
        },
        {
          q: "What does a signed commit prove?",
          options: ["The code is bug-free", "The commit was created by the holder of a key tied to that identity and has not been altered", "The commit passed CI", "The author is an administrator"],
          answer: 1,
          explain: "A signature binds the commit to a key, and the platform maps the key to an identity. It proves authorship and integrity, not quality. Requiring signed commits stops trivially spoofed author names."
        },
        {
          q: "Why run secret scanning in a pre-commit hook as well as in CI?",
          options: ["CI cannot scan for secrets", "A pre-commit hook stops the secret before it ever enters history or reaches the remote", "Hooks are mandatory in Git", "It makes builds faster"],
          answer: 1,
          explain: "Once a secret is pushed it must be treated as leaked. A local hook catches it before it exists anywhere else, while CI and server-side push protection catch anyone who skipped or lacks the hook."
        }
      ]
    },
    "pipe-ci": {
      title: "Jenkins & CI checkpoint",
      sub: "Declarative pipelines, agents, shared libraries and credentials.",
      questions: [
        {
          q: "In a declarative Jenkinsfile, where do you put steps that must run whether the build passes or fails, such as publishing test reports?",
          options: ["In a stage named 'finally'", "In the post { always { ... } } section", "In the environment block", "In options"],
          answer: 1,
          explain: "The post section runs after the stages with conditions such as always, success, failure and unstable. always is the right place for reports and cleanup."
        },
        {
          q: "Why should a secret from withCredentials be used inside single-quoted sh strings, for example sh 'curl -u \"$USER:$PASS\" ...'?",
          options: ["Single quotes run faster", "With single quotes the shell expands the variable, so Groovy never interpolates the secret into the command string that Jenkins may log or expose", "Double quotes are not valid Groovy", "Jenkins cannot read single-quoted strings"],
          answer: 1,
          explain: "Groovy double-quoted strings interpolate before the step runs, which can leak the secret into process listings or logs. Letting the shell expand the environment variable keeps the value inside the masked credential binding."
        },
        {
          q: "What is the main benefit of a Jenkins shared library?",
          options: ["It stores build artifacts", "Teams reuse a reviewed, versioned pipeline definition instead of copy-pasting stages", "It replaces agents", "It encrypts credentials"],
          answer: 1,
          explain: "A shared library holds common steps and whole pipeline templates in a versioned repository. Platform teams fix or harden a stage once and every consumer picks it up by bumping the library version."
        },
        {
          q: "Which is the safer agent model for builds that run untrusted pull-request code?",
          options: ["A long-lived agent shared by all teams with cached credentials", "Ephemeral per-build agents, such as Kubernetes pod agents, with no standing secrets", "Running builds on the Jenkins controller", "Disabling agents entirely"],
          answer: 1,
          explain: "Ephemeral agents are created per build and destroyed afterwards, so a malicious build cannot persist or read another team's workspace. Running builds on the controller exposes the whole Jenkins instance."
        },
        {
          q: "Which statement about GitHub Actions versus Jenkins is accurate?",
          options: ["Actions cannot run containers", "Actions workflows live in the repository as YAML and run on hosted or self-hosted runners; Jenkins is self-managed with a plugin ecosystem", "Jenkins has no pipeline-as-code", "They are the same product"],
          answer: 1,
          explain: "Both support pipeline-as-code. Actions is SaaS-first and repo-native; Jenkins gives full control and a huge plugin ecosystem at the cost of running and patching the controller yourself."
        }
      ]
    },
    "pipe-actions": {
      title: "GitHub Actions engineering checkpoint",
      sub: "Workflow syntax, runners, matrices, reuse, approvals, OIDC, scanners and supply-chain trust.",
      questions: [
        { q: "Why should a third-party action be pinned to a full commit SHA?", options: ["It makes YAML shorter", "A tag can be moved, while a reviewed commit SHA fixes the exact code that runs", "It grants more permissions", "It disables caching"], answer: 1,
          explain: "A full immutable commit SHA prevents a moved tag from silently changing pipeline code. Dependency review and an update process are still needed to adopt fixes." },
        { q: "A deploy job needs cloud access. Which design removes the standing secret?", options: ["Store an administrator key as a repository secret", "Grant id-token: write and exchange the workflow's OIDC identity for a short-lived, scoped cloud role", "Print the key in an artifact", "Run on every pull request"], answer: 1,
          explain: "OIDC federation binds repository, ref, workflow and environment claims to a short-lived cloud role. There is no reusable access key to rotate or steal." },
        { q: "What is the safest default for the workflow GITHUB_TOKEN?", options: ["write-all at workflow scope", "permissions: {} at workflow scope, then explicit job-level grants", "admin on self-hosted runners", "The default never matters"], answer: 1,
          explain: "Starting empty makes each job declare only the operations it needs. It limits damage if an action or build step is compromised." },
        { q: "Why are self-hosted runners risky for untrusted pull requests?", options: ["They cannot run containers", "Pull-request code can persist, read cached workspaces or reach the runner network and credentials", "They are always slower", "They cannot use matrices"], answer: 1,
          explain: "A long-lived runner is a host inside your trust boundary. Use ephemeral isolated runners, no standing secrets, restricted egress and never route fork code to privileged runner groups." },
        { q: "What is the difference between cache and artifacts?", options: ["There is none", "Caches accelerate future jobs and must be treated as untrusted input; artifacts are named outputs retained for review or downstream jobs", "Artifacts execute code", "Caches are audit evidence"], answer: 1,
          explain: "A cache is an optimization and can be poisoned if trust boundaries share keys. Artifacts are run outputs such as reports and binaries, with explicit retention and provenance." },
        { q: "Where should CodeQL, SonarQube, Snyk and Wiz run in a workflow?", options: ["Only after production deployment", "As least-privileged jobs: CodeQL/Sonar for code, Snyk for dependencies, and Wiz for IaC/image risk, with blocking policy on protected branches", "Inside comments", "Only on developer laptops"], answer: 1,
          explain: "Separate jobs make permissions, reports and failure policy explicit. Fast checks run on pull requests; protected releases require every relevant gate and artifact identity check." }
      ]
    },
    "pipe-build": {
      title: "Build & artifacts checkpoint",
      sub: "Reproducible builds, repositories, immutability and promotion.",
      questions: [
        {
          q: "Why use npm ci instead of npm install in a pipeline?",
          options: ["It installs newer versions", "It installs exactly what the lockfile says and fails if package.json and the lockfile disagree", "It skips dependencies", "It publishes the package"],
          answer: 1,
          explain: "npm ci is deterministic: it honours the lockfile and refuses drift. That makes builds reproducible and means what you scanned is what you shipped."
        },
        {
          q: "What does 'build once, promote many' mean?",
          options: ["Rebuild the artifact for each environment", "The same immutable artifact digest moves from dev to staging to prod; only configuration differs", "Only build in production", "Promote source code instead of artifacts"],
          answer: 1,
          explain: "Rebuilding per environment means production runs something that was never tested. Promoting one digest guarantees the bits you tested are the bits you run."
        },
        {
          q: "In Artifactory, what is a remote repository used for?",
          options: ["Storing your own releases", "Proxying and caching an upstream registry such as Maven Central or npm so builds use a controlled source", "Running builds", "Holding secrets"],
          answer: 1,
          explain: "A remote repository proxies and caches an external registry. Combined with a virtual repository, builds resolve everything through one controlled endpoint that can be scanned, audited and allow-listed."
        },
        {
          q: "Why enable tag immutability on a container registry?",
          options: ["To save storage", "So a tag such as 1.4.2 can never be overwritten to point at different content", "To make pushes faster", "To allow anonymous pulls"],
          answer: 1,
          explain: "Mutable tags let someone replace what a version refers to, which breaks traceability and can smuggle in a different image. Immutable tags plus digest pinning keep releases tamper-evident."
        }
      ]
    },
    "pipe-deploy": {
      title: "Deployment checkpoint",
      sub: "GitOps, rollout strategies, canary analysis, feature flags and Terraform.",
      questions: [
        {
          q: "During an automated canary with Argo Rollouts or Flagger, the error rate on the canary jumps at the 25% step. What happens?",
          options: ["The rollout continues to 100% on schedule", "The analysis fails, the rollout aborts and traffic is routed back to the stable version", "The cluster is deleted", "Developers must SSH in to fix it"],
          answer: 1,
          explain: "Canary analysis queries metrics between weight steps. A failed check aborts the rollout automatically, so only the small canary slice of users saw the bad version."
        },
        {
          q: "In a GitOps model with Argo CD, how does a new version reach the cluster?",
          options: ["Jenkins runs kubectl apply with cluster-admin credentials", "A commit updates the desired state in Git and Argo CD, running in the cluster, pulls and syncs it", "Developers SSH into nodes", "The registry pushes into the cluster"],
          answer: 1,
          explain: "GitOps makes Git the source of truth and the in-cluster agent pulls changes. CI never needs cluster credentials, every change is a reviewed commit, and drift is detected and corrected."
        },
        {
          q: "You need the fastest possible rollback and can afford double capacity during release. Which strategy?",
          options: ["Recreate", "Rolling", "Blue/green", "Manual hotfix"],
          answer: 2,
          explain: "Blue/green keeps the old environment fully running, so rollback is a traffic switch measured in seconds. The cost is running two full environments during the cutover."
        },
        {
          q: "Why should Terraform state live in a remote backend with locking and encryption?",
          options: ["It makes plans prettier", "State holds the real infrastructure map and often sensitive values; locking prevents concurrent applies corrupting it", "Terraform cannot run without the cloud", "To avoid writing modules"],
          answer: 1,
          explain: "State is the mapping from code to real resources and can contain secrets. A shared, encrypted, locked backend prevents two applies racing, prevents loss, and restricts who can read it."
        },
        {
          q: "What do feature flags add to a deployment strategy?",
          options: ["They replace testing", "They decouple deploy from release: code ships dark and is enabled per tenant, with flag changes audited like deploys", "They make images smaller", "They remove the need for rollback"],
          answer: 1,
          explain: "Flags let you deploy safely and release gradually or instantly turn a feature off. Because a flag flip changes production behaviour, it needs the same audit trail as a deploy."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.pipe = {
    id: "pipe",
    name: "Pipeline Engineering",
    short: "PIPE",
    tagline: "Git to Jenkins to artifacts to production",
    color: "#38bdf8",
    blurb: "Build the delivery machine: Git workflows and protections, Jenkins declarative pipelines with shared libraries and credential stores, reproducible builds and artifact repositories, then GitOps delivery, rollout strategies and Terraform. Docker, Kubernetes and Helm live in the Containers track.",
    modules: [
      {
        id: "git",
        name: "Git & Source Control",
        icon: "share",
        lessons: [
          {
            id: "git-basics",
            title: "Git from zero: commits, branches, remotes",
            summary: "The mental model of Git as a graph of snapshots, and the dozen commands you use every day.",
            minutes: 8,
            tags: ["foundation", "git", "basics"],
            blocks: [
              { t: "p", html: "Git stores your project as a <strong>graph of snapshots</strong>. Each commit records the full state of the tracked files, its parent commit(s), an author and a message, all identified by a hash. A <strong>branch</strong> is just a movable label pointing at one commit. A <strong>remote</strong> is another copy of the graph you push to and fetch from." },
              { t: "h", text: "The three places a change lives" },
              { t: "table", headers: ["Area", "What is there", "Move a change in with"], rows: [
                ["Working tree", "Files as you edit them", "your editor"],
                ["Staging area (index)", "Exactly what the next commit will contain", "<code class='tok'>git add</code>"],
                ["Repository", "Committed history", "<code class='tok'>git commit</code>"]
              ] },
              { t: "code", lang: "bash", code:
                "git clone <REPO_URL> && cd payments-api\n" +
                "git switch -c feature/rate-limit      # new branch from current commit\n" +
                "git status                            # what changed?\n" +
                "git add src/RateLimiter.java          # stage one file\n" +
                "git commit -m \"Add token-bucket rate limiter\"\n" +
                "git fetch origin && git rebase origin/main   # replay your work on latest main\n" +
                "git push -u origin feature/rate-limit # publish and open a PR\n" +
                "git log --oneline --graph -n 15       # see the graph"
              },
              { t: "h", text: "Merge versus rebase" },
              { t: "compare",
                bad: { title: "Rebasing shared branches", items: ["Rewrites hashes others already have", "Forces everyone to recover", "Can silently drop work"] },
                good: { title: "Rebase your own branch, merge into main", items: ["Linear, readable feature history", "Main history never rewritten", "Squash-merge keeps one commit per PR"] } },
              { t: "note", variant: "warn", html: "Git history is forever for practical purposes. Anything committed — even if deleted next commit — is in every clone. Treat a committed secret as leaked." },
              { t: "note", variant: "key", html: "<strong>Commits are snapshots, branches are labels, remotes are copies.</strong> Keep your own branch tidy with rebase; never rewrite what others have pulled." }
            ]
          },
          {
            id: "branching",
            title: "Branching strategies: GitFlow, trunk-based, GitHub flow",
            summary: "Three strategies, the release model each assumes, and how to choose.",
            minutes: 9,
            tags: ["practitioner", "gitflow", "trunk-based", "github-flow"],
            blocks: [
              { t: "p", html: "A branching strategy encodes your <strong>release model</strong>. Choose it from how often you ship and how many versions you support, not from habit." },
              { t: "table", headers: ["Strategy", "Long-lived branches", "Typical branch life", "Best when"], rows: [
                ["GitFlow", "main, develop (+ release/*, hotfix/*)", "Days to weeks", "Versioned products with parallel supported releases"],
                ["GitHub flow", "main", "A day or two", "Web services deploying from main after each merge"],
                ["Trunk-based", "main (trunk)", "Hours; at most a day", "High-frequency deploys with strong tests and feature flags"]
              ] },
              { t: "widget", id: "pipeBranching" },
              { t: "h", text: "Security implications" },
              { t: "ul", items: [
                "Long-lived branches delay integration, so scanners report findings late and in bulk.",
                "Trunk-based development needs <strong>feature flags</strong>; flag configuration then becomes security-relevant (who can turn on an unfinished payment path?).",
                "Every strategy needs branch protection on the branches that deploy. In GitFlow that is main <em>and</em> release/*."
              ] },
              { t: "note", variant: "tip", html: "Hotfix paths are where controls get skipped at 2 a.m. Make the hotfix branch go through the same pipeline with the same gates — just faster, not different." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we maintain v3 and v4 for customers' suggests GitFlow; 'we deploy on merge' suggests GitHub flow; 'dozens of deploys a day' and 'feature flags' suggest trunk-based." },
              { t: "note", variant: "key", html: "<strong>Your branching model is your release model written in Git.</strong> Shorter-lived branches mean earlier integration and earlier security feedback." }
            ]
          },
          {
            id: "pr-protection",
            title: "Pull requests, code review, branch protection and signed commits",
            summary: "Turn the PR into the main security checkpoint for code entering the system.",
            minutes: 9,
            tags: ["practitioner", "pull-request", "code-review", "branch-protection", "signing"],
            blocks: [
              { t: "p", html: "The pull request is where a change is <strong>reviewed by a human and checked by machines</strong> before it can reach a deploying branch. Branch protection makes those checks non-optional." },
              { t: "h", text: "Branch protection rules worth enabling" },
              { t: "table", headers: ["Rule", "Stops"], rows: [
                ["Require PR before merging, at least one approval", "One identity landing code alone"],
                ["Require review from code owners (CODEOWNERS)", "Changes to sensitive paths without the right reviewer"],
                ["Dismiss stale approvals on new commits", "Approve-then-swap tricks"],
                ["Require status checks (build, tests, SAST, SCA, secret scan)", "Merging red builds"],
                ["Require signed commits", "Spoofed author identity"],
                ["Block force pushes and deletions", "History rewriting on main"],
                ["Restrict who can push / bypass", "Admins quietly skipping gates"]
              ] },
              { t: "h", text: "Signing commits" },
              { t: "code", lang: "bash", code:
                "# SSH-key signing (simplest; reuses a key the platform already knows)\n" +
                "git config --global gpg.format ssh\n" +
                "git config --global user.signingkey ~/.ssh/id_ed25519.pub\n" +
                "git config --global commit.gpgsign true\n\n" +
                "git commit -m \"Harden session cookie flags\"   # now signed\n" +
                "git log --show-signature -1                    # verify locally"
              },
              { t: "p", html: "Keyless alternatives such as <strong>gitsign</strong> (part of Sigstore) sign with a short-lived certificate tied to your SSO identity, so there is no long-lived signing key to manage." },
              { t: "h", text: "What reviewers should actually look for" },
              { t: "ul", items: [
                "New trust boundaries: a new endpoint, queue consumer, or outbound call.",
                "Authorization on every new data access path.",
                "Secrets, tokens, or URLs with credentials in code or config.",
                "New dependencies — why this one, is it maintained, what does it pull in?",
                "Changes to the pipeline itself (Jenkinsfile, workflow files): these are production changes."
              ] },
              { t: "note", variant: "trap", html: "Pipeline definitions live in the repo, so a PR can change the gates that judge it. Protect <code class='tok'>Jenkinsfile</code> and shared-library references with CODEOWNERS owned by the platform team." },
              { t: "note", variant: "key", html: "<strong>The PR is your code-entry checkpoint.</strong> Required review, required checks, signed commits and protected pipeline files make it a control rather than a courtesy." }
            ]
          },
          {
            id: "hooks-secrets",
            title: "Pre-commit hooks and secret scanning",
            summary: "Stop secrets before they exist in history, and catch the ones that slip through.",
            minutes: 9,
            tags: ["practitioner", "pre-commit", "gitleaks", "trufflehog", "secret-scanning"],
            blocks: [
              { t: "p", html: "Leaked credentials are among the most common and most damaging findings in source code. Defense is layered: <strong>local hook</strong> before commit, <strong>push protection</strong> on the server, <strong>CI scan</strong> on every build, and a <strong>history scan</strong> for what is already there." },
              { t: "table", headers: ["Layer", "Tool examples", "Catches"], rows: [
                ["Pre-commit hook", "gitleaks, detect-secrets via the pre-commit framework", "Secrets before they enter history"],
                ["Server push protection", "GitHub secret scanning with push protection", "Pushes from anyone without hooks"],
                ["CI scan", "gitleaks, TruffleHog in a pipeline stage", "Everything merged, with a build-failing exit code"],
                ["History and org scan", "TruffleHog across all repos and branches", "Old leaks still valid today"]
              ] },
              { t: "code", lang: "yaml", code:
                "# .pre-commit-config.yaml — uses a locally installed gitleaks binary\n" +
                "repos:\n" +
                "  - repo: local\n" +
                "    hooks:\n" +
                "      - id: gitleaks\n" +
                "        name: gitleaks (staged changes)\n" +
                "        entry: gitleaks protect --staged --redact --verbose\n" +
                "        language: system\n" +
                "        pass_filenames: false\n" +
                "      - id: no-private-keys\n" +
                "        name: block private key files\n" +
                "        entry: bash -c 'git diff --cached --name-only | grep -E \"\\.(pem|key|p12)$\" && exit 1 || exit 0'\n" +
                "        language: system\n" +
                "        pass_filenames: false"
              },
              { t: "code", lang: "bash", code:
                "pre-commit install                     # wire the hook into .git/hooks\n" +
                "gitleaks detect --source . --redact    # scan the full repo history\n" +
                "trufflehog git file://. --only-verified   # report only secrets that still work"
              },
              { t: "note", variant: "tip", html: "TruffleHog's verification checks whether a detected credential is <em>live</em>. Use it to prioritize: a verified key is an incident, an unverified pattern match is a cleanup task." },
              { t: "note", variant: "warn", html: "Newer gitleaks releases reorganize subcommands (for example a <code class='tok'>git</code> subcommand with a pre-commit flag). Check <code class='tok'>gitleaks --help</code> for the version you pin." },
              { t: "p", html: "Scanning is only the detection layer. Where secrets should live instead, how they are delivered to builds and pods, and the leak-response runbook (revoke first, then investigate) are covered in one place: <a href='#/chain/identity/secrets-e2e'>secrets end to end</a>." },
              { t: "quiz", id: "pipe-git" },
              { t: "note", variant: "key", html: "<strong>Rotation is the fix; scanning is the alarm.</strong> Layer hook, push protection, CI and history scans so a leaked secret is caught before it is pushed — or revoked minutes after." }
            ]
          }
        ]
      },
      {
        id: "ci",
        name: "CI with Jenkins",
        icon: "wrench",
        lessons: [
          {
            id: "jenkins-basics",
            title: "Jenkins architecture: controller, agents, plugins",
            summary: "How Jenkins runs work, and the hardening that matters before you add a single stage.",
            minutes: 8,
            tags: ["advanced", "jenkins", "agents", "hardening"],
            blocks: [
              { t: "p", html: "Jenkins is a self-hosted automation server. The <strong>controller</strong> schedules jobs, stores configuration and credentials, and serves the UI. <strong>Agents</strong> (static machines, containers, or Kubernetes pods) execute the actual build steps on <strong>executors</strong>. Almost every feature is a <strong>plugin</strong>." },
              { t: "table", headers: ["Component", "Role", "Hardening priority"], rows: [
                ["Controller", "Scheduling, config, credentials, UI", "Zero executors on the controller; patch promptly; SSO plus RBAC"],
                ["Agents", "Run build steps", "Ephemeral per build; no standing secrets; network-restricted"],
                ["Plugins", "SCM, credentials, pipeline, scanners", "Minimal set, pinned and updated; remove unused"],
                ["Credentials store", "Encrypted secrets referenced by id", "Scope per folder; prefer short-lived tokens or a vault"]
              ] },
              { t: "h", text: "Job types you will meet" },
              { t: "ul", items: [
                "<strong>Pipeline</strong> — one Jenkinsfile, one job.",
                "<strong>Multibranch pipeline</strong> — discovers branches and PRs in a repo and runs each one's Jenkinsfile.",
                "<strong>Organization folder</strong> — discovers every repo in an org; the scalable default.",
                "Freestyle jobs — legacy UI-configured jobs; migrate them to pipeline-as-code."
              ] },
              { t: "note", variant: "warn", html: "Builds running on the controller can read its filesystem, which holds encrypted credentials and their keys. Set the controller's executors to zero." },
              { t: "note", variant: "key", html: "<strong>The controller is a crown jewel.</strong> Keep work on ephemeral agents, keep plugins minimal and patched, and scope credentials to the folders that need them." }
            ]
          },
          {
            id: "jenkinsfile",
            title: "Declarative Jenkinsfile: stages, agents, post, when",
            summary: "Read and write a declarative pipeline confidently, section by section.",
            minutes: 10,
            tags: ["practitioner", "jenkinsfile", "declarative", "pipeline"],
            blocks: [
              { t: "p", html: "A declarative pipeline is a structured Groovy DSL: one <code class='tok'>pipeline</code> block with an <code class='tok'>agent</code>, optional <code class='tok'>options</code>, <code class='tok'>environment</code> and <code class='tok'>parameters</code>, a list of <code class='tok'>stages</code>, and a <code class='tok'>post</code> section." },
              { t: "code", lang: "groovy", code:
                "pipeline {\n" +
                "  agent { label 'linux-docker' }          // where stages run by default\n" +
                "  options {\n" +
                "    timestamps()\n" +
                "    timeout(time: 30, unit: 'MINUTES')\n" +
                "    buildDiscarder(logRotator(numToKeepStr: '30'))\n" +
                "    disableConcurrentBuilds()\n" +
                "  }\n" +
                "  environment {\n" +
                "    APP_NAME = 'payments-api'\n" +
                "  }\n" +
                "  stages {\n" +
                "    stage('Checkout') { steps { checkout scm } }\n" +
                "    stage('Build & unit test') {\n" +
                "      steps { sh './mvnw -B -ntp clean verify' }\n" +
                "    }\n" +
                "    stage('Parallel checks') {\n" +
                "      parallel {\n" +
                "        stage('Lint')         { steps { sh './mvnw -B -ntp checkstyle:check' } }\n" +
                "        stage('Secret scan')  { steps { sh 'gitleaks detect --source . --redact' } }\n" +
                "      }\n" +
                "    }\n" +
                "    stage('Publish') {\n" +
                "      when { branch 'main' }               // only from main\n" +
                "      steps { echo 'publish artifact here' }\n" +
                "    }\n" +
                "  }\n" +
                "  post {\n" +
                "    always  { junit 'target/surefire-reports/*.xml' }\n" +
                "    failure { echo 'notify the owning team' }\n" +
                "    cleanup { cleanWs() }\n" +
                "  }\n" +
                "}"
              },
              { t: "table", headers: ["Section", "Purpose", "Note"], rows: [
                ["agent", "Where to run (label, docker, kubernetes)", "Can be overridden per stage"],
                ["options", "Timeouts, retention, concurrency", "Always set a timeout"],
                ["environment", "Variables, including <code class='tok'>credentials('id')</code> bindings", "Secrets bound here are masked in logs"],
                ["when", "Conditional stages: branch, changeRequest, expression", "Keep prod stages behind branch conditions"],
                ["parallel", "Run independent stages concurrently", "Scanners are good candidates"],
                ["post", "always / success / failure / unstable / cleanup", "Reports and notifications belong here"]
              ] },
              { t: "note", variant: "tip", html: "Declarative over scripted: declarative is easier to review, lint and template. Drop to a <code class='tok'>script { }</code> block only for logic the DSL cannot express." },
              { t: "note", variant: "key", html: "<strong>Agent, options, environment, stages, post.</strong> Once you can name those five sections and what belongs in each, every Jenkinsfile becomes readable." }
            ]
          },
          {
            id: "shared-libs-creds",
            title: "Shared libraries and Jenkins credentials",
            summary: "Reuse hardened pipelines across teams and reference every credential by id.",
            minutes: 9,
            tags: ["practitioner", "shared-library", "credentials"],
            blocks: [
              { t: "h", text: "Shared libraries" },
              { t: "p", html: "A shared library is a separate, versioned Git repo that Jenkinsfiles import. Platform teams put hardened stages and whole pipeline templates there, so a fix lands once and every service inherits it." },
              { t: "code", lang: "text", code:
                "platform-pipeline/            # the library repo\n" +
                "  vars/\n" +
                "    standardJavaPipeline.groovy  # global step: whole pipeline template\n" +
                "    securityScans.groovy         # reusable stage group\n" +
                "  src/org/example/ci/            # Groovy classes\n" +
                "  resources/                     # shared config files"
              },
              { t: "code", lang: "groovy", code:
                "// Jenkinsfile in a service repo: pin the library to a release tag\n" +
                "@Library('platform-pipeline@v3.2.0') _\n\n" +
                "standardJavaPipeline(\n" +
                "  app: 'payments-api',\n" +
                "  sonarProjectKey: 'payments-api',\n" +
                "  failOnSeverity: 'HIGH'\n" +
                ")"
              },
              { t: "h", text: "Credentials: never in source, always by id" },
              { t: "code", lang: "groovy", code:
                "stage('Publish') {\n" +
                "  steps {\n" +
                "    withCredentials([usernamePassword(credentialsId: 'artifactory-deployer',\n" +
                "                                      usernameVariable: 'ART_USER',\n" +
                "                                      passwordVariable: 'ART_TOKEN')]) {\n" +
                "      // single quotes: the SHELL expands the variables, Groovy never sees the secret\n" +
                "      sh 'jf rt upload \"target/*.jar\" libs-release-local/payments/ --user \"$ART_USER\" --password \"$ART_TOKEN\"'\n" +
                "    }\n" +
                "  }\n" +
                "}"
              },
              { t: "p", html: "For values that should not live in Jenkins at all, the pipeline pulls them from a secrets manager at runtime. The Vault plugin, dynamic credentials and how this fits the whole secrets lifecycle are taught once, in <a href='#/chain/identity/secrets-stores'>secret stores in practice</a> and <a href='#/chain/identity/secrets-e2e'>secrets end to end</a>." },
              { t: "compare",
                bad: { title: "Leaky patterns", items: ["Token in a Jenkinsfile or properties file", "<code class='tok'>sh \"curl -H 'Authorization: $TOKEN'\"</code> with Groovy interpolation", "<code class='tok'>env</code> or <code class='tok'>set -x</code> dumps in logs", "One global credential shared by every job"] },
                good: { title: "Safe patterns", items: ["Credential ids only; values in the store or vault", "Single-quoted <code class='tok'>sh</code> strings", "Folder-scoped credentials per team", "Short-lived tokens via OIDC or vault leases"] } },
              { t: "note", variant: "key", html: "<strong>Reference secrets by id, expand them in the shell, scope them per folder.</strong> And put the pattern in a shared library so nobody writes it from scratch." }
            ]
          },
          {
            id: "ci-compare",
            title: "Jenkins vs GitHub Actions, GitLab CI, Azure DevOps, CircleCI",
            summary: "The same pipeline in different dialects, and how to choose a CI platform.",
            minutes: 9,
            tags: ["practitioner", "github-actions", "gitlab-ci", "azure-devops", "circleci", "quality-gates"],
            blocks: [
              { t: "table", headers: ["Platform", "Pipeline file", "Hosting", "Secrets", "Standout trait"], rows: [
                ["Jenkins", "Jenkinsfile (Groovy)", "Self-managed", "Credentials store, vault plugins", "Total control, huge plugin ecosystem"],
                ["GitHub Actions", ".github/workflows/*.yml", "SaaS or self-hosted runners", "Encrypted secrets, OIDC to cloud", "Repo-native, marketplace actions"],
                ["GitLab CI", ".gitlab-ci.yml", "SaaS or self-managed", "CI/CD variables, OIDC", "Single platform: SCM, CI, registry, security scans"],
                ["Azure DevOps", "azure-pipelines.yml", "SaaS or server", "Variable groups, Key Vault links", "Deep Azure and enterprise integration"],
                ["CircleCI", ".circleci/config.yml", "SaaS or self-hosted runners", "Contexts", "Fast hosted execution, reusable orbs"]
              ] },
              { t: "code", lang: "yaml", code:
                "# The same idea in GitHub Actions\n" +
                "name: ci\n" +
                "on: [pull_request]\n" +
                "permissions:\n" +
                "  contents: read            # least privilege for the workflow token\n" +
                "jobs:\n" +
                "  build:\n" +
                "    runs-on: ubuntu-latest\n" +
                "    steps:\n" +
                "      - uses: actions/checkout@<PINNED_COMMIT_SHA>\n" +
                "      - run: ./mvnw -B -ntp clean verify\n" +
                "      - run: gitleaks detect --source . --redact"
              },
              { t: "h", text: "Quality gates, platform-agnostic" },
              { t: "p", html: "Whatever the platform, a <strong>quality gate</strong> is a stage that turns a tool's result into pass or fail by exit code. The gate policy (what fails the build) should be defined centrally and versioned, not tuned per repo by whoever is in a hurry." },
              { t: "note", variant: "trap", html: "Third-party CI actions and plugins run with your pipeline's permissions. Pin them to a full commit SHA or a vetted internal mirror, never a moving tag." },
              { t: "quiz", id: "pipe-ci" },
              { t: "note", variant: "key", html: "<strong>The dialect changes; the shape does not.</strong> Checkout, build, test, scan, gate, publish — with least-privilege tokens and pinned third-party steps on every platform." }
            ]
          }
        ]
      },
      {
        id: "actions",
        name: "GitHub Actions",
        icon: "branch",
        lessons: [
          {
            id: "actions-foundations",
            title: "GitHub Actions syntax, events, jobs, steps, runners and matrices",
            summary: "Read a workflow from trigger to runner, and expand one test definition safely across versions.",
            minutes: 12,
            tags: ["practitioner", "github-actions", "yaml", "runners", "matrix"],
            blocks: [
              { t: "p", html: "A workflow is YAML under <code class='tok'>.github/workflows</code>. An <strong>event</strong> triggers it; jobs run independently on runners; steps share one job workspace. Expressions read trusted context and untrusted event data, so never concatenate pull-request text into a shell command." },
              { t: "code", lang: "yaml", code:
                "name: verify\n" +
                "on:\n" +
                "  pull_request:\n" +
                "  push: { branches: [main] }\n" +
                "permissions: {}\n" +
                "jobs:\n" +
                "  test:\n" +
                "    permissions: { contents: read }\n" +
                "    strategy:\n" +
                "      fail-fast: false\n" +
                "      matrix: { runtime: [20, 22], os: [ubuntu-latest] }\n" +
                "    runs-on: ${{ matrix.os }}\n" +
                "    steps:\n" +
                "      - uses: actions/checkout@<FULL_COMMIT_SHA>\n" +
                "      - run: npm ci && npm test" },
              { t: "table", headers: ["Primitive", "Boundary", "Design rule"], rows: [
                ["Event", "Who may start the run and what data enters", "Prefer pull_request for fork checks; treat event fields as untrusted"],
                ["Job", "Runner, permissions, environment and outputs", "Split trust levels into separate jobs"],
                ["Step", "Shares the job workspace and token context", "A compromised earlier step can alter later inputs"],
                ["Matrix", "Expands one job across combinations", "Use include/exclude deliberately; cap fan-out and fail-fast behavior"],
                ["Concurrency", "Groups overlapping runs", "Cancel stale PR runs; serialize production deploys"]
              ] },
              { t: "note", variant: "warn", html: "<code class='tok'>pull_request_target</code> runs in the base repository's privileged context. Never check out and execute untrusted fork code in that workflow." },
              { t: "note", variant: "key", html: "<strong>Each job is a security boundary only if its runner, token and inputs are independent.</strong> Split by trust, start with no permissions and keep pull-request code away from release authority." }
            ]
          },
          {
            id: "actions-reuse-state",
            title: "Reusable workflows, environments, approvals, cache and artifacts",
            summary: "Centralize the paved road without hiding trust, and distinguish accelerators from evidence.",
            minutes: 11,
            tags: ["practitioner", "reusable-workflows", "environments", "cache", "artifacts"],
            blocks: [
              { t: "p", html: "A reusable workflow called with <code class='tok'>workflow_call</code> is the Actions equivalent of a shared pipeline library. Define typed inputs and named secrets, pin the caller to a reviewed ref, and keep policy in the reusable workflow while application-specific values remain inputs." },
              { t: "code", lang: "yaml", code:
                "# caller\njobs:\n" +
                "  release:\n" +
                "    uses: platform/pipelines/.github/workflows/release.yml@<FULL_COMMIT_SHA>\n" +
                "    with: { service: payments-api }\n" +
                "    secrets: inherit\n\n" +
                "# deploy job inside the reusable workflow\n" +
                "environment: production\n" +
                "concurrency: production-payments\n" +
                "permissions: { contents: read, id-token: write }" },
              { t: "table", headers: ["Mechanism", "Use", "Security rule"], rows: [
                ["Environment", "Approvers, branch/tag restrictions and environment-scoped secrets", "Production approval is independent and recorded"],
                ["Cache", "Package/tool data reused by later runs", "Never trust cached executables; key by lockfile and trust domain"],
                ["Artifact", "Reports, test output, SBOM or built package", "Set retention; verify digest before consuming across jobs"],
                ["Job output", "Small scalar passed through the run", "Do not pass secrets; outputs can appear in logs"]
              ] },
              { t: "note", variant: "tip", html: "Use environments for the authorization decision and an immutable artifact digest for the deployment decision. Approval should promote already-built bits, never trigger a rebuild." },
              { t: "note", variant: "key", html: "<strong>Reuse centralizes policy; environments centralize authority; artifacts carry evidence.</strong> Caches carry no trust." }
            ]
          },
          {
            id: "actions-identity-security",
            title: "OIDC, least privilege, SHA pinning and runner security",
            summary: "Replace cloud keys with workload identity and make workflow dependencies and runners part of the threat model.",
            minutes: 12,
            tags: ["advanced", "oidc", "least-privilege", "sha-pinning", "self-hosted-runners"],
            blocks: [
              { t: "widget", id: "pipeActionsTrust" },
              { t: "p", html: "With OIDC, a job requests a signed identity token whose claims describe the organization, repository, ref, workflow and environment. The cloud trust policy accepts only the intended claims and returns a short-lived role. The workflow stores no cloud credential." },
              { t: "ul", items: [
                "Set <code class='tok'>permissions: {}</code> globally and grant <code class='tok'>contents: read</code>, <code class='tok'>id-token: write</code> or other scopes only to the job that needs them.",
                "Pin third-party actions to full commit SHAs; review updates like library upgrades and prefer small, maintained actions.",
                "Separate runner groups by trust. Use ephemeral, freshly imaged self-hosted runners with restricted network egress and no shared workspace.",
                "Do not expose secrets to fork workflows, and do not let untrusted code influence cache keys, artifact names or shell syntax without validation."
              ] },
              { t: "compare",
                bad: { title: "Standing authority", items: ["write-all token on every job", "Cloud administrator key in secrets", "Mutable action tags", "Long-lived runner shared across repos"] },
                good: { title: "Bound authority", items: ["Explicit job scopes", "OIDC role bound to repo, ref and environment", "Full-SHA action pins", "Ephemeral isolated runners"] } },
              { t: "note", variant: "key", html: "<strong>A workflow is production code with an identity.</strong> Review it through CODEOWNERS, bind its authority to exact claims and assume every dependency or runner may become hostile." }
            ]
          },
          {
            id: "actions-security-release",
            title: "CodeQL, SonarQube, Snyk, Wiz, provenance and a trusted release",
            summary: "Compose specialist scanners, then attest the exact artifact that passed.",
            minutes: 12,
            tags: ["advanced", "codeql", "sonarqube", "snyk", "wiz", "provenance"],
            blocks: [
              { t: "table", headers: ["Gate", "Finds", "Output"], rows: [
                ["CodeQL", "Semantic code vulnerabilities through data-flow queries", "SARIF uploaded to code scanning"],
                ["SonarQube", "Maintainability, reliability, security hotspots and configured quality gate", "Gate status plus issue report"],
                ["Snyk", "Open-source dependencies, licences and reachable package risk", "Machine-readable report and failing policy exit"],
                ["Wiz", "IaC, secrets, image and code-to-cloud context", "Policy decision linked to cloud risk graph"],
                ["Build attestation", "Who built which digest from which source and workflow", "Signed provenance consumed at deploy"]
              ] },
              { t: "code", lang: "yaml", code:
                "permissions:\n" +
                "  contents: read\n" +
                "  security-events: write\n" +
                "  id-token: write\n" +
                "  attestations: write\n" +
                "steps:\n" +
                "  - name: Test and scanner gates\n" +
                "    run: ./ci/verify.sh\n" +
                "  - name: Build once\n" +
                "    run: ./ci/build-image.sh\n" +
                "  - name: Attest exact digest\n" +
                "    uses: actions/attest-build-provenance@<FULL_COMMIT_SHA>\n" +
                "    with: { subject-name: '<IMAGE_NAME>', subject-digest: '${{ steps.build.outputs.digest }}' }" },
              { t: "p", html: "Run independent scanners in parallel where possible, but make release depend on every required result. Upload reports even on failure, fail closed on scanner errors, and attest only the digest produced after the gates. The deeper supply-chain model is in <a href='#/chain/supply/slsa-provenance'>SLSA and provenance</a>." },
              { t: "quiz", id: "pipe-actions" },
              { t: "note", variant: "key", html: "<strong>The release claim is not 'the workflow was green'; it is 'this exact digest was built from this source by this reviewed workflow after these gates passed.'</strong>" }
            ]
          }
        ]
      },
      {
        id: "build",
        name: "Build & Artifacts",
        icon: "cube",
        lessons: [
          {
            id: "builds",
            title: "Reproducible builds with Maven, Gradle and npm",
            summary: "Deterministic dependency resolution so what you scanned is what you ship.",
            minutes: 8,
            tags: ["practitioner", "maven", "gradle", "npm", "reproducible"],
            blocks: [
              { t: "p", html: "A <strong>reproducible build</strong> produces the same output from the same inputs. In DevSecOps it matters because every scanner result is only valid for the exact dependency set it scanned." },
              { t: "table", headers: ["Ecosystem", "CI command", "Lock mechanism", "Resolve through"], rows: [
                ["Maven", "<code class='tok'>mvn -B -ntp clean verify</code>", "Pinned versions, dependency convergence, optional lock plugins", "settings.xml mirror to Artifactory/Nexus"],
                ["Gradle", "<code class='tok'>./gradlew build --no-daemon</code>", "<code class='tok'>dependencyLocking</code> lockfiles, verification metadata", "repositories pointing at the proxy"],
                ["npm", "<code class='tok'>npm ci</code>", "package-lock.json", ".npmrc registry pointing at the proxy"]
              ] },
              { t: "code", lang: "text", code:
                "# .npmrc — all installs go through the controlled proxy\n" +
                "registry=https://artifactory.internal.example/artifactory/api/npm/npm-virtual/\n" +
                "always-auth=true\n" +
                "# the auth token is injected by CI from the credential store, never committed"
              },
              { t: "ul", items: [
                "Use wrappers (<code class='tok'>mvnw</code>, <code class='tok'>gradlew</code>) so the build tool version is pinned too.",
                "Pin the build image by digest so the JDK and OS are fixed.",
                "Block direct internet egress from agents; resolve only via the proxy.",
                "Fail on lockfile drift rather than silently updating."
              ] },
              { t: "note", variant: "key", html: "<strong>Scan results are only as true as the build is reproducible.</strong> Lockfiles, pinned tools and a single controlled proxy make 'what we scanned' equal 'what we shipped'." }
            ]
          },
          {
            id: "artifact-repos",
            title: "Artifact repositories: Artifactory, Nexus and container registries",
            summary: "Local, remote and virtual repositories, plus ECR, ACR, GCR/Artifact Registry and Harbor.",
            minutes: 9,
            tags: ["practitioner", "artifactory", "nexus", "ecr", "acr", "harbor"],
            blocks: [
              { t: "p", html: "An artifact repository is the <strong>system of record for built things</strong>: jars, npm packages, Helm charts and container images. It is also the choke point where you control which third-party packages may enter at all." },
              { t: "table", headers: ["Concept", "Artifactory", "Nexus"], rows: [
                ["Your own artifacts", "Local repository", "Hosted repository"],
                ["Proxy of an upstream registry", "Remote repository", "Proxy repository"],
                ["One endpoint over many", "Virtual repository", "Group repository"],
                ["Built-in scanning", "Xray", "Lifecycle / firewall products"]
              ] },
              { t: "table", headers: ["Container registry", "Where", "Notes"], rows: [
                ["Amazon ECR", "AWS", "Tag immutability setting, scan on push, IAM-scoped"],
                ["Azure ACR", "Azure", "Entra ID auth, geo-replication, content trust options"],
                ["Google Artifact Registry (successor to GCR)", "GCP", "Multi-format, IAM-scoped, vulnerability scanning"],
                ["Harbor", "Self-hosted (CNCF)", "Projects with RBAC, replication, built-in Trivy scanning, signature policies"],
                ["Artifactory / Nexus", "Self-hosted or SaaS", "Docker repos alongside every other format"]
              ] },
              { t: "note", variant: "tip", html: "Point every build at the <em>virtual</em> repository. Then blocking a malicious package or pinning an approved version is one change in one place, not a hunt across hundreds of build files." },
              { t: "note", variant: "key", html: "<strong>Every artifact in, every artifact out, through one controlled registry.</strong> That is where allow-lists, scanning, retention and promotion are enforced." }
            ]
          },
          {
            id: "versioning-promotion",
            title: "Versioning, immutability, promotion and provenance",
            summary: "Build once, promote the same digest, and carry the evidence with it.",
            minutes: 9,
            tags: ["advanced", "semver", "immutability", "promotion", "provenance"],
            blocks: [
              { t: "h", text: "Versioning schemes" },
              { t: "table", headers: ["Scheme", "Example", "Use for"], rows: [
                ["SemVer", "2.7.1", "Libraries and APIs: MAJOR breaks, MINOR adds, PATCH fixes"],
                ["SemVer + build metadata", "2.7.1+b482.g3f9c2a1", "Traceable service builds"],
                ["Commit SHA tag", "3f9c2a1", "Images deployed by GitOps"],
                ["CalVer", "2026.10.2", "Products released on a calendar"]
              ] },
              { t: "h", text: "Promotion, not rebuild" },
              { t: "p", html: "Build the artifact once. Then <strong>promote the same digest</strong> through environments by copying or moving it between repositories (for example <code class='tok'>docker-dev</code> to <code class='tok'>docker-prod</code>) after each gate passes. Environment differences live in configuration, never in a rebuilt binary." },
              { t: "code", lang: "bash", code:
                "# JFrog CLI: record build-info, then promote that exact build after approval\n" +
                "jf rt build-publish payments-api 482\n" +
                "jf rt build-promote payments-api 482 docker-prod-local --status=released --copy=true\n\n" +
                "# or, registry-agnostic: copy by digest with crane / skopeo\n" +
                "crane copy registry.internal.example/dev/payments-api@sha256:<DIGEST> \\\n" +
                "           registry.internal.example/prod/payments-api@sha256:<DIGEST>"
              },
              { t: "ul", items: [
                "<strong>Immutability</strong>: production repositories reject overwrites; tags are immutable; deploy by digest.",
                "<strong>Provenance</strong>: build-info or SLSA provenance travels with the artifact: commit, builder, dependencies, scan results.",
                "<strong>Promotion gates</strong>: only artifacts with passing scans and a valid signature are eligible."
              ] },
              { t: "quiz", id: "pipe-build" },
              { t: "note", variant: "key", html: "<strong>One build, one digest, many environments.</strong> Promotion moves evidence-carrying immutable artifacts forward; rebuilding throws the evidence away." }
            ]
          }
        ]
      },
      {
        id: "deploy",
        name: "Deployment Strategy & GitOps",
        icon: "globe",
        lessons: [
          {
            id: "gitops",
            title: "GitOps with Argo CD and Flux",
            summary: "Git as the source of truth, an in-cluster agent that pulls, and no cluster credentials in CI.",
            minutes: 9,
            tags: ["practitioner", "gitops", "argo-cd", "flux"],
            blocks: [
              { t: "p", html: "GitOps declares the desired state of every environment in Git and lets an agent <strong>inside the cluster</strong> continuously reconcile reality to it. Deploying becomes a reviewed commit; rollback becomes a revert." },
              { t: "diagram", id: "gitops-flow", caption: "CI builds and bumps a tag; the cluster pulls. CI never talks to the Kubernetes API." },
              { t: "table", headers: ["", "Argo CD", "Flux"], rows: [
                ["Core object", "Application (and ApplicationSet)", "Kustomization, HelmRelease"],
                ["UI", "Rich web UI with diff and sync", "CLI-first, UIs available separately"],
                ["Sync", "Auto-sync with prune and self-heal options", "Continuous reconciliation by interval"],
                ["Multi-cluster", "One Argo CD managing many clusters", "Agent per cluster"]
              ] },
              { t: "code", lang: "yaml", code:
                "apiVersion: argoproj.io/v1alpha1\n" +
                "kind: Application\n" +
                "metadata:\n" +
                "  name: payments-api-prod\n" +
                "  namespace: argocd\n" +
                "spec:\n" +
                "  project: payments\n" +
                "  source:\n" +
                "    repoURL: <CONFIG_REPO_URL>\n" +
                "    path: envs/prod/payments-api\n" +
                "    targetRevision: main\n" +
                "  destination:\n" +
                "    name: in-cluster\n" +
                "    namespace: payments\n" +
                "  syncPolicy:\n" +
                "    automated: { prune: true, selfHeal: true }"
              },
              { t: "p", html: "This module is about <em>how</em> a release reaches users — pull-based delivery, rollout strategy and infrastructure as code. <em>What</em> you deploy is covered in the Containers track: <a href='#/ctr/docker/image-hygiene'>hardened images</a>, <a href='#/ctr/k8s/k8s-workloads'>Kubernetes workloads, Helm and Kustomize</a>, <a href='#/ctr/k8s/k8s-pod-security'>Pod Security Standards</a> and <a href='#/ctr/posture/policy-as-code'>admission control</a>." },
              { t: "note", variant: "tip", html: "Separate the <em>application</em> repo from the <em>config</em> repo. CI opens a PR to the config repo bumping the image digest; production changes then get their own review and protection rules." },
              { t: "note", variant: "key", html: "<strong>Push credentials are a liability; pull is the safer default.</strong> GitOps removes cluster credentials from CI and turns every deploy into an auditable commit." }
            ]
          },
          {
            id: "feature-flags",
            title: "Feature flags: lifecycle, kill switches, permissions and cleanup",
            summary: "Separate deploy from release without creating a permanent shadow configuration system.",
            minutes: 10,
            tags: ["practitioner", "feature-flags", "kill-switch", "governance"],
            blocks: [
              { t: "p", html: "A feature flag lets code reach production while behavior remains off, limited to staff or exposed to a percentage of users. That makes rollback fast, but it also creates a second control plane capable of changing production without a deploy." },
              { t: "table", headers: ["Flag type", "Purpose", "Expected life"], rows: [
                ["Release", "Hide incomplete work, then ramp after validation", "Days or weeks; delete after full release"],
                ["Experiment", "Compare variants against a stated metric", "Until sample and decision are complete"],
                ["Operational kill switch", "Disable a risky dependency or behavior during an incident", "Long-lived, tested regularly"],
                ["Permission / entitlement", "Decide who bought or may use a capability", "Not a release flag; treat as authorization code"]
              ] },
              { t: "ol", items: [
                "<strong>Create</strong> with owner, purpose, safe default, expiry and rollback behavior.",
                "<strong>Approve</strong> production changes through least-privileged roles; audit every toggle.",
                "<strong>Observe</strong> exposure, errors, latency and security signals by variant.",
                "<strong>Conclude</strong> the release or experiment, then remove dead branches and the flag.",
                "<strong>Exercise</strong> kill switches so an incident is not the first time anyone tries one."
              ] },
              { t: "note", variant: "warn", html: "A client-side flag is not authorization. Users can modify it. Enforce entitlements and sensitive actions on the server even when the UI is hidden." },
              { t: "note", variant: "key", html: "<strong>Every temporary flag has an owner and deletion date; every permanent kill switch has a test.</strong> Otherwise progressive delivery becomes permanent complexity." }
            ]
          },
          {
            id: "experiments-progressive",
            title: "Progressive delivery, canary experiments and observability",
            summary: "Ramp exposure using guardrails, compare cohorts honestly and stop automatically when safety signals regress.",
            minutes: 10,
            tags: ["advanced", "progressive-delivery", "canary", "experimentation", "observability"],
            blocks: [
              { t: "p", html: "A canary answers <em>is this version safe?</em>; an experiment asks <em>which experience performs better?</em>. Both need stable assignment, a primary outcome, guardrail metrics and an explicit stop rule before traffic moves." },
              { t: "table", headers: ["Signal", "Canary decision", "Experiment decision"], rows: [
                ["Error rate / latency", "Abort on regression", "Guardrail: neither variant may harm reliability"],
                ["Authorization failures / fraud", "Abort and investigate", "Security guardrail, never traded for conversion"],
                ["Business outcome", "Usually observe only", "Primary metric with sample-size target"],
                ["Cohort consistency", "Same users stay on canary where needed", "Stable assignment prevents crossover bias"]
              ] },
              { t: "p", html: "Automated analysis should compare canary and baseline over the same window, require enough traffic, and fail closed when telemetry is missing. Record the flag revision and artifact digest on dashboards so every change in behavior maps to code and configuration." },
              { t: "ul", items: [
                "Start with staff or a tiny cohort, then ramp through declared steps.",
                "Use a kill switch independent of the broken dependency it disables.",
                "Protect production flag changes with SSO, scoped roles and approval for high-impact flags.",
                "After the decision, delete the losing branch and close the experiment; stale variants make incidents harder to reason about."
              ] },
              { t: "note", variant: "key", html: "<strong>Progressive delivery is a feedback controller.</strong> Exposure rises only while trustworthy telemetry says the change remains inside its reliability, security and business guardrails." }
            ]
          },
          {
            id: "strategies",
            title: "Rolling, blue/green and canary deployments; rollback",
            summary: "Choose a rollout strategy by blast radius, cost and how fast you can undo.",
            minutes: 9,
            tags: ["practitioner", "rolling", "blue-green", "canary", "rollback"],
            blocks: [
              { t: "table", headers: ["Strategy", "How", "Rollback", "Cost"], rows: [
                ["Recreate", "Stop old, start new", "Redeploy old version", "Lowest; has downtime"],
                ["Rolling", "Replace pods in batches (maxSurge / maxUnavailable)", "Roll back batch by batch", "Small surge capacity"],
                ["Blue/green", "Full new environment, switch traffic at once", "Switch back in seconds", "Double capacity during cutover"],
                ["Canary", "Send a small % of traffic to the new version, analyse, increase", "Drop canary weight to zero", "Needs traffic splitting and metrics"]
              ] },
              { t: "widget", id: "pipeRollout" },
              { t: "h", text: "Automated canary analysis" },
              { t: "p", html: "Tools such as Argo Rollouts and Flagger step canary weight (for example 5%, 25%, 50%, 100%) and query metrics — error rate, latency, and security signals such as a spike in authorization failures — between steps. A failed analysis aborts and routes all traffic back." },
              { t: "note", variant: "tip", html: "Feature flags decouple <em>deploy</em> from <em>release</em>. Ship dark, then enable per tenant. Flag changes need the same audit trail as deploys." },
              { t: "note", variant: "key", html: "<strong>Rollout strategy is a blast-radius decision.</strong> Canary limits who is hurt, blue/green limits how long — pick by which of those your service can least afford." }
            ]
          },
          {
            id: "terraform",
            title: "Terraform, environment promotion and drift",
            summary: "Infrastructure as code with safe state, reviewed plans and promotion across environments.",
            minutes: 10,
            tags: ["advanced", "terraform", "iac", "promotion", "drift"],
            blocks: [
              { t: "p", html: "Terraform declares infrastructure in HCL, computes a <strong>plan</strong> (the diff between code and reality) and <strong>applies</strong> it. The <strong>state file</strong> maps code to real resources." },
              { t: "code", lang: "hcl", code:
                "terraform {\n" +
                "  backend \"s3\" {                     # remote, encrypted, locked state\n" +
                "    bucket       = \"tfstate-payments\"\n" +
                "    key          = \"prod/network.tfstate\"\n" +
                "    region       = \"us-east-1\"\n" +
                "    encrypt      = true\n" +
                "    use_lockfile = true\n" +
                "  }\n" +
                "}\n\n" +
                "module \"service\" {\n" +
                "  source      = \"git::<MODULES_REPO_URL>//ecs-service?ref=v4.1.0\"   # pinned module\n" +
                "  environment = var.environment\n" +
                "}"
              },
              { t: "h", text: "A safe Terraform pipeline" },
              { t: "ol", items: [
                "<code class='tok'>terraform fmt -check</code> and <code class='tok'>terraform validate</code>.",
                "IaC scan (Checkov, tfsec, KICS, or Wiz CLI) on the code.",
                "<code class='tok'>terraform plan -out=tfplan</code>, then scan the plan JSON too — it shows computed values code scanning cannot.",
                "Human approval of the plan for production.",
                "<code class='tok'>terraform apply tfplan</code> — apply exactly what was approved.",
                "Scheduled drift detection: a plan that shows changes nobody committed is an alert."
              ] },
              { t: "h", text: "Promoting across environments" },
              { t: "table", headers: ["Pattern", "How", "Watch out for"], rows: [
                ["Directory per environment", "envs/dev, envs/staging, envs/prod calling the same pinned modules", "Copy-paste drift between directories"],
                ["Workspaces", "One config, workspace per environment", "Easy to apply to the wrong workspace"],
                ["Module version promotion", "Bump module ref in dev, then staging, then prod", "Requires disciplined module releases"]
              ] },
              { t: "note", variant: "warn", html: "Mark secret variables <code class='tok'>sensitive = true</code> and prefer fetching them at apply time from a secrets manager. State can still contain secret values, which is why state access must be tightly restricted." },
              { t: "quiz", id: "pipe-deploy" },
              { t: "note", variant: "key", html: "<strong>Plan is the change request; apply the plan you approved.</strong> Remote locked state, pinned modules, scanned plans and drift detection make infrastructure as reviewable as code." }
            ]
          }
        ]
      }
    ]
  };
})();
