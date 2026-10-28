/* =====================================================================
   COMPASS · Loop Playbooks — Data & Platform Companies module
   Adds module `data-cos` to window.TRACKS.loops (push only).
   Evergreen, unofficial guides: round types only where commonly
   described, values from each company's own public statements, and
   original practice prompts. No private interview content.
   ===================================================================== */
(function () {
  "use strict";

  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "loops-datacos": {
      title: "Data & platform company loops checkpoint",
      sub: "Snowflake, Databricks, Stripe and Netflix — values, shapes and honest preparation.",
      questions: [
        {
          q: "Where should you get the current values or principles for any company in this module?",
          options: [
            "From the company\u2019s own careers or culture pages, checked close to your interview",
            "From an interview-question dump",
            "From a summary written several years ago",
            "From this page alone"
          ],
          answer: 0,
          explain: "Published values and principles change. These guides teach how to prepare against them, but the current wording belongs to the company \u2014 read it yourself shortly before the loop. Question dumps are unreliable and often violate candidate agreements."
        },
        {
          q: "Netflix\u2019s published culture material emphasises \u201ccontext, not control\u201d. Which story best evidences it?",
          options: [
            "You followed a detailed process exactly",
            "You gave a partner team the goal, constraints and data they needed and let them choose the design, then held them to the outcome",
            "You approved every change your team made",
            "You escalated every decision to your manager"
          ],
          answer: 1,
          explain: "Context-not-control describes leaders sharing the information people need to make good decisions themselves. A story where you supplied context and trusted the decision matches; one about tight approval does not."
        },
        {
          q: "Stripe\u2019s public material stresses users and rigorous written thinking. What is a strong preparation step?",
          options: [
            "Memorise Stripe\u2019s API reference",
            "Prepare only puzzle-style algorithm questions",
            "Have one story about improving something for the end user and be ready to explain a design in clear, structured prose",
            "Prepare a story about avoiding documentation"
          ],
          answer: 2,
          explain: "A company that values users and written clarity rewards stories that start from the user\u2019s problem and explanations that are precise and organised. Memorising API details is not the signal."
        },
        {
          q: "For a data-platform company such as Snowflake or Databricks, which technical-depth story is most valuable?",
          options: [
            "A generic web-app feature",
            "Your favourite programming language",
            "A team-building event you organised",
            "A data system you owned end to end \u2014 scale, a performance or correctness problem, the trade-off you chose and how you verified it"
          ],
          answer: 3,
          explain: "These companies build data infrastructure and sell to data teams. Depth on a data system you actually ran \u2014 with numbers and a verified trade-off \u2014 lets you speak as a practitioner of their customers\u2019 problems."
        },
        {
          q: "A forum post claims to list the \u201cexact questions\u201d one of these companies asks. What should you do?",
          options: [
            "Memorise the answers",
            "Treat it as unverified, prepare the underlying signals with your own stories, and confirm the loop format with your recruiter",
            "Quote the post in the interview",
            "Cancel the interview"
          ],
          answer: 1,
          explain: "Second-hand question lists are often outdated or invented, and rehearsed answers to them sound rehearsed. Signals and real stories transfer; the format is the recruiter\u2019s to confirm."
        }
      ]
    }
  });

  function guide(o) {
    return {
      id: o.id,
      title: o.title,
      summary: o.summary,
      minutes: o.minutes || 8,
      tags: o.tags,
      blocks: [
        { t: "note", variant: "warn", html: "<strong>Unofficial, evergreen guide.</strong> Nothing here comes from private interview material, and loops change. Values are paraphrased from the company\u2019s own public statements \u2014 read the current version on its careers or culture pages before your loop \u2014 and round <em>types</em> are listed only where they are commonly described. Counts and durations are not reliably reported and are not invented here; your recruiter has the real agenda." }
      ].concat(o.blocks)
    };
  }

  var MODULE_DATA_COS = {
    id: "data-cos",
    name: "Data & Platform Companies",
    icon: "share",
    lessons: [
      guide({
        id: "snowflake",
        title: "Snowflake \u2014 customer outcomes and data-platform depth",
        summary: "A data-cloud company: expect depth on data systems, customer focus and ownership.",
        tags: ["snowflake", "data-platform", "company-guide"],
        blocks: [
          { t: "p", html: "Snowflake builds a cloud data platform and sells it to data and analytics teams. Its public values material has, at various times, emphasised putting customers first, integrity, ownership and thinking big \u2014 <strong>check the current wording on its careers page</strong>. Whatever the exact list, a candidate should arrive with stories that show customer impact and owned outcomes on data systems." },
          {
            t: "table",
            headers: ["Round type (commonly described)", "Length", "What to prepare"],
            rows: [
              ["Recruiter / hiring-manager screen", "Not reliably reported", "Why a data-platform company, and the scope of your recent work"],
              ["Coding", "Not reliably reported", "Solid fundamentals; data-structure problems with clear complexity reasoning"],
              ["System design", "Not reliably reported", "Storage, query execution, multi-tenancy, scaling and failure modes"],
              ["Project deep-dive / behavioral", "Not reliably reported", "A data system you owned, a customer-facing problem, and how you handled disagreement"]
            ]
          },
          { t: "h", text: "Original practice prompts" },
          {
            t: "ul", items: [
              "Tell me about a time a customer\u2019s problem changed what you built.",
              "Describe a performance problem in a data system: how you found the cause and how you proved the fix.",
              "When did you take ownership of something outside your team\u2019s remit?",
              "Walk me through a trade-off between cost and query latency you had to make."
            ]
          },
          { t: "note", variant: "tip", html: "For technical depth, the Cascade atlas (data engineering) in this collection covers warehouse storage, pruning and clustering in <em>SQL &amp; Query Engines \u203a Query Engines \u203a Partitioning, clustering &amp; pruning</em>, and the Glacier atlas (Snowflake) goes further on the platform itself. Use them to sharpen the deep-dive, not to recite features." },
          { t: "note", variant: "key", html: "<strong>Speak as a practitioner of the customer\u2019s problem.</strong> The most transferable preparation is one data system you ran end to end, told with scale, a measured outcome and the trade-off you chose \u2014 that is the same conversation Snowflake has with its own customers." }
        ]
      }),
      guide({
        id: "databricks",
        title: "Databricks \u2014 first principles, ownership and the lakehouse",
        summary: "A data-and-AI platform company: expect rigour, technical depth and a bias toward ownership.",
        tags: ["databricks", "lakehouse", "company-guide"],
        blocks: [
          { t: "p", html: "Databricks builds a data and AI platform around the lakehouse idea and maintains several well-known open-source projects. Its public culture statements have emphasised principles such as being customer obsessed, raising the bar, truth-seeking, first-principles thinking and owning outcomes \u2014 <strong>confirm the current list on its careers page</strong>. Candidates commonly describe a technically demanding loop." },
          {
            t: "table",
            headers: ["Round type (commonly described)", "Length", "What to prepare"],
            rows: [
              ["Recruiter / hiring-manager screen", "Not reliably reported", "Motivation, recent scope, and interest in data and AI infrastructure"],
              ["Coding", "Not reliably reported", "Fundamentals with attention to correctness and edge cases; some roles add concurrency"],
              ["System design", "Not reliably reported", "Distributed systems: partitioning, fault tolerance, storage and compute separation"],
              ["Behavioral / leadership", "Not reliably reported", "Ownership, raising the bar, disagreeing with evidence"]
            ]
          },
          { t: "h", text: "Original practice prompts" },
          {
            t: "ul", items: [
              "Tell me about a time you reasoned from first principles instead of following an established approach.",
              "Describe a decision where the data pointed somewhere uncomfortable. What did you do?",
              "When did you raise the quality bar for a team, and what did it cost?",
              "Explain a distributed-systems failure you debugged and what you changed so it could not recur."
            ]
          },
          { t: "note", variant: "tip", html: "The Cascade atlas (data engineering) in this collection covers the Delta transaction log, MERGE, Unity Catalog and the medallion pattern in <em>Databricks &amp; Delta Lake</em>, and Spark internals in <em>Batch Processing &amp; Spark</em>." },
          { t: "note", variant: "key", html: "<strong>Bring evidence-driven disagreement.</strong> A story where you changed a decision \u2014 or changed your own mind \u2014 because of data you gathered fits a truth-seeking culture far better than a story where you were simply right." }
        ]
      }),
      guide({
        id: "stripe",
        title: "Stripe \u2014 users, rigour and written thinking",
        summary: "A payments-infrastructure company with a strong writing culture: expect practical engineering and careful reasoning.",
        tags: ["stripe", "payments", "company-guide"],
        blocks: [
          { t: "p", html: "Stripe builds economic infrastructure for internet businesses. Its publicly shared operating principles have stressed users first, rigour, optimism and moving with urgency, and the company is widely known for a strong <strong>written culture</strong> \u2014 <strong>read its current published principles</strong>. Candidates commonly describe practical, work-like technical rounds rather than pure puzzles." },
          {
            t: "table",
            headers: ["Round type (commonly described)", "Length", "What to prepare"],
            rows: [
              ["Recruiter screen", "Not reliably reported", "Motivation and fit for the specific team"],
              ["Practical coding", "Not reliably reported", "Working code against realistic, evolving requirements; tests and clarity count"],
              ["Integration / debugging style exercise", "Not reliably reported (role dependent)", "Reading unfamiliar code, finding a bug, reasoning about APIs"],
              ["System design", "Not reliably reported", "Correctness under failure: idempotency, retries, consistency of money movement"],
              ["Behavioral / manager", "Not reliably reported", "User impact, ownership, and how you work through disagreement in writing"]
            ]
          },
          { t: "h", text: "Original practice prompts" },
          {
            t: "ul", items: [
              "Tell me about something you changed because of what a user experienced.",
              "Describe a document you wrote that changed a decision.",
              "When did you choose correctness over speed \u2014 or speed over polish \u2014 and how did you decide?",
              "Walk me through how you would make a payment request safe to retry."
            ]
          },
          { t: "note", variant: "tip", html: "Idempotency and replay-safe writes come up naturally in payments; the Cascade atlas (data engineering) in this collection covers the pattern in <em>Storage &amp; File Formats \u203a Ingestion \u203a Incremental loads &amp; idempotency</em>." },
          { t: "note", variant: "key", html: "<strong>Clarity is a technical skill here.</strong> Structure every answer \u2014 problem, options, choice, verification \u2014 as if you were writing it down, because in a writing culture that is how your work will be judged." }
        ]
      }),
      guide({
        id: "netflix",
        title: "Netflix \u2014 freedom, responsibility and judgement",
        summary: "A culture built on context not control: expect deep probing of judgement, candour and senior-level ownership.",
        tags: ["netflix", "culture", "company-guide"],
        blocks: [
          { t: "p", html: "Netflix has published its culture material for many years. Recurring themes include <strong>freedom and responsibility</strong>, leading with <strong>context, not control</strong>, candour, and high talent density \u2014 <strong>read the current culture page</strong>, as the wording has evolved. Candidates commonly describe loops that lean heavily on culture conversations alongside technical rounds, often for experienced engineers." },
          {
            t: "table",
            headers: ["Round type (commonly described)", "Length", "What to prepare"],
            rows: [
              ["Recruiter / hiring-manager", "Not reliably reported", "Scope fit and why this team"],
              ["Technical (coding and/or design)", "Not reliably reported (varies by team)", "Team-specific; ask the recruiter what to expect"],
              ["Culture conversations", "Not reliably reported", "Judgement, candour, ownership without process, and how you use freedom responsibly"]
            ]
          },
          { t: "h", text: "Original practice prompts" },
          {
            t: "ul", items: [
              "Tell me about a significant decision you made without being asked or approved.",
              "Describe feedback you gave a peer that was hard to give. What happened next?",
              "When did you give a team context instead of instructions, and what did they decide?",
              "Tell me about a bet that failed. How did you handle it with stakeholders?"
            ]
          },
          { t: "note", variant: "trap", html: "Do not recite the culture memo back to the interviewer. They wrote it, or work by it daily; quoting it reads as preparation without understanding. Show the behaviour in a story instead." },
          { t: "note", variant: "key", html: "<strong>Freedom is evidenced by responsibility.</strong> The strongest stories pair a decision you made on your own judgement with how you owned the consequences \u2014 including telling people early when it went wrong." },
          { t: "quiz", id: "loops-datacos" }
        ]
      })
    ]
  };

  /* Push-only registration; the meta-amazon file owns track metadata. */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.loops || (window.TRACKS.loops = { id: "loops", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MODULE_DATA_COS);
})();
