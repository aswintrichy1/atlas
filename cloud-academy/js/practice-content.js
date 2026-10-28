/* Nimbus practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.found / iam / net / compute / data / iac / waf / obs. */
window.NimbusPractice = {
  "nav": [
    {
      "id": "scenarios",
      "route": "#/scenarios",
      "title": "Scenario packs",
      "label": "Design walkthroughs",
      "color": "#60a5fa",
      "icon": "map",
      "summary": "Outlines you can talk through end to end for the cloud architecture, identity, network and cost problems that come up most."
    },
    {
      "id": "interview",
      "route": "#/interview",
      "title": "Interview prompts",
      "label": "Timed practice",
      "color": "#f59e0b",
      "icon": "quiz",
      "summary": "Timed prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      "id": "rubrics",
      "route": "#/rubrics",
      "title": "Rubrics",
      "label": "Score yourself",
      "color": "#34d399",
      "icon": "star",
      "summary": "The dimensions a cloud architecture or platform round is scored on, and what each band sounds like."
    },
    {
      "id": "cheatsheets",
      "route": "#/cheatsheets",
      "title": "Cheat sheets",
      "label": "Fast recall",
      "color": "#fbbf24",
      "icon": "md",
      "summary": "Cross-cloud maps, limits and defaults worth having in memory."
    },
    {
      "id": "glossary",
      "route": "#/glossary",
      "title": "Glossary",
      "label": "Say it precisely",
      "color": "#a78bfa",
      "icon": "lesson",
      "summary": "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],
  "scenarios": [
    {
      "id": "found-scn-landing-zone",
      "title": "Design a landing zone for a scale-up",
      "subtitle": "From one shared AWS account to a governed multi-account estate",
      "timebox": "30 min",
      "prompt": "A 200-person fintech runs everything in one AWS account: dev, staging and prod side by side, IAM users for engineers, and CloudTrail in the same account. They are onboarding ten product teams this year and starting a PCI audit. Design the target account structure, the landing-zone tooling, the baseline guardrails and a migration order. Mention how the same design would look if they were on Azure or Google Cloud.",
      "related": [
        {
          "label": "Multi-account strategy",
          "route": "#/found/landing/multi-account"
        },
        {
          "label": "Landing zones",
          "route": "#/found/landing/landing-zones"
        },
        {
          "label": "Baseline guardrails",
          "route": "#/found/landing/guardrails-baseline"
        }
      ],
      "outline": [
        {
          "title": "Hierarchy and accounts",
          "items": [
            "Security OU with log archive and security tooling accounts",
            "Infrastructure OU with network and shared-services accounts",
            "Workloads OU split prod and non-prod, one account per workload per environment",
            "Sandbox and suspended OUs; management account empty"
          ]
        },
        {
          "title": "Landing-zone tooling",
          "items": [
            "Control Tower (or equivalent) for the baseline and controls",
            "Account Factory for Terraform so vending is a pull request",
            "IAM Identity Center federated to the corporate IdP; retire IAM users"
          ]
        },
        {
          "title": "Guardrails",
          "items": [
            "SCPs protecting CloudTrail, GuardDuty and Config; deny leaving org",
            "Approved-regions SCP with global-service exemptions and break-glass role",
            "Mandatory owner, cost-center, environment and data-classification tags; budgets per account",
            "PCI workloads in their own OU with stricter controls to shrink audit scope"
          ]
        },
        {
          "title": "Migration and cross-cloud mapping",
          "items": [
            "Stand up the landing zone first, then move prod workloads one by one",
            "Keep the old account as a legacy account under a restricted OU until empty",
            "Azure: management groups, subscription vending, Azure Policy; Google Cloud: folders, project factory, org policy constraints"
          ]
        }
      ]
    },
    {
      "id": "iam-scn-kill-the-keys",
      "title": "Eliminate long-lived credentials across three clouds",
      "subtitle": "CI, humans and workloads without a single stored key",
      "timebox": "30 min",
      "prompt": "A platform team deploys to AWS from GitHub Actions using an IAM user's access key, engineers have IAM users in six accounts, an Azure Function uses a service principal client secret, and a Google Cloud batch job reads a service account JSON key from a bucket. Design the replacement for each, the trust conditions that keep them tight, the guardrails that stop keys coming back, and a rollout order.",
      "related": [
        {
          "label": "OIDC federation for CI",
          "route": "#/iam/roles/oidc-ci"
        },
        {
          "label": "Human access with Identity Center",
          "route": "#/iam/roles/humans-sso"
        },
        {
          "label": "Azure identities",
          "route": "#/iam/guardrails/azure-identity"
        },
        {
          "label": "Google Cloud identities",
          "route": "#/iam/guardrails/gcp-identity"
        }
      ],
      "outline": [
        {
          "title": "CI to AWS",
          "items": [
            "IAM OIDC provider for GitHub; role per environment",
            "Trust conditions: aud sts.amazonaws.com and exact sub pinned to a protected environment",
            "Workflow permissions id-token: write; delete the IAM user and its key"
          ]
        },
        {
          "title": "Humans",
          "items": [
            "IAM Identity Center federated to the corporate IdP with SCIM group sync",
            "Permission sets per job function, assigned by group per account",
            "Break-glass path with hardware MFA and alerting"
          ]
        },
        {
          "title": "Azure and Google Cloud workloads",
          "items": [
            "Azure Function: user-assigned or system-assigned managed identity with RBAC at the narrowest scope",
            "Batch job on Google Cloud: attached service account; external callers via Workload Identity Federation",
            "Org policy iam.disableServiceAccountKeyCreation; delete existing keys after cut-over"
          ]
        },
        {
          "title": "Keep it that way",
          "items": [
            "SCP or detection on iam:CreateAccessKey and iam:CreateUser outside break-glass",
            "Access Analyzer unused-access findings and IAM recommender reviews",
            "Secret scanning in CI to catch any key that reappears"
          ]
        }
      ]
    },
    {
      "id": "net-scn-multi-account-network",
      "title": "Network a 20-account estate with on-prem access",
      "subtitle": "Address plan, tiers, hub, hybrid link and private service access",
      "timebox": "30 min",
      "prompt": "A retailer is moving to AWS with about 20 workload accounts across production and development, plus a shared-services account. Workloads must reach an on-premises data centre (10.128.0.0/12 already in use) and S3, production must never reach development, databases must have no internet path, and the security team wants central egress inspection. Design the network, and say how the same design would look on Azure and GCP.",
      "related": [
        {
          "label": "CIDR and IP math",
          "route": "#/net/vpc/cidr-math"
        },
        {
          "label": "Subnet tiers across zones",
          "route": "#/net/vpc/subnet-tiers"
        },
        {
          "label": "Peering and transit hubs",
          "route": "#/net/traffic/peering-transit"
        },
        {
          "label": "Hybrid connectivity",
          "route": "#/net/traffic/hybrid"
        }
      ],
      "outline": [
        {
          "title": "Address plan",
          "items": [
            "Reserve a production and a development supernet that avoid 10.128.0.0/12",
            "Allocate one non-overlapping /16 or /20 per account from IPAM",
            "Size private-app subnets for container IP consumption"
          ]
        },
        {
          "title": "VPC shape",
          "items": [
            "Public, private-app and isolated data tiers in three AZs",
            "Data tier route table has no default route",
            "Flow logs on every VPC to the log archive account"
          ]
        },
        {
          "title": "Connectivity",
          "items": [
            "Transit Gateway with prod, dev and shared route tables; no prod-dev propagation",
            "Central egress and inspection VPC behind a default route on the hub",
            "Two Direct Connect links in different locations plus VPN backup, all BGP, with encryption decided explicitly"
          ]
        },
        {
          "title": "Private access and cross-cloud",
          "items": [
            "Gateway endpoint for S3, interface endpoints centralised and shared through DNS",
            "Azure: Virtual WAN or hub VNet with Azure Firewall, ExpressRoute, private endpoints",
            "GCP: Shared VPC host projects, NCC hub, Cloud Interconnect, Private Service Connect"
          ]
        }
      ]
    },
    {
      "id": "compute-scn-ticketing-surge",
      "title": "Ticket on-sale surge",
      "subtitle": "Choose and scale compute for a service that idles all week and spikes for one hour",
      "timebox": "30 min",
      "prompt": "A ticketing company runs a checkout API that handles about 50 requests per second most of the week and 8,000 per second for the first hour after a popular on-sale opens at a known time. Today it runs on ten always-on VMs and falls over at every big on-sale. Propose the compute platform on AWS, how it scales into the spike, how you keep cost sane the rest of the week, and name the Azure and GCP equivalents.",
      "related": [
        {
          "label": "Auto Scaling groups, Scale Sets and MIGs",
          "route": "#/compute/vms/autoscaling"
        },
        {
          "label": "Lambda: concurrency and cold starts",
          "route": "#/compute/serverless/lambda"
        },
        {
          "label": "Choosing compute",
          "route": "#/compute/serverless/choosing-compute"
        }
      ],
      "outline": [
        {
          "title": "Pick the runtime",
          "items": [
            "Containerise the API; run it on ECS Fargate (Container Apps / Cloud Run) or Lambda behind API Gateway",
            "Compare concurrency needs: 8,000 rps x 0.2 s = 1,600 Lambda environments, against the regional quota",
            "State the trade-off: Fargate keeps connection pooling; Lambda needs a quota raise and RDS Proxy"
          ]
        },
        {
          "title": "Scale into a known spike",
          "items": [
            "Scheduled scaling raises minimum capacity 30 minutes before the on-sale",
            "Target tracking on requests per target above that floor",
            "Provisioned concurrency or min instances if Lambda / Cloud Run is chosen"
          ]
        },
        {
          "title": "Protect what is behind it",
          "items": [
            "A queue or waiting room in front of checkout to shape load",
            "Database connection limits: proxy, max instances cap",
            "Load test the ramp, not just the plateau"
          ]
        },
        {
          "title": "Cost the quiet week",
          "items": [
            "Low minimum capacity outside events",
            "Compute Savings Plan only for the true baseline",
            "Spot or Fargate Spot for non-critical workers"
          ]
        }
      ]
    },
    {
      "id": "data-scn-clickstream-platform",
      "title": "Clickstream to dashboards",
      "subtitle": "Ingest, store and query 20,000 events per second without a runaway bill",
      "timebox": "30 min",
      "prompt": "A retailer emits about 20,000 clickstream events per second at peak (around 1 KB each). Product teams want near-real-time counters on a live dashboard, analysts want ad-hoc SQL over two years of history, and finance wants storage cost to fall as data ages. Design the pipeline on AWS, size the stream, choose storage classes and the query engine, and map each piece to Azure and GCP.",
      "related": [
        {
          "label": "Streams: Kinesis, MSK, Firehose",
          "route": "#/data/analytics/streaming"
        },
        {
          "label": "A data lake on S3",
          "route": "#/data/analytics/data-lake"
        },
        {
          "label": "Storage classes and lifecycle",
          "route": "#/data/storage/storage-classes"
        }
      ],
      "outline": [
        {
          "title": "Ingest",
          "items": [
            "Kinesis Data Streams: 20 MB/s and 20,000 rec/s means at least 20 shards, or on-demand mode",
            "Partition key with high cardinality (session id), never a constant",
            "Equivalents: Event Hubs partitions, Pub/Sub topic"
          ]
        },
        {
          "title": "Real-time path",
          "items": [
            "Managed Flink (Dataflow / Stream Analytics) computing windowed counters",
            "Results to DynamoDB or a cache for the dashboard",
            "Idempotent writes keyed by window and dimension"
          ]
        },
        {
          "title": "Lake path",
          "items": [
            "Firehose to S3 as Parquet, partitioned by date (Event Hubs Capture, Pub/Sub Cloud Storage subscription)",
            "Compaction to hundreds-of-MB files; Iceberg tables in the curated zone",
            "Glue Data Catalog and Lake Formation for column-level access"
          ]
        },
        {
          "title": "Query and cost",
          "items": [
            "Athena for ad-hoc work with per-workgroup scan limits; Redshift Serverless or BigQuery if concurrency grows",
            "Lifecycle: raw zone to Standard-IA at 30 days and Glacier Flexible at 180, expire raw after a year",
            "SSE-KMS everywhere, Block Public Access on"
          ]
        }
      ]
    },
    {
      "id": "iac-scn-terraform-platform",
      "title": "Put a click-ops estate under Terraform",
      "subtitle": "State layout, modules, environments, pipeline and drift",
      "timebox": "30 min",
      "prompt": "A company runs three environments on AWS, built mostly by hand in the console, with a few Terraform folders on engineers' laptops and local state files. Leadership wants every change reviewed, reproducible environments, and no long-lived cloud keys in CI. Design how you would bring the estate under IaC without an outage, and say what would change if part of the estate were on Azure.",
      "related": [
        {
          "label": "State and backends",
          "route": "#/iac/tf-scale/state"
        },
        {
          "label": "Modules",
          "route": "#/iac/tf-scale/modules"
        },
        {
          "label": "Environments and drift",
          "route": "#/iac/tf-scale/envs-drift"
        },
        {
          "label": "The IaC pipeline",
          "route": "#/iac/tf-scale/iac-pipeline"
        }
      ],
      "outline": [
        {
          "title": "State first",
          "items": [
            "Move every local state to a remote backend with locking and encryption",
            "Split state per environment and per component so that blast radius stays small",
            "Restrict state access: it can hold secrets"
          ]
        },
        {
          "title": "Adopt what exists",
          "items": [
            "Use import blocks to bring console-built resources under management",
            "Iterate until plan shows no changes before refactoring",
            "Use moved blocks when restructuring into modules"
          ]
        },
        {
          "title": "Modules and environments",
          "items": [
            "Versioned modules with small interfaces for network, service and data",
            "One root per environment with its own variables and backend",
            "Keep environments structurally identical, differing only in sizing"
          ]
        },
        {
          "title": "Pipeline and guardrails",
          "items": [
            "PR runs fmt, validate, policy checks and plan; plan posted for review",
            "Apply after approval with a short-lived OIDC role per environment",
            "Scheduled plan detects drift; console write access reduced to break-glass",
            "Azure parts: azurerm provider with workload identity federation, or Bicep with what-if"
          ]
        }
      ]
    },
    {
      "id": "waf-scn-review",
      "title": "Run a well-architected review of a payments API",
      "subtitle": "Reliability, DR, security and cost findings with trade-offs",
      "timebox": "30 min",
      "prompt": "A payments API runs on AWS in one region: an Auto Scaling group in two availability zones, a single-AZ relational database, nightly snapshots in the same account, and NAT gateways that carry all traffic to object storage. The business wants an RTO of one hour and an RPO of five minutes, and finance has flagged a rising bill. Run a review: list the highest-risk findings, the DR strategy you would recommend, and the cost fixes, and state each trade-off.",
      "related": [
        {
          "label": "Failure domains and resilience",
          "route": "#/waf/reliability/resilience-patterns"
        },
        {
          "label": "Disaster recovery strategies",
          "route": "#/waf/reliability/dr-strategies"
        },
        {
          "label": "Security pillar",
          "route": "#/waf/secops/security-pillar"
        },
        {
          "label": "Cost levers",
          "route": "#/waf/cost/cost-levers"
        }
      ],
      "outline": [
        {
          "title": "Reliability",
          "items": [
            "Single-AZ database is the top risk: move to Multi-AZ",
            "Spread compute across three zones with N-1 headroom",
            "Add timeouts, jittered retries and idempotency keys on payment writes"
          ]
        },
        {
          "title": "Disaster recovery",
          "items": [
            "RTO 1 h and RPO 5 min fit pilot light or warm standby",
            "Cross-region replica for the database; IaC to stand up compute",
            "Copy backups to a separate account and region with deletion protection",
            "Rehearse failover and failback on a game day"
          ]
        },
        {
          "title": "Security",
          "items": [
            "Federated access, no long-lived keys, central audit logs",
            "Customer-managed KMS keys on the database and backups",
            "Threat detection findings routed to an owner"
          ]
        },
        {
          "title": "Cost",
          "items": [
            "Gateway endpoint for object storage to remove NAT processing",
            "Rightsize then commit to the steady baseline",
            "Tag everything and track cost per transaction"
          ]
        }
      ]
    },
    {
      "id": "obs-scn-noisy-pager",
      "title": "Fix a noisy pager and a runaway logging bill",
      "subtitle": "SLO alarms, audit coverage and telemetry cost on one platform",
      "timebox": "30 min",
      "prompt": "A payments platform on AWS pages its on-call engineer about 40 times a week, mostly for CPU and single-minute latency spikes, yet a 25-minute checkout outage last month was reported by customers first. The CloudWatch bill has tripled, and the security team cannot say who read a sensitive bucket during an incident. Propose a plan, and note the Azure and GCP equivalents.",
      "related": [
        {
          "label": "Metrics, logs and traces",
          "route": "#/obs/stack/signals"
        },
        {
          "label": "Alarms that page well",
          "route": "#/obs/stack/alarms"
        },
        {
          "label": "Audit trails",
          "route": "#/obs/stack/audit"
        },
        {
          "label": "Cost of observability",
          "route": "#/obs/stack/cost"
        }
      ],
      "outline": [
        {
          "title": "Paging",
          "items": [
            "Define checkout availability and latency SLOs",
            "Page on multi-window burn rates; move CPU to dashboards",
            "Use M of N and composite alarms; review every page weekly"
          ]
        },
        {
          "title": "Detection gap",
          "items": [
            "Add a synthetic checkout canary and a heartbeat with missing data treated as breaching",
            "Trace checkout with OpenTelemetry and tail sampling"
          ]
        },
        {
          "title": "Audit",
          "items": [
            "Organization trail to a locked log archive account with integrity validation",
            "Enable S3 data events on the sensitive buckets only",
            "SCP preventing trail changes"
          ]
        },
        {
          "title": "Cost",
          "items": [
            "Drop DEBUG and sample access logs at the collector",
            "Set retention on every log group in IaC; archive to S3",
            "Remove high-cardinality metric dimensions"
          ]
        }
      ]
    }
  ],
  "interview": [
    {
      "id": "found-int-account-boundary",
      "title": "Why one account per workload?",
      "timebox": "20 min",
      "prompt": "An interviewer asks: 'We have one AWS account per environment today. Convince me we should move to one account per workload per environment — and tell me what it will cost us.'",
      "expected": [
        "Account as blast radius: IAM, quotas and billing are scoped per account",
        "Concrete failure stories: leaked dev key, load test exhausting prod quota, unclear cost ownership",
        "Costs: cross-account networking, DNS, identity and logging automation, more accounts to govern",
        "The enabler: a landing zone with automated account vending and a baseline",
        "Mapping: subscriptions under management groups on Azure, projects under folders on Google Cloud"
      ],
      "followups": [
        "How do SCPs interact with an AdministratorAccess role in a member account?",
        "Where do your CloudTrail logs live, and who can delete them?",
        "How would you handle a workload that genuinely needs to span two accounts?"
      ],
      "links": [
        {
          "label": "Multi-account strategy",
          "route": "#/found/landing/multi-account"
        },
        {
          "label": "Resource hierarchy",
          "route": "#/found/landing/resource-hierarchy"
        }
      ]
    },
    {
      "id": "iam-int-why-denied",
      "title": "The admin who cannot read the bucket",
      "timebox": "20 min",
      "prompt": "An interviewer says: 'A role with AdministratorAccess gets AccessDenied reading an S3 object in its own account. Walk me through how you would find out why, then explain how the answer changes if the bucket is in another account.'",
      "expected": [
        "Walks the evaluation order: explicit deny, SCP and RCP, resource policy, identity policy, permission boundary, session policy",
        "Checks the bucket policy for an explicit Deny (for example aws:SecureTransport or aws:PrincipalOrgID conditions)",
        "Considers KMS: the key policy must allow the role to decrypt SSE-KMS objects",
        "Mentions a boundary or session policy narrowing the role",
        "Cross-account: both the caller's identity policy and the bucket policy must allow; object ownership settings matter"
      ],
      "followups": [
        "How would CloudTrail help you pinpoint which policy denied it?",
        "What changes if the bucket policy names the role session ARN instead of the role ARN?",
        "How would you prevent this class of bug before deployment?"
      ],
      "links": [
        {
          "label": "Evaluation logic",
          "route": "#/iam/policies/evaluation-logic"
        },
        {
          "label": "Identity vs resource policies",
          "route": "#/iam/policies/identity-vs-resource"
        }
      ]
    },
    {
      "id": "net-iv-timeouts",
      "title": "Requests arrive but clients time out",
      "timebox": "20 min",
      "prompt": "After a security hardening change, users report that the web app times out. Load balancer access logs show requests arriving, and the targets show as healthy. Walk through how you would find and fix the cause, and how you would stop it recurring.",
      "expected": [
        "Recognises a timeout (not a refusal) points at dropped packets, likely on the return path",
        "Separates stateful security groups from stateless NACLs and checks for missing ephemeral-port return rules",
        "Uses VPC flow logs to find REJECT records on the reply direction",
        "Checks route tables for an asymmetric path, for example a new route through an appliance",
        "Proposes IaC review and a policy check so hardened NACLs always include return rules"
      ],
      "followups": [
        "How would this differ on Azure, where NSGs are stateful?",
        "What if only traffic from one AZ fails?",
        "Would you keep custom NACLs at all, or rely on security groups?"
      ],
      "links": [
        {
          "label": "Security groups and NACLs",
          "route": "#/net/traffic/sg-nacl"
        },
        {
          "label": "Route tables and NAT",
          "route": "#/net/vpc/routing-gateways"
        },
        {
          "label": "Flow logs",
          "route": "#/net/edge/cdn-flowlogs"
        }
      ]
    },
    {
      "id": "compute-int-ecs-vs-eks",
      "title": "ECS or EKS for a new platform?",
      "timebox": "20 min",
      "prompt": "Your company is moving 30 services from VMs to containers on AWS. Leadership asks whether to standardise on ECS or EKS. Walk through how you would decide, and what you would say about Azure and GCP if the company later goes multi-cloud.",
      "expected": [
        "Frames the choice as control versus operations, not 'industry standard'",
        "Asks about team size, Kubernetes skills, need for Helm charts or operators, and multi-cloud plans",
        "Explains workload identity on each: task roles, Pod Identity / IRSA, Entra Workload ID, GKE Workload Identity",
        "Notes ECS has no direct twin on Azure or GCP while EKS, AKS and GKE share the Kubernetes API",
        "Admits portability is partial because IAM, load balancers and storage stay cloud-specific",
        "Proposes a decision with a revisit trigger"
      ],
      "followups": [
        "How would Karpenter change your EKS cost estimate?",
        "When would GKE Autopilot or EKS Auto Mode change the answer?",
        "Which service would you keep on EC2 and why?"
      ],
      "links": [
        {
          "label": "ECS: tasks, services and EC2 versus Fargate",
          "route": "#/compute/containers/ecs-fargate"
        },
        {
          "label": "EKS, AKS and GKE",
          "route": "#/compute/containers/managed-kubernetes"
        }
      ]
    },
    {
      "id": "data-int-dynamo-hot-key",
      "title": "DynamoDB table is throttling",
      "timebox": "20 min",
      "prompt": "An order-tracking table in DynamoDB on-demand mode throttles writes every evening, although total traffic is well below what the table should handle. Diagnose the likely cause, explain the capacity arithmetic, and propose fixes. How would the same problem show up on Cosmos DB or Bigtable?",
      "expected": [
        "Suspects a hot partition: one key value (for example a status or a merchant id) receiving a large share of writes",
        "Explains the ~1,000 WCU and ~3,000 RCU per-partition ceilings and 1 KB / 4 KB unit maths",
        "Checks CloudWatch throttling metrics and contributor insights for the hottest keys",
        "Proposes write sharding with a suffix, a better partition key, or moving the aggregate elsewhere",
        "Mentions an under-provisioned or skewed GSI as a cause of base-table write throttling",
        "Maps it: Cosmos DB hot logical partitions consuming RU/s; Bigtable hotspots from monotonically increasing row keys"
      ],
      "followups": [
        "How do reads change if you shard the key into ten suffixes?",
        "Would switching to provisioned mode help? Why not?",
        "When would you move this access pattern off DynamoDB entirely?"
      ],
      "links": [
        {
          "label": "DynamoDB: keys, capacity and hot partitions",
          "route": "#/data/databases/dynamodb"
        },
        {
          "label": "Single-table design and other NoSQL",
          "route": "#/data/databases/nosql-design"
        }
      ]
    },
    {
      "id": "iac-iv-plan-destroys",
      "title": "The plan wants to destroy production",
      "timebox": "20 min",
      "prompt": "A pull request that only renames a resource and removes one item from a list produces a plan that replaces a production database and three subnets. Explain what is probably happening and how you would make the change safely.",
      "expected": [
        "Recognises that renaming an address without a moved block means destroy and create",
        "Identifies count index shifting when a middle list item is removed",
        "Proposes moved blocks and switching to for_each with stable keys",
        "Adds prevent_destroy or policy checks on critical resources",
        "Insists on reviewing the saved plan and applying exactly that plan"
      ],
      "followups": [
        "How would you detect this automatically in CI?",
        "What if someone already applied it?",
        "How does CloudFormation surface the same risk?"
      ],
      "links": [
        {
          "label": "Modules",
          "route": "#/iac/tf-scale/modules"
        },
        {
          "label": "Terraform language",
          "route": "#/iac/tf-core/tf-language"
        }
      ]
    },
    {
      "id": "waf-iv-dr-choice",
      "title": "Choose a DR strategy and defend it",
      "timebox": "20 min",
      "prompt": "A product owner asks for 'zero downtime, zero data loss' for an internal reporting tool with a modest budget. How do you respond, and what DR design do you end up with?",
      "expected": [
        "Turns the request into explicit RTO and RPO numbers tied to business impact",
        "Explains the cost curve from backup and restore to active/active",
        "Separates high availability across zones from regional DR",
        "Proposes the cheapest strategy that meets the agreed numbers",
        "Includes isolated backups and a rehearsal plan"
      ],
      "followups": [
        "What changes if the tool becomes customer-facing?",
        "How do multi-writer databases complicate active/active?",
        "How would you prove the RTO?"
      ],
      "links": [
        {
          "label": "Disaster recovery strategies",
          "route": "#/waf/reliability/dr-strategies"
        },
        {
          "label": "Multi-region data and failover",
          "route": "#/waf/reliability/multi-region"
        }
      ]
    },
    {
      "id": "obs-iv-design-alarm",
      "title": "Design the alarm for an API's latency",
      "timebox": "20 min",
      "prompt": "You own a public API with a p99 latency target of 500 ms. Design the alarm that pages on-call for latency problems. Explain the metric, statistic, threshold, evaluation settings, missing-data handling and how you would verify it does not page on noise.",
      "expected": [
        "Pages on a user-facing symptom (p99 latency or SLO burn), not on CPU",
        "Chooses a percentile statistic and a 1-minute period with M of N evaluation, explaining the delay trade-off",
        "Treats missing data deliberately and explains why for this metric",
        "Mentions composite alarms or a burn-rate pair to cut noise and clear quickly",
        "Back-tests the rule against historical data and reviews pages after rollout"
      ],
      "followups": [
        "How would you do this in Azure Monitor or Google Cloud Monitoring?",
        "When would anomaly detection beat a static threshold?",
        "How do you stop the alarm firing during a planned deployment?"
      ],
      "links": [
        {
          "label": "Alarms that page well",
          "route": "#/obs/stack/alarms"
        },
        {
          "label": "Metrics, logs and traces",
          "route": "#/obs/stack/signals"
        }
      ]
    }
  ],
  "rubrics": {
    "dimensions": [
      "Requirements first: users, scale, RTO/RPO, compliance and budget made explicit",
      "Account structure, identity and least privilege",
      "Network design: address plan, segmentation, private access and hybrid links",
      "Right service for the job: compute, storage and data choices with their limits",
      "Delivery and operations: IaC, pipelines, observability and recovery",
      "Cross-cloud fluency and trade-off reasoning, including cost"
    ],
    "bands": [
      {
        "id": "beginner",
        "title": "Beginner",
        "summary": "Names services but not why they fit or what they cost.",
        "signals": [
          "Jumps to a diagram before asking about scale, recovery targets or compliance.",
          "Uses one account and long-lived access keys for everything.",
          "Puts databases in public subnets or opens admin ports to the internet.",
          "Treats multi-AZ as disaster recovery."
        ]
      },
      {
        "id": "competent",
        "title": "Competent",
        "summary": "Builds a sound single-cloud design with private tiers, roles and IaC, but trade-offs stay implicit.",
        "signals": [
          "Separates environments into accounts and uses roles and federation.",
          "Plans non-overlapping CIDRs, private subnets and managed NAT per zone.",
          "Picks managed services with a reason and spreads across zones.",
          "Deploys with Terraform or native IaC through a pipeline."
        ]
      },
      {
        "id": "strong",
        "title": "Strong",
        "summary": "Designs from requirements, names every trade-off with its cost, and maps the design across clouds.",
        "signals": [
          "Derives the DR strategy from RTO and RPO and plans the rehearsal.",
          "Uses guardrails, workload identity and OIDC so no static keys exist.",
          "Spots hidden costs such as NAT processing, cross-zone traffic and egress.",
          "Explains the Azure and Google Cloud equivalents and where they differ."
        ]
      }
    ]
  },
  "cheatsheets": [
    {
      "id": "found-cs-cloud-basics",
      "title": "Cloud fundamentals in three dialects",
      "summary": "The vocabulary and structures you need before any workload design.",
      "items": [
        "Zones are for facility failures, regions for disasters and data residency, the edge for latency.",
        "On AWS align on zone IDs, not zone names, when accounts must share a zone.",
        "Data and identity are always the customer's responsibility, whatever the service model.",
        "AWS account ≈ Azure subscription ≈ Google Cloud project; the AWS account is the hardest wall.",
        "AWS OU ≈ Azure management group ≈ Google Cloud folder — where inherited policy lives.",
        "Google Cloud VPCs are global; AWS VPCs and Azure VNets are regional.",
        "SCPs cap, never grant, and do not apply to the management account.",
        "Baseline every account: central log archive, delegated security tooling, enforced tags, budgets.",
        "Multi-cloud by workload is common; cloud-agnostic everything is expensive and rarely tested."
      ]
    },
    {
      "id": "iam-cs-identity",
      "title": "IAM and workload identity essentials",
      "summary": "The rules that decide access, and the patterns that remove long-lived credentials.",
      "items": [
        "Start denied; an explicit Deny anywhere wins; an Allow must survive every ceiling.",
        "Same account: identity or resource policy can grant. Cross-account: both must.",
        "SCPs, RCPs, permission boundaries and session policies only ever cut — they never grant.",
        "Trust policy = who can assume a role; permission policies = what the session can do.",
        "Third parties assuming your role must present a per-tenant ExternalId.",
        "GitHub OIDC: check aud and an exact sub; a job with an environment gets repo:OWNER/REPO:environment:NAME.",
        "Azure access = principal + role + scope, inherited downward; RBAC is additive.",
        "Google Cloud bindings inherit down org, folders, projects; block service account key creation.",
        "Least privilege is a loop: bound, observe, generate, remove, alert, elevate just in time."
      ]
    },
    {
      "id": "net-cs-cross-cloud",
      "title": "Cloud networking cross-cloud map",
      "summary": "The AWS building blocks and their nearest Azure and GCP equivalents, with the catches.",
      "items": [
        "Network: AWS VPC (regional, AZ subnets) / Azure VNet (regional, zone-spanning subnets) / GCP VPC (global, regional subnets)",
        "Reserved IPs per subnet: AWS 5, Azure 5, GCP 4",
        "Stateful filter: security group / NSG / VPC firewall rules; stateless NACL exists only on AWS",
        "Outbound NAT: NAT gateway per AZ / NAT Gateway resource / Cloud NAT on Cloud Router",
        "Hub: Transit Gateway / Virtual WAN or hub VNet / Network Connectivity Center; GCP also uses Shared VPC",
        "Peering is non-transitive on all three clouds",
        "Hybrid: Site-to-Site VPN and Direct Connect / VPN Gateway and ExpressRoute / HA VPN and Cloud Interconnect; circuits are not encrypted by default",
        "Private access: gateway and interface endpoints / Private Endpoint / Private Service Connect, always with private DNS",
        "Load balancers: ALB, NLB, GWLB / Application Gateway, Load Balancer, Front Door / Application and Network LBs, global external Application LB",
        "Never 0.0.0.0/0 to SSH, RDP or database ports; flow logs on every network"
      ]
    },
    {
      "id": "compute-cheat-runtime-limits",
      "title": "Compute limits and levers",
      "summary": "The numbers and switches that decide most compute questions.",
      "items": [
        "Lambda: 15-minute timeout, 128 MB to 10 GB memory, CPU scales with memory (about 1 vCPU near 1,769 MB)",
        "Lambda concurrency is requests per second times duration; the default regional quota is 1,000 and can be raised",
        "Cloud Run: request concurrency per instance (default 80), min instances to avoid cold starts, jobs for batch",
        "Fargate: per vCPU and GB-second, no GPUs or privileged containers at the time of writing",
        "EC2 Spot: about two minutes' notice; Azure and GCP Spot: about 30 seconds",
        "Commit only to the baseline; spend-based commitments survive architecture changes",
        "Require IMDSv2 in launch templates and by SCP; block pod access to node metadata",
        "ASG health checks: use ELB health checks with a grace period, not EC2 status only",
        "Step Functions Standard for long or human-in-the-loop workflows; Express for short, high-volume ones"
      ]
    },
    {
      "id": "data-cheat-storage-numbers",
      "title": "Storage and data numbers to know",
      "summary": "Minimums, units and ceilings that come up in almost every data design.",
      "items": [
        "S3 is strongly consistent; Block Public Access on, SSE-S3 by default, SSE-KMS for key control",
        "Minimum durations: Standard-IA / One Zone-IA 30 days, Glacier Instant and Flexible 90, Deep Archive 180",
        "GCS Archive reads in milliseconds; S3 Glacier Flexible / Deep Archive and Azure Archive need a restore",
        "EBS is AZ-scoped; snapshots are regional; gp3 baseline is 3,000 IOPS and 125 MB/s",
        "RDS Multi-AZ standby is for failover, read replicas are for reads; PITR retention up to 35 days",
        "Aurora: six copies across three AZs, up to 15 replicas, Global Database lag typically under a second",
        "DynamoDB: RCU = 4 KB strong read (eventual 0.5, transactional 2); WCU = 1 KB write (transactional 2)",
        "Per-partition ceilings of roughly 3,000 RCU and 1,000 WCU; GSIs are eventually consistent only",
        "Kinesis shard: 1 MB/s or 1,000 records/s in, 2 MB/s out; retention 24 hours up to 365 days",
        "Athena and BigQuery on-demand bill by bytes scanned: Parquet plus partitioning is the main lever"
      ]
    },
    {
      "id": "iac-cs-terraform",
      "title": "Terraform at scale cheat sheet",
      "summary": "The habits that keep Terraform safe once more than one person uses it.",
      "items": [
        "Remote state with locking and encryption; never commit state",
        "Pin provider versions and commit .terraform.lock.hcl",
        "Prefer for_each with stable keys over count for collections",
        "Use moved blocks for renames, import blocks for adoption",
        "Small state files per environment and component",
        "Versioned modules with small, documented interfaces",
        "CI: fmt, validate, policy checks, plan on PR; apply the saved plan after approval",
        "Authenticate CI with OIDC to a scoped role; no stored access keys",
        "Scheduled plan for drift detection",
        "Native options: CloudFormation or CDK on AWS, Bicep on Azure; same review discipline"
      ]
    },
    {
      "id": "waf-cs-review",
      "title": "Well-Architected review cheat sheet",
      "summary": "The questions that find the riskiest gaps fastest.",
      "items": [
        "What fails together? Instances, zones, region, deploys, dependencies",
        "Does losing a zone need new capacity? If yes, it is not statically stable",
        "Are RTO and RPO written down, and has failover been rehearsed?",
        "Are backups in a separate account and region with deletion protection?",
        "Do people federate with MFA and do workloads use roles, with no long-lived keys?",
        "Are audit logs central and immutable?",
        "Is every store encrypted with a customer-managed key where required?",
        "Is all spend tagged to an owner, with budgets and anomaly alerts?",
        "Is traffic paying for NAT, cross-zone or egress hops it does not need?",
        "Are commitments sized to the post-rightsizing baseline?"
      ]
    },
    {
      "id": "obs-cs-cross-cloud",
      "title": "Observability cross-cloud map",
      "summary": "Native telemetry and audit services on each cloud, plus the alarm and cost rules of thumb.",
      "items": [
        "Metrics: CloudWatch / Azure Monitor Metrics / Cloud Monitoring",
        "Logs: CloudWatch Logs + Logs Insights / Log Analytics + KQL / Cloud Logging + Log Analytics (SQL)",
        "Tracing: X-Ray and Application Signals / Application Insights / Cloud Trace; instrument with OpenTelemetry (ADOT on AWS)",
        "Alarms: M of N, treat missing data per metric, composite alarms, anomaly bands (Azure: dynamic thresholds)",
        "Page on SLO burn rate with a long and a short window; ticket on slow burn",
        "Audit: CloudTrail management (default) vs data events (opt-in) / Activity Log and resource logs / Admin Activity (always on) and Data Access logs",
        "Centralise audit logs org-wide into a locked log archive account with immutability",
        "Cost: ingestion and retention first, then metric cardinality, then trace sampling",
        "Set log retention in IaC; CloudWatch log groups never expire by default"
      ]
    }
  ],
  "glossary": [
    {
      "id": "found-gl-availability-zone",
      "term": "Availability zone",
      "definition": "One or more data centres within a region that have independent power, cooling and networking, connected to sibling zones by low-latency links.",
      "useIt": "Our baseline is two zones minimum, three for quorum-based databases.",
      "links": [
        {
          "label": "Regions, zones and edge",
          "route": "#/found/basics/what-is-cloud"
        }
      ]
    },
    {
      "id": "found-gl-shared-responsibility",
      "term": "Shared responsibility model",
      "definition": "The division of security and operational duties between provider and customer, which moves with the service model but always leaves data and identity with the customer.",
      "useIt": "Moving to Lambda drops OS patching from our list, but the execution role is still ours to get right.",
      "links": [
        {
          "label": "Service models",
          "route": "#/found/basics/service-models"
        }
      ]
    },
    {
      "id": "found-gl-landing-zone",
      "term": "Landing zone",
      "definition": "A governed, code-defined multi-account environment with shared accounts, identity, networking, logging and guardrails into which new workloads are vended.",
      "useIt": "New teams get an account from the landing zone in minutes, already logged and connected.",
      "links": [
        {
          "label": "Landing zones",
          "route": "#/found/landing/landing-zones"
        }
      ]
    },
    {
      "id": "found-gl-scp",
      "term": "Service control policy",
      "definition": "An AWS Organizations policy attached to the root, an OU or an account that sets the maximum permissions available to principals in member accounts.",
      "useIt": "An SCP stops anyone in a workload account from disabling CloudTrail, even an admin.",
      "links": [
        {
          "label": "Baseline guardrails",
          "route": "#/found/landing/guardrails-baseline"
        }
      ]
    },
    {
      "id": "iam-gl-explicit-deny",
      "term": "Explicit deny",
      "definition": "A Deny statement that matches a request in any applicable AWS policy; it overrides all allows regardless of where they come from.",
      "useIt": "We use an explicit deny in the bucket policy so even admins cannot read it over plain HTTP.",
      "links": [
        {
          "label": "Evaluation logic",
          "route": "#/iam/policies/evaluation-logic"
        }
      ]
    },
    {
      "id": "iam-gl-external-id",
      "term": "ExternalId",
      "definition": "A per-customer value a third party must pass when assuming your role, checked by the trust policy to prevent the confused-deputy problem.",
      "useIt": "The vendor's role trust requires our tenant's ExternalId, so another customer cannot point the vendor at us.",
      "links": [
        {
          "label": "Roles and trust",
          "route": "#/iam/roles/roles-trust"
        }
      ]
    },
    {
      "id": "iam-gl-oidc-federation",
      "term": "OIDC federation",
      "definition": "Exchanging a signed, short-lived token from an external identity provider for temporary cloud credentials, with conditions on its claims.",
      "useIt": "Our pipeline has no stored AWS key; it federates through GitHub's OIDC token pinned to the production environment.",
      "links": [
        {
          "label": "OIDC for CI",
          "route": "#/iam/roles/oidc-ci"
        }
      ]
    },
    {
      "id": "iam-gl-permission-boundary",
      "term": "Permission boundary",
      "definition": "A managed policy attached to a user or role that caps the maximum permissions it can ever have, regardless of its own policies.",
      "useIt": "Developers can create app roles only with our boundary attached, so they cannot mint an admin role.",
      "links": [
        {
          "label": "Guardrails",
          "route": "#/iam/guardrails/guardrails"
        }
      ]
    },
    {
      "id": "net-gl-longest-prefix",
      "term": "Longest-prefix match",
      "definition": "The routing rule that picks, among all routes containing a destination, the one with the most fixed bits.",
      "useIt": "A /24 to a peering connection beats the /16 to the transit gateway for addresses inside that /24, whatever order the rows appear in.",
      "links": [
        {
          "label": "Route tables and gateways",
          "route": "#/net/vpc/routing-gateways"
        }
      ]
    },
    {
      "id": "net-gl-stateful",
      "term": "Stateful filtering",
      "definition": "Filtering that tracks allowed connections so their reply packets pass without a separate rule.",
      "useIt": "Security groups, Azure NSGs and GCP firewall rules are stateful; AWS NACLs are not, so they need ephemeral-port return rules.",
      "links": [
        {
          "label": "Security groups and NACLs",
          "route": "#/net/traffic/sg-nacl"
        }
      ]
    },
    {
      "id": "net-gl-hub-spoke",
      "term": "Hub-and-spoke",
      "definition": "A topology where every network attaches once to a central router, which provides transitive and segmented routing.",
      "useIt": "Choose a hub over peering once you pass a handful of VPCs or need central egress and inspection.",
      "links": [
        {
          "label": "Peering and transit hubs",
          "route": "#/net/traffic/peering-transit"
        }
      ]
    },
    {
      "id": "net-gl-private-endpoint",
      "term": "Private endpoint",
      "definition": "A network interface with a private IP in your subnet that fronts a managed service, reached through private DNS.",
      "useIt": "Pair the endpoint with a resource policy that denies access from anywhere else to build a data perimeter.",
      "links": [
        {
          "label": "Private access to services",
          "route": "#/net/traffic/private-access"
        }
      ]
    },
    {
      "id": "compute-gl-imdsv2",
      "term": "IMDSv2",
      "definition": "The token-based EC2 instance metadata service. A caller must PUT for a session token with a TTL header and present it on every read, and responses are limited by a hop count.",
      "useIt": "Say 'every launch template sets HttpTokens to required and an SCP denies anything else' when securing EC2.",
      "links": [
        {
          "label": "Golden images and IMDSv2",
          "route": "#/compute/vms/images-metadata"
        }
      ]
    },
    {
      "id": "compute-gl-savings-plan",
      "term": "Savings Plan",
      "definition": "An AWS commitment to spend a fixed amount per hour on compute for one or three years in exchange for a discount; Compute Savings Plans also cover Fargate and Lambda.",
      "useIt": "Use it when you can name the steady baseline that will exist for the whole term.",
      "links": [
        {
          "label": "Purchase options",
          "route": "#/compute/vms/purchase-options"
        }
      ]
    },
    {
      "id": "compute-gl-workload-identity",
      "term": "Workload identity",
      "definition": "Federating a workload's platform identity, such as a Kubernetes service account, to a cloud identity so it receives short-lived credentials without stored keys.",
      "useIt": "Name the per-cloud mechanism: EKS Pod Identity or IRSA, Microsoft Entra Workload ID, Workload Identity Federation for GKE.",
      "links": [
        {
          "label": "EKS, AKS and GKE",
          "route": "#/compute/containers/managed-kubernetes"
        }
      ]
    },
    {
      "id": "compute-gl-cold-start",
      "term": "Cold start",
      "definition": "The extra latency when a serverless platform must create and initialise a new execution environment or instance before handling a request.",
      "useIt": "Pair it with the fix: smaller packages, provisioned concurrency, SnapStart, or min instances.",
      "links": [
        {
          "label": "Lambda: event sources, concurrency and cold starts",
          "route": "#/compute/serverless/lambda"
        }
      ]
    },
    {
      "id": "data-gl-object-lock",
      "term": "Object Lock",
      "definition": "S3's write-once-read-many retention. Governance mode can be bypassed with a special permission; compliance mode cannot be removed by anyone until retention ends.",
      "useIt": "Reach for compliance mode when a prompt says immutable, WORM, ransomware-proof or regulator-mandated retention.",
      "links": [
        {
          "label": "The S3 model",
          "route": "#/data/storage/s3-model"
        }
      ]
    },
    {
      "id": "data-gl-pitr",
      "term": "Point-in-time recovery",
      "definition": "Restoring a database to any moment within a retention window by replaying transaction logs on top of a snapshot, always into a new instance or table.",
      "useIt": "Pair it with RPO: 'PITR gives us minutes of RPO; restores are rehearsed monthly'.",
      "links": [
        {
          "label": "Managed relational databases",
          "route": "#/data/databases/relational"
        }
      ]
    },
    {
      "id": "data-gl-single-table",
      "term": "Single-table design",
      "definition": "A DynamoDB modelling approach where several entity types share one table and generic keys so related items can be fetched in one query.",
      "useIt": "Use it for well-known, latency-critical access patterns, and say what it costs in readability and flexibility.",
      "links": [
        {
          "label": "Single-table design, Cosmos DB, Firestore and Bigtable",
          "route": "#/data/databases/nosql-design"
        }
      ]
    },
    {
      "id": "data-gl-lakehouse-table",
      "term": "Open table format",
      "definition": "A metadata layer such as Apache Iceberg, Delta Lake or Hudi that adds ACID transactions, schema evolution and time travel to files in object storage.",
      "useIt": "Mention it when lake data needs updates, deletes for privacy requests, or several engines reading the same tables.",
      "links": [
        {
          "label": "A data lake on S3",
          "route": "#/data/analytics/data-lake"
        },
        {
          "label": "Warehouses",
          "route": "#/data/analytics/warehouses"
        }
      ]
    },
    {
      "id": "iac-gl-state",
      "term": "Terraform state",
      "definition": "The record that maps configuration addresses to real resource IDs and their last known attributes.",
      "useIt": "If two people apply with separate local states, each thinks it owns the resources; a locked remote backend prevents that.",
      "links": [
        {
          "label": "State and backends",
          "route": "#/iac/tf-scale/state"
        }
      ]
    },
    {
      "id": "iac-gl-drift",
      "term": "Drift",
      "definition": "Any difference between deployed infrastructure and the configuration that last applied it.",
      "useIt": "A nightly plan that reports changes on an untouched branch means someone made a change by hand in the console UI.",
      "links": [
        {
          "label": "Environments and drift",
          "route": "#/iac/tf-scale/envs-drift"
        }
      ]
    },
    {
      "id": "iac-gl-moved",
      "term": "moved block",
      "definition": "A Terraform declaration that a resource's address changed, so state is updated instead of the object being replaced.",
      "useIt": "Wrapping existing resources into a module needs one moved block per resource to avoid a destroy-and-create plan.",
      "links": [
        {
          "label": "Modules",
          "route": "#/iac/tf-scale/modules"
        }
      ]
    },
    {
      "id": "iac-gl-whatif",
      "term": "What-if / change set",
      "definition": "The native previews of a deployment: Bicep and ARM what-if on Azure, change sets on CloudFormation.",
      "useIt": "Require the preview in the pull request just as you would a Terraform plan.",
      "links": [
        {
          "label": "CloudFormation and CDK",
          "route": "#/iac/native/cfn-cdk"
        },
        {
          "label": "Bicep and Google Cloud",
          "route": "#/iac/native/bicep-gcp"
        }
      ]
    },
    {
      "id": "waf-gl-rto-rpo",
      "term": "RTO and RPO",
      "definition": "Recovery time objective (how long you may be down) and recovery point objective (how much recent data you may lose).",
      "useIt": "An RTO of 4 hours and an RPO of 15 minutes usually points to pilot light with continuous replication.",
      "links": [
        {
          "label": "Disaster recovery strategies",
          "route": "#/waf/reliability/dr-strategies"
        }
      ]
    },
    {
      "id": "waf-gl-static-stability",
      "term": "Static stability",
      "definition": "Surviving the loss of a failure domain without needing to provision anything new during the incident.",
      "useIt": "Three zones at about two-thirds utilisation each can lose one zone without autoscaling.",
      "links": [
        {
          "label": "Failure domains and resilience",
          "route": "#/waf/reliability/resilience-patterns"
        }
      ]
    },
    {
      "id": "waf-gl-finops",
      "term": "FinOps",
      "definition": "The practice of making cloud spend visible and owned by engineering teams through an inform, optimize, operate loop.",
      "useIt": "Weekly per-team spend reports with a cost-per-order trend turn cost into an engineering metric.",
      "links": [
        {
          "label": "FinOps",
          "route": "#/waf/cost/finops"
        }
      ]
    },
    {
      "id": "waf-gl-chaos",
      "term": "Chaos experiment",
      "definition": "A controlled, hypothesis-driven fault injection with a limited blast radius and automatic stop conditions.",
      "useIt": "Fail one zone's instances with Fault Injection Service and confirm p99 latency stays within the SLO.",
      "links": [
        {
          "label": "Multi-region data and failover",
          "route": "#/waf/reliability/multi-region"
        }
      ]
    },
    {
      "id": "obs-gl-m-of-n",
      "term": "M of N evaluation",
      "definition": "An alarm rule that fires when at least M of the last N evaluated datapoints breach the threshold.",
      "useIt": "Use 3 of 5 to ride out one-minute blips while still catching an incident that flaps around the threshold.",
      "links": [
        {
          "label": "Alarms that page well",
          "route": "#/obs/stack/alarms"
        }
      ]
    },
    {
      "id": "obs-gl-burn-rate",
      "term": "Burn rate",
      "definition": "How fast a service consumes its error budget, as a multiple of the rate that would exactly exhaust it over the SLO window.",
      "useIt": "Page when a burn of around 14 holds for an hour; open a ticket for a burn near 1 over several days.",
      "links": [
        {
          "label": "Alarms that page well",
          "route": "#/obs/stack/alarms"
        }
      ]
    },
    {
      "id": "obs-gl-data-events",
      "term": "Data events",
      "definition": "Audit records of operations on data itself, such as object reads or function invocations, as opposed to configuration changes.",
      "useIt": "Enable them on sensitive stores so an incident can answer who read the data, accepting the extra cost.",
      "links": [
        {
          "label": "Audit trails and centralised logging",
          "route": "#/obs/stack/audit"
        }
      ]
    },
    {
      "id": "obs-gl-cardinality",
      "term": "Metric cardinality",
      "definition": "The number of unique dimension-value combinations a metric produces, each billed and stored as its own series.",
      "useIt": "Never use user IDs or request IDs as metric dimensions; put them in logs or trace attributes instead.",
      "links": [
        {
          "label": "The cost of observability",
          "route": "#/obs/stack/cost"
        }
      ]
    },
    {
      "id": "iam-gl-key-policy",
      "term": "KMS key policy",
      "definition": "The resource policy attached to every KMS key; no principal can use the key unless the key policy allows it directly or delegates to IAM.",
      "useIt": "Sharing an encrypted snapshot with another account fails until the key policy names that account, however permissive its IAM policies are.",
      "links": [{ "label": "KMS: key policies, grants, envelope encryption and rotation", "route": "#/iam/protect/kms" }]
    },
    {
      "id": "iam-gl-role-chaining",
      "term": "Role chaining",
      "definition": "Using credentials from one assumed role to assume another; the resulting session is capped at one hour.",
      "useIt": "A three-hour migration job fails mid-way because it chained into the target role; re-assume from its own identity instead.",
      "links": [{ "label": "Role chaining, source identity and access at scale", "route": "#/iam/roles/role-chaining" }]
    },
    {
      "id": "compute-gl-visibility-timeout",
      "term": "Visibility timeout",
      "definition": "The period an SQS message stays hidden after a consumer receives it, before it becomes visible to other consumers again.",
      "useIt": "Duplicate processing with a 60-second Lambda and a 30-second visibility timeout is the timeout, not a bug in SQS.",
      "links": [{ "label": "API Gateway and event-driven integration", "route": "#/compute/serverless/event-driven" }]
    },
    {
      "id": "obs-gl-delegated-admin",
      "term": "Delegated administrator",
      "definition": "A member account authorized to administer an organization-wide service such as GuardDuty, Security Hub or Config aggregation.",
      "useIt": "Make the security tooling account the delegated admin so day-to-day security work never happens in the management account.",
      "links": [{ "label": "Multi-account security monitoring", "route": "#/obs/native/security-monitoring" }]
    },
    {
      "id": "found-gl-7rs",
      "term": "The 7 Rs",
      "definition": "Retire, retain, rehost, relocate, repurchase, replatform and refactor: the per-application strategies in a migration.",
      "useIt": "Assign an R to each application group during mobilization, then build waves from dependency mapping.",
      "links": [{ "label": "Migration strategies: the 7 Rs", "route": "#/found/landing/migration-7rs" }]
    }
  ]
};
