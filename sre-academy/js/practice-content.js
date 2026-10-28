/* Beacon practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS (found, slo, otel, tools, alert,
   inc, perf, chaos, data) or to #/simulator. */
window.BeaconPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#facc15",
      icon: "map",
      summary: "Outlines you can talk through end to end for the SRE design and incident problems that come up most."
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
      summary: "The dimensions an SRE or observability round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fb923c",
      icon: "md",
      summary: "Budget maths, burn-rate thresholds, PromQL patterns and incident checklists worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#a78bfa",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "slo-from-scratch",
      title: "Define SLOs for a service that has none",
      subtitle: "The classic SRE design prompt: from vague 'it should be reliable' to SLIs, targets, alerts and a policy.",
      timebox: "40 min",
      prompt: "A checkout API serves web and mobile clients. Leadership says it must be 'highly available'. Propose SLIs, SLOs, alerting and an error budget policy.",
      related: [
        { label: "Choosing SLIs", route: "#/slo/sli/sli-menu" },
        { label: "Setting the SLO", route: "#/slo/budgets/slo-setting" },
        { label: "Burn-rate alerts", route: "#/slo/budgets/burn-rate" },
        { label: "Budget policy", route: "#/slo/budgets/budget-policy" }
      ],
      outline: [
        {
          title: "Start from user journeys",
          items: [
            "Name the critical journeys (browse, add to cart, pay) and what failure means to a user in each.",
            "Pick where to measure: load balancer logs for coverage, client telemetry for truth, synthetics for low-traffic paths."
          ]
        },
        {
          title: "Write SLIs as good / valid ratios",
          items: [
            "Availability: non-5xx responses / valid requests (exclude client 4xx you cannot fix).",
            "Latency: requests faster than a threshold / valid requests, using histogram buckets rather than averages."
          ]
        },
        {
          title: "Choose targets from data, not hope",
          items: [
            "Look at the last 30\u201390 days, set the SLO slightly below what users already get, and tighten later.",
            "Translate the target into minutes: 99.9% over 30 days is about 43 minutes of full outage."
          ]
        },
        {
          title: "Alert on budget burn",
          items: [
            "Page on fast burn (14.4x over 1h and 5m), ticket on slow burn (around 1x\u20133x over days).",
            "Keep cause alerts (CPU, disk) as dashboards or tickets unless they predict user pain."
          ]
        },
        {
          title: "Agree the policy before you need it",
          items: [
            "Budget exhausted: freeze risky launches, prioritise reliability work, review in the weekly ops meeting.",
            "Name who can grant an exception and how it is recorded."
          ]
        }
      ]
    },
    {
      id: "observability-platform",
      title: "Design an observability platform for 200 services",
      subtitle: "Telemetry pipeline, storage, cost and adoption across many teams.",
      timebox: "45 min",
      prompt: "Your company runs 200 microservices with ad-hoc logging and three different metrics tools. Design a unified observability platform.",
      related: [
        { label: "The three signals", route: "#/otel/signals/three-signals" },
        { label: "The Collector", route: "#/otel/pipeline/collector" },
        { label: "Sampling", route: "#/otel/pipeline/sampling" },
        { label: "Vendor platforms", route: "#/tools/logs-traces/vendor-platforms" }
      ],
      outline: [
        {
          title: "Standardise instrumentation",
          items: [
            "OpenTelemetry SDKs with shared resource attributes (service.name, deployment.environment, version).",
            "Structured JSON logs carrying trace_id and span_id so all three signals join up."
          ]
        },
        {
          title: "Route through Collectors",
          items: [
            "Agent per node for local batching and metadata; gateway tier for tail sampling, redaction and fan-out.",
            "Backends become swappable exporters rather than code changes."
          ]
        },
        {
          title: "Control cost deliberately",
          items: [
            "Cardinality budgets per team, dropping unbounded labels at the Collector.",
            "Tail-sample traces (keep errors and slow), tier log retention, use recording rules for heavy queries."
          ]
        },
        {
          title: "Drive adoption",
          items: [
            "Golden dashboards (RED/USE) and SLO templates generated per service.",
            "Measure success: share of services with SLOs, mean time to find the failing component."
          ]
        }
      ]
    },
    {
      id: "noisy-oncall",
      title: "Fix a burning-out on-call rotation",
      subtitle: "Too many pages, low trust in alerts, people leaving.",
      timebox: "30 min",
      prompt: "A five-person team gets 60 pages a week, most at night, and most need no action. Two engineers have asked to leave the rotation. What do you do?",
      related: [
        { label: "Symptom vs cause", route: "#/alert/alerting/symptom-vs-cause" },
        { label: "Alert quality", route: "#/alert/alerting/alert-quality" },
        { label: "On-call design", route: "#/alert/oncall/oncall-design" },
        { label: "Paging hygiene", route: "#/alert/oncall/paging-hygiene" }
      ],
      outline: [
        {
          title: "Measure first",
          items: [
            "Tag every page for a fortnight: actionable or not, user impact or not, time of day, resolution.",
            "Report pages per shift and precision; agree a target such as two incidents per shift at most."
          ]
        },
        {
          title: "Cut noise at the source",
          items: [
            "Delete or downgrade alerts nobody acted on; convert cause alerts to tickets.",
            "Replace threshold storms with SLO burn-rate pages; group and inhibit related alerts."
          ]
        },
        {
          title: "Make the rotation humane",
          items: [
            "Grow the rotation or share it across time zones; add a secondary; protect recovery time after night pages.",
            "Every page links a runbook; recurring pages become engineering work with an owner."
          ]
        }
      ]
    },
    {
      id: "major-incident",
      title: "Lead a major incident, then run the postmortem",
      subtitle: "From the first page to the action items, out loud.",
      timebox: "35 min",
      prompt: "Payments are failing for 30% of users after an unknown change. You are the first responder. Walk through the next two hours and the review that follows.",
      related: [
        { label: "Severity", route: "#/inc/response/severity" },
        { label: "Incident roles", route: "#/inc/response/ics-roles" },
        { label: "Mitigate first", route: "#/inc/response/mitigation-first" },
        { label: "Blameless postmortems", route: "#/inc/learning/blameless-postmortems" },
        { label: "Incident simulator", route: "#/simulator" }
      ],
      outline: [
        {
          title: "First fifteen minutes",
          items: [
            "Acknowledge, confirm user impact on the SLO dashboard, declare a SEV with a channel.",
            "Assign commander, comms lead and scribe; post the first status update with the next update time."
          ]
        },
        {
          title: "Mitigate before you diagnose",
          items: [
            "Check recent changes; prefer reversible moves: roll back, flag off, fail over, shed load.",
            "Verify recovery against the SLI, not the absence of new errors in one log."
          ]
        },
        {
          title: "Learn without blame",
          items: [
            "Timeline from the scribe, contributing factors rather than one root cause, what went well, where you got lucky.",
            "Action items that change the system, each with an owner, priority and due date."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "slo-design-30",
      title: "SLOs and error budgets in 30 minutes",
      timebox: "30 min",
      prompt: "Define an SLO for a public API and explain how you would alert on it and what happens when the budget runs out.",
      expected: [
        "Writes SLIs as good-over-valid ratios measured close to the user.",
        "Converts the target into an error budget in minutes and explains burn rate.",
        "Uses multiwindow burn-rate alerts instead of static thresholds.",
        "Describes a budget policy agreed with product, not imposed by SRE."
      ],
      followups: [
        "Why not 99.99%?",
        "Your SLO is met but customers are complaining. What is wrong?",
        "How do you handle a dependency that has a lower SLO than yours?"
      ],
      links: [
        { label: "Error budgets", route: "#/slo/budgets/error-budgets" },
        { label: "Burn-rate alerts", route: "#/slo/budgets/burn-rate" }
      ]
    },
    {
      id: "debug-latency-25",
      title: "Debug a latency regression in 25 minutes",
      timebox: "25 min",
      prompt: "p99 latency doubled overnight while averages barely moved. Walk through how you find the cause using metrics, traces and logs.",
      expected: [
        "Explains why averages hide tail latency and uses histograms.",
        "Slices by version, region, endpoint and dependency to localise the change.",
        "Uses exemplars or trace search to jump from the metric to slow traces.",
        "Mentions queueing and saturation as common hidden causes."
      ],
      followups: [
        "Your traces are sampled at 1%. Is that a problem here?",
        "The slow span is a database call. What next?",
        "How would you prevent this regression shipping again?"
      ],
      links: [
        { label: "Percentiles", route: "#/slo/sli/percentiles" },
        { label: "Traces and spans", route: "#/otel/signals/traces-spans" },
        { label: "Tail latency", route: "#/perf/theory/tail-latency" }
      ]
    },
    {
      id: "capacity-20",
      title: "Capacity estimate in 20 minutes",
      timebox: "20 min",
      prompt: "A service must handle 3,000 requests per second at peak with 120 ms mean latency. How many instances do you need, and how do you validate it?",
      expected: [
        "Applies Little's law: about 360 requests in flight on average.",
        "Keeps utilisation below the queueing knee and adds N+1 or zone headroom.",
        "Validates with a load test whose workload model matches production.",
        "Ties pass/fail criteria to the SLO, not to raw throughput."
      ],
      followups: [
        "Traffic grows 8% a month. When do you need more capacity?",
        "Your load test passed but production fell over. Name three reasons.",
        "What is coordinated omission?"
      ],
      links: [
        { label: "Little's law", route: "#/perf/theory/littles-law" },
        { label: "Capacity planning", route: "#/perf/theory/capacity-planning" },
        { label: "Load-test design", route: "#/perf/testing/test-design" }
      ]
    },
    {
      id: "resilience-30",
      title: "Resilience patterns in 30 minutes",
      timebox: "30 min",
      prompt: "A downstream dependency becomes slow and your service falls over with it. Redesign the integration so it degrades gracefully.",
      expected: [
        "Sets timeouts from a latency budget instead of defaults.",
        "Retries with backoff, jitter and a budget, at one layer only, and only for idempotent calls.",
        "Adds a circuit breaker and bulkhead, plus a fallback or degraded mode.",
        "Proposes a chaos experiment or game day to prove it works."
      ],
      followups: [
        "How do you choose the breaker threshold?",
        "What is a retry storm and how does it start?",
        "How do you test this safely in production?"
      ],
      links: [
        { label: "Timeouts and retries", route: "#/chaos/patterns/timeouts-retries" },
        { label: "Circuit breakers", route: "#/chaos/patterns/circuit-breakers" },
        { label: "Game days", route: "#/chaos/experiments/game-days" }
      ]
    },
    {
      id: "data-reliability-25",
      title: "Data pipeline reliability in 25 minutes",
      timebox: "25 min",
      prompt: "The revenue dashboard showed wrong numbers for two days and nobody noticed. How would you make this detectable and recoverable?",
      expected: [
        "Defines freshness, volume, schema and quality checks with owners.",
        "Sets a data SLO for the dashboard and alerts on its breach.",
        "Uses lineage to find impact and the upstream cause.",
        "Describes quarantine, idempotent backfill and consumer communication."
      ],
      followups: [
        "How do you avoid alert fatigue from hundreds of data checks?",
        "A producer team renamed a column. How should that have been caught?",
        "What would you report weekly to the data consumers?"
      ],
      links: [
        { label: "Freshness and volume", route: "#/data/signals/freshness-volume" },
        { label: "Lineage and impact", route: "#/data/operate/lineage-impact" },
        { label: "Data SLO capstone", route: "#/data/operate/data-slo-capstone" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Reliability targets \u2014 SLIs, SLOs and budgets grounded in users",
      "Observability depth \u2014 the right signal for the question, and its cost",
      "Alerting and on-call \u2014 actionable pages and sustainable rotations",
      "Incident leadership \u2014 roles, communication and mitigation first",
      "Capacity and resilience \u2014 numbers, headroom and failure handling",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Names tools and wants 'five nines' but cannot turn reliability into numbers or decisions.",
        signals: [
          "Targets 100% or picks an SLO without data.",
          "Alerts on CPU and memory thresholds rather than user symptoms.",
          "Starts debugging during an outage before stopping the impact.",
          "Uses averages for latency."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Defines sensible SLOs and alerts and runs an orderly incident, but cost, scale and learning loops are thin.",
        signals: [
          "Writes SLIs as ratios and converts targets into minutes of budget.",
          "Uses percentiles and knows the three signals.",
          "Assigns incident roles and posts updates.",
          "Mentions postmortems but action items lack owners."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Connects SLOs, alerting, incidents and capacity into one system and reasons about cost and people.",
        signals: [
          "Uses multiwindow burn-rate alerts and an agreed budget policy.",
          "Budgets cardinality and sampling deliberately; routes telemetry through Collectors.",
          "Applies Little's law and queueing to capacity, and retry budgets to resilience.",
          "Tracks on-call load and postmortem follow-through, not just MTTR."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "budget-maths",
      title: "Error budget maths (30-day window)",
      summary: "Allowed full-outage time per SLO target.",
      items: [
        "99% \u2192 7.2 hours",
        "99.5% \u2192 3.6 hours",
        "99.9% \u2192 43.2 minutes",
        "99.95% \u2192 21.6 minutes",
        "99.99% \u2192 4.3 minutes",
        "Budget = (1 \u2212 SLO) \u00d7 window; burn rate = observed error ratio \u00f7 (1 \u2212 SLO)."
      ]
    },
    {
      id: "burn-rate-table",
      title: "Multiwindow burn-rate starting points",
      summary: "For a 30-day SLO. Tune to your traffic.",
      items: [
        "Page: 14.4x over 1h AND 5m \u2014 2% of budget gone in an hour.",
        "Page: 6x over 6h AND 30m \u2014 5% of budget gone in six hours.",
        "Ticket: 3x over 1d AND 2h \u2014 10% of budget gone in a day.",
        "Ticket: 1x over 3d AND 6h \u2014 on track to exhaust the budget.",
        "The short window lets the alert reset quickly once you mitigate."
      ]
    },
    {
      id: "promql-patterns",
      title: "PromQL patterns",
      summary: "The handful of queries behind most dashboards and alerts.",
      items: [
        "Request rate: sum by (service) (rate(http_requests_total[5m]))",
        "Error ratio: sum(rate(http_requests_total{code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))",
        "p99: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
        "Target down: up == 0",
        "Missing series: absent(up{job=\"checkout\"})"
      ]
    },
    {
      id: "incident-checklist",
      title: "Incident first-15-minutes checklist",
      summary: "Do these in order, out loud.",
      items: [
        "1. Acknowledge the page and confirm user impact on the SLO dashboard.",
        "2. Declare a severity and open the incident channel.",
        "3. Assign commander, comms lead and scribe.",
        "4. Check what changed: deploys, flags, config, traffic, dependencies.",
        "5. Apply the safest reversible mitigation; verify against the SLI.",
        "6. Post a status update with the next update time."
      ]
    },
    {
      id: "capacity-formulas",
      title: "Capacity formulas",
      summary: "Back-of-envelope numbers that survive an interview.",
      items: [
        "Little's law: L = \u03bb \u00d7 W (in-flight = rate \u00d7 latency).",
        "M/M/1 response time: S \u00f7 (1 \u2212 \u03c1) \u2014 at 90% utilisation, 10\u00d7 the service time.",
        "Fan-out tail: P(slow) = 1 \u2212 (1 \u2212 p)^N.",
        "Retry amplification: (retries + 1)^layers.",
        "Headroom: survive losing the largest zone at peak inside the SLO."
      ]
    }
  ],

  glossary: [
    {
      id: "sli",
      term: "SLI",
      definition: "A service level indicator: the ratio of good events to valid events for something users care about.",
      useIt: "Say where it is measured and what counts as good, e.g. 'non-5xx responses under 300 ms at the load balancer'.",
      links: [{ label: "SLI basics", route: "#/slo/sli/sli-basics" }]
    },
    {
      id: "slo",
      term: "SLO",
      definition: "A target for an SLI over a time window, such as 99.9% over 30 days.",
      useIt: "Always pair the number with its window and the error budget it implies.",
      links: [{ label: "Setting the SLO", route: "#/slo/budgets/slo-setting" }]
    },
    {
      id: "error-budget",
      term: "Error budget",
      definition: "The amount of unreliability an SLO allows: one minus the target, over the window.",
      useIt: "Use it to make release decisions: budget left means ship; budget gone means the policy applies.",
      links: [{ label: "Error budgets", route: "#/slo/budgets/error-budgets" }]
    },
    {
      id: "burn-rate",
      term: "Burn rate",
      definition: "How fast the budget is being consumed relative to spending it evenly over the window.",
      useIt: "Quote thresholds with windows: '14.4x over one hour and five minutes pages'.",
      links: [{ label: "Burn-rate alerts", route: "#/slo/budgets/burn-rate" }]
    },
    {
      id: "toil",
      term: "Toil",
      definition: "Manual, repetitive, automatable operational work with no enduring value that grows with the service.",
      useIt: "Quantify it and cap it, then show the automation that removed it.",
      links: [{ label: "Toil", route: "#/found/practice/toil" }]
    },
    {
      id: "trace-context",
      term: "Trace context",
      definition: "The trace id, span id and sampling flag passed between services (the W3C traceparent header) so spans join into one trace.",
      useIt: "Mention that async hops (queues) must carry it explicitly in message headers.",
      links: [{ label: "Context propagation", route: "#/otel/pipeline/context-propagation" }]
    },
    {
      id: "tail-sampling",
      term: "Tail sampling",
      definition: "Deciding which traces to keep after they complete, so every error and slow trace can be retained.",
      useIt: "Contrast with head sampling and say it needs a gateway Collector that sees whole traces.",
      links: [{ label: "Sampling", route: "#/otel/pipeline/sampling" }]
    },
    {
      id: "cardinality",
      term: "Cardinality",
      definition: "The number of distinct time series a metric produces: the product of its label value counts.",
      useIt: "Name the unbounded label you would drop and where (SDK views or the Collector).",
      links: [{ label: "Cardinality", route: "#/otel/pipeline/cardinality" }]
    },
    {
      id: "recording-rule",
      term: "Recording rule",
      definition: "A PromQL expression evaluated on a schedule and stored as a new series.",
      useIt: "Use it for SLO ratios and heavy dashboard queries so alerts stay cheap and consistent.",
      links: [{ label: "Recording rules", route: "#/tools/metrics/recording-rules" }]
    },
    {
      id: "symptom-alert",
      term: "Symptom-based alerting",
      definition: "Paging on what users experience rather than on internal causes.",
      useIt: "Say which cause alerts you would keep as tickets or dashboards and why.",
      links: [{ label: "Symptom vs cause", route: "#/alert/alerting/symptom-vs-cause" }]
    },
    {
      id: "incident-commander",
      term: "Incident commander",
      definition: "The person who coordinates an incident, delegates work and makes decisions, without debugging themselves.",
      useIt: "Explain the hand-off: who takes command and how it is announced.",
      links: [{ label: "Incident roles", route: "#/inc/response/ics-roles" }]
    },
    {
      id: "blameless",
      term: "Blameless postmortem",
      definition: "A review that asks how the system allowed the failure, assuming people made reasonable choices with the information they had.",
      useIt: "Show it by naming contributing factors and system changes, not people to retrain.",
      links: [{ label: "Blameless postmortems", route: "#/inc/learning/blameless-postmortems" }]
    },
    {
      id: "littles-law",
      term: "Little's law",
      definition: "Average items in a system equal arrival rate times average time in the system (L = \u03bbW).",
      useIt: "Use it to size concurrency, connection pools and worker counts in seconds.",
      links: [{ label: "Little's law", route: "#/perf/theory/littles-law" }]
    },
    {
      id: "circuit-breaker",
      term: "Circuit breaker",
      definition: "A client-side guard that stops calling a failing dependency and probes it after a cooldown.",
      useIt: "Pair it with a fallback and say what the user sees while it is open.",
      links: [{ label: "Circuit breakers", route: "#/chaos/patterns/circuit-breakers" }]
    },
    {
      id: "rto-rpo",
      term: "RTO and RPO",
      definition: "Recovery time objective (how long you can be down) and recovery point objective (how much data you can lose).",
      useIt: "Tie each to a DR strategy and its cost, and prove them with drills.",
      links: [{ label: "DR drills", route: "#/chaos/experiments/dr-drills" }]
    },
    {
      id: "data-freshness",
      term: "Data freshness",
      definition: "How old the newest data in a table or dashboard is, compared with an agreed objective.",
      useIt: "State it as an SLO with an owner and an alert, not as a hope.",
      links: [{ label: "Freshness and volume", route: "#/data/signals/freshness-volume" }]
    }
  ]
};
