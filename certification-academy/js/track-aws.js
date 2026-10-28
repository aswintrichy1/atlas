/* track-aws.js — AWS Solutions Architect Associate concepts (unofficial, original prep) */
(function () {
  "use strict";
  var TID = "aws";

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    mount.appendChild(h("p", { class: "widget-desc" }, desc));
    var stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    return stage;
  }
  function seg(label, opts, active, onPick) {
    var wrap = h("div", { class: "su-ctl" }, h("span", { class: "su-ctl-label" }, label));
    var box = h("div", { class: "w-seg", role: "group", "aria-label": label });
    var btns = opts.map(function (o, i) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (i === active ? " active" : ""), "aria-pressed": i === active ? "true" : "false" }, o);
      b.addEventListener("click", function () {
        btns.forEach(function (x, j) { x.className = "w-seg-btn" + (j === i ? " active" : ""); x.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        onPick(i);
      });
      box.appendChild(b);
      return b;
    });
    wrap.appendChild(box);
    return wrap;
  }
  function ro(label) {
    var b = h("b", {}, "-");
    var el = h("div", { class: "ro" }, label + ": ", b);
    return { el: el, set: function (v) { b.textContent = String(v); } };
  }
  function hashStr(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  var bag = [];
  function slot(seedText) {
    if (!bag.length) {
      bag = [0, 1, 2, 3];
      var r = hashStr(TID + seedText);
      for (var i = 3; i > 0; i--) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; var j = (r >>> 8) % (i + 1); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    }
    return bag.pop();
  }
  function Q(q, right, wrong, explain) {
    var pos = slot(q);
    var options = wrong.slice(0, 3);
    options.splice(pos, 0, right);
    return { q: q, options: options, answer: pos, explain: explain };
  }
  var QZ = {};
  function L(id, title, summary, minutes, tags, blocks, questions) {
    var qid = TID + "-" + id;
    QZ[qid] = { title: "Checkpoint: " + title, sub: questions.length + " original exam-style questions with explanations", questions: questions };
    var b = blocks.slice(0, -1).concat([{ t: "quiz", id: qid }], blocks.slice(-1));
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: b };
  }
  var VERIFY = { t: "note", variant: "warn", html: "Unofficial study material. Service limits, names and exam domain weights change; <strong>verify current official objectives</strong> in the exam guide before you book." };

  /* ---------- widgets ---------- */
  var Widgets = {};

  Widgets.suSgNacl = function (mount) {
    var stage = shell(mount, "evaluator", "Security group vs network ACL", "Pick the rules in place and the direction of a packet. Watch how a stateful security group and a stateless NACL decide differently.");
    var st = { sgIn: 1, naclIn: 1, naclOut: 0, dir: 0 };
    var out = h("div", { class: "su-stack" });
    var r1 = ro("Inbound request"), r2 = ro("Return traffic"), r3 = ro("Verdict");
    function paint() {
      var inboundOk = st.sgIn === 1 && st.naclIn === 1;
      var returnOk = inboundOk && st.naclOut === 1;
      r1.set(inboundOk ? "allowed" : (st.sgIn ? "blocked by NACL inbound" : "blocked by SG (no allow rule)"));
      r2.set(!inboundOk ? "n/a" : returnOk ? "allowed (SG tracks state; NACL outbound allows ephemeral ports)" : "dropped by NACL outbound rule");
      r3.set(returnOk ? "connection works" : "connection fails");
      out.textContent = "";
      out.appendChild(h("p", { class: "su-dim" }, st.naclOut === 0 && inboundOk
        ? "Classic trap: the SG needs no outbound rule for replies because it is stateful, but the NACL is stateless and must allow the return path on ephemeral ports."
        : "Security groups only have allow rules and remember connections. NACLs evaluate numbered allow and deny rules in order, in each direction separately."));
    }
    stage.appendChild(h("div", { class: "su-row" },
      seg("SG inbound 443", ["no rule", "allow"], 1, function (i) { st.sgIn = i; paint(); }),
      seg("NACL inbound 443", ["deny", "allow"], 1, function (i) { st.naclIn = i; paint(); }),
      seg("NACL outbound ephemeral", ["deny", "allow"], 0, function (i) { st.naclOut = i; paint(); })));
    stage.appendChild(out);
    stage.appendChild(h("div", { class: "w-readout" }, r1.el, r2.el, r3.el));
    paint();
  };

  Widgets.suAzPlanner = function (mount) {
    var stage = shell(mount, "architecture", "Availability layout planner", "Choose a deployment layout and data tier. The readout shows the failure it survives and the relative cost it adds. Numbers are illustrative, not quotes.");
    var layouts = [
      { n: "Single instance, one AZ", survives: "nothing beyond a reboot", cost: 1, ops: "low" },
      { n: "Auto Scaling group across 2+ AZs behind a load balancer", survives: "loss of an instance or a whole AZ", cost: 2.2, ops: "low-medium" },
      { n: "Active-passive across two Regions", survives: "loss of a Region (after failover)", cost: 3.4, ops: "medium-high" }
    ];
    var data = [
      { n: "Database on the instance", note: "data dies with the instance" },
      { n: "Managed DB with a Multi-AZ standby", note: "automatic failover inside the Region" },
      { n: "Managed DB with cross-Region replica", note: "Region-level recovery, async replication lag" }
    ];
    var st = { l: 1, d: 1 };
    var a = ro("Survives"), b = ro("Relative cost"), c = ro("Data tier"), d = ro("Ops effort");
    function paint() {
      var L0 = layouts[st.l], D0 = data[st.d];
      a.set(L0.survives);
      b.set("x" + (L0.cost + st.d * 0.6).toFixed(1));
      c.set(D0.note);
      d.set(L0.ops);
    }
    stage.appendChild(seg("Compute layout", ["1 AZ", "Multi-AZ", "Multi-Region"], 1, function (i) { st.l = i; paint(); }));
    stage.appendChild(seg("Data tier", ["On instance", "Multi-AZ", "Cross-Region"], 1, function (i) { st.d = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el, d.el));
    paint();
  };

  Widgets.suDrPicker = function (mount) {
    var stage = shell(mount, "decision", "Disaster-recovery strategy picker", "Set the recovery time objective (RTO) and recovery point objective (RPO) the business asked for. The picker names the cheapest strategy that meets both.");
    var labels = ["minutes", "under an hour or so", "many hours to a day"];
    var st = { rto: 2, rpo: 2 };
    var s = ro("Strategy"), why = ro("Why"), cost = ro("Standing cost");
    var MULTI = ["Multi-site active/active", "near-zero downtime and data loss needs live capacity in both places", "highest"];
    var WARM = ["Warm standby", "a scaled-down but running stack only needs to scale up", "medium-high"];
    var PILOT = ["Pilot light", "data replicates continuously; compute is launched during recovery", "low-medium"];
    var BACKUP = ["Backup and restore", "periodic backups restored into fresh infrastructure", "lowest"];
    function paint() {
      var pick;
      if (st.rto === 0) pick = st.rpo === 0 ? MULTI : WARM;
      else if (st.rto === 1) pick = PILOT;
      else pick = st.rpo === 2 ? BACKUP : PILOT;
      s.set(pick[0]); why.set(pick[1]); cost.set(pick[2]);
    }
    stage.appendChild(seg("RTO", labels, 2, function (i) { st.rto = i; paint(); }));
    stage.appendChild(seg("RPO", ["seconds", "minutes", "hours"], 2, function (i) { st.rpo = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, s.el, why.el, cost.el));
    paint();
  };

  Widgets.suS3Tier = function (mount) {
    var stage = shell(mount, "chooser", "Object storage class chooser", "Describe the access pattern. The chooser suggests a storage class family and the trade-off you accept.");
    var st = { freq: 0, retr: 0, redo: 0 };
    var r = ro("Suggested class"), t = ro("Trade-off");
    function paint() {
      var cls, tr;
      if (st.freq === 3) { cls = "Intelligent-Tiering"; tr = "small monitoring fee per object; no retrieval fees when it moves data"; }
      else if (st.freq === 0) { cls = "Standard"; tr = "highest storage price, no retrieval fee"; }
      else if (st.freq === 1) {
        cls = st.redo ? "One Zone-IA" : "Standard-IA";
        tr = st.redo ? "cheaper, but data lives in one AZ; only for re-creatable data" : "lower storage price, per-GB retrieval fee and minimum duration";
      } else {
        cls = st.retr === 0 ? "Glacier Instant Retrieval" : st.retr === 1 ? "Glacier Flexible Retrieval" : "Glacier Deep Archive";
        tr = st.retr === 0 ? "archive pricing with millisecond access, higher retrieval cost" : st.retr === 1 ? "retrieval takes minutes to hours" : "cheapest storage; retrieval can take many hours";
      }
      r.set(cls); t.set(tr);
    }
    stage.appendChild(seg("Access frequency", ["Frequent", "Monthly-ish", "Rarely (archive)", "Unknown / changing"], 0, function (i) { st.freq = i; paint(); }));
    stage.appendChild(seg("If archived, needed back in", ["milliseconds", "hours", "a day is fine"], 0, function (i) { st.retr = i; paint(); }));
    stage.appendChild(seg("Data easily re-created?", ["No", "Yes"], 0, function (i) { st.redo = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, r.el, t.el));
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- lessons ---------- */
  var secure = [
    L("iam-foundations", "IAM: identities, policies and evaluation", "How AWS decides allow or deny, and why roles beat long-lived keys.", 9, ["iam", "security"], [
      VERIFY,
      { t: "p", html: "Picture every API call as a request carrying an identity, an action, a resource and some context. IAM gathers <em>every</em> policy that applies and runs one decision: <strong>an explicit deny anywhere wins, then an explicit allow is required, otherwise the default is deny.</strong>" },
      { t: "table", headers: ["Policy type", "Attached to", "Grants access?"], rows: [
        ["Identity-based", "User, group or role", "Yes, for that identity"],
        ["Resource-based", "Bucket, queue, key, etc.", "Yes, and can name other accounts"],
        ["Permissions boundary", "User or role", "No; caps what identity policies can grant"],
        ["Organization guardrail (SCP)", "Account or OU", "No; caps what anyone in the account can do"],
        ["Session policy", "Assumed-role session", "No; narrows the session"]
      ] },
      { t: "h", text: "Roles over keys" },
      { t: "ul", items: ["A <strong>role</strong> issues temporary credentials through STS; nothing long-lived sits on disk.", "Workloads on EC2, Lambda or containers get a role via the instance profile or task/execution role.", "Humans should federate (single sign-on) into roles rather than holding IAM user keys.", "Least privilege: start narrow, widen with evidence from access analysis, not guesswork."] },
      { t: "note", variant: "trap", html: "A guardrail or boundary that <em>allows</em> an action grants nothing by itself. If a scenario says the SCP allows S3 but the user still gets AccessDenied, look for the missing identity or resource allow." },
      { t: "cue", html: "Scenario says <em>application on EC2 needs to read a bucket</em> and an option offers access keys in a config file: eliminate it. The intended answer is an IAM role attached to the instance." },
      { t: "note", variant: "key", html: "Explicit deny beats allow; allow must be explicit; guardrails only subtract. Prefer roles and temporary credentials everywhere." }
    ], [
      Q("An identity policy allows s3:GetObject on a bucket, and the bucket policy explicitly denies s3:GetObject to everyone outside a VPC endpoint. A request arrives from the internet. What happens?", "It is denied because the explicit deny overrides the allow", ["It is allowed because the identity policy allows it", "It is allowed only if the object is public", "It is denied only if no permissions boundary exists"], "IAM evaluates all applicable policies together. Any explicit deny ends the evaluation with a deny, regardless of allows elsewhere. Explicit deny in a resource policy is a common way to force access through a specific network path."),
      Q("An application on EC2 must write to a DynamoDB table. What is the most secure way to grant access?", "Attach an IAM role with a scoped policy to the instance profile", ["Store an IAM user's access keys in an environment variable", "Embed the root account keys in the AMI", "Open the table to the instance's security group"], "Instance roles deliver short-lived credentials that rotate automatically, and the policy can be scoped to the exact table and actions. Long-lived keys can leak, and security groups do not control DynamoDB API authorization."),
      Q("A permissions boundary on a role allows only S3 and CloudWatch actions. The role's identity policy allows EC2 and S3. Which actions can the role perform?", "Only S3, the intersection of the two", ["EC2, S3 and CloudWatch, the union", "Only EC2, the identity policy wins", "None, boundaries deny everything not listed in both"], "A boundary sets a maximum, and effective permissions are the overlap of the boundary and the identity policy. CloudWatch is in the boundary but never granted; EC2 is granted but outside the boundary, so only S3 remains."),
      Q("Your team wants employees to sign in with corporate credentials and receive temporary AWS access. Which approach fits best?", "Federate the identity provider into IAM roles through single sign-on", ["Create an IAM user per employee with a password and keys", "Share one administrator IAM user among the team", "Issue each employee a root account login"], "Federation maps existing corporate identities to roles with temporary credentials, which removes long-lived user secrets and centralizes joiner-mover-leaver handling. Shared users and root logins break accountability and least privilege."),
      Q("Which statement about IAM's default behaviour is correct?", "A request with no matching allow is implicitly denied", ["A request with no matching deny is implicitly allowed", "New IAM users can read all S3 buckets by default", "Resource policies are ignored when an identity policy exists"], "IAM is deny-by-default: unless some applicable policy explicitly allows the action, it is refused. Resource and identity policies are evaluated together, not one instead of the other."),
      Q("A security review finds a role with Action \"*\" on Resource \"*\". What is the best first improvement?", "Replace it with actions and resources the workload actually uses, guided by access activity", ["Add a second role with the same policy for redundancy", "Move the policy to an IAM group instead", "Rename the role so its purpose is clearer"], "Least privilege means narrowing actions and resources to what is used. Last-accessed data and policy analysis show what the workload actually calls, so you can tighten without breaking it. Moving or renaming leaves the excess permission in place.")
    ]),

    L("multi-account", "Multi-account guardrails and cross-account access", "Organizations, SCPs and cross-account roles as the backbone of a landing zone.", 8, ["organizations", "scp"], [
      { t: "p", html: "Think of accounts as the strongest isolation boundary AWS offers: separate blast radius, separate billing lines, separate quotas. An organization groups them into organizational units (OUs) so you can apply <strong>guardrails once</strong> and have them inherited." },
      { t: "compare", bad: { title: "One giant account", items: ["Dev mistakes can hit production data", "Permissions get tangled across teams", "Hard to attribute cost"] }, good: { title: "Account per workload and environment", items: ["Blast radius contained by account", "Guardrails applied per OU", "Consolidated billing still in one place"] } },
      { t: "table", headers: ["Need", "Typical mechanism"], rows: [
        ["Stop anyone disabling audit logging", "SCP denying the relevant actions on the OU"],
        ["Restrict Regions an account can use", "SCP with a Region condition"],
        ["Let account B read account A's bucket", "Cross-account role, or a bucket policy naming account B"],
        ["Central audit trail for all accounts", "Organization-wide trail delivered to a log archive account"]
      ] },
      { t: "note", variant: "trap", html: "SCPs do not apply to the management account in the way they apply to member accounts, and they never grant permissions. Keep workloads out of the management account." },
      { t: "note", variant: "tip", html: "Cross-account role pattern: the target account trusts the source account in the role's trust policy; the source identity needs permission to call sts:AssumeRole on that role ARN. Both sides must agree." },
      { t: "note", variant: "key", html: "Accounts are the isolation boundary, OUs carry guardrails, SCPs only subtract, and cross-account access needs trust on one side and permission on the other." }
    ], [
      Q("A company wants to prevent every account in its Sandbox OU from launching resources outside two approved Regions. What is the most scalable control?", "Attach an SCP to the Sandbox OU that denies actions outside those Regions", ["Add a deny statement to every IAM user in every account", "Ask developers to select the right Region in the console", "Create a separate VPC in each approved Region"], "SCPs on an OU are inherited by all member accounts and cannot be bypassed by account administrators. Editing every user does not scale and misses roles; guidance is not a control; VPCs do not restrict Region use."),
      Q("An SCP allows all S3 actions for an account. A developer in that account has no IAM policies attached. Can the developer read S3 objects?", "No, SCPs set limits but never grant permissions", ["Yes, the SCP grants S3 access to all principals", "Yes, but only in the management account", "Only if the bucket is in the same OU"], "An SCP defines the maximum available permissions. The principal still needs an identity- or resource-based allow. With no policies attached, the developer is implicitly denied."),
      Q("Account A hosts a reporting tool that must read objects from a bucket in account B. Which combination works?", "A role in B trusting account A, plus permission in A to assume that role", ["A security group rule in B allowing account A", "Enabling versioning on the bucket in B", "An SCP in A granting access to B's bucket"], "Cross-account access via roles needs a trust policy in the target account and sts:AssumeRole permission for the caller. Security groups control network traffic, not API authorization, and SCPs never grant."),
      Q("Why do many landing-zone designs keep workloads out of the organization's management account?", "Guardrails do not constrain it the same way and it holds org-wide power", ["It cannot run EC2 instances", "Its billing is charged at a higher rate", "It cannot be accessed through the console"], "The management account controls the organization and is not restricted by SCPs like member accounts are. Running workloads there increases risk with fewer guardrails, so it is reserved for organization administration."),
      Q("Security wants a tamper-resistant audit trail covering all member accounts. Which approach fits?", "An organization trail delivering to a restricted log archive account", ["Each team enabling logging when they remember", "Logs stored in the same account as the workload, writable by admins", "Disabling logs in development accounts to save cost"], "An organization-wide trail captures API activity across accounts, and delivering to a separate, locked-down account means workload administrators cannot alter the evidence."),
      Q("Which is the main benefit of separating production and development into different accounts?", "A smaller blast radius and clearer permission and cost boundaries", ["Lower per-hour EC2 prices in production", "Automatic replication between the two accounts", "No need for IAM policies in development"], "Accounts are a hard isolation boundary: mistakes and compromised credentials in one account do not automatically reach another, and cost and quotas are tracked separately.")
    ]),

    L("vpc-security", "VPC security layers", "Subnets, route tables, security groups, NACLs and private paths to services.", 10, ["vpc", "network"], [
      { t: "p", html: "Mental model: a VPC is a private network you carve into subnets inside Availability Zones. A subnet is <strong>public</strong> only because its route table sends 0.0.0.0/0 to an internet gateway. Private subnets reach out through a NAT gateway, or reach AWS services privately through VPC endpoints." },
      { t: "table", headers: ["Layer", "Scope", "State", "Rules"], rows: [
        ["Security group", "Elastic network interface", "Stateful", "Allow only; all rules evaluated"],
        ["Network ACL", "Subnet", "Stateless", "Allow and deny; numbered, lowest first"],
        ["Route table", "Subnet", "n/a", "Decides where traffic can go at all"]
      ] },
      { t: "widget", id: "suSgNacl" },
      { t: "h", text: "Private access to services" },
      { t: "ul", items: ["<strong>Gateway endpoints</strong> (S3 and DynamoDB) are route-table targets with no hourly charge.", "<strong>Interface endpoints</strong> place private IPs for many services in your subnets and are billed per hour and per GB.", "Endpoint policies can restrict which buckets or actions are reachable through the endpoint.", "Security groups can reference other security groups, so tiers trust each other by role, not IP."] },
      { t: "note", variant: "trap", html: "If an instance in a private subnet cannot reach S3, check the route table for the gateway endpoint or NAT path before blaming IAM." },
      { t: "note", variant: "key", html: "Route tables decide reachability, NACLs filter statelessly at the subnet, security groups filter statefully at the interface, and endpoints keep service traffic off the internet." }
    ], [
      Q("Instances in a private subnet must download objects from S3 without traversing the internet and without paying NAT data processing charges. What should you add?", "A gateway VPC endpoint for S3 with a route-table entry", ["An internet gateway attached to the private subnet", "A second NAT gateway in another AZ", "An inbound security group rule from S3"], "A gateway endpoint for S3 adds a route that keeps traffic on the AWS network and avoids NAT processing fees. An internet gateway would make the subnet public, and inbound rules do not create a path to S3."),
      Q("A web server's security group allows inbound 443 from anywhere and has no outbound rules beyond the default. The subnet NACL allows inbound 443 but denies all outbound. Clients cannot connect. Why?", "The stateless NACL blocks the return traffic on ephemeral ports", ["Security groups need an explicit outbound rule for responses", "Port 443 cannot be used with NACLs", "The internet gateway is stateless"], "Security groups are stateful, so responses are allowed automatically. NACLs are stateless and evaluate each direction separately, so outbound responses to client ephemeral ports must be allowed explicitly."),
      Q("What makes a subnet public?", "Its route table has a default route to an internet gateway", ["It has a NACL that allows all traffic", "Its instances have security groups open to 0.0.0.0/0", "It is placed in the first Availability Zone"], "Public versus private is a routing property. Without a route to an internet gateway, even an instance with a public IP cannot reach or be reached from the internet."),
      Q("You need to block a single malicious IP range from reaching every instance in a subnet. Which control supports this directly?", "A network ACL deny rule", ["A security group deny rule", "An IAM policy with a source IP condition on EC2", "A route-table blackhole for the internet gateway"], "Security groups support only allow rules. NACLs support explicit deny rules evaluated in number order, which suits blocking a known range at the subnet boundary."),
      Q("An application tier should accept traffic only from the web tier, even as web instances scale and change IPs. What is the cleanest rule?", "Allow the web tier's security group as the source in the app tier's security group", ["Allow the web subnet CIDR in a NACL only", "Allow 0.0.0.0/0 and rely on IAM", "Update the app tier rule with each new web instance IP"], "Referencing a security group as a source trusts any interface in that group, so scaling events need no rule changes. CIDR rules are broader, and per-IP rules are brittle."),
      Q("Private instances need to call a third-party API on the internet. What is required?", "A NAT gateway in a public subnet and a route to it from the private subnet", ["A gateway endpoint for the third-party API", "An inbound NACL rule on the private subnet", "An interface endpoint for the internet"], "A NAT gateway lets private instances initiate outbound internet connections while remaining unreachable from the internet. Endpoints cover AWS and supported partner services, not arbitrary internet APIs.")
    ]),

    L("data-protection", "Encryption, keys and secrets", "KMS, envelope encryption, secret storage and keeping buckets private.", 9, ["kms", "encryption", "s3"], [
      { t: "p", html: "Hold this picture: a <strong>key management service</strong> keeps a master key that never leaves it, and generates <em>data keys</em> that encrypt your actual data. You store the encrypted data key next to the data. That is envelope encryption, and it is why encrypting terabytes does not mean sending terabytes to the key service." },
      { t: "table", headers: ["Need", "Fits"], rows: [
        ["Encrypt EBS, S3, RDS at rest with audited key use", "KMS keys (AWS managed or customer managed)"],
        ["Control key policy, rotation, and cross-account use", "Customer managed KMS key"],
        ["Store DB passwords with automatic rotation", "Secrets Manager"],
        ["Store configuration values and simple secrets cheaply", "Systems Manager Parameter Store (SecureString)"],
        ["Encrypt traffic to users", "TLS certificates via Certificate Manager on a load balancer or CloudFront"]
      ] },
      { t: "h", text: "Keeping buckets private" },
      { t: "ul", items: ["Turn on Block Public Access at the account level unless a bucket must be public by design.", "Use bucket policies to require encryption in transit (deny requests without TLS).", "Grant CloudFront access with origin access control rather than making the bucket public.", "Enable default encryption so new objects are encrypted without client changes."] },
      { t: "note", variant: "tip", html: "If a scenario stresses <em>audit who used the key</em> or <em>separate duties between key admins and data users</em>, pick a customer managed KMS key with a deliberate key policy." },
      { t: "note", variant: "key", html: "Envelope encryption keeps the master key in KMS; Secrets Manager rotates secrets; Block Public Access and TLS-only policies keep buckets private and encrypted in transit." }
    ], [
      Q("An application needs to store a database password and rotate it automatically on a schedule. Which service fits with the least custom code?", "Secrets Manager with rotation enabled", ["A plaintext file in an S3 bucket", "An environment variable baked into the AMI", "A tag on the RDS instance"], "Secrets Manager stores secrets encrypted with KMS and supports managed rotation for common databases. Files, AMIs and tags are not designed for secret storage or rotation."),
      Q("Why does envelope encryption scale to very large datasets?", "Data is encrypted locally with a data key, and only the small data key is protected by the master key", ["The master key is copied to every server", "All data is streamed to the key service for encryption", "It uses no keys at all, only hashing"], "The master key never leaves the key service. Workloads request a data key, encrypt data locally, and store the encrypted data key alongside the data, so large payloads never travel to the key service."),
      Q("Compliance requires that key administrators cannot use keys to decrypt data, and that key usage is audited. What should you choose?", "A customer managed KMS key with a key policy separating admin and usage permissions", ["An AWS managed key with default settings", "Client-side encryption with a key stored in source code", "Disabling encryption and relying on IAM"], "Customer managed keys let you write key policies that separate administration from use, and calls are logged for audit. Keys in source code violate basic secret hygiene."),
      Q("A static website bucket should serve content only through CloudFront, never directly. What is the recommended approach?", "Keep the bucket private and grant CloudFront access with origin access control", ["Make the bucket public and hide the URL", "Allow the CloudFront IP ranges in a NACL", "Enable versioning so direct access is blocked"], "Origin access control lets CloudFront sign requests to a private bucket while the bucket policy denies everything else. Hidden public URLs are not security, and NACLs do not apply to S3."),
      Q("How can you enforce that all requests to a bucket use encryption in transit?", "A bucket policy that denies requests where secure transport is false", ["Enable default encryption at rest", "Turn on object lock", "Use a larger KMS key size"], "A deny on non-TLS requests forces HTTPS. Default encryption covers data at rest only, and object lock is about retention, not transport."),
      Q("Which option is most cost-effective for storing a few non-rotating configuration values, some of them sensitive?", "Parameter Store with SecureString parameters", ["A dedicated database instance for configuration", "Secrets Manager with hourly rotation", "Hardcoding the values in application code"], "Parameter Store handles configuration and encrypted values at low cost. Secrets Manager adds rotation features that are unnecessary here, and hardcoding sensitive values is a security defect.")
    ])
  ];

  var resilient = [
    L("ha-multi-az", "High availability across Availability Zones", "Load balancers, Auto Scaling and managed database failover.", 9, ["ha", "elb", "rds"], [
      { t: "p", html: "An Availability Zone is one or more data centers with independent power and networking; a Region has several. The default resilient shape is <strong>stateless compute spread across at least two AZs behind a load balancer</strong>, with a managed data tier that fails over on its own." },
      { t: "widget", id: "suAzPlanner" },
      { t: "table", headers: ["Feature", "Purpose", "Readable copy?"], rows: [
        ["Multi-AZ standby (managed relational DB)", "Automatic failover for availability", "Classic standby: no"],
        ["Read replica", "Scale reads; can be promoted manually", "Yes, asynchronous"],
        ["Aurora replicas", "Reads plus fast failover targets", "Yes"]
      ] },
      { t: "ul", items: ["Application Load Balancer: HTTP/HTTPS, path and host routing.", "Network Load Balancer: TCP/UDP, very high throughput, static IPs per AZ.", "Auto Scaling group: replaces unhealthy instances and scales on metrics.", "Keep session state out of instances (cache or database) so any instance can serve any request."] },
      { t: "note", variant: "trap", html: "Read replicas improve read throughput; they are not the primary answer for <em>automatic failover</em>. Multi-AZ is." },
      { t: "note", variant: "key", html: "Two or more AZs, a load balancer, an Auto Scaling group, stateless instances and a Multi-AZ data tier: that is the baseline highly available pattern." }
    ], [
      Q("A web tier runs on two instances in one AZ. The business wants it to survive an AZ outage with minimal changes. What should you do?", "Use an Auto Scaling group spanning at least two AZs behind a load balancer", ["Increase the instance size", "Add a second instance in the same AZ", "Take nightly snapshots of both instances"], "Spreading instances across AZs behind a load balancer removes the single-AZ failure point. Larger instances and more instances in the same AZ still fail together, and snapshots help recovery, not availability."),
      Q("A relational database must fail over automatically if its AZ fails. Which feature is designed for this?", "Multi-AZ deployment", ["A read replica in the same AZ", "Manual snapshots copied hourly", "A larger storage volume"], "Multi-AZ maintains a synchronous standby in another AZ and fails over automatically. Read replicas are asynchronous and typically need manual promotion; snapshots require a restore."),
      Q("Reporting queries are slowing down the primary database. What is the most direct fix?", "Add a read replica and point reporting at it", ["Enable Multi-AZ so the standby serves reports", "Increase the backup retention period", "Move the database to a single AZ"], "Read replicas offload read traffic. A classic Multi-AZ standby is not readable, and backup retention does not change query load."),
      Q("Users are logged out whenever the Auto Scaling group replaces an instance. What is the likely root cause?", "Session state is stored on the individual instances", ["The load balancer is in the wrong subnet", "The instances use the wrong AMI architecture", "Health checks are too lenient"], "If sessions live in instance memory, losing the instance loses the session. Moving sessions to a shared store such as a cache or database makes instances interchangeable."),
      Q("A service needs a load balancer for millions of TCP connections with a static IP per AZ. Which fits best?", "Network Load Balancer", ["Application Load Balancer", "A single EC2 instance running a proxy", "An internet gateway"], "Network Load Balancers operate at layer 4, handle very high connection volumes, and provide static IP addresses per AZ. Application Load Balancers focus on HTTP routing features."),
      Q("Which statement about Availability Zones is accurate?", "AZs in a Region are isolated from each other's failures but connected by low-latency links", ["Each AZ is a separate Region with its own APIs", "Placing two instances in one AZ protects against AZ failure", "AZs share one power source to simplify failover"], "AZs are designed to fail independently while staying close enough for synchronous replication, which is what makes Multi-AZ patterns practical.")
    ]),

    L("decoupling", "Decoupling with queues, topics and events", "SQS, SNS and event buses absorb spikes and isolate failures.", 9, ["sqs", "sns", "eventbridge"], [
      { t: "p", html: "If producer and consumer talk directly, the slowest one sets the pace and a crash ripples outward. Put a buffer between them. A <strong>queue</strong> holds work until a consumer pulls it; a <strong>topic</strong> pushes one message to many subscribers; an <strong>event bus</strong> routes events by rules." },
      { t: "table", headers: ["Service", "Pattern", "Key behaviours"], rows: [
        ["SQS standard", "Queue, pull", "At-least-once delivery; best-effort ordering; very high throughput"],
        ["SQS FIFO", "Queue, pull", "Ordering per message group; deduplication; lower throughput ceiling"],
        ["SNS", "Pub/sub, push", "Fan-out to queues, functions, HTTP and email"],
        ["EventBridge", "Event bus", "Rule-based routing, SaaS and AWS service events, schedules"]
      ] },
      { t: "h", text: "Queue mechanics worth knowing" },
      { t: "ul", items: ["<strong>Visibility timeout</strong>: a received message is hidden while a consumer works; set it longer than processing time or duplicates appear.", "<strong>Dead-letter queue</strong>: messages that fail repeatedly move aside for inspection.", "<strong>Long polling</strong> reduces empty responses and cost.", "Scale consumers on queue depth (messages visible) rather than CPU alone."] },
      { t: "note", variant: "tip", html: "SNS-to-multiple-SQS fan-out lets each downstream system consume at its own pace and retry independently." },
      { t: "note", variant: "trap", html: "Standard queues can deliver a message more than once. Consumers must be idempotent unless you choose FIFO with deduplication." },
      { t: "note", variant: "key", html: "Queues buffer and isolate, topics fan out, event buses route. Tune visibility timeout, add a DLQ, and make consumers idempotent." }
    ], [
      Q("An order service must process payments strictly in the order they were placed for each customer, without duplicates. Which option fits?", "SQS FIFO queue using the customer ID as the message group", ["SQS standard queue with more consumers", "SNS topic with email subscriptions", "A single EC2 instance polling a database table"], "FIFO queues preserve order within a message group and support deduplication. Standard queues give best-effort ordering and at-least-once delivery."),
      Q("Workers occasionally process the same SQS message twice, and processing takes up to 4 minutes. The visibility timeout is 30 seconds. What should you change first?", "Raise the visibility timeout above the maximum processing time", ["Lower the visibility timeout to 5 seconds", "Switch to SNS", "Disable long polling"], "If the timeout expires before processing finishes, the message becomes visible again and another worker picks it up. A timeout longer than processing time prevents that."),
      Q("One upload event must trigger thumbnail creation, virus scanning and metadata indexing, each scaling independently. Which design is best?", "Publish to an SNS topic that fans out to three SQS queues", ["One SQS queue read by all three services", "Three cron jobs scanning the bucket", "Synchronous calls from the upload API to all three"], "Fan-out gives each consumer its own queue, so a slow or failing consumer does not block the others. A single shared queue would deliver each message to only one consumer."),
      Q("Some messages fail processing forever and keep returning to the queue. What helps isolate them?", "Configure a dead-letter queue with a maximum receive count", ["Increase the message retention period", "Switch the queue to FIFO", "Reduce the number of consumers"], "A DLQ moves messages after a set number of failed receives so they stop blocking normal processing and can be inspected."),
      Q("A traffic spike briefly exceeds what the backend can process. Which change best protects the backend?", "Place a queue in front and scale consumers on queue depth", ["Increase the client retry rate", "Remove the load balancer", "Return errors for all requests during peaks"], "A queue absorbs bursts and lets consumers drain at a sustainable rate, with scaling driven by backlog. Faster retries add load."),
      Q("You need to route events from several AWS services and a SaaS partner to different targets based on event content. What fits best?", "EventBridge rules on an event bus", ["SQS standard queue with a single consumer", "Amazon S3 event notifications only", "A NAT gateway"], "EventBridge matches events against rules and routes them to targets, including partner event sources. A single queue lacks content-based routing.")
    ]),

    L("dr-strategies", "Disaster recovery strategies", "Match RTO and RPO to backup-restore, pilot light, warm standby or multi-site.", 10, ["dr", "rto", "rpo"], [
      { t: "p", html: "Two numbers drive every DR answer. <strong>RPO</strong>: how much data loss is acceptable, measured back in time. <strong>RTO</strong>: how long the service may be down. Tighter numbers cost more standing infrastructure." },
      { t: "table", headers: ["Strategy", "What runs in the recovery Region", "RTO / RPO feel", "Standing cost"], rows: [
        ["Backup and restore", "Nothing; backups only", "Hours / hours", "Lowest"],
        ["Pilot light", "Data replicated; core services off or minimal", "Tens of minutes / minutes", "Low"],
        ["Warm standby", "Scaled-down full stack, running", "Minutes / seconds-minutes", "Medium"],
        ["Multi-site active/active", "Full capacity serving traffic", "Near zero / near zero", "Highest"]
      ] },
      { t: "widget", id: "suDrPicker" },
      { t: "ul", items: ["Automate recovery with infrastructure as code; manual runbooks stretch RTO.", "Test failover regularly; an untested DR plan is a hypothesis.", "Cross-Region backup copies and replication protect against Region-level events.", "DNS health checks or global routing can shift traffic once the recovery site is ready."] },
      { t: "note", variant: "trap", html: "When a question says <em>most cost-effective</em> and the RTO is generous (hours), backup and restore usually wins. Do not overbuild." },
      { t: "note", variant: "key", html: "Read RTO and RPO first, then choose the cheapest strategy that meets both; automate and test it." }
    ], [
      Q("A workload can tolerate up to 24 hours of downtime and 12 hours of data loss. Which DR strategy is most cost-effective?", "Backup and restore to another Region", ["Multi-site active/active", "Warm standby", "Pilot light with continuous replication"], "Generous RTO and RPO allow restoring from periodic backups into new infrastructure, which carries the lowest standing cost. The other options pay for idle or running capacity you do not need."),
      Q("The database must lose at most a few minutes of data, but the app can take 30 to 60 minutes to come back. Which strategy fits best?", "Pilot light: continuously replicate data and launch compute on failover", ["Backup and restore from weekly snapshots", "Multi-site active/active", "No DR; rely on a single AZ"], "Continuous replication meets a minutes-level RPO while keeping compute off until needed, which keeps cost low and RTO within an hour."),
      Q("Which strategy keeps a smaller, fully functional copy of production running so it can be scaled up quickly?", "Warm standby", ["Pilot light", "Backup and restore", "Cold archive"], "Warm standby runs every component at reduced capacity, so recovery is mostly scaling up. Pilot light keeps only the core data layer live."),
      Q("What does RPO describe?", "The maximum acceptable data loss measured in time", ["The maximum acceptable downtime", "The time to detect an incident", "The cost of the recovery site"], "Recovery point objective is how far back in time you can afford to lose data. Recovery time objective is how long the service may be unavailable."),
      Q("A team has a documented DR plan but has never executed it. What is the most important next step?", "Run a scheduled failover test and fix what breaks", ["Print the plan for each engineer", "Increase backup frequency only", "Buy more Reserved Instances in the DR Region"], "Untested plans regularly fail on details like missing permissions or stale images. Testing exposes those gaps while there is time to fix them."),
      Q("Near-zero RTO and RPO are required for a global customer-facing service. Which strategy fits?", "Multi-site active/active across Regions", ["Backup and restore", "Pilot light", "Single-Region Multi-AZ only"], "Only active/active keeps full capacity serving traffic in more than one place, avoiding both downtime and meaningful data loss. Multi-AZ alone does not cover a Region-wide event.")
    ]),

    L("dns-failover", "DNS routing, health checks and the edge", "Route 53 routing policies, failover and global entry points.", 8, ["route53", "cloudfront"], [
      { t: "p", html: "DNS is the first decision in every request. Route 53 can answer differently based on health, latency, location or weights, which turns DNS into a coarse traffic controller." },
      { t: "table", headers: ["Routing policy", "Use when"], rows: [
        ["Simple", "One resource, no special logic"],
        ["Failover", "Active-passive: secondary answers when the primary health check fails"],
        ["Weighted", "Split traffic by percentage (canary, migrations)"],
        ["Latency-based", "Send users to the Region with the lowest latency for them"],
        ["Geolocation", "Answer by user location (compliance, localized content)"],
        ["Geoproximity", "Bias traffic toward resources by distance, adjustable"],
        ["Multivalue answer", "Return several healthy records for simple client-side spreading"]
      ] },
      { t: "compare", bad: { title: "CloudFront", items: ["Caches HTTP(S) content at edge locations", "Great for static and cacheable dynamic content", "Origin can be S3, a load balancer or custom"] }, good: { title: "Global Accelerator", items: ["Static anycast IPs into the AWS network", "Works for TCP and UDP, not a cache", "Fast Regional failover without DNS caching delays"] } },
      { t: "note", variant: "tip", html: "DNS answers are cached by resolvers for the TTL, so DNS-based failover is not instant. If a scenario needs fast failover with fixed IPs for non-HTTP traffic, think Global Accelerator." },
      { t: "note", variant: "key", html: "Pick the routing policy from the requirement word: failover, weighted, latency, geolocation. Use CloudFront for caching HTTP and Global Accelerator for static IPs and fast non-HTTP failover." }
    ], [
      Q("A company wants 10% of users to hit a new application version while 90% stay on the old one. Which Route 53 policy fits?", "Weighted routing", ["Failover routing", "Geolocation routing", "Simple routing"], "Weighted routing splits traffic by assigned weights, which suits canary releases. Failover is for active-passive, geolocation is for location rules."),
      Q("Users in each country must be served from infrastructure in a specific Region for regulatory reasons. Which policy fits?", "Geolocation routing", ["Latency-based routing", "Weighted routing", "Multivalue answer routing"], "Geolocation answers based on where the user is, which enforces location rules. Latency routing optimizes speed and may send users across borders."),
      Q("An active-passive setup should send traffic to a standby site only when the primary is unhealthy. What do you configure?", "Failover routing with a health check on the primary", ["Weighted routing with equal weights", "Simple routing with two IPs", "Geoproximity with a large bias"], "Failover routing answers with the secondary record when the primary's health check fails. Equal weights would send half the traffic to the standby all the time."),
      Q("A gaming backend uses UDP and needs static IP addresses with fast failover between Regions. Which service fits best?", "Global Accelerator", ["CloudFront", "An S3 website endpoint", "Route 53 simple routing"], "Global Accelerator provides static anycast IPs, supports TCP and UDP, and shifts traffic quickly without waiting for DNS caches. CloudFront focuses on HTTP caching."),
      Q("Static assets are slow for users far from the origin Region. What is the most effective improvement?", "Serve the assets through CloudFront", ["Move to a larger instance type", "Use Route 53 failover routing", "Enable Multi-AZ on the database"], "CloudFront caches content at edge locations near users, reducing latency and origin load. The other changes do not shorten the network distance."),
      Q("Why can DNS-based failover take longer than expected?", "Resolvers and clients cache records until the TTL expires", ["Route 53 checks health only once a day", "DNS records cannot point to load balancers", "Failover records require manual approval"], "Cached answers keep pointing to the old endpoint until they expire. Lower TTLs shorten this window at the cost of more queries.")
    ])
  ];

  var performant = [
    L("compute-choice", "Choosing compute: instances, containers, functions", "Match the workload shape to EC2, containers or serverless.", 9, ["ec2", "lambda", "containers"], [
      { t: "p", html: "Ask three questions: how long does each unit of work run, how much control over the host do you need, and how spiky is demand? The answer usually lands on one of three shapes." },
      { t: "table", headers: ["Shape", "Strong fit", "Watch out for"], rows: [
        ["EC2 instances", "Long-running, custom OS or licensing, special hardware", "You patch and scale it"],
        ["Containers on ECS/EKS (EC2 or Fargate)", "Microservices, consistent packaging, steady services", "Orchestration learning curve"],
        ["Lambda functions", "Event-driven, short tasks, spiky or idle traffic", "Execution time limit, cold starts, per-invocation pricing at high volume"]
      ] },
      { t: "ul", items: ["Fargate removes node management for containers; you size tasks, not servers.", "Instance families signal purpose: compute optimized, memory optimized, storage optimized, accelerated computing.", "Placement groups: cluster for low-latency HPC, spread for isolating critical instances, partition for large distributed systems.", "Batch-style work tolerant of interruption pairs well with Spot capacity."] },
      { t: "note", variant: "trap", html: "A task that runs for hours is a poor match for Lambda's execution time limit. Look for containers, Batch or EC2 instead." },
      { t: "note", variant: "key", html: "Short and spiky: functions. Packaged services: containers (Fargate for least ops). Long-running or host-specific: instances." }
    ], [
      Q("An image-processing job runs a few seconds per upload, uploads are unpredictable, and the team wants zero server management. What fits best?", "Lambda triggered by the upload event", ["A fleet of always-on EC2 instances", "A dedicated host", "An EKS cluster on self-managed nodes"], "Short, event-driven work with idle periods suits functions: no servers to manage and no cost while idle. Always-on fleets pay for unused capacity."),
      Q("A team wants to run containers without provisioning or patching EC2 instances. Which option fits?", "ECS or EKS with Fargate", ["EC2 Auto Scaling with a custom AMI", "Lambda with a 15-hour timeout", "Elastic Beanstalk on a single instance"], "Fargate runs containers on infrastructure that AWS manages, so you size tasks instead of servers. Lambda has a much shorter execution limit."),
      Q("A tightly coupled HPC workload needs the lowest possible network latency between instances. Which placement strategy fits?", "Cluster placement group", ["Spread placement group", "Partition placement group across Regions", "Instances spread over three AZs"], "Cluster placement packs instances close together within one AZ for low latency and high throughput. Spread placement maximizes isolation, which works against latency."),
      Q("A legacy application requires a specific OS configuration and runs continuously. Which compute option is most appropriate?", "EC2 instances", ["Lambda functions", "Fargate tasks with no OS access", "Step Functions only"], "When you need OS-level control for a long-running process, instances are the natural fit. Functions and Fargate abstract away the host."),
      Q("An in-memory analytics workload needs a high RAM-to-vCPU ratio. Which instance family category should you look at?", "Memory optimized", ["Compute optimized", "Storage optimized", "Burstable general purpose"], "Memory-optimized families offer large amounts of RAM per vCPU, suiting in-memory databases and analytics. Compute-optimized families favour CPU."),
      Q("A nightly batch job can be interrupted and restarted without harm. How can you reduce compute cost most?", "Run it on Spot capacity", ["Run it on Dedicated Hosts", "Buy On-Demand capacity reservations", "Use the largest instance available"], "Spot offers deep discounts for capacity that can be reclaimed. Interruption-tolerant batch work is the classic fit.")
    ]),

    L("storage-choice", "Choosing storage: object, block, file", "S3, EBS, EFS and FSx and the access pattern each one serves.", 9, ["s3", "ebs", "efs", "fsx"], [
      { t: "p", html: "Storage questions turn on <strong>how the data is accessed</strong>: over HTTP as whole objects, as a disk attached to one machine, or as a shared file system mounted by many." },
      { t: "table", headers: ["Service", "Model", "Shared?", "Typical fit"], rows: [
        ["S3", "Object over HTTP API", "Yes, via API", "Data lakes, backups, static content, logs"],
        ["EBS", "Block volume in one AZ", "Usually one instance", "Boot disks, databases on EC2"],
        ["Instance store", "Ephemeral local disk", "No", "Caches, scratch, buffers"],
        ["EFS", "NFS file system across AZs", "Yes, many Linux clients", "Shared content, home directories"],
        ["FSx for Windows File Server", "SMB file system", "Yes, Windows clients", "Windows apps, AD-integrated shares"],
        ["FSx for Lustre", "High-performance parallel FS", "Yes", "HPC, ML training, can link to S3"]
      ] },
      { t: "ul", items: ["EBS volume types trade cost for IOPS: general purpose SSD for most, provisioned IOPS SSD for demanding databases, throughput HDD for large sequential reads.", "EBS snapshots are stored regionally and can be copied across Regions.", "Instance store data is lost when the instance stops or fails.", "S3 is designed for very high durability; durability is not the same as availability."] },
      { t: "note", variant: "trap", html: "If many EC2 instances in several AZs must read and write the same files, EBS is the wrong answer; EFS (Linux) or FSx (Windows) is the right family." },
      { t: "note", variant: "key", html: "Objects over an API: S3. A disk for one instance: EBS. Shared POSIX files: EFS. Windows SMB or HPC: FSx." }
    ], [
      Q("Twenty Linux instances across three AZs must share the same directory of files with read/write access. What fits best?", "Amazon EFS", ["One EBS volume attached to all instances", "Instance store on each instance", "S3 Glacier Deep Archive"], "EFS is a managed NFS file system that many Linux clients can mount across AZs. EBS volumes live in one AZ and are typically attached to a single instance."),
      Q("A Windows application needs an SMB file share integrated with Active Directory. Which service fits?", "FSx for Windows File Server", ["EFS", "FSx for Lustre", "EBS Multi-Attach"], "FSx for Windows File Server provides native SMB and Active Directory integration. EFS is NFS for Linux clients, and Lustre targets high-performance computing."),
      Q("A database on EC2 needs consistent, high IOPS for its data volume. Which EBS choice is most appropriate?", "Provisioned IOPS SSD", ["Throughput optimized HDD", "Cold HDD", "Instance store only"], "Provisioned IOPS SSD volumes deliver predictable high IOPS for demanding transactional workloads. HDD types favour large sequential throughput, and instance store loses data on stop."),
      Q("An application needs a fast temporary scratch space; losing the data on reboot or stop is acceptable. What is the most cost-effective option?", "Instance store", ["Provisioned IOPS EBS", "EFS with provisioned throughput", "S3 with versioning"], "Instance store is local to the host and included in the instance price, which suits scratch data. Its contents are not preserved if the instance stops or fails."),
      Q("An ML training job reads a large dataset at very high throughput and the data's source of truth lives in S3. Which service fits?", "FSx for Lustre linked to the S3 bucket", ["EFS with default settings", "EBS cold HDD", "Glacier Flexible Retrieval"], "FSx for Lustre provides a parallel file system for high-throughput compute and can present S3 data as files. The others are slower or not designed for this pattern."),
      Q("Which statement about EBS is correct?", "A volume lives in a single AZ, and snapshots can be used to recreate it in another AZ", ["A volume is automatically replicated to every Region", "Volumes can be mounted by thousands of instances over NFS", "EBS volumes cannot be backed up"], "EBS volumes are AZ-scoped. Snapshots let you create new volumes in other AZs or copy them to other Regions.")
    ]),

    L("database-choice", "Choosing databases", "Relational, key-value, in-memory and warehouse, matched to access patterns.", 10, ["rds", "aurora", "dynamodb", "redshift"], [
      { t: "p", html: "Start from the query, not the product. Joins and transactions across entities point relational. Known key lookups at massive scale point key-value. Sub-millisecond repeated reads point to a cache. Large scans and aggregations over history point to a warehouse." },
      { t: "table", headers: ["Need", "Good fit", "Why"], rows: [
        ["Relational, managed, common engines", "RDS", "Managed backups, patching, Multi-AZ"],
        ["Relational with high performance and many replicas", "Aurora", "Distributed storage, fast replicas and failover"],
        ["Key-value at any scale, single-digit ms", "DynamoDB", "Serverless, partitions automatically"],
        ["Microsecond reads in front of DynamoDB", "DAX", "Write-through cache for DynamoDB"],
        ["General caching, sessions, leaderboards", "ElastiCache", "In-memory Redis- or Memcached-compatible"],
        ["Analytics over large historical data", "Redshift", "Columnar MPP warehouse"]
      ] },
      { t: "ul", items: ["DynamoDB capacity: on-demand for unpredictable traffic, provisioned (with auto scaling) for steady traffic.", "Global tables replicate DynamoDB across Regions for multi-Region active writes.", "Design DynamoDB keys around access patterns; a hot partition key throttles.", "Aurora Serverless suits intermittent or unpredictable relational workloads."] },
      { t: "note", variant: "trap", html: "Running analytical scans on the transactional database is a classic anti-pattern in scenarios. Move analytics to a warehouse or replica." },
      { t: "note", variant: "key", html: "Joins and transactions: relational. Known-key at scale: DynamoDB. Hot repeated reads: a cache. Big aggregations: a warehouse." }
    ], [
      Q("A mobile game stores player profiles accessed by player ID, with unpredictable spikes to millions of requests. Which database fits best?", "DynamoDB with on-demand capacity", ["A single RDS instance", "Redshift", "EBS with a custom key-value store"], "Key-based access at large and spiky scale suits DynamoDB, and on-demand capacity absorbs unpredictable traffic without capacity planning."),
      Q("A DynamoDB-backed product catalog needs microsecond read latency for hot items with minimal code change. What should you add?", "DynamoDB Accelerator (DAX)", ["A read replica of DynamoDB", "Redshift Spectrum", "A larger EBS volume"], "DAX is an in-memory cache built for DynamoDB that is API-compatible, so applications get microsecond reads with little change."),
      Q("Analysts run heavy aggregation queries over years of sales history. Which service is designed for this?", "Redshift", ["DynamoDB", "ElastiCache", "EFS"], "Redshift is a columnar, massively parallel warehouse optimized for large scans and aggregations. Key-value stores and caches are not built for analytical queries."),
      Q("A relational workload needs high performance, many read replicas and fast failover with minimal administration. Which option fits?", "Aurora", ["DynamoDB", "Self-managed MySQL on EC2", "S3 Select"], "Aurora uses a distributed storage layer shared by replicas, supporting fast failover and read scaling while remaining relational and managed."),
      Q("A DynamoDB table throttles even though total provisioned capacity is far above usage. What is a likely cause?", "A hot partition key concentrating traffic on few partitions", ["The table has too many attributes", "Encryption at rest is enabled", "The table is in a private subnet"], "Throughput is spread across partitions. If most requests hit one key value, that partition throttles while others sit idle. Choose higher-cardinality keys."),
      Q("An application needs a managed store for user sessions shared by all web servers, with very fast reads and writes. What fits best?", "ElastiCache", ["Redshift", "S3 Glacier", "EBS snapshots"], "An in-memory cache provides fast shared access for sessions, letting web servers remain stateless.")
    ]),

    L("caching-edge", "Caching and edge performance", "Where to cache, how to keep it fresh, and what to read in a scenario.", 8, ["cache", "cloudfront", "elasticache"], [
      { t: "p", html: "Every cache trades freshness for speed. Your job is to put the cache as close to the reader as the data's freshness allows: the edge for public static content, an in-memory store for computed results, a read replica for heavy read SQL." },
      { t: "table", headers: ["Layer", "Caches", "Freshness lever"], rows: [
        ["CloudFront", "HTTP responses at the edge", "TTLs, cache keys, invalidations, versioned file names"],
        ["ElastiCache", "Query results, sessions, computed objects", "TTL per key, write-through or lazy loading"],
        ["DAX", "DynamoDB reads", "Item and query cache TTLs"],
        ["Read replica", "Entire database for reads", "Replication lag"]
      ] },
      { t: "compare", bad: { title: "Lazy loading (cache-aside)", items: ["Only requested data is cached", "First read after a miss is slow", "Can serve stale data until TTL"] }, good: { title: "Write-through", items: ["Cache updated on every write", "Reads are consistently warm", "Writes cost more; unused data may be cached"] } },
      { t: "note", variant: "tip", html: "Versioned asset names (app.v42.js) avoid paying for invalidations and dodge stale-cache problems entirely." },
      { t: "note", variant: "key", html: "Cache at the closest layer the freshness requirement allows, and choose lazy loading or write-through on purpose." }
    ], [
      Q("A news site's article pages are identical for all readers and change a few times an hour. What reduces origin load most?", "Cache pages in CloudFront with a short TTL", ["Add more origin instances only", "Use Provisioned IOPS volumes", "Enable Multi-AZ on the database"], "Edge caching serves repeated requests without touching the origin, and a short TTL bounds staleness. More origin capacity still serves every request."),
      Q("Which caching strategy keeps the cache consistently up to date on every write at the cost of extra write work?", "Write-through", ["Lazy loading", "No-cache", "TTL-only expiry"], "Write-through updates the cache whenever data is written, so reads find fresh data. Lazy loading only fills the cache on misses."),
      Q("A team keeps paying for CloudFront invalidations after each deployment. What is a better approach?", "Use versioned file names for static assets", ["Disable caching entirely", "Set TTLs to one year without versioning", "Serve assets directly from EC2"], "Changing the file name on each release means browsers and edges request the new object naturally, with no invalidation needed."),
      Q("A dashboard runs the same expensive SQL aggregate thousands of times a minute, and results may be up to 60 seconds old. What is the best improvement?", "Cache the result in ElastiCache with a 60-second TTL", ["Add a second primary database", "Increase the database storage size", "Move the query to a Lambda function without caching"], "Caching the computed result with a TTL matching the allowed staleness removes most of the repeated work from the database."),
      Q("What is a drawback of lazy loading?", "A cache miss adds latency and data can be stale until it expires", ["Every write must update the cache", "It caches all data regardless of use", "It cannot use TTLs"], "Lazy loading fetches on a miss, so first reads are slow, and cached values remain until TTL or eviction even if the source changed."),
      Q("Read-heavy SQL traffic overwhelms a primary database, but queries vary too much to cache results. What helps most?", "Add read replicas and route reads to them", ["Add CloudFront in front of the database", "Switch to Glacier storage", "Lower the database instance size"], "When results are too varied to cache, offloading reads to replicas scales read capacity. CloudFront caches HTTP responses, not database connections.")
    ])
  ];

  var cost = [
    L("pricing-models", "Compute pricing models", "On-Demand, Savings Plans, Reserved Instances and Spot, and when each wins.", 8, ["pricing", "spot", "savings-plans"], [
      { t: "p", html: "Pricing is a commitment-versus-flexibility trade. The more you promise up front (usage level, term) or the more interruption you tolerate, the lower the rate." },
      { t: "table", headers: ["Model", "You commit to", "Best for"], rows: [
        ["On-Demand", "Nothing", "Short, unpredictable, or new workloads"],
        ["Savings Plans (compute)", "A spend per hour over a term", "Steady usage that may change instance family, Region or move to Fargate/Lambda"],
        ["Savings Plans (instance family)", "Spend per hour on a family in a Region", "Steady usage within one family; deeper discount"],
        ["Reserved Instances", "Specific instance attributes over a term", "Steady, well-understood fleets; also some managed databases"],
        ["Spot", "Accepting interruption", "Fault-tolerant, flexible, stateless or batch work"]
      ] },
      { t: "ul", items: ["Cover the steady baseline with commitments; burst with On-Demand or Spot.", "Spot works best when spread across several instance types and AZs.", "Capacity reservations guarantee capacity in an AZ but are not a discount by themselves.", "Right-size before committing; a commitment locks in waste too."] },
      { t: "note", variant: "trap", html: "Spot is the wrong answer for a database or any workload that cannot tolerate interruption, no matter how cheap the scenario makes it sound." },
      { t: "note", variant: "key", html: "Baseline on commitments, spikes on On-Demand, interruption-tolerant work on Spot, and right-size first." }
    ], [
      Q("A company runs a steady baseline of compute 24/7 but expects to migrate some workloads from EC2 to Fargate and Lambda over the next year. Which option maximizes savings with flexibility?", "Compute Savings Plans", ["Standard Reserved Instances for one instance type", "Spot Instances for everything", "Dedicated Hosts"], "Compute Savings Plans apply across instance families, Regions and to Fargate and Lambda, so the discount follows the workload as it changes."),
      Q("A video transcoding pipeline is stateless, checkpoints progress and can retry any job. How can it run most cheaply?", "Spot Instances across multiple instance types and AZs", ["On-Demand only", "Reserved Instances for peak capacity", "Dedicated Instances"], "Spot provides large discounts, and diversifying across types and AZs reduces the impact of interruptions for fault-tolerant work."),
      Q("A new application has unknown traffic for its first few months. Which pricing model is the safest starting point?", "On-Demand until usage patterns are known", ["Three-year Reserved Instances", "Spot for the production database", "Dedicated Hosts for flexibility"], "Committing before you know the baseline risks paying for capacity you do not use. Start flexible, observe, then commit."),
      Q("What is the right order of operations before buying a commitment?", "Right-size and remove idle resources, then commit to the remaining baseline", ["Commit first, then right-size", "Buy commitments for peak usage", "Commit only for development accounts"], "Commitments lock in a spend level. Right-sizing first ensures you commit to real, efficient usage rather than waste."),
      Q("A critical workload must be guaranteed capacity in a specific AZ during a known event. What provides that guarantee?", "An On-Demand capacity reservation", ["Spot Instances", "A Savings Plan alone", "A larger Auto Scaling maximum"], "Capacity reservations hold capacity in an AZ. Savings Plans give a pricing discount but do not reserve capacity, and Spot can be reclaimed."),
      Q("Which workload is the poorest fit for Spot?", "A single-instance relational database with no failover", ["A batch analytics job that can restart", "A CI build fleet", "Stateless web workers behind a load balancer with mixed capacity"], "Interruptions would take a lone database down. Spot suits workloads that tolerate the loss of individual instances.")
    ]),

    L("storage-cost", "Storage cost optimization", "Storage classes, lifecycle rules and right-sizing volumes.", 8, ["s3", "lifecycle", "cost"], [
      { t: "p", html: "Storage cost hides in three places: the class you store in, how long data lingers, and volumes provisioned far beyond need. Lifecycle rules and the right class fix most of it automatically." },
      { t: "widget", id: "suS3Tier" },
      { t: "ul", items: ["Lifecycle rules can transition objects to cheaper classes and expire them after a period.", "Infrequent-access and archive classes charge retrieval fees and have minimum storage durations.", "Intelligent-Tiering moves objects between tiers based on access, for a small monitoring fee.", "Expire old object versions and incomplete multipart uploads; both quietly accumulate cost.", "Right-size EBS: switch to a cheaper general-purpose type when provisioned IOPS are unused; delete unattached volumes and stale snapshots."] },
      { t: "note", variant: "trap", html: "Moving tiny, short-lived objects into infrequent-access classes can cost <em>more</em> because of minimum size and duration charges." },
      { t: "note", variant: "key", html: "Pick the class from access frequency and retrieval tolerance, automate transitions with lifecycle rules, and clean up versions, uploads and orphaned volumes." }
    ], [
      Q("Logs are queried often for 30 days, rarely for a year, and must then be retained cheaply for several years with retrieval within a day being acceptable. What is the best plan?", "Lifecycle rules: Standard, then an infrequent-access class, then Deep Archive", ["Keep everything in Standard forever", "Store logs on EBS volumes", "Delete logs after 30 days"], "Lifecycle transitions match cost to the declining access pattern, and Deep Archive is the lowest-cost class when slow retrieval is acceptable."),
      Q("A dataset's access pattern is unknown and changes unpredictably. Which storage class reduces cost without manual analysis?", "S3 Intelligent-Tiering", ["S3 One Zone-IA", "Glacier Deep Archive", "Standard with no lifecycle"], "Intelligent-Tiering monitors access and moves objects between tiers automatically, which suits unknown or shifting patterns."),
      Q("Thumbnails can be regenerated from originals at any time. Which class is a reasonable lower-cost choice for infrequently accessed thumbnails?", "S3 One Zone-IA", ["Glacier Deep Archive", "Provisioned IOPS EBS", "S3 Standard with replication to two Regions"], "One Zone-IA is cheaper because data is kept in a single AZ. That is acceptable for data you can re-create."),
      Q("A bucket with versioning enabled keeps growing in cost although the current data size is flat. What is a likely fix?", "Add a lifecycle rule to expire noncurrent versions", ["Disable encryption", "Switch to a different Region", "Increase the object size limit"], "With versioning, overwritten and deleted objects keep noncurrent versions that are still billed. Expiring them controls growth."),
      Q("Archived compliance records must be readable within milliseconds when auditors ask, which happens a few times a year. Which class fits?", "Glacier Instant Retrieval", ["Glacier Deep Archive", "S3 Standard", "Glacier Flexible Retrieval with bulk retrieval"], "Instant Retrieval offers archive pricing with millisecond access, suiting rarely accessed data that must be available immediately."),
      Q("Which practice most directly reduces wasted block storage spend?", "Delete unattached volumes and right-size over-provisioned ones", ["Enable termination protection on all instances", "Use larger volumes for headroom", "Take more frequent snapshots"], "Unattached and oversized volumes cost money without serving any workload. Removing or resizing them cuts spend directly.")
    ]),

    L("network-cost", "Data transfer and network cost", "Where transfer charges come from and the designs that avoid them.", 8, ["network", "cost", "nat"], [
      { t: "p", html: "Network cost follows data across boundaries. Data coming in from the internet is generally free; data going out to the internet, between Regions, and between AZs is where charges appear. NAT gateways add a per-GB processing fee on top." },
      { t: "table", headers: ["Pattern", "Cost driver", "Cheaper alternative"], rows: [
        ["Private subnets pulling large data from S3 through NAT", "NAT processing per GB", "Gateway endpoint for S3"],
        ["Serving static assets from EC2 to global users", "Internet egress from origin", "CloudFront caching (lower origin egress)"],
        ["Chatty microservices across AZs", "Inter-AZ transfer", "Keep tightly coupled traffic AZ-local where resilience allows"],
        ["Replicating data to another Region", "Inter-Region transfer", "Replicate only what DR or latency requires"]
      ] },
      { t: "note", variant: "tip", html: "Scenario hint: <em>a large NAT gateway bill</em> almost always points to service traffic (S3, DynamoDB) that should use VPC endpoints." },
      { t: "note", variant: "trap", html: "Do not trade away resilience to save transfer cost. Multi-AZ is usually worth the inter-AZ charge for production." },
      { t: "note", variant: "key", html: "Follow data across boundaries: endpoints remove NAT fees for AWS services, CloudFront cuts origin egress, and replication should be deliberate." }
    ], [
      Q("A data pipeline in private subnets downloads terabytes from S3 each day, and the NAT gateway bill is large. What is the most effective fix?", "Add an S3 gateway endpoint and route S3 traffic through it", ["Add more NAT gateways", "Move the pipeline to public subnets with no security groups", "Compress data after it arrives"], "Gateway endpoints carry S3 traffic privately without NAT processing charges. Moving to public subnets weakens security and compression after download does not change the transfer."),
      Q("Which data transfer is generally free?", "Data transferred into AWS from the internet", ["Data transferred out to the internet", "Data transferred between Regions", "Data processed by a NAT gateway"], "Inbound internet transfer is generally not charged, while egress, inter-Region transfer and NAT processing are billed."),
      Q("A global audience downloads large static files from an origin on EC2. How can you reduce cost and improve speed?", "Serve the files through CloudFront", ["Add a NAT gateway", "Use Provisioned IOPS volumes", "Enable Multi-AZ on the origin database"], "CloudFront caches files at the edge, reducing repeated egress from the origin and lowering latency for users."),
      Q("Two microservices exchange very high volumes of data and are deployed in different AZs. What should an architect consider?", "Whether some tightly coupled traffic can stay within an AZ without hurting resilience", ["Moving one service to another Region", "Replacing the services with a single NAT gateway", "Disabling health checks"], "Inter-AZ transfer is billed, so heavy chatter between AZs adds up. Keeping traffic AZ-local where appropriate reduces cost, while still running each service in multiple AZs for resilience."),
      Q("A team replicates its entire data lake to a second Region but only a small subset is needed for disaster recovery. What is the cost-aware change?", "Replicate only the data required by the DR plan", ["Replicate to a third Region as well", "Stop all backups", "Move the data lake to EBS"], "Inter-Region replication is billed per GB. Scoping replication to what recovery actually needs cuts cost without weakening the plan."),
      Q("Why might moving an application from private subnets behind NAT to use interface endpoints for several AWS services reduce cost?", "It avoids NAT data processing for that traffic, though endpoints have their own hourly and per-GB charges", ["Interface endpoints are always free", "It removes all data transfer charges in the account", "It eliminates the need for IAM policies"], "Interface endpoints have their own charges, so the saving depends on volume. For heavy service traffic they often cost less than NAT processing and keep traffic private.")
    ]),

    L("scenario-reading", "Reading architecture scenarios", "Turn requirement words into a shortlist of designs, then eliminate.", 9, ["strategy", "scenarios"], [
      { t: "p", html: "Most questions in this style are design scenarios with several technically possible answers. The winner is the one that satisfies <strong>every stated constraint</strong> and best matches the optimization word: cost, performance, resilience, security or operational effort." },
      { t: "table", headers: ["Requirement phrase", "Pushes you toward"], rows: [
        ["least operational overhead", "Managed and serverless services, fewer moving parts"],
        ["most cost-effective", "Smallest design that still meets every requirement"],
        ["highly available", "Multiple AZs, load balancing, automatic failover"],
        ["decouple / absorb spikes", "Queues, topics, event buses"],
        ["without traversing the internet", "VPC endpoints, private connectivity"],
        ["near real-time analytics on streaming data", "Streaming ingestion plus managed processing"],
        ["rarely accessed, retain for years", "Archive storage classes with lifecycle rules"]
      ] },
      { t: "ol", items: ["Underline hard constraints (latency, Region, compliance, RTO/RPO).", "Circle the optimization word.", "Eliminate options that break any constraint.", "Of the survivors, pick the one that best fits the optimization word."] },
      { t: "note", variant: "trap", html: "An option that works but needs custom scripts on EC2 usually loses to a managed feature when the stem says <em>least operational overhead</em>." },
      { t: "note", variant: "key", html: "Constraints eliminate, the optimization word decides. Managed beats custom when operations effort is the yardstick." }
    ], [
      Q("A company needs to run a scheduled script once a day that takes two minutes, with the least operational overhead. What fits best?", "A scheduled EventBridge rule invoking a Lambda function", ["A dedicated EC2 instance running cron 24/7", "An EKS cluster with a CronJob on self-managed nodes", "A developer running the script manually"], "A scheduled rule invoking a short function needs no servers and costs almost nothing when idle. An always-on instance or a cluster adds patching and management for a tiny job."),
      Q("A requirement says data must be uploaded to S3 from on-premises over a private connection, not the public internet. Which phrase should drive your choice?", "\"not the public internet\", pointing to private connectivity", ["\"S3\", pointing to any storage class", "\"uploaded\", pointing to multipart upload", "\"on-premises\", pointing to EC2"], "The constraint about the network path is the hard requirement. It eliminates options that rely on public endpoints alone and favours private connectivity designs."),
      Q("Two answers both meet all requirements. One uses a managed service; the other uses self-managed software on EC2. The question asks for the least operational overhead. Which should you choose?", "The managed service option", ["The EC2 option, because it gives more control", "Either, because both meet requirements", "Neither, and choose a hybrid"], "When both satisfy the constraints, the optimization word breaks the tie. Managed services remove patching, scaling and failover work."),
      Q("A scenario asks for the MOST cost-effective design that keeps data for seven years and rarely reads it. Which design detail matters most?", "Using an archive storage class with lifecycle transitions", ["Using provisioned IOPS volumes", "Adding read replicas", "Deploying in three Regions"], "Long retention with rare reads is the classic profile for archive classes, and lifecycle rules move data there automatically."),
      Q("What is the first step when reading a long scenario question?", "Identify hard constraints and the optimization goal before looking at options", ["Pick the option with the most services", "Choose the newest service mentioned", "Look for the longest answer"], "Knowing the constraints and the goal first prevents attractive but non-compliant options from steering you. Length and novelty are not signals of correctness."),
      Q("An option meets performance needs but stores data in a single AZ, while the stem requires high availability. What should you do with it?", "Eliminate it because it violates a stated requirement", ["Choose it because performance matters most", "Keep it as a tie-breaker", "Assume availability is optional"], "Any option that breaks a stated requirement is wrong, however good it is on other dimensions.")
    ])
  ];

  window.QUIZZES = Object.assign(window.QUIZZES || {}, QZ);

  window.SUMMIT_CARDS = (window.SUMMIT_CARDS || []).concat([
    { front: "IAM evaluation order", back: "Explicit deny wins; otherwise an explicit allow is required; otherwise implicit deny.", track: TID },
    { front: "What does an SCP do?", back: "Sets the maximum permissions for accounts in an OU. It never grants access by itself.", track: TID },
    { front: "Security group vs NACL", back: "SG: stateful, allow-only, on the interface. NACL: stateless, allow and deny, numbered, on the subnet.", track: TID },
    { front: "Gateway endpoint", back: "Route-table target for S3 or DynamoDB; keeps traffic private and avoids NAT processing charges.", track: TID },
    { front: "Envelope encryption", back: "A data key encrypts data locally; the master key in KMS encrypts the data key.", track: TID },
    { front: "Multi-AZ vs read replica", back: "Multi-AZ: synchronous standby for automatic failover. Read replica: asynchronous copy to scale reads.", track: TID },
    { front: "SQS visibility timeout", back: "How long a received message stays hidden; set it longer than processing time to avoid duplicates.", track: TID },
    { front: "RPO vs RTO", back: "RPO: acceptable data loss in time. RTO: acceptable downtime.", track: TID },
    { front: "Pilot light", back: "Data continuously replicated; core compute launched only during recovery.", track: TID },
    { front: "Global Accelerator vs CloudFront", back: "GA: static anycast IPs, TCP/UDP, fast failover. CloudFront: HTTP caching at the edge.", track: TID },
    { front: "EFS vs EBS", back: "EFS: shared NFS across AZs for many Linux clients. EBS: block volume in one AZ, usually one instance.", track: TID },
    { front: "DAX", back: "In-memory, API-compatible cache for DynamoDB with microsecond reads.", track: TID },
    { front: "Compute Savings Plans", back: "Commit to hourly spend; discount follows usage across families, Regions, Fargate and Lambda.", track: TID },
    { front: "Spot fit", back: "Interruption-tolerant, stateless or checkpointed work spread across instance types and AZs.", track: TID },
    { front: "Big NAT bill hint", back: "Service traffic (S3, DynamoDB) should go through VPC endpoints.", track: TID }
  ]);

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.aws = {
    id: "aws",
    name: "AWS Solutions Architect Associate",
    short: "AWS",
    tagline: "Design secure, resilient, fast and cost-aware",
    color: "#fb923c",
    blurb: "Concept-level prep for the associate architect exam: IAM and guardrails, VPC security, encryption, multi-AZ and DR, decoupling, compute, storage and database selection, caching, and cost. Unofficial; verify current objectives in the official exam guide.",
    modules: [
      { id: "secure", name: "Design secure architectures", icon: "shield", lessons: secure },
      { id: "resilient", name: "Design resilient architectures", icon: "share", lessons: resilient },
      { id: "performant", name: "Design high-performing architectures", icon: "bolt", lessons: performant },
      { id: "cost", name: "Design cost-optimized architectures", icon: "trend", lessons: cost }
    ]
  };
})();
