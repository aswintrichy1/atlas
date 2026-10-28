/* Orbit practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.plat / sec / flow / apex / lwc /
   int / qa / ops / crma. */
window.OrbitPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#2dd4bf",
      icon: "map",
      summary: "Outlines you can talk through end to end for the Salesforce design and incident problems that come up most."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#60a5fa",
      icon: "quiz",
      summary: "Timed prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#4ade80",
      icon: "star",
      summary: "The dimensions a Salesforce developer or architect round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Limits, execution order, CLI commands and checklists worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#818cf8",
      icon: "lesson",
      summary: "The platform terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "partner-portal-sharing",
      title: "Design a partner-portal sharing model",
      subtitle: "A record-access design prompt: external users, a Private object, and nobody seeing a competitor's deals.",
      timebox: "40 min",
      prompt: "Resellers log in to an Experience Cloud partner portal to register deals on a custom Deal_Registration__c object with a Private org-wide default. Each partner company must see only its own registrations; partner managers see their team's; internal channel managers see every registration for the partners they own. Design the access model.",
      related: [
        { label: "Org-wide defaults", route: "#/sec/records/owd" },
        { label: "Sharing rules, teams and manual sharing", route: "#/sec/records/sharing-rules" },
        { label: "Apex managed sharing", route: "#/sec/records/apex-managed-sharing" },
        { label: "Role hierarchy", route: "#/sec/records/role-hierarchy" }
      ],
      outline: [
        {
          title: "Clarify the access matrix first",
          items: [
            "List the personas: partner user, partner manager, internal channel manager, admin. For each, ask read or edit, and on which records.",
            "Confirm volumes (partner accounts, users per partner, registrations per year) because they decide whether sharing recalculation is a risk.",
            "Ask whether any field (margin, internal notes) must be hidden from partners even on records they can see — that is FLS, not sharing."
          ]
        },
        {
          title: "Set the baseline",
          items: [
            "Keep the internal OWD Private and set the external OWD Private too; external defaults can never be more open than internal ones.",
            "Object CRUD and FLS come from a partner permission set group, not from cloning profiles.",
            "Hide internal-only fields with FLS in the partner permission set rather than relying on page layouts."
          ]
        },
        {
          title: "Open access with the cheapest mechanism that fits",
          items: [
            "Partner roles (user, manager, executive) give upward visibility inside one partner account automatically through the external role hierarchy.",
            "Internal channel managers: criteria- or owner-based sharing rules if ownership maps cleanly; account teams or Apex managed sharing if access follows a dynamic assignment.",
            "Use sharing sets only for high-volume community licences that lack roles; know that they grant access through account or contact lookups, not the hierarchy."
          ]
        },
        {
          title: "Programmatic sharing where rules cannot express it",
          items: [
            "Apex managed sharing with a custom row cause so shares survive owner changes and are recalculated by a recalculation batch class.",
            "Write share rows in bulk from a service class, with the business key resolved by query, never a hardcoded Id.",
            "Controllers serving the portal use with sharing and WITH USER_MODE so the portal can never return more than the model allows."
          ]
        },
        {
          title: "Verify and operate",
          items: [
            "Tests run as a partner user via System.runAs and assert both that they see their own registrations and that they cannot see another partner's.",
            "Watch for ownership skew (one integration user owning hundreds of thousands of records) and group-membership recalculation during partner onboarding.",
            "Close with the trade-off: sharing rules are declarative and auditable; Apex sharing is flexible but needs a recalculation story."
          ]
        }
      ]
    },
    {
      id: "competing-automations",
      title: "Untangle three competing automations on one object",
      subtitle: "A trigger-architecture prompt: a legacy trigger, a record-triggered flow and a managed package all fire on Opportunity.",
      timebox: "35 min",
      prompt: "Opportunity has a 600-line trigger written by three teams, a before-save flow that sets fields, an after-save flow that creates tasks, and a managed package trigger. Data loads of 10,000 records fail with CPU timeouts and occasional duplicate tasks. Propose a target architecture and a migration path.",
      related: [
        { label: "Trigger design and handler frameworks", route: "#/apex/bulk/triggers" },
        { label: "Recursion and automation conflicts", route: "#/flow/engine/recursion" },
        { label: "Save order of execution", route: "#/flow/engine/order-of-execution" },
        { label: "Flow vs Apex", route: "#/flow/choose/flow-vs-apex" }
      ],
      outline: [
        {
          title: "Map what fires today",
          items: [
            "Inventory every automation on the object and place it on the save order: before-save flow, before trigger, validation, after trigger, after-save flow.",
            "Debug-log one 200-record chunk and count SOQL, DML and CPU per automation to find the real cost.",
            "Find the duplicate-task cause: usually an after-save update re-entering the trigger and the flow both creating tasks."
          ]
        },
        {
          title: "Target shape: one trigger, layered",
          items: [
            "One logic-free trigger per object delegating to a handler; the handler routes by context to service methods.",
            "Services hold business rules; a selector class owns all SOQL; DML is collected and issued once per unit of work.",
            "A Custom Metadata bypass switch per handler for data loads and incidents, instead of commenting code out."
          ]
        },
        {
          title: "Decide what stays declarative",
          items: [
            "Same-record field updates belong in before-save flows or the before trigger — never both for the same field.",
            "Keep admin-owned, low-volume side effects (notifications via Flow) in flows; move cross-object, high-volume logic to Apex.",
            "Treat the managed package as fixed: you cannot order it, so make your code idempotent around it."
          ]
        },
        {
          title: "Recursion and idempotency",
          items: [
            "Guard re-entry by tracking processed record Ids per context in a static set, not a single static boolean that skips later chunks.",
            "Make task creation idempotent: check for an existing task keyed on a business value before inserting.",
            "Compare old and new values so logic only runs when the fields it cares about actually changed."
          ]
        },
        {
          title: "Migrate safely",
          items: [
            "Characterisation tests first: bulk tests with 200 records that assert today's outcomes, so refactoring cannot change behaviour silently.",
            "Move one concern at a time behind the bypass switch; validate in a full-copy sandbox with production-like volumes.",
            "Gate merges with sf code-analyzer and the 90/85 coverage bar on new and modified classes."
          ]
        }
      ]
    },
    {
      id: "order-integration",
      title: "Integrate an external order system",
      subtitle: "An integration prompt: real-time status updates plus a nightly reconciliation that must never double-count.",
      timebox: "40 min",
      prompt: "An ERP owns orders. Sales reps need order status on the Account page within a minute of change, and Finance needs a nightly reconciliation of the full day's orders (about 400,000 lines) into Salesforce. Salesforce must also push newly closed-won opportunities to the ERP. Design the integration.",
      related: [
        { label: "CDC and events for integration", route: "#/int/events/cdc-events" },
        { label: "Middleware and integration patterns", route: "#/int/events/middleware" },
        { label: "Bulk API 2.0", route: "#/int/apis/bulk-api" },
        { label: "Named and external credentials", route: "#/int/outbound/named-credentials" },
        { label: "Apex callouts, timeouts and retries", route: "#/int/outbound/callouts" }
      ],
      outline: [
        {
          title: "Pick a pattern per flow",
          items: [
            "ERP to Salesforce status (near real time): middleware calls the REST API with upserts on an external Id field — no Salesforce Ids leave the org.",
            "Nightly reconciliation (bulk): Bulk API 2.0 upsert jobs from middleware; compare control totals afterwards.",
            "Salesforce to ERP (fire and forget): publish a platform event or rely on Change Data Capture, and let middleware subscribe and call the ERP."
          ]
        },
        {
          title: "Avoid synchronous callouts in the save path",
          items: [
            "Callouts cannot run after uncommitted DML in the same transaction; do them from a Queueable with Database.AllowsCallouts if Apex must call out.",
            "Respect 100 callouts and 120 seconds of total callout time per transaction; set explicit per-request timeouts.",
            "Use a Named Credential with an External Credential so endpoints and secrets never live in code: callout:ERP_API/orders."
          ]
        },
        {
          title: "Idempotency and ordering",
          items: [
            "Upsert on an external Id so replays are harmless; carry a source version or timestamp and ignore older updates.",
            "Use event replay ids (or CDC) so a subscriber that was down can resume without gaps.",
            "Dead-letter failed records in middleware with the error, rather than retrying forever."
          ]
        },
        {
          title: "Reconciliation and limits",
          items: [
            "Bulk API jobs process in batches server-side; avoid parent-record lock contention by sorting child rows by parent.",
            "Bypass non-essential automation for the integration user via Custom Metadata or a custom permission, not by disabling triggers in production.",
            "Publish a reconciliation summary record (counts in, counts upserted, counts failed) Finance can report on."
          ]
        },
        {
          title: "Security and operations",
          items: [
            "A dedicated integration user with an API-only permission set and minimum object access.",
            "Monitor API usage against the rolling 24-hour allocation and alert on job failures.",
            "State the trade-off: point-to-point Apex callouts are quick to build but couple systems; middleware adds cost but owns retries and mapping."
          ]
        }
      ]
    },
    {
      id: "legacy-migration",
      title: "Migrate 20 million legacy records",
      subtitle: "A large-data-volume prompt: load order, locking, automation and a cut-over you can roll back.",
      timebox: "35 min",
      prompt: "A company is retiring a legacy CRM with 2 million accounts, 6 million contacts and 12 million activity-style records. The business allows one weekend of downtime. Plan the migration into Salesforce.",
      related: [
        { label: "Bulk API 2.0 and large data volumes", route: "#/int/apis/bulk-api" },
        { label: "Relationships", route: "#/plat/data/relationships" },
        { label: "Sandbox types and refresh strategy", route: "#/plat/envs/sandboxes" },
        { label: "Batch Apex in depth", route: "#/apex/async/batch" }
      ],
      outline: [
        {
          title: "Model and map before moving anything",
          items: [
            "Add an indexed external Id on every target object holding the legacy key; it drives upserts and parent lookups.",
            "Decide what not to migrate: archive old activities to an external store or Big Objects instead of loading everything.",
            "Agree data-quality rules (dedupe, required fields, picklist mapping) and run them in the staging layer, not in Salesforce."
          ]
        },
        {
          title: "Load order and relationships",
          items: [
            "Users and reference data first, then accounts, then contacts, then child records — parents before children.",
            "Resolve lookups by external Id in the load file so you never have to look up Salesforce Ids yourself.",
            "Avoid data skew: spread record ownership across several users and avoid more than about 10,000 children under one parent."
          ]
        },
        {
          title: "Make the org load-friendly",
          items: [
            "Bypass triggers, flows and validation for the migration user with a custom permission checked by the automation, then re-enable.",
            "Defer sharing calculation where available and consider a Public Read/Write default only during load, then restore it before go-live.",
            "Use Bulk API 2.0 with parallel jobs per object; sort child rows by parent Id to reduce lock contention."
          ]
        },
        {
          title: "Rehearse",
          items: [
            "At least two full dress rehearsals in a full-copy sandbox with production volumes, timing each step.",
            "Reconcile counts and checksums per object after each run; keep failed-row files and reload them.",
            "Run post-load jobs (roll-ups, derived fields) as batch Apex with a start() query filtered on the field it fills."
          ]
        },
        {
          title: "Cut over and roll back",
          items: [
            "Freeze the legacy system, run the delta load, reconcile, re-enable automation, then open access.",
            "Define go/no-go criteria up front and a rollback (keep legacy read-only for a period).",
            "Trade-off to say out loud: bypassing automation is faster but you must replay its side effects deliberately."
          ]
        }
      ]
    },
    {
      id: "three-team-cicd",
      title: "CI/CD and environment strategy for three teams",
      subtitle: "A DevOps prompt: shared org, three teams, weekly releases, and no more change-set Fridays.",
      timebox: "35 min",
      prompt: "Three teams (Sales Cloud customisation, a partner portal, and an integration team) work in one production org using change sets. Releases collide, sandboxes drift, and a hotfix last month overwrote another team's work. Design the source control, environment and pipeline strategy.",
      related: [
        { label: "Environment strategy", route: "#/plat/envs/env-strategy" },
        { label: "CI/CD pipelines for Salesforce", route: "#/ops/release/cicd" },
        { label: "Unlocked packages", route: "#/ops/release/unlocked-packages" },
        { label: "Validate, quick deploy and test levels", route: "#/ops/release/deploy-validation" },
        { label: "PMD, Code Analyzer and SonarQube", route: "#/qa/static/pmd-sonar" }
      ],
      outline: [
        {
          title: "Source of truth",
          items: [
            "Move to source-driven development: one repository in Salesforce DX format, main branch mirrors production.",
            "Short-lived feature branches; pull requests with required review and CODEOWNERS per package directory.",
            "Decide the unit of release: org-based deploys to start, unlocked packages per team once boundaries are clean."
          ]
        },
        {
          title: "Environments",
          items: [
            "Developers work in scratch orgs or developer sandboxes; each team has an integration sandbox.",
            "A shared partial-copy or full-copy UAT sandbox for cross-team testing; a full-copy staging sandbox for performance and release rehearsal.",
            "Refresh cadence aligned to releases, with post-refresh scripts to mask data and reset integrations."
          ]
        },
        {
          title: "Pipeline gates",
          items: [
            "On pull request: sf code-analyzer run with zero suppressions, Apex tests in a scratch org, LWC Jest, SonarQube quality gate.",
            "Coverage bar: the platform needs 75% org-wide to deploy, but the house gate is 90% per new class and 85% per modified class.",
            "Authenticate CI with JWT using a key file from the CI secret store and an org alias — never stored passwords."
          ]
        },
        {
          title: "Release mechanics",
          items: [
            "Validate against production early with sf project deploy validate and RunSpecifiedTests, then sf project deploy quick with the job id in the window.",
            "Hotfix branch from main, deployed through the same pipeline, then merged back so no team's work is overwritten.",
            "Destructive changes in their own reviewed manifest."
          ]
        },
        {
          title: "Adoption",
          items: [
            "Start by retrieving production into the repo as the baseline; ban change sets once the pipeline is trusted.",
            "Measure lead time, deploy frequency, failed deploys and rollback time.",
            "Trade-off: packages give clear ownership and versioning but demand dependency discipline; org deploys are simpler but couple teams."
          ]
        }
      ]
    },
    {
      id: "soql-101-incident",
      title: "Diagnose 'Too many SOQL queries: 101' in production",
      subtitle: "An incident prompt: a data load starts failing after Tuesday's release.",
      timebox: "30 min",
      prompt: "After a release, the nightly integration that upserts 5,000 Cases fails with System.LimitException: Too many SOQL queries: 101. Users editing single Cases are fine. Walk through diagnosis, the immediate fix and prevention.",
      related: [
        { label: "Bulkification patterns", route: "#/apex/bulk/bulkification" },
        { label: "Governor-limit patterns", route: "#/apex/bulk/limits-patterns" },
        { label: "Governor limits", route: "#/plat/data/limits-intro" },
        { label: "Bulk-safe flows and fault paths", route: "#/flow/flows/flow-bulk" }
      ],
      outline: [
        {
          title: "Read the symptom",
          items: [
            "Single edits pass and bulk fails: a query is running per record, so 200 records in a trigger chunk blow through 100 queries.",
            "The limit is per transaction and shared by every trigger, flow and package that fires in it — the new code may only be the last straw.",
            "It cannot be caught: a LimitException ends the transaction, so the whole chunk rolls back."
          ]
        },
        {
          title: "Find the loop",
          items: [
            "Reproduce in a sandbox with a 200-record bulk test, and capture a debug log with Apex profiling enabled.",
            "Look for repeated SOQL lines with identical shape; trace them to a query inside a for loop, or a helper method called per record.",
            "Check flows too: a Get Records element inside a loop or a subflow per record has the same effect."
          ]
        },
        {
          title: "Fix it properly",
          items: [
            "Accumulate the keys into a Set, run one selector query, build a Map, then process the records using the map.",
            "Move the query into the selector class with WITH USER_MODE and bind variables.",
            "If logic is heavy, hand the rest to a Queueable rather than raising limits by splitting the load into smaller batches."
          ]
        },
        {
          title: "Restore service",
          items: [
            "Short term: if the change cannot be fixed at once, roll back the release through the pipeline or use the handler's Custom Metadata bypass, then rerun the load.",
            "Do not shrink the integration batch size as the permanent fix; it hides the defect."
          ]
        },
        {
          title: "Prevent recurrence",
          items: [
            "Mandatory 200-record bulk tests that assert outcomes and use Limits.getQueries() to guard query budgets.",
            "Code-analyzer rules for SOQL and DML in loops as a blocking gate.",
            "Blameless review: why did tests not catch it, and which automation shares the transaction budget."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "bulk-trigger-30",
      title: "Bulk-safe trigger design in 30 minutes",
      timebox: "30 min",
      prompt: "Write and explain a trigger that, when an Opportunity closes as won, updates a Total_Won__c field on its Account. Then explain how it behaves for a 10,000-record data load.",
      expected: [
        "Keeps the trigger logic-free and delegates to a handler and service.",
        "Collects Account Ids into a Set, queries once, aggregates in a Map and issues one DML statement.",
        "Only acts when StageName changed to won by comparing Trigger.oldMap.",
        "Explains that triggers run in chunks of 200, so a 10,000-row load is 50 chunks sharing nothing but the transaction's limits per chunk.",
        "Mentions a 200-record bulk test with Assert messages and a recursion guard keyed by record Id."
      ],
      followups: [
        "Two Opportunities on the same Account close in different chunks. Is your total still right?",
        "Why not use a roll-up summary field here? When can you not?",
        "How would you stop this trigger during a migration without a deploy?"
      ],
      links: [
        { label: "Bulkification patterns", route: "#/apex/bulk/bulkification" },
        { label: "Trigger design and handler frameworks", route: "#/apex/bulk/triggers" }
      ]
    },
    {
      id: "sharing-model-25",
      title: "Record access explained in 25 minutes",
      timebox: "25 min",
      prompt: "A user says they can see a record their manager says they should not. Explain every way Salesforce could be granting that access, and how you would find which one.",
      expected: [
        "Separates object and field access (profile, permission sets, FLS) from record access.",
        "Walks the record layers: OWD, role hierarchy, sharing rules, teams, manual and Apex managed sharing.",
        "Remembers the bypasses: View All, Modify All, View All Data and Modify All Data.",
        "Uses the Sharing button or share-object queries to find the granting row cause.",
        "Notes that Apex running without sharing or in system mode can show data the model does not grant."
      ],
      followups: [
        "The OWD is Public Read Only. What changes in your answer?",
        "How do restriction rules differ from sharing rules?",
        "How do you prove in a test that a user cannot see a record?"
      ],
      links: [
        { label: "The access layers", route: "#/sec/access/layers" },
        { label: "Org-wide defaults", route: "#/sec/records/owd" },
        { label: "with, without and inherited sharing", route: "#/sec/code/sharing-keywords" }
      ]
    },
    {
      id: "async-choice-20",
      title: "Choosing async Apex in 20 minutes",
      timebox: "20 min",
      prompt: "You need to recalculate a score on 3 million Contacts every night, call a pricing API after an Order is created, and notify an external system when a Case closes. Which asynchronous tool do you use for each, and why?",
      expected: [
        "Nightly recalculation: Batch Apex, scheduled, with a start() query filtered on records needing recalculation.",
        "Pricing callout: Queueable with Database.AllowsCallouts, enqueued after the save; explains why @future is legacy.",
        "Case close notification: platform event or Change Data Capture consumed by middleware.",
        "Quotes the relevant limits: 50 queueable jobs per sync transaction and 1 from async, scope default 200 up to 2,000, 5 active batch jobs.",
        "Talks about failure handling: Transaction Finalizers, retries, and idempotent subscribers."
      ],
      followups: [
        "Your Queueable chain fails halfway. How do you know, and how do you resume?",
        "Why is Database.Stateful a cost, and when is it worth it?",
        "What happens if five other batch jobs are already running?"
      ],
      links: [
        { label: "Future, queueable, batch and schedulable", route: "#/apex/async/async-overview" },
        { label: "Batch Apex in depth", route: "#/apex/async/batch" },
        { label: "Platform events", route: "#/apex/async/platform-events" }
      ]
    },
    {
      id: "lwc-data-20",
      title: "LWC data access in 20 minutes",
      timebox: "20 min",
      prompt: "Build a component on the Account page that shows the account's open Cases and lets the user close one. Explain how it loads data, writes, and stays in sync with the rest of the page.",
      expected: [
        "Prefers Lightning Data Service and UI API adapters (getRelatedListRecords, updateRecord) before custom Apex.",
        "If Apex is needed: a cacheable=true method for the wired read and a separate non-cacheable method for the write.",
        "Refreshes with refreshApex or notifyRecordUpdateAvailable after the write.",
        "Controller is thin, with sharing, WITH USER_MODE, try/catch rethrowing AuraHandledException.",
        "Uses lwc:if in the template, SLDS styling hooks, and a Jest test with wire adapter mocks."
      ],
      followups: [
        "Why can a cacheable method not perform DML?",
        "Another component on the page edits the same Case. How does yours find out?",
        "How do you test the error state?"
      ],
      links: [
        { label: "Lightning Data Service", route: "#/lwc/data/lds" },
        { label: "Wire vs imperative Apex", route: "#/lwc/data/wire-vs-imperative" },
        { label: "LWC Jest testing", route: "#/qa/lwc-tests/lwc-jest" }
      ]
    },
    {
      id: "secure-apex-20",
      title: "Secure Apex review in 20 minutes",
      timebox: "20 min",
      prompt: "You are given an @AuraEnabled method that builds a dynamic SOQL string from a search term, runs without a sharing keyword, and updates the records it finds. Review it.",
      expected: [
        "Flags SOQL injection and fixes it with bind variables or Database.queryWithBinds.",
        "Adds with sharing and WITH USER_MODE on the read, AccessLevel.USER_MODE on the DML — never mixing user-mode reads with system-mode writes.",
        "Uses Security.stripInaccessible when partial access is acceptable.",
        "Gates the feature with a custom permission via FeatureManagement.checkPermission rather than querying permission set assignments.",
        "Wraps the controller in try/catch and throws AuraHandledException without leaking internals."
      ],
      followups: [
        "When would without sharing be justified, and how would you document it?",
        "Why can querying PermissionSetAssignment in user mode surprise you?",
        "What is the difference between WITH USER_MODE and WITH SECURITY_ENFORCED?"
      ],
      links: [
        { label: "User mode and secure SOQL", route: "#/sec/code/user-mode" },
        { label: "CRUD and field-level security", route: "#/sec/access/crud-fls" },
        { label: "Custom Apex REST and SOAP services", route: "#/int/apis/custom-apis" }
      ]
    },
    {
      id: "release-pipeline-25",
      title: "Salesforce release pipeline in 25 minutes",
      timebox: "25 min",
      prompt: "Describe how a change goes from a developer's laptop to production in a mature Salesforce team, including the gates and the commands you would run.",
      expected: [
        "Source-driven: repository in DX format, feature branch, scratch org or developer sandbox.",
        "Pull request gates: sf code-analyzer with zero suppressions, Apex tests, LWC Jest, SonarQube quality gate.",
        "States the 75% platform coverage minimum and the higher house bar of 90% new / 85% modified.",
        "Validates against production with RunSpecifiedTests, then quick deploys with the job id.",
        "Explains where unlocked packages fit and how hotfixes flow back into main."
      ],
      followups: [
        "Your validation passed Monday; can you quick deploy on Friday?",
        "A metadata-only change: do you still run tests in production?",
        "How does CI authenticate to production without storing a password?"
      ],
      links: [
        { label: "CI/CD pipelines", route: "#/ops/release/cicd" },
        { label: "Validate, quick deploy and test levels", route: "#/ops/release/deploy-validation" },
        { label: "The sf CLI essentials", route: "#/ops/dx/sf-cli" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Platform fluency — multi-tenancy, limits and the save order of execution",
      "Data and security model — objects, relationships, sharing and FLS",
      "Code quality — bulkification, layering, async choice and secure Apex",
      "Declarative judgement — when Flow is right and when Apex is",
      "Integration and delivery — APIs, events, testing and release pipeline",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Knows features by name but designs for one record at a time.",
        signals: [
          "Writes SOQL or DML inside loops and does not mention limits until asked.",
          "Answers access questions with profiles only.",
          "Reaches for @future or a trigger for everything.",
          "Treats 75% coverage as the goal and asserts nothing meaningful.",
          "Describes deployments as change sets with no source control."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Writes bulk-safe code and a sensible sharing model, but stops at the happy path.",
        signals: [
          "Uses the accumulate, query once, map, process pattern by default.",
          "Explains OWD, the role hierarchy and sharing rules in the right order.",
          "Uses a handler framework and Queueable, but recursion and failure handling are thin.",
          "Writes tests with test data factories but rarely runs them as a restricted user.",
          "Knows the sf CLI but not validation and quick deploy."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Designs for volume, security and change, and explains the trade-offs as they go.",
        signals: [
          "Places every automation on the save order and reasons about shared transaction limits.",
          "Defaults to with sharing and user mode, and justifies any exception.",
          "Picks Flow or Apex per requirement with a clear rule, and makes logic idempotent.",
          "Integrations use external Ids, named credentials and asynchronous patterns with retries.",
          "Pipeline includes code-analyzer, the 90/85 coverage bar and validate-then-quick-deploy."
        ]
      },
      {
        id: "expert",
        title: "Expert",
        summary: "Thinks in org-wide systems: ownership, data volume, recalculation cost and team scale.",
        signals: [
          "Anticipates data skew, sharing recalculation and lock contention before they bite.",
          "Designs package boundaries and an environment strategy that let teams ship independently.",
          "Quantifies limits and volumes to choose between real-time, event and bulk patterns.",
          "Sets standards others follow: bypass switches, selector layers, test and review gates.",
          "Explains a design to both an admin and an architect without losing either."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "governor-limits",
      title: "Governor limits per transaction",
      summary: "Synchronous / asynchronous where they differ. Check current release notes before quoting edge cases.",
      items: [
        "SOQL queries: 100 sync / 200 async. Rows retrieved: 50,000 total.",
        "DML statements: 150. Rows processed by DML: 10,000.",
        "CPU time: 10 seconds sync / 60 seconds async. Heap: 6 MB sync / 12 MB async.",
        "Callouts: 100 per transaction; 120 seconds total callout time (10 second default timeout per callout).",
        "SOSL: 20 queries, 2,000 rows per query.",
        "@future calls: 50 per transaction (legacy — prefer Queueable).",
        "Queueable enqueues: 50 from a synchronous transaction, 1 from an asynchronous one.",
        "Triggers receive records in chunks of 200.",
        "Batch Apex scope: default 200, maximum 2,000 per execute().",
        "Batch concurrency: 5 active or queued jobs, plus up to 100 holding in the flex queue."
      ]
    },
    {
      id: "order-of-execution",
      title: "Save order of execution (simplified)",
      summary: "What runs when a record is saved. Everything before commit rolls back together.",
      items: [
        "1. Load the record and apply new values; system validation (required fields, formats, lengths).",
        "2. Before-save record-triggered flows.",
        "3. Before triggers.",
        "4. System validation again, then custom validation rules; duplicate rules.",
        "5. Record saved to the database (not yet committed).",
        "6. After triggers.",
        "7. Assignment, auto-response and legacy workflow rules (workflow field updates re-fire update triggers once).",
        "8. After-save record-triggered flows; entitlement and escalation processing.",
        "9. Roll-up summaries recalculate and the parent goes through its own save; sharing is evaluated.",
        "10. Commit, then post-commit work: emails sent, async jobs start, publish-after-commit events delivered."
      ]
    },
    {
      id: "sharing-layers",
      title: "Access layers, outside in",
      summary: "Object and field access decide what a user can do; record access decides which records.",
      items: [
        "Org level: login hours, IP ranges, session security, MFA.",
        "Object level (CRUD): profile plus permission sets and permission set groups.",
        "Field level (FLS): permission sets; page layouts only hide, they do not secure.",
        "Record baseline: org-wide default — Private, Public Read Only, Public Read/Write, Controlled by Parent.",
        "Opening up: role hierarchy, owner- and criteria-based sharing rules, teams, manual sharing, Apex managed sharing.",
        "Narrowing: restriction rules and scoping rules filter what a user sees within granted access.",
        "Bypass permissions: View All / Modify All on an object, View All Data / Modify All Data org-wide.",
        "In code: with sharing enforces record access; WITH USER_MODE and AccessLevel.USER_MODE also enforce CRUD and FLS."
      ]
    },
    {
      id: "async-chooser",
      title: "Async Apex chooser",
      summary: "Start with Queueable; reach for the others when their specific strength matters.",
      items: [
        "Queueable: the default. Accepts objects as state, returns a job id, can chain, supports callouts with Database.AllowsCallouts.",
        "Transaction Finalizer: attach to a Queueable to log, alert or retry after success or failure.",
        "@future: legacy only — primitive parameters, no job id, no chaining; many enterprise rulebooks ban it.",
        "Batch Apex: millions of records; start() selects only records that need work (never WHERE Id != null); scope 200 default, 2,000 max.",
        "Database.Stateful: keeps instance state across execute() calls at the cost of serialisation; use only for totals you need.",
        "Schedulable: run at a cron time; usually just enqueues a Batch or Queueable.",
        "Platform events: decouple publishers from subscribers; publish-after-commit so subscribers never see rolled-back work.",
        "Change Data Capture: let external systems react to record changes without writing publishing code."
      ]
    },
    {
      id: "sf-cli",
      title: "sf CLI quick reference",
      summary: "Modern sf syntax with org aliases. Confirm flags with --help for your installed version.",
      items: [
        "sf org login web --alias dev-hub --set-default-dev-hub",
        "sf org login jwt --client-id \"$SF_CONSUMER_KEY\" --jwt-key-file \"$SF_JWT_KEY_FILE\" --username \"$SF_USERNAME\" --alias prod — values from the CI secret store.",
        "sf org create scratch --definition-file config/project-scratch-def.json --alias feature-x --duration-days 7 --target-dev-hub dev-hub",
        "sf project deploy start --source-dir force-app --target-org feature-x",
        "sf project retrieve start --metadata ApexClass:OrderService --target-org uat",
        "sf apex run test --test-level RunLocalTests --code-coverage --result-format human --wait 30 --target-org uat",
        "sf project deploy validate --source-dir force-app --test-level RunSpecifiedTests --tests OrderServiceTest --target-org prod",
        "sf project deploy quick --job-id <validation-job-id> --target-org prod",
        "sf code-analyzer run --workspace force-app — the static-analysis gate, zero suppressions.",
        "sf package version create --package OrderCore --code-coverage --installation-key-bypass --wait 30"
      ]
    },
    {
      id: "test-checklist",
      title: "Apex test-class checklist",
      summary: "The house standard. Tests prove business outcomes, not line counts.",
      items: [
        "@IsTest class; never seeAllData=true.",
        "@TestSetup with a data factory; no hardcoded record Ids.",
        "Wrap the action in Test.startTest() and Test.stopTest() to reset limits and flush async work.",
        "System.runAs a user holding the feature's permission set, and a negative case for a user without it.",
        "Assert class with messages that describe the business outcome (Assert.areEqual, Assert.isTrue).",
        "Bulk test with 200 records for every trigger path.",
        "Test.setMock for every callout; cover success, error and timeout responses.",
        "Coverage: platform minimum 75% org-wide; house target 90% per new class and 85% per modified class.",
        "Never weaken or delete a test to get green."
      ]
    },
    {
      id: "lwc-data-chooser",
      title: "LWC data access chooser",
      summary: "Lightning Data Service first; Apex only when LDS cannot express the query or logic.",
      items: [
        "Base record components (lightning-record-form, -view-form, -edit-form): forms with no code and FLS respected.",
        "@wire getRecord / getFieldValue: one record's fields, cached and shared across components.",
        "@wire getRelatedListRecords: child lists without Apex.",
        "GraphQL wire adapter: several objects or filtered lists in one request.",
        "createRecord / updateRecord / deleteRecord: writes that keep the LDS cache consistent.",
        "@wire Apex with cacheable=true: custom read queries; cannot perform DML.",
        "Imperative Apex: writes, non-cacheable reads, or calls triggered by user action.",
        "After an Apex write: refreshApex on the wired result, or notifyRecordUpdateAvailable for LDS-held records.",
        "Lightning Message Service: tell components in other DOM trees that data changed."
      ]
    }
  ],

  glossary: [
    {
      id: "multi-tenancy",
      term: "Multi-tenancy",
      definition: "Many customer orgs share the same application servers and database, separated logically by org rather than by hardware.",
      useIt: "Use it to explain why governor limits exist: one tenant must not be able to starve the others.",
      links: [{ label: "Multi-tenant architecture", route: "#/plat/arch/multitenancy" }]
    },
    {
      id: "governor-limit",
      term: "Governor limit",
      definition: "A hard per-transaction cap the runtime enforces on queries, DML, CPU, heap, callouts and more; exceeding one throws an uncatchable exception.",
      useIt: "Quote the number and the scope — for example 100 SOQL queries per synchronous transaction, shared by every automation in it.",
      links: [
        { label: "Governor limits", route: "#/plat/data/limits-intro" },
        { label: "Governor-limit patterns", route: "#/apex/bulk/limits-patterns" }
      ]
    },
    {
      id: "metadata-driven",
      term: "Metadata-driven platform",
      definition: "Objects, fields, layouts and code are stored as metadata that the shared runtime interprets for each org.",
      useIt: "Mention it when explaining why configuration and code can both be versioned and deployed as source.",
      links: [{ label: "The metadata-driven platform", route: "#/plat/arch/metadata-driven" }]
    },
    {
      id: "owd",
      term: "Org-wide default (OWD)",
      definition: "The baseline record access for each object — the most restrictive level everyone starts from before anything opens it up.",
      useIt: "Start every sharing design by naming the OWD; set it as tight as the most restricted user needs.",
      links: [{ label: "Org-wide defaults", route: "#/sec/records/owd" }]
    },
    {
      id: "role-hierarchy",
      term: "Role hierarchy",
      definition: "A tree of roles where users automatically gain access to records owned by users below them, unless disabled for custom objects.",
      useIt: "Say it models reporting lines for data visibility, not an org chart for permissions.",
      links: [{ label: "The role hierarchy", route: "#/sec/records/role-hierarchy" }]
    },
    {
      id: "sharing-rule",
      term: "Sharing rule",
      definition: "A declarative rule that grants extra record access to groups or roles, based on record owner or on field criteria.",
      useIt: "Prefer it over Apex sharing whenever ownership or a field value can express who should see the record.",
      links: [{ label: "Sharing rules, teams and manual sharing", route: "#/sec/records/sharing-rules" }]
    },
    {
      id: "apex-managed-sharing",
      term: "Apex managed sharing",
      definition: "Share rows written by code with a custom row cause, so they survive owner changes and can be recalculated.",
      useIt: "Use it when access follows dynamic business relationships that sharing rules cannot express.",
      links: [{ label: "Apex managed sharing", route: "#/sec/records/apex-managed-sharing" }]
    },
    {
      id: "permission-set-group",
      term: "Permission set group",
      definition: "A bundle of permission sets assigned as one unit, with optional muting to remove specific permissions.",
      useIt: "Recommend persona-based groups on a minimal profile instead of cloning profiles.",
      links: [{ label: "Profiles, permission sets and groups", route: "#/sec/access/profiles-permsets" }]
    },
    {
      id: "fls",
      term: "Field-level security (FLS)",
      definition: "Per-field read and edit access granted through profiles and permission sets.",
      useIt: "Point out that hiding a field on a layout is not security; FLS is, and code must respect it too.",
      links: [{ label: "CRUD and field-level security", route: "#/sec/access/crud-fls" }]
    },
    {
      id: "user-mode",
      term: "User mode",
      definition: "Running SOQL or DML with the running user's object, field and record access enforced, via WITH USER_MODE or AccessLevel.USER_MODE.",
      useIt: "Name it as the default for queries and DML, preferred over WITH SECURITY_ENFORCED, and never mixed with system-mode writes.",
      links: [{ label: "User mode and secure SOQL", route: "#/sec/code/user-mode" }]
    },
    {
      id: "sharing-keywords",
      term: "with / without / inherited sharing",
      definition: "Class keywords that decide whether record-level sharing is enforced, ignored, or taken from the calling class.",
      useIt: "with sharing by default, inherited sharing for selectors and utilities, without sharing only with a written justification.",
      links: [{ label: "with, without and inherited sharing", route: "#/sec/code/sharing-keywords" }]
    },
    {
      id: "bulkification",
      term: "Bulkification",
      definition: "Writing logic so it handles many records in one pass with a fixed number of queries and DML statements.",
      useIt: "Describe the pattern: accumulate keys, query once, map, process, then write once.",
      links: [{ label: "Bulkification patterns", route: "#/apex/bulk/bulkification" }]
    },
    {
      id: "trigger-handler",
      term: "Trigger handler",
      definition: "A class that receives control from a logic-free trigger and routes each context to service methods.",
      useIt: "Mention one trigger per object and a bypass switch held in Custom Metadata.",
      links: [{ label: "Trigger design and handler frameworks", route: "#/apex/bulk/triggers" }]
    },
    {
      id: "selector",
      term: "Selector",
      definition: "A class that owns every SOQL query for an object, so field lists, security and filters live in one place.",
      useIt: "Say selectors use inherited sharing and WITH USER_MODE, and services never write inline SOQL.",
      links: [
        { label: "SOQL and SOSL", route: "#/apex/lang/soql-sosl" },
        { label: "Trigger design and handler frameworks", route: "#/apex/bulk/triggers" }
      ]
    },
    {
      id: "queueable",
      term: "Queueable Apex",
      definition: "An asynchronous job class that accepts complex state, returns a job id, can chain and can make callouts.",
      useIt: "Present it as the default async tool and @future as legacy.",
      links: [{ label: "Future, queueable, batch and schedulable", route: "#/apex/async/async-overview" }]
    },
    {
      id: "batch-apex",
      term: "Batch Apex",
      definition: "An asynchronous job that processes a large record set in scoped chunks through start, execute and finish methods.",
      useIt: "Mention that start() should filter on the field it processes, and quote scope 200 default, 2,000 maximum.",
      links: [{ label: "Batch Apex in depth", route: "#/apex/async/batch" }]
    },
    {
      id: "platform-event",
      term: "Platform event",
      definition: "A custom event message published on the event bus and consumed by triggers, flows, LWC or external subscribers.",
      useIt: "Use it to decouple systems; choose publish-after-commit so subscribers never act on rolled-back data.",
      links: [{ label: "Platform events", route: "#/apex/async/platform-events" }]
    },
    {
      id: "cdc",
      term: "Change Data Capture (CDC)",
      definition: "Platform-generated events describing creates, updates, deletes and undeletes on selected objects.",
      useIt: "Pick it when external systems need to mirror record changes and you do not want to write publishing code.",
      links: [{ label: "CDC and events for integration", route: "#/int/events/cdc-events" }]
    },
    {
      id: "order-of-execution",
      term: "Order of execution",
      definition: "The fixed sequence of validation, flows, triggers, rules and commit that runs whenever a record is saved.",
      useIt: "Place each competing automation on it when debugging conflicting field values or recursion.",
      links: [{ label: "The save order of execution", route: "#/flow/engine/order-of-execution" }]
    },
    {
      id: "lds",
      term: "Lightning Data Service (LDS)",
      definition: "The client-side data layer for LWC that reads and writes records through the UI API with a shared cache and built-in FLS.",
      useIt: "Say you reach for LDS before Apex because it is cached, secure and keeps components in sync.",
      links: [{ label: "Lightning Data Service", route: "#/lwc/data/lds" }]
    },
    {
      id: "wire",
      term: "@wire",
      definition: "A reactive decorator that provisions data from an adapter or a cacheable Apex method and re-runs when its parameters change.",
      useIt: "Pair it with cacheable=true reads and refreshApex after imperative writes.",
      links: [{ label: "Wire vs imperative Apex", route: "#/lwc/data/wire-vs-imperative" }]
    },
    {
      id: "lms",
      term: "Lightning Message Service (LMS)",
      definition: "A publish-subscribe channel for communication between components in different DOM trees, including Aura and Visualforce.",
      useIt: "Use it for across-the-page communication; events are for parent and child.",
      links: [{ label: "Lightning Message Service", route: "#/lwc/comm/lms" }]
    },
    {
      id: "named-credential",
      term: "Named credential",
      definition: "Metadata holding a callout endpoint, referenced in code as callout:Name/path so no URL or secret appears in Apex.",
      useIt: "Say every callout goes through one, so endpoints change per environment without code changes.",
      links: [{ label: "Named and external credentials", route: "#/int/outbound/named-credentials" }]
    },
    {
      id: "external-credential",
      term: "External credential",
      definition: "The authentication half of a callout setup — protocol, principals and secrets — granted to users through permission sets.",
      useIt: "Mention it to show you separate the endpoint from who may authenticate and how.",
      links: [{ label: "Named and external credentials", route: "#/int/outbound/named-credentials" }]
    },
    {
      id: "bulk-api-2",
      term: "Bulk API 2.0",
      definition: "An asynchronous REST API for loading or querying large data sets as CSV jobs that the platform splits and processes.",
      useIt: "Choose it for hundreds of thousands of records or more; upsert on an external Id.",
      links: [{ label: "Bulk API 2.0 and large data volumes", route: "#/int/apis/bulk-api" }]
    },
    {
      id: "scratch-org",
      term: "Scratch org",
      definition: "A short-lived, source-driven org created from a definition file for development and automated testing.",
      useIt: "Describe it as disposable and reproducible — the opposite of a long-lived, drifting sandbox.",
      links: [{ label: "Scratch orgs and source tracking", route: "#/ops/dx/scratch-orgs" }]
    },
    {
      id: "unlocked-package",
      term: "Unlocked package",
      definition: "A versioned, installable container of metadata that a team owns and can upgrade independently.",
      useIt: "Bring it up when teams collide in one org and need clear ownership and dependencies.",
      links: [{ label: "Unlocked packages", route: "#/ops/release/unlocked-packages" }]
    },
    {
      id: "quick-deploy",
      term: "Quick deploy",
      definition: "Deploying a previously validated set of components without re-running tests, using the validation job id within its validity window.",
      useIt: "Validate before the release window, then quick deploy inside it to keep downtime short.",
      links: [{ label: "Validate, quick deploy and test levels", route: "#/ops/release/deploy-validation" }]
    },
    {
      id: "saql",
      term: "SAQL",
      definition: "The query language of CRM Analytics, written as a pipeline of load, filter, group, foreach and order statements over datasets.",
      useIt: "Use it when a dashboard needs logic the compact form cannot express, such as windowing.",
      links: [{ label: "SAQL essentials", route: "#/crma/viz/saql" }]
    },
    {
      id: "recipe",
      term: "Recipe",
      definition: "A visual CRM Analytics data-prep tool that joins, transforms and outputs datasets from synced data.",
      useIt: "Recommend recipes over legacy dataflows for new data preparation.",
      links: [{ label: "Dataflows, recipes and data sync", route: "#/crma/data/dataflows-recipes" }]
    }
  ]
};
