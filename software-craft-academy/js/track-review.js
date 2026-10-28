/* =====================================================================
   CHISEL · Code Review
   window.TRACKS.review — modules: purpose / feedback / flow
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* reviewPrSizer — how PR size changes review quality and wait time */
  Widgets.reviewPrSizer = function (mount) {
    K.shell(mount, "pr size", "PR size simulator",
      "Set the number of changed lines and whether the PR mixes refactoring with behaviour change. The model estimates review effort, how thoroughly a reviewer can realistically read it, and the chance a defect slips through. Illustrative numbers, but the curve shape matches common experience.");
    var lines = 200, mixed = false, described = true;
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:10px" });
    var readout = h("div", { class: "w-readout" });
    var val = h("b", {}, String(lines));
    var input = h("input", { type: "range", min: "10", max: "2000", step: "10", value: String(lines), "aria-label": "Changed lines", style: "width:100%;accent-color:var(--amber)" });
    input.addEventListener("input", function () { lines = Number(input.value); paint(); });
    controls.appendChild(K.toggle("Mixes refactor + feature", mixed, function (v) { mixed = v; paint(); }));
    controls.appendChild(K.toggle("Clear description", described, function (v) { described = v; paint(); }));
    stage.appendChild(h("label", { style: "display:grid;grid-template-columns:120px 1fr 60px;gap:10px;align-items:center;font-size:0.84rem;color:var(--text)" },
      h("span", {}, "Changed lines"), input, val));
    var out = h("div", { style: "display:grid;gap:8px" });
    stage.appendChild(out);
    function bar(label, pct, tone) {
      var bg = tone === "good" ? K.GOOD_BG : tone === "bad" ? K.BAD_BG : K.MEH_BG;
      return h("div", { style: "display:grid;grid-template-columns:150px 1fr 48px;gap:10px;align-items:center;font-size:0.82rem;color:var(--text)" },
        h("span", {}, label),
        h("div", { style: "height:14px;border-radius:7px;border:1px solid var(--line);background:var(--surface-2);overflow:hidden" },
          h("div", { style: "height:100%;width:" + Math.max(2, Math.min(100, pct)) + "%;background:" + bg })),
        h("b", { style: "font-family:var(--font-mono)" }, Math.round(pct) + "%"));
    }
    function paint() {
      val.textContent = String(lines);
      clear(out); clear(readout);
      var penalty = (mixed ? 1.4 : 1) * (described ? 1 : 1.25);
      var thoroughness = Math.max(5, 100 * Math.exp(-lines / 700) / penalty);
      var minutes = Math.round((lines / 8) * penalty + 5);
      var slip = Math.min(95, (100 - thoroughness) * 0.6 + (mixed ? 8 : 0));
      var waitHours = Math.round(2 + lines / 60);
      out.appendChild(bar("Thoroughness", thoroughness, thoroughness > 70 ? "good" : thoroughness > 40 ? "meh" : "bad"));
      out.appendChild(bar("Defect slip risk", slip, slip < 20 ? "good" : slip < 45 ? "meh" : "bad"));
      var tip;
      if (lines <= 400 && !mixed) tip = K.badge("Reviewable in one sitting. Ship it in this shape.", "good");
      else if (mixed) tip = K.badge("Split: a pure refactor PR first, then the behaviour change.", "meh");
      else tip = K.badge("Too big to read carefully. Stack it as smaller PRs or ship behind a flag.", "bad");
      out.appendChild(tip);
      readout.appendChild(ro("lines", lines));
      readout.appendChild(ro("review effort", minutes + " min"));
      readout.appendChild(ro("typical wait for review", waitHours + " h"));
      readout.appendChild(ro("comments per 100 lines", Math.max(0.3, 6 * Math.exp(-lines / 500)).toFixed(1)));
    }
    mount.appendChild(controls); mount.appendChild(stage); mount.appendChild(readout);
    paint();
  };

  /* reviewCommentCoach — pick the better review comment */
  Widgets.reviewCommentCoach = function (mount) {
    K.choiceDrill(mount, {
      pill: "feedback",
      title: "Comment coach",
      desc: "For each situation, choose the review comment you would rather receive. Good comments are specific, explain why, separate blocking from optional, and talk about the code, not the person.",
      items: [
        { prompt: "A function swallows every exception and returns an empty list.",
          options: ["Catching everything here hides real failures like a timeout, and callers will show 'no results'. Could we catch only NotFound and let the rest propagate? (blocking)", "This is wrong.", "Why would you do this?", "nit: maybe handle errors"], answer: 0,
          why: "It names the risk, the consequence and a concrete alternative, and labels the severity. The others are vague or personal." },
        { prompt: "You would have named a variable differently, but the current name is clear enough.",
          options: ["Rename this to something better.", "Blocking: rename.", "nit (non-blocking): `pendingOrders` might read slightly clearer than `list2`; your call.", "Leave no comment and approve resentfully."], answer: 2,
          why: "Prefixing with 'nit' and saying it is the author's call keeps taste from blocking a merge. If it truly is clear enough, skipping the comment is also fine." },
        { prompt: "The PR adds a new endpoint with no authorization check.",
          options: ["Looks good to me!", "Have you thought about security?", "Consider adding some tests.", "This endpoint returns any user's invoices to any logged-in caller. Please add an ownership check and a test for the cross-user case before merge."], answer: 3,
          why: "Security gaps are blocking and must be explicit: what is exposed, to whom, and what would fix it. A vague question lets it ship." },
        { prompt: "You do not understand why a retry loop uses a jittered backoff.",
          options: ["Remove the jitter, it is confusing.", "Question: what is the jitter protecting against here? If it is the thundering-herd case, a short comment in the code would help the next reader.", "This is overengineered.", "?"], answer: 1,
          why: "Asking a genuine question invites explanation and often ends with a useful code comment. Assuming it is wrong skips the chance to learn." },
        { prompt: "The author did a careful job splitting a big migration into safe steps.",
          options: ["(say nothing)", "Fine.", "Really nice split \u2014 expand and contract in separate deploys makes this easy to roll back. Approving.", "Finally a good PR."], answer: 2,
          why: "Specific praise reinforces the practice you want repeated. Backhanded or empty approvals teach nothing." }
      ]
    });
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "review-team": {
      title: "Ownership & collaboration checkpoint",
      sub: "Code ownership, CODEOWNERS, pairing and mobbing.",
      questions: [
        { q: "What does strong code ownership risk compared with collective ownership?", options: ["Bottlenecks and silos: changes wait for one person and knowledge concentrates", "Nothing", "Too many reviewers", "Faster delivery always"], answer: 0,
          explain: "A single owner per module is clear but fragile. Most teams settle on team ownership with collective editing: anyone may change it, the owning team reviews." },
        { q: "What is the 'bus factor' of a component?", options: ["Its deploy frequency", "Its number of bugs", "Its latency", "How many people would have to leave before nobody understands it"], answer: 3,
          explain: "A bus factor of one is a risk. Pairing, rotation and review spread knowledge so the team is not dependent on one person." },
        { q: "In driver-navigator pairing, the navigator…", options: ["Types all the code", "Thinks ahead about direction, edge cases and design while the driver types", "Reviews the code a week later", "Only writes tests"], answer: 1,
          explain: "Splitting tactical and strategic thinking catches problems as they are typed. Swap roles frequently so both stay engaged." },
        { q: "When is mob (ensemble) programming most valuable?", options: ["For complex, high-risk or knowledge-spreading work where many perspectives at once prevent rework", "For routine, well-understood tasks", "Never", "Only for juniors"], answer: 0,
          explain: "A mob costs several people's time on one task, but it removes handoffs, review waits and knowledge silos. Use it where those costs dominate." },
        { q: "How should code written by a pair usually be reviewed?", options: ["Full independent review by two more people", "Never merged", "Lighter or no extra review, as agreed in team norms, because review happened continuously", "Only by a manager"], answer: 2,
          explain: "Pairing is continuous review. Teams make the rule explicit, often keeping a quick async check for high-risk paths." }
      ]
    },
    "review-purpose": {
      title: "Purpose of review checkpoint",
      sub: "What review is for and what to look for first.",
      questions: [
        { q: "Which is the most valuable outcome of code review in most teams?", options: ["Catching typos", "Enforcing personal style", "Slowing down merges", "Shared understanding of the code and catching design or correctness problems tests miss"], answer: 3,
          explain: "Review spreads knowledge and catches problems that need human judgement. Formatting and style should be automated so humans spend attention where machines cannot." },
        { q: "In what order should a reviewer usually read a PR?", options: ["Line by line from the top of the diff", "Description and intent first, then design and tests, then details", "Only the tests", "Only files they own"], answer: 1,
          explain: "Understanding the intent tells you what correct means. Big design concerns found first save the author from polishing code that will change." },
        { q: "Why read the tests early in a review?", options: ["They are shorter", "They never have bugs", "They show what behaviour the author intends and whether edge cases are covered", "Tools ignore them"], answer: 2,
          explain: "Tests are the author's statement of intended behaviour. Missing cases there often point straight at bugs in the implementation." },
        { q: "A reviewer spots that a new query runs inside a loop over every order. This is…", options: ["A performance concern worth raising with the likely scale and an alternative", "A nit", "Out of scope for review", "Something only QA can find"], answer: 0,
          explain: "N+1 queries are classic review catches because tests on small data pass. Say what scale makes it hurt and suggest a batched query." },
        { q: "Which concern should almost always be blocking?", options: ["A preferred variable name", "Import ordering", "Comment wording", "A security or data-loss risk"], answer: 3,
          explain: "Security and data integrity issues are expensive to fix after release. Taste and wording should not block a merge." }
      ]
    },
    "review-feedback": {
      title: "Feedback checkpoint",
      sub: "Giving and receiving review comments well.",
      questions: [
        { q: "What does prefixing a comment with 'nit:' communicate?", options: ["It is blocking", "It is a minor, optional suggestion the author may ignore", "It is a security issue", "The reviewer is annoyed"], answer: 1,
          explain: "Labelling severity lets the author triage quickly. Without labels, every comment looks like a merge blocker." },
        { q: "Which comment best follows 'critique the code, not the person'?", options: ["This path can receive a null customer from the guest checkout; can we handle that case?", "You always forget null checks", "Did you even test this?", "Sloppy"], answer: 0,
          explain: "It describes the situation and the risk in neutral terms and invites a fix. Personal framing triggers defensiveness and buries the real issue." },
        { q: "As an author, a reviewer asks for a change you disagree with. A good response is…", options: ["Ignore the comment", "Merge without approval", "Explain your reasoning briefly; if still unresolved, move to a quick call and record the decision", "Make the change silently and resent it"], answer: 2,
          explain: "Disagreement is normal. Explaining, then switching to a synchronous chat when threads go long, resolves it quickly and leaves a record for others." },
        { q: "Why is it helpful for authors to self-review their diff before requesting review?", options: ["It is required by Git", "It replaces tests", "It hides changes", "It catches leftover debug code and unclear parts cheaply, so reviewers focus on substance"], answer: 3,
          explain: "Authors spot many obvious issues when reading their own diff in the review tool. That respect for the reviewer's time speeds up the whole loop." },
        { q: "A reviewer leaves 40 comments, mostly style. What is the likely systemic fix?", options: ["Ban the reviewer", "Automate formatting and lint rules so style never reaches human review", "Stop reviewing", "Write longer PRs"], answer: 1,
          explain: "Style debates are a sign the tooling is missing. Formatters and linters settle them once, freeing reviewers for design and correctness." }
      ]
    },
    "review-flow": {
      title: "Review flow checkpoint",
      sub: "PR size, checklists, bots and team norms.",
      questions: [
        { q: "Why do small PRs tend to get better reviews?", options: ["Reviewers like short titles", "Git handles them faster", "A reviewer can hold the whole change in their head, so thoroughness stays high and turnaround is fast", "They skip CI"], answer: 2,
          explain: "Review quality drops sharply as size grows; large PRs get skimmed and rubber-stamped. Small PRs also merge before conflicts pile up." },
        { q: "A good use of a review checklist is…", options: ["A short list of the team's recurring misses, such as migrations, auth and logging of sensitive data", "A 60-item form for every PR", "Replacing tests", "Only for juniors"], answer: 0,
          explain: "Short checklists of known failure modes work; long ones get ticked without reading. Prune items once automation covers them." },
        { q: "Which job is best given to a bot rather than a human reviewer?", options: ["Judging whether a design fits the domain", "Mentoring", "Deciding scope", "Formatting, lint, secret scanning and dependency license checks"], answer: 3,
          explain: "Mechanical, rule-based checks are cheaper and more consistent as automation. Humans should spend attention on intent, design and risk." },
        { q: "A team's PRs wait two days for a first review. Which norm helps most?", options: ["Require three approvals", "Agree a target time to first response, and treat reviewing as real work prioritised over starting new tasks", "Only review on Fridays", "Allow self-approval"], answer: 1,
          explain: "Waiting time, not reading time, dominates cycle time. Teams that review before starting new work keep work-in-progress low and delivery flowing." },
        { q: "What are stacked PRs?", options: ["A chain of small dependent PRs, each reviewable on its own, building toward a larger change", "Duplicate PRs", "PRs with many commits", "PRs merged without review"], answer: 0,
          explain: "Stacking keeps each review small while large work progresses. Tools or careful rebasing keep the chain up to date as earlier PRs change." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.review = {
    id: "review",
    name: "Code Review",
    short: "REVW",
    tagline: "Better code and shared understanding, fast",
    color: "#93c5fd",
    blurb: "What review is really for, how to read a PR so you catch what matters, how to give and receive feedback without friction, and the team mechanics \u2014 small PRs, short checklists, bots and response-time norms \u2014 that keep review fast.",
    modules: [
      {
        id: "purpose",
        name: "Why & What to Look For",
        icon: "compass",
        lessons: [
          {
            id: "review-purpose",
            title: "What code review is for",
            summary: "Knowledge sharing, correctness and design \u2014 and what review is bad at, so you do not rely on it for that.",
            minutes: 9,
            tags: ["code-review", "collaboration", "quality"],
            blocks: [
              { t: "p", html: "Teams often say review exists to catch bugs. It does catch some, but its biggest payoffs are <strong>shared understanding</strong> (at least two people know every change), <strong>design feedback</strong> while change is still cheap, and <strong>consistency</strong> across a codebase many people edit." },
              { t: "diagram", id: "review-loop", caption: "The review loop: author self-reviews, automation runs, a human reviews intent and design, the author responds, and the change merges small and fast." },
              { t: "table", headers: ["Review is good at", "Review is bad at"], rows: [
                ["Spotting unclear names and confusing structure", "Finding every bug in a 1,500-line diff"],
                ["Catching missing cases in tests", "Checking formatting consistently (a formatter is better)"],
                ["Questioning design and scope", "Verifying runtime behaviour (tests and staging are better)"],
                ["Spreading knowledge of the system", "Catching secrets reliably (scanners are better)"]
              ] },
              { t: "note", variant: "tip", html: "A useful question for every PR: \"Will the next person to change this code understand it?\" If the answer needs the PR thread to be true, the explanation belongs in the code, a commit message or a doc." },
              { t: "note", variant: "key", html: "<strong>Review for understanding, design and risk; automate the rest.</strong> Treat review as a knowledge-sharing tool that also catches defects, not as the last line of defence." }
            ]
          },
          {
            id: "what-to-look-for",
            title: "How to read a pull request",
            summary: "A reading order and a set of questions that find the important problems first.",
            minutes: 11,
            tags: ["code-review", "checklist", "reading-code"],
            blocks: [
              { t: "p", html: "Reading a diff top to bottom puts you in the weeds before you know what the change is meant to do. Read in passes, from intent down to detail, and stop to comment when something big is wrong rather than polishing the details of a design that will change." },
              { t: "ol", items: [
                "<strong>Intent.</strong> Read the description and linked ticket. What problem, what approach, what is out of scope?",
                "<strong>Shape.</strong> Skim the file list. Is the change where you would expect? Anything surprising touched?",
                "<strong>Tests.</strong> Do they state the intended behaviour? Edge cases, failure paths, the bug being fixed?",
                "<strong>Design and correctness.</strong> Boundaries, error handling, concurrency, data migrations, backwards compatibility.",
                "<strong>Risk.</strong> Auth, input validation, secrets, logging of personal data, performance at real scale.",
                "<strong>Readability.</strong> Names, comments, dead code \u2014 the polish pass, often as non-blocking nits."
              ] },
              { t: "code", lang: "python", code:
                "# A classic review catch: fine on test data, painful in production\n" +
                "for order in orders:                               # 10,000 orders\n" +
                "    customer = db.get_customer(order.customer_id)  # 10,000 queries\n\n" +
                "# Suggested in review: one batched lookup\n" +
                "customers = db.get_customers({o.customer_id for o in orders})"
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"tests pass but it times out in prod\", \"the migration locked the table\", \"anyone could fetch anyone's data\" \u2014 these are the problems a careful reviewer reading for risk catches." },
              { t: "quiz", id: "review-purpose" },
              { t: "note", variant: "key", html: "<strong>Read intent, then tests, then design and risk, then polish.</strong> The most important comment on a PR is usually about something the diff does not show at line level." }
            ]
          }
        ]
      },
      {
        id: "feedback",
        name: "Giving & Receiving Feedback",
        icon: "share",
        lessons: [
          {
            id: "giving-feedback",
            title: "Writing review comments people act on",
            summary: "Specific, kind, labelled by severity \u2014 the anatomy of a useful comment.",
            minutes: 10,
            tags: ["feedback", "communication", "code-review"],
            blocks: [
              { t: "p", html: "A review comment is a tiny piece of writing with a busy reader. It works when the author can tell, in one read, <strong>what</strong> the issue is, <strong>why</strong> it matters, <strong>how much</strong> it matters, and <strong>what</strong> a fix might look like." },
              { t: "table", headers: ["Label", "Meaning", "Merge?"], rows: [
                ["blocking", "Must change before merge: correctness, security, data loss", "No"],
                ["question", "I do not understand; please explain (maybe in code)", "Depends on the answer"],
                ["suggestion", "I think this is better; open to discussion", "Author's call"],
                ["nit", "Tiny, optional, taste", "Yes"],
                ["praise", "This is good and worth repeating", "Yes"]
              ] },
              { t: "compare",
                bad: { title: "Vague or personal", items: ["\"This is wrong.\"", "\"Why would you do it like this?\"", "\"You never handle errors.\"", "40 unlabelled comments"] },
                good: { title: "Specific and neutral", items: ["\"This swallows timeouts, so users see 'no results'. Catch NotFound only? (blocking)\"", "\"Question: what does the jitter protect against?\"", "\"nit: `pending` reads clearer than `list2`\"", "A few labelled comments plus a summary"] } },
              { t: "widget", id: "reviewCommentCoach" },
              { t: "note", variant: "tip", html: "If a thread passes three rounds, stop typing. A five-minute call resolves it, and a one-line summary in the thread records the outcome for everyone else." },
              { t: "note", variant: "key", html: "<strong>Say what, why, how much and a possible fix.</strong> Label severity, critique code rather than people, and praise specifically." }
            ]
          },
          {
            id: "receiving-feedback",
            title: "Being a great PR author",
            summary: "Preparing a PR that is easy to review, and responding to comments without defensiveness.",
            minutes: 9,
            tags: ["pull-requests", "feedback", "authoring"],
            blocks: [
              { t: "p", html: "Most review friction is decided before the first comment: by the size of the PR, the quality of its description, and whether the author read their own diff first. Authors control far more of the review experience than reviewers do." },
              { t: "h", text: "Before requesting review" },
              { t: "ul", items: [
                "Self-review the diff in the review tool; delete debug output and commented-out code.",
                "Write a description: problem, approach, what you did not do, how you tested it, anything risky.",
                "Separate refactoring commits from behaviour changes, and say so.",
                "Point reviewers at the tricky part: \"the interesting logic is in <code class='tok'>allocate()</code>\"."
              ] },
              { t: "code", lang: "text", code:
                "Problem:  Guest checkout crashes when the cart has a gift card only.\n" +
                "Approach: Treat zero-amount payments as a no-op capture; add a guard in allocate().\n" +
                "Not done: Refund flow for gift cards (ticket PAY-311).\n" +
                "Testing:  New unit tests for zero-amount carts; ran the checkout E2E locally.\n" +
                "Risk:     Touches payment capture; behind flag checkout.zero_capture (default off)."
              },
              { t: "h", text: "Responding to comments" },
              { t: "ul", items: [
                "Assume good intent; the reviewer is spending their time to help the code.",
                "Reply to every comment: done, won't do (with reason), or a question back.",
                "Push fixes as new commits during review so reviewers can see what changed; squash later if your team prefers.",
                "If you learn something, capture it: a code comment, a test, a checklist item."
              ] },
              { t: "quiz", id: "review-feedback" },
              { t: "note", variant: "key", html: "<strong>Make your PR easy to say yes to.</strong> Self-review, describe the why and the risk, and respond to every comment with a change, a reason or a question." }
            ]
          }
        ]
      },
      {
        id: "flow",
        name: "Flow, Size & Automation",
        icon: "queue",
        lessons: [
          {
            id: "pr-size",
            title: "PR size and stacked changes",
            summary: "Why small PRs get better and faster reviews, and how to ship big work as a stack of small ones.",
            minutes: 10,
            tags: ["pull-requests", "pr-size", "stacked-prs", "flow"],
            blocks: [
              { t: "p", html: "Review quality falls off a cliff as diffs grow. A 100-line change gets read; a 1,500-line change gets skimmed and approved with \"LGTM\". Large PRs also wait longer, conflict more, and are harder to roll back." },
              { t: "widget", id: "reviewPrSizer" },
              { t: "h", text: "Ways to keep PRs small" },
              { t: "table", headers: ["Technique", "How"], rows: [
                ["Refactor first", "A behaviour-neutral PR, then the small feature PR on top"],
                ["Stacked PRs", "A chain of dependent PRs, each reviewed on its own"],
                ["Feature flags", "Merge incomplete work dark; enable when done"],
                ["Vertical slices", "One thin end-to-end path, then widen"],
                ["Generated code separate", "Lockfiles, codegen, snapshots in their own commit or PR"]
              ] },
              { t: "note", variant: "tip", html: "Rough rule many teams converge on: under about 400 changed lines of hand-written code, one concern per PR. The number matters less than \"a reviewer can understand this in one sitting\"." },
              { t: "note", variant: "key", html: "<strong>Small PRs get real reviews.</strong> Refactor first, stack dependent changes, merge dark behind flags, and keep generated noise apart." }
            ]
          },
          {
            id: "checklists-automation",
            title: "Checklists, bots and automated review",
            summary: "Let machines enforce rules and leave humans the judgement calls \u2014 including how to treat AI review bots.",
            minutes: 10,
            tags: ["automation", "linters", "review-bots", "checklists"],
            blocks: [
              { t: "p", html: "Every rule a machine can check should be checked by a machine, before a human looks. That turns review from \"please add a trailing comma\" into conversations about design and risk." },
              { t: "table", headers: ["Automate", "Tooling class", "Gate"], rows: [
                ["Formatting", "Formatter", "Auto-fix in pre-commit"],
                ["Lint rules and simple bugs", "Linter / static analysis", "Required CI check"],
                ["Types", "Type checker", "Required CI check"],
                ["Secrets", "Secret scanner", "Pre-commit and CI"],
                ["Vulnerable dependencies", "Dependency scanner", "CI, with severity policy"],
                ["Ownership routing", "CODEOWNERS file", "Required reviewer per path"]
              ] },
              { t: "h", text: "A short, living checklist" },
              { t: "ul", items: [
                "Database migration: backwards compatible with the running version? Reversible?",
                "New endpoint or query: authorization checked? Input validated?",
                "Logging: no tokens, passwords or personal data in log lines?",
                "Feature flag: owner and removal date recorded?"
              ] },
              { t: "p", html: "Keep it to the team's <em>recurring</em> misses. When automation starts covering an item, delete it from the list." },
              { t: "note", variant: "warn", html: "AI review bots are useful for spotting likely bugs and missing tests, but they also produce confident false positives. Treat their comments as suggestions from a junior reviewer: verify before acting, and never let a bot's approval replace a human's." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers wiring scanners into pipelines with gates in its <em>AppSec &amp; Vulnerability Management</em> track." },
              { t: "note", variant: "key", html: "<strong>Machines enforce rules; humans judge.</strong> Automate formatting, lint, types and secrets, keep a short checklist of recurring misses, and verify bot comments." }
            ]
          },
          {
            id: "review-culture",
            title: "Review culture and team norms",
            summary: "Response times, who reviews, when to approve, and keeping review from becoming a bottleneck or a gate-keeping ritual.",
            minutes: 9,
            tags: ["team-norms", "culture", "cycle-time"],
            blocks: [
              { t: "p", html: "On most teams, PRs spend far more time <strong>waiting</strong> for review than being reviewed. Norms fix that faster than any tool." },
              { t: "table", headers: ["Norm", "Why it helps"], rows: [
                ["First response within a few working hours", "Waiting time dominates cycle time"],
                ["Review before starting new work", "Finishing beats starting; keeps WIP low"],
                ["Approve with comments when the rest are nits", "Avoids an extra round trip"],
                ["One required approver for most changes, more for risky paths", "Speed where safe, rigour where it matters"],
                ["Rotate reviewers; include juniors", "Spreads knowledge; juniors' questions find unclear code"],
                ["No drive-by blocking without a follow-up", "Blocking means you own helping it land"]
              ] },
              { t: "note", variant: "trap", html: "Pair or mob programming is continuous review. A PR that two people wrote together usually needs a lighter async review \u2014 make that explicit in your norms rather than reviewing twice." },
              { t: "stat", items: [
                { v: "hours", k: "a healthy first-response time" },
                { v: "< 1 day", k: "a common target from PR open to merge" }
              ] },
              { t: "quiz", id: "review-flow" },
              { t: "note", variant: "key", html: "<strong>Fast review is a team habit.</strong> Agree response times, review before starting new work, approve with nits, and spread reviewing across the team." }
            ]
          }
        ]
      },
      {
        id: "team",
        name: "Ownership & Collaboration",
        icon: "blocks",
        lessons: [
          {
            id: "code-ownership",
            title: "Code ownership and CODEOWNERS",
            summary: "Who is responsible for which code, how to encode it, and how to avoid both silos and orphans.",
            minutes: 9,
            tags: ["code-ownership", "codeowners", "teams", "bus-factor"],
            blocks: [
              { t: "p", html: "Every piece of code needs someone who answers for it: who reviews changes, who gets paged, who decides its direction. Without ownership, code becomes orphaned; with too much, it becomes a silo." },
              { t: "table", headers: ["Model", "How it works", "Risk"], rows: [
                ["Strong individual ownership", "One person must approve all changes", "Bottleneck, bus factor of one"],
                ["Team ownership (recommended default)", "A team owns paths; anyone may propose changes; the team reviews", "Needs clear path mapping"],
                ["Collective ownership", "Anyone changes anything; shared standards", "Can drift into nobody owning anything"]
              ] },
              { t: "code", lang: "text", code:
                "# CODEOWNERS: teams, not individuals; most specific pattern last\n" +
                "*                       @team-platform\n" +
                "/services/checkout/     @team-checkout\n" +
                "/services/checkout/payments/  @team-checkout @team-security\n" +
                "/docs/adr/              @architecture-guild"
              },
              { t: "ul", items: [
                "Map to <strong>teams</strong>, not people, so ownership survives holidays and reorganisations.",
                "Combine with branch protection to <strong>require</strong> owner review on sensitive paths.",
                "Keep a service catalog entry per service: owner, on-call, runbook, dashboards.",
                "Review ownership when teams change; orphaned paths are a risk to flag, not ignore."
              ] },
              { t: "note", variant: "key", html: "<strong>Every path has an owning team, recorded in the repo.</strong> Team ownership with open contribution avoids both silos and orphans." }
            ]
          },
          {
            id: "pairing-mobbing",
            title: "Pairing and mob programming",
            summary: "Real-time collaboration styles, when they pay off, and how to keep them from exhausting people.",
            minutes: 10,
            tags: ["pair-programming", "mob-programming", "ensemble", "collaboration"],
            blocks: [
              { t: "p", html: "Pairing and mobbing move review, design discussion and knowledge sharing from after the code to <strong>while</strong> it is written. You trade some parallelism for fewer handoffs, less rework and no single points of knowledge." },
              { t: "table", headers: ["Style", "Shape", "Best for"], rows: [
                ["Driver-navigator pairing", "One types, one steers; swap often", "Most feature work and debugging"],
                ["Ping-pong pairing", "A writes a failing test, B makes it pass and writes the next", "TDD, keeping both engaged"],
                ["Strong-style pairing", "Ideas go through the other person's hands", "Onboarding and knowledge transfer"],
                ["Mob / ensemble", "Whole team, one keyboard, rotating driver every few minutes", "Hard problems, new domains, team alignment"]
              ] },
              { t: "h", text: "Making it sustainable" },
              { t: "ul", items: [
                "Time-box sessions and take breaks; pairing all day every day is exhausting for many people.",
                "Rotate pairs so knowledge spreads beyond two people.",
                "Agree how paired work is reviewed, so it is not reviewed twice.",
                "Remote pairing works well with shared editors and a stable voice channel; keep cameras optional."
              ] },
              { t: "compare",
                bad: { title: "Pairing done badly", items: ["One person types, the other checks their phone", "Senior dictates, junior watches", "Never swapping roles", "Mandatory all day"] },
                good: { title: "Pairing done well", items: ["Frequent role swaps", "Thinking out loud", "Both can explain the result", "Used where it pays off"] } },
              { t: "quiz", id: "review-team" },
              { t: "note", variant: "key", html: "<strong>Pair or mob where knowledge, risk or rework dominate.</strong> Swap roles often, rotate partners, time-box sessions and agree how paired work is reviewed." }
            ]
          }
        ]
      }
    ]
  };
})();
