/* =====================================================================
   NIMBUS · Infrastructure as Code
   window.TRACKS.iac — modules: tf-core / tf-scale / native

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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

  /* A toggle button: .primary while on, .ghost while off. */
  function toggle(label, initial, onChange) {
    var on = !!initial;
    var b = h("button", { type: "button", class: "w-btn " + (on ? "primary" : "ghost"), "aria-pressed": on ? "true" : "false" }, label);
    b.addEventListener("click", function () {
      on = !on;
      b.className = "w-btn " + (on ? "primary" : "ghost");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      onChange(on);
    });
    return b;
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  var SYM = { create: "+", update: "~", replace: "-/+", destroy: "-", move: "\u2192", noop: "\u00b7" };
  var SYM_COLOR = { create: "var(--lime-ink)", update: "var(--amber-ink)", replace: "var(--rose-ink)", destroy: "var(--rose-ink)", move: "var(--cyan-ink)", noop: "var(--text-dim)" };

  function planLine(action, address, note) {
    return h("div", {
      style: "display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--line);font-family:var(--font-mono);font-size:0.82rem"
    },
      h("b", { style: "color:" + SYM_COLOR[action] }, SYM[action]),
      h("span", { style: "color:var(--text)" }, address, note ? h("span", { style: "color:var(--text-dim)" }, "  " + note) : null));
  }

  var Widgets = {};

  /* ==================================================================
     1. iacPlanSim — what would `terraform plan` print?
     Deterministic rules mirroring how the AWS provider treats each
     argument: instance_type updates in place, ami forces replacement,
     a renamed resource address is destroy + create unless a moved block
     tells Terraform it is the same object.
  ================================================================== */
  Widgets.iacPlanSim = function (mount) {
    shell(mount, "simulator", "Predict the terraform plan",
      "Toggle edits to the configuration and changes someone made directly in the web console; the plan below is what Terraform would propose to make reality match your code.");

    var f = {
      versioning: false, bucketName: false, instanceType: false, ami: false,
      renameRole: false, moved: false, addSubnet: false, removeQueue: false,
      driftTags: false, driftVersioning: false
    };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function compute() {
      var lines = [];
      // bucket
      if (f.bucketName) lines.push(["replace", "aws_s3_bucket.logs", "bucket name forces replacement (data must be copied first)"]);
      else if (f.versioning || f.driftVersioning) lines.push(["update", "aws_s3_bucket_versioning.logs", f.versioning ? "status Suspended \u2192 Enabled" : "console suspended it; plan restores Enabled"]);
      else lines.push(["noop", "aws_s3_bucket.logs", "no changes"]);
      // instance
      if (f.ami) lines.push(["replace", "aws_instance.web", "ami forces replacement"]);
      else if (f.instanceType || f.driftTags) {
        var why = [];
        if (f.instanceType) why.push("instance_type t3.small \u2192 t3.medium (stop/start)");
        if (f.driftTags) why.push("tags edited in console; plan reverts them");
        lines.push(["update", "aws_instance.web", why.join("; ")]);
      } else lines.push(["noop", "aws_instance.web", "no changes"]);
      // role rename
      if (f.renameRole && f.moved) lines.push(["move", "aws_iam_role.app \u2192 aws_iam_role.application", "moved block: same object, new address"]);
      else if (f.renameRole) {
        lines.push(["destroy", "aws_iam_role.app", "address no longer in config"]);
        lines.push(["create", "aws_iam_role.application", "new address, new role"]);
      } else lines.push(["noop", "aws_iam_role.app", "no changes"]);
      // for_each add
      if (f.addSubnet) lines.push(["create", 'aws_subnet.private["c"]', "new key in the for_each map"]);
      // removal
      if (f.removeQueue) lines.push(["destroy", "aws_sqs_queue.legacy", "block deleted from config"]);
      else lines.push(["noop", "aws_sqs_queue.legacy", "no changes"]);
      return lines;
    }

    function paint() {
      var lines = compute();
      var add = 0, change = 0, destroy = 0, moves = 0;
      clear(stage);
      for (var i = 0; i < lines.length; i++) {
        var a = lines[i][0];
        if (a === "create") add++;
        else if (a === "update") change++;
        else if (a === "destroy") destroy++;
        else if (a === "replace") { add++; destroy++; }
        else if (a === "move") moves++;
        stage.appendChild(planLine(a, lines[i][1], lines[i][2]));
      }
      var drift = f.driftTags || f.driftVersioning;
      clear(readout);
      readout.appendChild(ro("Plan:", add + " to add, " + change + " to change, " + destroy + " to destroy"));
      readout.appendChild(ro("moves", moves));
      readout.appendChild(ro("drift present", drift ? "yes \u2014 apply reverts console edits" : "no"));
      readout.appendChild(ro("risk", destroy ? "review every destroy before apply" : (add + change ? "routine" : "nothing to do")));
    }

    function set(k) { return function (v) { f[k] = v; paint(); }; }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-size:0.78rem;color:var(--text-dim);align-self:center" }, "Config edits:"),
      toggle("Enable versioning", false, set("versioning")),
      toggle("Rename bucket", false, set("bucketName")),
      toggle("Bigger instance_type", false, set("instanceType")),
      toggle("New AMI", false, set("ami")),
      toggle("Rename role key", false, set("renameRole")),
      toggle("Add moved block", false, set("moved")),
      toggle("Add subnet \"c\"", false, set("addSubnet")),
      toggle("Delete queue block", false, set("removeQueue"))));
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-size:0.78rem;color:var(--text-dim);align-self:center" }, "Console drift:"),
      toggle("Tags edited by hand", false, set("driftTags")),
      toggle("Versioning suspended by hand", false, set("driftVersioning"))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. iacCountVsForEach — removing one item from the middle
  ================================================================== */
  Widgets.iacCountVsForEach = function (mount) {
    shell(mount, "compare", "count vs for_each: delete one subnet",
      "Four subnets come from a list. Remove the second one and compare what each meta-argument does to the others.");

    var SUBNETS = [["a", "10.0.0.0/24"], ["b", "10.0.1.0/24"], ["c", "10.0.2.0/24"], ["d", "10.0.3.0/24"]];
    var mode = "count";
    var removed = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      clear(stage);
      var add = 0, destroy = 0, i;
      var list = removed ? [SUBNETS[0], SUBNETS[2], SUBNETS[3]] : SUBNETS.slice();
      if (mode === "count") {
        for (i = 0; i < SUBNETS.length; i++) {
          var addr = "aws_subnet.private[" + i + "]";
          if (!removed) { stage.appendChild(planLine("noop", addr, SUBNETS[i][1])); continue; }
          if (i === 0) stage.appendChild(planLine("noop", addr, SUBNETS[0][1]));
          else if (i < list.length) {
            stage.appendChild(planLine("replace", addr, SUBNETS[i][1] + " \u2192 " + list[i][1] + " (cidr_block forces replacement)"));
            add++; destroy++;
          } else { stage.appendChild(planLine("destroy", addr, SUBNETS[i][1] + " (index no longer exists)")); destroy++; }
        }
      } else {
        for (i = 0; i < SUBNETS.length; i++) {
          var key = 'aws_subnet.private["' + SUBNETS[i][0] + '"]';
          if (removed && i === 1) { stage.appendChild(planLine("destroy", key, SUBNETS[i][1] + " (key removed)")); destroy++; }
          else stage.appendChild(planLine("noop", key, SUBNETS[i][1]));
        }
      }
      clear(readout);
      readout.appendChild(ro("meta-argument", mode));
      readout.appendChild(ro("Plan:", add + " to add, 0 to change, " + destroy + " to destroy"));
      readout.appendChild(ro("collateral", removed ? (mode === "count" ? "2 healthy subnets rebuilt" : "none") : "\u2014"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["count", "count = length(var.subnets)"], ["for_each", "for_each = var.subnets"]], 0, function (v) { mode = v; paint(); }),
      toggle("Remove subnet \"b\"", false, function (v) { removed = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "iac-tf-core": {
      title: "Terraform core checkpoint",
      sub: "Declarative IaC, the workflow, providers and the language.",
      questions: [
        {
          q: "What does `terraform plan` compare to decide what to change?",
          options: ["Only the configuration files against the provider documentation", "The configuration, the recorded state, and the real infrastructure as refreshed from the provider APIs", "The Git history of the configuration", "Only the state file against the configuration, never the cloud"],
          answer: 1,
          explain: "Plan refreshes real resources through the provider, compares them with state, and diffs both against the configuration. That is why plan can show changes even when nobody touched the code: reality drifted. It is also why plan needs read credentials."
        },
        {
          q: "Why commit `.terraform.lock.hcl` to version control?",
          options: ["It holds the state", "It records the exact provider versions and checksums selected, so every run and teammate gets the same provider build", "It stores secrets for the backend", "Terraform refuses to run without it in Git"],
          answer: 1,
          explain: "The dependency lock file pins the provider versions chosen within your version constraints, plus their hashes. Committing it makes CI and laptops use identical provider builds; you upgrade deliberately with `terraform init -upgrade`."
        },
        {
          q: "You change an EC2 instance's `ami` argument in Terraform. What does the plan typically show?",
          options: ["An in-place update with no downtime", "A replacement: destroy and create (or create before destroy if configured)", "Nothing, AMI changes are ignored", "An error, the AMI cannot change"],
          answer: 1,
          explain: "The AWS provider marks `ami` as forcing a new resource, so the plan shows `-/+`. `instance_type`, by contrast, can usually update in place with a stop and start. Reading which arguments force replacement is a core plan-review skill."
        },
        {
          q: "A list of four subnets is created with `count`. You delete the second list element. What happens?",
          options: ["Only the second subnet is destroyed", "Indexes shift, so subnets after the removed one are replaced to take new CIDRs and the last index is destroyed", "Nothing changes until you run `terraform refresh`", "Terraform rejects the change"],
          answer: 1,
          explain: "With `count`, identity is the numeric index. Removing element 1 means index 1 now wants element 2's values, and so on, which forces replacements. With `for_each` over a map or set, identity is the key, so only the removed key is destroyed."
        },
        {
          q: "Which statement about declarative IaC is accurate?",
          options: ["You list the API calls to make in order", "You describe the desired end state and the tool computes the steps, including deletions", "It cannot delete resources", "It is the same as a shell script run in CI"],
          answer: 1,
          explain: "Declarative tools reconcile toward a described end state; the tool works out creates, updates and deletes. Imperative scripts encode the steps and so must handle every starting condition themselves, which is where they break."
        }
      ]
    },
    "iac-testing": {
      title: "Testing and policy checkpoint",
      sub: "The IaC testing layers, terraform test, checks and conditions, and OPA versus Sentinel.",
      questions: [
        {
          q: "What does `terraform validate` prove?",
          options: ["That the plan is safe to apply", "That the configuration is syntactically valid and internally consistent, without contacting any cloud API", "That the cloud resources exist", "That policies pass"],
          answer: 1,
          explain: "Validate checks syntax, types and references only. It is the cheapest gate, but it cannot catch a wrong CIDR or a public bucket. Linting, unit tests with terraform test, policy on the plan and integration tests cover progressively more."
        },
        {
          q: "A module test should check that a bucket name is built correctly without creating anything in AWS. Which approach fits?",
          options: ["A `run` block with `command = plan` in a .tftest.hcl file, optionally with a mocked provider", "Running apply in production", "terraform fmt", "A Sentinel policy"],
          answer: 0,
          explain: "terraform test executes run blocks; with command = plan the assertions run against planned values and nothing is created. Mock providers (Terraform 1.7 and later) let tests run without credentials. Use command = apply in a sandbox account for integration tests."
        },
        {
          q: "What is the difference between a `precondition` and a `check` block?",
          options: ["They are identical", "A precondition fails the plan or apply when its condition is false; a check block reports a warning without blocking, which suits ongoing health assertions", "Checks run only in HCP Terraform", "Preconditions only apply to variables"],
          answer: 1,
          explain: "Preconditions and postconditions are guarantees attached to a resource, data source or output and stop the run. Check blocks (Terraform 1.5 and later) express assertions such as 'the health endpoint returns 200' that surface as warnings each run."
        },
        {
          q: "A team uses open-source Terraform in GitHub Actions and wants organization-wide policy on plans. Which tool is the natural fit?",
          options: ["Sentinel", "OPA with Conftest evaluating the plan JSON in the pipeline", "terraform validate", "AWS Config"],
          answer: 1,
          explain: "Sentinel runs inside HCP Terraform and Terraform Enterprise. OPA is open source and runs anywhere: export the plan with terraform show -json and evaluate Rego policies with Conftest. HCP Terraform also supports OPA policy sets."
        }
      ]
    },
    "iac-tf-scale": {
      title: "Terraform at scale checkpoint",
      sub: "State, modules, environments, drift and pipelines.",
      questions: [
        {
          q: "Why must Terraform state be treated as sensitive?",
          options: ["It is binary and cannot be read", "It can contain resource attributes in plain text, including generated passwords and keys, even when outputs are marked sensitive", "It is uploaded to the provider", "It contains your Git credentials"],
          answer: 1,
          explain: "`sensitive = true` only hides values in CLI output; the state file still stores them. Encrypt the backend, restrict who can read it, and prefer designs where secrets are generated and held by a secrets manager rather than passed through Terraform."
        },
        {
          q: "You renamed `aws_iam_role.app` to `aws_iam_role.application` in code. How do you avoid destroying and recreating the role?",
          options: ["Run apply twice", "Add a `moved` block from the old address to the new one (or use `terraform state mv`)", "Delete the state file", "Use `-refresh-only`"],
          answer: 1,
          explain: "Terraform tracks objects by address. A `moved { from = ..., to = ... }` block records that the object at the old address is the same one at the new address, so plan shows a move with no infrastructure change. It is reviewable in a pull request, unlike an ad hoc state command."
        },
        {
          q: "A nightly `terraform plan` on an unchanged main branch shows an in-place update to a security group. What is the most likely explanation?",
          options: ["Terraform is non-deterministic", "Drift: someone or something changed the resource outside Terraform", "The lock file expired", "The module registry is down"],
          answer: 1,
          explain: "With no code change, a diff means reality no longer matches state and config. Decide whether to revert it (apply), adopt it (change code, or accept with `-refresh-only`), and then fix the access path that allowed the console change."
        },
        {
          q: "What is the safest way for a CI pipeline to authenticate Terraform to AWS?",
          options: ["Long-lived access keys stored as pipeline variables", "OIDC federation: the CI job exchanges its signed identity token for short-lived credentials on a narrowly trusted role", "The root user's keys, rotated monthly", "Keys embedded in the provider block"],
          answer: 1,
          explain: "OIDC federation removes static keys entirely. Scope the role's trust policy to the specific repository and branch or environment, and split plan (read-mostly) from apply (write) roles so a pull request cannot apply."
        },
        {
          q: "When is a Terraform module the wrong abstraction?",
          options: ["When it wraps a single resource and merely re-exposes every argument as a variable", "When it has outputs", "When it is versioned", "When it is used by more than one team"],
          answer: 0,
          explain: "A pass-through wrapper adds a layer to debug and version while encoding no decision. Good modules capture an opinion, such as a VPC with your tiering and flow logs on, and expose only the inputs that should vary."
        }
      ]
    },
    "iac-native": {
      title: "Native IaC tools checkpoint",
      sub: "CloudFormation, CDK, Bicep, Google Cloud options and choosing a tool.",
      questions: [
        {
          q: "What is a CloudFormation change set for?",
          options: ["Rolling back a stack", "Previewing exactly which resources a stack update will add, modify or replace before executing it", "Deploying to many accounts", "Detecting drift"],
          answer: 1,
          explain: "A change set is CloudFormation's plan: you create it, review the proposed actions including replacements, and execute it only if you agree. StackSets handle multi-account and multi-region rollout; drift detection is a separate operation."
        },
        {
          q: "What does the AWS CDK produce when you run `cdk synth`?",
          options: ["Terraform HCL", "A CloudFormation template (plus assets) that CloudFormation then deploys", "Direct API calls with no template", "A Bicep file"],
          answer: 1,
          explain: "CDK is a programming-language front end. It synthesizes CloudFormation templates, so deployments still get CloudFormation's change sets, rollback and drift features, and its limits too."
        },
        {
          q: "Which command previews a Bicep deployment to a resource group without changing anything?",
          options: ["az deployment group what-if", "az bicep build --apply", "az group export", "terraform plan"],
          answer: 0,
          explain: "`what-if` evaluates the template against current Azure state and lists creates, modifications and deletes. It is the Azure counterpart of a Terraform plan or a CloudFormation change set."
        },
        {
          q: "A platform team manages AWS, Azure and a SaaS DNS provider, and wants one review workflow. What is the strongest default?",
          options: ["CloudFormation for everything", "Terraform (or OpenTofu) with shared modules, remote state and a plan-on-PR pipeline", "A separate native tool per provider with no shared workflow", "Manual console changes with screenshots"],
          answer: 1,
          explain: "A provider-agnostic tool gives one language, one plan format and one pipeline across clouds and SaaS. Native tools stay attractive inside one cloud, for example for features that appear there first, but they fragment review across providers."
        },
        {
          q: "What does an Azure deployment stack add over a plain Bicep deployment?",
          options: ["It converts Bicep to Terraform", "It tracks the resources a deployment manages as a unit, can delete resources that were removed from the template, and can deny out-of-band changes", "It is required for what-if", "It replaces resource groups"],
          answer: 1,
          explain: "Plain incremental deployments leave removed resources behind. A deployment stack manages its resources as a set, with action-on-unmanage settings and optional deny assignments, which gives Bicep a lifecycle closer to Terraform state."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.iac = {
    id: "iac",
    name: "Infrastructure as Code",
    short: "IAC",
    tagline: "Terraform in depth, then the native tools",
    color: "#22d3ee",
    blurb: "Describe infrastructure as reviewed, versioned code. Terraform from the workflow and language through state, modules, drift and CI with OIDC, then CloudFormation and CDK, Azure Bicep, the Google Cloud options, and how to choose.",
    modules: [
      {
        id: "tf-core",
        name: "Terraform Core",
        icon: "blocks",
        lessons: [
          {
            id: "why-iac",
            title: "Why infrastructure as code: declarative beats click-ops",
            summary: "What changes when infrastructure is a reviewed text file, and the difference between declaring an end state and scripting steps.",
            minutes: 8,
            tags: ["iac", "declarative", "terraform"],
            blocks: [
              { t: "p", html: "Every console click is an undocumented, unreviewed, unrepeatable change. <strong>Infrastructure as code (IaC)</strong> moves those changes into text files that go through the same pull request, review and history as application code. The payoff is not typing speed. It is that the second, third and fiftieth environment are identical, and that you can answer <em>who changed this and why</em> from Git." },
              { t: "h", text: "Declarative versus imperative" },
              { t: "compare",
                bad: { title: "Imperative script", items: [
                  "<code class='tok'>aws ec2 create-security-group ...</code> then <code class='tok'>authorize-ingress ...</code>",
                  "Must handle 'already exists', partial failure and ordering itself",
                  "Deleting something means writing a separate teardown script",
                  "Running it twice is often an error"
                ] },
                good: { title: "Declarative configuration", items: [
                  "Describe the end state: this group, with these rules",
                  "The tool computes create, update or delete from current state",
                  "Removing a block from the file proposes a delete",
                  "Running it twice converges to no changes"
                ] }
              },
              { t: "h", text: "The tool landscape" },
              { t: "table", headers: ["Tool", "Scope", "Language", "State"], rows: [
                ["Terraform / OpenTofu", "Any provider: AWS, Azure, Google Cloud, SaaS", "HCL", "State file in a backend you choose"],
                ["AWS CloudFormation", "AWS only", "JSON / YAML", "Managed by the service (stacks)"],
                ["AWS CDK", "AWS (synthesizes CloudFormation)", "TypeScript, Python, Java, C#, Go", "CloudFormation stacks"],
                ["Azure Bicep / ARM", "Azure only", "Bicep (compiles to ARM JSON)", "Azure deployment history; deployment stacks for lifecycle"],
                ["Google Cloud Infrastructure Manager", "Google Cloud", "Terraform HCL, run as a managed service", "Managed Terraform state"],
                ["Pulumi", "Many providers", "General-purpose languages", "Pulumi service or self-managed backend"]
              ] },
              { t: "note", variant: "tip", html: "OpenTofu is a community fork of Terraform that stays largely compatible with it. Everything in this track applies to both unless a lesson says otherwise." },
              { t: "h", text: "What you give up" },
              { t: "ul", items: [
                "<strong>Speed for one-offs.</strong> A five-second console fix becomes a pull request. That friction is the point for production, and a cost for experiments, so keep sandbox accounts for exploring.",
                "<strong>A second source of truth to guard.</strong> If people can still click in production, code and reality drift apart. IaC only pays off when write access outside the pipeline is the exception.",
                "<strong>A learning curve.</strong> Plans, state and provider quirks are real skills, which is what the rest of this track is for."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'environments drift apart', 'nobody knows who opened that port', 'we need the same stack in three regions'. Each is an IaC answer: one reviewed definition, applied many times." },
              { t: "note", variant: "key", html: "<strong>Describe the end state, review the diff, let the tool do the steps.</strong> IaC is valuable because changes become reviewable and repeatable, not because they become faster." }
            ]
          },
          {
            id: "tf-workflow",
            title: "The Terraform workflow, providers and version pinning",
            summary: "init, plan, apply and destroy; what each touches; and how to pin Terraform and provider versions so builds are reproducible.",
            minutes: 10,
            tags: ["terraform", "plan", "apply", "providers"],
            blocks: [
              { t: "p", html: "Terraform runs in a loop you will repeat thousands of times: write configuration, <code class='tok'>init</code>, <code class='tok'>plan</code>, review, <code class='tok'>apply</code>. The skill is not typing the commands; it is reading the plan well enough to catch the destroy you did not intend." },
              { t: "diagram", id: "tf-workflow", caption: "Plan reads configuration, state and reality; apply changes reality and records the result in locked remote state." },
              { t: "table", headers: ["Command", "What it does", "Touches the cloud?"], rows: [
                ["<code class='tok'>terraform init</code>", "Downloads providers and modules, configures the backend, writes the lock file", "Backend only"],
                ["<code class='tok'>terraform fmt</code> / <code class='tok'>validate</code>", "Formats files; checks syntax and internal consistency", "No"],
                ["<code class='tok'>terraform plan -out=tfplan</code>", "Refreshes real resources, diffs against config, saves the proposed actions", "Read"],
                ["<code class='tok'>terraform apply tfplan</code>", "Executes exactly the saved plan and updates state", "Write"],
                ["<code class='tok'>terraform destroy</code>", "Plans and applies deletion of everything in this state", "Write"]
              ] },
              { t: "h", text: "Reading plan symbols" },
              { t: "ul", items: [
                "<code class='tok'>+</code> create &middot; <code class='tok'>~</code> update in place &middot; <code class='tok'>-</code> destroy",
                "<code class='tok'>-/+</code> destroy then create (replacement) &mdash; the provider marked an argument as unchangeable in place, such as an EC2 <code class='tok'>ami</code> or an S3 bucket name",
                "<code class='tok'>+/-</code> create then destroy, when the resource sets <code class='tok'>create_before_destroy</code>"
              ] },
              { t: "widget", id: "iacPlanSim" },
              { t: "h", text: "Pin versions, deliberately" },
              { t: "code", lang: "text", code:
                "terraform {\n" +
                "  required_version = \"~> 1.9\"\n\n" +
                "  required_providers {\n" +
                "    aws = {\n" +
                "      source  = \"hashicorp/aws\"\n" +
                "      version = \"~> 5.60\"   # any 5.x at or above 5.60\n" +
                "    }\n" +
                "  }\n" +
                "}\n\n" +
                "provider \"aws\" {\n" +
                "  region = var.region\n" +
                "  # no credentials here: they come from the environment (OIDC role, SSO profile)\n" +
                "  default_tags {\n" +
                "    tags = { owner = \"payments\", managed_by = \"terraform\" }\n" +
                "  }\n" +
                "}"
              },
              { t: "p", html: "Constraints say what is <em>allowed</em>; <code class='tok'>.terraform.lock.hcl</code> records what was <em>chosen</em>, with checksums. Commit the lock file so CI and every laptop use identical provider builds, and upgrade on purpose with <code class='tok'>terraform init -upgrade</code> in its own pull request." },
              { t: "note", variant: "warn", html: "Never put access keys in a <code class='tok'>provider</code> block. They end up in Git history. The provider reads credentials from its environment: an assumed role in CI, an SSO profile on a laptop." },
              { t: "h", text: "Azure and Google Cloud providers" },
              { t: "table", headers: ["Provider", "Source", "Typical auth in CI"], rows: [
                ["AWS", "<code class='tok'>hashicorp/aws</code>", "OIDC to an IAM role"],
                ["Azure", "<code class='tok'>hashicorp/azurerm</code>", "OIDC to an Entra app registration or managed identity (federated credential)"],
                ["Google Cloud", "<code class='tok'>hashicorp/google</code>", "Workload Identity Federation to a service account"]
              ] },
              { t: "note", variant: "key", html: "<strong>Save the plan, review the plan, apply the plan.</strong> Applying a saved plan file guarantees that what ran is exactly what was reviewed, and a lock file guarantees which provider ran it." }
            ]
          },
          {
            id: "tf-language",
            title: "The language: resources, data, variables, count and for_each",
            summary: "The handful of constructs that make up almost every configuration, and why for_each is usually the right way to make many of something.",
            minutes: 11,
            tags: ["hcl", "variables", "for_each", "count"],
            blocks: [
              { t: "p", html: "Terraform's language is small. Learn six constructs and you can read nearly any configuration; learn one subtle rule about identity and you will avoid the most common accidental rebuild." },
              { t: "table", headers: ["Construct", "Purpose", "Example"], rows: [
                ["<code class='tok'>resource</code>", "Something Terraform creates and owns", "<code class='tok'>aws_s3_bucket</code>, <code class='tok'>azurerm_storage_account</code>"],
                ["<code class='tok'>data</code>", "Read something that exists but you do not own", "Latest AMI, an existing VPC, current account id"],
                ["<code class='tok'>variable</code>", "Input to this configuration or module", "region, CIDR, instance size"],
                ["<code class='tok'>locals</code>", "Named expressions to avoid repetition", "common tags, name prefixes"],
                ["<code class='tok'>output</code>", "Values exported to callers or other stacks", "VPC id, role ARN"],
                ["<code class='tok'>module</code>", "Call a reusable set of resources", "a standard VPC module"]
              ] },
              { t: "code", lang: "text", code:
                "variable \"subnets\" {\n" +
                "  type = map(string)            # key => CIDR\n" +
                "  default = {\n" +
                "    a = \"10.0.0.0/24\"\n" +
                "    b = \"10.0.1.0/24\"\n" +
                "  }\n" +
                "}\n\n" +
                "data \"aws_availability_zones\" \"available\" { state = \"available\" }\n\n" +
                "locals {\n" +
                "  name = \"payments-${var.env}\"\n" +
                "}\n\n" +
                "resource \"aws_subnet\" \"private\" {\n" +
                "  for_each          = var.subnets\n" +
                "  vpc_id            = aws_vpc.main.id\n" +
                "  cidr_block        = each.value\n" +
                "  availability_zone = data.aws_availability_zones.available.names[index(keys(var.subnets), each.key)]\n" +
                "  tags              = { Name = \"${local.name}-private-${each.key}\" }\n" +
                "}\n\n" +
                "output \"private_subnet_ids\" {\n" +
                "  value = { for k, s in aws_subnet.private : k => s.id }\n" +
                "}"
              },
              { t: "h", text: "Identity: index versus key" },
              { t: "p", html: "Terraform remembers each object by its <strong>address</strong>. With <code class='tok'>count</code> the address ends in a number, <code class='tok'>[1]</code>; with <code class='tok'>for_each</code> it ends in a key, <code class='tok'>[\"b\"]</code>. Remove an item from the middle of a list and every later index now points at different values. Try it:" },
              { t: "widget", id: "iacCountVsForEach" },
              { t: "table", headers: ["Tier", "How you make N of something", "What breaks"], rows: [
                ["Naive", "Copy-paste the resource block N times", "Drift between copies; every change edited N times"],
                ["Solid", "<code class='tok'>count = length(var.list)</code>", "Removing a middle item replaces everything after it"],
                ["Standout", "<code class='tok'>for_each</code> over a map or set with stable keys; <code class='tok'>count</code> only for 0-or-1 toggles", "Nothing unexpected: only the changed key moves"]
              ] },
              { t: "note", variant: "trap", html: "<code class='tok'>for_each</code> keys must be known at plan time. Keying on an attribute that only exists after apply, such as a generated id, fails with 'value cannot be determined until apply'. Key on names you choose." },
              { t: "note", variant: "tip", html: "Mark inputs and outputs that carry secrets with <code class='tok'>sensitive = true</code> so they are redacted in plan output. Remember that this does not remove them from state." },
              { t: "quiz", id: "iac-tf-core" },
              { t: "note", variant: "key", html: "<strong>Give every object a stable name.</strong> for_each with chosen keys means deleting one thing deletes one thing; count over a list means deleting one thing may rebuild several." }
            ]
          }
        ]
      },
      {
        id: "tf-scale",
        name: "Terraform at Scale",
        icon: "database",
        lessons: [
          {
            id: "state",
            title: "State: what it holds, where it lives, how to move it",
            summary: "Why state exists, why it is sensitive, remote backends with locking on each cloud, and the safe ways to refactor addresses.",
            minutes: 11,
            tags: ["state", "backend", "locking", "moved", "import"],
            blocks: [
              { t: "p", html: "<strong>State</strong> is Terraform's map from addresses in your code to real object ids in the cloud, plus the attributes it last saw. Without it Terraform could not tell 'this bucket is mine and should be updated' from 'this bucket should be created'." },
              { t: "h", text: "Three properties that drive every decision" },
              { t: "ul", items: [
                "<strong>It is shared.</strong> A team needs one copy, so it lives in a remote backend, not on a laptop.",
                "<strong>It must not be written concurrently.</strong> Two applies at once can corrupt it, so the backend must lock.",
                "<strong>It contains secrets.</strong> Generated passwords, private keys and connection strings appear in plain text, so encrypt it and restrict read access."
              ] },
              { t: "table", headers: ["Cloud", "Backend", "Locking", "Encryption"], rows: [
                ["AWS", "<code class='tok'>s3</code>", "S3-native lock file in recent Terraform versions (<code class='tok'>use_lockfile = true</code>); older setups use a DynamoDB table, which is being phased out", "SSE-KMS on the bucket; versioning on for recovery"],
                ["Azure", "<code class='tok'>azurerm</code> (Blob storage)", "Blob lease, automatic", "Storage service encryption; customer-managed key optional"],
                ["Google Cloud", "<code class='tok'>gcs</code>", "Automatic, via object generation preconditions", "Google-managed or Cloud KMS key"],
                ["Any", "HCP Terraform / other managed runners", "Built in", "Built in"]
              ] },
              { t: "code", lang: "text", code:
                "terraform {\n" +
                "  backend \"s3\" {\n" +
                "    bucket       = \"acme-tfstate-<ACCOUNT_ID>\"\n" +
                "    key          = \"payments/prod/network.tfstate\"\n" +
                "    region       = \"eu-west-1\"\n" +
                "    encrypt      = true\n" +
                "    kms_key_id   = \"alias/tfstate\"\n" +
                "    use_lockfile = true\n" +
                "  }\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "Split state by blast radius: network, data and app layers per environment in separate state files. One giant state means every plan is slow and every apply can touch everything." },
              { t: "h", text: "Refactoring without rebuilding" },
              { t: "table", headers: ["Need", "Reviewable in code", "Ad hoc command"], rows: [
                ["Rename or move a resource address", "<code class='tok'>moved { from = ..., to = ... }</code>", "<code class='tok'>terraform state mv</code>"],
                ["Adopt an existing resource", "<code class='tok'>import { to = ..., id = \"...\" }</code>", "<code class='tok'>terraform import</code>"],
                ["Stop managing without deleting", "<code class='tok'>removed { from = ... lifecycle { destroy = false } }</code>", "<code class='tok'>terraform state rm</code>"]
              ] },
              { t: "p", html: "Prefer the blocks. They go through a pull request, show up in plan, and run the same way in every environment; a state command typed on one laptop leaves no trace and has to be repeated by hand everywhere else." },
              { t: "note", variant: "trap", html: "Never hand-edit a state file. If you must repair state, pull a copy, keep the backend's versioned history, and use the state commands, so a mistake can be rolled back." },
              { t: "note", variant: "key", html: "<strong>Remote, locked, encrypted, split by blast radius.</strong> State is the most sensitive and most fragile file in an IaC estate; refactor it with moved and import blocks, never by hand." }
            ]
          },
          {
            id: "modules",
            title: "Modules that encode decisions",
            summary: "Module inputs and outputs, sourcing and versioning, composition, and the line between a useful module and a pointless wrapper.",
            minutes: 9,
            tags: ["modules", "versioning", "composition"],
            blocks: [
              { t: "p", html: "A <strong>module</strong> is any directory of Terraform files; the root module is just the one you run from. Child modules earn their place when they capture a decision your organization has made, such as how a VPC is tiered or how a bucket is locked down, so that every team gets it right by default." },
              { t: "code", lang: "text", code:
                "module \"network\" {\n" +
                "  source  = \"git::ssh://git@git.acme.example/platform/tf-aws-vpc.git?ref=v3.2.0\"\n" +
                "  name    = \"payments-prod\"\n" +
                "  cidr    = \"10.40.0.0/16\"\n" +
                "  azs     = 3\n" +
                "  tiers   = [\"public\", \"app\", \"data\"]\n" +
                "}\n\n" +
                "module \"api\" {\n" +
                "  source             = \"../modules/ecs-service\"\n" +
                "  subnet_ids         = module.network.app_subnet_ids\n" +
                "  security_group_ids = [module.network.app_sg_id]\n" +
                "}"
              },
              { t: "table", headers: ["Source", "Versioning", "Good for"], rows: [
                ["Local path", "Same commit as caller", "Modules private to one repository"],
                ["Git with <code class='tok'>?ref=</code> tag", "Tag per release", "Internal shared modules"],
                ["Public or private registry", "<code class='tok'>version = \"~> 3.2\"</code> constraints", "Widely shared modules, community modules after review"]
              ] },
              { t: "h", text: "Design rules that hold up" },
              { t: "ul", items: [
                "<strong>Opinionated defaults, few inputs.</strong> Encryption, logging and tagging on by default; expose only what legitimately varies.",
                "<strong>Outputs are the contract.</strong> Callers depend on output names; renaming one is a breaking change that deserves a major version.",
                "<strong>Compose, do not nest deeply.</strong> Wire small modules together in the root module; three layers of wrappers make every plan a treasure hunt.",
                "<strong>No providers inside shared modules.</strong> Let the caller pass provider configuration so a module can be used in any account or region."
              ] },
              { t: "compare",
                bad: { title: "Pass-through wrapper", items: [
                  "Wraps one resource and re-exposes all forty arguments",
                  "Encodes no decision",
                  "Lags behind every provider release"
                ] },
                good: { title: "Decision module", items: [
                  "'A private, encrypted, versioned bucket with access logging'",
                  "Five inputs, sensible outputs",
                  "Teams cannot accidentally make it public"
                ] }
              },
              { t: "note", variant: "tip", html: "Pin module versions in production callers and upgrade them with a pull request that shows the plan. An unpinned <code class='tok'>ref=main</code> means someone else's merge can change your production plan." },
              { t: "note", variant: "key", html: "<strong>A module is worth having when it removes a decision from every caller.</strong> Version it, keep its interface small, and compose modules in the root rather than wrapping wrappers." }
            ]
          },
          {
            id: "envs-drift",
            title: "Environments and drift",
            summary: "Workspaces versus directory per environment, promoting the same code through stages, and detecting and resolving drift.",
            minutes: 9,
            tags: ["environments", "workspaces", "drift"],
            blocks: [
              { t: "p", html: "You need dev, staging and production to run the <em>same</em> code with <em>different</em> inputs and <em>separate</em> state. There are three common layouts, and the choice is mostly about how visible the differences are." },
              { t: "table", headers: ["Layout", "How it works", "Strength", "Weakness"], rows: [
                ["CLI workspaces", "One directory, <code class='tok'>terraform workspace select prod</code>", "Little duplication", "The active environment is invisible in the code; easy to apply to the wrong one"],
                ["Directory per environment", "<code class='tok'>envs/dev</code>, <code class='tok'>envs/prod</code> each call the same modules with their own backend and tfvars", "Explicit and reviewable; separate credentials per directory", "Some boilerplate per environment"],
                ["Wrapper tooling", "A tool generates backend and inputs per environment from a hierarchy", "Removes boilerplate at scale", "One more tool to learn and debug"]
              ] },
              { t: "note", variant: "tip", html: "Directory per environment, with each environment in its own cloud account or subscription or project, is the most common production layout because the blast radius is visible in the path and enforced by credentials." },
              { t: "h", text: "Drift: when reality moves" },
              { t: "p", html: "<strong>Drift</strong> is any difference between real infrastructure and what state and code say. Causes: a console hotfix, another tool, an auto-scaling or provider-side default, or a deleted resource. Detect it by running a plan on a schedule against the main branch; any diff without a code change is drift." },
              { t: "table", headers: ["Response", "Command or action", "When"], rows: [
                ["Revert reality to code", "<code class='tok'>terraform apply</code>", "The change was unauthorized or a mistake"],
                ["Adopt reality into code", "Edit config to match, then plan shows no changes", "The hotfix was right; make it permanent"],
                ["Accept into state only", "<code class='tok'>terraform apply -refresh-only</code>", "Attributes that legitimately change outside Terraform"],
                ["Stop fighting", "<code class='tok'>lifecycle { ignore_changes = [...] }</code>", "Fields another system owns, such as a desired count set by an autoscaler"]
              ] },
              { t: "note", variant: "warn", html: "<code class='tok'>ignore_changes</code> is a scalpel. Ignoring whole resources hides exactly the drift you wanted to see." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'prod differs from staging and nobody knows why' or 'someone fixed it in the console during the incident'. The answer is scheduled drift detection plus a deliberate revert or adopt decision, then closing the access path." },
              { t: "note", variant: "key", html: "<strong>Same code, different inputs, separate state and credentials per environment.</strong> Run plans on a schedule so drift is found by a job, not by the next incident." }
            ]
          },
          {
            id: "tf-testing",
            title: "Testing Terraform: validate, terraform test, conditions and policy",
            summary: "The IaC test pyramid from fmt to integration tests, writing terraform test files, preconditions and check blocks, and policy as code with OPA and Sentinel in depth.",
            minutes: 12,
            tags: ["testing", "terraform-test", "opa", "sentinel", "checks"],
            blocks: [
              { t: "p", html: "Infrastructure code fails in ways a plan does not show: a module that produces the wrong CIDR, a variable that accepts a value that will break production, a policy nobody enforced. Testing infrastructure works like testing software: cheap checks on every commit, expensive checks less often." },
              { t: "table", headers: ["Layer", "Tool", "Catches", "Cost"], rows: [
                ["Format and syntax", "<code class='tok'>terraform fmt -check</code>, <code class='tok'>terraform validate</code>", "Syntax, types, broken references", "Seconds, no cloud access"],
                ["Lint and static scan", "TFLint, Checkov, Trivy", "Deprecated arguments, invalid instance types, insecure defaults", "Seconds"],
                ["Variable validation and conditions", "<code class='tok'>validation</code>, <code class='tok'>precondition</code>, <code class='tok'>postcondition</code>", "Bad inputs and broken assumptions, at plan time", "Free, runs every plan"],
                ["Unit tests", "<code class='tok'>terraform test</code> with <code class='tok'>command = plan</code> and mocks", "Module logic: names, counts, computed values", "Seconds to minutes"],
                ["Policy on the plan", "OPA / Conftest, Sentinel", "Organization rules: tags, regions, encryption, no public access", "Seconds"],
                ["Integration tests", "<code class='tok'>terraform test</code> with <code class='tok'>command = apply</code>, Terratest", "Real behaviour: the endpoint answers, the role can read the bucket", "Minutes and real money; sandbox accounts"]
              ] },
              { t: "h", text: "Guard inputs and assumptions in the code" },
              { t: "code", lang: "hcl", code:
                "variable \"environment\" {\n" +
                "  type = string\n" +
                "  validation {\n" +
                "    condition     = contains([\"dev\", \"stage\", \"prod\"], var.environment)\n" +
                "    error_message = \"environment must be dev, stage or prod.\"\n" +
                "  }\n" +
                "}\n\n" +
                "resource \"aws_db_instance\" \"main\" {\n" +
                "  # ...\n" +
                "  lifecycle {\n" +
                "    precondition {\n" +
                "      condition     = var.environment != \"prod\" || var.multi_az\n" +
                "      error_message = \"Production databases must be Multi-AZ.\"\n" +
                "    }\n" +
                "  }\n" +
                "}"
              },
              { t: "h", text: "terraform test" },
              { t: "p", html: "Since Terraform 1.6, files ending in <code class='tok'>.tftest.hcl</code> hold <code class='tok'>run</code> blocks with assertions. A run with <code class='tok'>command = plan</code> creates nothing; mock providers (1.7 and later) remove the need for credentials. A run with <code class='tok'>command = apply</code> creates real resources and destroys them afterwards, so point it at a sandbox account." },
              { t: "code", lang: "hcl", code:
                "# tests/naming.tftest.hcl\n" +
                "mock_provider \"aws\" {}\n\n" +
                "variables {\n" +
                "  environment = \"prod\"\n" +
                "  service     = \"orders\"\n" +
                "}\n\n" +
                "run \"bucket_name_follows_convention\" {\n" +
                "  command = plan\n" +
                "  assert {\n" +
                "    condition     = aws_s3_bucket.data.bucket == \"orders-prod-data\"\n" +
                "    error_message = \"bucket name must be <service>-<env>-data\"\n" +
                "  }\n" +
                "}"
              },
              { t: "note", variant: "tip", html: "<strong>Check blocks</strong> (Terraform 1.5 and later) express ongoing assertions, such as 'the health endpoint returns 200', that produce warnings on every plan without blocking. They pair well with nightly drift plans." },
              { t: "h", text: "Policy as code in depth" },
              { t: "p", html: "Policy tools judge the <em>plan</em>, which is the most accurate description of what is about to change. Export it with <code class='tok'>terraform show -json tfplan &gt; plan.json</code> and evaluate rules against <code class='tok'>resource_changes</code>." },
              { t: "code", lang: "text", code:
                "# policy/tags.rego  (OPA, evaluated with: conftest test plan.json)\n" +
                "package main\n\n" +
                "deny contains msg if {\n" +
                "  rc := input.resource_changes[_]\n" +
                "  rc.change.actions[_] == \"create\"\n" +
                "  not rc.change.after.tags.owner\n" +
                "  msg := sprintf(\"%s is missing the owner tag\", [rc.address])\n" +
                "}"
              },
              { t: "table", headers: ["", "OPA / Conftest", "Sentinel"], rows: [
                ["Where it runs", "Anywhere: CI, laptops, HCP Terraform policy sets, Kubernetes admission", "HCP Terraform and Terraform Enterprise"],
                ["Language", "Rego", "Sentinel"],
                ["Enforcement levels", "Your pipeline decides (warn or fail)", "Advisory, soft mandatory (overridable), hard mandatory"],
                ["Reuse beyond Terraform", "High: the same engine guards Kubernetes and APIs", "HashiCorp products only"]
              ] },
              { t: "h", text: "Workspaces, briefly revisited" },
              { t: "p", html: "CLI workspaces give one configuration several state files and suit short-lived copies such as a per-branch test stack. HCP Terraform workspaces are a different thing: a full unit with its own variables, state, permissions and policy sets, usually one per environment and component." },
              { t: "compare",
                bad: { title: "Testing by applying", items: ["The first test of a module is a production apply", "Policies live in a wiki", "Integration tests share one long-lived account"] },
                good: { title: "A testing pipeline", items: ["fmt, validate, lint and plan-mode tests on every PR", "OPA or Sentinel gates the plan", "Apply-mode tests in a disposable sandbox account, nightly"] } },
              { t: "quiz", id: "iac-testing" },
              { t: "note", variant: "key", html: "<strong>Test infrastructure in layers.</strong> Validate and lint on every commit, guard inputs with validations and preconditions, unit-test modules with plan-mode terraform test, gate plans with OPA or Sentinel, and keep apply-mode tests in a sandbox." }
            ]
          },
          {
            id: "iac-pipeline",
            title: "IaC pipelines: plan on PR, apply on merge, OIDC and policy",
            summary: "The delivery pipeline for infrastructure, keyless cloud authentication, and policy as code that blocks risky plans before apply.",
            minutes: 11,
            tags: ["ci", "oidc", "policy-as-code", "checkov"],
            blocks: [
              { t: "p", html: "Once infrastructure is code, it deserves a pipeline: every pull request shows its plan, scanners and policies judge it, a human approves, and only the pipeline applies. Humans keep read access to production and lose standing write access." },
              { t: "ol", items: [
                "<strong>On pull request:</strong> <code class='tok'>fmt -check</code>, <code class='tok'>validate</code>, static scan of the HCL, <code class='tok'>plan -out</code>, policy checks on the plan JSON, plan posted as a PR comment.",
                "<strong>On merge to main:</strong> re-plan (or reuse the reviewed plan for the same commit), require an environment approval for production, then <code class='tok'>apply</code>.",
                "<strong>Nightly:</strong> plan against main for drift; alert on any diff."
              ] },
              { t: "h", text: "Keyless authentication with OIDC" },
              { t: "code", lang: "text", code:
                "# CI workflow (GitHub Actions shown; other CI systems have equivalents)\n" +
                "permissions:\n" +
                "  id-token: write      # allow the job to request an OIDC token\n" +
                "  contents: read\n\n" +
                "jobs:\n" +
                "  plan:\n" +
                "    runs-on: ubuntu-latest\n" +
                "    steps:\n" +
                "      - uses: actions/checkout@v4\n" +
                "      - uses: aws-actions/configure-aws-credentials@v4\n" +
                "        with:\n" +
                "          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/tf-plan-payments\n" +
                "          aws-region: eu-west-1\n" +
                "      - run: terraform init -input=false\n" +
                "      - run: terraform plan -input=false -out=tfplan\n" +
                "      - run: terraform show -json tfplan > plan.json"
              },
              { t: "ul", items: [
                "Two roles: a <strong>plan role</strong> (read plus state access) trusted for pull requests, and an <strong>apply role</strong> trusted only for the main branch and the production environment.",
                "On Azure, the same pattern is a federated credential on an app registration or user-assigned managed identity; on Google Cloud, Workload Identity Federation to a service account.",
                "No access keys stored in the CI system at all."
              ] },
              { t: "h", text: "Policy as code on the plan" },
              { t: "table", headers: ["Tool", "Checks", "Typical rule"], rows: [
                ["Checkov, Trivy (formerly tfsec), KICS", "HCL and plan files against a large built-in rule set", "S3 bucket without encryption; security group open to the world on port 22"],
                ["OPA / Conftest", "Plan JSON against your own Rego policies", "Only approved instance families; every resource tagged with an owner"],
                ["Sentinel", "Policies inside HCP Terraform runs", "Block destroys of tagged production databases"]
              ] },
              { t: "note", variant: "warn", html: "Roll out new blocking policies in warn mode first, with a time-boxed exception process. A gate that blocks on day one without a path forward teaches teams to route around the pipeline." },
              { t: "quiz", id: "iac-tf-scale" },
              { t: "note", variant: "key", html: "<strong>The pipeline is the only identity that can apply.</strong> Plan on every PR, judge the plan with policy, apply on merge with a short-lived OIDC role, and plan nightly for drift." }
            ]
          }
        ]
      },
      {
        id: "native",
        name: "Native & Alternative Tools",
        icon: "wrench",
        lessons: [
          {
            id: "cfn-cdk",
            title: "CloudFormation and the AWS CDK",
            summary: "Stacks, change sets, rollback, StackSets and drift detection, then CDK constructs that synthesize CloudFormation from real code.",
            minutes: 10,
            tags: ["cloudformation", "cdk", "stacksets"],
            blocks: [
              { t: "p", html: "<strong>CloudFormation</strong> is AWS's native IaC service. You hand it a template; it owns the state as a <strong>stack</strong> and handles ordering, rollback on failure and deletion. There is no state file to protect, at the cost of being AWS-only." },
              { t: "table", headers: ["Concept", "What it is", "Terraform analogue"], rows: [
                ["Stack", "A deployed template and the resources it owns", "A state file"],
                ["Change set", "Previewed list of adds, modifies and replacements", "<code class='tok'>terraform plan</code>"],
                ["Automatic rollback", "Failed updates revert to the last good state", "None built in; a failed apply stops part way"],
                ["Drift detection", "Compares stack resources with live configuration", "Scheduled plan / <code class='tok'>-refresh-only</code>"],
                ["StackSets", "Deploy one template to many accounts and regions", "A loop over accounts in a pipeline"],
                ["DeletionPolicy: Retain", "Keep a resource when the stack is deleted", "<code class='tok'>prevent_destroy</code> / <code class='tok'>removed</code> blocks"]
              ] },
              { t: "code", lang: "text", code:
                "Resources:\n" +
                "  LogsBucket:\n" +
                "    Type: AWS::S3::Bucket\n" +
                "    DeletionPolicy: Retain\n" +
                "    Properties:\n" +
                "      VersioningConfiguration: { Status: Enabled }\n" +
                "      BucketEncryption:\n" +
                "        ServerSideEncryptionConfiguration:\n" +
                "          - ServerSideEncryptionByDefault: { SSEAlgorithm: aws:kms }\n" +
                "      PublicAccessBlockConfiguration:\n" +
                "        BlockPublicAcls: true\n" +
                "        BlockPublicPolicy: true\n" +
                "        IgnorePublicAcls: true\n" +
                "        RestrictPublicBuckets: true"
              },
              { t: "h", text: "CDK: CloudFormation from a programming language" },
              { t: "p", html: "The <strong>Cloud Development Kit</strong> lets you write TypeScript, Python, Java, C# or Go. <code class='tok'>cdk synth</code> turns the program into a CloudFormation template; <code class='tok'>cdk diff</code> previews; <code class='tok'>cdk deploy</code> runs it through CloudFormation." },
              { t: "table", headers: ["Construct level", "What you get", "Example"], rows: [
                ["L1", "One-to-one with a CloudFormation resource, every property explicit", "<code class='tok'>CfnBucket</code>"],
                ["L2", "Curated resource with sensible defaults and helper methods", "<code class='tok'>new s3.Bucket(this, 'Logs', { encryption: KMS })</code>, <code class='tok'>bucket.grantRead(role)</code>"],
                ["L3 (patterns)", "Several resources wired together", "A load-balanced Fargate service"]
              ] },
              { t: "code", lang: "python", code:
                "from aws_cdk import Stack, aws_s3 as s3, RemovalPolicy\n" +
                "from constructs import Construct\n\n" +
                "class LogsStack(Stack):\n" +
                "    def __init__(self, scope: Construct, id: str, **kw) -> None:\n" +
                "        super().__init__(scope, id, **kw)\n" +
                "        s3.Bucket(self, \"Logs\",\n" +
                "                  encryption=s3.BucketEncryption.KMS_MANAGED,\n" +
                "                  block_public_access=s3.BlockPublicAccess.BLOCK_ALL,\n" +
                "                  versioned=True,\n" +
                "                  enforce_ssl=True,\n" +
                "                  removal_policy=RemovalPolicy.RETAIN)"
              },
              { t: "note", variant: "trap", html: "CDK's loops and conditionals make it easy to generate very large templates that hit CloudFormation limits on resources or template size. Split into several stacks by lifecycle, as you would split Terraform state." },
              { t: "note", variant: "key", html: "<strong>CloudFormation trades portability for a managed state and rollback.</strong> CDK keeps those guarantees while letting you use a real language, so review the synthesized diff, not just the code." }
            ]
          },
          {
            id: "bicep-gcp",
            title: "Azure Bicep, Google Cloud options and Pulumi",
            summary: "Bicep over ARM, what-if previews and deployment stacks on Azure; Infrastructure Manager on Google Cloud; and where Pulumi fits.",
            minutes: 9,
            tags: ["bicep", "arm", "infrastructure-manager", "pulumi"],
            blocks: [
              { t: "p", html: "<strong>Bicep</strong> is Azure's native IaC language. It compiles to ARM JSON templates, which Azure Resource Manager deploys at a scope: resource group, subscription, management group or tenant. Like CloudFormation, Azure keeps track of deployments, so there is no state file for you to host." },
              { t: "code", lang: "text", code:
                "param location string = resourceGroup().location\n" +
                "param env string\n\n" +
                "resource logs 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n" +
                "  name: 'acmelogs${env}'\n" +
                "  location: location\n" +
                "  sku: { name: 'Standard_ZRS' }\n" +
                "  kind: 'StorageV2'\n" +
                "  properties: {\n" +
                "    allowBlobPublicAccess: false\n" +
                "    minimumTlsVersion: 'TLS1_2'\n" +
                "    supportsHttpsTrafficOnly: true\n" +
                "  }\n" +
                "}\n\n" +
                "output logsId string = logs.id"
              },
              { t: "code", lang: "bash", code:
                "# preview, then deploy (authenticated via az login or a federated CI identity)\n" +
                "az deployment group what-if --resource-group rg-payments-prod --template-file main.bicep --parameters env=prod\n" +
                "az deployment group create  --resource-group rg-payments-prod --template-file main.bicep --parameters env=prod"
              },
              { t: "table", headers: ["Azure feature", "What it adds"], rows: [
                ["<code class='tok'>what-if</code>", "Plan-style preview of creates, modifies and deletes"],
                ["Incremental vs complete mode", "Incremental leaves unlisted resources alone; complete deletes them from the resource group (use with great care)"],
                ["Deployment stacks", "Manage a deployment's resources as a set, delete or detach removed ones, optionally deny out-of-band edits"],
                ["Template specs and Bicep registries", "Share versioned modules across teams"]
              ] },
              { t: "h", text: "Google Cloud" },
              { t: "p", html: "Google Cloud's older native tool, Deployment Manager, has been deprecated in favour of <strong>Infrastructure Manager</strong>, a managed service that runs Terraform for you and stores the state. In practice most Google Cloud teams write Terraform with the <code class='tok'>google</code> provider, either through Infrastructure Manager or their own pipeline." },
              { t: "h", text: "Pulumi" },
              { t: "p", html: "<strong>Pulumi</strong> uses general-purpose languages, like CDK, but targets many providers, like Terraform. It keeps its own state in a managed service or a backend you host. It suits teams that want real loops, types and tests in their infrastructure code across clouds; the cost is that infrastructure reviewers must read application-style code." },
              { t: "note", variant: "tip", html: "Whatever the tool, the review artifact is the preview: a Terraform plan, a change set, a what-if result or a Pulumi preview. Make it the thing approvers look at." },
              { t: "note", variant: "key", html: "<strong>Bicep is to Azure what CloudFormation is to AWS; on Google Cloud the native path is managed Terraform.</strong> Every serious tool has a preview step, and that preview is what you review." }
            ]
          },
          {
            id: "choosing-iac",
            title: "Choosing an IaC tool for your estate",
            summary: "A decision table across Terraform, CloudFormation, CDK, Bicep and Pulumi, with the organizational factors that matter more than syntax.",
            minutes: 8,
            tags: ["decision", "terraform", "comparison"],
            blocks: [
              { t: "p", html: "Teams argue about syntax. The decision is really about <strong>scope</strong> (how many clouds and SaaS providers), <strong>skills</strong> (who writes and reviews it) and <strong>operations</strong> (who hosts state, previews and policy)." },
              { t: "table", headers: ["Situation", "Strong default", "Why"], rows: [
                ["AWS only, small team, wants managed state and rollback", "CloudFormation or CDK", "No state to host; first-party support for new services"],
                ["Azure only", "Bicep", "First-party, concise, what-if and deployment stacks"],
                ["Google Cloud mostly", "Terraform (self-run or Infrastructure Manager)", "The ecosystem's de facto standard"],
                ["Several clouds plus SaaS (DNS, CDN, monitoring, identity)", "Terraform / OpenTofu", "One language, plan format and pipeline across everything"],
                ["Developers own infra and want real languages and tests", "Pulumi or CDK", "Loops, types and unit tests in familiar languages"]
              ] },
              { t: "table", headers: ["Tier", "What the estate looks like"], rows: [
                ["Naive", "A mix of console clicks and scripts; each team picks a tool; no previews in review"],
                ["Solid", "One primary tool, remote locked state, plan on pull request, OIDC in CI"],
                ["Standout", "Shared decision modules, policy as code on every plan, nightly drift detection, the pipeline is the only production writer, and exceptions expire"]
              ] },
              { t: "note", variant: "warn", html: "Mixing tools is fine; mixing tools <em>on the same resources</em> is not. Two systems managing one security group will fight forever. Draw ownership lines by layer or by account." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'which IaC tool should we standardize on?' Ask how many providers, who reviews, and who will operate state and policy, then pick the tool and name the pipeline around it." },
              { t: "quiz", id: "iac-native" },
              { t: "note", variant: "key", html: "<strong>Pick for scope, skills and operations, not syntax.</strong> Multi-provider estates usually standardize on Terraform; single-cloud teams can lean on the native tool; either way the pipeline and policy matter more than the language." }
            ]
          }
        ]
      }
    ]
  };
})();
