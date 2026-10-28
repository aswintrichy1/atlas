/* Glacier practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.arch / perf / ingest / sec / cost / dev / ai / ops. */
window.GlacierPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#67e8f9",
      icon: "map",
      summary: "End-to-end outlines for the Snowflake platform problems senior data engineers get handed: cost blowouts, CDC pipelines, PII governance, promotions and slow queries."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#818cf8",
      icon: "quiz",
      summary: "Timed Snowflake prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions a Snowflake platform or data engineering round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Credit rates, cache rules, retention windows, system roles and the SQL gotchas worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#f472b6",
      icon: "lesson",
      summary: "The Snowflake terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "cost-blowout",
      title: "Warehouse spend doubled last month",
      subtitle: "A FinOps investigation: find where the credits went, stop the bleed, and keep it from coming back.",
      timebox: "35 min",
      prompt: "Finance flags that Snowflake compute credits roughly doubled month over month with no new projects announced. You own the platform. Walk through how you find the cause and what you change.",
      related: [
        { label: "ACCOUNT_USAGE vs INFORMATION_SCHEMA", route: "#/cost/observe/account-usage" },
        { label: "Attributing cost to teams and queries", route: "#/cost/observe/attribution" },
        { label: "Resource monitors and budgets", route: "#/cost/control/resource-monitors" },
        { label: "Right-sizing warehouses", route: "#/cost/control/right-sizing" }
      ],
      outline: [
        {
          title: "Split the bill before guessing",
          items: [
            "Separate warehouse compute, serverless features (tasks, Snowpipe, clustering, search optimization, materialized view refresh) and cloud services from METERING_HISTORY.",
            "Remember cloud services only bill above 10% of daily warehouse compute — a spike there usually means metadata-heavy patterns such as huge numbers of tiny queries or frequent SHOW/DESCRIBE calls."
          ]
        },
        {
          title: "Find the warehouse and the workload",
          items: [
            "WAREHOUSE_METERING_HISTORY by warehouse and day; look for a step change and its date.",
            "QUERY_ATTRIBUTION_HISTORY and QUERY_HISTORY grouped by query_tag, user, role and query_parameterized_hash to find the repeated statements burning time.",
            "Check for warehouses with auto-suspend disabled or set very high, a size bump nobody reverted, or a min_cluster_count raised above 1."
          ]
        },
        {
          title: "Common culprits",
          items: [
            "A BI tool polling every minute keeps a warehouse awake 24 hours a day — each resume also pays a 60-second minimum.",
            "A task or dynamic table with a short schedule or target lag refreshing data that changes rarely.",
            "Spilling queries on an undersized warehouse, or a size-up that did not halve runtime."
          ]
        },
        {
          title: "Stop the bleed, then add guardrails",
          items: [
            "Lower auto-suspend, revert sizes, and move the noisy workload to its own warehouse so its cost is visible.",
            "Resource monitors with notify and suspend thresholds per warehouse; budgets for serverless spend that monitors do not govern.",
            "Mandate query tags and object tags per team so the next spike is attributable in minutes."
          ]
        },
        {
          title: "Report back",
          items: [
            "Credits by cause, the change made, the expected monthly delta, and a weekly cost review with owners."
          ]
        }
      ]
    },
    {
      id: "cdc-pipeline",
      title: "Design a CDC pipeline: streams and tasks or dynamic tables?",
      subtitle: "The core continuous-transformation design prompt, with freshness, cost and failure handling.",
      timebox: "40 min",
      prompt: "An OLTP database lands change records (inserts, updates, deletes) into a raw Snowflake table every few minutes. Build a curated, deduplicated current-state table and a daily aggregate. The business wants data no more than 15 minutes stale.",
      related: [
        { label: "Streams: offsets and change tracking", route: "#/ingest/transform/streams" },
        { label: "Tasks and task graphs", route: "#/ingest/transform/tasks" },
        { label: "Dynamic Tables and target lag", route: "#/ingest/transform/dynamic-tables" },
        { label: "CDC patterns with MERGE", route: "#/ingest/transform/cdc-merge" }
      ],
      outline: [
        {
          title: "Clarify the contract",
          items: [
            "Is there an ordering column (source LSN or commit timestamp) and an operation flag? Can the same key change several times in one batch?",
            "Are hard deletes needed downstream, or is a soft-delete flag acceptable? Is history (SCD2) required?"
          ]
        },
        {
          title: "Option A: stream plus task plus MERGE",
          items: [
            "A stream on the raw table; a task WHEN SYSTEM$STREAM_HAS_DATA('raw_stream') runs a MERGE that deduplicates with QUALIFY ROW_NUMBER() OVER (PARTITION BY key ORDER BY commit_ts DESC) = 1.",
            "Consuming the stream inside the DML transaction advances the offset atomically — a failed MERGE leaves the offset where it was.",
            "Full control over delete handling and SCD2 logic; you own scheduling, retries and the stale-stream risk if it is not consumed within the retention window."
          ]
        },
        {
          title: "Option B: dynamic tables",
          items: [
            "Declare the current-state table as a SELECT with QUALIFY over the raw table and a TARGET_LAG of 15 minutes; the daily aggregate as a downstream dynamic table with TARGET_LAG = DOWNSTREAM or a longer lag.",
            "Snowflake manages refresh ordering and tries incremental refresh; check the refresh mode actually chosen, since some constructs force full refresh.",
            "Less code, declarative freshness; less control over side effects and custom merge semantics."
          ]
        },
        {
          title: "Pick and justify",
          items: [
            "Choose dynamic tables for pure SQL transformations with a freshness SLA; choose streams and tasks when you need procedural logic, external calls or exact delete semantics.",
            "Size the warehouse for the incremental batch, not the backfill; consider serverless tasks for small, frequent runs."
          ]
        },
        {
          title: "Operate it",
          items: [
            "Alert on TASK_HISTORY failures and DYNAMIC_TABLE_REFRESH_HISTORY lag breaches.",
            "Backfill path documented separately; idempotent MERGE so reruns are safe."
          ]
        }
      ]
    },
    {
      id: "pii-governance",
      title: "Lock down PII for analysts without breaking the BI layer",
      subtitle: "RBAC design plus masking, row access and tagging, at scale.",
      timebox: "40 min",
      prompt: "A customer table with email, phone, national id and region is used by 200 analysts, a support team and a data science team. Legal wants PII visible only to support, region-restricted for regional analysts, and auditable. Design the access model.",
      related: [
        { label: "The RBAC hierarchy and system roles", route: "#/sec/access/rbac-hierarchy" },
        { label: "Dynamic data masking policies", route: "#/sec/policies/masking" },
        { label: "Row access policies", route: "#/sec/policies/row-access" },
        { label: "Object tagging and tag-based masking", route: "#/sec/policies/tags" }
      ],
      outline: [
        {
          title: "Role architecture first",
          items: [
            "Access roles own privileges on objects (for example a read role per schema); functional roles (ANALYST, SUPPORT, DS) are granted access roles; users get functional roles.",
            "Grant custom role trees up to SYSADMIN so administrators can manage objects; keep SECURITYADMIN and USERADMIN for grants and users.",
            "Managed access schemas or database roles so object owners cannot hand out grants ad hoc; future grants so new tables inherit access."
          ]
        },
        {
          title: "Column protection with masking",
          items: [
            "One masking policy per data class (email, phone, national id) using IS_ROLE_IN_SESSION('SUPPORT') rather than CURRENT_ROLE() so role inheritance works.",
            "Attach through tag-based masking: tag columns PII=EMAIL and bind the policy to the tag, so new columns are protected the moment they are tagged."
          ]
        },
        {
          title: "Row protection",
          items: [
            "A row access policy that looks up an entitlement mapping table (role to region) — keeps policy logic stable as regions change.",
            "Test the policy as each role; watch for performance on large joins and keep the mapping table small."
          ]
        },
        {
          title: "Audit and edition checks",
          items: [
            "ACCESS_HISTORY shows which columns were read by whom; POLICY_REFERENCES shows where policies are attached.",
            "Masking and row access policies need Enterprise edition or higher — confirm before committing to the design."
          ]
        },
        {
          title: "Trade-offs to say out loud",
          items: [
            "Secure views are an alternative but multiply objects and hide the optimizer's view; policies centralise logic.",
            "Data sharing consumers see policy-enforced data too, so the same model protects shares."
          ]
        }
      ]
    },
    {
      id: "env-promotion",
      title: "Promote a change from DEV to STG to PRD safely",
      subtitle: "Release engineering for Snowflake: schemachange, parameterisation, backups and validation.",
      timebox: "35 min",
      prompt: "Your team ships a new column on a fact table, a rewritten view and a changed stored procedure. Environments are separate databases (DEV, STG, PRD). Today people paste SQL into worksheets. Design the promotion process.",
      related: [
        { label: "schemachange", route: "#/ops/cicd/schemachange" },
        { label: "Promoting changes across environments", route: "#/ops/cicd/env-promotion" },
        { label: "Deployment gotchas", route: "#/ops/gotchas/deploy-gotchas" },
        { label: "Zero-copy cloning", route: "#/arch/protect/cloning" }
      ],
      outline: [
        {
          title: "Version everything",
          items: [
            "Versioned scripts (V1.4.0__add_region_col.sql) for table DDL; repeatable scripts (R__vw_sales.sql) for views and procedures; always scripts for grants.",
            "Database names injected as schemachange vars ({{ database }}) or IDENTIFIER($db) — never a literal PRD name in a script."
          ]
        },
        {
          title: "Make DDL idempotent and reversible",
          items: [
            "ALTER TABLE ... ADD COLUMN IF NOT EXISTS c1 NUMBER, COLUMN IF NOT EXISTS c2 VARCHAR — one ADD, IF NOT EXISTS repeated per column.",
            "Before mutating shared state, clone a backup such as FACT_SALES_BKP_28OCT; Time Travel is the second safety net, not the first."
          ]
        },
        {
          title: "Pipeline stages",
          items: [
            "PR triggers deploy to DEV; merge deploys to STG with test data from a zero-copy clone; a manual approval promotes the same commit to PRD.",
            "The deploy identity uses key-pair auth from the CI secret store; humans use a read-only role in PRD for analysis."
          ]
        },
        {
          title: "Validate after deploy",
          items: [
            "CREATE OR REPLACE PROCEDURE succeeding does not prove the body runs — smoke CALL the procedure and check GET_DDL output for expected tokens.",
            "If a custom driver splits multi-statement files, never skip statements that merely start with a comment banner."
          ]
        },
        {
          title: "Rollback",
          items: [
            "Forward-fix by default; for data damage restore from the _BKP_ clone or Time Travel AT(OFFSET => ...); keep rollback scripts next to versioned scripts."
          ]
        }
      ]
    },
    {
      id: "slow-query",
      title: "A dashboard query went from 20 seconds to 9 minutes",
      subtitle: "Query Profile triage: read the operators, find the cause, fix the right layer.",
      timebox: "30 min",
      prompt: "A finance dashboard tile that used to load in 20 seconds now takes 9 minutes. Nothing in the SQL changed. Walk through how you diagnose it.",
      related: [
        { label: "Reading the Query Profile", route: "#/perf/tuning/query-profile" },
        { label: "Spilling, memory and exploding joins", route: "#/perf/tuning/spilling" },
        { label: "How partition pruning works", route: "#/arch/storage/pruning" },
        { label: "The three caching layers", route: "#/perf/tuning/caching" }
      ],
      outline: [
        {
          title: "Compare before and after",
          items: [
            "Find a fast and a slow run in QUERY_HISTORY (same query_parameterized_hash): compare bytes scanned, partitions scanned vs total, queued time, spill bytes and warehouse size.",
            "Queued time means concurrency, not the query — a multi-cluster or isolation problem."
          ]
        },
        {
          title: "Read the profile",
          items: [
            "Most expensive operator first. TableScan with partitions scanned near total means pruning broke — often data growth with poor clustering, or a filter wrapped in a function.",
            "Join output rows far above input rows means an exploding join — a duplicated key in a dimension.",
            "Bytes spilled to local or remote storage means the working set no longer fits the warehouse memory."
          ]
        },
        {
          title: "Fix the right layer",
          items: [
            "Pruning: rewrite filters to be sargable, add or review a clustering key on the filter column, check clustering depth.",
            "Exploding join: deduplicate the dimension; add a data quality test on key uniqueness.",
            "Spilling: size up for that workload or reduce the data before the join; point lookups may suit search optimization."
          ]
        },
        {
          title: "Close the loop",
          items: [
            "The result cache helps repeated identical tiles only while data is unchanged — do not count it as the fix.",
            "Record the before and after metrics and add an alert on that tile's runtime."
          ]
        }
      ]
    },
    {
      id: "cortex-analyst-rollout",
      title: "Roll out Cortex Analyst on a sales semantic model",
      subtitle: "Natural-language analytics with a governed semantic model across environments.",
      timebox: "35 min",
      prompt: "Leadership wants business users to ask sales questions in plain English. You have curated fact and dimension tables in STG and PRD. Plan the Cortex Analyst rollout, including how the semantic model is authored, tested and promoted.",
      related: [
        { label: "How Cortex Analyst turns questions into SQL", route: "#/ai/analyst/analyst-overview" },
        { label: "Authoring semantic model YAML", route: "#/ai/analyst/semantic-models" },
        { label: "Semantic model pitfalls", route: "#/ai/analyst/analyst-pitfalls" },
        { label: "Tokens, cost and governance", route: "#/ai/llm/llm-cost-governance" }
      ],
      outline: [
        {
          title: "Model the business, not the warehouse",
          items: [
            "Logical tables with clear dimensions, time dimensions and measures; synonyms and descriptions in business vocabulary.",
            "Relationships each with a required, unique name; foreign-key joins must reference a primary or unique key on the target table."
          ]
        },
        {
          title: "Keep it environment-agnostic",
          items: [
            "Environment-specific filtering logic belongs in module_custom_instructions, not hardcoded in verified queries or table filters.",
            "Database and schema names templated per environment at deploy time."
          ]
        },
        {
          title: "Test like code",
          items: [
            "A golden question set with expected SQL or results, run on every YAML change.",
            "Verified queries are for a small set of trusted answers, with verified_at as an integer epoch — not a shortcut around a weak model. Fix the model first."
          ]
        },
        {
          title: "Promote safely",
          items: [
            "Back up the live YAML on the stage before every upload; upload, run the golden set, then promote.",
            "Analyst runs as the caller, so RBAC, masking and row access policies still apply to generated SQL."
          ]
        },
        {
          title: "Measure adoption and accuracy",
          items: [
            "Track question volume, answer acceptance and failures; feed misses back into synonyms, descriptions and custom instructions."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "architecture-30",
      title: "Snowflake architecture in 30 minutes",
      timebox: "30 min",
      prompt: "Explain Snowflake's architecture to a team moving from a shared-nothing warehouse. How does storage work, and why does it matter for performance and cost?",
      expected: [
        "Names the three layers — storage, compute (virtual warehouses), cloud services — and that compute and storage scale independently.",
        "Explains immutable micro-partitions (roughly 50–500 MB uncompressed), columnar storage, and min/max metadata that enables pruning.",
        "Describes the cloud services layer: metadata, optimizer, transactions, security, result cache.",
        "Connects immutability to Time Travel, zero-copy cloning and Fail-safe.",
        "Mentions clustering as a pruning aid with a maintenance cost, not a default."
      ],
      followups: [
        "Why can a clone be created in seconds on a 10 TB table, and when does it start costing storage?",
        "A query scans every partition despite a selective WHERE clause. What do you check?",
        "What does the cloud services layer bill, and when?"
      ],
      links: [
        { label: "The three layers", route: "#/arch/layers/three-layers" },
        { label: "Micro-partitions", route: "#/arch/storage/micro-partitions" },
        { label: "Zero-copy cloning", route: "#/arch/protect/cloning" }
      ]
    },
    {
      id: "warehouse-sizing-25",
      title: "Warehouse sizing and concurrency in 25 minutes",
      timebox: "25 min",
      prompt: "Your BI warehouse is a Large running all day. Users complain about slowness at 9 a.m. and finance complains about cost. What do you do?",
      expected: [
        "Distinguishes slow queries (size up, fix SQL) from queued queries (multi-cluster, isolation).",
        "States credits per hour double per size and billing is per second with a 60-second minimum per resume.",
        "Proposes a multi-cluster warehouse with min 1 and a sensible max, and explains Standard vs Economy scaling policy.",
        "Tunes auto-suspend, separates ETL from BI, and validates with QUERY_HISTORY queued and spill metrics.",
        "Notes multi-cluster requires Enterprise edition or higher."
      ],
      followups: [
        "Doubling the size halved runtime. Did cost change?",
        "When is a 30-second auto-suspend worse than 5 minutes?",
        "How would QAS change your answer for a few scan-heavy outlier queries?"
      ],
      links: [
        { label: "Warehouse sizes and billing", route: "#/perf/warehouses/sizing" },
        { label: "Multi-cluster warehouses", route: "#/perf/warehouses/multi-cluster" },
        { label: "Query Acceleration Service", route: "#/perf/accel/qas" }
      ]
    },
    {
      id: "streams-tasks-30",
      title: "Continuous pipelines in 30 minutes",
      timebox: "30 min",
      prompt: "Explain how streams track change and how you would build an incremental pipeline. When would you choose dynamic tables instead?",
      expected: [
        "Explains a stream as an offset on the table's version history, returning net changes with METADATA$ACTION, METADATA$ISUPDATE and METADATA$ROW_ID.",
        "Knows the offset advances only when the stream is consumed in a committed DML transaction; selecting from it does not.",
        "Covers standard vs append-only streams and the stale-stream risk tied to data retention.",
        "Builds a task with WHEN SYSTEM$STREAM_HAS_DATA and an idempotent, deduplicating MERGE.",
        "Contrasts dynamic tables: declarative target lag, managed refresh, incremental vs full refresh mode."
      ],
      followups: [
        "Two tasks read the same stream. What breaks, and how do you fix it?",
        "Your dynamic table silently uses full refresh. Why might that be, and what does it cost?",
        "How do you handle a key updated three times within one batch?"
      ],
      links: [
        { label: "Streams", route: "#/ingest/transform/streams" },
        { label: "Dynamic Tables", route: "#/ingest/transform/dynamic-tables" },
        { label: "CDC with MERGE", route: "#/ingest/transform/cdc-merge" }
      ]
    },
    {
      id: "rbac-governance-30",
      title: "Access control and governance in 30 minutes",
      timebox: "30 min",
      prompt: "Design the role model for a new Snowflake account serving three domains and a shared BI team. Then show how you would protect a PII column.",
      expected: [
        "Uses the system roles correctly: ACCOUNTADMIN rarely and with MFA, SECURITYADMIN for grants, USERADMIN for users and roles, SYSADMIN as the parent of custom role trees.",
        "Separates access roles from functional roles; uses future grants or managed access schemas.",
        "Writes a masking policy with IS_ROLE_IN_SESSION or a mapping table, attached directly or via tags.",
        "Adds row access policies and audits with ACCESS_HISTORY.",
        "Mentions secondary roles and that ownership drives who can grant."
      ],
      followups: [
        "A user is granted the role but still cannot see the new table. What are the likely causes?",
        "Why can CURRENT_ROLE() in a masking policy surprise you?",
        "How do policies behave on a secure data share?"
      ],
      links: [
        { label: "RBAC hierarchy", route: "#/sec/access/rbac-hierarchy" },
        { label: "Privileges and future grants", route: "#/sec/access/grants" },
        { label: "Masking policies", route: "#/sec/policies/masking" }
      ]
    },
    {
      id: "cost-control-20",
      title: "Cost guardrails in 20 minutes",
      timebox: "20 min",
      prompt: "You are asked to cap Snowflake spend per team without blocking critical pipelines. What controls do you put in place?",
      expected: [
        "Resource monitors per warehouse with notify, suspend and suspend-immediate thresholds, and knows they govern warehouses only.",
        "Budgets or alerting for serverless features (tasks, Snowpipe, clustering, search optimization) that monitors do not cover.",
        "Attribution through dedicated warehouses, query tags, object tags and QUERY_ATTRIBUTION_HISTORY.",
        "Explains that SUSPEND lets running queries finish (overshoot) while SUSPEND_IMMEDIATE cancels them.",
        "Uses ACCOUNT_USAGE knowing its latency and 365-day retention."
      ],
      followups: [
        "A monitor suspended the ETL warehouse at 2 a.m. What would you change?",
        "How do you attribute cost of a shared warehouse to five teams?"
      ],
      links: [
        { label: "Resource monitors", route: "#/cost/control/resource-monitors" },
        { label: "Attribution", route: "#/cost/observe/attribution" },
        { label: "Serverless costs", route: "#/cost/model/serverless-costs" }
      ]
    },
    {
      id: "procs-debugging-20",
      title: "Stored procedure debugging in 20 minutes",
      timebox: "20 min",
      prompt: "A Snowflake Scripting procedure deployed cleanly but returns a JSON object saying FAILED in production. Walk through how you find and fix the problem.",
      expected: [
        "Knows CREATE OR REPLACE on a SQL procedure does not validate the body — errors surface only at CALL time.",
        "Recognises EXCEPTION WHEN statement_error THEN RETURN OBJECT_CONSTRUCT(...) masks the real error; logs SQLCODE, SQLERRM and SQLSTATE or re-raises.",
        "Extracts the generated dynamic SQL and runs it standalone to see the raw error.",
        "Checks caller's vs owner's rights for privilege differences between environments.",
        "Adds a smoke CALL and a GET_DDL token check to the deploy pipeline."
      ],
      followups: [
        "It works when you call it but fails from a task. Why might that be?",
        "How would you make the procedure fail loudly without losing structured error output?"
      ],
      links: [
        { label: "Procedure pitfalls", route: "#/dev/procs/proc-pitfalls" },
        { label: "Caller's vs owner's rights", route: "#/dev/procs/rights" },
        { label: "Snowflake Scripting", route: "#/dev/procs/sql-scripting" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Architecture fluency — storage, compute and cloud services, and their consequences",
      "Performance reasoning — pruning, caching, spilling and warehouse sizing backed by evidence",
      "Pipeline design — loading paths, streams, tasks and dynamic tables with failure handling",
      "Security and governance — role design, policies, authentication and auditing",
      "Cost awareness — credits, serverless spend, guardrails and attribution",
      "Delivery discipline — versioned deploys, parameterised environments, backups and validation",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Knows the feature names but reaches for bigger warehouses and broad grants as the answer to everything.",
        signals: [
          "Fixes every slow query by sizing up, without reading the Query Profile.",
          "Grants ACCOUNTADMIN or SYSADMIN to analysts to unblock them.",
          "Pastes SQL into worksheets against PRD; hardcodes database names.",
          "Cannot say how credits are billed or what the 60-second minimum means."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Builds working pipelines and sensible roles, but evidence, guardrails and environment hygiene are partial.",
        signals: [
          "Reads the profile and spots spilling or a full scan, but does not compare against a fast baseline.",
          "Uses streams and tasks correctly; handles duplicates in MERGE.",
          "Separates functional and access roles; knows masking policies exist.",
          "Sets auto-suspend and a resource monitor but has no cost attribution."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Diagnoses from ACCOUNT_USAGE and profiles, designs for governance and cost from day one, and ships changes like software.",
        signals: [
          "Quantifies trade-offs: credits per size, pruning ratio, target lag versus refresh cost.",
          "Uses tag-based masking, row access mapping tables and ACCESS_HISTORY audits.",
          "Versioned schemachange deploys with parameterised databases, backups before mutation and post-deploy smoke tests.",
          "Attributes cost by team and query tag and covers serverless spend outside resource monitors."
        ]
      },
      {
        id: "standout",
        title: "Standout",
        summary: "Sets platform standards others adopt, anticipates failure modes and explains limits honestly.",
        signals: [
          "Names edition requirements and feature limits before committing to a design.",
          "Calls out subtle gotchas unprompted: stale streams, masked procedure errors, cloud services billing threshold.",
          "Proposes measurable rollouts with owners, alerts and review cadence.",
          "Compares alternatives fairly, including when Snowflake is not the best fit."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "warehouse-credits",
      title: "Warehouse sizes and credits",
      summary: "Each size step doubles credits per hour; per-second billing after a 60-second minimum per resume.",
      items: [
        "XS 1 · S 2 · M 4 · L 8 · XL 16 credits per hour.",
        "2XL 32 · 3XL 64 · 4XL 128 · 5XL 256 · 6XL 512 credits per hour.",
        "Every resume bills at least 60 seconds, then per second — many short resumes add up.",
        "Double the size and halve the runtime costs the same credits; it only pays off when runtime actually halves.",
        "Auto-suspend trades idle burn against losing the local disk cache; tune per workload.",
        "Multi-cluster: clusters × size × hours; Standard scales out eagerly, Economy waits for sustained load (Enterprise+)."
      ]
    },
    {
      id: "caching-layers",
      title: "The three caching layers",
      summary: "Know which layer answered and why the others did not.",
      items: [
        "Result cache (cloud services): identical query text, unchanged underlying data, valid for 24 hours, reuse extends it up to 31 days; no warehouse needed.",
        "Result cache misses: data changed, non-deterministic functions such as CURRENT_TIMESTAMP, role lacks privileges, or USE_CACHED_RESULT = FALSE.",
        "Local disk cache (warehouse SSD): table data read by earlier queries on the same warehouse; lost when the warehouse suspends.",
        "Remote storage: the micro-partitions themselves — slowest, always correct.",
        "Metadata: COUNT(*), MIN and MAX on some columns can be answered from partition metadata without scanning."
      ]
    },
    {
      id: "retention",
      title: "Time Travel and Fail-safe retention",
      summary: "Windows by table type, and what you can do in each.",
      items: [
        "Permanent: Time Travel default 1 day, up to 90 days on Enterprise+; then 7 days Fail-safe.",
        "Transient: Time Travel 0 or 1 day; no Fail-safe.",
        "Temporary: Time Travel 0 or 1 day, session-scoped; no Fail-safe.",
        "Time Travel: AT / BEFORE (TIMESTAMP, OFFSET, STATEMENT), UNDROP, clone from a point in time — self-service.",
        "Fail-safe: recovery only through Snowflake support; not a backup strategy you can operate.",
        "Changed data is billed for storage across Time Travel plus Fail-safe — high-churn staging tables are cheaper as transient."
      ]
    },
    {
      id: "system-roles",
      title: "RBAC system roles",
      summary: "What each built-in role is for, and what it should not be used for.",
      items: [
        "ORGADMIN — organization-level: accounts, org usage. Not for daily work.",
        "ACCOUNTADMIN — top of the account; billing, monitors. Few users, MFA, never a default role.",
        "SECURITYADMIN — manages grants globally (MANAGE GRANTS); inherits USERADMIN.",
        "USERADMIN — creates users and roles.",
        "SYSADMIN — creates warehouses and databases; grant custom role trees to it.",
        "PUBLIC — granted to everyone automatically; keep privileges on it minimal."
      ]
    },
    {
      id: "account-usage",
      title: "ACCOUNT_USAGE views worth knowing",
      summary: "365-day history with latency (roughly 45 minutes to 3 hours by view); INFORMATION_SCHEMA functions are real-time with short retention.",
      items: [
        "QUERY_HISTORY — runtime, bytes scanned, partitions, spill, queued time, query_tag.",
        "WAREHOUSE_METERING_HISTORY — credits per warehouse per hour.",
        "METERING_DAILY_HISTORY — daily credits by service type including the cloud services adjustment.",
        "QUERY_ATTRIBUTION_HISTORY — compute credits attributed to individual queries.",
        "ACCESS_HISTORY — columns read and written per query, for audits.",
        "LOGIN_HISTORY, TASK_HISTORY, COPY_HISTORY, TABLE_STORAGE_METRICS, POLICY_REFERENCES."
      ]
    },
    {
      id: "sql-gotchas",
      title: "SQL gotchas",
      summary: "The ones that bite experienced engineers.",
      items: [
        "VALUES accepts constants only — use INSERT ... SELECT ... UNION ALL when you need PARSE_JSON or other functions.",
        "A JSON string literal into a VARIANT column needs PARSE_JSON('...'); otherwise it types as VARCHAR.",
        "ALTER TABLE t ADD COLUMN IF NOT EXISTS c1 NUMBER, COLUMN IF NOT EXISTS c2 VARCHAR — single ADD, IF NOT EXISTS per column.",
        "DECRYPT returns BINARY — wrap in TO_VARCHAR(..., 'UTF-8') or CAST(... AS VARCHAR).",
        "Quoted identifiers are case-sensitive: \"Region\" is not REGION.",
        "x NOT IN (subquery) returns no rows if the subquery yields a NULL — prefer NOT EXISTS.",
        "TIMESTAMP_NTZ stores wall-clock with no zone, LTZ converts to session zone, TZ keeps the offset — pick deliberately."
      ]
    }
  ],

  glossary: [
    {
      id: "micro-partition",
      term: "Micro-partition",
      definition: "An immutable, columnar storage unit of roughly 50–500 MB uncompressed, with per-column min/max and other metadata kept by the cloud services layer.",
      useIt: "Use it to explain why updates rewrite partitions and why pruning, cloning and Time Travel are cheap.",
      links: [{ label: "Micro-partitions", route: "#/arch/storage/micro-partitions" }]
    },
    {
      id: "pruning",
      term: "Partition pruning",
      definition: "Skipping micro-partitions whose metadata ranges cannot satisfy a filter, before any data is read.",
      useIt: "Quote partitions scanned versus total from the profile — that ratio is the evidence.",
      links: [{ label: "Pruning", route: "#/arch/storage/pruning" }]
    },
    {
      id: "clustering-depth",
      term: "Clustering depth",
      definition: "The average number of overlapping micro-partitions for a given value of the clustering columns; lower means better pruning.",
      useIt: "Check SYSTEM$CLUSTERING_INFORMATION before adding a clustering key, and weigh automatic clustering credits.",
      links: [{ label: "Clustering", route: "#/arch/storage/clustering" }]
    },
    {
      id: "virtual-warehouse",
      term: "Virtual warehouse",
      definition: "A named compute cluster that executes queries, billed in credits per second while running after a 60-second minimum per resume.",
      useIt: "Size for the slowest critical query, scale out for concurrency, and isolate workloads by warehouse.",
      links: [{ label: "Sizing", route: "#/perf/warehouses/sizing" }]
    },
    {
      id: "multi-cluster",
      term: "Multi-cluster warehouse",
      definition: "A warehouse that adds same-size clusters up to a maximum when queries queue, under a Standard or Economy scaling policy.",
      useIt: "Reach for it when the problem is queuing, not slow individual queries.",
      links: [{ label: "Multi-cluster", route: "#/perf/warehouses/multi-cluster" }]
    },
    {
      id: "result-cache",
      term: "Result cache",
      definition: "Persisted query results in the cloud services layer, reused for identical queries while underlying data is unchanged, for 24 hours extendable to 31 days.",
      useIt: "Never count it as a performance fix — it disappears the moment data changes.",
      links: [{ label: "Caching", route: "#/perf/tuning/caching" }]
    },
    {
      id: "spilling",
      term: "Spilling",
      definition: "Writing intermediate results to local disk and then remote storage when an operator's working set exceeds warehouse memory.",
      useIt: "Remote spill is the signal to reduce data earlier or size up for that workload.",
      links: [{ label: "Spilling", route: "#/perf/tuning/spilling" }]
    },
    {
      id: "time-travel",
      term: "Time Travel",
      definition: "Querying, cloning or restoring data as it existed at an earlier point within the retention window, using AT, BEFORE and UNDROP.",
      useIt: "Name it as the first-line recovery tool and state the retention in that environment.",
      links: [{ label: "Time Travel", route: "#/arch/protect/time-travel" }]
    },
    {
      id: "fail-safe",
      term: "Fail-safe",
      definition: "A 7-day, non-queryable recovery period after Time Travel for permanent tables, recoverable only through Snowflake support.",
      useIt: "Say it is disaster recovery of last resort, and that transient tables avoid its storage cost.",
      links: [{ label: "Fail-safe", route: "#/arch/protect/fail-safe" }]
    },
    {
      id: "zero-copy-clone",
      term: "Zero-copy clone",
      definition: "A metadata-only copy of a table, schema or database that shares micro-partitions until either side changes them.",
      useIt: "Use it for test data and pre-change backups such as ORDERS_BKP_28OCT.",
      links: [{ label: "Cloning", route: "#/arch/protect/cloning" }]
    },
    {
      id: "stream",
      term: "Stream",
      definition: "An object that records an offset on a table's change history and returns net inserts, updates and deletes since that offset.",
      useIt: "Point out the offset advances only when consumed in a committed DML statement.",
      links: [{ label: "Streams", route: "#/ingest/transform/streams" }]
    },
    {
      id: "task",
      term: "Task",
      definition: "A scheduled or triggered unit of SQL or procedure execution, on a warehouse or serverless, that can be chained into a task graph.",
      useIt: "Pair it with SYSTEM$STREAM_HAS_DATA so runs are skipped when there is nothing to do.",
      links: [{ label: "Tasks", route: "#/ingest/transform/tasks" }]
    },
    {
      id: "dynamic-table",
      term: "Dynamic table",
      definition: "A table defined by a query that Snowflake keeps refreshed to within a declared target lag, incrementally when possible.",
      useIt: "Choose it for declarative SQL pipelines with a freshness SLA; check the actual refresh mode.",
      links: [{ label: "Dynamic Tables", route: "#/ingest/transform/dynamic-tables" }]
    },
    {
      id: "snowpipe",
      term: "Snowpipe",
      definition: "Serverless, event-driven file loading that runs a COPY definition as files arrive in a stage.",
      useIt: "Recommend files of roughly 100–250 MB compressed and contrast with Snowpipe Streaming for row-level, low-latency ingest.",
      links: [{ label: "Snowpipe", route: "#/ingest/load/snowpipe" }]
    },
    {
      id: "variant",
      term: "VARIANT",
      definition: "A semi-structured type holding JSON, Avro, Parquet and similar values, queried with path notation and FLATTEN.",
      useIt: "Remember literals need PARSE_JSON and VALUES cannot call it — use INSERT ... SELECT.",
      links: [{ label: "Semi-structured data", route: "#/ingest/open/semi-structured" }]
    },
    {
      id: "iceberg-table",
      term: "Iceberg table",
      definition: "A table stored in the open Apache Iceberg format in external cloud storage, managed by Snowflake or an external catalog.",
      useIt: "Bring it up for interoperability with other engines without copying data.",
      links: [{ label: "External and Iceberg tables", route: "#/ingest/open/external-iceberg" }]
    },
    {
      id: "masking-policy",
      term: "Masking policy",
      definition: "A schema-level object that rewrites a column's value at query time based on context such as the active roles.",
      useIt: "Write it with IS_ROLE_IN_SESSION and attach via tags so coverage follows classification.",
      links: [{ label: "Masking", route: "#/sec/policies/masking" }]
    },
    {
      id: "row-access-policy",
      term: "Row access policy",
      definition: "A policy that returns a boolean per row, filtering which rows a query can see, typically via an entitlement mapping table.",
      useIt: "Prefer a mapping table over hardcoded role lists so access changes are data changes.",
      links: [{ label: "Row access", route: "#/sec/policies/row-access" }]
    },
    {
      id: "future-grants",
      term: "Future grants",
      definition: "Grants defined on a schema or database that apply automatically to objects of a given type created later.",
      useIt: "Use it to explain why a newly created table is or is not visible to a role.",
      links: [{ label: "Grants", route: "#/sec/access/grants" }]
    },
    {
      id: "managed-access-schema",
      term: "Managed access schema",
      definition: "A schema where only the schema owner or roles with MANAGE GRANTS can grant privileges on contained objects.",
      useIt: "Use it to stop object owners from handing out ad hoc grants.",
      links: [{ label: "Database roles and managed access", route: "#/sec/access/database-roles" }]
    },
    {
      id: "key-pair-auth",
      term: "Key-pair authentication",
      definition: "Authenticating with an RSA private key whose public key is set on the user, with RSA_PUBLIC_KEY_2 enabling zero-downtime rotation.",
      useIt: "Recommend it for service users, with the key path from an environment variable, never inline.",
      links: [{ label: "Authentication", route: "#/sec/perimeter/auth" }]
    },
    {
      id: "resource-monitor",
      term: "Resource monitor",
      definition: "A credit quota on one or more warehouses that can notify, suspend after running queries finish, or suspend immediately.",
      useIt: "Say clearly it does not cover serverless features — budgets fill that gap.",
      links: [{ label: "Resource monitors", route: "#/cost/control/resource-monitors" }]
    },
    {
      id: "cloud-services-adjustment",
      term: "Cloud services adjustment",
      definition: "Cloud services credits are billed only for the portion above 10% of that day's warehouse compute.",
      useIt: "Use it to explain why metadata-heavy workloads suddenly show cloud services charges.",
      links: [{ label: "Serverless and cloud services billing", route: "#/cost/model/serverless-costs" }]
    },
    {
      id: "query-tag",
      term: "Query tag",
      definition: "A session or user parameter whose value is recorded on each query, used to attribute workload and cost.",
      useIt: "Mandate it in pipelines and BI connections so cost can be grouped by team and job.",
      links: [{ label: "Attribution", route: "#/cost/observe/attribution" }]
    },
    {
      id: "owners-rights",
      term: "Owner's rights procedure",
      definition: "A stored procedure that runs with the privileges of its owner role, with restrictions on session state access, as opposed to caller's rights.",
      useIt: "Use it to expose a controlled operation without granting the underlying privileges.",
      links: [{ label: "Caller's vs owner's rights", route: "#/dev/procs/rights" }]
    },
    {
      id: "semantic-model",
      term: "Semantic model",
      definition: "A YAML description of logical tables, dimensions, measures, relationships and verified queries that Cortex Analyst uses to generate SQL.",
      useIt: "Treat it as versioned code: back up before upload, test with a golden question set, keep env filters in custom instructions.",
      links: [{ label: "Semantic model YAML", route: "#/ai/analyst/semantic-models" }]
    },
    {
      id: "schemachange",
      term: "schemachange",
      definition: "A migration tool that applies versioned, repeatable and always scripts to Snowflake and records history in a change table.",
      useIt: "Pair it with templated vars for database names so one script set deploys to every environment.",
      links: [{ label: "schemachange", route: "#/ops/cicd/schemachange" }]
    }
  ]
};
