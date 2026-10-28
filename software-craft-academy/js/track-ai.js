/* =====================================================================
   CHISEL · Working with AI Coding Agents
   window.TRACKS.ai — modules: setup / prompting / verify
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* aiDiffReviewer — review an agent's diff line by line */
  Widgets.aiDiffReviewer = function (mount) {
    K.lineSpotter(mount, {
      pill: "ai diff",
      title: "Review the agent's diff",
      desc: "You asked an agent to 'add retry to the payment client'. Click each line that should not be merged as is. Typical AI mistakes are plausible-looking: invented APIs, swallowed errors, scope creep and weakened tests.",
      snippets: [
        { id: "client", label: "payment_client.py", intro: "Diff of payment_client.py (added lines shown).", lines: [
          { code: "import time", why: "Fine: used for the backoff sleep." },
          { code: "from httpx import RetryPolicy", issue: "Invented API", why: "The agent imported a class that does not exist in that library. Plausible names are the most common hallucination; run the code or check the library before trusting it." },
          { code: "def charge(self, amount_cents, idempotency_key):", why: "Good: an idempotency key makes retries safe for payments." },
          { code: "    for attempt in range(3):", why: "A bounded retry count. Fine." },
          { code: "        try:", why: "Fine." },
          { code: "            return self._post(\"/charges\", amount_cents, idempotency_key)", why: "Passes the idempotency key through. Good." },
          { code: "        except Exception:", issue: "Retries everything", why: "Retrying on every exception also retries card declines and validation errors. Retry only timeouts and 5xx responses." },
          { code: "            time.sleep(2 ** attempt)", why: "Exponential backoff. Adding jitter would be better, but this is acceptable." },
          { code: "    return None", issue: "Swallowed failure", why: "After three failures the caller gets None and may treat the order as paid or silently drop it. Raise a clear error instead." },
          { code: "    # also refactored currency formatting while here", issue: "Scope creep", why: "Unrequested changes hide inside the diff and need their own review. Ask for them in a separate change." }
        ] },
        { id: "tests", label: "test_payment_client.py", intro: "Diff of the tests the agent changed to make CI pass.", lines: [
          { code: "def test_charge_retries_on_timeout(fake_http):", why: "A focused new test. Good." },
          { code: "    fake_http.fail_times(2, with_error=Timeout())", why: "Simulates the exact failure mode. Good." },
          { code: "    assert client.charge(500, \"key-1\") is not None", issue: "Weak assertion", why: "'is not None' passes for almost any result. Assert the charge id and that exactly three calls were made with the same idempotency key." },
          { code: "@pytest.mark.skip(reason=\"flaky\")", issue: "Disabled a test", why: "Agents sometimes make CI green by skipping or loosening tests. Any skipped test in an AI diff needs an explicit human decision." },
          { code: "def test_declined_card_is_not_retried(fake_http):", issue: "Test now expects retries", why: "The test body was changed to expect three attempts on a decline, which matches the bug instead of the requirement. Reject and restore the original expectation." }
        ] }
      ]
    });
  };

  /* aiPromptGrader — assemble a task prompt and see what it covers */
  var PROMPT_PARTS = [
    { key: "goal", label: "Goal and why", text: "Add retry with backoff to PaymentClient.charge so brief provider timeouts stop failing checkouts.", weight: 20 },
    { key: "context", label: "Where to look", text: "Code is in payments/payment_client.py; follow the pattern in shipping/client.py, which already retries.", weight: 15 },
    { key: "constraints", label: "Constraints", text: "Retry only on timeouts and 5xx. Never retry declines. Reuse the existing idempotency key. No new dependencies.", weight: 20 },
    { key: "scope", label: "Out of scope", text: "Do not change other files or refactor formatting.", weight: 10 },
    { key: "done", label: "Definition of done", text: "Add tests for timeout-then-success, decline-not-retried and retries-exhausted-raises. All existing tests must still pass unchanged.", weight: 20 },
    { key: "verify", label: "Verification ask", text: "Run the test suite and show me the output. List any assumptions you made.", weight: 15 }
  ];
  Widgets.aiPromptGrader = function (mount) {
    K.shell(mount, "prompt", "Task prompt grader",
      "Start from the one-liner 'add retry to payments' and switch on the parts of a good task prompt. The grader estimates how much the agent has to guess, and so how much you will have to review and rework.");
    var on = {};
    var controls = h("div", { class: "widget-controls", style: "display:grid;gap:6px" });
    var stage = h("div", { class: "w-stage" });
    var feedback = h("div", { style: "margin-top:10px" });
    var readout = h("div", { class: "w-readout" });
    PROMPT_PARTS.forEach(function (p) {
      on[p.key] = false;
      controls.appendChild(K.toggle(p.label, false, function (v) { on[p.key] = v; paint(); }));
    });
    function paint() {
      clear(stage); clear(feedback); clear(readout);
      var parts = ["Add retry to payments."];
      var score = 0;
      PROMPT_PARTS.forEach(function (p) { if (on[p.key]) { parts.push(p.text); score += p.weight; } });
      if (score > 0) parts.shift();
      stage.appendChild(K.mono(parts.join("\n\n")));
      var tone = score >= 80 ? "good" : score >= 45 ? "meh" : "bad";
      var msg = score >= 80 ? "Agent can work mostly unsupervised; review focuses on logic, not intent." :
        score >= 45 ? "Better, but the agent will still guess at some decisions. Expect a round of rework." :
        "The agent must guess what, where and when it is done. Expect plausible but wrong code.";
      feedback.appendChild(K.badge(msg, tone));
      var missing = PROMPT_PARTS.filter(function (p) { return !on[p.key]; }).map(function (p) { return p.label.toLowerCase(); });
      readout.appendChild(ro("prompt score", score + " / 100"));
      readout.appendChild(ro("guesses left to the agent", missing.length));
      readout.appendChild(ro("expected review effort", score >= 80 ? "low" : score >= 45 ? "medium" : "high"));
    }
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(feedback); mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ai-habits": {
      title: "Skills & healthy reliance checkpoint",
      sub: "Rules vs skills, context, verification loops and avoiding over-reliance.",
      questions: [
        { q: "How does a skill differ from a rules file?", options: ["Rules are always-on project context; a skill is a packaged procedure the agent loads when a matching task appears", "They are the same", "Skills contain secrets", "Rules only work in CI"], answer: 0,
          explain: "Rules set standing conventions for every session. Skills bundle steps, scripts and references for a specific kind of task, loaded on demand to save context." },
        { q: "Which is the best candidate for a skill?", options: ["'Write clean code'", "A one-off bug fix", "A repeatable procedure such as 'add a new database migration' with steps, checks and an example", "A list of team members"], answer: 2,
          explain: "Skills pay off for recurring, multi-step tasks where the right procedure is not obvious from the code. Vague advice belongs nowhere." },
        { q: "What makes a verification loop effective for an agent?", options: ["Asking the agent if it is sure", "Longer prompts", "Disabling tests", "A fast, objective check the agent can run itself, such as tests, a type check or a script, with failures fed back"], answer: 3,
          explain: "Agents iterate well against concrete signals. Self-assessment is not evidence; a red test is." },
        { q: "A sign of unhealthy over-reliance on coding agents is…", options: ["Using them for boilerplate", "Merging code you cannot explain, and being unable to debug the area without the agent", "Writing good prompts", "Reviewing diffs carefully"], answer: 1,
          explain: "If understanding has moved entirely to the tool, you cannot judge its output or handle incidents. Keep the ability to reason about the code yourself." },
        { q: "Which practice helps juniors grow while using agents?", options: ["Ban agents entirely", "Let the agent write everything", "Have them predict or sketch a solution first, then compare with the agent's and explain the differences", "Skip code review for AI code"], answer: 2,
          explain: "Active comparison builds judgement; passive acceptance does not. Explaining differences in review turns agent output into a learning tool." }
      ]
    },
    "ai-setup": {
      title: "Agent setup checkpoint",
      sub: "Mental model and rules files.",
      questions: [
        { q: "Which mental model of an AI coding agent is most useful day to day?", options: ["A fast, well-read collaborator that produces plausible output and needs clear direction and verification", "An infallible senior engineer", "A search engine", "A compiler"], answer: 0,
          explain: "Agents are strong at producing code that looks right. Treating output as a draft from a capable but context-poor collaborator sets the right level of trust." },
        { q: "What belongs in a rules file such as AGENTS.md?", options: ["Secrets the agent needs", "The whole codebase", "Daily task lists", "Durable project conventions: how to build and test, architecture boundaries, coding standards, things to never do"], answer: 3,
          explain: "Rules files give every session the context a new teammate would need. Credentials never belong there, since rules files are committed and shared." },
        { q: "Why keep rules files short and specific?", options: ["Agents cannot read long files", "Every line competes for the agent's attention and context; vague or stale rules get ignored or cause confusion", "Git limits file size", "They are public"], answer: 1,
          explain: "A focused list of real conventions works better than an essay. Review rules files like code and delete rules that no longer apply." },
        { q: "Which is a good rule to give an agent?", options: ["'Run make test before declaring a task done; never edit files under migrations/ without asking'", "'Write good code'", "'Be careful'", "'Use best practices'"], answer: 0,
          explain: "Concrete, checkable instructions change behaviour. Vague exhortations do not." },
        { q: "An agent asks for a production database password to debug an issue. The right response is…", options: ["Paste it into the chat", "Put it in AGENTS.md", "Refuse; give it read-only access to a safe environment or sample data through approved tooling, and keep secrets out of prompts and files", "Hardcode it temporarily"], answer: 2,
          explain: "Anything in a prompt or file may be logged, cached or committed. Least privilege and approved secret handling apply to agents exactly as to people." }
      ]
    },
    "ai-prompting": {
      title: "Prompting for code checkpoint",
      sub: "Task prompts and sizing work for agents.",
      questions: [
        { q: "Which addition most improves a coding prompt?", options: ["'Please' and 'thank you'", "More exclamation marks", "Asking it to be creative", "A definition of done with the tests that must pass"], answer: 3,
          explain: "A checkable definition of done tells the agent when to stop and gives you an objective review target." },
        { q: "Why point the agent to an existing example in the codebase?", options: ["To save tokens", "Following an established local pattern produces code consistent with the rest of the system", "Agents cannot write new code", "It is required"], answer: 1,
          explain: "Local examples carry conventions no general instruction captures, such as error handling style and logging. Consistency also makes review faster." },
        { q: "What is the best size for a task handed to an agent?", options: ["The whole epic at once", "One character", "A change small enough that you can review the resulting diff carefully in one sitting", "Whatever fits the context window"], answer: 2,
          explain: "Review capacity, not generation speed, is the bottleneck. Small tasks keep diffs reviewable and failures cheap to discard." },
        { q: "The agent's first attempt went in the wrong direction. Often the most efficient move is…", options: ["Discard the attempt, improve the prompt with what you learned, and start again", "Keep adding corrections in the same thread", "Merge it and fix later", "Switch off tests"], answer: 0,
          explain: "Long correction threads accumulate confusion. A fresh start with a better prompt is usually faster and yields a cleaner diff." },
        { q: "Asking the agent to plan before coding helps because…", options: ["It is slower", "Plans are always correct", "It avoids tests", "You can catch a wrong approach in a short plan instead of a long diff"], answer: 3,
          explain: "Reviewing a five-line plan is cheap. Course-correcting there avoids reviewing and discarding hundreds of lines of code." }
      ]
    },
    "ai-verify": {
      title: "Verification checkpoint",
      sub: "Reviewing AI code, verification habits and team policy.",
      questions: [
        { q: "Which issue is especially common in AI-generated code?", options: ["Syntax errors in every line", "Plausible calls to APIs, flags or functions that do not exist", "Too many comments", "Missing semicolons"], answer: 1,
          explain: "Models produce likely-looking names. Running the code and checking unfamiliar APIs against real documentation or source catches these quickly." },
        { q: "An agent made CI pass by marking a failing test as skipped. You should…", options: ["Treat it as a red flag: restore the test and require the agent or a human to fix the real cause", "Merge, since CI is green", "Delete the test", "Skip more tests"], answer: 0,
          explain: "Weakening tests to get green is a known failure mode. Any change to existing tests in an AI diff deserves explicit scrutiny." },
        { q: "Who is accountable for AI-generated code once it is merged?", options: ["The model vendor", "Nobody", "The engineer who merged it, exactly as for any other code", "The reviewer bot"], answer: 2,
          explain: "Tools do not carry responsibility. If you cannot explain a line of code, you should not merge it." },
        { q: "Which verification habit gives the most confidence for an AI change?", options: ["Reading the agent's summary", "Trusting a confident explanation", "Checking the diff is small", "Running the tests and the changed code path yourself, and reading the full diff"], answer: 3,
          explain: "Agent summaries describe what it intended, not necessarily what it did. Evidence from running the code beats any explanation." },
        { q: "A sensible team policy for AI coding agents includes…", options: ["No review for AI code", "The same review and test bar as human code, clear rules on data and secrets, and disclosure in the PR when an agent did substantial work", "Banning all tools", "Letting agents push to main"], answer: 1,
          explain: "Policy should keep the existing quality gates and add the specific risks of agents: data handling, licensing and over-trust. Disclosure helps reviewers calibrate." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ai = {
    id: "ai",
    name: "Working with AI Coding Agents",
    short: "AI",
    tagline: "Faster drafts, same engineering bar",
    color: "#86efac",
    blurb: "Use AI coding agents as a craft tool: a realistic mental model, rules files like AGENTS.md, prompts that specify goal, constraints and done, tasks sized for review, and the verification habits and team policy that keep plausible-looking code from reaching production unchecked.",
    modules: [
      {
        id: "setup",
        name: "Mental Model & Rules Files",
        icon: "compass",
        lessons: [
          {
            id: "mental-model",
            title: "A working mental model of coding agents",
            summary: "What agents are good at, where they fail, and how that changes the shape of your work.",
            minutes: 10,
            tags: ["ai-agents", "mental-model", "llm"],
            blocks: [
              { t: "p", html: "A coding agent reads files, proposes edits, runs commands and iterates toward a goal you describe. It is extremely fast at producing code that <strong>looks</strong> right. Whether it <strong>is</strong> right depends on the context you gave it and the checks you run afterwards." },
              { t: "table", headers: ["Agents are strong at", "Agents are weak at"], rows: [
                ["Boilerplate, glue code, test scaffolding", "Knowing your unwritten conventions and history"],
                ["Applying a pattern across many files", "Noticing a requirement you did not state"],
                ["Explaining unfamiliar code", "Saying 'I don't know' instead of guessing"],
                ["Fast first drafts and alternatives", "Judging trade-offs specific to your users"],
                ["Mechanical refactors with tests in place", "Resisting the urge to make CI green by any means"]
              ] },
              { t: "p", html: "The practical consequence: <strong>your job shifts from typing to specifying and verifying</strong>. The skills in the rest of this atlas \u2014 small steps, tests as a safety net, careful review, clear writing \u2014 become more valuable, not less." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Lumen, the LLM atlas, explains how agents work inside \u2014 the agent loop, tools, skills, MCP and rules \u2014 in its <em>Skills, Tools &amp; Agents</em> track. Codex, the DSA atlas, has tracks on solving coding problems with an AI pair." },
              { t: "note", variant: "key", html: "<strong>Treat agent output as a fast, plausible draft.</strong> You own the specification and the verification; the agent owns the typing." }
            ]
          },
          {
            id: "rules-files",
            title: "Rules files: AGENTS.md and friends",
            summary: "Giving every agent session the project context a new teammate would need, without leaking secrets.",
            minutes: 10,
            tags: ["agents-md", "rules", "context", "conventions"],
            blocks: [
              { t: "p", html: "Each agent session starts with no memory of your project. A <strong>rules file</strong> \u2014 such as <code class='tok'>AGENTS.md</code> at the repo root, or tool-specific rule folders \u2014 is loaded automatically and tells the agent what a good new teammate would learn in their first week." },
              { t: "code", lang: "text", code:
                "# AGENTS.md\n\n" +
                "## Build and test\n" +
                "- Install: make setup   - Test: make test (must pass before you say done)\n" +
                "- Lint/format: make lint (auto-fixes)\n\n" +
                "## Architecture\n" +
                "- Domain logic lives in core/ and must not import from adapters/.\n" +
                "- All DB access goes through repositories in adapters/db/.\n\n" +
                "## Conventions\n" +
                "- Money is integer cents, never floats.\n" +
                "- Follow the error-handling pattern in core/errors.py.\n\n" +
                "## Never\n" +
                "- Never edit migrations/ or .github/ without asking.\n" +
                "- Never add credentials, tokens or real customer data to code, tests or prompts.\n" +
                "  Config comes from environment variables; see .env.example (dummy values only).\n" +
                "- Never skip or weaken a failing test to make CI pass."
              },
              { t: "table", headers: ["Put in", "Keep out"], rows: [
                ["How to build, test and lint", "Secrets, tokens, connection strings with passwords"],
                ["Architecture boundaries", "Long essays and generic advice"],
                ["Local conventions with an example file", "Rules that duplicate what a linter already enforces"],
                ["Hard 'never do' rules", "Environment-specific IDs that change between stages"],
                ["Where to find more context", "Stale instructions nobody has checked"]
              ] },
              { t: "note", variant: "warn", html: "Rules files are committed and read by tools that may log or cache context. Treat them as public: no credentials, no personal data, no internal-only hostnames that should not leave the team." },
              { t: "note", variant: "tip", html: "When you correct an agent twice for the same thing, add a rule. When a rule stops being true, delete it in the same PR that changed the convention." },
              { t: "quiz", id: "ai-setup" },
              { t: "note", variant: "key", html: "<strong>A rules file is onboarding for agents.</strong> Build commands, boundaries, conventions and hard 'nevers' \u2014 short, specific, reviewed like code, and never containing secrets." }
            ]
          }
        ]
      },
      {
        id: "prompting",
        name: "Prompting & Task Sizing",
        icon: "bolt",
        lessons: [
          {
            id: "prompting",
            title: "Prompting for code",
            summary: "Goal, context, constraints, scope and definition of done \u2014 the parts of a task prompt that remove guesswork.",
            minutes: 11,
            tags: ["prompting", "specification", "ai-agents"],
            blocks: [
              { t: "p", html: "Every decision you leave out of a prompt, the agent makes for you \u2014 confidently. A good task prompt reads like a well-written ticket: it states the <strong>goal and why</strong>, <strong>where to look</strong>, <strong>constraints</strong>, what is <strong>out of scope</strong>, and how you will know it is <strong>done</strong>." },
              { t: "widget", id: "aiPromptGrader" },
              { t: "compare",
                bad: { title: "Under-specified", items: ["'Add retry to payments'", "Agent picks what to retry", "Agent picks which files to touch", "Agent decides when it is done"] },
                good: { title: "Specified", items: ["Goal plus reason", "Retry only timeouts and 5xx, reuse idempotency key", "Only payment_client.py; follow shipping/client.py", "Three named tests; existing tests unchanged; show test output"] } },
              { t: "h", text: "Useful prompt moves" },
              { t: "ul", items: [
                "<strong>Plan first:</strong> \"Propose a plan and wait for my OK before editing.\"",
                "<strong>Point at an example:</strong> \"Follow the pattern in <code class='tok'>shipping/client.py</code>.\"",
                "<strong>Ask for assumptions:</strong> \"List anything you assumed.\"",
                "<strong>Ask for evidence:</strong> \"Run the tests and paste the output.\""
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Lumen, the LLM atlas, covers prompt structure in general in its <em>Prompt Engineering</em> track; this lesson is the coding-specific subset." },
              { t: "note", variant: "key", html: "<strong>Write prompts like good tickets.</strong> Goal and why, where to look, constraints, out of scope, and a checkable definition of done." }
            ]
          },
          {
            id: "task-sizing",
            title: "Sizing and sequencing work for agents",
            summary: "Small, reviewable tasks; plans before diffs; and knowing when to discard and restart.",
            minutes: 9,
            tags: ["task-sizing", "workflow", "ai-agents"],
            blocks: [
              { t: "p", html: "Agents can generate a thousand lines in a minute. You cannot review a thousand lines in a minute. <strong>Your review capacity is the bottleneck</strong>, so size tasks to what you can verify carefully \u2014 the same instinct as keeping PRs small." },
              { t: "table", headers: ["Task shape", "Fit for an agent"], rows: [
                ["Add tests around an existing function", "Excellent: easy to verify"],
                ["Apply a known refactor across many files", "Good with tests in place; review a sample plus the test run"],
                ["Implement a small, well-specified feature", "Good with a clear definition of done"],
                ["Ambiguous redesign across services", "Poor: split into a plan, then small steps"],
                ["Security-sensitive changes (auth, crypto, payments)", "Possible, with the strictest review"]
              ] },
              { t: "h", text: "A loop that works" },
              { t: "ol", items: [
                "Ask for a short plan. Correct it \u2014 cheaply.",
                "Let the agent implement one step.",
                "Review the diff and the test output. Commit if good.",
                "If it went wrong, discard and re-prompt with what you learned rather than patching a confused thread.",
                "Repeat."
              ] },
              { t: "note", variant: "tip", html: "Separate worktrees or branches let an agent work on one task while you review another, with no risk of the two diffs mixing." },
              { t: "quiz", id: "ai-prompting" },
              { t: "note", variant: "key", html: "<strong>Size tasks to your review capacity, not the agent's speed.</strong> Plan first, implement one step at a time, and restart rather than argue with a confused session." }
            ]
          }
        ]
      },
      {
        id: "verify",
        name: "Verification & Policy",
        icon: "shield",
        lessons: [
          {
            id: "reviewing-ai-code",
            title: "Reviewing AI-generated code",
            summary: "The failure modes that look most plausible, and a review pass tuned to catch them.",
            minutes: 12,
            tags: ["code-review", "ai-agents", "hallucinations", "verification"],
            blocks: [
              { t: "p", html: "Reviewing AI code needs everything from the Code Review track, plus attention to failure modes that are rare in human code but common in generated code \u2014 because the code is fluent, these slip past a skim." },
              { t: "table", headers: ["Failure mode", "What it looks like", "Check"], rows: [
                ["Invented APIs", "A plausible import, flag or method that does not exist", "Run it; look up unfamiliar names"],
                ["Swallowed errors", "Broad catch, return None or empty", "Trace every failure path"],
                ["Weakened tests", "Skipped tests, loosened assertions, changed expectations", "Diff the test files first"],
                ["Scope creep", "'While I was here' refactors", "Reject or split unrequested changes"],
                ["Confident wrong summaries", "Explanation claims behaviour the code lacks", "Trust the diff and test output, not the summary"],
                ["Security shortcuts", "Disabled TLS checks, permissive CORS, secrets inline", "Search the diff for these patterns explicitly"],
                ["Duplicate helpers", "Reimplements a utility the codebase already has", "Ask: does this already exist?"]
              ] },
              { t: "widget", id: "aiDiffReviewer" },
              { t: "note", variant: "trap", html: "The more polished the explanation, the more tempting it is to skim the diff. Read the tests first, then the code, and only then the summary." },
              { t: "note", variant: "key", html: "<strong>Review AI diffs for fluent mistakes.</strong> Invented APIs, swallowed errors, weakened tests and scope creep \u2014 check tests first and trust evidence over explanations." }
            ]
          },
          {
            id: "verification-habits",
            title: "Verification habits",
            summary: "Evidence over assurance: run it, test it, read it \u2014 every time.",
            minutes: 10,
            tags: ["verification", "testing", "ai-agents"],
            blocks: [
              { t: "p", html: "An agent saying \"done, all tests pass\" is a claim, not evidence. Build habits that turn each claim into something you have seen." },
              { t: "diagram", id: "agent-verify-loop", caption: "Specify, let the agent change code, then verify with tests, a run and a diff review before accepting; failures feed back into a sharper prompt." },
              { t: "ol", items: [
                "<strong>Run the tests yourself</strong> (or read real CI output), not the agent's paraphrase.",
                "<strong>Exercise the changed path</strong> once by hand or with a focused test.",
                "<strong>Read the whole diff</strong>, tests first, including files you did not expect to change.",
                "<strong>Check new dependencies</strong>: do they exist, are they maintained, is the licence acceptable?",
                "<strong>Explain it back</strong>: if you cannot explain a line, do not merge it."
              ] },
              { t: "code", lang: "bash", code:
                "git diff --stat main...HEAD          # what did it actually touch?\n" +
                "git diff main...HEAD -- '*test*'     # tests first: anything weakened or skipped?\n" +
                "make test                            # evidence, not a summary\n" +
                "git diff main...HEAD | grep -nE 'verify=False|skip\\(|TODO|password|secret'"
              },
              { t: "note", variant: "tip", html: "The strongest safety net for agent work is the same as for human work: a fast, trustworthy test suite. Investing in tests multiplies what you can safely delegate." },
              { t: "note", variant: "key", html: "<strong>Evidence over assurance.</strong> Run the tests, exercise the path, read the whole diff tests-first, and never merge a line you cannot explain." }
            ]
          },
          {
            id: "team-policy",
            title: "Team policy for AI-assisted development",
            summary: "Keep the quality bar, handle data and secrets safely, and make agent use visible.",
            minutes: 9,
            tags: ["policy", "governance", "ai-agents", "security"],
            blocks: [
              { t: "p", html: "Teams adopting agents do best with a short, explicit policy. Its job is not to slow things down but to keep the existing engineering bar while addressing the new risks." },
              { t: "table", headers: ["Policy area", "A sensible default"], rows: [
                ["Quality bar", "Same review, tests and CI gates as human-written code"],
                ["Accountability", "The engineer who merges owns the code"],
                ["Secrets and data", "No credentials or customer data in prompts, rules files or generated fixtures; use approved tools with least privilege"],
                ["Permissions", "Agents work on branches; no direct pushes to main or production access"],
                ["Disclosure", "Note in the PR when an agent wrote substantial parts, so reviewers calibrate"],
                ["Dependencies and licences", "New packages reviewed as usual; check licence and provenance"],
                ["Learning", "Share prompts and rules that work; update AGENTS.md from repeated corrections"]
              ] },
              { t: "note", variant: "warn", html: "The biggest risk is not bad code, it is <strong>reduced scrutiny</strong>: reviewers assuming the agent was careful, authors assuming the reviewer will catch it. Policy should make it explicit that neither assumption holds." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers the pipeline gates (secret scanning, dependency checks) that apply equally to agent changes, and Lumen's <em>Orchestration &amp; Safety</em> module covers agent permissions and guardrails." },
              { t: "quiz", id: "ai-verify" },
              { t: "note", variant: "key", html: "<strong>Same bar, new risks covered.</strong> Keep review and CI gates, keep secrets and data out of prompts, restrict agent permissions, and disclose agent work in PRs." }
            ]
          }
        ]
      },
      {
        id: "habits",
        name: "Skills & Healthy Reliance",
        icon: "trend",
        lessons: [
          {
            id: "skills-context",
            title: "Skills, context and verification loops",
            summary: "Package repeatable procedures as skills, feed agents the right context, and give them checks they can run.",
            minutes: 11,
            tags: ["skills", "context", "verification-loop", "ai-agents"],
            blocks: [
              { t: "p", html: "Rules files hold what is true for every task. Many teams also have recurring <em>procedures</em> \u2014 add a migration, release a library, create a new service \u2014 that need steps, scripts and examples. A <strong>skill</strong> packages such a procedure so an agent loads it only when the task calls for it." },
              { t: "table", headers: ["Mechanism", "Loaded", "Holds"], rows: [
                ["Rules file (AGENTS.md)", "Every session", "Conventions, commands, boundaries, hard 'nevers'"],
                ["Skill", "When a matching task appears", "A procedure: steps, checks, scripts, an example"],
                ["Tool / MCP server", "When the agent calls it", "Capabilities: query a tracker, read docs, run a linter"],
                ["Task prompt", "This task only", "Goal, constraints, definition of done"]
              ] },
              { t: "code", lang: "text", code:
                "skills/add-db-migration/SKILL.md\n" +
                "---\n" +
                "description: Use when adding or changing a database table or column.\n" +
                "---\n" +
                "1. Create the migration with `make migration name=<change>`; never edit applied ones.\n" +
                "2. Make it backward compatible with the running app (expand first; contract later).\n" +
                "3. Add or update the repository test in tests/db/.\n" +
                "4. Run `make db-test` and include the output in your summary.\n" +
                "Example: migrations/0042_add_email_normalized.sql"
              },
              { t: "h", text: "Verification loops agents can run" },
              { t: "p", html: "Agents improve dramatically when they can check their own work against an objective signal and iterate: <strong>tests, type checks, linters, a build, a script that diffs expected output</strong>. Put those commands in rules and skills, and make them fast. \"Are you sure?\" is not a check; a red test is." },
              { t: "note", variant: "warn", html: "Skills, rules and tool configs are shared files. Keep credentials out of them; tools that need access should use the approved secret mechanism with least privilege." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Lumen, the LLM atlas, explains how skills, MCP and rules are loaded and why context size matters in its <em>Skills, Tools &amp; Agents \u203a Skills, MCP &amp; Rules</em> module." },
              { t: "note", variant: "key", html: "<strong>Rules for standing context, skills for procedures, tools for capabilities, checks for truth.</strong> Give agents fast commands they can run to verify themselves." }
            ]
          },
          {
            id: "over-reliance",
            title: "Avoiding over-reliance",
            summary: "Keep your own understanding sharp, know when not to delegate, and grow juniors rather than replace their learning.",
            minutes: 9,
            tags: ["over-reliance", "learning", "judgement", "ai-agents"],
            blocks: [
              { t: "p", html: "Agents make producing code cheap. They do not make <strong>understanding</strong> cheap \u2014 and understanding is what you need to review output, debug incidents and make design decisions. Over-reliance is the slow loss of that understanding." },
              { t: "table", headers: ["Warning sign", "Healthier habit"], rows: [
                ["Merging code you could not explain", "Ask the agent to explain, then verify; or rewrite the part you do not understand"],
                ["Re-prompting until tests pass without knowing why they failed", "Read the failure first; form a hypothesis yourself"],
                ["Cannot debug the area without the agent", "Regularly work through problems by hand in core code"],
                ["Accepting the first design offered", "Ask for alternatives and trade-offs; decide yourself"],
                ["Juniors pasting output they cannot reason about", "Predict first, then compare with the agent and explain the difference"]
              ] },
              { t: "h", text: "When to do it yourself" },
              { t: "ul", items: [
                "Learning a new language, framework or domain \u2014 struggle is how understanding forms.",
                "Security-critical logic where subtle mistakes are expensive.",
                "Small changes where writing the prompt and reviewing the diff costs more than the edit.",
                "Debugging incidents, where you must build a model of the system anyway."
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Codex, the DSA atlas, practises problem solving with an AI pair while keeping the judgement your own." },
              { t: "quiz", id: "ai-habits" },
              { t: "note", variant: "key", html: "<strong>Delegate typing, not understanding.</strong> Never merge what you cannot explain, keep solving some problems yourself, and use agents to accelerate learning rather than skip it." }
            ]
          }
        ]
      }
    ]
  };
})();
