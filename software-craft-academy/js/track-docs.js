/* =====================================================================
   CHISEL · Documentation & Communication
   window.TRACKS.docs — modules: types / decisions / comms
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* docsAdrBuilder — assemble an ADR and see its completeness */
  var ADR_PARTS = [
    { key: "title", label: "Title", options: [
      ["", "(empty)"],
      ["ADR-014: Use PostgreSQL for the orders service", "ADR-014: Use PostgreSQL for the orders service"],
      ["Database stuff", "Database stuff"]] },
    { key: "status", label: "Status", options: [
      ["", "(empty)"], ["Proposed", "Proposed"], ["Accepted", "Accepted"], ["Superseded by ADR-021", "Superseded by ADR-021"]] },
    { key: "context", label: "Context", options: [
      ["", "(empty)"],
      ["Orders need multi-row transactions and ad-hoc reporting. The team runs PostgreSQL elsewhere; nobody has operated a document store in production.", "Forces and constraints"],
      ["We had a meeting.", "Vague"]] },
    { key: "decision", label: "Decision", options: [
      ["", "(empty)"],
      ["We will store orders in PostgreSQL, one schema per service, accessed only through the orders service.", "Clear, active voice"],
      ["Maybe Postgres?", "Undecided"]] },
    { key: "alternatives", label: "Alternatives", options: [
      ["", "(empty)"],
      ["Document store: flexible schema, but weak multi-document transactions and no in-house experience. Shared reporting DB: rejected, couples services.", "Considered and rejected, with reasons"]] },
    { key: "consequences", label: "Consequences", options: [
      ["", "(empty)"],
      ["Schema migrations become part of every release. Reporting can use read replicas. We accept vertical scaling limits for now and will revisit above 5k orders/s.", "Good and bad, plus a revisit trigger"],
      ["It will be great.", "Only upsides"]] }
  ];
  Widgets.docsAdrBuilder = function (mount) {
    K.shell(mount, "adr", "ADR builder",
      "Assemble an architecture decision record from parts. A useful ADR says what forced the decision, what was decided, what was rejected and why, and what it will cost. Watch the preview and the completeness check.");
    var pick = { title: 1, status: 2, context: 0, decision: 0, alternatives: 0, consequences: 0 };
    var controls = h("div", { class: "widget-controls", style: "display:grid;gap:8px" });
    var preview = h("div", { class: "w-stage" });
    var feedback = h("div", { style: "display:grid;gap:6px;margin-top:10px" });
    var readout = h("div", { class: "w-readout" });
    ADR_PARTS.forEach(function (part) {
      var row = h("div", { style: "display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center;font-size:0.84rem;color:var(--text)" },
        h("span", {}, part.label),
        K.segment(part.options.map(function (o, i) { return [i, o[1]]; }), pick[part.key], function (i) { pick[part.key] = i; paint(); }));
      controls.appendChild(row);
    });
    function val(key) {
      var part = ADR_PARTS.filter(function (p) { return p.key === key; })[0];
      return part.options[pick[key]][0];
    }
    function paint() {
      clear(preview); clear(feedback); clear(readout);
      var md = "# " + (val("title") || "<title>") + "\n\nStatus: " + (val("status") || "<status>") +
        "\n\n## Context\n" + (val("context") || "<why is a decision needed?>") +
        "\n\n## Decision\n" + (val("decision") || "<what did we decide?>") +
        "\n\n## Alternatives considered\n" + (val("alternatives") || "<what else, and why not?>") +
        "\n\n## Consequences\n" + (val("consequences") || "<what gets easier and harder?>");
      preview.appendChild(K.mono(md));
      var issues = [];
      if (pick.title !== 1) issues.push(["Title should name the decision, with a number for linking.", "bad"]);
      if (!pick.status) issues.push(["Every ADR needs a status so readers know if it still applies.", "bad"]);
      if (pick.context !== 1) issues.push(["Context must record the forces: constraints, requirements, team skills.", "bad"]);
      if (pick.decision !== 1) issues.push(["State the decision plainly, in active voice. An undecided ADR is a discussion, not a record.", "bad"]);
      if (pick.alternatives !== 1) issues.push(["Record rejected options and why; it stops the same debate recurring.", "meh"]);
      if (pick.consequences !== 1) issues.push(["Consequences must include costs and a trigger to revisit, not only benefits.", "meh"]);
      if (!issues.length) feedback.appendChild(K.badge("Complete: a future reader can see why, what, what else, and at what cost.", "good"));
      issues.forEach(function (i) { feedback.appendChild(K.badge(i[0], i[1])); });
      var score = 6 - issues.length;
      readout.appendChild(ro("sections complete", score + " / 6"));
      readout.appendChild(ro("status", val("status") || "missing"));
      readout.appendChild(ro("verdict", score === 6 ? "ready to merge" : score >= 4 ? "almost" : "needs work"));
    }
    mount.appendChild(controls); mount.appendChild(preview); mount.appendChild(feedback); mount.appendChild(readout);
    paint();
  };

  /* docsReadmeAudit — spot what this README gets wrong */
  Widgets.docsReadmeAudit = function (mount) {
    K.lineSpotter(mount, {
      pill: "readme audit",
      title: "README audit",
      desc: "Click every line of this README that would trip up a new engineer on their first day. Some lines are fine.",
      snippets: [
        { id: "readme", label: "orders-service/README.md", lines: [
          { code: "# orders-service", why: "A clear name is a fine start." },
          { code: "The best service ever written. Uses cutting-edge tech.", issue: "No purpose", why: "Say what the service does and for whom in one sentence: 'Accepts and tracks customer orders for the web shop.'" },
          { code: "", why: "Blank line." },
          { code: "## Setup", why: "A setup section is exactly what newcomers need." },
          { code: "Install the usual stuff and run it.", issue: "Vague setup", why: "List prerequisites with versions and the exact commands. 'The usual stuff' differs per person." },
          { code: "export DB_PASSWORD=<paste the production password here>", issue: "Secret in docs", why: "Never ask people to put real credentials in docs or shell history. Point to the secret store or a .env.example with dummy values like <DB_PASSWORD>." },
          { code: "make test   # runs unit + integration tests (needs Docker)", why: "Exact command plus its prerequisite. Good." },
          { code: "See Bob for deployment.", issue: "Knowledge in a person", why: "People change teams. Link the runbook or describe the pipeline instead." },
          { code: "## Architecture", why: "Fine heading." },
          { code: "(diagram coming soon)  \u2014 last updated 2023", issue: "Stale promise", why: "A promised diagram that never came is worse than none. Add a small diagram-as-code next to the source, or remove the section." },
          { code: "Owner: #team-orders \u00b7 On-call: see service catalog", why: "Ownership and escalation path. Good." }
        ] }
      ]
    });
  };

  /* docsEstimator — three-point estimate with a range, not a promise */
  Widgets.docsEstimator = function (mount) {
    K.shell(mount, "estimate", "Three-point estimator",
      "Give an optimistic, most likely and pessimistic estimate in ideal days for a task. The estimator shows the expected value and a range you can communicate honestly, and flags tasks that should be split.");
    var vals = { o: 2, m: 4, p: 10 };
    var controls = h("div", { class: "w-stage", style: "display:grid;gap:10px" });
    var out = h("div", { style: "display:grid;gap:8px;margin-top:10px" });
    var readout = h("div", { class: "w-readout" });
    var labels = { o: "Optimistic", m: "Most likely", p: "Pessimistic" };
    var shown = {};
    var inputs = {};
    ["o", "m", "p"].forEach(function (k) {
      var b = h("b", {}, String(vals[k]));
      var input = h("input", { type: "range", min: "0.5", max: "30", step: "0.5", value: String(vals[k]), "aria-label": labels[k] + " estimate in days", style: "width:100%;accent-color:var(--amber)" });
      input.addEventListener("input", function () {
        vals[k] = Number(input.value);
        if (vals.o > vals.m) { vals.m = vals.o; inputs.m.value = String(vals.m); }
        if (vals.m > vals.p) { vals.p = vals.m; inputs.p.value = String(vals.p); }
        paint();
      });
      inputs[k] = input; shown[k] = b;
      controls.appendChild(h("label", { style: "display:grid;grid-template-columns:110px 1fr 56px;gap:10px;align-items:center;font-size:0.84rem;color:var(--text)" }, h("span", {}, labels[k]), input, b));
    });
    function paint() {
      clear(out); clear(readout);
      ["o", "m", "p"].forEach(function (k) { shown[k].textContent = vals[k] + " d"; });
      var e = (vals.o + 4 * vals.m + vals.p) / 6;
      var sd = (vals.p - vals.o) / 6;
      var spread = vals.p / Math.max(vals.o, 0.5);
      var msg, tone;
      if (vals.m > 5) { msg = "Most likely over a week: split it into smaller tasks you can estimate and finish independently."; tone = "bad"; }
      else if (spread >= 4) { msg = "Wide spread means high uncertainty. Spike the unknown part first, then re-estimate."; tone = "meh"; }
      else { msg = "Reasonable task size and uncertainty. Communicate the range, not the single number."; tone = "good"; }
      out.appendChild(K.badge(msg, tone));
      out.appendChild(K.para("Say it like this: \"Likely about " + e.toFixed(1) + " days; I'd plan for up to " + (e + 2 * sd).toFixed(1) + ". The main risk is the part I've marked pessimistic.\""));
      readout.appendChild(ro("expected (PERT)", e.toFixed(1) + " d"));
      readout.appendChild(ro("~95% range", Math.max(0, e - 2 * sd).toFixed(1) + "\u2013" + (e + 2 * sd).toFixed(1) + " d"));
      readout.appendChild(ro("spread", spread.toFixed(1) + "\u00d7"));
    }
    mount.appendChild(controls); mount.appendChild(out); mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "docs-planning": {
      title: "Estimation & tech debt checkpoint",
      sub: "Estimating your own work and communicating technical debt.",
      questions: [
        { q: "What is the most useful first step when a task feels impossible to estimate?", options: ["Break it down, and time-box a spike on the most uncertain part", "Pick a big number", "Refuse to estimate", "Copy last sprint's number"], answer: 0,
          explain: "Uncertainty usually concentrates in one part. A short spike turns an unknown into something you can estimate, and decomposition exposes hidden work." },
        { q: "Why communicate an estimate as a range?", options: ["To avoid commitment", "Ranges are always shorter", "A range states the uncertainty honestly and lets others plan for risk", "Tools require it"], answer: 2,
          explain: "A single number is heard as a promise. 'Likely three days, up to six if the API is unclear' gives the listener the information they need." },
        { q: "Which is most often missing from developer estimates?", options: ["Typing time", "Coffee", "Meetings about estimates", "Review, testing, deployment, documentation and waiting on others"], answer: 3,
          explain: "Estimates often cover only coding. Including the full path to done, plus interruptions, is what makes them accurate." },
        { q: "How should you describe technical debt to a product manager?", options: ["'The code is ugly'", "In terms of its cost to the business: slower delivery, incidents or risk, with a proposal and its payoff", "By listing every code smell", "By not mentioning it"], answer: 1,
          explain: "Debt is a business conversation. 'Each new payment method takes three weeks instead of three days because...' gets prioritised; 'it's messy' does not." },
        { q: "Which approach to paying down debt usually works best?", options: ["A six-month rewrite", "Ignoring it until it breaks", "Continuous paydown tied to feature work in that area, plus explicit, sized items for larger debt", "A hack week once a year"], answer: 2,
          explain: "Debt in code you are changing has the highest interest. Paying it as part of related work delivers value immediately; big items need their own visible case." }
      ]
    },
    "docs-types": {
      title: "Documentation types checkpoint",
      sub: "Kinds of docs, and READMEs that work.",
      questions: [
        { q: "A step-by-step lesson that takes a newcomer through building something small is which kind of doc?", options: ["Tutorial", "Reference", "Explanation", "Changelog"], answer: 0,
          explain: "Tutorials are learning-oriented and hold the reader's hand. Mixing them with exhaustive reference material makes both worse." },
        { q: "API parameter tables and config option lists are best classed as…", options: ["How-to guides", "Tutorials", "ADRs", "Reference"], answer: 3,
          explain: "Reference docs are information-oriented: accurate, complete, consistently structured. Readers look things up rather than read them start to finish." },
        { q: "What should the first lines of a README answer?", options: ["The author's biography", "What this is, who it is for, and how to get it running", "The license text", "The full architecture"], answer: 1,
          explain: "A reader decides in seconds whether they are in the right place. Purpose and a working quick start earn their attention." },
        { q: "Which README line violates good security practice?", options: ["An export line that contains a real production API key", "'Run make test'", "'Owner: #team-orders'", "'Requires Node 20'"], answer: 0,
          explain: "Credentials in docs are leaked credentials. Use dummy values and point to the secret store or an example env file." },
        { q: "A how-to guide differs from a tutorial because it…", options: ["Is longer", "Has no steps", "Assumes competence and solves one specific task, such as 'rotate the signing key'", "Explains theory"], answer: 2,
          explain: "How-tos are goal-oriented recipes for people who know the basics. Tutorials teach; how-tos get a job done." }
      ]
    },
    "docs-decisions": {
      title: "Decision records checkpoint",
      sub: "ADRs, RFCs and design docs.",
      questions: [
        { q: "What is an ADR primarily for?", options: ["Tracking bugs", "Sprint planning", "API reference", "Recording a significant decision with its context, alternatives and consequences so future readers know why"], answer: 3,
          explain: "Code shows what was built, not why other options were rejected. ADRs stop teams relitigating old decisions or reversing them blindly." },
        { q: "When a decision in an accepted ADR changes, you should…", options: ["Edit the old ADR to say the new thing", "Write a new ADR and mark the old one 'Superseded by' the new one", "Delete the old ADR", "Do nothing"], answer: 1,
          explain: "ADRs are an append-only log. Keeping the old record, linked to its replacement, preserves the reasoning trail." },
        { q: "Which section most often gets skipped and causes later pain?", options: ["Title", "Date", "Consequences, especially the costs and when to revisit", "Author"], answer: 2,
          explain: "Writing only the upsides hides what the team accepted. Honest costs and a revisit trigger make the decision reviewable later." },
        { q: "An RFC or design doc is most useful…", options: ["Before building something large or cross-team, to get feedback while changing course is cheap", "After the code ships", "Only for open-source projects", "Instead of tests"], answer: 0,
          explain: "Design docs move disagreement to the cheapest moment. A week of writing and review can save months of rework." },
        { q: "Where should ADRs usually live?", options: ["In a personal notebook", "Only in chat", "In email", "In the repository next to the code, versioned and reviewed like code"], answer: 3,
          explain: "Docs in the repo are found by the people changing the code and change through the same review process. Chat threads and inboxes are where decisions go to be forgotten." }
      ]
    },
    "docs-comms": {
      title: "Communication checkpoint",
      sub: "Diagrams as code, clear writing and docs as code.",
      questions: [
        { q: "What is the main advantage of diagrams as code?", options: ["They look nicer", "They live in the repo, diff in review, and are easy to update alongside the code", "They need no tools", "They replace documentation"], answer: 1,
          explain: "Binary diagram files go stale because updating them is a chore and changes are invisible in review. Text diagrams change with the code." },
        { q: "A good architecture diagram…", options: ["Has a clear audience and level of detail, a title, a legend and labelled arrows", "Shows every class", "Uses as many colours as possible", "Avoids text"], answer: 0,
          explain: "Diagrams fail when they mix levels or leave arrows unexplained. Pick one zoom level for one audience, and say what each arrow means." },
        { q: "'Bottom line up front' in technical writing means…", options: ["Put references at the bottom", "Write the summary last", "Put the conclusion or request in the first sentence", "Use bullet points"], answer: 2,
          explain: "Busy readers may read only the first lines. Leading with the decision, ask or result respects that and makes the rest optional detail." },
        { q: "Docs as code usually includes…", options: ["Docs in a separate wiki nobody reviews", "Only code comments", "PDF exports", "Docs in the repo, reviewed in PRs, built and link-checked in CI"], answer: 3,
          explain: "Treating docs like code gives them review, history and automated checks. Broken links and stale examples get caught like failing tests." },
        { q: "Which habit most improves a long design-doc thread?", options: ["Replying faster", "Summarising the current decision and open questions at the top, and updating it as things change", "Adding more people", "Moving to email"], answer: 1,
          explain: "Without a maintained summary, every new reader must replay the whole thread. A living summary makes the current state obvious." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.docs = {
    id: "docs",
    name: "Documentation & Communication",
    short: "DOCS",
    tagline: "Writing that survives the people who wrote it",
    color: "#fcd34d",
    blurb: "Pick the right kind of document for the reader, write READMEs that get people running, record decisions with ADRs, propose changes with RFCs and design docs, keep diagrams as code, and write clearly enough that busy engineers act on it.",
    modules: [
      {
        id: "types",
        name: "Kinds of Docs & READMEs",
        icon: "map",
        lessons: [
          {
            id: "doc-types",
            title: "Four kinds of documentation",
            summary: "Tutorials, how-to guides, reference and explanation \u2014 why mixing them produces docs nobody can use.",
            minutes: 9,
            tags: ["documentation", "tutorials", "reference", "how-to"],
            blocks: [
              { t: "p", html: "Most bad documentation is not badly written; it is the <strong>wrong kind</strong> for its reader. Someone trying to fix a production issue does not want a gentle tutorial, and a newcomer does not want a parameter table." },
              { t: "table", headers: ["Kind", "Reader's need", "Shape", "Example"], rows: [
                ["Tutorial", "Learning, new to this", "A guided lesson that always works", "Build and run your first service in 20 minutes"],
                ["How-to guide", "Doing a specific task", "A recipe: goal, steps, result", "Rotate the signing key"],
                ["Reference", "Looking something up", "Complete, accurate, consistent", "Config options; API endpoints"],
                ["Explanation", "Understanding why", "Discussion, background, trade-offs", "Why orders are event-sourced"]
              ] },
              { t: "p", html: "Keep each document to one kind and link between them. A how-to can link to the reference for every flag; an explanation can link to the ADR that recorded the decision." },
              { t: "note", variant: "tip", html: "Before writing, finish this sentence: \"The reader is ___ and after reading they will be able to ___.\" If you cannot, you are not ready to write yet." },
              { t: "note", variant: "key", html: "<strong>Match the doc to the reader's moment.</strong> Tutorials teach, how-tos get tasks done, reference answers lookups, explanations build understanding \u2014 keep them separate and linked." }
            ]
          },
          {
            id: "readmes",
            title: "READMEs that get people running",
            summary: "The sections every repository README needs, and the mistakes that cost newcomers a day.",
            minutes: 10,
            tags: ["readme", "onboarding", "documentation"],
            blocks: [
              { t: "p", html: "A README is the front door. Its job is to answer, in order: <strong>what is this, should I care, how do I run it, how do I change it safely, and who do I ask?</strong>" },
              { t: "code", lang: "text", code:
                "# orders-service\n" +
                "Accepts, prices and tracks customer orders for the web shop.\n\n" +
                "## Quick start\n" +
                "Prerequisites: Docker 24+, Node 20\n" +
                "  cp .env.example .env        # dummy values only; real values from the secret store\n" +
                "  make dev                    # starts the API on localhost:8080\n" +
                "  make test                   # unit + integration (needs Docker)\n\n" +
                "## How it fits\n" +
                "Diagram: docs/architecture.md (diagram as code, kept in this repo)\n" +
                "Decisions: docs/adr/\n\n" +
                "## Operating it\n" +
                "Runbook: docs/runbook.md \u00b7 Dashboards: see the service catalog entry\n\n" +
                "## Ownership\n" +
                "Team: #team-orders \u00b7 On-call: service catalog"
              },
              { t: "widget", id: "docsReadmeAudit" },
              { t: "note", variant: "warn", html: "Never paste real credentials, tokens or connection strings into a README, even \"temporarily\". Ship a <code class='tok'>.env.example</code> with dummy values like <code class='tok'>&lt;DB_PASSWORD&gt;</code> and explain where real values come from." },
              { t: "note", variant: "tip", html: "Test your README: ask someone new to follow it on a clean machine and watch silently. Every question they ask is a missing line." },
              { t: "quiz", id: "docs-types" },
              { t: "note", variant: "key", html: "<strong>Purpose, quick start, how it fits, how to operate it, who owns it.</strong> Exact commands, dummy secrets only, and test it on a newcomer." }
            ]
          }
        ]
      },
      {
        id: "decisions",
        name: "Decisions & Proposals",
        icon: "diamond",
        lessons: [
          {
            id: "adrs",
            title: "Architecture decision records",
            summary: "A lightweight, append-only log of why the system is the way it is.",
            minutes: 11,
            tags: ["adr", "architecture", "decisions"],
            blocks: [
              { t: "p", html: "Six months after a decision, the code shows <em>what</em> was chosen but not <em>why</em>, or what else was considered. New people either relitigate it or reverse it without knowing the constraint that drove it. An <strong>ADR</strong> is a one-page record that fixes that." },
              { t: "diagram", id: "adr-lifecycle", caption: "ADR lifecycle: proposed, reviewed, then accepted or rejected; accepted records are later superseded by new ADRs rather than edited." },
              { t: "table", headers: ["Section", "Content"], rows: [
                ["Title", "Numbered, names the decision: 'ADR-014: Use PostgreSQL for orders'"],
                ["Status", "Proposed, Accepted, Rejected, Deprecated, Superseded by ADR-n"],
                ["Context", "Forces: requirements, constraints, team skills, deadlines"],
                ["Decision", "What we will do, in active voice"],
                ["Alternatives", "Options considered and why each was rejected"],
                ["Consequences", "What gets easier, what gets harder, when to revisit"]
              ] },
              { t: "widget", id: "docsAdrBuilder" },
              { t: "note", variant: "tip", html: "Write ADRs for decisions that are <strong>expensive to reverse</strong> or that people will keep asking about: data stores, protocols, frameworks, boundaries between services. Not for every library bump." },
              { t: "note", variant: "key", html: "<strong>Record why, what, what else and at what cost, in the repo, append-only.</strong> Supersede old ADRs instead of editing them, so the reasoning trail survives." }
            ]
          },
          {
            id: "design-docs",
            title: "RFCs and design docs",
            summary: "Proposing significant changes in writing, so disagreement happens before the code, not after.",
            minutes: 11,
            tags: ["rfc", "design-docs", "proposals", "collaboration"],
            blocks: [
              { t: "p", html: "A design doc (often called an RFC) is a proposal written <strong>before</strong> building something large, risky or cross-team. Its purpose is to surface objections while changing course costs a document edit, not a rewrite." },
              { t: "h", text: "A structure that works" },
              { t: "ol", items: [
                "<strong>Summary</strong> \u2014 three sentences: problem, proposal, ask.",
                "<strong>Context and goals</strong> \u2014 including explicit non-goals.",
                "<strong>Proposal</strong> \u2014 the design at the level reviewers need, with a diagram.",
                "<strong>Alternatives</strong> \u2014 including 'do nothing', with honest trade-offs.",
                "<strong>Risks, rollout and migration</strong> \u2014 how it ships safely and how it is undone.",
                "<strong>Open questions</strong> \u2014 what you want reviewers to weigh in on."
              ] },
              { t: "compare",
                bad: { title: "Doc as approval theatre", items: ["Written after the code", "Hides alternatives", "No explicit ask", "Comments ignored"] },
                good: { title: "Doc as thinking tool", items: ["Written before committing to a path", "Alternatives argued fairly", "Clear decision deadline and owner", "Outcome recorded as an ADR"] } },
              { t: "note", variant: "tip", html: "Give the review a deadline and a decider. Open-ended RFC threads drift for weeks; 'comments by Friday, Aswin decides Monday' ends them." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas's <em>High-Level Design</em> track covers the system-design content that goes inside such docs; this lesson is about the document and the process." },
              { t: "quiz", id: "docs-decisions" },
              { t: "note", variant: "key", html: "<strong>Write the proposal before the code, argue alternatives honestly, and end with a decision.</strong> Then capture the outcome as an ADR." }
            ]
          }
        ]
      },
      {
        id: "comms",
        name: "Diagrams, Writing & Docs as Code",
        icon: "share",
        lessons: [
          {
            id: "diagrams-as-code",
            title: "Diagrams as code",
            summary: "Text-defined diagrams that live in the repo, change in review, and stay current.",
            minutes: 9,
            tags: ["diagrams", "mermaid", "c4", "docs-as-code"],
            blocks: [
              { t: "p", html: "Diagrams drawn in a separate tool and exported as images go stale: updating them is a chore, and nobody can see in review what changed. <strong>Diagrams as code</strong> describe boxes and arrows in text, rendered by a tool, and versioned next to the code they describe." },
              { t: "code", lang: "text", code:
                "flowchart LR\n" +
                "  web[Web shop] -->|places order, HTTPS| api[orders-service]\n" +
                "  api -->|writes| db[(orders DB)]\n" +
                "  api -->|publishes OrderPlaced| bus{{event bus}}\n" +
                "  bus -->|consumes| ship[shipping-service]"
              },
              { t: "h", text: "Rules for diagrams people can read" },
              { t: "ul", items: [
                "<strong>One zoom level per diagram.</strong> Context (systems and people), containers (services, stores), or components \u2014 not all at once.",
                "<strong>Label every arrow</strong> with what flows and how: 'publishes OrderPlaced', 'HTTPS, JSON'.",
                "<strong>Title and legend.</strong> State what the diagram shows and what shapes and colours mean.",
                "<strong>Name the audience.</strong> An on-call engineer and an executive need different diagrams."
              ] },
              { t: "note", variant: "tip", html: "Put diagram sources in the same PR as the change they describe. A reviewer seeing the arrow change in text is the cheapest architecture review you will ever get." },
              { t: "note", variant: "key", html: "<strong>Diagrams in text, in the repo, in the same PR.</strong> One zoom level, labelled arrows, a title and legend, and a named audience." }
            ]
          },
          {
            id: "writing",
            title: "Writing for busy engineers",
            summary: "Bottom line up front, one idea per paragraph, concrete over abstract \u2014 for docs, PR descriptions and incident updates.",
            minutes: 9,
            tags: ["writing", "communication", "clarity"],
            blocks: [
              { t: "p", html: "Engineers read in short bursts between other work. Writing that respects that \u2014 leading with what matters and making the rest skippable \u2014 gets read and acted on. Writing that builds up to its point gets skimmed." },
              { t: "compare",
                bad: { title: "Buried lede", items: ["\"Over the last few weeks we've been looking at various options and after a lot of discussion...\"", "Ask in paragraph four", "Abstract: 'performance concerns'"] },
                good: { title: "Bottom line up front", items: ["\"Decision needed by Friday: move orders to PostgreSQL. Recommendation below.\"", "Ask in sentence one", "Concrete: 'p95 checkout latency 2.1 s, target 500 ms'"] } },
              { t: "table", headers: ["Habit", "Why"], rows: [
                ["Lead with the conclusion or the ask", "Many readers stop after two lines"],
                ["One idea per paragraph", "Easy to skim and to reply to"],
                ["Numbers instead of adjectives", "'Slow' is an opinion; '2.1 s p95' is a fact"],
                ["Name owners and dates", "'We should' never happens; 'Aswin by Friday' does"],
                ["Cut what does not change the reader's action", "Shorter is read; longer is skimmed"]
              ] },
              { t: "note", variant: "tip", html: "For incident updates use a fixed shape: current impact, what we know, what we are doing, next update time. Readers learn where to look." },
              { t: "note", variant: "key", html: "<strong>Lead with the point, be concrete, name owners.</strong> Write so a reader who stops after two sentences still knows what to do." }
            ]
          },
          {
            id: "docs-as-code",
            title: "Docs as code",
            summary: "Treat documentation like software: in the repo, reviewed, tested and owned.",
            minutes: 9,
            tags: ["docs-as-code", "ci", "maintenance"],
            blocks: [
              { t: "p", html: "Documentation decays for the same reasons code does \u2014 nobody notices it breaking. <strong>Docs as code</strong> applies software habits: version control, review, automated checks and ownership." },
              { t: "table", headers: ["Practice", "Catches"], rows: [
                ["Docs in the same repo as the code", "Docs forgotten in a separate wiki"],
                ["Doc changes in the same PR as behaviour changes", "Docs describing last quarter's system"],
                ["Link checker in CI", "Broken internal links"],
                ["Runnable examples tested in CI", "Snippets that no longer compile"],
                ["Prose linter for terminology", "Inconsistent names for the same thing"],
                ["CODEOWNERS for docs paths", "Docs nobody feels responsible for"],
                ["'Last reviewed' date with a review cadence", "Silent staleness"]
              ] },
              { t: "code", lang: "bash", code:
                "# A docs job in CI, alongside the tests\n" +
                "make docs-build        # render the site; fail on warnings\n" +
                "make docs-linkcheck    # every internal link resolves\n" +
                "make docs-examples     # run fenced examples marked as runnable"
              },
              { t: "note", variant: "tip", html: "Add \"docs updated?\" to the PR template. It costs reviewers one second and catches most drift at the moment it is introduced." },
              { t: "quiz", id: "docs-comms" },
              { t: "note", variant: "key", html: "<strong>Docs rot unless something checks them.</strong> Keep them in the repo, change them in the same PR, and let CI test links and examples." }
            ]
          }
        ]
      },
      {
        id: "planning",
        name: "Estimation & Technical Debt",
        icon: "trend",
        lessons: [
          {
            id: "estimation",
            title: "Estimating your own work",
            summary: "Decompose, spike the unknowns, estimate in ranges, and include everything between 'code' and 'done'.",
            minutes: 10,
            tags: ["estimation", "planning", "communication"],
            blocks: [
              { t: "p", html: "Estimates are not about predicting the future perfectly; they are about giving others enough information to plan, and noticing early when work is bigger than it looks." },
              { t: "ol", items: [
                "<strong>Decompose</strong> into tasks of a day or two. Anything bigger hides work.",
                "<strong>Name the unknowns</strong>, and spike the biggest one in a time-box before committing.",
                "<strong>Estimate the full path to done</strong>: code, tests, review, deploy, docs, rollout, waiting on others.",
                "<strong>Give a range</strong> with the main risk, not a single number.",
                "<strong>Re-estimate</strong> as soon as you learn something, and say so early."
              ] },
              { t: "widget", id: "docsEstimator" },
              { t: "table", headers: ["Often forgotten", "Typical cost"], rows: [
                ["Code review rounds", "Hours to a day of elapsed time"],
                ["Writing and fixing tests", "Often as much as the code"],
                ["Migrations, flags and rollout", "Separate deploys"],
                ["Interruptions, on-call and meetings", "A real share of every week"],
                ["Dependencies on other teams", "Days of waiting"]
              ] },
              { t: "note", variant: "tip", html: "Track estimate versus actual for a few weeks. Most people find a consistent multiplier, and knowing yours is more useful than any technique." },
              { t: "note", variant: "key", html: "<strong>Small tasks, spiked unknowns, full path to done, a range with the risk named.</strong> Re-estimate and communicate the moment reality differs." }
            ]
          },
          {
            id: "tech-debt-comms",
            title: "Communicating technical debt",
            summary: "Turn 'the code is messy' into a business case: interest, principal and a proposal.",
            minutes: 10,
            tags: ["technical-debt", "communication", "prioritisation"],
            blocks: [
              { t: "p", html: "Technical debt is the gap between the code you have and the code that would make current work easy. Like financial debt it has <strong>principal</strong> (the work to fix it) and <strong>interest</strong> (the extra cost you pay on every change until you do). Only interest makes a case." },
              { t: "table", headers: ["Weak framing", "Strong framing"], rows: [
                ["\"The payments code is a mess.\"", "\"Adding a payment method takes three weeks instead of three days; we have four planned this year.\""],
                ["\"We need to refactor.\"", "\"Two of the last five incidents started in this module; refactoring plus tests cuts that risk.\""],
                ["\"We should rewrite it.\"", "\"Strangling the two hottest routes over six weeks removes 70% of the pain.\""]
              ] },
              { t: "h", text: "A one-paragraph debt proposal" },
              { t: "code", lang: "text", code:
                "Problem:   Pricing rules are duplicated in 3 services; every price change needs 3 PRs.\n" +
                "Interest:  ~2 engineer-days per change; 1 pricing incident last quarter from drift.\n" +
                "Proposal:  Extract a shared pricing module behind an interface (branch by abstraction).\n" +
                "Cost:      ~8 engineer-days, in 4 independently shippable steps.\n" +
                "Payoff:    Price changes become 1 PR; drift incidents eliminated.\n" +
                "Ask:       Schedule steps 1-2 next sprint alongside the planned discount feature."
              },
              { t: "ul", items: [
                "Keep a visible debt register with interest estimates, not a hidden list of complaints.",
                "Pay debt continuously in code you are already changing \u2014 that is where interest is highest.",
                "Tie larger paydowns to upcoming features that depend on them.",
                "Record deliberate debt when you take it on: what, why, and when to repay."
              ] },
              { t: "quiz", id: "docs-planning" },
              { t: "note", variant: "key", html: "<strong>Argue debt in interest, not aesthetics.</strong> Quantify the ongoing cost, propose small shippable steps, and tie paydown to the work that needs it." }
            ]
          }
        ]
      }
    ]
  };
})();
