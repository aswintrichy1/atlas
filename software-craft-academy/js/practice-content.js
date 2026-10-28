/* Chisel practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.clean / refac / test / review /
   git / design / docs / ai. */
window.ChiselPractice = {
  nav: [
    { id: "scenarios", route: "#/scenarios", title: "Scenario packs", label: "Talk it through", color: "#d4a373", icon: "map",
      summary: "Realistic craft problems \u2014 a scary legacy change, a flaky suite, a slow review culture \u2014 with outlines you can walk through end to end." },
    { id: "interview", route: "#/interview", title: "Interview prompts", label: "Timed practice", color: "#93c5fd", icon: "quiz",
      summary: "Timed prompts on engineering practice with what an interviewer listens for and the follow-ups they push on." },
    { id: "rubrics", route: "#/rubrics", title: "Rubrics", label: "Score yourself", color: "#86efac", icon: "star",
      summary: "The dimensions a craft or senior-engineer round is scored on, and what each band sounds like." },
    { id: "cheatsheets", route: "#/cheatsheets", title: "Cheat sheets", label: "Fast recall", color: "#fcd34d", icon: "md",
      summary: "Smells and moves, test doubles, Git rescue commands and review labels worth having in memory." },
    { id: "glossary", route: "#/glossary", title: "Glossary", label: "Say it precisely", color: "#c4b5fd", icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it." }
  ],

  scenarios: [
    {
      id: "legacy-change",
      title: "Add a feature to untested legacy code",
      subtitle: "The classic craft problem: a change is required in code nobody dares to touch.",
      timebox: "30 min",
      prompt: "A 900-line pricing module with no tests must support a new wholesale discount by next sprint. It reads config from globals and calls the database directly. Walk through how you would make the change safely.",
      related: [
        { label: "The change algorithm", route: "#/refac/legacy/legacy-definition" },
        { label: "Seams", route: "#/refac/legacy/seams" },
        { label: "Characterization tests", route: "#/refac/legacy/characterization" }
      ],
      outline: [
        { title: "Find change and test points", items: [
          "Locate exactly where the discount must apply; find where its effect is observable (the returned price).",
          "Resist a rewrite; state that you will learn the module's real rules by pinning them." ] },
        { title: "Get it under test", items: [
          "Break the smallest dependencies: parameterize the constructor for config and database, or pass a clock.",
          "Write characterization tests over representative inputs, including odd ones; pin current output even if it looks wrong and log suspicious cases as tickets." ] },
        { title: "Make the change", items: [
          "Sprout the wholesale rule as a new pure function with its own example tests; call it from one line.",
          "Refactor only on the path of the change, in separate commits, keeping tests green." ] },
        { title: "Ship and leave it better", items: [
          "Small PRs: dependency-breaking first, then tests, then the feature, ideally behind a flag.",
          "Note what is now covered and what is still risky for the next person." ] }
      ]
    },
    {
      id: "flaky-suite",
      title: "Rescue a flaky, slow test suite",
      subtitle: "CI takes 45 minutes and fails randomly; engineers re-run until green.",
      timebox: "30 min",
      prompt: "Your team's CI suite takes 45 minutes and about one run in four fails for no code reason. People have started merging on red. What do you do over the next month?",
      related: [
        { label: "Flaky tests", route: "#/test/practice/flaky-tests" },
        { label: "Pyramid vs trophy", route: "#/test/strategy/pyramid-trophy" },
        { label: "Test levels", route: "#/test/strategy/test-levels" }
      ],
      outline: [
        { title: "Restore trust first", items: [
          "Measure per-test failure rates across recent runs; identify the worst offenders.",
          "Quarantine flaky tests out of the blocking gate, each with an owner and a deadline." ] },
        { title: "Fix root causes", items: [
          "Replace fixed sleeps with condition waits; inject clocks; isolate test data; seed randomness.",
          "Stub third-party network calls at the boundary and add contract tests instead." ] },
        { title: "Reshape for speed", items: [
          "Find E2E tests that check logic and push those checks down to unit or integration level.",
          "Split into a fast gate on every push and a slower suite later in the pipeline; parallelise." ] },
        { title: "Keep it healthy", items: [
          "Track suite time and flake rate as team metrics.",
          "Agree a policy: no new E2E test without asking which lower level could catch the bug." ] }
      ]
    },
    {
      id: "slow-reviews",
      title: "Fix a slow, painful review culture",
      subtitle: "PRs wait days, threads get heated, and big PRs are rubber-stamped.",
      timebox: "25 min",
      prompt: "PRs on your team wait two to three days for review, average 900 lines, and review threads often turn into style arguments. As the new tech lead, what changes do you make?",
      related: [
        { label: "PR size", route: "#/review/flow/pr-size" },
        { label: "Checklists and bots", route: "#/review/flow/checklists-automation" },
        { label: "Review culture", route: "#/review/flow/review-culture" }
      ],
      outline: [
        { title: "Remove style from human review", items: [
          "Adopt a formatter and linter in pre-commit and CI; settle style once.",
          "Add CODEOWNERS so the right reviewer is requested automatically." ] },
        { title: "Shrink the unit of review", items: [
          "Set a soft size target and teach refactor-first PRs, stacking and feature flags.",
          "Separate generated files from hand-written changes." ] },
        { title: "Set norms", items: [
          "Agree a first-response target in hours; review before starting new work.",
          "Introduce comment labels (blocking, question, suggestion, nit) and approve-with-nits." ] },
        { title: "Measure and adjust", items: [
          "Track time to first review and PR size weekly.",
          "Run a short retro after a month and prune what did not help." ] }
      ]
    },
    {
      id: "ai-rollout",
      title: "Roll out AI coding agents to a team",
      subtitle: "Leadership wants productivity gains; you want to keep the quality bar.",
      timebox: "25 min",
      prompt: "Your organisation is adopting AI coding agents. You are asked to define how your team of eight should use them for the first quarter. What do you set up?",
      related: [
        { label: "Rules files", route: "#/ai/setup/rules-files" },
        { label: "Verification habits", route: "#/ai/verify/verification-habits" },
        { label: "Team policy", route: "#/ai/verify/team-policy" }
      ],
      outline: [
        { title: "Context for the agents", items: [
          "Write a short AGENTS.md: build and test commands, architecture boundaries, conventions, hard 'nevers'.",
          "Keep secrets, customer data and environment-specific IDs out of rules files and prompts." ] },
        { title: "Workflow", items: [
          "Start with well-suited tasks: tests, mechanical refactors, small specified features.",
          "Plan-first prompts; tasks sized to what a human can review in one sitting." ] },
        { title: "Quality bar", items: [
          "Same review and CI gates as human code; the merger is accountable.",
          "Reviewers check tests first and look for invented APIs, swallowed errors and weakened tests." ] },
        { title: "Learn and measure", items: [
          "Disclose agent-heavy PRs; track rework and defect rates, not lines generated.",
          "Update the rules file from repeated corrections." ] }
      ]
    },
    {
      id: "risky-migration",
      title: "Replace a core component without a big bang",
      subtitle: "Swap the ORM, the queue or the auth library under a live system.",
      timebox: "30 min",
      prompt: "The service's homegrown job queue must be replaced with a managed queue. Hundreds of call sites enqueue jobs. Outline a migration that never needs a freeze.",
      related: [
        { label: "Branch by abstraction", route: "#/refac/scale/branch-by-abstraction" },
        { label: "Strangler fig", route: "#/refac/scale/strangler-fig" },
        { label: "Parallel change", route: "#/refac/smells/parallel-change" }
      ],
      outline: [
        { title: "Introduce the abstraction", items: [
          "Define a narrow JobQueue interface; adapt the old queue to it; move call sites with a codemod.",
          "Ship that alone: behaviour unchanged, tests green." ] },
        { title: "Build and switch", items: [
          "Implement the managed-queue adapter behind the same interface, with integration tests.",
          "Switch traffic by job type behind a flag; dual-run or shadow where safe; watch metrics." ] },
        { title: "Contract", items: [
          "Drain the old queue; delete the old adapter and the flag once traffic is zero for an agreed period.",
          "Record the decision and its consequences in an ADR." ] }
      ]
    }
  ],

  interview: [
    {
      id: "explain-tdd",
      title: "When do you use TDD, and when not?",
      timebox: "8 min",
      prompt: "Explain test-driven development and give an honest account of where it helps and where you would not use it.",
      links: [{ label: "TDD", route: "#/test/practice/tdd" }, { label: "Why test", route: "#/test/strategy/why-test" }],
      expected: [
        "Describes red, green, refactor in small steps, emphasising the refactor step.",
        "Names concrete benefits: tests seen to fail, API designed from the caller's side, small steps.",
        "Gives real exceptions: spikes, visual layout, thin framework glue \u2014 and says spikes get thrown away."
      ],
      followups: [
        "How do you TDD code that talks to a database?",
        "What do you do when the test is hard to write?",
        "Outside-in or inside-out \u2014 when each?"
      ]
    },
    {
      id: "merge-or-rebase",
      title: "Merge or rebase?",
      timebox: "6 min",
      prompt: "Your team argues about merge versus rebase. Explain the difference and propose a policy.",
      links: [{ label: "Merge vs rebase", route: "#/git/model/merge-vs-rebase" }, { label: "Interactive rebase", route: "#/git/model/interactive-rebase" }],
      expected: [
        "Merge preserves history with a two-parent commit; rebase replays commits with new hashes.",
        "Never rewrite shared history; rebase private branches freely; force-with-lease.",
        "Proposes one consistent integration strategy for main and explains why."
      ],
      followups: [
        "How would you recover from a rebase that went wrong?",
        "How does your policy affect git bisect?",
        "What do squash merges lose?"
      ]
    },
    {
      id: "review-big-pr",
      title: "You receive a 2,000-line PR",
      timebox: "6 min",
      prompt: "A colleague asks you to review a 2,000-line PR that mixes a refactor and a new feature. What do you do?",
      links: [{ label: "PR size", route: "#/review/flow/pr-size" }, { label: "Giving feedback", route: "#/review/feedback/giving-feedback" }],
      expected: [
        "Explains why review quality collapses at that size, without blaming the author.",
        "Proposes splitting: refactor PR first, then feature; or stacked PRs; offers to pair on the split.",
        "If it must ship, reviews intent, tests and risk first, and says what was not reviewed."
      ],
      followups: [
        "What if the deadline is tomorrow?",
        "How do you prevent this happening again?",
        "Which comments would be blocking?"
      ]
    },
    {
      id: "untestable-class",
      title: "Make this class testable",
      timebox: "8 min",
      prompt: "A class constructs its own HTTP client, reads the system clock and writes to a global cache. Talk through how you would make it testable with minimal risk.",
      links: [{ label: "Seams", route: "#/refac/legacy/seams" }, { label: "Dependency injection", route: "#/design/composition/dependency-injection" }, { label: "Functional core", route: "#/design/shape/core-shell" }],
      expected: [
        "Identifies the three dependencies and proposes parameterising the constructor with defaults.",
        "Passes time in, or injects a clock; wraps the cache behind an interface.",
        "Considers extracting decision logic into a pure function tested without doubles."
      ],
      followups: [
        "Mock or fake for the HTTP client?",
        "How do you keep existing callers unchanged?",
        "When is a DI container worth it?"
      ]
    },
    {
      id: "ai-code-trust",
      title: "How do you review AI-generated code?",
      timebox: "6 min",
      prompt: "Describe how you decide whether a diff produced by an AI coding agent is safe to merge.",
      links: [{ label: "Reviewing AI code", route: "#/ai/verify/reviewing-ai-code" }, { label: "Verification habits", route: "#/ai/verify/verification-habits" }],
      expected: [
        "Same bar as human code; the merger is accountable.",
        "Checks tests first for skips and weakened assertions; runs tests and the changed path.",
        "Looks for invented APIs, broad catches, scope creep and security shortcuts."
      ],
      followups: [
        "What do you put in a rules file?",
        "How do you size tasks for an agent?",
        "What data must never go into a prompt?"
      ]
    },
    {
      id: "write-adr",
      title: "Record a contested decision",
      timebox: "6 min",
      prompt: "Your team chose PostgreSQL over a document store after a long debate. How do you make sure the reasoning survives?",
      links: [{ label: "ADRs", route: "#/docs/decisions/adrs" }, { label: "Design docs", route: "#/docs/decisions/design-docs" }],
      expected: [
        "Writes an ADR in the repo: context, decision, alternatives with reasons, consequences.",
        "Includes the costs accepted and a trigger to revisit.",
        "Explains supersession rather than editing accepted ADRs."
      ],
      followups: [
        "Which decisions deserve an ADR?",
        "How is an ADR different from a design doc?",
        "What happens when the decision changes?"
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Safety: keeps the system working at every step (tests, small steps, reversibility).",
      "Judgement: applies principles where they pay off and explains trade-offs honestly.",
      "Precision: uses terms correctly and gives concrete examples, commands or numbers.",
      "Collaboration: considers reviewers, teammates and future readers.",
      "Pragmatism: delivers value now without creating avoidable debt."
    ],
    bands: [
      { id: "band-junior", title: "Developing", summary: "Knows the vocabulary but applies it uniformly or by rote.",
        signals: ["Recites SOLID or the pyramid without saying when it matters.", "Proposes rewrites or big-bang changes.", "Treats tests and review as gates, not tools."] },
      { id: "band-solid", title: "Solid", summary: "Applies practices correctly in common situations and explains why.",
        signals: ["Uses small green steps and separates refactors from features.", "Chooses test levels and doubles deliberately.", "Writes specific, labelled review comments."] },
      { id: "band-strong", title: "Strong", summary: "Adapts practices to context and names the costs of each choice.",
        signals: ["Says when not to apply a principle, with a reason.", "Plans migrations as expand, migrate, contract with evidence at each step.", "Thinks about the team: norms, automation, documentation."] },
      { id: "band-lead", title: "Leading", summary: "Shapes how a team works, not just their own code.",
        signals: ["Turns recurring problems into tooling, checklists or rules files.", "Measures outcomes such as review time, flake rate and rework.", "Leaves decisions recorded and the codebase easier for the next person."] }
    ]
  },

  cheatsheets: [
    { id: "smells-moves", title: "Smells and the move that fixes them", summary: "Match the smell to the first refactoring to try.",
      items: ["Long function \u2192 extract function", "Large class \u2192 extract class by reason to change", "Feature envy \u2192 move method", "Primitive obsession \u2192 value object", "Long parameter list \u2192 parameter object", "Switch that grows \u2192 table or polymorphism", "Shotgun surgery \u2192 move related pieces together", "Speculative generality \u2192 inline and delete"] },
    { id: "doubles", title: "Test doubles at a glance", summary: "Pick the double by what the collaborator does.",
      items: ["Dummy: fills a slot, never used", "Stub: canned answers for queries", "Spy: records calls for later assertions", "Mock: expectations verified by the double", "Fake: working lightweight implementation", "Rule: stub queries, verify commands, fake infrastructure"] },
    { id: "git-rescue", title: "Git rescue commands", summary: "The commands that get you out of trouble.",
      items: ["git reflog \u2014 where HEAD has been", "git branch rescue <hash> \u2014 label a lost commit", "git rebase --abort \u2014 back out of a rebase", "git reset --hard HEAD@{1} \u2014 undo the last HEAD move", "git bisect start / good / bad / run / reset", "git push --force-with-lease \u2014 safe force push", "git worktree add ../dir <branch> \u2014 parallel checkout", "git cherry-pick -x <hash> \u2014 backport with provenance"] },
    { id: "review-labels", title: "Review comment labels", summary: "Label every comment so authors can triage.",
      items: ["blocking \u2014 must change: correctness, security, data loss", "question \u2014 please explain, maybe in code", "suggestion \u2014 author's call", "nit \u2014 tiny, optional", "praise \u2014 worth repeating"] },
    { id: "agent-prompt", title: "Agent task prompt checklist", summary: "Six parts that remove guesswork.",
      items: ["Goal and why", "Where to look, with an example file", "Constraints and non-negotiables", "Out of scope", "Definition of done with named tests", "Ask for evidence: test output and assumptions"] },
    { id: "adr-template", title: "ADR template", summary: "One page, in the repo, append-only.",
      items: ["Title with number", "Status (Proposed, Accepted, Superseded by \u2026)", "Context: forces and constraints", "Decision: active voice", "Alternatives and why not", "Consequences: easier, harder, when to revisit"] }
  ],

  glossary: [
    { id: "g-refactoring", term: "Refactoring", definition: "Changing the structure of code without changing its observable behaviour.", useIt: "\"This PR is a pure refactor; the behaviour change follows in the next one.\"", links: [{ label: "Safe steps", route: "#/refac/smells/safe-steps" }] },
    { id: "g-seam", term: "Seam", definition: "A place where behaviour can be changed without editing the code at that point, such as a constructor parameter.", useIt: "\"I'll add a seam for the clock so we can test the expiry logic.\"", links: [{ label: "Seams", route: "#/refac/legacy/seams" }] },
    { id: "g-characterization", term: "Characterization test", definition: "A test that pins what code currently does, used as a safety net before changing legacy code.", useIt: "\"Let's characterize the fee calculation before we touch it.\"", links: [{ label: "Characterization", route: "#/refac/legacy/characterization" }] },
    { id: "g-strangler", term: "Strangler fig", definition: "Incrementally replacing a system by routing capabilities one at a time to a new implementation behind a facade.", useIt: "\"We'll strangle the billing monolith route by route instead of rewriting it.\"", links: [{ label: "Strangler fig", route: "#/refac/scale/strangler-fig" }] },
    { id: "g-parallel-change", term: "Parallel change (expand/contract)", definition: "Making a breaking change in three non-breaking deploys: add the new form, migrate users, remove the old form.", useIt: "\"Expand this release, contract once dashboards show no reads of the old column.\"", links: [{ label: "Parallel change", route: "#/refac/smells/parallel-change" }] },
    { id: "g-test-double", term: "Test double", definition: "Any stand-in for a real collaborator in a test: dummy, stub, spy, mock or fake.", useIt: "\"A fake repository is simpler than mocking every call here.\"", links: [{ label: "Test doubles", route: "#/test/practice/test-doubles" }] },
    { id: "g-flaky", term: "Flaky test", definition: "A test that passes and fails on the same code because of uncontrolled nondeterminism.", useIt: "\"Quarantine it with an owner; don't add a retry.\"", links: [{ label: "Flaky tests", route: "#/test/practice/flaky-tests" }] },
    { id: "g-mutation", term: "Mutation score", definition: "The share of deliberately injected bugs that the test suite detects.", useIt: "\"Coverage is 95% but the mutation score is 60%, so the assertions are weak.\"", links: [{ label: "Mutation testing", route: "#/test/advanced/mutation-testing" }] },
    { id: "g-property", term: "Property-based test", definition: "A test that asserts an invariant over many generated inputs and shrinks failures to minimal examples.", useIt: "\"A round-trip property would cover the encoder better than ten examples.\"", links: [{ label: "Property-based testing", route: "#/test/advanced/property-based" }] },
    { id: "g-contract", term: "Contract test", definition: "A test that checks a provider still satisfies the requests and responses a consumer relies on.", useIt: "\"The contract test caught the renamed field before deploy.\"", links: [{ label: "Test levels", route: "#/test/strategy/test-levels" }] },
    { id: "g-reflog", term: "Reflog", definition: "Git's local record of where HEAD and branches pointed, used to recover lost commits.", useIt: "\"It's in the reflog; I'll put a branch on it.\"", links: [{ label: "Reflog", route: "#/git/recover/reflog" }] },
    { id: "g-bisect", term: "Bisect", definition: "Binary search through history to find the commit that introduced a change in behaviour.", useIt: "\"Let's bisect with the failing test as the script.\"", links: [{ label: "Bisect", route: "#/git/recover/bisect" }] },
    { id: "g-core-shell", term: "Functional core, imperative shell", definition: "Structuring code so pure decision logic is separate from the thin layer that performs I/O.", useIt: "\"Move the renewal decision into the core and pass today's date in.\"", links: [{ label: "Core and shell", route: "#/design/shape/core-shell" }] },
    { id: "g-composition-root", term: "Composition root", definition: "The single place near the entry point where concrete dependencies are constructed and wired.", useIt: "\"Only the composition root should know we use the live gateway.\"", links: [{ label: "Dependency injection", route: "#/design/composition/dependency-injection" }] },
    { id: "g-adr", term: "ADR", definition: "Architecture decision record: a short document capturing a significant decision with context, alternatives and consequences.", useIt: "\"Write it up as ADR-015 and link it from the PR.\"", links: [{ label: "ADRs", route: "#/docs/decisions/adrs" }] },
    { id: "g-rules-file", term: "Rules file (AGENTS.md)", definition: "A committed file that gives AI coding agents project conventions, commands and constraints at the start of every session.", useIt: "\"Add 'never skip failing tests' to AGENTS.md.\"", links: [{ label: "Rules files", route: "#/ai/setup/rules-files" }] },
    { id: "g-trunk", term: "Trunk-based development", definition: "A branching practice where everyone integrates small changes into main at least daily, hiding unfinished work behind flags.", useIt: "\"Let's merge this behind a flag today instead of keeping a branch for two weeks.\"", links: [{ label: "Trunk-based development", route: "#/git/flow/trunk-based" }] },
    { id: "g-semver", term: "Semantic versioning", definition: "MAJOR.MINOR.PATCH version numbers that promise breaking, compatible-feature and compatible-fix changes respectively.", useIt: "\"Removing that method is a breaking change, so it has to wait for 3.0.\"", links: [{ label: "Dependencies and semver", route: "#/design/interfaces/dependency-semver" }] },
    { id: "g-idempotency", term: "Idempotency", definition: "The property that performing an operation many times has the same effect as performing it once.", useIt: "\"Pass an idempotency key so a retried charge can't bill twice.\"", links: [{ label: "Concurrency pitfalls", route: "#/clean/ops/concurrency-pitfalls" }] },
    { id: "g-tech-debt", term: "Technical debt", definition: "The gap between the current code and code that would make today's work easy, with ongoing interest paid on every change.", useIt: "\"This debt costs us about two days per pricing change; here's a four-step plan.\"", links: [{ label: "Communicating tech debt", route: "#/docs/planning/tech-debt-comms" }] },
    { id: "g-codeowners", term: "CODEOWNERS", definition: "A repository file mapping paths to owning teams for automatic, and optionally required, review.", useIt: "\"Add payments/ to CODEOWNERS so security reviews every change there.\"", links: [{ label: "Code ownership", route: "#/review/team/code-ownership" }] },
    { id: "g-skill", term: "Agent skill", definition: "A packaged procedure (steps, checks, scripts, example) that a coding agent loads when a matching task appears.", useIt: "\"Turn the migration checklist into a skill so the agent follows it every time.\"", links: [{ label: "Skills and verification loops", route: "#/ai/habits/skills-context" }] }
  ]
};
