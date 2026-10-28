/* =====================================================================
   NIMBUS · Cloud Fundamentals & Landing Zones
   window.TRACKS.found — modules: basics / landing

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

  var Widgets = {};

  /* ==================================================================
     1. foundSharedResp — who owns which layer, per service model
     Deterministic lookup. "shared" means both sides have a real job
     at that layer (for example AWS patches the engine, you pick the
     version and the parameters).
  ================================================================== */
  var SR_LAYERS = [
    { id: "data", label: "Data (classification, encryption choices, backups)" },
    { id: "iam", label: "Identity & access (who can call what)" },
    { id: "app", label: "Application (code, config, dependencies)" },
    { id: "runtime", label: "Runtime (language runtime, DB engine, middleware)" },
    { id: "os", label: "Operating system (patching, hardening)" },
    { id: "net", label: "Network controls (firewall rules, exposure)" },
    { id: "virt", label: "Virtualization (hypervisor, host fleet)" },
    { id: "phys", label: "Physical (data centres, hardware, power)" }
  ];

  var SR_OWNERS = {
    customer: { label: "You (customer)", fill: "var(--amber)" },
    shared: { label: "Shared", fill: "var(--violet)" },
    provider: { label: "Provider", fill: "var(--cyan)" }
  };

  var SR_MODELS = {
    ec2: {
      label: "Virtual machine (EC2)",
      kind: "IaaS",
      aws: "Amazon EC2", azure: "Azure Virtual Machines", gcp: "Compute Engine",
      own: { data: "customer", iam: "customer", app: "customer", runtime: "customer", os: "customer", net: "customer", virt: "provider", phys: "provider" },
      why: "You patch the guest OS, configure security groups and install every runtime. The provider stops at the hypervisor."
    },
    rds: {
      label: "Managed database (RDS)",
      kind: "PaaS",
      aws: "Amazon RDS", azure: "Azure Database for PostgreSQL / Azure SQL Database", gcp: "Cloud SQL",
      own: { data: "customer", iam: "customer", app: "customer", runtime: "shared", os: "provider", net: "shared", virt: "provider", phys: "provider" },
      why: "The provider patches the OS and engine binaries; you choose engine version, maintenance window, parameters, subnet placement and whether it is publicly reachable."
    },
    fargate: {
      label: "Container platform (Fargate)",
      kind: "CaaS",
      aws: "AWS Fargate (ECS / EKS)", azure: "Azure Container Apps", gcp: "Cloud Run",
      own: { data: "customer", iam: "customer", app: "customer", runtime: "shared", os: "provider", net: "shared", virt: "provider", phys: "provider" },
      why: "The provider runs and patches the hosts and container runtime; the base image, its libraries and the task's security groups and role are yours."
    },
    lambda: {
      label: "Functions (Lambda)",
      kind: "FaaS",
      aws: "AWS Lambda", azure: "Azure Functions", gcp: "Cloud Run functions",
      own: { data: "customer", iam: "customer", app: "customer", runtime: "shared", os: "provider", net: "shared", virt: "provider", phys: "provider" },
      why: "The managed runtime is patched for you, but you pick its version, own every dependency in the package, the execution role, and any function URL or VPC attachment."
    },
    saas: {
      label: "SaaS application",
      kind: "SaaS",
      aws: "Amazon WorkMail / QuickSight", azure: "Microsoft 365", gcp: "Google Workspace",
      own: { data: "customer", iam: "customer", app: "shared", runtime: "provider", os: "provider", net: "provider", virt: "provider", phys: "provider" },
      why: "The vendor runs the whole application, but tenant settings (sharing defaults, retention, MFA enforcement) and every user you invite are still your decisions."
    }
  };

  Widgets.foundSharedResp = function (mount) {
    shell(mount, "model", "Who owns which layer",
      "Pick a service model. Each layer of the stack is coloured by who operates it. Notice which two layers never move off your side, whatever you buy.");

    var model = "ec2";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var m = SR_MODELS[model] || SR_MODELS.ec2;
      var counts = { customer: 0, shared: 0, provider: 0 };
      clear(stage);
      var legend = h("div", { style: "display:flex;flex-wrap:wrap;gap:14px;margin-bottom:12px;font-size:0.8rem;color:var(--text-dim)" });
      for (var ok in SR_OWNERS) {
        if (!Object.prototype.hasOwnProperty.call(SR_OWNERS, ok)) continue;
        legend.appendChild(h("span", { style: "display:inline-flex;align-items:center;gap:6px" },
          h("i", { style: "display:inline-block;width:12px;height:12px;border-radius:3px;background:" + SR_OWNERS[ok].fill }),
          SR_OWNERS[ok].label));
      }
      stage.appendChild(legend);
      for (var i = 0; i < SR_LAYERS.length; i++) {
        var layer = SR_LAYERS[i];
        var who = m.own[layer.id] || "provider";
        if (counts[who] != null) counts[who]++;
        var o = SR_OWNERS[who] || SR_OWNERS.provider;
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:minmax(160px,1fr) 120px;gap:12px;align-items:center;padding:8px 12px;margin:4px 0;border-radius:8px;" +
            "border-left:5px solid " + o.fill + ";background:color-mix(in srgb, " + o.fill + " 20%, transparent)"
        },
          h("span", { style: "font-size:0.86rem;color:var(--text)" }, layer.label),
          h("b", { style: "font-size:0.8rem;color:var(--text);text-align:right" }, o.label)));
      }
      clear(readout);
      readout.appendChild(ro("model", m.kind));
      readout.appendChild(ro("you", counts.customer + " layers"));
      readout.appendChild(ro("shared", counts.shared + " layers"));
      readout.appendChild(ro("provider", counts.provider + " layers"));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" },
        "AWS: " + m.aws + " · Azure: " + m.azure + " · Google Cloud: " + m.gcp));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, m.why));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["ec2", "VM (EC2)"], ["rds", "Managed DB (RDS)"], ["fargate", "Containers (Fargate)"], ["lambda", "Functions (Lambda)"], ["saas", "SaaS"]], 0,
        function (v) { model = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. foundServiceMap — cross-cloud service mapping explorer
     Rows: [category, concept, aws, azure, gcp, fit, note]
     fit: "close" (same job, similar shape), "loose" (overlapping job,
     different shape), "same" (literally the same tool on every cloud).
     Also mounted full-page by the app at #/servicemap.
  ================================================================== */
  var SM_CATS = [
    ["all", "All"], ["compute", "Compute"], ["containers", "Containers"], ["serverless", "Serverless"],
    ["storage", "Storage"], ["databases", "Databases"], ["networking", "Networking"], ["identity", "Identity"],
    ["iac", "IaC"], ["observability", "Observability"], ["analytics", "Analytics"]
  ];

  var SM_ROWS = [
    ["compute", "Virtual machines", "Amazon EC2", "Azure Virtual Machines", "Compute Engine", "close", "Same job; instance family naming and sizing differ."],
    ["compute", "Autoscaling VM groups", "EC2 Auto Scaling groups", "Virtual Machine Scale Sets", "Managed instance groups (MIGs)", "close", "MIGs can be regional (multi-zone) by default; scale sets support flexible orchestration modes."],
    ["compute", "App hosting PaaS", "AWS Elastic Beanstalk", "Azure App Service", "App Engine", "loose", "Beanstalk orchestrates EC2 you can still see; App Service and App Engine hide the hosts."],
    ["compute", "Batch compute", "AWS Batch", "Azure Batch", "Batch (Google Cloud Batch)", "close", "All queue jobs onto managed VM pools; GPU and spot support vary."],
    ["compute", "Spare-capacity VMs", "EC2 Spot Instances", "Azure Spot Virtual Machines", "Spot VMs", "close", "Interruption notice is typically about two minutes on AWS and about 30 seconds on Azure and Google Cloud."],
    ["compute", "Single-tenant hosts", "EC2 Dedicated Hosts", "Azure Dedicated Host", "Sole-tenant nodes", "close", "Used for licensing and compliance; pricing models differ."],

    ["containers", "Managed Kubernetes", "Amazon EKS", "Azure Kubernetes Service (AKS)", "Google Kubernetes Engine (GKE)", "close", "Same upstream API; control-plane fees, add-ons and upgrade cadence differ."],
    ["containers", "Provider-native orchestrator", "Amazon ECS", "Azure Container Apps", "Cloud Run", "loose", "ECS has no direct twin; Container Apps and Cloud Run are higher-level, request-driven platforms."],
    ["containers", "Serverless container capacity", "AWS Fargate", "Azure Container Instances / Container Apps", "Cloud Run", "loose", "Fargate is a capacity mode under ECS or EKS; Cloud Run is a full platform with HTTP routing and scale to zero."],
    ["containers", "Hands-off Kubernetes nodes", "EKS Auto Mode", "AKS Automatic", "GKE Autopilot", "loose", "All manage nodes for you; what you can still customise (daemonsets, node types) differs."],
    ["containers", "Container registry", "Amazon ECR", "Azure Container Registry", "Artifact Registry", "close", "Artifact Registry also hosts language packages; ECR and ACR are image-first."],

    ["serverless", "Functions", "AWS Lambda", "Azure Functions", "Cloud Run functions", "close", "Timeouts, concurrency model and cold-start behaviour differ per platform and plan."],
    ["serverless", "API front door", "Amazon API Gateway", "Azure API Management", "API Gateway / Apigee", "loose", "API Management is a full API product (portal, policies), closer to Apigee than to API Gateway."],
    ["serverless", "Workflow orchestration", "AWS Step Functions", "Logic Apps / Durable Functions", "Workflows", "loose", "Logic Apps is connector-heavy low-code; Durable Functions is code-first; Step Functions is a state-machine JSON language."],
    ["serverless", "Event bus / routing", "Amazon EventBridge", "Azure Event Grid", "Eventarc", "loose", "Filtering, schema registry and cross-account delivery differ noticeably."],
    ["serverless", "Pub/sub fan-out", "Amazon SNS", "Service Bus topics / Event Grid", "Pub/Sub", "loose", "Pub/Sub covers both fan-out and queue-like pull, so it maps to SNS and SQS at once."],
    ["serverless", "Message queue", "Amazon SQS", "Service Bus queues / Queue Storage", "Pub/Sub (pull) / Cloud Tasks", "loose", "Service Bus adds sessions and transactions; Cloud Tasks targets HTTP handlers rather than consumers."],
    ["serverless", "Scheduled triggers", "EventBridge Scheduler", "Functions timer trigger / Logic Apps", "Cloud Scheduler", "close", "All are cron-style; delivery guarantees and target types vary."],

    ["storage", "Object storage", "Amazon S3", "Azure Blob Storage", "Cloud Storage", "close", "Blob sits under a storage account, an extra layer S3 and Cloud Storage do not have."],
    ["storage", "Block volumes", "Amazon EBS", "Azure Managed Disks", "Persistent Disk / Hyperdisk", "close", "Zonal by default everywhere; regional replication options differ."],
    ["storage", "Managed NFS", "Amazon EFS", "Azure Files (NFS) / Azure NetApp Files", "Filestore", "close", "Performance tiers and protocol versions differ."],
    ["storage", "Archive tier", "S3 Glacier storage classes", "Blob Archive tier", "Cloud Storage Archive class", "loose", "Azure Archive is offline and needs rehydration in hours; Google Archive reads in milliseconds at a high retrieval price."],
    ["storage", "Windows SMB shares", "Amazon FSx for Windows File Server", "Azure Files (SMB)", "Google Cloud NetApp Volumes", "loose", "Azure Files is native SMB; on Google Cloud you typically use NetApp Volumes or a partner."],
    ["storage", "Offline transfer device", "AWS Snowball", "Azure Data Box", "Transfer Appliance", "close", "All ship a rugged device for bulk ingest."],
    ["storage", "Central backup service", "AWS Backup", "Azure Backup", "Backup and DR Service", "close", "Coverage of individual services differs; check before assuming."],

    ["databases", "Managed relational", "Amazon RDS", "Azure SQL Database / Azure Database for PostgreSQL or MySQL", "Cloud SQL", "close", "Azure splits SQL Server (Azure SQL) from open-source engines (Azure Database for ...)."],
    ["databases", "Cloud-native relational", "Amazon Aurora", "Azure SQL Database Hyperscale", "AlloyDB for PostgreSQL", "loose", "All separate compute from distributed storage; engine compatibility and replica models differ."],
    ["databases", "Globally consistent relational", "Aurora DSQL / Aurora Global Database", "Azure Cosmos DB for PostgreSQL (distributed)", "Spanner", "loose", "Spanner is the long-standing reference here; the others trade off differently on consistency and scale."],
    ["databases", "Key-value / document NoSQL", "Amazon DynamoDB", "Azure Cosmos DB", "Firestore / Bigtable", "loose", "Cosmos DB is multi-API with tunable consistency; Bigtable is wide-column, Firestore is document."],
    ["databases", "In-memory cache", "Amazon ElastiCache", "Azure Managed Redis / Azure Cache for Redis", "Memorystore", "close", "Engine choices (Redis, Valkey, Memcached) vary by provider."],
    ["databases", "MongoDB-compatible", "Amazon DocumentDB", "Azure Cosmos DB for MongoDB", "Firestore with MongoDB compatibility", "loose", "Compatibility is API-level and partial everywhere; test the operators you rely on."],
    ["databases", "Graph database", "Amazon Neptune", "Azure Cosmos DB for Apache Gremlin", "Spanner Graph", "loose", "Query languages differ (Gremlin, openCypher, GQL); not a drop-in swap."],

    ["networking", "Private network", "Amazon VPC", "Azure Virtual Network (VNet)", "VPC network", "loose", "A Google Cloud VPC is global with regional subnets; AWS VPCs and Azure VNets are regional."],
    ["networking", "Instance-level firewall", "Security groups", "Network security groups (NSGs)", "VPC firewall rules / firewall policies", "loose", "NSGs attach to subnets or NICs and have priorities; Google rules target network tags or service accounts."],
    ["networking", "Layer 7 load balancer", "Application Load Balancer", "Azure Application Gateway", "Application Load Balancer (Cloud Load Balancing)", "close", "Google's global external ALB is anycast across regions; AWS ALB is regional."],
    ["networking", "Layer 4 load balancer", "Network Load Balancer", "Azure Load Balancer", "Network Load Balancer (passthrough / proxy)", "close", "Source-IP preservation and cross-zone defaults differ."],
    ["networking", "Managed DNS", "Amazon Route 53", "Azure DNS / Traffic Manager", "Cloud DNS", "close", "Route 53 bundles health-checked routing policies that Azure splits into Traffic Manager."],
    ["networking", "CDN / global edge", "Amazon CloudFront", "Azure Front Door", "Cloud CDN", "loose", "Front Door combines CDN, global L7 load balancing and WAF in one product."],
    ["networking", "Dedicated private circuit", "AWS Direct Connect", "Azure ExpressRoute", "Cloud Interconnect", "close", "Dedicated and partner variants on all three."],
    ["networking", "Site-to-site VPN", "AWS Site-to-Site VPN", "Azure VPN Gateway", "Cloud VPN (HA VPN)", "close", "IPsec everywhere; throughput limits per tunnel differ."],
    ["networking", "Hub-and-spoke routing", "AWS Transit Gateway", "Azure Virtual WAN / hub VNet peering", "Network Connectivity Center / Shared VPC", "loose", "Shared VPC shares one network across projects, which is a different model from a routing hub."],
    ["networking", "Private service endpoints", "AWS PrivateLink / VPC endpoints", "Azure Private Link (private endpoints)", "Private Service Connect", "close", "All expose a service on a private IP inside your network."],
    ["networking", "Managed NAT", "NAT gateway", "Azure NAT Gateway", "Cloud NAT", "close", "Cloud NAT is software-defined with no gateway instance; pricing differs."],
    ["networking", "Web application firewall", "AWS WAF", "Azure Web Application Firewall", "Google Cloud Armor", "close", "Cloud Armor also covers DDoS policy; AWS splits that into Shield."],

    ["identity", "Workforce sign-in / SSO", "AWS IAM Identity Center", "Microsoft Entra ID", "Cloud Identity / Google Workspace", "loose", "Entra ID is a full identity provider; Identity Center usually federates one."],
    ["identity", "Permission model", "IAM policies (JSON)", "Azure RBAC role assignments", "IAM allow policies (role bindings)", "loose", "AWS attaches JSON to principals or resources; Azure and Google bind roles to principals at a scope."],
    ["identity", "Identity for workloads on the platform", "IAM roles (instance profiles, execution roles)", "Managed identities", "Attached service accounts", "close", "All hand out short-lived credentials through a metadata or token endpoint."],
    ["identity", "Federation for external workloads", "IAM OIDC providers + AssumeRoleWithWebIdentity", "Workload identity federation (federated credentials)", "Workload Identity Federation", "close", "All exchange an external OIDC token for cloud credentials; claim mapping syntax differs."],
    ["identity", "Organisation guardrails", "Service control policies (SCPs)", "Azure Policy (deny effects)", "Organization Policy constraints / IAM deny policies", "loose", "SCPs cap API permissions; Azure Policy and org policies mainly constrain resource properties."],
    ["identity", "Secrets store", "AWS Secrets Manager", "Azure Key Vault (secrets)", "Secret Manager", "close", "Rotation support differs; Key Vault also holds keys and certificates."],
    ["identity", "Key management", "AWS KMS", "Azure Key Vault (keys) / Managed HSM", "Cloud KMS", "close", "Key policies on AWS are resource policies; Azure and Google use RBAC or IAM bindings."],
    ["identity", "Customer identity (CIAM)", "Amazon Cognito", "Microsoft Entra External ID", "Identity Platform", "close", "Federation options and pricing tiers differ."],

    ["iac", "Provider-native templates", "AWS CloudFormation", "ARM templates / Bicep", "Infrastructure Manager (managed Terraform)", "loose", "Google's native path is managed Terraform rather than its own template language."],
    ["iac", "Code-first IaC", "AWS CDK", "Bicep (DSL) / Pulumi", "CDK for Terraform / Pulumi", "loose", "Only AWS CDK is a first-party general-purpose-language framework; Bicep is a DSL."],
    ["iac", "Cross-cloud IaC tool", "Terraform / OpenTofu", "Terraform / OpenTofu", "Terraform / OpenTofu", "same", "Same tool everywhere, but resources are provider-specific; your modules are not portable."],
    ["iac", "Landing-zone automation", "AWS Control Tower / Account Factory for Terraform", "Azure landing zone accelerators", "Enterprise foundations blueprint", "loose", "Control Tower is a managed service; the Azure and Google options are reference code you own."],
    ["iac", "Config compliance & drift", "AWS Config", "Azure Policy (audit) / Resource Graph", "Cloud Asset Inventory / Security Command Center", "loose", "AWS Config records configuration history; Azure Policy evaluates continuously against rules."],

    ["observability", "Metrics, logs & alarms", "Amazon CloudWatch", "Azure Monitor (Log Analytics)", "Cloud Monitoring / Cloud Logging", "close", "Query languages differ (CloudWatch Logs Insights, KQL, Logging query language)."],
    ["observability", "Control-plane audit log", "AWS CloudTrail", "Azure Activity Log", "Cloud Audit Logs", "close", "Data-plane events (object reads) are opt-in and billed separately on all three."],
    ["observability", "Distributed tracing / APM", "AWS X-Ray / CloudWatch Application Signals", "Application Insights", "Cloud Trace", "close", "All accept OpenTelemetry today, which is the portable choice."],
    ["observability", "Network flow logs", "VPC Flow Logs", "Virtual network flow logs", "VPC Flow Logs", "close", "Azure is moving from NSG flow logs to VNet flow logs."],
    ["observability", "Threat detection", "Amazon GuardDuty", "Microsoft Defender for Cloud", "Security Command Center (threat detection)", "loose", "Defender bundles posture and workload protection plans; GuardDuty is detection-focused."],
    ["observability", "Security findings hub", "AWS Security Hub", "Defender for Cloud (CSPM)", "Security Command Center", "loose", "Scoring, standards and integration models differ."],

    ["analytics", "Data warehouse", "Amazon Redshift", "Microsoft Fabric Warehouse / Synapse", "BigQuery", "loose", "BigQuery is serverless by default; Redshift offers provisioned and serverless modes."],
    ["analytics", "SQL over object storage", "Amazon Athena", "Synapse serverless SQL / Fabric", "BigQuery external tables (BigLake)", "loose", "Billing is per data scanned on Athena and BigQuery on-demand; Fabric uses capacity units."],
    ["analytics", "Managed Spark / Hadoop", "Amazon EMR", "Azure HDInsight / Azure Databricks", "Dataproc", "close", "Databricks is a partner first-party service on Azure, not an Azure-built engine."],
    ["analytics", "ETL / data integration", "AWS Glue", "Azure Data Factory", "Dataflow / Cloud Data Fusion", "loose", "Dataflow runs Apache Beam pipelines (batch and streaming); Data Factory is orchestration-first."],
    ["analytics", "Streaming ingest", "Amazon Kinesis Data Streams", "Azure Event Hubs", "Pub/Sub", "loose", "Event Hubs and Kinesis are partitioned logs; Pub/Sub hides partitions from you."],
    ["analytics", "Managed Kafka", "Amazon MSK", "Event Hubs (Kafka endpoint)", "Managed Service for Apache Kafka", "loose", "Event Hubs speaks the Kafka protocol but is not Kafka; admin APIs differ."],
    ["analytics", "BI dashboards", "Amazon QuickSight", "Power BI", "Looker / Looker Studio", "close", "Power BI dominates in Microsoft shops; Looker centres on a semantic modelling layer."],
    ["analytics", "Data catalog & governance", "AWS Glue Data Catalog / Amazon DataZone", "Microsoft Purview", "Dataplex", "loose", "Scope ranges from table metadata to full governance and lineage."]
  ];

  function smFitStyle(fit) {
    var fill = fit === "close" ? "var(--lime)" : fit === "same" ? "var(--cyan)" : "var(--amber)";
    return "display:inline-block;font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;" +
      "padding:2px 8px;border-radius:999px;color:var(--text);border:1px solid " + fill + ";background:color-mix(in srgb, " + fill + " 22%, transparent)";
  }

  Widgets.foundServiceMap = function (mount) {
    shell(mount, "explorer", "Cross-cloud service map",
      "Pick a category or type a filter. Each row is one concept with its AWS, Azure and Google Cloud names. The fit column says whether the equivalence is close or only loose — loose is where interview answers and migrations go wrong.");

    var cat = "compute";
    var query = "";
    var stage = h("div", { class: "w-stage", style: "padding:0;overflow-x:auto" });
    var readout = h("div", { class: "w-readout" });
    var input = h("input", { type: "text", placeholder: "e.g. queue, Kafka, DNS", "aria-label": "Filter services" });

    function catLabel(id) {
      for (var i = 0; i < SM_CATS.length; i++) if (SM_CATS[i][0] === id) return SM_CATS[i][1];
      return "All";
    }

    function paint() {
      var q = String(query || "").toLowerCase().replace(/^\s+|\s+$/g, "");
      var rows = [], i, r, close = 0, loose = 0;
      for (i = 0; i < SM_ROWS.length; i++) {
        r = SM_ROWS[i];
        if (cat !== "all" && r[0] !== cat) continue;
        if (q && (r.slice(1).join(" ").toLowerCase().indexOf(q) < 0)) continue;
        rows.push(r);
        if (r[5] === "loose") loose++; else close++;
      }
      clear(stage);
      var th = "text-align:left;padding:10px 12px;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--line-strong);white-space:nowrap";
      var td = "padding:9px 12px;font-size:0.85rem;color:var(--text);border-bottom:1px solid var(--line);vertical-align:top;line-height:1.45";
      var table = h("table", { style: "width:100%;border-collapse:collapse;min-width:760px" });
      table.appendChild(h("thead", {}, h("tr", {},
        h("th", { style: th + ";width:17%" }, "Concept"),
        h("th", { style: th + ";width:17%" }, "AWS"),
        h("th", { style: th + ";width:19%" }, "Azure"),
        h("th", { style: th + ";width:18%" }, "Google Cloud"),
        h("th", { style: th }, "Fit"))));
      var body = h("tbody", {});
      if (!rows.length) {
        body.appendChild(h("tr", {}, h("td", { colspan: "5", style: td + ";color:var(--text-dim)" }, "No rows match that filter in this category. Try All.")));
      }
      for (i = 0; i < rows.length; i++) {
        r = rows[i];
        body.appendChild(h("tr", {},
          h("td", { style: td + ";font-weight:600" }, r[1]),
          h("td", { style: td }, r[2]),
          h("td", { style: td }, r[3]),
          h("td", { style: td }, r[4]),
          h("td", { style: td + ";color:var(--text-dim)" },
            h("span", { style: smFitStyle(r[5]) }, r[5]),
            h("span", { style: "display:block;margin-top:4px;font-size:0.8rem;color:var(--text-dim)" }, r[6]))));
      }
      table.appendChild(body);
      stage.appendChild(table);

      clear(readout);
      readout.appendChild(ro("category", catLabel(cat)));
      readout.appendChild(ro("rows", rows.length + " of " + SM_ROWS.length));
      readout.appendChild(ro("close / same", close));
      readout.appendChild(ro("loose", loose));
      if (q) readout.appendChild(ro("filter", "\u201c" + q + "\u201d"));
    }

    input.addEventListener("input", function () { query = input.value; paint(); });

    var seg = segment(SM_CATS, 1, function (v) { cat = v; paint(); });
    seg.setAttribute("style", "flex-wrap:wrap");
    mount.appendChild(h("div", { class: "widget-controls" },
      seg,
      h("label", { class: "w-field" }, "Filter", input)
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
    "found-basics": {
      title: "Cloud basics checkpoint",
      sub: "Regions and zones, service models, shared responsibility and the cross-cloud vocabulary.",
      questions: [
        {
          q: "What is an availability zone?",
          options: [
            "A single server rack the provider guarantees will not fail",
            "One or more data centres with independent power, cooling and networking, inside a region",
            "A CDN point of presence close to end users",
            "A separate billing account inside an organisation"
          ],
          answer: 1,
          explain: "A zone is a failure domain inside a region: its facilities have their own power, cooling and network paths, and zones are linked by low-latency private fibre. Spreading across two or more zones lets a workload survive a facility failure without leaving the region. Edge locations and billing accounts are different concepts entirely."
        },
        {
          q: "Two of your AWS accounts both pin a database replica to us-east-1a. What can you conclude about physical placement?",
          options: [
            "They are guaranteed to be in the same physical zone",
            "They are guaranteed to be in different physical zones",
            "Nothing yet: zone names are mapped per account, so compare the zone IDs (for example use1-az1)",
            "us-east-1a always means the oldest data centre in the region"
          ],
          answer: 2,
          explain: "AWS shuffles the mapping of zone names to physical zones per account so load spreads evenly. The zone ID is the stable identifier across accounts. Azure has a similar per-subscription mapping of logical zone numbers, so the same caution applies there."
        },
        {
          q: "Your team runs an API on AWS Lambda. Which responsibility stays entirely with you?",
          options: [
            "Patching the operating system on the hosts",
            "Replacing failed disks in the data centre",
            "The function's IAM execution role and the data it reads and writes",
            "Scaling the number of hypervisors"
          ],
          answer: 2,
          explain: "Serverless moves the OS, hosts and scaling to the provider, but identity and data never move. An over-privileged execution role or an unencrypted export is your incident, not the provider's. That is true of every service model, including SaaS."
        },
        {
          q: "Which statement about virtual networks across the three providers is accurate?",
          options: [
            "All three providers make a VPC or VNet span every region automatically",
            "A Google Cloud VPC is global with regional subnets, while AWS VPCs and Azure VNets are regional",
            "Azure VNets are global and AWS VPCs are zonal",
            "Only AWS supports private subnets"
          ],
          answer: 1,
          explain: "Google Cloud's VPC is a global resource and its subnets are regional, so one network can hold subnets in many regions. AWS VPCs and Azure VNets live in one region and you connect them with peering or a hub. Treating the names as identical leads to wrong network designs."
        },
        {
          q: "An architect asks for 'the Google Cloud equivalent of Fargate'. What is the most accurate answer?",
          options: [
            "There is no container option on Google Cloud",
            "Compute Engine, because both run containers on VMs",
            "Cloud Run is the closest, but it is a full request-driven platform with scale to zero, while Fargate is a capacity mode underneath ECS or EKS",
            "Bigtable, because both are serverless"
          ],
          answer: 2,
          explain: "Fargate removes node management for ECS tasks or EKS pods but leaves orchestration to those services. Cloud Run bundles orchestration, HTTPS routing, revisions and scale to zero into one product. Naming the closest service and the gap in the same breath is exactly what an interviewer wants to hear."
        }
      ]
    },
    "found-migration": {
      title: "Migration strategies checkpoint",
      sub: "The 7 Rs, discovery, waves and the native migration tooling.",
      questions: [
        {
          q: "A licensed commercial CRM runs on-premises and the vendor offers the same product as SaaS. Which R is that move?",
          options: ["Rehost", "Repurchase", "Relocate", "Retain"],
          answer: 1,
          explain: "Repurchase (sometimes called drop and shop) replaces the application with a different product, usually SaaS. You migrate data and integrations, not servers. Rehost would lift the existing servers onto cloud VMs unchanged."
        },
        {
          q: "Moving a self-managed MySQL server to Amazon RDS for MySQL without changing application code is an example of what?",
          options: ["Refactor", "Replatform", "Rehost", "Retire"],
          answer: 1,
          explain: "Replatform (lift, tinker and shift) swaps a component for a managed equivalent while the application stays essentially the same. Refactoring would mean re-architecting, for example breaking the app into services on a different database."
        },
        {
          q: "Why do migration programmes run discovery and dependency mapping before planning waves?",
          options: ["To pick instance sizes only", "So that tightly coupled applications move together and nothing is cut off from a database or file share it still needs", "Because migration tools require it for licensing", "To decide which cloud region is cheapest"],
          answer: 1,
          explain: "Applications that call each other with low latency or share data must land in the same wave, or the first wave breaks on day one. Discovery tools collect inventory, utilisation and network connections to build those groups."
        },
        {
          q: "A team wants to move 400 VMware VMs to the cloud within a quarter with no OS changes and keep using vSphere tooling. Which R fits?",
          options: ["Relocate, onto VMware Cloud on AWS, Azure VMware Solution or Google Cloud VMware Engine", "Refactor into containers", "Repurchase", "Retire"],
          answer: 0,
          explain: "Relocate moves whole hypervisor estates onto a provider-hosted VMware platform without converting each VM. It is the fastest path for large VMware estates, and teams often modernize individual applications later."
        }
      ]
    },
    "found-landing": {
      title: "Accounts and landing zones checkpoint",
      sub: "Resource hierarchies, multi-account strategy, landing zones and baseline guardrails.",
      questions: [
        {
          q: "Why do mature AWS estates put each workload environment in its own account?",
          options: [
            "Because AWS charges less per account",
            "An account is a hard boundary for IAM, quotas and billing, so a compromise or mistake in one environment cannot directly reach the others",
            "Because a single account cannot hold more than one VPC",
            "So that SCPs no longer apply"
          ],
          answer: 1,
          explain: "Account boundaries contain blast radius: credentials, permissions, service quotas and spend are all scoped to the account. Cross-account access has to be granted on purpose on both sides. The cost is more automation for networking, identity and logging, which is what a landing zone provides."
        },
        {
          q: "An SCP on the Workloads OU allows only s3:* and ec2:* actions. A role in a member account under that OU has the AdministratorAccess policy. What can the role do?",
          options: [
            "Everything, because AdministratorAccess overrides SCPs",
            "Nothing, because SCPs replace identity policies",
            "Only S3 and EC2 actions, because the SCP sets the ceiling and the identity policy grants within it",
            "Only read-only actions"
          ],
          answer: 2,
          explain: "SCPs never grant anything; they cap the maximum permissions available in member accounts. The effective permission is the overlap of what the SCP allows and what the role's own policies allow. Here that overlap is S3 and EC2."
        },
        {
          q: "Which Azure construct plays the role of an AWS organizational unit?",
          options: ["Resource group", "Management group", "Subscription", "Availability set"],
          answer: 1,
          explain: "Management groups sit above subscriptions and let Azure Policy and RBAC assignments inherit down to everything below, which is what OUs do for SCPs. A subscription is closer to an AWS account, and a resource group is a finer container inside a subscription with no direct AWS twin."
        },
        {
          q: "What is the main reason a landing zone sends CloudTrail and Config data to a dedicated log archive account?",
          options: [
            "Logs are cheaper to store in a separate account",
            "So an attacker or admin who controls a workload account cannot quietly delete or alter the evidence",
            "Because CloudTrail cannot write to a bucket in the same account",
            "To avoid enabling encryption"
          ],
          answer: 1,
          explain: "Centralising logs in an account that workload teams cannot administer separates the people who might cause an incident from the evidence of it. SCPs then stop member accounts from disabling the trail. CloudTrail can write locally; the point is integrity, not capability."
        },
        {
          q: "Leadership wants 'multi-cloud to avoid lock-in' for every service. What is the strongest pushback?",
          options: [
            "Multi-cloud is impossible",
            "Forcing every workload to the lowest common denominator gives up managed services, doubles skills and landing zones, and adds egress cost — pick per workload instead",
            "Lock-in does not exist in the cloud",
            "Only Azure supports multi-cloud"
          ],
          answer: 1,
          explain: "Blanket portability means avoiding the services that make a cloud worth using and paying twice for identity, networking, security tooling and people. A defensible strategy is a primary cloud with deliberate exceptions, such as a workload that needs a specific analytics service or an acquisition already on another provider. Name the exit cost you are accepting instead of pretending it is zero."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.found = {
    id: "found",
    name: "Cloud Fundamentals & Landing Zones",
    short: "FOUND",
    tagline: "Regions to landing zones, in three dialects",
    color: "#60a5fa",
    blurb: "Start from zero: what a region, zone and edge location really are, how IaaS, PaaS, containers, serverless and SaaS split the work with the provider, and how the three clouds name the same building blocks. Then build the account structure everything else sits on — organisations, OUs, subscriptions and projects, multi-account blast radius, landing zones and the baseline guardrails every new account inherits.",
    modules: [
      {
        id: "basics",
        name: "Cloud Basics",
        icon: "globe",
        lessons: [
          {
            id: "what-is-cloud",
            title: "What the cloud is: regions, zones and edge",
            summary: "The physical map behind every cloud API, and how AWS, Azure and Google Cloud carve it up.",
            minutes: 8,
            tags: ["regions", "availability-zones", "edge"],
            blocks: [
              { t: "p", html: "Hold this picture: the cloud is someone else's data centres, rented through an <strong>API</strong> and billed by the second or the request. Three properties make it different from a hosting contract — you provision yourself with no ticket, capacity grows and shrinks on demand, and you pay only for what runs. Everything in this academy is a consequence of those three." },
              { t: "h", text: "The physical map" },
              { t: "ul", items: [
                "<strong>Region</strong> — a geographic area holding several data centres, for example <code class='tok'>eu-west-1</code> (Ireland). Most services, data and prices are scoped to a region.",
                "<strong>Availability zone (AZ)</strong> — one or more data centres inside a region with their own power, cooling and network paths. Zones in a region are linked by private fibre, typically low single-digit milliseconds apart.",
                "<strong>Edge location / point of presence</strong> — a much smaller site in a metro area that caches content and terminates connections close to users (CDN, DNS, WAF). You do not run general workloads there.",
                "<strong>Metro and on-premises extensions</strong> — small footprints for latency-critical or data-residency workloads, such as AWS Local Zones and Outposts."
              ] },
              { t: "table", headers: ["Concept", "AWS", "Azure", "Google Cloud", "Where the mapping is loose"], rows: [
                ["Region", "Region (<code class='tok'>us-east-1</code>)", "Region (<code class='tok'>eastus</code>)", "Region (<code class='tok'>us-central1</code>)", "Azure pairs most regions for platform-level recovery ordering; the others have no formal pairs."],
                ["Zone", "Availability Zone (<code class='tok'>us-east-1a</code>)", "Availability zone 1, 2, 3", "Zone (<code class='tok'>us-central1-a</code>)", "Not every Azure region has zones; AWS and Azure map zone labels per account or subscription."],
                ["Edge", "CloudFront edge locations", "Front Door / CDN points of presence", "Google edge points of presence (Cloud CDN)", "Google also carries traffic on its own backbone from the edge by default (Premium tier)."],
                ["Metro / edge compute", "Local Zones, Wavelength, Outposts", "Extended Zones, Azure Local", "Google Distributed Cloud", "Service catalogues at the edge are a small subset everywhere."],
                ["Isolated partitions", "AWS GovCloud (US), China regions, European Sovereign Cloud", "Azure Government, Azure China", "Assured Workloads, partner sovereign clouds", "Separate partitions often mean separate accounts, endpoints and identities."]
              ] },
              { t: "stat", items: [
                { v: "~3", k: "zones in a typical zonal region" },
                { v: "1–2 ms", k: "typical round trip between zones (varies)" },
                { v: "30+", k: "regions per provider, at the time of writing" },
                { v: "Hundreds", k: "edge locations per provider" }
              ] },
              { t: "h", text: "Why zones exist: failure domains" },
              { t: "p", html: "A zone is the unit of failure you design around. Power events, cooling failures and fibre cuts tend to take out one facility, not a whole region. So the baseline for anything that matters is <strong>at least two zones</strong>: load balancer in front, instances or tasks spread across zones, a database with a synchronous standby in another zone. Regions are the unit for disasters, sovereignty and very large outages — and multi-region designs cost far more, because data has to replicate asynchronously across long distances." },
              { t: "compare",
                bad: { title: "Single zone", items: ["Cheapest, simplest networking", "No inter-zone data transfer charges", "One facility event takes you down"] },
                good: { title: "Multi-zone in one region", items: ["Survives a facility failure", "Synchronous replication is feasible at zone distances", "Costs inter-zone traffic and a second copy of capacity"] } },
              { t: "h", text: "Choosing a region" },
              { t: "table", headers: ["Driver", "The question to ask", "Example"], rows: [
                ["Latency", "Where are most users and upstream systems?", "EU customers point you to Frankfurt or Ireland, not Virginia"],
                ["Data residency", "Must data stay in a country or bloc?", "Health data that may not leave Germany"],
                ["Service availability", "Is the service or instance type offered there yet?", "Newest GPU instances often land in a few regions first"],
                ["Price", "Is the same capacity cheaper elsewhere?", "Prices for identical instances can differ noticeably between regions (illustrative)"],
                ["Resilience", "How many zones does it have?", "Prefer three-zone regions for quorum-based databases"]
              ] },
              { t: "code", lang: "bash", code:
                "# zone NAMES are per-account labels; zone IDS are stable across accounts\n" +
                "aws ec2 describe-availability-zones --region eu-west-1 \\\n" +
                "  --query \"AvailabilityZones[].[ZoneName,ZoneId]\" --output text\n\n" +
                "# example output (your names may map to different IDs)\n" +
                "eu-west-1a   euw1-az3\n" +
                "eu-west-1b   euw1-az1\n" +
                "eu-west-1c   euw1-az2"
              },
              { t: "note", variant: "trap", html: "When two accounts must share a zone — a shared database, a PrivateLink endpoint, a capacity reservation — align on the <strong>zone ID</strong>, never the zone name. <code class='tok'>us-east-1a</code> in your account and in a partner's can be different buildings." },
              { t: "note", variant: "tip", html: "A few control planes are effectively global even though the data planes are regional — on AWS, IAM, Route 53 and CloudFront configuration are examples. Know which ones your design depends on when you reason about a regional outage." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'must survive a data-centre failure' means multi-zone; 'must survive a regional outage' or 'data must stay in-country' means a region decision; 'global users, static assets, low latency' means edge and CDN." },
              { t: "note", variant: "key", html: "<strong>Zones are for failures, regions are for disasters and law, the edge is for latency.</strong> Spread across at least two zones by default, choose regions on residency and latency, and align on zone IDs when accounts must share a zone." }
            ]
          },
          {
            id: "service-models",
            title: "IaaS, PaaS, SaaS, serverless and shared responsibility",
            summary: "How each service model moves the line between your work and the provider's — and the two layers that never move.",
            minutes: 9,
            tags: ["iaas", "paas", "saas", "serverless", "shared-responsibility"],
            blocks: [
              { t: "p", html: "Picture a stack of layers from the building up to your data. A <strong>service model</strong> is just a statement of where the line sits: below it the provider operates, above it you do. Moving the line up buys you less toil and less control at the same time." },
              { t: "table", headers: ["Model", "You operate", "Provider operates", "AWS", "Azure", "Google Cloud"], rows: [
                ["IaaS", "Guest OS and everything above", "Hardware, hypervisor, network fabric", "EC2", "Virtual Machines", "Compute Engine"],
                ["Containers (CaaS)", "Image, app, task config", "Hosts, orchestrator control plane", "ECS / EKS on Fargate", "Container Apps, AKS", "Cloud Run, GKE Autopilot"],
                ["PaaS", "Code, config, data", "Runtime, OS, scaling, patching", "Elastic Beanstalk, RDS", "App Service, Azure SQL Database", "App Engine, Cloud SQL"],
                ["Functions (FaaS)", "Function code, dependencies, triggers, role", "Everything else, including scale to zero", "Lambda", "Azure Functions", "Cloud Run functions"],
                ["SaaS", "Users, data, tenant settings", "The whole application", "Amazon WorkMail, QuickSight", "Microsoft 365", "Google Workspace"]
              ] },
              { t: "h", text: "The shared responsibility model" },
              { t: "p", html: "Every provider publishes a split of duties, and they all say the same thing in different words: the provider secures the facilities, hardware and the services it runs; you secure what you configure and put into them. The useful part is not the slogan but <strong>which layer is yours for this specific service</strong>. Try it:" },
              { t: "widget", id: "foundSharedResp" },
              { t: "ul", items: [
                "<strong>Always yours</strong>: data (what you store, how it is classified, whether it is encrypted with which key) and identity (who and what can call your resources).",
                "<strong>Usually shared</strong>: runtime versions and network exposure on managed services — the provider patches, you choose versions, parameters and whether anything is public.",
                "<strong>Never yours</strong>: physical security, hardware replacement, hypervisor isolation."
              ] },
              { t: "note", variant: "warn", html: "Most publicly reported cloud breaches are on the customer side of the line: an object store left public, a long-lived access key committed to a repo, a role with far more permission than it needs. Buying a more managed service shrinks your surface, but it never removes identity and data from your list." },
              { t: "h", text: "Serverless is a spectrum, not a product" },
              { t: "p", html: "Serverless means you do not manage servers, you pay per request or per second of use, and capacity can scale to zero. Functions are the obvious case, but DynamoDB on-demand, S3, Aurora Serverless and Cloud Run all sit on the same spectrum. The trade-offs are real: cold starts on first request, execution time limits (Lambda caps a single invocation at 15 minutes), per-request pricing that becomes expensive at sustained high volume, and less control over the runtime." },
              { t: "table", headers: ["Tier", "Choosing compute for a new internal API", "Why"], rows: [
                ["Naive", "VMs for everything, because the team knows them", "You now own patching, scaling and AMIs for a service that idles most of the day"],
                ["Solid", "Containers on a managed platform (Fargate, Container Apps, Cloud Run)", "Portable image, no hosts to patch, predictable runtime"],
                ["Standout", "Pick by traffic shape: functions or Cloud Run for spiky and idle-heavy, containers for steady load, VMs only for licensing, kernel or GPU needs — and state the cost crossover", "Matches the model to the workload and names what each choice costs"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'minimal ops team', 'spiky traffic', 'pay nothing when idle' point to serverless; 'custom kernel modules', 'licensed per core', 'GPU drivers' point to IaaS; 'who patches X?' is a shared-responsibility question — answer per layer, not per provider." },
              { t: "note", variant: "key", html: "<strong>Each service model moves the line; data and identity never move.</strong> Choose the highest model the workload tolerates, then say exactly which layers remain yours." }
            ]
          },
          {
            id: "service-map",
            title: "Speaking three clouds: the service map",
            summary: "Translate concepts, not names — and know where the equivalence between AWS, Azure and Google Cloud breaks.",
            minutes: 9,
            tags: ["multi-cloud", "service-mapping", "vocabulary"],
            blocks: [
              { t: "p", html: "The fastest way to work across clouds is to think in <strong>concepts first, product names second</strong>. 'Object storage', 'managed Kubernetes' and 'workload identity' exist everywhere; S3, Blob Storage and Cloud Storage are dialects. The danger is assuming that matching names mean matching behaviour. Often they do not." },
              { t: "widget", id: "foundServiceMap" },
              { t: "h", text: "Where equivalence breaks" },
              { t: "table", headers: ["Concept", "AWS", "Azure", "Google Cloud", "The catch"], rows: [
                ["Network scope", "VPC is regional", "VNet is regional", "VPC is global, subnets regional", "A two-region Google design can be one network; on AWS and Azure it is two plus peering or a hub."],
                ["Permission model", "JSON policies on principals and resources", "Role assignments at scopes", "Role bindings on resources", "AWS has explicit deny in ordinary policies; Azure RBAC is additive, with deny only in special cases."],
                ["Storage container", "Bucket", "Storage account → container", "Bucket", "Azure's storage account holds settings (redundancy, firewall, keys) that live per bucket elsewhere."],
                ["NoSQL", "DynamoDB (key-value / document)", "Cosmos DB (multi-API)", "Firestore, Bigtable", "Data modelling and consistency options differ enough that migrations are rewrites."],
                ["CDN", "CloudFront", "Front Door", "Cloud CDN", "Front Door is also your global L7 load balancer and WAF; CloudFront and Cloud CDN are narrower."]
              ] },
              { t: "compare",
                bad: { title: "Name translation", items: ["'Lambda is Azure Functions, done'", "Copies AWS network diagrams to Google Cloud one-for-one", "Surprised by different limits, IAM models and pricing"] },
                good: { title: "Concept translation", items: ["'Functions exist everywhere; here is how timeouts and identity differ'", "Re-derives the design from the platform's own primitives", "States the closest service and the gap together"] } },
              { t: "h", text: "Habits that make the mapping stick" },
              { t: "ul", items: [
                "Learn the <strong>hierarchy and identity model</strong> of each cloud first — they shape everything else and differ the most.",
                "For each concept, remember one sentence on <em>how it differs</em>, not just the name.",
                "Treat Terraform as a shared language for workflow, not for resources: an <code class='tok'>aws_s3_bucket</code> module does not become a Google bucket by swapping the provider.",
                "When unsure of a feature on a cloud you know less well, say so and describe what you would verify — interviewers reward that over a confident wrong claim."
              ] },
              { t: "note", variant: "tip", html: "In an interview, lead with the concept and AWS name, then add the other two: <em>'managed Kubernetes — EKS here; AKS and GKE elsewhere, with GKE Autopilot as the most hands-off'</em>. It shows breadth without derailing the answer." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we are migrating from Azure', 'the acquired company runs on Google Cloud', 'what is the equivalent of…' — answer with the concept, the closest service on each side, and the one difference that would bite during the move." },
              { t: "quiz", id: "found-basics" },
              { t: "note", variant: "key", html: "<strong>Translate concepts, not product names.</strong> Name the closest service on each cloud and the one way it differs — network scope, permission model and NoSQL are where the gaps are widest." }
            ]
          }
        ]
      },
      {
        id: "landing",
        name: "Accounts & Landing Zones",
        icon: "map",
        lessons: [
          {
            id: "resource-hierarchy",
            title: "The account and resource hierarchy on each cloud",
            summary: "Organisations, OUs and accounts; tenants, management groups and subscriptions; organisations, folders and projects.",
            minutes: 10,
            tags: ["organizations", "management-groups", "projects", "hierarchy"],
            blocks: [
              { t: "p", html: "Every cloud organises resources as a <strong>tree</strong>. Policies attached high in the tree inherit down to everything below, and the leaf containers are where resources and bills actually live. Learn the tree on each cloud and you can place any control correctly." },
              { t: "diagram", id: "landing-zone", caption: "One organisation tree, three dialects: AWS OUs and accounts, Azure management groups and subscriptions, Google Cloud folders and projects." },
              { t: "table", headers: ["Level", "AWS", "Azure", "Google Cloud"], rows: [
                ["Identity root", "IAM per account; IAM Identity Center at the organisation", "Microsoft Entra ID tenant", "Cloud Identity or Google Workspace account"],
                ["Top of the tree", "Organization root, owned by the management account", "Tenant root management group", "Organization node (tied to a domain)"],
                ["Grouping", "Organizational units (OUs), nest up to five levels", "Management groups, up to six levels below the root", "Folders, nest up to ten levels"],
                ["Isolation unit", "Account", "Subscription", "Project"],
                ["Finer container", "None native (tags, Resource Groups are only tag queries)", "Resource group", "None native (labels)"],
                ["Policies that inherit", "SCPs, RCPs, tag and other organisation policies", "Azure Policy, RBAC role assignments", "IAM allow / deny policies, Organization Policy constraints"],
                ["Billing", "Consolidated billing in the management account", "Billing account; subscription is the invoice section", "Cloud Billing account linked to projects"]
              ] },
              { t: "h", text: "What is actually a boundary" },
              { t: "table", headers: ["Property", "AWS account", "Azure subscription", "Google Cloud project"], rows: [
                ["Permissions", "Hard boundary — IAM is per account; access across needs both sides", "Soft — identities live in the tenant; RBAC can be granted at any scope", "Soft — identities live in the organisation; IAM is granted on resources at any level"],
                ["Quotas", "Per account per region", "Per subscription per region", "Per project (and per region)"],
                ["Networking", "VPCs belong to one account; share via RAM or peering", "VNets belong to one subscription; peer across", "Shared VPC lets service projects use a host project's network"],
                ["APIs", "Services available by default", "Resource providers registered per subscription", "Each API enabled per project"]
              ] },
              { t: "note", variant: "trap", html: "Do not equate an Azure <strong>resource group</strong> with an AWS account. A resource group is a lifecycle and RBAC scope inside a subscription; it has no separate quotas, billing or identity boundary. The closest Azure analogue to an AWS account is the subscription." },
              { t: "code", lang: "bash", code:
                "# AWS: create an OU under the root (run from the management account)\n" +
                "aws organizations create-organizational-unit \\\n" +
                "  --parent-id <ROOT_ID> --name Workloads\n\n" +
                "# Azure: create a management group and move a subscription under it\n" +
                "az account management-group create --name workloads --display-name Workloads\n" +
                "az account management-group subscription add \\\n" +
                "  --name workloads --subscription <SUBSCRIPTION_ID>\n\n" +
                "# Google Cloud: create a folder under the organisation\n" +
                "gcloud resource-manager folders create \\\n" +
                "  --display-name=Workloads --organization=<ORG_ID>"
              },
              { t: "note", variant: "tip", html: "The AWS management account is special: SCPs do not restrict it. Keep it empty of workloads and lock it down, because anyone with admin there effectively controls the organisation." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'apply this rule to every production account', 'inherit', 'one place to enforce' — the answer lives at an OU, management group or folder, not on individual accounts." },
              { t: "note", variant: "key", html: "<strong>Account, subscription, project: same slot in the tree, different strength of wall.</strong> An AWS account is the hardest boundary; Azure and Google keep identity at the top and scope permissions down the tree." }
            ]
          },
          {
            id: "multi-account",
            title: "Multi-account strategy: account equals blast radius",
            summary: "Why serious estates run dozens or hundreds of accounts, and how to group them into OUs.",
            minutes: 9,
            tags: ["multi-account", "blast-radius", "ou-design"],
            blocks: [
              { t: "p", html: "The mental model: <strong>an account is a blast radius</strong>. Whatever goes wrong inside it — a leaked credential, a runaway script, a misconfigured policy, a quota exhausted by a load test — stops at its edge unless someone deliberately built a door. So you draw account boundaries where you want failures and permissions to stop." },
              { t: "ul", items: [
                "<strong>Security</strong>: a compromised developer role in a sandbox account cannot read production data.",
                "<strong>Quotas</strong>: a load test in staging cannot exhaust production's concurrent Lambda limit.",
                "<strong>Cost</strong>: spend per account maps cleanly to a team or product without perfect tagging.",
                "<strong>Compliance</strong>: in-scope systems (PCI, health data) sit in accounts with stricter guardrails, shrinking audit scope."
              ] },
              { t: "h", text: "A common OU layout" },
              { t: "table", headers: ["OU", "Holds", "Typical guardrails"], rows: [
                ["Security", "Log archive, security tooling (audit) accounts", "Very few humans; deny deletion of logs and detectors"],
                ["Infrastructure", "Network hub, shared services (DNS, CI runners, artifact registry)", "Only the platform team can change routing"],
                ["Workloads / Prod", "One account per workload per environment", "Region restriction, no IAM users, encryption required"],
                ["Workloads / Non-prod", "Dev, test, staging accounts", "Same guardrails, looser change approvals"],
                ["Sandbox", "Personal or team experiment accounts", "Budgets with hard alerts, no connectivity to prod networks"],
                ["Suspended", "Accounts being closed", "Deny everything except break-glass"]
              ] },
              { t: "table", headers: ["Tier", "Account strategy", "What it costs"], rows: [
                ["Naive", "One account; environments separated by naming and tags", "One leaked admin key reaches prod; quotas and costs are entangled"],
                ["Solid", "Accounts per environment (dev, staging, prod) plus separate log and security accounts", "Good isolation; teams still share prod blast radius"],
                ["Standout", "Accounts per workload per environment, vended automatically with a baseline, grouped into OUs by guardrail set", "Requires an account factory, central networking and identity — but every new account is born compliant"]
              ] },
              { t: "stat", items: [
                { v: "1 account", k: "per workload per environment (common target)" },
                { v: "Minutes", k: "to vend a baselined account when automated" },
                { v: "0", k: "workloads in the management account" }
              ] },
              { t: "compare",
                bad: { title: "One big account", items: ["Easy to start, no cross-account plumbing", "IAM policy sprawl to keep teams apart", "Every incident is an all-hands incident"] },
                good: { title: "Many small accounts", items: ["Failures and permissions stop at the edge", "Clear cost ownership", "Needs automation for networking, logging and access"] } },
              { t: "h", text: "The same idea on Azure and Google Cloud" },
              { t: "p", html: "On Azure the unit is the <strong>subscription</strong>, grouped under management groups; on Google Cloud it is the <strong>project</strong>, grouped under folders. Because identity is tenant- or organisation-wide on those clouds, the isolation comes from where you grant roles and from policy, not from a separate IAM system per container. The design advice is identical: one subscription or project per workload per environment, created by automation, never by hand." },
              { t: "note", variant: "warn", html: "More accounts means more cross-account traffic, more DNS and more places to forget a guardrail. Without an account factory and a central network, multi-account turns into multi-mess. Do not split accounts faster than you can automate them." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'teams step on each other', 'a dev deleted a prod resource', 'we cannot attribute cost', 'shrink PCI scope' — all of these are account-boundary answers." },
              { t: "note", variant: "key", html: "<strong>Draw account boundaries where you want failures to stop.</strong> One account per workload per environment, grouped into OUs by guardrail set, vended by automation." }
            ]
          },
          {
            id: "landing-zones",
            title: "Landing zones: Control Tower, Azure landing zones, Google foundations",
            summary: "What a landing zone contains, and how each provider's tooling builds one.",
            minutes: 10,
            tags: ["landing-zone", "control-tower", "caf", "foundation-blueprint"],
            blocks: [
              { t: "p", html: "A <strong>landing zone</strong> is a pre-built, governed environment that new workloads land in: the hierarchy, the shared accounts, identity, networking, logging and guardrails, all defined as code. The point is that a team asking for a new account gets one that is already compliant, connected and logged, in minutes." },
              { t: "table", headers: ["Piece", "AWS", "Azure", "Google Cloud"], rows: [
                ["Orchestration", "AWS Control Tower (managed service)", "Azure landing zone accelerators (portal, Bicep, Terraform)", "Enterprise foundations blueprint (Terraform), guided setup in the console"],
                ["Account vending", "Account Factory; Account Factory for Terraform (AFT)", "Subscription vending modules", "Project factory modules"],
                ["Guardrails", "Controls: preventive (SCPs, RCPs), detective (Config rules), proactive (CloudFormation hooks)", "Azure Policy initiatives assigned at management groups", "Organization Policy constraints at org and folders"],
                ["Central logging", "Log Archive account", "Management subscription with Log Analytics", "Aggregated log sinks to a logging project"],
                ["Security tooling", "Audit account (delegated admin for security services)", "Defender for Cloud, management subscription", "Security Command Center at the organisation"],
                ["Identity", "IAM Identity Center", "Entra ID (tenant-wide) plus an identity subscription", "Cloud Identity groups"],
                ["Networking", "Network account with Transit Gateway", "Connectivity subscription (hub or Virtual WAN)", "Shared VPC host projects, hub networks"]
              ] },
              { t: "h", text: "AWS Control Tower, concretely" },
              { t: "ol", items: [
                "Enable it from the management account in a home region; it creates a <strong>Security OU</strong> with a <strong>Log Archive</strong> and an <strong>Audit</strong> account.",
                "It configures an organisation-wide CloudTrail trail and AWS Config, sending data to the Log Archive account.",
                "It applies a baseline of mandatory controls and lets you enable more per OU.",
                "New accounts come from <strong>Account Factory</strong> (or AFT for a Terraform pipeline), enrolled into an OU with its baseline and SSO access."
              ] },
              { t: "note", variant: "tip", html: "Control Tower now calls its guardrails <strong>controls</strong>; older material uses the original word. They are the same thing: SCPs, RCPs, Config rules and hooks, curated and labelled." },
              { t: "h", text: "Azure landing zone" },
              { t: "ul", items: [
                "Part of Microsoft's Cloud Adoption Framework. A reference management-group hierarchy: <strong>Platform</strong> (management, connectivity, identity), <strong>Landing zones</strong> (corp for internal, online for internet-facing), <strong>Sandbox</strong> and <strong>Decommissioned</strong>.",
                "Policies are assigned at management groups so every subscription inherits them — deny public IPs in corp, require diagnostic settings, allowed regions.",
                "Subscription vending creates a subscription, places it, peers its VNet to the hub and assigns RBAC."
              ] },
              { t: "h", text: "Google Cloud foundations" },
              { t: "ul", items: [
                "A staged Terraform blueprint: bootstrap (seed project and CI), organisation (org policies, logging, security), environments (folders such as production, non-production, development), networks (Shared VPC), then projects.",
                "Organization Policy constraints enforce things like no default network, no external IPs on VMs and no service account key creation.",
                "Logs are routed with aggregated sinks to a central logging project and storage."
              ] },
              { t: "table", headers: ["Tier", "How a team gets a new environment", "Consequence"], rows: [
                ["Naive", "Ticket to the cloud team, who click it together", "Days of waiting, drift between accounts, forgotten logging"],
                ["Solid", "Managed landing zone (Control Tower / accelerator) with a vending form", "Consistent baseline; customisations are manual"],
                ["Standout", "Vending as a pipeline: a pull request with account metadata creates, places, networks, baselines and grants access, with the landing zone itself under version control", "Every account reproducible and auditable; changes to the baseline roll out everywhere"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we are about to onboard fifty teams', 'every new account must have logging and SSO', 'governance at scale' — answer with a landing zone and an account (or subscription, or project) factory." },
              { t: "note", variant: "key", html: "<strong>A landing zone makes the compliant path the default path.</strong> Hierarchy, shared accounts, identity, network and guardrails as code, plus a vending machine that stamps out baselined accounts." }
            ]
          },
          {
            id: "guardrails-baseline",
            title: "Baseline guardrails: logging, security tooling, SCPs, tags and billing",
            summary: "What every new account inherits on day zero, and the summary-level SCPs that protect it.",
            minutes: 10,
            tags: ["guardrails", "scp", "logging", "tagging", "billing"],
            blocks: [
              { t: "p", html: "A <strong>baseline</strong> is the set of controls every account has before a single workload lands. Think of it as two halves: things that must always be <em>recorded</em> (logs, findings, costs) and things that must never be <em>possible</em> (turning the recording off, leaving the organisation, using unapproved regions)." },
              { t: "h", text: "The shared accounts" },
              { t: "table", headers: ["Account", "Purpose", "Who gets in"], rows: [
                ["Log archive", "Organisation trail, Config history, flow and access logs; object lock or retention on the buckets", "Read-only for security and audit; nobody can delete"],
                ["Security tooling (audit)", "Delegated admin for GuardDuty, Security Hub, Access Analyzer, Inspector", "Security team; read-only cross-account roles into workloads"],
                ["Network", "Transit Gateway, inspection VPC, egress, DNS", "Platform team only"],
                ["Shared services", "CI runners, artifact registry, directory connectors", "Platform team; workloads consume"],
                ["Backup", "Cross-account vaults so a compromised workload cannot delete its own backups", "Backup operators only"]
              ] },
              { t: "h", text: "SCPs at a summary level" },
              { t: "p", html: "Service control policies attach to the root, an OU or an account and set the <strong>maximum</strong> permissions for every principal in member accounts, including their root users. They grant nothing on their own. Typical baseline SCPs deny a short list of dangerous actions rather than trying to allow-list everything:" },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [\n" +
                "    {\n" +
                "      \"Sid\": \"ProtectAuditTrail\",\n" +
                "      \"Effect\": \"Deny\",\n" +
                "      \"Action\": [\"cloudtrail:StopLogging\", \"cloudtrail:DeleteTrail\",\n" +
                "                 \"guardduty:DeleteDetector\", \"config:StopConfigurationRecorder\"],\n" +
                "      \"Resource\": \"*\"\n" +
                "    },\n" +
                "    {\n" +
                "      \"Sid\": \"StayInOrg\",\n" +
                "      \"Effect\": \"Deny\",\n" +
                "      \"Action\": \"organizations:LeaveOrganization\",\n" +
                "      \"Resource\": \"*\"\n" +
                "    },\n" +
                "    {\n" +
                "      \"Sid\": \"ApprovedRegionsOnly\",\n" +
                "      \"Effect\": \"Deny\",\n" +
                "      \"NotAction\": [\"iam:*\", \"organizations:*\", \"sts:*\", \"cloudfront:*\",\n" +
                "                    \"route53:*\", \"support:*\", \"budgets:*\"],\n" +
                "      \"Resource\": \"*\",\n" +
                "      \"Condition\": {\n" +
                "        \"StringNotEquals\": { \"aws:RequestedRegion\": [\"eu-west-1\", \"eu-central-1\"] },\n" +
                "        \"ArnNotLike\": { \"aws:PrincipalArn\": \"arn:aws:iam::*:role/OrgBreakGlass\" }\n" +
                "      }\n" +
                "    }\n" +
                "  ]\n" +
                "}"
              },
              { t: "note", variant: "trap", html: "SCPs do not apply to the management account, and they do not affect service-linked roles. A region-deny SCP without exemptions for global services (IAM, STS, CloudFront, Route 53) will break things in confusing ways — test new SCPs on a policy-staging OU first." },
              { t: "p", html: "The Azure equivalent of this baseline is a set of <strong>Azure Policy</strong> assignments at management groups (allowed locations, deny deletion of diagnostic settings, require tags). On Google Cloud it is <strong>Organization Policy constraints</strong> such as <code class='tok'>gcp.resourceLocations</code> plus IAM deny policies for the most dangerous permissions." },
              { t: "h", text: "Tagging and billing" },
              { t: "table", headers: ["Tag / label key", "Why it exists", "Enforced by"], rows: [
                ["<code class='tok'>owner</code>", "Who to page and who approves changes", "Tag policies / Azure Policy / org policy plus CI checks"],
                ["<code class='tok'>cost-center</code>", "Chargeback and showback", "Cost allocation tags activated in billing"],
                ["<code class='tok'>environment</code>", "prod / staging / dev — drives guardrails and alerting", "IaC module defaults"],
                ["<code class='tok'>data-classification</code>", "public / internal / confidential — drives encryption and logging", "Policy that denies untagged data stores"]
              ] },
              { t: "table", headers: ["Need", "AWS", "Azure", "Google Cloud"], rows: [
                ["Labels on resources", "Tags; tag policies in Organizations", "Tags (do not inherit by default; policy can copy them)", "Labels (and separate IAM tags for policy conditions)"],
                ["Budgets and alerts", "AWS Budgets", "Cost Management budgets", "Cloud Billing budgets"],
                ["Raw cost data", "Cost and Usage Report / Data Exports", "Cost exports", "Billing export to BigQuery"]
              ] },
              { t: "compare",
                bad: { title: "Baseline by documentation", items: ["A wiki page says 'please enable CloudTrail'", "Each team configures logging differently", "Findings and costs scattered across accounts"] },
                good: { title: "Baseline by construction", items: ["Organisation trail and delegated security services on by default", "SCPs make disabling them impossible", "Tags enforced at deploy, budgets per account from day zero"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'an attacker disabled logging', 'nobody knows who owns this bucket', 'surprise bill from a forgotten region' — each maps to one baseline control: protected central logs, mandatory owner tags, region-deny plus budgets." },
              { t: "note", variant: "key", html: "<strong>Record everything centrally, and make turning it off impossible.</strong> Log archive and security accounts, a short deny-list of SCPs, enforced tags and per-account budgets are the day-zero baseline." }
            ]
          },
          {
            id: "migration-7rs",
            title: "Migration strategies: the 7 Rs and migration waves",
            summary: "Retire, retain, rehost, relocate, repurchase, replatform and refactor; how to assign them per application, plan waves, and which native tools carry each one.",
            minutes: 10,
            tags: ["migration", "7rs", "rehost", "replatform", "refactor"],
            blocks: [
              { t: "p", html: "Most cloud work at large companies starts as a <strong>migration</strong>: an estate of hundreds of applications in a data centre and a deadline. The industry shorthand for the choices per application is the <strong>7 Rs</strong>. The skill is not reciting them; it is assigning the right one to each application and sequencing the moves." },
              { t: "table", headers: ["R", "What happens", "Effort", "Typical fit"], rows: [
                ["Retire", "Switch it off", "Lowest", "Duplicate or unused apps found during discovery, often 10% or more of an estate"],
                ["Retain", "Leave it where it is for now", "None now", "Recent hardware investment, compliance blockers, apps due for replacement later"],
                ["Rehost (lift and shift)", "Move servers unchanged onto cloud VMs", "Low", "Deadline-driven moves; legacy apps nobody can change safely"],
                ["Relocate", "Move a whole hypervisor estate onto a provider-hosted VMware platform", "Low", "Large VMware estates that must exit a data centre quickly"],
                ["Repurchase (drop and shop)", "Replace with a different product, usually SaaS", "Medium", "CRM, HR, ticketing and other commodity software"],
                ["Replatform (lift, tinker and shift)", "Swap components for managed services without re-architecting", "Medium", "Self-managed database to RDS, app server to a managed container platform"],
                ["Refactor / re-architect", "Redesign for cloud-native services", "Highest", "Core differentiating systems where scale, speed or cost justify the work"]
              ] },
              { t: "note", variant: "tip", html: "Rehost first, then optimize is a legitimate strategy when the driver is a data-centre exit date. Moving gets you out; replatforming in place later is cheaper than refactoring under deadline pressure." },
              { t: "h", text: "How a migration programme runs" },
              { t: "ol", items: [
                "<strong>Assess</strong>: build the business case, inventory the estate, and score readiness. Collect utilisation, not just specs, so you rightsize at the destination.",
                "<strong>Mobilize</strong>: build the landing zone, identity, network connectivity and the migration factory (runbooks, tooling, cut-over templates). Assign an R to each application.",
                "<strong>Migrate and modernize</strong>: move in <strong>waves</strong> of dependent applications, starting with low-risk ones to prove the process, then scale up the cadence."
              ] },
              { t: "p", html: "Waves are built from <strong>dependency mapping</strong>. Applications that talk to each other at low latency or share a database must move together, or the first wave breaks the second." },
              { t: "h", text: "The native tooling" },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["Discovery and assessment", "Application Discovery Service, Migration Hub, Migration Evaluator", "Azure Migrate (discovery and assessment)", "Migration Center"],
                ["Rehost servers", "AWS Application Migration Service (block-level replication)", "Azure Migrate server migration", "Migrate to Virtual Machines"],
                ["Relocate VMware", "VMware Cloud on AWS (partner-operated)", "Azure VMware Solution", "Google Cloud VMware Engine"],
                ["Databases", "Database Migration Service and Schema Conversion", "Azure Database Migration Service", "Database Migration Service"],
                ["Bulk data", "DataSync, Snowball devices", "Azure Data Box, AzCopy", "Storage Transfer Service, Transfer Appliance"]
              ] },
              { t: "h", text: "Cut-over, the risky hour" },
              { t: "ul", items: [
                "Replicate continuously ahead of time so cut-over is a short sync, not a bulk copy.",
                "Lower DNS TTLs days in advance; switch with a DNS change that you can reverse.",
                "Rehearse the cut-over and the rollback on a non-production copy.",
                "Keep the source read-only but running until the agreed rollback window ends."
              ] },
              { t: "note", variant: "warn", html: "Rehosting copies the old security model too: shared admin accounts, flat networks and hard-coded credentials move with the servers. Fix identity and network segmentation in the landing zone before wave one, not after the last wave." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'exit our data centre by Q3', '500 VMs', 'what would you move first?' Answer with discovery and dependency mapping, an R per application group, a pilot wave of low-risk apps, and a landing zone that is ready first." },
              { t: "quiz", id: "found-migration" },
              { t: "note", variant: "key", html: "<strong>Assign an R per application, move in dependency-based waves, and build the landing zone first.</strong> Retire and repurchase shrink the job, rehost and relocate meet deadlines, and replatform or refactor where the value justifies the effort." }
            ]
          },
          {
            id: "choosing-provider",
            title: "Choosing a provider: multi-cloud versus cloud-agnostic",
            summary: "How to pick a primary cloud, when a second one is justified, and what portability really costs.",
            minutes: 8,
            tags: ["multi-cloud", "cloud-agnostic", "strategy"],
            blocks: [
              { t: "p", html: "There is no best cloud, only a best fit for an organisation's skills, contracts and workloads. The mental model: <strong>pick a primary cloud deliberately, and make every exception justify itself</strong>. 'Multi-cloud' and 'cloud-agnostic' are not the same thing, and conflating them is the most common strategic mistake in this area." },
              { t: "table", headers: ["Provider", "Tends to win when", "Watch for"], rows: [
                ["AWS", "You want the broadest service catalogue and the deepest third-party ecosystem and hiring pool", "Breadth means many overlapping options; account-per-workload discipline is on you"],
                ["Azure", "The organisation already lives in Microsoft 365, Entra ID, Windows Server and SQL Server licensing", "Service naming and SKUs change often; tenant-wide identity mistakes have a large blast radius"],
                ["Google Cloud", "Data and analytics (BigQuery), Kubernetes (GKE) and a global network are central", "Smaller enterprise partner ecosystem in some regions; verify regional service coverage"]
              ] },
              { t: "h", text: "Three strategies that get confused" },
              { t: "table", headers: ["Strategy", "What it means", "What it costs"], rows: [
                ["Single cloud, used deeply", "One provider; managed services wherever they fit", "Concentration risk and real exit cost — usually the cheapest to run well"],
                ["Multi-cloud by workload", "Each workload lives on one cloud; different workloads on different clouds", "Two landing zones, two identity integrations, two skill sets; egress between clouds"],
                ["Cloud-agnostic / portable", "The same workload can move between clouds (Kubernetes, Terraform, open-source data stores)", "You give up most managed services and run more yourself; portability is rarely tested and so rarely real"]
              ] },
              { t: "table", headers: ["Tier", "Answer to 'should we be multi-cloud?'", "Why"], rows: [
                ["Naive", "'Yes, everything must run on all three to avoid lock-in'", "Lowest-common-denominator design, triple cost, and the failover is never exercised"],
                ["Solid", "'One primary cloud; a second only for a concrete reason'", "Keeps the platform team focused; exceptions are visible"],
                ["Standout", "'Primary cloud, a short list of justified exceptions (acquisition, unique service, regulatory demand), portable layers only where cheap (containers, OpenTelemetry, Terraform workflow), and a written, priced exit plan for the crown jewels'", "Treats lock-in as a cost you measure and accept on purpose"]
              ] },
              { t: "ul", items: [
                "<strong>Egress</strong>: data leaving a cloud is billed; cross-cloud architectures pay it on every hop (illustrative: cents per GB add up fast at terabyte scale).",
                "<strong>Identity</strong>: each cloud needs its own federation, roles and guardrails, so the security surface doubles.",
                "<strong>People</strong>: deep expertise in one cloud beats shallow expertise in three for on-call quality.",
                "<strong>Tooling</strong>: CSPM, logging and cost tools must cover every cloud you use."
              ] },
              { t: "note", variant: "tip", html: "Portability that is cheap to keep: container images, OpenTelemetry for telemetry, Terraform as the workflow, open formats for data (Parquet, Iceberg). Portability that is expensive: abstracting away every managed database, queue and identity system." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'avoid vendor lock-in', 'regulator asked for an exit plan', 'we acquired a company on another cloud' — separate multi-cloud-by-workload from portability, and price the exit instead of promising it is free." },
              { t: "quiz", id: "found-landing" },
              { t: "note", variant: "key", html: "<strong>Choose a primary cloud on purpose; make every exception earn its place.</strong> Multi-cloud by workload is common and fine; cloud-agnostic everything is expensive and usually untested." }
            ]
          }
        ]
      }
    ]
  };
})();
