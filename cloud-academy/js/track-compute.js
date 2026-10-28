/* =====================================================================
   NIMBUS · Compute: VMs, Containers & Serverless
   window.TRACKS.compute — modules: vms / containers / serverless

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.

   Block grammar (rendered by app.js):
     {t:'p', html}              paragraph (inline HTML allowed)
     {t:'h', text}              section heading
     {t:'h2', text}             sub heading
     {t:'ul'|'ol', items:[]}    list (items are inline HTML)
     {t:'code', lang, code}     code card
     {t:'note', variant, html}  callout: tip|key|warn|trap
     {t:'table', headers, rows} data table
     {t:'compare', bad, good}   two-column contrast
     {t:'stat', items}          metric row [{v,k}]
     {t:'cue', html}            "spotting it" callout
     {t:'diagram', id}          inline SVG from app.js DIAGRAMS
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
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

  /* A .w-seg group. `pairs` is [[value, label], ...]; onPick gets the value. */
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

  function labelled(text, control) {
    return h("div", { style: "display:flex;flex-direction:column;gap:4px" },
      h("span", { style: "font-size:0.74rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em" }, text),
      control);
  }

  var Widgets = {};

  /* ==================================================================
     1. computePicker — "Which compute fits this workload?"
     Deterministic rule table: traits in, one recommendation out.
  ================================================================== */
  var PICKS = {
    ec2gpu: {
      svc: "EC2 accelerated instances (P / G / Inf / Trn) in an Auto Scaling group",
      az: "NC / ND / NV-series VMs in a VM Scale Set",
      gcp: "A3 / A2 / G2 accelerator-optimized VMs in a managed instance group",
      trade: "Full control of drivers and CUDA versions, but you own patching, capacity reservations and idle GPU cost, which is the most expensive idle in the cloud."
    },
    ecsgpu: {
      svc: "ECS on EC2 GPU capacity (capacity provider) — Fargate has no GPU support at the time of writing",
      az: "AKS GPU node pool, or Container Apps serverless GPU (looser match)",
      gcp: "GKE GPU node pool, or Cloud Run with GPU (looser match)",
      trade: "You keep container packaging and a simple scheduler, but you still manage the GPU host fleet and its AMI."
    },
    eksgpu: {
      svc: "EKS with a GPU node pool provisioned by Karpenter",
      az: "AKS with a GPU user node pool",
      gcp: "GKE Standard with GPU node pools (or Autopilot GPU classes)",
      trade: "Best bin-packing and scheduling control for many GPU jobs, paid for with a cluster to operate and upgrade."
    },
    ec2: {
      svc: "EC2 Auto Scaling group from a golden AMI",
      az: "Virtual Machine Scale Sets from an Azure Compute Gallery image",
      gcp: "Managed instance group from a custom image family",
      trade: "Works for anything that needs a full OS (agents, kernel modules, licensed software), but every patch, image bake and scaling rule is yours."
    },
    eks: {
      svc: "EKS (managed node groups or Karpenter)",
      az: "AKS",
      gcp: "GKE Standard (Autopilot if you want nodes managed for you)",
      trade: "Portable Kubernetes API and a huge ecosystem, but a platform team has to own upgrades, add-ons and cluster security."
    },
    fargate: {
      svc: "ECS services or scheduled tasks on Fargate",
      az: "Azure Container Apps (apps or jobs)",
      gcp: "Cloud Run (services or jobs)",
      trade: "No hosts to patch and no 15-minute ceiling, but per-vCPU-second pricing is higher than well-packed EC2 at a steady baseline."
    },
    lambdaImg: {
      svc: "Lambda packaged as a container image",
      az: "Azure Container Apps scaled to zero (closer than Functions)",
      gcp: "Cloud Run with min instances 0",
      trade: "Scale-to-zero and per-invocation billing, but the 15-minute limit and one-request-per-environment model still apply; Cloud Run is the cleaner fit for an existing container."
    },
    lambda: {
      svc: "Lambda (zip package) behind its event source",
      az: "Azure Functions on the Flex Consumption plan",
      gcp: "Cloud Run functions",
      trade: "Near-zero ops and pay-per-use, but cold starts, a 15-minute ceiling and per-request pricing that loses to containers at high steady load."
    },
    stepfn: {
      svc: "Split into Step Functions states calling Lambda, or repackage as a Fargate task",
      az: "Durable Functions or Logic Apps orchestrating Functions",
      gcp: "Workflows orchestrating Cloud Run functions, or a Cloud Run job",
      trade: "Keeps zip-based functions, but you redesign the job into checkpointed steps; repackaging as a container is often less work."
    }
  };

  function pickCompute(s) {
    if (s.gpu === "yes") {
      if (s.pack === "os") return { key: "ec2gpu", why: "GPU + full OS image needs accelerated VMs" };
      if (s.ops === "high") return { key: "eksgpu", why: "GPU containers + appetite to run a cluster" };
      return { key: "ecsgpu", why: "GPU containers, low ops appetite, but serverless containers lack GPUs" };
    }
    if (s.pack === "os") return { key: "ec2", why: "needs a full OS, so it is a VM regardless of traffic" };
    if (s.long === "yes") {
      if (s.pack === "zip") return { key: "stepfn", why: "zip package but runs past the 15-minute Lambda ceiling" };
      if (s.ops === "high") return { key: "eks", why: "long-running containers + appetite to run Kubernetes" };
      return { key: "fargate", why: "long-running container, no hosts wanted" };
    }
    if (s.pack === "zip") return { key: "lambda", why: "short, event-shaped work in a zip package" };
    if (s.ops === "high") return { key: "eks", why: "containers + a platform team that wants Kubernetes" };
    if (s.traffic === "steady") return { key: "fargate", why: "steady container traffic, no hosts wanted" };
    return { key: "lambdaImg", why: "short container work that is idle or spiky most of the day" };
  }

  Widgets.computePicker = function (mount) {
    shell(mount, "decision", "Which compute fits this workload?",
      "Set the workload traits. The rules are deliberately simple and deterministic: they encode the first cut a senior engineer makes before arguing about details.");

    var s = { traffic: "spiky", long: "no", pack: "container", ops: "low", gpu: "no" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function row(label, value, strong) {
      return h("div", { style: "display:grid;grid-template-columns:minmax(90px,0.6fr) minmax(160px,2fr);gap:12px;padding:8px 10px;border-radius:10px;" +
        (strong ? "background:color-mix(in srgb, var(--accent) 14%, transparent);" : "border-bottom:1px solid var(--line);") },
        h("b", { style: "font-size:0.8rem;color:var(--accent-ink);font-family:var(--font-mono)" }, label),
        h("span", { style: "font-size:0.88rem;color:var(--text);line-height:1.45" }, value));
    }

    function paint() {
      var r = pickCompute(s);
      var p = PICKS[r.key] || PICKS.fargate;
      clear(stage);
      stage.appendChild(row("AWS", p.svc, true));
      stage.appendChild(row("Azure", p.az, false));
      stage.appendChild(row("GCP", p.gcp, false));
      stage.appendChild(h("p", { style: "margin:10px 4px 0;font-size:0.86rem;color:var(--text-dim);line-height:1.5" }, "Trade-off: " + p.trade));
      clear(readout);
      readout.appendChild(ro("pick", r.key === "lambdaImg" ? "Lambda (image)" : r.key === "stepfn" ? "Step Functions" : r.key === "ec2gpu" ? "EC2 GPU" : r.key === "ecsgpu" ? "ECS on GPU EC2" : r.key === "eksgpu" ? "EKS + GPU" : r.key.toUpperCase()));
      readout.appendChild(ro("rule", r.why));
      readout.appendChild(ro("scale to zero", (r.key === "lambda" || r.key === "lambdaImg" || r.key === "stepfn") ? "yes" : "no (pay for baseline)"));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("traffic shape", segment([["steady", "Steady"], ["spiky", "Spiky"], ["idle", "Idle most of day"]], 1, function (v) { s.traffic = v; paint(); })),
      labelled("runs > 15 min", segment([["no", "No"], ["yes", "Yes"]], 0, function (v) { s.long = v; paint(); })),
      labelled("packaging", segment([["container", "Container"], ["zip", "Zip"], ["os", "Full OS"]], 0, function (v) { s.pack = v; paint(); })),
      labelled("ops appetite", segment([["low", "Low"], ["high", "High"]], 0, function (v) { s.ops = v; paint(); })),
      labelled("GPU", segment([["no", "No"], ["yes", "Yes"]], 0, function (v) { s.gpu = v; paint(); }))
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. computeAutoscale — target tracking over a fixed 24-hour series
     Demand is in "CPU units"; one instance supplies 100 units at 100%.
  ================================================================== */
  var DEMAND = [120, 100, 90, 90, 110, 160, 260, 400, 540, 620, 660, 640, 600, 580, 620, 720, 840, 780, 620, 460, 330, 250, 180, 140];

  function simulateScaling(target, minC, maxC, warm, cool) {
    var running = Math.max(1, minC);
    var pending = [];
    var lastAction = -1000;
    var cap = [];
    for (var i = 0; i < DEMAND.length; i++) {
      var still = [], j, inflight = 0;
      for (j = 0; j < pending.length; j++) {
        if (pending[j].ready <= i) running += pending[j].n; else still.push(pending[j]);
      }
      pending = still;
      for (j = 0; j < pending.length; j++) inflight += pending[j].n;
      var desired = Math.ceil(DEMAND[i] / Math.max(1, target));
      desired = Math.max(minC, Math.min(maxC, desired));
      if (desired > running + inflight) {
        var add = desired - running - inflight;
        if (warm <= 0) running += add; else pending.push({ ready: i + warm, n: add });
        lastAction = i;
      } else if (desired < running && inflight === 0 && i - lastAction >= cool) {
        running = desired;
        lastAction = i;
      }
      cap.push(running);
    }
    return cap;
  }

  Widgets.computeAutoscale = function (mount) {
    shell(mount, "simulator", "Target tracking on a day of traffic",
      "Each bar is one hour of a fixed demand curve (cyan) against the capacity the group actually had in service (pink; rose when demand exceeded it). One instance supplies 100 CPU units. Warm-up delays new instances; cooldown delays scale-in after any scaling action.");

    var target = 60, minC = 2, maxC = 12, warm = 1, cool = 3;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var cap = simulateScaling(target, minC, maxC, warm, cool);
      var maxD = 0, maxCap = 0, hours = 0, over = 0, under = 0, utilSum = 0, i;
      for (i = 0; i < DEMAND.length; i++) {
        if (DEMAND[i] > maxD) maxD = DEMAND[i];
        if (cap[i] > maxCap) maxCap = cap[i];
        hours += cap[i];
        var supply = cap[i] * 100;
        if (DEMAND[i] > cap[i] * target) over++;
        if (DEMAND[i] > supply) under++;
        utilSum += supply > 0 ? Math.min(1, DEMAND[i] / supply) : 0;
      }
      var scale = Math.max(maxD, maxCap * 100, 1);
      clear(stage);
      var chart = h("div", { style: "display:flex;align-items:flex-end;gap:3px;height:150px;padding:6px 2px;border-bottom:1px solid var(--line-strong)" });
      for (i = 0; i < DEMAND.length; i++) {
        var dH = Math.max(2, Math.round(DEMAND[i] / scale * 140));
        var cH = Math.max(2, Math.round(cap[i] * 100 / scale * 140));
        var short = DEMAND[i] > cap[i] * 100;
        chart.appendChild(h("div", { style: "flex:1;display:flex;align-items:flex-end;gap:1px;min-width:0", title: "h" + i + ": demand " + DEMAND[i] + ", capacity " + cap[i] * 100 },
          h("i", { style: "display:block;flex:1;height:" + dH + "px;background:var(--cyan);border-radius:3px 3px 0 0" }),
          h("i", { style: "display:block;flex:1;height:" + cH + "px;background:" + (short ? "var(--rose)" : "var(--accent)") + ";border-radius:3px 3px 0 0" })));
      }
      stage.appendChild(chart);
      stage.appendChild(h("div", { style: "display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-dim);font-family:var(--font-mono);padding-top:4px" },
        h("span", {}, "00:00"), h("span", {}, "12:00"), h("span", {}, "23:00")));
      clear(readout);
      readout.appendChild(ro("peak capacity", maxCap + " instances"));
      readout.appendChild(ro("instance-hours", hours));
      readout.appendChild(ro("hours over target", over + " / 24"));
      readout.appendChild(ro("under-provisioned", under + " h"));
      readout.appendChild(ro("avg utilisation", Math.round(utilSum / DEMAND.length * 100) + "%"));
      if (maxC * 100 < maxD) readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;color:var(--text-dim)" }, "Max capacity " + maxC + " cannot cover the " + maxD + "-unit peak even at 100% CPU — the cap, not the policy, is the bottleneck."));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("target CPU", segment([[40, "40%"], [60, "60%"], [80, "80%"]], 1, function (v) { target = v; paint(); })),
      labelled("min", segment([[1, "1"], [2, "2"], [4, "4"]], 1, function (v) { minC = v; paint(); })),
      labelled("max", segment([[8, "8"], [12, "12"], [24, "24"]], 1, function (v) { maxC = v; paint(); })),
      labelled("warm-up", segment([[0, "0 h"], [1, "1 h"], [2, "2 h"]], 1, function (v) { warm = v; paint(); })),
      labelled("scale-in cooldown", segment([[1, "1 h"], [3, "3 h"], [6, "6 h"]], 1, function (v) { cool = v; paint(); }))
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
    "compute-events": {
      title: "APIs and event-driven integration checkpoint",
      sub: "API Gateway, SQS, SNS, EventBridge and the patterns that keep them reliable.",
      questions: [
        {
          q: "Several services must each receive every 'order placed' event, and each needs its own retry and backlog. What is the classic AWS shape?",
          options: ["One SQS queue read by all services", "Publish to an SNS topic or EventBridge bus, with a separate SQS queue subscribed per consumer", "Each service polls the orders database", "Kinesis with one shard per service"],
          answer: 1,
          explain: "Fan-out with a queue per consumer gives each service an independent backlog, retry policy and dead-letter queue, so a slow consumer never blocks the others. A single shared queue delivers each message to only one consumer."
        },
        {
          q: "A Lambda function consuming an SQS queue has a 60-second timeout. Messages are being processed twice even though the function succeeds. What is the most likely fix?",
          options: ["Lower the function timeout", "Raise the queue's visibility timeout well above the function timeout (AWS suggests at least six times)", "Switch to SNS", "Disable the dead-letter queue"],
          answer: 1,
          explain: "If the visibility timeout expires before processing and deletion finish, the message becomes visible again and is delivered a second time. Handlers must still be idempotent, because standard queues are at-least-once anyway."
        },
        {
          q: "When is an SQS FIFO queue the right choice over a standard queue?",
          options: ["Whenever you need high throughput", "When order matters within a key, such as all events for one account, and you want deduplication; you group by message group ID to keep parallelism", "When messages are larger than usual", "When you need fan-out"],
          answer: 1,
          explain: "FIFO preserves order per message group and deduplicates within a window. Ordering is per group, so choose a group ID such as the account ID to keep many groups processing in parallel. Standard queues give higher throughput with best-effort ordering."
        },
        {
          q: "Which feature lets you route events from many AWS services and SaaS partners by content, archive them and replay them later?",
          options: ["SNS FIFO", "Amazon EventBridge event buses with rules, archive and replay", "SQS delay queues", "API Gateway usage plans"],
          answer: 1,
          explain: "EventBridge rules match on event content and route to many targets, archives keep events, and replay resends them, which is useful after fixing a consumer bug. EventBridge Scheduler and Pipes extend it for schedules and point-to-point integrations."
        },
        {
          q: "Which set lists the closest Azure and Google Cloud counterparts for queues and event routing?",
          options: ["Azure Service Bus and Event Grid; Google Pub/Sub and Eventarc", "Azure Blob and Cloud Storage", "Azure Front Door and Cloud CDN", "Azure Functions and Cloud Run"],
          answer: 0,
          explain: "Service Bus offers queues and topics with sessions for ordering; Event Grid routes discrete events; Event Hubs handles streams. On Google Cloud, Pub/Sub covers topics and subscriptions, Eventarc routes events to Cloud Run and other targets, and Cloud Tasks covers task queues."
        }
      ]
    },
    "compute-vms": {
      title: "Virtual machines checkpoint",
      sub: "Instance families, images, metadata, purchase options and scaling groups.",
      questions: [
        {
          q: "In the EC2 instance type c7g.2xlarge, what does the letter g tell you?",
          options: ["It has an attached GPU", "It runs on an AWS Graviton (Arm) processor", "It belongs to the general-purpose family", "It has enhanced networking"],
          answer: 1,
          explain: "The first letter is the family (c = compute optimized), the digit is the generation, and the letters after it are attributes; g means Graviton, AWS's Arm CPU. GPUs live in the P and G families, which is a different position in the name. Mixing those up in a sizing discussion is an easy way to lose credibility."
        },
        {
          q: "How much warning does EC2 give before reclaiming a Spot Instance?",
          options: ["About 30 seconds", "None", "About 10 minutes", "About two minutes"],
          answer: 3,
          explain: "EC2 posts a two-minute interruption notice to instance metadata and EventBridge, and may send an earlier rebalance recommendation. Azure Spot VMs and GCP Spot VMs typically give around 30 seconds. Either way, Spot only suits work that can checkpoint, drain or be retried."
        },
        {
          q: "Why does IMDSv2 blunt most SSRF attacks that stole credentials under IMDSv1?",
          options: ["It encrypts the credentials it returns", "A caller must first PUT for a session token with a custom header, which a typical SSRF GET cannot do, and the hop limit stops forwarded requests", "It moves metadata to a private DNS name only the root user can resolve", "It removes instance profiles entirely"],
          answer: 1,
          explain: "IMDSv1 answered any GET to the link-local address, so an app tricked into fetching that URL handed over role credentials. IMDSv2 requires a PUT with a TTL header to get a token, then the token on every read, and its default hop limit of 1 drops responses that would traverse an extra network hop. Enforce it with HttpTokens=required."
        },
        {
          q: "A service runs 40 instances around the clock and bursts to 90 for six hours a day. Which purchase mix is the usual answer?",
          options: ["All On-Demand, for flexibility", "A Savings Plan sized to the steady 40, with On-Demand or Spot covering the daily burst", "A three-year commitment sized to the 90-instance peak", "All Spot, because it is the cheapest"],
          answer: 1,
          explain: "Commit to the baseline you are confident will exist for the term, because unused commitment is pure waste. Peaks are short and variable, so pay On-Demand for them or use Spot if the tier is interruption-tolerant. Committing to the peak pays for 50 idle instances eighteen hours a day."
        },
        {
          q: "Instances in an Auto Scaling group pass EC2 status checks but the app on them returns HTTP 500, and the group never replaces them. What is the fix?",
          options: ["Raise the group's maximum capacity", "Switch the group's health check type to ELB so failed target health checks mark instances unhealthy, with a sensible grace period", "Turn on predictive scaling", "Move to a larger instance type"],
          answer: 1,
          explain: "With the default EC2 health check the group only sees hypervisor and OS-level status, so a broken app looks healthy. Using the load balancer's health checks lets the group replace instances that fail at the application layer. The grace period stops it killing instances that are still booting."
        }
      ]
    },
    "compute-containers": {
      title: "Containers checkpoint",
      sub: "ECS, Fargate, EKS, AKS and GKE, and workload identity.",
      questions: [
        {
          q: "An ECS task's application code reads from a DynamoDB table. Which role should grant that permission?",
          options: ["The task execution role", "The container instance role", "The task role", "The ECS service-linked role"],
          answer: 2,
          explain: "The task role is what the code inside the container assumes. The task execution role is used by the ECS agent to pull the image, write logs and fetch secrets before your code starts. Putting app permissions on the execution role or the instance role over-shares them with everything on the host."
        },
        {
          q: "Which of these is a real limitation of Fargate at the time of writing?",
          options: ["Tasks cannot run in private subnets", "Tasks cannot use IAM task roles", "Tasks cannot pull images from ECR", "Tasks cannot use GPUs"],
          answer: 3,
          explain: "Fargate runs in private subnets, supports task roles and pulls from ECR without trouble. It does not offer GPUs, privileged containers or host-level daemons, so GPU inference on ECS means EC2 capacity. Knowing the edges of a managed option is what lets you defend choosing it."
        },
        {
          q: "How is GKE Autopilot primarily billed for workloads?",
          options: ["By the resource requests of the pods you run", "By the VMs in your node pools, whatever runs on them", "By a flat per-cluster fee only", "By container image size"],
          answer: 0,
          explain: "Autopilot manages nodes for you and charges for the CPU, memory and storage your pods request, so idle node headroom is not your bill. Standard mode bills the node VMs, which rewards good bin-packing and punishes poor packing. There is also a cluster management fee in both modes."
        },
        {
          q: "What does EKS Pod Identity simplify compared with IRSA?",
          options: ["Pods no longer need any IAM role", "It grants the node's instance role to every pod", "There is no per-cluster IAM OIDC provider to create, and one role trust policy can serve many clusters", "It also works for ECS tasks"],
          answer: 2,
          explain: "IRSA requires an IAM OIDC provider per cluster and a trust policy naming that cluster's issuer and the service account. Pod Identity uses an agent add-on and an association API, with a trust policy for the EKS pods service principal, so roles are reusable across clusters. Both still give each workload its own least-privilege role."
        },
        {
          q: "A team of four runs six HTTP services on AWS only, has no Kubernetes experience, and wants to stop patching hosts. What is the strongest default?",
          options: ["EKS with self-managed node groups", "ECS services on Fargate", "Self-managed Kubernetes on EC2", "Docker Compose on a large EC2 instance"],
          answer: 1,
          explain: "ECS on Fargate gives container scheduling, load balancer integration and IAM per task with no control plane or hosts to run. EKS earns its overhead when you need the Kubernetes API, its ecosystem or portability. A single Compose host is a single point of failure that still needs patching."
        }
      ]
    },
    "compute-serverless": {
      title: "Serverless and compute choice checkpoint",
      sub: "Lambda, Azure Functions, Cloud Run, orchestration and picking the right compute.",
      questions: [
        {
          q: "A Lambda function receives a steady 2,000 requests per second with an average duration of 250 ms. Roughly how much concurrency does it need?",
          options: ["250", "500", "2,000", "8,000"],
          answer: 1,
          explain: "Concurrency is arrival rate multiplied by duration: 2,000 per second times 0.25 seconds is about 500 environments busy at any moment. That number is what you compare with the account's regional concurrency limit and any reserved concurrency. Halving the duration halves the concurrency."
        },
        {
          q: "A nightly containerised batch job runs for about 40 minutes. Where should it run?",
          options: ["Lambda with the timeout raised to 60 minutes", "Lambda with provisioned concurrency", "A scheduled ECS task on Fargate, or a Cloud Run job / Container Apps job", "An API Gateway integration"],
          answer: 2,
          explain: "Lambda's hard ceiling is 15 minutes, and provisioned concurrency only removes cold starts. A scheduled Fargate task, a Cloud Run job or a Container Apps job runs the existing container to completion with no hosts. API Gateway is a front door, not a runtime."
        },
        {
          q: "What is the key scaling difference between a Cloud Run instance with concurrency 80 and a Lambda execution environment?",
          options: ["Cloud Run can serve many requests at once on one instance, while a Lambda environment handles one request at a time", "They behave identically", "Lambda serves 80 requests per environment by default", "Cloud Run serves one request per instance by default"],
          answer: 0,
          explain: "Cloud Run lets one container instance handle many concurrent requests, which suits I/O-bound services and reduces cold starts and cost. Lambda scales by adding environments, one in-flight request each. That is why connection pooling and memory sizing feel different on the two platforms."
        },
        {
          q: "What happens to CPU when you raise a Lambda function's memory from 512 MB to about 1,769 MB?",
          options: ["Nothing; CPU is fixed", "It gets roughly one full vCPU, because CPU is allocated in proportion to memory", "It switches to Graviton automatically", "It gains a GPU"],
          answer: 1,
          explain: "Lambda allocates CPU proportionally to configured memory, reaching about one vCPU near 1,769 MB and up to six vCPUs at the 10 GB maximum. CPU-bound functions often run faster and cost the same or less at higher memory. Measure duration across sizes rather than defaulting to the minimum."
        },
        {
          q: "An order workflow waits up to three days for a human approval before charging a card. Which Step Functions type fits?",
          options: ["Express workflows", "Standard workflows", "A Lambda function that sleeps between polls", "An SQS delay queue"],
          answer: 1,
          explain: "Standard workflows can run for up to a year, record full execution history and support callback tasks that wait for a token from the approver. Express workflows cap out at five minutes and are built for high-volume, short event processing. A sleeping Lambda burns money and still hits the 15-minute limit."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.compute = {
    id: "compute",
    name: "Compute: VMs, Containers & Serverless",
    short: "COMP",
    tagline: "Pick the right runtime, then make it scale",
    color: "#f472b6",
    blurb: "From EC2 instance families and purchase options to Auto Scaling, ECS and EKS, Lambda and Step Functions — each mapped to Azure VMs, Scale Sets, AKS, Functions and Logic Apps, and to GCE, managed instance groups, GKE, Cloud Run and Workflows, with the places the equivalence breaks called out.",
    modules: [
      {
        id: "vms",
        name: "Virtual Machines",
        icon: "cube",
        lessons: [
          {
            id: "instance-families",
            title: "Instance families, sizing and Graviton",
            summary: "Read an instance type name, match the family to the bottleneck, and know when Arm is a free win.",
            minutes: 9,
            tags: ["ec2", "sizing", "graviton", "azure-vm", "gce"],
            blocks: [
              { t: "p", html: "A virtual machine is a slice of a physical host with a fixed ratio of <strong>vCPU, memory, local storage and network</strong>. Families exist because workloads are bottlenecked on different things. Your job is not to memorise every SKU; it is to name the bottleneck first and then pick the family whose ratio matches it." },
              { t: "h", text: "Reading an EC2 instance type" },
              { t: "code", lang: "text", code:
                "c7gn.2xlarge\n" +
                "| | |  '-------- size: large=2 vCPU, xlarge=4, 2xlarge=8, 4xlarge=16 ...\n" +
                "| | '---------- attributes: n = extra network bandwidth\n" +
                "| '------------ processor: g = Graviton (Arm), i = Intel, a = AMD\n" +
                "'-------------- family: c = compute optimized; 7 = generation"
              },
              { t: "p", html: "Sizes roughly double each step, and so does the price. On x86 a vCPU is a hyperthread; on Graviton each vCPU is a physical core, which is one reason Arm often performs better per vCPU for multi-threaded services." },
              { t: "h", text: "Families mapped across clouds" },
              { t: "table", headers: ["Bottleneck", "AWS", "Azure", "GCP", "Typical workload"], rows: [
                ["Balanced", "M (m7i, m7g, m8g); T burstable", "D-series; B burstable", "E2, N2, N4, C4 (general)", "Web and API tiers, small databases"],
                ["CPU", "C (c7i, c7g)", "F-series", "C3, C4, H3 (HPC)", "Batch, encoding, high-RPS services"],
                ["Memory", "R, X, high-memory U", "E-series, M-series", "M3, M4", "Caches, in-memory analytics, big JVM heaps"],
                ["Local disk / IOPS", "I (NVMe), D (dense HDD)", "L-series", "Z3", "Self-managed databases, search, Kafka"],
                ["Accelerators", "P (training), G (graphics/inference), Inf, Trn", "NC, ND, NV-series", "A2, A3, G2", "ML training and inference, rendering"],
                ["Arm CPUs", "Graviton (g suffix)", "Cobalt / Ampere (p in the name, e.g. Dpsv6)", "Axion C4A, Tau T2A", "Price-performance for portable code"]
              ] },
              { t: "note", variant: "warn", html: "Family names line up loosely, not exactly. A GCP <code class='tok'>N2</code> and an AWS <code class='tok'>m6i</code> are both 'general purpose' but differ in memory per vCPU, network ceilings and local-disk options. Compare the ratios, never the letters." },
              { t: "h", text: "Burstable instances" },
              { t: "p", html: "T-family (AWS) and B-series (Azure) earn CPU credits while idle and spend them under load. They are great for dev boxes and spiky low-traffic services. Run one at sustained high CPU and you either get throttled to baseline or, in unlimited mode, pay surplus charges that can exceed a fixed-performance instance." },
              { t: "h", text: "Graviton and Arm" },
              { t: "ul", items: [
                "Graviton instances commonly deliver meaningfully better price-performance than comparable x86 — figures around 20% are often quoted, and your mileage depends on the workload.",
                "Interpreted and JIT runtimes (Python, Node.js, Java, .NET, Go) usually move with a rebuild of native dependencies and a multi-arch container image.",
                "Blockers are x86-only binaries, licensed agents without Arm builds, and hand-tuned SIMD code.",
                "Run a canary on Arm behind the same load balancer and compare p99 latency and cost per request before migrating a fleet."
              ] },
              { t: "h", text: "Right-sizing" },
              { t: "compare",
                bad: { title: "Sizing by guess", items: ["Pick the instance someone used last time", "Size for the worst hour of the year", "Never revisit after launch"] },
                good: { title: "Sizing by evidence", items: ["Load test to find the real bottleneck", "Size for p95 and let scaling absorb peaks", "Review AWS Compute Optimizer, Azure Advisor or GCP rightsizing recommendations quarterly"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'cache cluster', 'large heap', 'in-memory' point to memory-optimized; 'video transcode', 'CPU-bound' point to compute-optimized; 'self-managed Cassandra', 'NVMe' point to storage-optimized; 'reduce cost with no code change' points to Graviton for portable runtimes." },
              { t: "note", variant: "key", html: "<strong>Name the bottleneck, then pick the ratio.</strong> Family letters differ across clouds; vCPU-to-memory, local disk and network ceilings are what you actually compare — and Arm is the cheapest performance win when your code is portable." }
            ]
          },
          {
            id: "images-metadata",
            title: "Golden images, bootstrapping and IMDSv2",
            summary: "Bake what changes rarely, bootstrap what changes per environment, and lock down instance metadata.",
            minutes: 9,
            tags: ["ami", "golden-image", "imdsv2", "ssrf", "user-data"],
            blocks: [
              { t: "p", html: "Every VM starts from an <strong>image</strong>: a snapshot of a boot disk plus launch metadata. On AWS that is an <strong>AMI</strong>; Azure keeps versioned images in an <strong>Azure Compute Gallery</strong>; GCP has <strong>custom images</strong> grouped into <strong>image families</strong> so 'latest' resolves to the newest non-deprecated image." },
              { t: "h", text: "Bake versus bootstrap" },
              { t: "table", headers: ["Approach", "What goes in", "Buys you", "Costs you"], rows: [
                ["Fully baked golden image", "OS hardening, agents, runtime, the app build", "Fast, identical boots; ideal for scaling groups", "A new image per release; an image pipeline to own"],
                ["Baked base + bootstrap", "Hardened OS and agents in the image; config and app pulled at boot via user data / cloud-init", "One image serves many apps and environments", "Slower boots; boot-time dependency on artifact stores"],
                ["Bootstrap everything", "Stock vendor image, script installs all at boot", "Nothing to build", "Slow, drift-prone boots that fail when a package mirror does"]
              ] },
              { t: "p", html: "Build images with a pipeline, not by hand: <strong>EC2 Image Builder</strong> or Packer on AWS, <strong>Azure VM Image Builder</strong> into a Compute Gallery, and Packer or Cloud Build producing GCP custom images. Scan the image, tag it with the source commit, share it to workload accounts, and deprecate old versions on a schedule." },
              { t: "note", variant: "tip", html: "AMIs are regional. A multi-region service needs the image copied to each region as part of the pipeline, and encrypted AMIs need the KMS key shared too. Discovering this during a regional failover is the classic late surprise." },
              { t: "h", text: "Instance metadata: the credential vending machine" },
              { t: "p", html: "Each VM can query a link-local metadata endpoint for its identity, network config and — crucially — <strong>temporary credentials for its attached role</strong>. That makes the endpoint the most valuable target on the box. Under IMDSv1 any GET to it worked, so a server-side request forgery (SSRF) bug in a web app could be steered to fetch role credentials." },
              { t: "code", lang: "bash", code:
                "# IMDSv2: get a session token with a PUT, then present it on every read\n" +
                "TOKEN=$(curl -s -X PUT \"169.254.169.254/latest/api/token\" \\\n" +
                "  -H \"X-aws-ec2-metadata-token-ttl-seconds: 300\")\n" +
                "curl -s -H \"X-aws-ec2-metadata-token: $TOKEN\" \\\n" +
                "  \"169.254.169.254/latest/meta-data/iam/security-credentials/\""
              },
              { t: "ul", items: [
                "The PUT plus custom header defeats most SSRF primitives, which can only issue simple GETs.",
                "The response hop limit (default 1) stops the token crossing an extra network hop, such as a misconfigured proxy or a container bridge. Raise it to 2 only when containers on the host genuinely need metadata.",
                "Require it everywhere: <code class='tok'>HttpTokens=required</code> in every launch template, the account-level IMDS default set to v2, and an SCP that denies launches without it."
              ] },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [{\n" +
                "    \"Sid\": \"DenyLaunchWithoutImdsV2\",\n" +
                "    \"Effect\": \"Deny\",\n" +
                "    \"Action\": \"ec2:RunInstances\",\n" +
                "    \"Resource\": \"arn:aws:ec2:*:*:instance/*\",\n" +
                "    \"Condition\": { \"StringNotEquals\": { \"ec2:MetadataHttpTokens\": \"required\" } }\n" +
                "  }]\n" +
                "}"
              },
              { t: "h", text: "The same idea on Azure and GCP" },
              { t: "table", headers: ["Cloud", "Endpoint", "Request guard", "How close to IMDSv2"], rows: [
                ["AWS", "169.254.169.254", "Session token from a PUT, hop limit", "—"],
                ["Azure", "169.254.169.254/metadata", "Header <code class='tok'>Metadata: true</code>; rejects requests carrying X-Forwarded-For", "Looser: a static header, no session token"],
                ["GCP", "metadata.google.internal", "Header <code class='tok'>Metadata-Flavor: Google</code>", "Looser: a static header, no session token"]
              ] },
              { t: "note", variant: "trap", html: "A static header stops naive SSRF but not an SSRF that lets the attacker set headers. On every cloud the real defence is layered: fix the SSRF, give the VM's identity least privilege, and block egress to the metadata address from containers that do not need it." },
              { t: "note", variant: "key", html: "<strong>Bake for speed, bootstrap for variety, and never run IMDSv1.</strong> Require IMDSv2 in the launch template and by SCP, because the metadata endpoint hands out the instance's credentials to anyone who can reach it." }
            ]
          },
          {
            id: "purchase-options",
            title: "Purchase options: On-Demand, Savings Plans, Spot",
            summary: "Commit to the baseline, rent the peaks, and run interruptible work on spare capacity.",
            minutes: 9,
            tags: ["pricing", "savings-plans", "spot", "reservations", "cud"],
            blocks: [
              { t: "p", html: "The same VM can cost very different amounts depending on how you buy it. The mental model is a <strong>layer cake</strong>: a committed layer for the load that will exist all year, an on-demand layer for predictable-but-variable load, and a spot layer for work that tolerates being killed." },
              { t: "h", text: "The options, mapped" },
              { t: "table", headers: ["Model", "AWS", "Azure", "GCP", "Shape of the deal"], rows: [
                ["Pay as you go", "On-Demand (per-second for Linux)", "Pay-as-you-go", "On-demand, plus automatic sustained-use discounts on some families", "No commitment, highest unit price"],
                ["Spend commitment", "Compute Savings Plans (also cover Fargate and Lambda)", "Azure savings plan for compute", "Spend-based (flexible) committed use discounts", "Commit $/hour for 1 or 3 years; flexible across families and regions"],
                ["Resource commitment", "EC2 Instance Savings Plans; Reserved Instances", "Reservations", "Resource-based committed use discounts", "Commit to a family/region (or exact SKU) for deeper discount"],
                ["Spare capacity", "Spot Instances", "Spot VMs", "Spot VMs (preemptible is the legacy flavour)", "Large discounts; reclaimable with short notice"]
              ] },
              { t: "stat", items: [
                { v: "up to ~72%", k: "commitment discount, illustrative" },
                { v: "up to ~90%", k: "Spot discount, illustrative" },
                { v: "2 min", k: "EC2 Spot interruption notice" },
                { v: "~30 s", k: "typical Azure / GCP Spot notice" }
              ] },
              { t: "note", variant: "warn", html: "Discount percentages are <strong>illustrative ceilings</strong> that vary by family, region, term and payment option. Quote the shape (commitments are tens of percent, Spot can be most of the price) rather than a number you cannot defend." },
              { t: "h", text: "Sizing a commitment" },
              { t: "code", lang: "text", code:
                "hourly usage over 30 days (instances):  min 38   p10 40   median 55   peak 90\n" +
                "commit to ~p10 baseline     -> 40 instances' worth of $/hour\n" +
                "between baseline and peak   -> On-Demand (or Spot for stateless tiers)\n" +
                "re-evaluate quarterly; ladder new commitments rather than one big one"
              },
              { t: "p", html: "A commitment you do not use is still billed, so commit to the floor, not the average. Spend-based commitments (Compute Savings Plans, Azure savings plan, flexible CUDs) survive a migration from x86 to Graviton or from EC2 to Fargate; resource-based ones are deeper but lock you to a family." },
              { t: "h", text: "Running Spot without getting hurt" },
              { t: "ol", items: [
                "<strong>Diversify</strong>: allow many instance types and sizes across all AZs so one capacity pool drying up does not drain the fleet.",
                "<strong>Use a capacity-aware allocation strategy</strong> (price-capacity-optimized on AWS) instead of chasing the lowest price.",
                "<strong>Handle the notice</strong>: watch metadata or EventBridge for the interruption and rebalance signals, deregister from the load balancer, drain, and checkpoint.",
                "<strong>Keep an On-Demand floor</strong> for the minimum capacity the service needs to stay up.",
                "<strong>Make work idempotent</strong> so a killed batch item is simply retried."
              ] },
              { t: "compare",
                bad: { title: "Spot misuse", items: ["Single-instance stateful database on Spot", "One instance type in one AZ", "No drain handler, so in-flight requests die"] },
                good: { title: "Spot done right", items: ["Stateless web workers, CI runners, batch, rendering", "10+ instance types across three AZs", "On-Demand base capacity plus Spot above it"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'fault-tolerant batch', 'CI runners', 'can retry' point to Spot; 'runs 24/7 for years' points to a commitment; 'unpredictable new product' points to On-Demand until you have a usage history." },
              { t: "note", variant: "key", html: "<strong>Commit to the floor, rent the peak, and put retryable work on Spot.</strong> Prefer spend-based commitments when the architecture may change, and treat a Spot interruption as a normal event your code handles." }
            ]
          },
          {
            id: "autoscaling",
            title: "Auto Scaling groups, Scale Sets and managed instance groups",
            summary: "Launch templates, scaling policies, health checks, warm pools and safe rollouts across three clouds.",
            minutes: 11,
            tags: ["asg", "vmss", "mig", "autoscaling", "instance-refresh"],
            blocks: [
              { t: "p", html: "A scaling group is a <strong>controller</strong>: you declare the template, the minimum, the maximum and a policy, and it continuously makes the fleet match. It replaces unhealthy instances, spreads them across zones and adds or removes capacity as a metric moves." },
              { t: "diagram", id: "vpc-layout", caption: "The usual shape: an ALB in public subnets in front of a scaling group whose instances live in private app subnets in two AZs." },
              { t: "h", text: "The building blocks, mapped" },
              { t: "table", headers: ["Concept", "AWS", "Azure", "GCP"], rows: [
                ["Group", "Auto Scaling group", "Virtual Machine Scale Set (Flexible or Uniform orchestration)", "Managed instance group (zonal or regional)"],
                ["Template", "Launch template (versioned)", "Scale set model / VM profile", "Instance template"],
                ["App-level health", "ELB health checks + grace period", "Application Health extension or LB probe, automatic repairs", "Autohealing with a health check"],
                ["Rollout", "Instance refresh", "Rolling upgrade policy, automatic OS image upgrade", "Rolling update (proactive or opportunistic)"],
                ["Pre-initialised capacity", "Warm pools", "No direct equivalent; standby pools in some modes", "No direct equivalent; over-provision min size"]
              ] },
              { t: "h", text: "Scaling policies" },
              { t: "table", headers: ["Policy", "How it decides", "Use it for"], rows: [
                ["Target tracking", "Holds a metric (CPU, requests per target) near a target, like a thermostat", "The default for most services"],
                ["Step scaling", "Adds or removes N instances per alarm band", "Non-linear responses, e.g. add 10 when queue depth is huge"],
                ["Scheduled", "Sets min/max/desired at given times", "Known events: business hours, a launch at 09:00"],
                ["Predictive", "Forecasts from history and scales ahead of the curve", "Strong daily or weekly cycles with slow boots"]
              ] },
              { t: "p", html: "Azure autoscale expresses the same ideas as metric rules, schedules and predictive autoscale; GCP's autoscaler targets CPU, load-balancer serving capacity or a Cloud Monitoring metric, with schedules and predictive mode. Pick a metric that rises <em>before</em> users suffer: requests per target or queue depth usually beat CPU for I/O-bound services." },
              { t: "widget", id: "computeAutoscale" },
              { t: "p", html: "Play with the simulator: a 40% target buys headroom at the price of more instance-hours; an 80% target is cheap but runs hot through the ramp. Longer warm-up turns the morning ramp red, which is exactly what predictive scaling and warm pools exist to fix." },
              { t: "h", text: "Health checks and warm pools" },
              { t: "ul", items: [
                "Default EC2 health checks only see the hypervisor and OS. Switch to <strong>ELB health checks</strong> so an app returning errors gets replaced, with a grace period long enough for boot.",
                "<strong>Warm pools</strong> keep pre-initialised instances stopped (cheap: you pay for disks) or running, so scale-out skips the slow boot and bootstrap.",
                "<strong>Lifecycle hooks</strong> pause a launch or termination so you can register with service discovery or drain connections first."
              ] },
              { t: "h", text: "Rolling out a new image" },
              { t: "code", lang: "bash", code:
                "aws autoscaling start-instance-refresh \\\n" +
                "  --auto-scaling-group-name web-asg \\\n" +
                "  --preferences '{\"MinHealthyPercentage\":90,\"InstanceWarmup\":120,\"SkipMatching\":true,\n" +
                "                  \"CheckpointPercentages\":[20,50,100],\"CheckpointDelay\":600}'"
              },
              { t: "note", variant: "tip", html: "Pair instance refresh with auto rollback on CloudWatch alarms, so a bad AMI that raises error rates stops at the first checkpoint instead of reaching 100% of the fleet." },
              { t: "h", text: "Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "What the design says", "Why it scores that way"], rows: [
                ["Naive", "Fixed fleet of 10 instances sized for peak", "Pays for peak all night; no self-healing"],
                ["Solid", "ASG across 3 AZs, target tracking on requests per target, ELB health checks, instance refresh", "Elastic, self-healing and safely updatable"],
                ["Standout", "Solid plus predictive or scheduled scaling for the morning ramp, warm pools for slow boots, a mixed instances policy with an On-Demand base and Spot above it", "Fast to react, cheap at the margin, and honest about boot time"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'traffic doubles at 9am', 'boot takes 6 minutes', 'instances look healthy but return errors', 'roll out a patched image safely' — each maps to predictive or scheduled scaling, warm pools, ELB health checks, and instance refresh respectively." },
              { t: "quiz", id: "compute-vms" },
              { t: "note", variant: "key", html: "<strong>A scaling group is a controller, so give it good signals.</strong> Scale on a metric that leads user pain, check health at the application layer, and account for boot time with warm pools or predictive scaling." }
            ]
          }
        ]
      },
      {
        id: "containers",
        name: "Containers",
        icon: "blocks",
        lessons: [
          {
            id: "ecs-fargate",
            title: "ECS: tasks, services and EC2 versus Fargate",
            summary: "AWS's own container scheduler, its two capacity models, and the two IAM roles everyone mixes up.",
            minutes: 10,
            tags: ["ecs", "fargate", "task-role", "containers"],
            blocks: [
              { t: "p", html: "Amazon ECS is a container scheduler that AWS runs for you. There is no control plane to upgrade and no cluster fee. You describe a container in a <strong>task definition</strong>, run copies of it as <strong>tasks</strong>, and keep N of them alive behind a load balancer with a <strong>service</strong>." },
              { t: "h", text: "The vocabulary" },
              { t: "table", headers: ["ECS term", "Means", "Closest Kubernetes idea"], rows: [
                ["Cluster", "A logical pool of capacity", "Cluster"],
                ["Task definition", "Versioned spec: image, CPU, memory, ports, roles, logging", "Pod spec"],
                ["Task", "A running instance of a task definition", "Pod"],
                ["Service", "Keeps N tasks running, registers them with a target group, rolls deployments", "Deployment + Service"],
                ["Capacity provider", "Where tasks run: Fargate, Fargate Spot, or an EC2 Auto Scaling group", "Node pool / cluster autoscaler"]
              ] },
              { t: "h", text: "Two launch types" },
              { t: "compare",
                bad: { title: "EC2 launch type", items: ["You run and patch the container hosts (ECS-optimized AMI)", "Cheapest at steady, well-packed load", "Needed for GPUs, daemons and privileged containers", "You manage bin-packing and host scaling"] },
                good: { title: "Fargate launch type", items: ["No hosts: each task gets its own micro-VM", "Billed per vCPU and GB per second of the task", "No GPUs, no host access (at the time of writing)", "Fargate Spot for interruption-tolerant tasks"] } },
              { t: "p", html: "Neither column is 'bad'; they trade control against operations. Most teams start on Fargate and move a hot, steady service to EC2 capacity only when the bill proves it worth the patching." },
              { t: "h", text: "Two roles, two jobs" },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"family\": \"orders-api\",\n" +
                "  \"requiresCompatibilities\": [\"FARGATE\"],\n" +
                "  \"networkMode\": \"awsvpc\",\n" +
                "  \"cpu\": \"512\", \"memory\": \"1024\",\n" +
                "  \"runtimePlatform\": { \"cpuArchitecture\": \"ARM64\", \"operatingSystemFamily\": \"LINUX\" },\n" +
                "  \"executionRoleArn\": \"arn:aws:iam::<ACCOUNT_ID>:role/orders-api-execution\",\n" +
                "  \"taskRoleArn\": \"arn:aws:iam::<ACCOUNT_ID>:role/orders-api-task\",\n" +
                "  \"containerDefinitions\": [{\n" +
                "    \"name\": \"api\",\n" +
                "    \"image\": \"<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/orders-api@sha256:<DIGEST>\",\n" +
                "    \"portMappings\": [{ \"containerPort\": 8080 }],\n" +
                "    \"secrets\": [{ \"name\": \"DB_PASSWORD\", \"valueFrom\": \"arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:orders-db\" }],\n" +
                "    \"readonlyRootFilesystem\": true\n" +
                "  }]\n" +
                "}"
              },
              { t: "ul", items: [
                "<strong>Execution role</strong>: used by the ECS agent before your code runs — pull the image from ECR, write logs, resolve the <code class='tok'>secrets</code> entries.",
                "<strong>Task role</strong>: assumed by your application code — read the DynamoDB table, publish to the queue. One role per service, scoped to its resources.",
                "<code class='tok'>awsvpc</code> mode gives every task its own ENI, so security groups apply per task rather than per host."
              ] },
              { t: "note", variant: "trap", html: "Granting app permissions on the EC2 container-instance role means every task on that host inherits them. Always use task roles, and on the EC2 launch type block task access to the host's metadata endpoint." },
              { t: "h", text: "Azure and GCP equivalents" },
              { t: "table", headers: ["Need", "AWS", "Azure", "GCP", "Where it is loose"], rows: [
                ["Serverless containers behind HTTP", "ECS on Fargate", "Azure Container Apps", "Cloud Run", "Container Apps and Cloud Run scale to zero and do request-based autoscaling; an ECS service does not scale to zero"],
                ["Single container, run once", "ECS RunTask on Fargate", "Azure Container Instances / Container Apps jobs", "Cloud Run jobs", "Close"],
                ["Proprietary scheduler on your VMs", "ECS on EC2", "No direct equivalent; AKS is the usual answer", "No direct equivalent; GKE", "ECS has no real twin on the other clouds"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'AWS-only', 'small team', 'just run my containers' points to ECS on Fargate; 'GPU inference on ECS' points to EC2 capacity providers; 'access denied pulling the image' points to the execution role, not the task role." },
              { t: "note", variant: "key", html: "<strong>ECS is the shortest path from container to production on AWS.</strong> Default to Fargate, move steady hot services to EC2 capacity when the numbers say so, and keep the execution role and task role strictly separate." }
            ]
          },
          {
            id: "managed-kubernetes",
            title: "EKS, AKS and GKE — and choosing ECS or EKS",
            summary: "Managed control planes, node provisioning, workload identity on three clouds, and when Kubernetes is worth it.",
            minutes: 12,
            tags: ["eks", "aks", "gke", "karpenter", "workload-identity", "irsa"],
            blocks: [
              { t: "p", html: "All three clouds run the Kubernetes <strong>control plane</strong> (API server, etcd, schedulers) for you. What differs is how much of the <strong>data plane</strong> — the nodes, their OS, their scaling — you still own, and how pods get cloud credentials without a key in sight." },
              { t: "h", text: "Side by side" },
              { t: "table", headers: ["Concern", "EKS", "AKS", "GKE"], rows: [
                ["Control plane cost", "Hourly per-cluster fee (extended-support versions cost more)", "Free tier, or Standard / Premium tiers with an uptime SLA", "Hourly management fee; a free-tier credit covers one small cluster"],
                ["Node groups", "Managed node groups, self-managed, Fargate profiles", "System and user node pools", "Node pools (Standard mode)"],
                ["Node provisioning", "Cluster Autoscaler or <strong>Karpenter</strong>; EKS Auto Mode manages nodes for you", "Cluster autoscaler; node autoprovisioning (Karpenter-based)", "Cluster autoscaler, node auto-provisioning; <strong>Autopilot</strong> manages nodes entirely"],
                ["Pod identity", "IRSA or EKS Pod Identity", "Microsoft Entra Workload ID", "Workload Identity Federation for GKE"],
                ["Fully managed mode", "EKS Auto Mode", "AKS Automatic", "GKE Autopilot (billed by pod requests)"]
              ] },
              { t: "h", text: "Karpenter in one paragraph" },
              { t: "p", html: "The classic Cluster Autoscaler grows pre-defined node groups. <strong>Karpenter</strong> watches unschedulable pods and launches whichever instance types fit them best, straight from EC2, including Spot and Graviton. It also <strong>consolidates</strong>: it replaces under-used nodes with fewer, cheaper ones. The trade-off is more churn, so set disruption budgets and PodDisruptionBudgets." },
              { t: "h", text: "Workload identity, three ways" },
              { t: "p", html: "The goal is identical everywhere: a Kubernetes service account maps to a cloud identity, and the pod receives short-lived tokens. No access keys in Secrets, no node role shared by every pod." },
              { t: "code", lang: "bash", code:
                "# EKS Pod Identity: associate a service account with an IAM role\n" +
                "aws eks create-pod-identity-association --cluster-name prod \\\n" +
                "  --namespace payments --service-account api \\\n" +
                "  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/payments-api\n\n" +
                "# AKS Workload ID: federate the service account to a user-assigned managed identity\n" +
                "az identity federated-credential create --name payments-api \\\n" +
                "  --identity-name payments-api --resource-group rg-payments \\\n" +
                "  --issuer \"$AKS_OIDC_ISSUER\" --subject system:serviceaccount:payments:api\n\n" +
                "# GKE Workload Identity Federation: grant the KSA principal a role on a resource\n" +
                "gcloud storage buckets add-iam-policy-binding gs://payments-<PROJECT_ID>-exports \\\n" +
                "  --role=roles/storage.objectViewer \\\n" +
                "  --member=\"principal://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<PROJECT_ID>.svc.id.goog/subject/ns/payments/sa/api\""
              },
              { t: "table", headers: ["", "IRSA", "EKS Pod Identity"], rows: [
                ["Setup", "IAM OIDC provider per cluster; trust policy names the cluster issuer and service account", "Pod Identity Agent add-on; association via the EKS API"],
                ["Role reuse across clusters", "Trust policy grows with every cluster", "Trust the EKS pods service principal once; reuse anywhere"],
                ["Works outside EKS", "Yes — any OIDC-issuing cluster", "EKS only"]
              ] },
              { t: "note", variant: "warn", html: "On every cloud, block pods from reaching the node's metadata endpoint unless they need it; otherwise a pod can borrow the node's identity and skip workload identity entirely. Keep the cluster API endpoint private or restricted to known CIDRs — never open to the whole internet." },
              { t: "h", text: "GKE Autopilot versus Standard" },
              { t: "compare",
                bad: { title: "Standard", items: ["You choose machine types and node pools", "Billed per node VM, so poor bin-packing costs you", "Full control: DaemonSets, privileged pods, custom kernels"] },
                good: { title: "Autopilot", items: ["Google manages nodes, upgrades and scaling", "Billed by pod resource requests", "Guardrails block privileged workloads and some node-level tweaks"] } },
              { t: "h", text: "ECS or EKS? Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "What the answer says", "Why it scores that way"], rows: [
                ["Naive", "'Kubernetes, because it is the industry standard'", "Ignores the cost of running a platform and the team's skills"],
                ["Solid", "ECS on Fargate for a small AWS-only team; EKS when you need the Kubernetes API, Helm-packaged software or operators", "Matches tool to team and requirements"],
                ["Standout", "Solid, plus: names the platform headcount EKS implies (upgrades every few months, add-on lifecycle, policy and network plugins), notes portability is partial because IAM, load balancers and storage stay cloud-specific, and proposes a re-decision trigger", "Shows the trade-off is operational, not technical"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'multi-cloud', 'operators', 'Helm charts from vendors', 'platform team' point to managed Kubernetes; 'pods need S3 access without keys' points to Pod Identity / IRSA, Workload ID or GKE Workload Identity; 'pay only for what pods request' points to GKE Autopilot." },
              { t: "quiz", id: "compute-containers" },
              { t: "note", variant: "key", html: "<strong>Managed Kubernetes removes the control plane, not the platform work.</strong> Give every workload its own federated identity, pick Autopilot-style modes when you can, and choose ECS when the Kubernetes API buys you nothing." }
            ]
          }
        ]
      },
      {
        id: "serverless",
        name: "Serverless",
        icon: "bolt",
        lessons: [
          {
            id: "lambda",
            title: "Lambda: event sources, concurrency and cold starts",
            summary: "How invocations flow, how concurrency is counted, and what memory, timeouts and SnapStart really change.",
            minutes: 11,
            tags: ["lambda", "concurrency", "cold-start", "snapstart", "event-sources"],
            blocks: [
              { t: "p", html: "A Lambda function is code plus configuration that AWS runs in <strong>execution environments</strong>: lightweight micro-VMs created on demand. Each environment handles <strong>one request at a time</strong>, and Lambda scales by adding environments. Hold that picture and concurrency, cold starts and pricing all follow." },
              { t: "h", text: "Three ways events arrive" },
              { t: "table", headers: ["Invocation model", "Typical sources", "Who retries", "Watch out for"], rows: [
                ["Synchronous", "API Gateway, ALB, function URLs, SDK calls", "The caller", "Caller-facing latency includes any cold start"],
                ["Asynchronous", "S3 events, SNS, EventBridge", "Lambda, twice by default, then an on-failure destination or DLQ", "Duplicates: handlers must be idempotent"],
                ["Poll-based (event source mapping)", "SQS, Kinesis, DynamoDB Streams, MSK / Kafka", "Lambda's poller; batches retried", "One bad record can block a shard — use partial batch responses and bisect-on-error"]
              ] },
              { t: "h", text: "Concurrency is rate times duration" },
              { t: "code", lang: "text", code:
                "concurrency  ~=  requests per second  x  average duration (s)\n\n" +
                "2,000 rps x 0.25 s   = 500 concurrent environments\n" +
                "  200 rps x 3.0 s    = 600   <- slow downstream calls cost concurrency\n\n" +
                "default regional limit: 1,000 per account (a soft quota you can raise)\n" +
                "reserved concurrency:   caps AND guarantees a function's share\n" +
                "provisioned concurrency: N environments pre-initialised, billed while idle"
              },
              { t: "note", variant: "trap", html: "Reserved concurrency of 0 throttles a function completely — useful as a kill switch, alarming when set by accident. And one runaway function without a cap can consume the whole regional pool and throttle every other function in the account." },
              { t: "h", text: "Cold starts" },
              { t: "p", html: "A cold start is the init phase of a new environment: download the code, start the runtime, run your module-level code. It is typically tens to hundreds of milliseconds for small Node.js or Python functions and longer for large Java or .NET packages. Reduce it by trimming dependencies, doing heavy setup lazily or once per environment, and choosing the right tool for latency-critical paths:" },
              { t: "ul", items: [
                "<strong>Provisioned concurrency</strong> keeps environments warm; schedule it for business hours rather than paying 24/7.",
                "<strong>SnapStart</strong> snapshots an initialised environment and restores from it, available for Java and, more recently, Python and .NET. Code that generates unique values or opens connections during init must handle being restored many times.",
                "VPC attachment no longer adds the large per-invocation ENI delay it once did, so 'avoid VPCs for cold starts' is outdated advice."
              ] },
              { t: "h", text: "Memory buys CPU" },
              { t: "stat", items: [
                { v: "128 MB – 10 GB", k: "memory range" },
                { v: "~1,769 MB", k: "≈ 1 full vCPU" },
                { v: "6 vCPU", k: "at 10 GB" },
                { v: "15 min", k: "hard timeout" }
              ] },
              { t: "p", html: "You cannot set CPU directly; it scales with memory. Billing is memory times duration, so a CPU-bound function at 1,769 MB that finishes four times faster than at 512 MB can cost less overall. Measure a few sizes before settling, and set the timeout just above the p99 duration so a hung call fails fast." },
              { t: "h", text: "Cross-cloud quick map" },
              { t: "table", headers: ["Lambda concept", "Azure Functions", "Cloud Run functions / Cloud Run"], rows: [
                ["One request per environment", "Per-instance concurrency is configurable (Flex Consumption)", "Request concurrency per instance, default 80 on Cloud Run"],
                ["Provisioned concurrency", "Always-ready instances (Flex) / pre-warmed (Premium)", "Minimum instances"],
                ["15-minute ceiling", "Plan-dependent; consumption plans are short, Flex and Premium are longer", "Request timeout up to 60 minutes; jobs run longer"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'p99 latency spikes after idle periods' points to cold starts and provisioned concurrency or SnapStart; 'other functions throttled during a batch import' points to missing reserved concurrency; 'one bad message blocks the stream' points to partial batch responses." },
              { t: "note", variant: "key", html: "<strong>One request per environment explains everything.</strong> Concurrency is rate times duration, memory is your CPU dial, and cold starts are an init-phase problem you fix with smaller packages, provisioned concurrency or SnapStart." }
            ]
          },
          {
            id: "event-driven",
            title: "API Gateway and event-driven integration: SQS, SNS and EventBridge",
            summary: "Front doors for serverless APIs, the three messaging primitives and when each fits, the limits that shape designs, and the patterns that keep asynchronous systems correct.",
            minutes: 12,
            tags: ["api-gateway", "sqs", "sns", "eventbridge", "event-driven", "idempotency"],
            blocks: [
              { t: "p", html: "Serverless systems are glued together with two kinds of service: an <strong>API front door</strong> for synchronous requests, and <strong>messaging</strong> for everything that can happen later. Choosing the right primitive for each hop decides how the system behaves under load and failure." },
              { t: "h", text: "The API front door" },
              { t: "table", headers: ["Option", "Strengths", "Watch out for"], rows: [
                ["API Gateway REST API", "Usage plans and API keys, request validation, WAF, private APIs, caching", "Integration timeout around 29 seconds by default; higher cost per request"],
                ["API Gateway HTTP API", "Lower latency and cost, native JWT authorizers", "Fewer features (no usage plans or request validation)"],
                ["API Gateway WebSocket API", "Persistent two-way connections", "Connection state lives in your store, for example DynamoDB"],
                ["ALB to Lambda or containers", "Simple, no per-request API pricing", "No API management features"],
                ["Lambda function URL", "Simplest HTTPS endpoint", "IAM or no auth only; put a CDN or WAF in front for public use"]
              ] },
              { t: "p", html: "Authorize at the front door: IAM (SigV4) for service-to-service, JWT or Cognito authorizers for users, Lambda authorizers for custom tokens. Throttle per client with usage plans or stage limits so one tenant cannot exhaust the account's Lambda concurrency." },
              { t: "h", text: "Three messaging primitives" },
              { t: "table", headers: ["", "SQS", "SNS", "EventBridge"], rows: [
                ["Model", "Queue: each message processed by one consumer", "Topic: push to every subscriber", "Event bus: rules route by content to targets"],
                ["Delivery", "Pull; at-least-once (standard) or ordered and deduplicated per group (FIFO)", "Push; retries per protocol", "Push; retries with backoff, DLQ per target"],
                ["Best for", "Buffering and load levelling, work queues", "Simple high-fan-out notifications", "Decoupling domains, SaaS and AWS service events, content routing"],
                ["Extras", "Visibility timeout, DLQ with max receives, delay queues", "Filter policies, FIFO topics", "Schema registry, archive and replay, Pipes, Scheduler"]
              ] },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["API front door", "API Gateway", "API Management", "API Gateway, Apigee"],
                ["Queue", "SQS", "Service Bus queues, Storage queues", "Pub/Sub pull subscriptions, Cloud Tasks"],
                ["Pub/sub topic", "SNS", "Service Bus topics", "Pub/Sub"],
                ["Event routing", "EventBridge", "Event Grid", "Eventarc"],
                ["Streams", "Kinesis Data Streams, MSK", "Event Hubs", "Pub/Sub, Managed Kafka"]
              ] },
              { t: "h", text: "Limits that shape the design" },
              { t: "stat", items: [
                { v: "6 MB", k: "Lambda synchronous request and response payload" },
                { v: "256 KB", k: "EventBridge event size" },
                { v: "~29 s", k: "default API Gateway integration timeout" },
                { v: "15 min", k: "Lambda maximum duration" }
              ] },
              { t: "p", html: "Large payloads do not belong in events. Use the <strong>claim-check</strong> pattern: write the payload to S3 and send a small event carrying its key. Work that outlasts the API timeout should return <code class='tok'>202 Accepted</code> with a job ID, then complete asynchronously." },
              { t: "h", text: "Patterns that keep asynchronous systems correct" },
              { t: "ul", items: [
                "<strong>Idempotent consumers</strong>: at-least-once delivery means duplicates. Store a processed-message key (for example with a conditional write in DynamoDB) and skip repeats.",
                "<strong>Visibility timeout above processing time</strong>: for Lambda consumers AWS recommends at least six times the function timeout, or messages reappear while still being processed.",
                "<strong>Dead-letter queues with alarms</strong>: set a max receive count, alarm on DLQ depth, and use redrive to replay after a fix.",
                "<strong>Fan-out with a queue per consumer</strong>: SNS or EventBridge into one SQS queue per service, so each has its own backlog and retries.",
                "<strong>Transactional outbox</strong>: write the state change and an outbox row in one transaction, then publish from the outbox (or a DynamoDB stream), so you never commit without publishing or publish without committing."
              ] },
              { t: "note", variant: "trap", html: "Lambda reading SQS scales out fast. Without a maximum concurrency on the event source mapping, a backlog can open hundreds of database connections at once. Cap consumer concurrency, or put RDS Proxy in front of the database." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'spikes overwhelm the database' means a queue to level load; 'several teams react to the same business event' means an event bus or topic with a queue per consumer; 'events processed twice' means idempotency and visibility timeout." },
              { t: "quiz", id: "compute-events" },
              { t: "note", variant: "key", html: "<strong>Synchronous at the edge, asynchronous inside.</strong> API Gateway authenticates and throttles; SQS levels load, SNS fans out, EventBridge routes by content; and every consumer is idempotent with a dead-letter queue and an alarm." }
            ]
          },
          {
            id: "functions-cloud-run-workflows",
            title: "Azure Functions, Cloud Run and workflow orchestration",
            summary: "How the other clouds package serverless compute, and where Step Functions, Logic Apps and Workflows fit.",
            minutes: 10,
            tags: ["azure-functions", "cloud-run", "step-functions", "logic-apps", "workflows"],
            blocks: [
              { t: "p", html: "'Serverless' means different shapes on each cloud. AWS centres on <strong>functions</strong>, GCP centres on <strong>serverless containers</strong> (Cloud Run, with functions built on top), and Azure offers both through <strong>Functions plans</strong> and <strong>Container Apps</strong>. Map by shape, not by product name." },
              { t: "h", text: "Azure Functions hosting plans" },
              { t: "table", headers: ["Plan", "Scale to zero", "Cold starts", "Networking", "Fits"], rows: [
                ["Consumption (classic)", "Yes", "Yes", "Limited VNet options", "Low-volume event handlers; being superseded by Flex for new Linux apps"],
                ["Flex Consumption", "Yes", "Reduced with always-ready instances", "VNet integration", "The modern default for event-driven functions"],
                ["Premium (Elastic Premium)", "No — at least one warm instance", "Avoided with pre-warmed instances", "VNet integration", "Latency-sensitive or long-running functions"],
                ["Dedicated (App Service plan)", "No", "No (always on)", "VNet integration", "Teams already paying for App Service capacity"]
              ] },
              { t: "note", variant: "tip", html: "Azure Functions binds triggers and outputs declaratively (queue in, blob out). It is convenient, but it couples handler code to the platform more than a plain SDK call does — weigh that if portability matters." },
              { t: "h", text: "Cloud Run: serverless containers" },
              { t: "ul", items: [
                "Deploy any container that listens on a port; Cloud Run handles TLS, scaling and revisions with traffic splitting.",
                "<strong>Request concurrency</strong> (default 80, configurable up to 1,000) lets one instance serve many requests, which suits I/O-bound services.",
                "<strong>Min instances</strong> keep warm capacity to cut cold starts; max instances protect downstream databases.",
                "Billing is either request-based (CPU only during requests) or instance-based (CPU always allocated, needed for background work).",
                "<strong>Cloud Run jobs</strong> run containers to completion for batch; <strong>Cloud Run functions</strong> (the successor to Cloud Functions) build source into a Cloud Run service for you."
              ] },
              { t: "code", lang: "bash", code:
                "gcloud run deploy orders-api \\\n" +
                "  --image=<REGION>-docker.pkg.dev/<PROJECT_ID>/apps/orders-api@sha256:<DIGEST> \\\n" +
                "  --region=<REGION> --service-account=orders-api@<PROJECT_ID>.iam.gserviceaccount.com \\\n" +
                "  --concurrency=80 --min-instances=1 --max-instances=50 \\\n" +
                "  --no-allow-unauthenticated --ingress=internal-and-cloud-load-balancing"
              },
              { t: "h", text: "Orchestrating steps" },
              { t: "p", html: "When a process has several steps, retries, waits or human approvals, do not chain functions by having each call the next. Use an orchestrator that keeps state, retries with backoff and shows you where an execution stopped." },
              { t: "table", headers: ["Need", "AWS", "Azure", "GCP"], rows: [
                ["Long-running, auditable workflow", "Step Functions <strong>Standard</strong> (up to a year, exactly-once state transitions)", "Logic Apps, or Durable Functions for code-first", "Workflows (up to a year)"],
                ["High-volume, short event pipelines", "Step Functions <strong>Express</strong> (up to 5 minutes, at-least-once)", "Durable Functions / Logic Apps Standard", "Workflows (pricing per step), or Eventarc + Cloud Run"],
                ["SaaS and enterprise connectors", "Step Functions SDK integrations, EventBridge Pipes", "Logic Apps (hundreds of connectors — its strength)", "Application Integration"],
                ["Data pipeline DAGs", "Managed Workflows for Apache Airflow", "Data Factory", "Cloud Composer"]
              ] },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"StartAt\": \"ReserveStock\",\n" +
                "  \"States\": {\n" +
                "    \"ReserveStock\": { \"Type\": \"Task\", \"Resource\": \"arn:aws:states:::lambda:invoke\",\n" +
                "      \"Parameters\": { \"FunctionName\": \"reserve-stock\", \"Payload.$\": \"$\" },\n" +
                "      \"Retry\": [{ \"ErrorEquals\": [\"States.TaskFailed\"], \"MaxAttempts\": 3, \"BackoffRate\": 2 }],\n" +
                "      \"Next\": \"AwaitApproval\" },\n" +
                "    \"AwaitApproval\": { \"Type\": \"Task\",\n" +
                "      \"Resource\": \"arn:aws:states:::sqs:sendMessage.waitForTaskToken\",\n" +
                "      \"Parameters\": { \"QueueUrl\": \"<APPROVAL_QUEUE_URL>\", \"MessageBody\": { \"token.$\": \"$$.Task.Token\" } },\n" +
                "      \"Next\": \"ChargeCard\" },\n" +
                "    \"ChargeCard\": { \"Type\": \"Task\", \"Resource\": \"arn:aws:states:::lambda:invoke\",\n" +
                "      \"Parameters\": { \"FunctionName\": \"charge-card\", \"Payload.$\": \"$\" }, \"End\": true }\n" +
                "  }\n" +
                "}"
              },
              { t: "compare",
                bad: { title: "Function chaining", items: ["Each function calls the next directly", "Retries and timeouts reimplemented everywhere", "A failure mid-chain leaves no record of where it stopped"] },
                good: { title: "Orchestrated workflow", items: ["State machine owns order, retries and waits", "Callback tokens handle human or external steps", "Execution history shows exactly which step failed"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'wait for approval', 'saga', 'compensate on failure' point to Step Functions Standard, Durable Functions or Workflows; 'connect to Salesforce and SharePoint with little code' points to Logic Apps; 'my container should scale to zero' points to Cloud Run or Container Apps." },
              { t: "note", variant: "key", html: "<strong>Map serverless by shape.</strong> Functions, serverless containers and orchestrators exist on every cloud under different names — and any multi-step process with waits or retries belongs in an orchestrator, not a chain of functions." }
            ]
          },
          {
            id: "choosing-compute",
            title: "Choosing compute: a decision you can defend",
            summary: "Turn workload traits into a runtime choice across VMs, containers and functions, with the trade-off said out loud.",
            minutes: 10,
            tags: ["decision", "architecture", "trade-offs", "cost"],
            blocks: [
              { t: "p", html: "Compute choice is a trade between <strong>control</strong> and <strong>operations</strong>, with cost shape as the tie-breaker. VMs give the most control and the most chores; functions give the fewest chores and the tightest limits; containers sit in the middle. Five traits settle most cases." },
              { t: "ol", items: [
                "<strong>Traffic shape</strong> — steady load favours always-on capacity; idle-most-of-the-day favours scale-to-zero.",
                "<strong>Runtime per unit of work</strong> — anything past 15 minutes rules out Lambda.",
                "<strong>Packaging</strong> — a full OS image means VMs; a container image keeps every option except zip-only functions.",
                "<strong>Ops appetite</strong> — is there a team to run clusters and patch hosts?",
                "<strong>Accelerators</strong> — GPUs remove most serverless options today."
              ] },
              { t: "widget", id: "computePicker" },
              { t: "h", text: "Where cost crosses over" },
              { t: "p", html: "Per-request pricing wins when utilisation is low and loses when it is high. A function busy 5% of the day is far cheaper than an always-on container; a function that is effectively busy all day usually costs more than the same work on well-packed containers or VMs with a commitment. Sketch the crossover with your own numbers rather than quoting a rule of thumb." },
              { t: "code", lang: "text", code:
                "illustrative only: compare cost per million requests at your real utilisation\n\n" +
                "functions:   requests x (duration x memory rate + per-request fee)\n" +
                "containers:  task-hours x (vCPU rate + GB rate)    / requests served\n" +
                "VMs:         instance-hours x committed rate      / requests served\n\n" +
                "low utilisation  -> functions win (no idle capacity billed)\n" +
                "high, steady     -> containers or committed VMs win"
              },
              { t: "h", text: "Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "Answer to 'where should this API run?'", "Why it scores that way"], rows: [
                ["Naive", "'Serverless, because it is cheaper and scales infinitely'", "Ignores cold starts, limits, concurrency quotas and the high-utilisation crossover"],
                ["Solid", "Picks by traits: spiky short HTTP work on Lambda or Cloud Run; steady container services on Fargate or Container Apps; full-OS or GPU work on VMs. Names the Azure and GCP equivalents", "Defensible and mapped across clouds"],
                ["Standout", "Solid, plus quantifies the crossover with utilisation, names the main risk of the pick (cold-start p99, platform headcount, idle GPU cost), states where the cross-cloud mapping is loose (ECS has no twin; Cloud Run's request concurrency differs from Lambda's), and sets a trigger to revisit", "Shows judgement about cost, risk and change over time"]
              ] },
              { t: "note", variant: "trap", html: "'We will pick Kubernetes so we are portable' is rarely the whole truth. IAM, load balancers, managed databases and observability stay cloud-specific, so portability is partial. Say what you would actually have to rewrite." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'bursty webhook traffic', 'nightly report', 'legacy Windows app with an agent', 'LLM inference on GPUs', 'platform team of two' — each maps cleanly onto one trait and should drive the first sentence of your answer." },
              { t: "quiz", id: "compute-serverless" },
              { t: "note", variant: "key", html: "<strong>Choose by traits, then say the trade-off.</strong> Control versus operations decides the family, utilisation decides the cost, and naming the AWS pick alongside its Azure and GCP equivalents — with where they differ — is what makes the answer senior." }
            ]
          }
        ]
      }
    ]
  };
})();
