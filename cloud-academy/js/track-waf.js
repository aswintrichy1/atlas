/* =====================================================================
   NIMBUS · Well-Architected
   window.TRACKS.waf — modules: reliability / secops / cost

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

  function labelled(label, control) {
    return h("div", { style: "display:flex;flex-direction:column;gap:4px" },
      h("span", { style: "font-size:0.74rem;color:var(--text-dim);font-family:var(--font-mono)" }, label), control);
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function money(v) {
    var n = Math.round(isFinite(v) ? v : 0);
    return "$" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  var Widgets = {};

  /* ==================================================================
     1. wafCostEstimator — illustrative monthly bill
     Every rate below is an illustrative teaching constant, deliberately
     round, and not a quote for any provider or region.
  ================================================================== */
  var RATE = {
    hourly: { small: 0.05, medium: 0.10, large: 0.20 },
    purchase: { ondemand: 1, commit: 0.65, spot: 0.35 },
    storageGb: 0.08,
    natHour: 0.045,
    natGb: 0.045,
    egressGb: 0.09
  };

  Widgets.wafCostEstimator = function (mount) {
    shell(mount, "estimator", "Illustrative monthly cost estimator",
      "Shape a small web tier and see where the money goes. All rates are illustrative, round numbers \u2014 not a quote for any provider or region \u2014 so focus on the proportions.");

    var s = { count: 4, size: "medium", hours: 730, purchase: "ondemand", storage: 500, nat: 2, natGb: 1000, egress: 1000 };
    var bar = h("div", { style: "display:flex;height:22px;border-radius:8px;overflow:hidden;border:1px solid var(--line-strong);background:var(--surface-2)" });
    var legend = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 14px;margin-top:10px;font-size:0.84rem" });
    var stage = h("div", { class: "w-stage" }, bar, legend);
    var readout = h("div", { class: "w-readout" });
    var COLORS = { Compute: "var(--accent)", "Block storage": "var(--violet)", "NAT hours": "var(--amber)", "NAT processing": "var(--rose)", Egress: "var(--cyan)" };

    function paint() {
      var compute = s.count * RATE.hourly[s.size] * s.hours * RATE.purchase[s.purchase];
      var items = [
        ["Compute", compute],
        ["Block storage", s.storage * RATE.storageGb],
        ["NAT hours", s.nat * RATE.natHour * 730],
        ["NAT processing", s.natGb * RATE.natGb],
        ["Egress", s.egress * RATE.egressGb]
      ];
      var total = 0, i, top = items[0];
      for (i = 0; i < items.length; i++) { total += items[i][1]; if (items[i][1] > top[1]) top = items[i]; }
      clear(bar); clear(legend);
      for (i = 0; i < items.length; i++) {
        var pct = total > 0 ? items[i][1] / total * 100 : 0;
        bar.appendChild(h("i", { style: "display:block;height:100%;width:" + pct.toFixed(2) + "%;background:" + COLORS[items[i][0]], title: items[i][0] }));
        legend.appendChild(h("span", { style: "display:flex;align-items:center;gap:8px;color:var(--text)" },
          h("i", { style: "display:inline-block;width:10px;height:10px;border-radius:3px;background:" + COLORS[items[i][0]] }),
          items[i][0] + " ", h("b", { style: "font-family:var(--font-mono)" }, money(items[i][1]))));
      }
      var hint;
      if (top[0] === "Compute") hint = s.purchase === "ondemand" ? (s.hours === 730 ? "commit to the steady baseline; schedule non-production off-hours" : "commit to the steady baseline") : "rightsize: check utilisation before buying bigger";
      else if (top[0] === "NAT processing") hint = "add gateway endpoints for object storage and NoSQL so that traffic skips the NAT";
      else if (top[0] === "NAT hours") hint = "one NAT per AZ is right for production; share or drop NAT in dev";
      else if (top[0] === "Egress") hint = "cache at a CDN and keep chatty traffic in-region";
      else hint = "move volumes to a cheaper general-purpose type and delete orphaned volumes and snapshots";
      clear(readout);
      readout.appendChild(ro("illustrative total / month", money(total)));
      readout.appendChild(ro("biggest line", top[0] + " (" + (total > 0 ? Math.round(top[1] / total * 100) : 0) + "%)"));
      readout.appendChild(ro("hint", hint));
    }

    function pick(key, pairs, idx) { return segment(pairs, idx, function (v) { s[key] = v; paint(); }); }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("instances", pick("count", [[2, "2"], [4, "4"], [8, "8"], [16, "16"]], 1)),
      labelled("size", pick("size", [["small", "S"], ["medium", "M"], ["large", "L"]], 1)),
      labelled("hours / month", pick("hours", [[730, "24\u00d77"], [260, "business hours"]], 0)),
      labelled("purchase", pick("purchase", [["ondemand", "on-demand"], ["commit", "1-yr commit"], ["spot", "spot"]], 0))));
    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("block storage GB", pick("storage", [[100, "100"], [500, "500"], [2000, "2,000"]], 1)),
      labelled("NAT gateways", pick("nat", [[1, "1"], [2, "2"], [3, "3"]], 1)),
      labelled("GB through NAT", pick("natGb", [[100, "100"], [1000, "1k"], [10000, "10k"]], 1)),
      labelled("internet egress GB", pick("egress", [[100, "100"], [1000, "1k"], [10000, "10k"]], 1))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. wafDrPicker — RTO / RPO to a DR strategy
  ================================================================== */
  var DR = [
    { name: "Backup & restore", cost: "1\u00d7", aws: "AWS Backup copies to a second region, IaC to rebuild", azure: "Azure Backup / geo-redundant storage, Bicep to rebuild", gcp: "Backup and DR service, multi-region buckets, Terraform to rebuild", drill: "a full restore from backup into an empty region, timed" },
    { name: "Pilot light", cost: "\u2248 1.2\u00d7", aws: "Aurora Global or cross-region replicas live; compute defined in IaC but scaled to zero", azure: "Geo-replicated Azure SQL; scale sets at zero in the paired region", gcp: "Cross-region Cloud SQL replica; managed instance groups at zero", drill: "promote the replica and scale compute from zero under load" },
    { name: "Warm standby", cost: "\u2248 1.5\u00d7", aws: "Scaled-down full stack in region B, Route 53 failover records and health checks", azure: "Smaller full stack in the paired region, Front Door or Traffic Manager failover", gcp: "Smaller stack in a second region behind a global load balancer", drill: "fail traffic over, scale up, then fail back" },
    { name: "Multi-site active/active", cost: "\u2248 2\u00d7 or more", aws: "DynamoDB global tables or Aurora with write forwarding, latency routing, ARC routing controls", azure: "Cosmos DB multi-region writes, Front Door across regions", gcp: "Spanner multi-region, global external load balancer", drill: "evacuate a region during business hours without customer impact" }
  ];

  Widgets.wafDrPicker = function (mount) {
    shell(mount, "decision", "Pick a DR strategy from RTO and RPO",
      "Set the recovery time and recovery point the business signed up for. The cheapest strategy that meets both wins; budget only tells you whether the target is realistic.");

    var rto = 1, rpo = 1, budget = "balanced";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var tier = Math.max(rto, rpo);
      var d = DR[tier];
      clear(stage);
      var row = h("div", { style: "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px" });
      for (var i = 0; i < DR.length; i++) {
        var on = i === tier;
        row.appendChild(h("div", {
          style: "padding:10px;border-radius:10px;border:1px solid " + (on ? "var(--accent)" : "var(--line)") + ";background:" + (on ? "var(--surface-2)" : "var(--surface-solid)") + ";font-size:0.82rem;" + (on ? "font-weight:700" : "")
        }, h("div", { style: "color:var(--text)" }, DR[i].name), h("div", { style: "color:var(--text-dim);font-family:var(--font-mono);margin-top:4px" }, "cost " + DR[i].cost)));
      }
      stage.appendChild(row);
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:90px minmax(0,1fr);gap:6px 12px;margin-top:12px;font-size:0.84rem;color:var(--text)" },
        h("b", { style: "color:var(--accent-ink)" }, "AWS"), h("span", {}, d.aws),
        h("b", { style: "color:var(--accent-ink)" }, "Azure"), h("span", {}, d.azure),
        h("b", { style: "color:var(--accent-ink)" }, "Google Cloud"), h("span", {}, d.gcp)));
      var verdict = "fits";
      if (budget === "tight" && tier >= 2) verdict = "budget conflict: renegotiate the target or fund it";
      else if (budget === "availability" && tier < 2) verdict = "you could afford more; is the target too loose?";
      clear(readout);
      readout.appendChild(ro("strategy", d.name));
      readout.appendChild(ro("relative cost", d.cost));
      readout.appendChild(ro("driven by", rto >= rpo ? (rto === rpo ? "RTO and RPO" : "RTO") : "RPO"));
      readout.appendChild(ro("budget check", verdict));
      readout.appendChild(ro("rehearse", d.drill));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("RTO (time to recover)", segment([[0, "days"], [1, "hours"], [2, "minutes"], [3, "near zero"]], 1, function (v) { rto = v; paint(); })),
      labelled("RPO (data you can lose)", segment([[0, "24 h"], [1, "1 h"], [2, "minutes"], [3, "seconds"]], 1, function (v) { rpo = v; paint(); })),
      labelled("budget", segment([["tight", "tight"], ["balanced", "balanced"], ["availability", "availability first"]], 1, function (v) { budget = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "waf-reliability": {
      title: "Reliability & DR checkpoint",
      sub: "Pillars, failure domains, resilience patterns and disaster recovery.",
      questions: [
        {
          q: "Your RTO is four hours and your RPO is one hour. Which DR strategy is usually the cheapest that meets both?",
          options: ["Multi-site active/active", "Warm standby", "Pilot light, with data continuously replicated and compute rebuilt on demand", "No DR, rely on multi-AZ"],
          answer: 2,
          explain: "Hours of RTO leave time to scale compute from zero, and continuous replication keeps data loss well under an hour, which is exactly pilot light. Warm standby and active/active would meet it too, at a higher standing cost. Multi-AZ protects against a zone failure, not a regional one."
        },
        {
          q: "What does 'static stability' mean for a service spread across three availability zones?",
          options: ["The service never changes", "If one zone fails, the remaining zones already have enough capacity, so recovery needs no new provisioning", "Instances use static IP addresses", "Autoscaling is disabled"],
          answer: 1,
          explain: "A statically stable design pre-provisions capacity so a zone loss does not depend on the control plane launching replacements during the incident, when those APIs may be strained. Running each zone at about two thirds of capacity in a three-zone deployment is one way to achieve it."
        },
        {
          q: "Why add jitter to retries with exponential backoff?",
          options: ["To make retries faster", "To spread retries out so clients that failed together do not retry together and overload the recovering dependency", "To guarantee exactly-once delivery", "To avoid timeouts"],
          answer: 1,
          explain: "Without jitter, many clients back off on the same schedule and arrive in synchronized waves. Randomizing the delay smooths the load, and a retry budget or circuit breaker stops retries amplifying an outage."
        },
        {
          q: "Which pillar appears in the AWS Well-Architected Framework but is not one of Azure's five pillars?",
          options: ["Reliability", "Security", "Sustainability", "Cost optimization"],
          answer: 2,
          explain: "AWS lists six pillars including sustainability. Azure's framework has five pillars (reliability, security, cost optimization, operational excellence, performance efficiency) and treats sustainability as separate guidance. The substance overlaps heavily across providers."
        },
        {
          q: "A team has a multi-region DR plan but has never failed over. What is the most important next step?",
          options: ["Buy more reserved capacity", "Run a scheduled game day that fails over and back, and time it against the RTO", "Add more regions", "Write a longer runbook"],
          answer: 1,
          explain: "An unrehearsed failover is a hypothesis. A game day reveals missing permissions, stale DNS TTLs, hard-coded endpoints and data lag, and gives a measured recovery time to compare with the RTO."
        }
      ]
    },
    "waf-secops": {
      title: "Security & operations checkpoint",
      sub: "Security pillar foundations, encryption, detection and operational excellence.",
      questions: [
        {
          q: "In envelope encryption with a cloud KMS, what does the KMS key encrypt?",
          options: ["Every byte of the data directly", "A data key, which in turn encrypts the data", "Only the database password", "The TLS certificate"],
          answer: 1,
          explain: "Services generate a data key, encrypt data locally with it, and store the data key encrypted under the KMS key. Bulk data never travels to KMS, access to the KMS key is the control point, and rotating the KMS key does not require re-encrypting all data."
        },
        {
          q: "Which set lists rough threat-detection and posture counterparts across AWS, Azure and Google Cloud?",
          options: ["CloudFront / Front Door / Cloud CDN", "GuardDuty and Security Hub / Microsoft Defender for Cloud / Security Command Center", "IAM / Entra ID / Cloud Identity", "CloudTrail / Activity Log / Cloud Audit Logs"],
          answer: 1,
          explain: "GuardDuty detects threats and Security Hub aggregates findings and posture checks; Defender for Cloud covers posture and workload protection on Azure; Security Command Center does both on Google Cloud. The audit-log trio in another option is the evidence these tools read, not the detectors themselves."
        },
        {
          q: "What does 'implement a strong identity foundation' most concretely mean?",
          options: ["Long passwords for IAM users", "Centralized human identity with federation and MFA, roles with short-lived credentials for workloads, and least privilege enforced by guardrails", "One shared admin account per team", "Rotating access keys every year"],
          answer: 1,
          explain: "The foundation is federation for people, workload identity for machines, no long-lived keys, and organization-level guardrails. Password length and key rotation are weaker controls on credentials you should not have in the first place."
        },
        {
          q: "Which practice best reflects operational excellence?",
          options: ["Large quarterly releases to reduce change count", "Small, frequent, reversible changes through IaC and pipelines, with runbooks and blameless post-incident reviews feeding improvements", "Manual production changes by senior engineers only", "Disabling alerts during releases"],
          answer: 1,
          explain: "Small reversible changes reduce blast radius and make rollback routine; runbooks make response repeatable; blameless reviews turn incidents into fixes. Batching changes increases risk per release."
        },
        {
          q: "Where should audit logs for every account be stored?",
          options: ["In each workload account, writable by its admins", "In a central log-archive account with restricted write and delete, ideally with immutability", "On the application servers", "Only in the security team's laptops"],
          answer: 1,
          explain: "Evidence must survive the compromise of the account it describes. A separate log-archive account, organization-wide trails and object lock or retention policies stop an attacker with workload admin from erasing their tracks."
        }
      ]
    },
    "waf-cost": {
      title: "Cost & sustainability checkpoint",
      sub: "FinOps, cost levers, hidden costs and sustainability.",
      questions: [
        {
          q: "A private subnet's instances pull terabytes from object storage in the same region through a NAT gateway. What is the cheapest fix?",
          options: ["Add more NAT gateways", "Add a gateway VPC endpoint for the object store so that traffic bypasses the NAT", "Move the instances to a public subnet", "Buy a Savings Plan"],
          answer: 1,
          explain: "NAT gateways charge per GB processed. Gateway endpoints for S3 and DynamoDB route that traffic privately at no processing charge, and keep instances private. Moving to public subnets trades cost for exposure."
        },
        {
          q: "What is the right order for most cost work?",
          options: ["Buy commitments first, then rightsize", "Gain visibility with tags and allocation, rightsize and remove waste, then commit to the remaining steady baseline", "Move everything to Spot", "Cut monitoring"],
          answer: 1,
          explain: "Committing before rightsizing locks in waste for a year or three. Allocation shows who owns spend, rightsizing and cleanup shrink it, and commitments then discount what is genuinely steady."
        },
        {
          q: "Which workload is the best fit for Spot capacity?",
          options: ["A single-instance primary database", "A stateless, checkpointed batch or CI fleet that tolerates interruption", "A licence server with one node", "The bastion host"],
          answer: 1,
          explain: "Spot capacity can be reclaimed with short notice. Stateless or checkpointed work spread across several instance types and zones handles that gracefully; single stateful nodes do not."
        },
        {
          q: "What is a unit-economics metric?",
          options: ["Total monthly cloud bill", "Cost per business unit of value, such as cost per order or per active customer", "Number of instances", "Percentage of reserved coverage"],
          answer: 1,
          explain: "A growing bill can be healthy if cost per order is falling. Unit metrics connect spend to value and let engineering teams make trade-offs in terms the business understands."
        },
        {
          q: "Which change improves both cost and sustainability most directly?",
          options: ["Over-provisioning for safety", "Raising utilisation: rightsizing, autoscaling, and moving suitable workloads to efficient instance families or managed services", "Keeping all data forever in the hottest tier", "Duplicating every environment"],
          answer: 1,
          explain: "Idle capacity burns money and energy alike. Higher utilisation, efficient hardware such as Arm-based instances where compatible, and lifecycle policies on data cut both the bill and the footprint."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.waf = {
    id: "waf",
    name: "Well-Architected",
    short: "WAF",
    tagline: "Reliability, security, operations, cost and sustainability",
    color: "#fb7185",
    blurb: "The review lens every cloud provider publishes, made concrete: failure domains and resilience patterns, disaster recovery from backup-and-restore to active/active, the security and operations pillars, and FinOps with the hidden costs that surprise teams.",
    modules: [
      {
        id: "reliability",
        name: "Pillars & Reliability",
        icon: "shield",
        lessons: [
          {
            id: "pillars",
            title: "The pillars, across three providers",
            summary: "What a well-architected review is, how the AWS, Azure and Google Cloud frameworks line up, and how to use them without turning them into a checklist ritual.",
            minutes: 7,
            tags: ["well-architected", "pillars", "review"],
            blocks: [
              { t: "p", html: "Each provider publishes a <strong>well-architected framework</strong>: a set of pillars, design principles and review questions that turn 'is this a good architecture?' into specific, answerable checks. In this track WAF means that framework, not the web application firewall that shares the acronym." },
              { t: "table", headers: ["Concern", "AWS pillar", "Azure pillar", "Google Cloud framework"], rows: [
                ["Run and improve the system", "Operational excellence", "Operational excellence", "Operational excellence"],
                ["Protect data and systems", "Security", "Security", "Security, privacy and compliance"],
                ["Recover from and withstand failure", "Reliability", "Reliability", "Reliability"],
                ["Use resources efficiently as demand changes", "Performance efficiency", "Performance efficiency", "Performance optimization"],
                ["Spend deliberately", "Cost optimization", "Cost optimization", "Cost optimization"],
                ["Minimize environmental impact", "Sustainability", "Separate sustainability guidance", "Sustainability guidance"]
              ] },
              { t: "note", variant: "tip", html: "The names line up almost perfectly; the review tooling differs. AWS has the Well-Architected Tool with lenses, Azure has the Well-Architected Review assessment and Advisor, and Google publishes its framework with recommendations surfaced in tools such as Active Assist. Google has recently renamed its framework the Google Cloud Well-Architected Framework." },
              { t: "h", text: "Pillars trade against each other" },
              { t: "table", headers: ["Push this up", "Usually costs you"], rows: [
                ["Reliability (second region)", "Cost and operational complexity"],
                ["Security (inspection, encryption everywhere)", "Some latency, some cost, more moving parts"],
                ["Cost (Spot, fewer replicas)", "Reliability margin"],
                ["Performance (bigger caches, provisioned capacity)", "Cost and sustainability"]
              ] },
              { t: "ul", items: [
                "Use the framework as a <strong>conversation</strong> with the owning team, not an audit: each 'no' becomes a risk with an owner and a date.",
                "Prioritize high-risk items by blast radius, not by pillar order.",
                "Re-review after major changes rather than on a calendar alone."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'review this architecture' or 'what would you improve?' Walk the pillars briefly, then go deep on the two with the highest risk for this workload, and state the trade-off each fix introduces." },
              { t: "note", variant: "key", html: "<strong>Six concerns, three vocabularies, one conversation.</strong> The pillars are a structured way to find the riskiest gaps and name what fixing them costs." }
            ]
          },
          {
            id: "resilience-patterns",
            title: "Failure domains and resilience patterns",
            summary: "Zones and regions as blast-radius boundaries, static stability, and the timeouts, retries, bulkheads and load shedding that stop small failures spreading.",
            minutes: 11,
            tags: ["reliability", "multi-az", "retries", "bulkheads"],
            blocks: [
              { t: "p", html: "Reliability starts with knowing your <strong>failure domains</strong>: the units that fail together. An instance, an availability zone, a region, a dependency and a deploy are all failure domains. Good designs make sure no single one of them takes the whole service down." },
              { t: "table", headers: ["Failure domain", "Typical defence", "AWS / Azure / Google Cloud building block"], rows: [
                ["Instance or container", "Run several behind a health-checked load balancer", "ASG / VM Scale Sets / managed instance groups"],
                ["Availability zone", "Spread across at least two, ideally three zones", "Multi-AZ subnets / availability zones / zonal resources in a region"],
                ["Region", "Disaster recovery strategy (next lesson)", "Second region / paired region / second region"],
                ["Bad deploy", "Progressive rollout with automatic rollback", "CodeDeploy, canaries / deployment slots / Cloud Deploy canaries"],
                ["Dependency", "Timeouts, retries with backoff, circuit breakers, fallbacks", "Application and service-mesh configuration"]
              ] },
              { t: "h", text: "Static stability" },
              { t: "p", html: "If losing a zone means you must launch replacement capacity, your recovery depends on control-plane APIs at the worst possible moment. A <strong>statically stable</strong> design already has enough capacity in the surviving zones. With three zones, running each at roughly two thirds of the load it could carry lets any two absorb the third." },
              { t: "stat", items: [
                { v: "3 AZs", k: "common production spread" },
                { v: "~67%", k: "per-zone headroom target for N\u22121" },
                { v: "2", k: "minimum zones for anything that matters" }
              ] },
              { t: "h", text: "Patterns that stop failures spreading" },
              { t: "table", headers: ["Pattern", "What it does", "Failure if missing"], rows: [
                ["Timeouts", "Bound how long a caller waits", "Threads pile up waiting on a slow dependency"],
                ["Retries with exponential backoff and jitter", "Recover from transient errors without synchronized storms", "Retry waves overload the dependency as it recovers"],
                ["Retry budgets / circuit breakers", "Stop retrying when a dependency is clearly down", "Retries multiply load during an outage"],
                ["Bulkheads", "Separate pools per dependency or tenant", "One slow dependency exhausts all workers"],
                ["Load shedding", "Reject excess work early and cheaply", "Everyone gets slow instead of most getting served"],
                ["Idempotency keys", "Make retried writes safe", "Duplicate charges or orders"]
              ] },
              { t: "note", variant: "trap", html: "Retries at every layer multiply. Three layers each retrying three times turn one failed request into twenty-seven calls on the bottom dependency. Retry at one layer, usually the one closest to the user, and bound it." },
              { t: "note", variant: "key", html: "<strong>Know what fails together, and keep failures local.</strong> Spread across zones with headroom already provisioned, and bound every dependency call with timeouts, jittered retries and a budget." }
            ]
          },
          {
            id: "dr-strategies",
            title: "Disaster recovery: RTO, RPO and the four strategies",
            summary: "Translate business recovery targets into one of four DR strategies, price them, and know what each requires you to rehearse.",
            minutes: 10,
            tags: ["dr", "rto", "rpo", "pilot-light", "warm-standby"],
            blocks: [
              { t: "p", html: "Two numbers drive disaster recovery. <strong>RTO</strong> (recovery time objective) is how long the service may be down. <strong>RPO</strong> (recovery point objective) is how much recent data you may lose, measured in time. Both are business decisions; your job is to meet them at the lowest standing cost." },
              { t: "diagram", id: "dr-tiers", caption: "Four DR strategies: each step right buys faster recovery and less data loss for more standing cost." },
              { t: "table", headers: ["Strategy", "What runs in the recovery region", "Typical RTO", "Typical RPO"], rows: [
                ["Backup & restore", "Only backups and IaC", "Hours to days", "Hours (last backup)"],
                ["Pilot light", "Data replicated live; compute defined but off", "Tens of minutes to hours", "Minutes"],
                ["Warm standby", "A smaller full copy, serving no or little traffic", "Minutes", "Seconds to minutes"],
                ["Multi-site active/active", "Full capacity serving traffic in both", "Near zero", "Near zero (with conflict handling)"]
              ] },
              { t: "widget", id: "wafDrPicker" },
              { t: "h", text: "What people forget" },
              { t: "ul", items: [
                "<strong>Dependencies recover too.</strong> Identity, DNS, secrets, container images and third-party allow-lists must all exist in the recovery region.",
                "<strong>Data lag is your RPO.</strong> Asynchronous replication lag at the moment of failure is exactly what you lose.",
                "<strong>Backups must be isolated.</strong> Copy them to another account and region with deletion protection, or ransomware deletes them with the primary.",
                "<strong>Failback is a second migration.</strong> Plan and rehearse returning, not just leaving."
              ] },
              { t: "h", text: "Native DR building blocks" },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["Centralized, policy-driven backups", "AWS Backup with cross-account and cross-region copies", "Azure Backup, Backup center", "Backup and DR Service"],
                ["Immutable backups", "Backup Vault Lock (compliance mode), logically air-gapped vaults", "Immutable vaults, soft delete", "Backup vault with enforced retention; bucket lock"],
                ["Server replication for pilot light or warm standby", "AWS Elastic Disaster Recovery (block-level replication, recovery instances on demand)", "Azure Site Recovery", "Backup and DR Service; Migrate to Virtual Machines for some cases"],
                ["Failover orchestration", "Route 53 ARC, Systems Manager Automation runbooks", "Site Recovery recovery plans, Traffic Manager", "Cloud DNS routing policies, Workflows"]
              ] },
              { t: "p", html: "A DR plan is complete only when each of these exists as code: the backup policy, the vault lock, the replication configuration, the failover runbook, and the dashboard that shows replication lag against RPO." },
              { t: "note", variant: "warn", html: "Multi-AZ is high availability, not disaster recovery. It protects against a zone failure; it does nothing for a regional outage, a bad deploy replicated everywhere, or a deleted database." },
              { t: "note", variant: "key", html: "<strong>Pick the cheapest strategy that meets both numbers, then rehearse it.</strong> RTO and RPO are business commitments; a DR plan you have never executed only tells you what you hope will happen." }
            ]
          },
          {
            id: "multi-region",
            title: "Multi-region data, failover and game days",
            summary: "Replicating data across regions on each cloud, routing traffic away from a failed region, and proving it with chaos experiments.",
            minutes: 10,
            tags: ["multi-region", "replication", "failover", "chaos"],
            blocks: [
              { t: "p", html: "Compute is easy to duplicate; <strong>data</strong> is what makes multi-region hard. Every replication option trades consistency, latency and cost, and the choice decides your real RPO." },
              { t: "table", headers: ["Data", "AWS", "Azure", "Google Cloud"], rows: [
                ["Relational, one writer", "Aurora Global Database (typically sub-second lag), cross-region read replicas", "Azure SQL active geo-replication / failover groups", "Cloud SQL cross-region replicas"],
                ["Relational, globally consistent", "Aurora DSQL (newer)", "\u2014 (Cosmos DB for NoSQL patterns)", "Spanner multi-region"],
                ["Key-value, multi-writer", "DynamoDB global tables", "Cosmos DB multi-region writes", "Bigtable replication, Firestore multi-region"],
                ["Objects", "S3 Cross-Region Replication (optional replication time control)", "Geo-redundant storage (GRS / GZRS)", "Dual-region and multi-region buckets"]
              ] },
              { t: "note", variant: "trap", html: "Multi-writer replication means conflicts. Last-writer-wins is the default in several services, which silently discards one of two concurrent updates. Design keys and workflows so that the same item is normally written in one region." },
              { t: "h", text: "Moving traffic" },
              { t: "ul", items: [
                "<strong>DNS failover</strong>: Route 53 failover records with health checks, Azure Traffic Manager, Cloud DNS routing policies. Mind the TTL: clients cache answers.",
                "<strong>Global load balancers</strong>: Azure Front Door and Google's global external load balancer fail over without waiting for DNS caches; AWS Global Accelerator plays a similar role.",
                "<strong>Recovery controls</strong>: Route 53 Application Recovery Controller adds readiness checks and routing controls so failover is a deliberate, highly available switch rather than an emergency DNS edit."
              ] },
              { t: "h", text: "Prove it: game days and chaos" },
              { t: "p", html: "A <strong>game day</strong> is a scheduled exercise where you inject a failure and run the response for real. Managed services make this safer: <strong>AWS Fault Injection Service</strong> and <strong>Azure Chaos Studio</strong> run controlled experiments with stop conditions; on Google Cloud teams typically use open-source chaos tools against GKE and Compute Engine." },
              { t: "ol", items: [
                "State a hypothesis: 'losing zone b raises p99 latency by less than 20% and no requests fail'.",
                "Define the blast radius and an automatic stop condition tied to an alarm.",
                "Inject the fault, observe, and time the recovery.",
                "Write down what broke and fix it before the next run."
              ] },
              { t: "quiz", id: "waf-reliability" },
              { t: "note", variant: "key", html: "<strong>Data replication sets your real RPO; traffic steering sets your real RTO.</strong> Choose both per dataset, and run failure on purpose before it runs on you." }
            ]
          }
        ]
      },
      {
        id: "secops",
        name: "Security & Operations",
        icon: "compass",
        lessons: [
          {
            id: "security-pillar",
            title: "The security pillar: identity, traceability, encryption, detection",
            summary: "The security design principles as concrete controls, envelope encryption with each provider's KMS, and the native detection services side by side.",
            minutes: 10,
            tags: ["security", "kms", "encryption", "detection"],
            blocks: [
              { t: "p", html: "The security pillar boils down to a few principles applied everywhere: a strong identity foundation, traceability, security at every layer, protected data, and automated response. The value is in making each one concrete." },
              { t: "table", headers: ["Principle", "Concrete control"], rows: [
                ["Strong identity foundation", "Federated human access with MFA; roles and workload identity for machines; no long-lived keys; organization guardrails"],
                ["Traceability", "Organization-wide audit trails into a separate log-archive account; alerting on sensitive actions"],
                ["Security at every layer", "Edge protection, network segmentation, security groups, host hardening, application checks"],
                ["Protect data in transit and at rest", "TLS everywhere; KMS-backed encryption on every store; classification and access reviews"],
                ["Automate security", "Guardrails and detections as code; automatic remediation for well-understood findings"],
                ["Prepare for events", "Runbooks, pre-provisioned forensic access, rehearsed incident response"]
              ] },
              { t: "h", text: "Envelope encryption" },
              { t: "p", html: "Cloud key services rarely encrypt your data directly. A service asks KMS for a <strong>data key</strong>, encrypts the data with it locally, and stores that data key encrypted under your <strong>KMS key</strong>. To read, it asks KMS to decrypt the data key, which is where permissions and audit logging apply." },
              { t: "table", headers: ["", "AWS", "Azure", "Google Cloud"], rows: [
                ["Key service", "KMS (CloudHSM for dedicated HSMs)", "Key Vault / Managed HSM", "Cloud KMS / Cloud HSM"],
                ["Customer-managed keys on storage", "SSE-KMS on S3, EBS, RDS", "Customer-managed keys on Storage, SQL, Disks", "CMEK on Cloud Storage, BigQuery, Persistent Disk"],
                ["Secrets", "Secrets Manager, Parameter Store", "Key Vault secrets", "Secret Manager"]
              ] },
              { t: "h", text: "Native detection and posture" },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["Threat detection from logs and network signals", "GuardDuty", "Microsoft Defender for Cloud", "Security Command Center threat detection"],
                ["Posture and findings aggregation", "Security Hub, Config rules", "Defender for Cloud secure score, Azure Policy", "Security Command Center, Organization Policy"],
                ["SIEM", "Security Lake plus a SIEM of choice", "Microsoft Sentinel", "Google Security Operations"]
              ] },
              { t: "h", text: "A data perimeter" },
              { t: "p", html: "A <strong>data perimeter</strong> states three things for every request: only <em>trusted identities</em> (your organization), only <em>trusted resources</em> (buckets, keys and queues your organization owns), only from <em>expected networks</em> (your VPCs and endpoints). On AWS it is built from organization-wide guardrails rather than per-resource policies." },
              { t: "table", headers: ["Perimeter", "Control", "Condition key (AWS)"], rows: [
                ["Trusted identities on my resources", "Resource control policies (RCPs) and resource policies", "<code class='tok'>aws:PrincipalOrgID</code>"],
                ["My identities only reach trusted resources", "SCPs and VPC endpoint policies", "<code class='tok'>aws:ResourceOrgID</code>"],
                ["Expected networks", "Resource policies and RCPs requiring endpoints or corporate IPs", "<code class='tok'>aws:SourceVpc</code>, <code class='tok'>aws:SourceVpce</code>, <code class='tok'>aws:SourceIp</code>"]
              ] },
              { t: "p", html: "Azure builds the equivalent with private endpoints, network rules and Azure Policy; Google Cloud with <strong>VPC Service Controls</strong> perimeters around projects. Detection services and CNAPPs then report where the perimeter leaks, as covered in the observability track's security-monitoring lesson." },
              { t: "note", variant: "warn", html: "Turning a detector on is not the control; routing its findings to an owner with a deadline is. An unread findings console is a compliance artefact, not security." },
              { t: "note", variant: "key", html: "<strong>Identity first, everything logged centrally, every store encrypted with a key you control, findings routed to owners.</strong> The providers differ in names, not in what a sound security baseline contains." }
            ]
          },
          {
            id: "ops-excellence",
            title: "Operational excellence and performance efficiency",
            summary: "Small reversible changes, runbooks, post-incident reviews and operating metrics; plus the short version of performance efficiency.",
            minutes: 9,
            tags: ["operations", "runbooks", "postmortem", "performance"],
            blocks: [
              { t: "p", html: "Operational excellence is the pillar about <em>how</em> you run the system: how changes happen, how you know it is healthy, and how you get better after something goes wrong." },
              { t: "compare",
                bad: { title: "Fragile operations", items: [
                  "Large releases every quarter",
                  "Production edited by hand during incidents",
                  "Knowledge lives in two people's heads",
                  "Incidents end with blame and no follow-up"
                ] },
                good: { title: "Excellent operations", items: [
                  "Small, frequent changes through IaC and pipelines, easy to roll back",
                  "Break-glass access is logged and reviewed",
                  "Runbooks for known failures, linked from the alert",
                  "Blameless reviews with tracked action items"
                ] }
              },
              { t: "h", text: "Signals worth reporting" },
              { t: "table", headers: ["Metric", "Why it matters"], rows: [
                ["Deployment frequency and lead time", "Small, frequent change is the precondition for safe change"],
                ["Change failure rate", "How often a change causes an incident or rollback"],
                ["Time to restore", "How fast you recover when something breaks"],
                ["SLO attainment and error budget burn", "Whether users are getting the reliability promised"]
              ] },
              { t: "h", text: "Native tools for safe change and automated operations" },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["Progressive delivery", "CodeDeploy canary and linear, ECS blue/green, Lambda aliases with weights", "Deployment slots, Container Apps revisions", "Cloud Deploy canaries, Cloud Run traffic splitting"],
                ["Feature flags and dynamic config", "AppConfig with validators and automatic rollback on alarms", "App Configuration feature manager", "Firebase Remote Config, or a third-party flag service"],
                ["Runbook automation", "Systems Manager Automation documents, Incident Manager", "Azure Automation runbooks", "Workflows, Cloud Run jobs"],
                ["Fleet operations", "Systems Manager (Session Manager, Patch Manager, Run Command)", "Azure Update Manager, Arc", "OS Config (VM Manager)"]
              ] },
              { t: "p", html: "Alarm-driven rollback ties the pillars together: a deployment watches the same SLO alarms that page humans, and rolls itself back when they fire. Session Manager, Azure Bastion and IAP replace SSH keys and bastion hosts with audited, identity-based access." },
              { t: "h", text: "Performance efficiency, briefly" },
              { t: "ul", items: [
                "<strong>Choose the right resource type</strong>: managed services and purpose-built databases often beat tuning a general one.",
                "<strong>Measure before tuning</strong>: load tests and profiling, not intuition.",
                "<strong>Go global when users are global</strong>: CDNs, regional deployments, read replicas near readers.",
                "<strong>Experiment cheaply</strong>: IaC makes it inexpensive to try a different instance family or a serverless variant and compare."
              ] },
              { t: "note", variant: "tip", html: "Link every alert to a runbook, and every runbook step that is safe to automate to a script. Over time the runbook becomes automation and the alert becomes rarer." },
              { t: "quiz", id: "waf-secops" },
              { t: "note", variant: "key", html: "<strong>Make change small, observable and reversible, and learn from every incident.</strong> Operational excellence is what turns the other pillars from a design document into how the system behaves on a bad day." }
            ]
          }
        ]
      },
      {
        id: "cost",
        name: "Cost & Sustainability",
        icon: "trend",
        lessons: [
          {
            id: "finops",
            title: "FinOps: visibility, ownership and unit economics",
            summary: "The inform, optimize and operate loop; tagging and cost allocation; budgets and anomaly detection; and metrics that tie spend to value.",
            minutes: 9,
            tags: ["finops", "tagging", "budgets", "unit-economics"],
            blocks: [
              { t: "p", html: "<strong>FinOps</strong> is the practice of making cloud spend a shared, visible engineering concern. It runs as a loop: <strong>inform</strong> (who spends what), <strong>optimize</strong> (reduce waste and get better rates), <strong>operate</strong> (make it routine with budgets, reviews and automation)." },
              { t: "h", text: "Visibility first" },
              { t: "table", headers: ["Capability", "AWS", "Azure", "Google Cloud"], rows: [
                ["Billing data export", "Cost and Usage Report / Data Exports", "Cost Management exports", "Billing export to BigQuery"],
                ["Explore and allocate", "Cost Explorer, cost allocation tags, cost categories", "Cost Management + tags, cost allocation rules", "Reports, labels, billing account structure"],
                ["Budgets and alerts", "AWS Budgets", "Budgets in Cost Management", "Budgets and alerts"],
                ["Anomaly detection", "Cost Anomaly Detection", "Cost anomaly alerts", "Anomaly detection in billing"]
              ] },
              { t: "ul", items: [
                "Enforce a small set of <strong>mandatory tags or labels</strong> (owner, cost centre, environment) with policy, and apply them by default from IaC.",
                "Use the <strong>account / subscription / project</strong> boundary as the primary allocation unit; tags fill in the detail.",
                "Show each team its own spend weekly. Engineers change what they can see."
              ] },
              { t: "h", text: "A tagging strategy that survives contact with reality" },
              { t: "table", headers: ["Tag", "Example", "Used for"], rows: [
                ["owner", "team-payments", "Who gets the alert and the bill"],
                ["cost-center", "cc-4120", "Chargeback or showback to finance"],
                ["environment", "prod / stage / dev", "Scheduling, policy scope, cost split"],
                ["application", "orders-api", "Unit economics per product"],
                ["data-classification", "confidential", "Security policy and DSPM scope"]
              ] },
              { t: "ol", items: [
                "<strong>Define</strong> a short mandatory set with allowed values; publish it as code, not a wiki page.",
                "<strong>Apply by default</strong>: provider-level default tags in Terraform (<code class='tok'>default_tags</code> in the AWS provider), stack tags in CloudFormation, tag inheritance in Azure Policy.",
                "<strong>Enforce</strong>: AWS Organizations tag policies standardize keys and values, SCPs can deny creation without required tags, Azure Policy can deny or modify, Google Cloud organization policies and labels in IaC modules.",
                "<strong>Activate</strong> the tags as cost allocation tags in billing; they do not appear in cost reports until you do.",
                "<strong>Measure</strong> untagged spend and drive it down; account and project boundaries cover what tags miss, such as some shared network costs."
              ] },
              { t: "h", text: "Unit economics" },
              { t: "p", html: "The total bill is a poor metric because healthy growth raises it. Track <strong>cost per unit of value</strong>: per order, per active customer, per thousand API calls. If the unit cost is falling while the bill rises, the business is scaling efficiently." },
              { t: "stat", items: [
                { v: "$0.012", k: "illustrative cost per order" },
                { v: "\u221218%", k: "unit cost quarter over quarter" },
                { v: "+40%", k: "orders over the same period" }
              ] },
              { t: "note", variant: "warn", html: "Untagged spend is unowned spend. Report the untagged percentage as its own metric and drive it towards zero." },
              { t: "note", variant: "key", html: "<strong>You cannot optimize what nobody owns.</strong> Allocate every dollar to a team, alert on budgets and anomalies, and measure cost per unit of value rather than the raw bill." }
            ]
          },
          {
            id: "cost-levers",
            title: "Cost levers and the hidden costs",
            summary: "Rightsizing, commitments and Spot in the right order, and the line items that surprise teams: NAT processing, cross-zone traffic, egress and idle resources.",
            minutes: 11,
            tags: ["cost", "rightsizing", "savings-plans", "spot", "nat"],
            blocks: [
              { t: "p", html: "Most savings come from three levers pulled in order: <strong>stop paying for waste</strong>, <strong>rightsize</strong> what remains, then <strong>buy a better rate</strong> on the steady baseline. Pull them out of order and you lock in waste at a discount." },
              { t: "table", headers: ["Lever", "AWS", "Azure", "Google Cloud", "Watch out for"], rows: [
                ["Turn off idle", "Instance Scheduler, ASG schedules", "Auto-shutdown, automation", "Instance schedules", "Non-production running nights and weekends"],
                ["Rightsize", "Compute Optimizer", "Advisor", "Recommender", "Memory metrics need an agent to be visible"],
                ["Commitments", "Savings Plans, Reserved Instances", "Reservations, savings plan for compute", "Committed use discounts; sustained use discounts", "Committing before rightsizing"],
                ["Interruptible capacity", "Spot Instances", "Spot VMs", "Spot VMs", "Only for interruption-tolerant work"],
                ["Efficient hardware", "Graviton (Arm)", "Arm-based VMs (Cobalt, Ampere)", "Axion and Tau T2A (Arm)", "Rebuild images for Arm; test performance"]
              ] },
              { t: "h", text: "Choosing a commitment" },
              { t: "table", headers: ["Commitment", "You commit to", "Flexibility", "Best for"], rows: [
                ["Compute Savings Plans", "A $/hour of compute spend for 1 or 3 years", "Any instance family, size, region, OS, plus Fargate and Lambda", "Most organizations' default baseline cover"],
                ["EC2 Instance Savings Plans", "$/hour for one instance family in one region", "Size and OS within the family", "Stable fleets; deeper discount than Compute SP"],
                ["Reserved Instances (standard / convertible)", "A specific instance configuration", "Convertible RIs can be exchanged; standard can be sold on the RI Marketplace", "Mostly legacy for EC2; still the model for RDS, ElastiCache, OpenSearch, Redshift"],
                ["Capacity reservations", "Capacity in a specific AZ, billed whether used or not", "None; no discount on their own", "Guaranteed capacity for launches or DR; pair with a Savings Plan for price"],
                ["Spot", "Nothing", "Interruptible at short notice", "Stateless, checkpointed, diversified fleets"]
              ] },
              { t: "p", html: "Azure offers reservations and a savings plan for compute with the same shape; Google Cloud offers resource-based and spend-based committed use discounts, and applies sustained use discounts automatically to some machine types. On every cloud, buy in tranches (for example quarterly) rather than one big commitment, and track <strong>coverage</strong> and <strong>utilisation</strong>: an unused commitment is pure waste." },
              { t: "h", text: "The hidden line items" },
              { t: "ul", items: [
                "<strong>NAT gateway processing</strong>: charged per GB in addition to hourly. Pulling from object storage through NAT is a classic surprise; gateway endpoints for S3 and DynamoDB remove it.",
                "<strong>Cross-zone traffic</strong>: data between availability zones is usually billed in both directions. Chatty services spread across zones pay for every hop.",
                "<strong>Internet egress</strong>: data leaving the cloud is billed per GB; a CDN in front often reduces both cost and latency.",
                "<strong>Orphans</strong>: unattached volumes, old snapshots, idle load balancers, unused public IPv4 addresses, forgotten test clusters.",
                "<strong>Logs</strong>: ingestion and retention of verbose logs can rival compute. Set retention per log group and sample debug logs."
              ] },
              { t: "widget", id: "wafCostEstimator" },
              { t: "table", headers: ["Tier", "Approach to a big bill"], rows: [
                ["Naive", "Buy a three-year commitment on everything running today"],
                ["Solid", "Schedule non-production, rightsize with recommendations, then commit to the steady baseline"],
                ["Standout", "All of that, plus architecture fixes for NAT, cross-zone and egress costs, unit-cost targets per team, and anomaly alerts routed to owners"]
              ] },
              { t: "note", variant: "key", html: "<strong>Waste, then size, then rate \u2014 and read the network lines.</strong> Commitments discount what you run; architecture changes stop you paying for traffic you never needed to send." }
            ]
          },
          {
            id: "sustainability",
            title: "Sustainability as an engineering constraint",
            summary: "The shared responsibility for sustainability, and the practical levers: region choice, utilisation, efficient hardware, managed services and data lifecycle.",
            minutes: 7,
            tags: ["sustainability", "utilisation", "lifecycle"],
            blocks: [
              { t: "p", html: "Sustainability follows the same split as security: the provider is responsible for the efficiency of its data centres and energy sourcing; you are responsible for how much of that capacity your workload consumes. Nearly every sustainability lever is also a cost lever." },
              { t: "table", headers: ["Lever", "What to do", "Also saves money?"], rows: [
                ["Region choice", "Where latency and data residency allow, prefer regions with lower-carbon energy (providers publish guidance)", "Sometimes"],
                ["Utilisation", "Autoscale, rightsize, consolidate low-utilisation instances", "Yes"],
                ["Efficient hardware", "Arm-based instances, newer generations, accelerators only when needed", "Usually"],
                ["Managed and serverless", "Let shared, highly utilised platforms run spiky workloads", "Often"],
                ["Data lifecycle", "Tier and expire data; avoid storing duplicates forever", "Yes"],
                ["Software efficiency", "Fewer wasted cycles: caching, efficient queries, avoiding polling", "Yes"]
              ] },
              { t: "p", html: "Measure it with the provider tooling: the AWS Customer Carbon Footprint Tool, Microsoft's Emissions Impact Dashboard, and Google Cloud Carbon Footprint. Treat the figures as directional and track trends rather than single numbers." },
              { t: "h", text: "Sustainability patterns by layer" },
              { t: "ul", items: [
                "<strong>Compute</strong>: Arm-based families (Graviton, Cobalt and Ampere, Axion and Tau T2A) for compatible workloads; Spot for batch; scale to zero for idle environments.",
                "<strong>Storage</strong>: lifecycle rules to colder tiers, compression and columnar formats such as Parquet, deletion of orphaned snapshots.",
                "<strong>Network</strong>: CDN caching and regional placement near users cut both energy and egress.",
                "<strong>Scheduling</strong>: run flexible batch work in regions or at times with lower-carbon energy where data residency allows.",
                "<strong>Architecture</strong>: event-driven and serverless designs that consume nothing while idle."
              ] },
              { t: "note", variant: "tip", html: "Pitch sustainability work alongside its cost saving. 'Move batch to Arm Spot and lifecycle old data' wins approval because it is cheaper, and it is also greener." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'reduce our footprint' or 'green IT target'. Answer with utilisation, efficient hardware, region choice and data lifecycle, and show the cost line moving with it." },
              { t: "quiz", id: "waf-cost" },
              { t: "note", variant: "key", html: "<strong>The greenest resource is the one you did not provision.</strong> Raise utilisation, prefer efficient hardware and managed platforms, and delete data you no longer need." }
            ]
          }
        ]
      }
    ]
  };
})();
