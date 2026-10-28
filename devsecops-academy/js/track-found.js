/* =====================================================================
   FORGE · Foundations & Secure SDLC
   window.TRACKS.found — modules: sdlc / ssdlc

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
     1. foundDefectCost — "What a defect costs by where it is caught"
     Deterministic. The multipliers are an illustrative teaching model,
     not a measured industry constant.
  ================================================================== */
  var COST_PHASES = [
    { id: "ide", label: "IDE / pre-commit", mult: 1, who: "the author, in seconds, with full context" },
    { id: "pr", label: "Pull request", mult: 2, who: "the author plus one reviewer, same day" },
    { id: "ci", label: "CI gate", mult: 4, who: "the author after a context switch, often next day" },
    { id: "staging", label: "Staging / QA", mult: 10, who: "a tester files it, a developer reproduces it days later" },
    { id: "prod", label: "Production", mult: 40, who: "an incident: on-call, triage, hotfix, comms, maybe disclosure" }
  ];

  Widgets.foundDefectCost = function (mount) {
    shell(mount, "model", "Where the defect escapes to",
      "Pick the stage where a hardcoded credential is first caught and how many such defects a team ships per quarter. The model shows relative effort, not money: the point is the slope, not the exact numbers.");

    var phase = "ci";
    var count = 20;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var cur = COST_PHASES[0], i;
      for (i = 0; i < COST_PHASES.length; i++) if (COST_PHASES[i].id === phase) cur = COST_PHASES[i];
      clear(stage);
      for (i = 0; i < COST_PHASES.length; i++) {
        var p = COST_PHASES[i];
        var on = p.id === phase;
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(80px,3fr) 64px;gap:12px;align-items:center;padding:6px 0;" +
            (on ? "font-weight:700" : "opacity:0.75")
        },
          h("span", { style: "font-size:0.84rem" }, p.label),
          h("span", { style: "display:block;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:10px;border-radius:6px;width:" + Math.max(3, Math.round(p.mult / 40 * 100)) + "%;background:" + (on ? "var(--accent)" : "var(--text-faint)") })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem" }, p.mult + "x")
        ));
      }
      clear(readout);
      readout.appendChild(ro("caught at", cur.label));
      readout.appendChild(ro("relative effort", cur.mult + "x"));
      readout.appendChild(ro("quarterly units", cur.mult * count));
      readout.appendChild(ro("vs shift-left", (cur.mult * count - count) + " units saved if caught in the IDE"));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, "Who pays: " + cur.who + "."));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["ide", "IDE"], ["pr", "PR"], ["ci", "CI"], ["staging", "Staging"], ["prod", "Prod"]], 2, function (v) { phase = v; paint(); }),
      segment([[5, "5 / qtr"], [20, "20 / qtr"], [60, "60 / qtr"]], 1, function (v) { count = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. foundStride — "STRIDE a component"
     Deterministic lookup: component type -> threats -> controls.
  ================================================================== */
  var STRIDE_COMPONENTS = {
    api: {
      label: "Public REST API",
      rows: [
        ["Spoofing", "Stolen or replayed bearer token", "Short-lived OIDC tokens, audience checks, mTLS for service callers"],
        ["Tampering", "Mass-assignment of fields the client should not set", "Allow-listed DTOs, schema validation at the edge"],
        ["Repudiation", "A user denies placing an order", "Signed, append-only audit log with request ids"],
        ["Information disclosure", "Verbose stack traces and IDOR on /orders/{id}", "Generic errors, object-level authorization on every read"],
        ["Denial of service", "Unbounded page size or expensive search", "Rate limits, pagination caps, timeouts"],
        ["Elevation of privilege", "Role claim trusted from the client", "Server-side role lookup, deny by default"]
      ]
    },
    pipeline: {
      label: "CI/CD pipeline",
      rows: [
        ["Spoofing", "A fork PR impersonates a trusted build", "Do not expose secrets to untrusted PR builds; require approval"],
        ["Tampering", "Build script or dependency swapped mid-build", "Pinned dependencies, hermetic builds, signed provenance"],
        ["Repudiation", "Nobody can say who approved a prod deploy", "Approvals recorded in the pipeline, linked to identity"],
        ["Information disclosure", "Secrets echoed into build logs", "Credential store bindings with masking, no plain env dumps"],
        ["Denial of service", "Runaway jobs exhaust shared agents", "Quotas, timeouts, ephemeral agents"],
        ["Elevation of privilege", "Pipeline identity has cluster-admin", "Least-privilege deploy identity, GitOps pull model"]
      ]
    },
    bucket: {
      label: "Object storage bucket",
      rows: [
        ["Spoofing", "Anonymous requests accepted as a principal", "Block public access, require signed requests"],
        ["Tampering", "Objects overwritten by a compromised writer", "Versioning, object lock for critical data"],
        ["Repudiation", "Deletes with no trail", "Data-event logging to a separate account"],
        ["Information disclosure", "Bucket policy grants read to everyone", "Policy linting in CI, CSPM rule, encryption with managed keys"],
        ["Denial of service", "Request-cost abuse on a public object", "Front with a CDN, budgets and alerts"],
        ["Elevation of privilege", "Wildcard write lets an attacker plant a policy", "No wildcard actions, separate admin role"]
      ]
    }
  };

  Widgets.foundStride = function (mount) {
    shell(mount, "threat model", "STRIDE a component",
      "Pick a component and walk the six letters. Each row is a concrete threat and the control that answers it — this is what a threat-model review should produce.");

    var comp = "api";
    var letter = 0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var c = STRIDE_COMPONENTS[comp] || STRIDE_COMPONENTS.api;
      clear(stage);
      for (var i = 0; i < c.rows.length; i++) {
        var on = i === letter;
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:34px minmax(120px,1fr) minmax(140px,1.4fr);gap:12px;padding:8px 10px;border-radius:10px;" +
            (on ? "background:color-mix(in srgb, var(--accent) 14%, transparent);" : "")
        },
          h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, c.rows[i][0].charAt(0)),
          h("span", { style: "font-size:0.86rem" }, c.rows[i][1]),
          h("span", { style: "font-size:0.86rem;color:var(--text-dim)" }, c.rows[i][2])
        ));
      }
      clear(readout);
      readout.appendChild(ro("component", c.label));
      readout.appendChild(ro("letter", c.rows[letter][0]));
      readout.appendChild(ro("property violated", ["authenticity", "integrity", "non-repudiation", "confidentiality", "availability", "authorization"][letter]));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["api", "Public API"], ["pipeline", "CI/CD pipeline"], ["bucket", "Storage bucket"]], 0, function (v) { comp = v; paint(); }),
      segment([[0, "S"], [1, "T"], [2, "R"], [3, "I"], [4, "D"], [5, "E"]], 0, function (v) { letter = v; paint(); })
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
    "found-sdlc": {
      title: "Lifecycle models checkpoint",
      sub: "SDLC models, DevOps, and what DevSecOps actually changes.",
      questions: [
        {
          q: "In the V-Model, which test level is paired with the system requirements / system design phase?",
          options: ["Unit testing", "Integration testing", "System testing", "Code review"],
          answer: 2,
          explain: "The V-Model mirrors each specification phase with the test level that verifies it. Module design pairs with unit tests, architecture with integration tests, and system design with system testing, so the test plan is written while the design is fresh."
        },
        {
          q: "What makes the Spiral model different from a plain iterative model?",
          options: ["It has no testing phase", "Each loop is driven by explicit risk analysis before building", "It forbids customer feedback", "It requires a single big-bang release"],
          answer: 1,
          explain: "Spiral is iterative, but every loop starts by identifying and resolving the largest risks before committing to build. That makes it suited to large, uncertain programmes and heavier to run than ordinary iterations."
        },
        {
          q: "A team ships weekly, has a written definition of done, and runs fixed two-week sprints with a review and a retrospective. Which framework are they running?",
          options: ["Kanban", "Scrum", "Waterfall", "Spiral"],
          answer: 1,
          explain: "Fixed-length sprints with planning, review and retrospective ceremonies are Scrum. Kanban has no sprints; it limits work in progress and pulls continuously. Shipping weekly is independent of either."
        },
        {
          q: "Which statement best describes DevOps?",
          options: ["A job title for the person who runs Jenkins", "A tool you buy", "A culture and set of practices that shorten the path from commit to production while keeping it reliable", "A replacement for testing"],
          answer: 2,
          explain: "DevOps is primarily cultural and practice-based: shared ownership between development and operations, automation, fast feedback and measurement. Tools enable it, and a single 'DevOps engineer' title does not create it."
        },
        {
          q: "What does 'shift everywhere' add to the older idea of 'shift left'?",
          options: ["Security moves only to the IDE", "Security checks run at every stage including runtime, with findings fed back to the owner", "Security is outsourced to a separate team", "Security runs only before release"],
          answer: 1,
          explain: "Shift left moved checks earlier, which is cheaper. Shift everywhere keeps those early checks but adds runtime and cloud signals, because some risks (exposure, identity paths, drift) only exist once the system is deployed."
        }
      ]
    },
    "found-ssdlc": {
      title: "Secure SDLC checkpoint",
      sub: "SSDLC evidence, threat modeling, testable requirements and frameworks.",
      questions: [
        {
          q: "In STRIDE, an attacker modifying a build artifact in transit is which category?",
          options: ["Spoofing", "Tampering", "Repudiation", "Denial of service"],
          answer: 1,
          explain: "Tampering is the violation of integrity: changing data or code without authorization. Signing artifacts and verifying digests before deploy is the matching control."
        },
        {
          q: "Which framework organizes practices into Prepare the Organization, Protect the Software, Produce Well-Secured Software and Respond to Vulnerabilities?",
          options: ["OWASP SAMM", "BSIMM", "NIST SSDF (SP 800-218)", "Microsoft SDL"],
          answer: 2,
          explain: "Those four groups (PO, PS, PW, RV) are the NIST Secure Software Development Framework. It is outcome-focused and maps to other frameworks rather than prescribing tools."
        },
        {
          q: "How does BSIMM differ from OWASP SAMM?",
          options: ["BSIMM is descriptive, built from observing what real organizations do; SAMM is a prescriptive maturity model you assess yourself against", "BSIMM is only for mobile apps", "SAMM is a scanning tool", "They are the same document"],
          answer: 0,
          explain: "BSIMM reports what participating firms actually do, so it is a benchmark. SAMM gives you business functions, practices and maturity levels to plan your own roadmap. Many teams use SAMM to plan and BSIMM to compare."
        },
        {
          q: "When drawing a data-flow diagram for threat modeling, where do most real threats sit?",
          options: ["Inside a single process", "On trust boundaries, where privilege or ownership changes between elements", "In the colour scheme of the diagram", "Only at the database"],
          answer: 1,
          explain: "Trust boundaries — internet to load balancer, service to database, CI runner to cloud account — are where an input from a less trusted side reaches a more trusted one. STRIDE each crossing and file the mitigations as tickets."
        },
        {
          q: "Which security requirement is written so a pipeline gate can verify it?",
          options: ["The API must be secure", "Use strong encryption", "Every endpoint enforces object-level authorization; a test requesting another user's order expects 403", "Protect user data"],
          answer: 2,
          explain: "A testable requirement names the behaviour and the check that proves it. Vague requirements cannot be mapped to a gate, so they silently become nobody's job."
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
    name: "Foundations & Secure SDLC",
    short: "FOUND",
    tagline: "From lifecycle models to a secure SDLC",
    color: "#f97316",
    blurb: "Start from zero: how software gets built (Waterfall to Agile to DevOps), what DevSecOps changes, and where security lands in every phase — threat modeling, secure design and testing, and frameworks like NIST SSDF and SAMM, with a first look at supply-chain evidence before the deep dive in the Supply Chain track.",
    modules: [
      {
        id: "sdlc",
        name: "SDLC & DevOps",
        icon: "compass",
        lessons: [
          {
            id: "sdlc-models",
            title: "What an SDLC is: Waterfall and the V-Model",
            summary: "The software development lifecycle as a sequence of decisions, and the two plan-driven models everything else reacts to.",
            minutes: 8,
            tags: ["foundation", "sdlc", "waterfall", "v-model"],
            blocks: [
              { t: "p", html: "A <strong>software development lifecycle (SDLC)</strong> is the agreed order in which a team turns an idea into running software: decide what to build, design it, build it, verify it, release it, and keep it running. Every model below uses the same activities. What changes is <em>how often</em> you loop through them and <em>how much</em> you commit up front." },
              { t: "h", text: "The six activities every model shares" },
              { t: "ol", items: [
                "<strong>Requirements</strong> — what the system must do and the constraints it must respect (including security and compliance).",
                "<strong>Design</strong> — architecture, data flows, interfaces, and the trust boundaries between them.",
                "<strong>Implementation</strong> — writing and reviewing code.",
                "<strong>Verification</strong> — unit, integration, system and acceptance testing.",
                "<strong>Release / deployment</strong> — packaging and promoting into production.",
                "<strong>Operations &amp; maintenance</strong> — monitoring, patching, incident response, retirement."
              ] },
              { t: "h", text: "Waterfall" },
              { t: "p", html: "Waterfall runs each activity once, in order, with a sign-off gate between them. It works when requirements are genuinely stable and expensive to change — regulated hardware, fixed-scope contracts. Its failure mode is that you learn whether the design was right only at the end, when change is most expensive." },
              { t: "h", text: "The V-Model" },
              { t: "p", html: "The V-Model is Waterfall with discipline about verification: each specification phase on the left arm is paired with the test level on the right arm that proves it. Test plans are written while the matching design is fresh, which is why it is still common in safety-critical work." },
              { t: "table", headers: ["Left arm (specify)", "Right arm (verify)", "Security analogue"], rows: [
                ["Business requirements", "Acceptance testing", "Abuse cases and compliance checks"],
                ["System design", "System testing", "DAST and penetration testing"],
                ["Architecture", "Integration testing", "Threat-model controls verified across services"],
                ["Module design", "Unit testing", "SAST and security unit tests"]
              ] },
              { t: "compare",
                bad: { title: "Where plan-driven models hurt", items: ["Feedback arrives late", "Security found in a final pen test, weeks before go-live", "Change requests are expensive by design"] },
                good: { title: "What they get right", items: ["Explicit gates and evidence", "Traceability from requirement to test", "Predictable for fixed-scope work"] } },
              { t: "note", variant: "tip", html: "Do not dismiss these models in interviews. Regulated teams still need the <em>traceability</em> the V-Model gives; modern pipelines recreate it with automated evidence instead of paper sign-offs." },
              { t: "note", variant: "key", html: "<strong>Every SDLC runs the same six activities.</strong> Models differ in loop length and up-front commitment — and the later a loop closes, the more a defect (including a security defect) costs to fix." }
            ]
          },
          {
            id: "iterative-agile",
            title: "Iterative, Spiral, Agile, Scrum, Kanban and SAFe",
            summary: "How shorter loops changed delivery, and how each model handles risk, cadence and scale.",
            minutes: 9,
            tags: ["practitioner", "agile", "scrum", "kanban", "safe", "spiral"],
            blocks: [
              { t: "p", html: "Once teams accepted that requirements change, the answer was to shorten the loop: build a slice, show it, learn, repeat. The models below differ in <em>what drives the next loop</em> — a plan, a risk, a sprint goal, or a queue." },
              { t: "table", headers: ["Model", "Loop driver", "Cadence", "Fits"], rows: [
                ["Iterative / incremental", "Next most valuable slice", "Weeks to months", "Products where early partial value matters"],
                ["Spiral", "Biggest unresolved risk", "Per risk cycle", "Large, uncertain, high-stakes programmes"],
                ["Scrum", "Sprint goal from a prioritized backlog", "Fixed 1–4 week sprints", "Product teams with a clear owner"],
                ["Kanban", "Pull from a queue with WIP limits", "Continuous", "Ops, platform and support work with unpredictable arrivals"],
                ["SAFe", "Program Increment objectives across many teams", "PI of roughly 8–12 weeks", "Enterprises coordinating dozens of teams"]
              ] },
              { t: "h", text: "Spiral in one paragraph" },
              { t: "p", html: "Each turn of the spiral has four quadrants: set objectives, <strong>analyse and reduce risk</strong> (prototype, spike, research), build and test, then plan the next turn. It is the ancestor of the idea that security risk should shape what you build next, not be checked at the end." },
              { t: "h", text: "Scrum and Kanban, concretely" },
              { t: "ul", items: [
                "<strong>Scrum</strong>: roles (product owner, scrum master, developers), events (planning, daily scrum, review, retrospective) and artifacts (product backlog, sprint backlog, increment). Security work enters as backlog items and as part of the definition of done.",
                "<strong>Kanban</strong>: visualize the board, limit work in progress per column, measure flow (lead time, throughput). Security fixes compete in the same queue, so classes of service (an expedite lane for critical CVEs) matter.",
                "<strong>SAFe</strong>: Agile Release Trains of 5–12 teams plan together each Program Increment. Its relevance here is that security and compliance become shared enablers planned at train level, not per-team surprises."
              ] },
              { t: "note", variant: "trap", html: "Agile does not mean 'no design'. A sprint that skips threat modeling for a new payment flow has not been agile; it has deferred the cost to production." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'unpredictable incoming work', 'interrupt-driven', 'platform team' point to Kanban; 'product owner', 'sprint', 'increment' point to Scrum; 'release train', 'PI planning', 'portfolio' point to SAFe." },
              { t: "note", variant: "key", html: "<strong>Shorter loops make security cheaper only if security is inside the loop.</strong> Put it in the definition of done, not in a gate after the last sprint." }
            ]
          },
          {
            id: "devops",
            title: "What DevOps actually is",
            summary: "Culture, automation, flow and measurement — and why a pipeline alone is not DevOps.",
            minutes: 8,
            tags: ["foundation", "devops", "ci-cd", "dora", "calms"],
            blocks: [
              { t: "p", html: "DevOps removed the wall between the people who write software and the people who run it. The goal is short, safe, repeatable flow from a commit to production, with fast feedback when something breaks. Tools make it possible; ownership makes it real." },
              { t: "diagram", id: "devsecops-loop", caption: "The DevOps loop. DevSecOps keeps the loop and makes every stage own a security control." },
              { t: "h", text: "The CALMS lens" },
              { t: "table", headers: ["Letter", "Means", "Evidence you can point at"], rows: [
                ["C — Culture", "Shared ownership of outcomes", "Developers carry the pager for their service"],
                ["A — Automation", "Builds, tests, deploys and infra are code", "No manual steps between merge and prod"],
                ["L — Lean", "Small batches, limited WIP", "PRs reviewed within a day"],
                ["M — Measurement", "Decisions from flow and reliability data", "DORA metrics on a team dashboard"],
                ["S — Sharing", "Knowledge and tooling reused across teams", "Shared pipeline libraries, blameless postmortems"]
              ] },
              { t: "h", text: "CI, continuous delivery and continuous deployment" },
              { t: "ul", items: [
                "<strong>Continuous integration</strong>: every change merges to a shared branch frequently and is built and tested automatically.",
                "<strong>Continuous delivery</strong>: every passing build is <em>releasable</em>; a human decides when.",
                "<strong>Continuous deployment</strong>: every passing build is released automatically, guarded by tests, progressive rollout and monitoring."
              ] },
              { t: "stat", items: [
                { v: "4", k: "classic DORA metrics" },
                { v: "Deploy freq", k: "throughput" },
                { v: "Lead time", k: "throughput" },
                { v: "CFR + restore", k: "stability" }
              ] },
              { t: "note", variant: "warn", html: "Renaming the ops team to 'DevOps team' and giving it Jenkins recreates the wall with a new name. The test is who gets woken up when the service fails." },
              { t: "note", variant: "key", html: "<strong>DevOps is a flow problem solved with ownership and automation.</strong> Speed and stability move together when batches are small and feedback is fast." }
            ]
          },
          {
            id: "devsecops",
            title: "DevSecOps: shift left, then shift everywhere",
            summary: "What changes when security becomes part of the flow instead of a gate at the end.",
            minutes: 9,
            tags: ["foundation", "devsecops", "shift-left", "culture"],
            blocks: [
              { t: "p", html: "DevSecOps is DevOps where security is a <strong>shared, automated, continuous</strong> property of the flow. Security specialists stop being the last gate and become the people who build guardrails, paved roads and policies that every pipeline inherits." },
              { t: "h", text: "Shift left" },
              { t: "p", html: "Move checks to where a fix is cheapest: secret scanning in a pre-commit hook, SAST in the PR, dependency checks before merge. The author still has context, the change is small, and nothing has shipped." },
              { t: "widget", id: "foundDefectCost" },
              { t: "h", text: "Shift everywhere" },
              { t: "p", html: "Some risks do not exist until code meets infrastructure: a bucket that becomes public, a workload that gets an over-privileged role, a CVE disclosed after release. Shift everywhere keeps the early checks and adds <strong>cloud and runtime signals</strong> — CSPM, runtime sensors, admission control — that feed back to the owning team." },
              { t: "compare",
                bad: { title: "Security as a gate", items: ["One team reviews everything before release", "Findings arrive as a PDF", "Developers learn security from incidents"] },
                good: { title: "Security as a property", items: ["Policies as code in every pipeline", "Findings land in the owner's backlog with a fix hint", "Exceptions are time-boxed and visible"] } },
              { t: "h", text: "The operating model" },
              { t: "table", headers: ["Role", "Owns", "Does not own"], rows: [
                ["Developers", "Fixing findings in their code and config", "Choosing which scanners exist"],
                ["Platform / DevOps", "Paved-road pipelines, runners, secrets plumbing", "Business risk decisions"],
                ["Security engineering", "Policies, thresholds, tooling, champions programme", "Fixing every finding themselves"],
                ["Leadership", "Risk appetite, SLAs per severity, exceptions", "Tool configuration"]
              ] },
              { t: "note", variant: "tip", html: "Start every new gate in <em>audit</em> mode, measure the noise, then move to <em>warn</em>, then <em>block</em>. A gate that blocks on day one with 400 legacy findings gets disabled by day three." },
              { t: "quiz", id: "found-sdlc" },
              { t: "note", variant: "key", html: "<strong>Shift left makes fixes cheap; shift everywhere makes coverage complete.</strong> You need both, and both must route findings to the person who can fix them." }
            ]
          }
        ]
      },
      {
        id: "ssdlc",
        name: "Secure SDLC",
        icon: "shield",
        lessons: [
          {
            id: "ssdlc-phases",
            title: "Security in every SDLC phase",
            summary: "The concrete security activity and evidence each phase should produce.",
            minutes: 9,
            tags: ["foundation", "ssdlc", "requirements", "operations"],
            blocks: [
              { t: "p", html: "A <strong>secure SDLC (SSDLC)</strong> is any lifecycle model with a defined security activity in each phase and an artifact that proves it happened. The model can be Scrum or Waterfall; what makes it secure is the evidence chain." },
              { t: "diagram", id: "ssdlc-phases", caption: "Each phase emits evidence the next phase can check automatically." },
              { t: "table", headers: ["Phase", "Security activity", "Evidence", "Typical tooling"], rows: [
                ["Requirements", "Security and privacy requirements, abuse cases, data classification", "Tagged backlog items, compliance mapping", "Backlog templates, ASVS-style checklists"],
                ["Design", "Threat modeling, secure design review", "Threat model with mitigations as tickets", "DFD tools, STRIDE worksheets"],
                ["Implementation", "Secure coding standards, peer review, secret hygiene", "Reviewed PRs, clean pre-commit runs", "Linters, gitleaks, IDE plugins"],
                ["Verification", "SAST, SCA, IaC and container scanning, DAST", "Quality-gate results attached to the build", "SonarQube, Snyk, Wiz CLI, ZAP"],
                ["Release", "Signing, SBOM, provenance, change approval", "Signed digest plus attestation", "cosign, CycloneDX, SLSA generators"],
                ["Operations", "Posture management, runtime detection, patching, IR", "Issue SLAs met, incident timelines", "Wiz, SIEM, runtime sensors"]
              ] },
              { t: "h", text: "Writing a security requirement that can be tested" },
              { t: "compare",
                bad: { title: "Untestable", items: ["The API must be secure", "Use strong encryption", "Protect user data"] },
                good: { title: "Testable", items: ["Every endpoint enforces object-level authorization; a test calls /orders/{other-user-id} and expects 403", "Data at rest uses AES-256-GCM via the managed KMS key", "PII fields are tagged and never written to application logs"] } },
              { t: "note", variant: "tip", html: "Map each requirement to the gate that verifies it. If no gate can, it becomes a review checklist item — and you know where your manual effort goes." },
              { t: "h", text: "The release phase, in brief: supply-chain integrity" },
              { t: "p", html: "The release row above is where the SSDLC meets the software supply chain. Most of what you ship is other people's code, built by machines you trust implicitly, so a release needs three pieces of evidence: an <strong>SBOM</strong> (what is inside), a <strong>signature</strong> by digest (we built it and nobody changed it), and <strong>provenance</strong> graded by SLSA level (which commit and builder made it). Forge teaches all three in one place — start with <a href='#/chain/supply/supply-chain'>software supply-chain attacks and where to defend</a>, then <a href='#/chain/supply/sbom-signing'>SBOMs and Sigstore signing</a> and <a href='#/chain/supply/slsa-provenance'>SLSA, provenance, in-toto and VEX</a>." },
              { t: "note", variant: "key", html: "<strong>An SSDLC is defined by evidence, not by intention.</strong> For every phase, name the activity, the artifact it produces, and the automated check that consumes it." }
            ]
          },
          {
            id: "threat-modeling",
            title: "Threat modeling with STRIDE and PASTA",
            summary: "Draw the system, find where trust changes, and turn threats into tickets.",
            minutes: 10,
            tags: ["advanced", "threat-modeling", "stride", "pasta", "dfd"],
            blocks: [
              { t: "p", html: "Threat modeling answers four questions: <em>what are we building, what can go wrong, what are we doing about it, and did we do a good job?</em> It is a design activity, so it belongs before the code — and again whenever a trust boundary moves." },
              { t: "h", text: "Step 1: a data-flow diagram" },
              { t: "p", html: "Draw external entities, processes, data stores and the flows between them. Then draw <strong>trust boundaries</strong> wherever privilege or ownership changes: internet to load balancer, service to database, CI runner to cloud account. Most real threats sit on those lines." },
              { t: "h", text: "Step 2: STRIDE each element" },
              { t: "widget", id: "foundStride" },
              { t: "h", text: "PASTA when risk must be business-weighted" },
              { t: "p", html: "PASTA (Process for Attack Simulation and Threat Analysis) is a seven-stage, risk-centric method: define business objectives, define technical scope, decompose the application, analyse threats, analyse weaknesses, model attacks, then analyse risk and impact. It is heavier than STRIDE and pays off for high-value systems where you must justify spend to the business." },
              { t: "table", headers: ["", "STRIDE", "PASTA"], rows: [
                ["Style", "Threat-category checklist per element", "Seven-stage risk process"],
                ["Effort", "An hour per feature", "Days for a system"],
                ["Output", "Threats and mitigations", "Attack trees and business-weighted risk"],
                ["Use when", "Every significant design change", "Crown-jewel systems, regulatory scrutiny"]
              ] },
              { t: "note", variant: "trap", html: "A threat model that lives in a slide deck is dead on arrival. File each mitigation as a ticket linked to the feature, and add the verifying test to the pipeline." },
              { t: "note", variant: "key", html: "<strong>Threats live on trust boundaries.</strong> Draw the flows, mark where trust changes, STRIDE each crossing, and ship the mitigations as tracked work." }
            ]
          },
          {
            id: "secure-design-coding",
            title: "Secure design, secure coding and security testing",
            summary: "The design principles that prevent whole bug classes, and the test types that catch the rest.",
            minutes: 9,
            tags: ["practitioner", "secure-design", "secure-coding", "testing"],
            blocks: [
              { t: "h", text: "Design principles that remove bug classes" },
              { t: "ul", items: [
                "<strong>Least privilege</strong> — every identity, human or workload, gets only what it needs.",
                "<strong>Defense in depth</strong> — no single control is load-bearing.",
                "<strong>Secure defaults</strong> — private by default, deny by default, encryption on by default.",
                "<strong>Minimize attack surface</strong> — fewer ports, fewer packages, fewer endpoints.",
                "<strong>Fail safely</strong> — errors deny access and leak nothing.",
                "<strong>Separate duties</strong> — the identity that builds cannot also approve and deploy to production."
              ] },
              { t: "h", text: "Secure coding habits that matter most" },
              { t: "table", headers: ["Habit", "Prevents", "Example"], rows: [
                ["Parameterized queries", "Injection", "<code class='tok'>PreparedStatement</code> with bound values"],
                ["Context-aware output encoding", "XSS", "Template auto-escaping, <code class='tok'>textContent</code> not raw HTML"],
                ["Validate at trust boundaries", "Logic abuse, mass assignment", "Schema validation with allow-lists"],
                ["Secrets from a store, never source", "Credential leaks", "Vault or the CI credential store (see <a href='#/chain/identity/secrets-e2e'>secrets end to end</a>)"],
                ["Pinned, reviewed dependencies", "Supply-chain compromise", "Lockfiles plus SCA in CI"]
              ] },
              { t: "h", text: "Security test types and where they run" },
              { t: "table", headers: ["Type", "Looks at", "Runs", "Strength / limit"], rows: [
                ["SAST", "Source code", "IDE, PR, CI", "Early and cheap; false positives, no runtime context"],
                ["SCA", "Dependencies and licences", "PR, CI, registry", "Known CVEs fast; reachability often unknown"],
                ["Secret scanning", "Commits and history", "Pre-commit, push, CI", "Very high value; must cover history too"],
                ["IaC scanning", "Terraform, Helm, manifests", "PR, CI", "Stops misconfig before it exists"],
                ["DAST", "Running app over HTTP", "Staging", "Real behaviour; slower, needs a deployed target"],
                ["IAST / RASP", "Instrumented runtime", "Test / prod", "Precise; agent overhead"],
                ["Pen testing", "Whole system with human creativity", "Periodic", "Finds logic flaws; expensive and point-in-time"]
              ] },
              { t: "note", variant: "key", html: "<strong>Design principles delete bug classes; tests only find instances.</strong> Spend design effort where a principle can remove a whole category, and let layered tests catch what remains." }
            ]
          },
          {
            id: "frameworks",
            title: "Microsoft SDL, OWASP SAMM, NIST SSDF and BSIMM",
            summary: "Four frameworks, what each is for, and how to use them together without drowning.",
            minutes: 9,
            tags: ["advanced", "sdl", "samm", "ssdf", "bsimm", "governance"],
            blocks: [
              { t: "p", html: "These frameworks answer different questions. Pick by the question you are being asked: <em>what should we do</em>, <em>how mature are we</em>, <em>can we attest to a regulator</em>, or <em>how do we compare</em>." },
              { t: "table", headers: ["Framework", "Shape", "Answers", "Use it for"], rows: [
                ["Microsoft SDL", "Prescriptive practices across training, requirements, design, implementation, verification, release, response", "What should every team do?", "A baseline set of mandatory activities"],
                ["OWASP SAMM", "5 business functions, 15 practices, maturity levels 1–3", "How mature are we and what is next?", "Self-assessment and a roadmap"],
                ["NIST SSDF (SP 800-218)", "4 practice groups: PO, PS, PW, RV", "Can we attest to secure development?", "Regulatory and customer attestations"],
                ["BSIMM", "Observed activities across 4 domains and 12 practices", "What do comparable organizations actually do?", "Benchmarking and justifying investment"]
              ] },
              { t: "h", text: "SAMM's five business functions" },
              { t: "ol", items: ["Governance — strategy, policy, education", "Design — threat assessment, security requirements, architecture", "Implementation — secure build, secure deployment, defect management", "Verification — architecture assessment, requirements testing, security testing", "Operations — incident, environment and operational management"] },
              { t: "h", text: "SSDF practice groups mapped to pipeline evidence" },
              { t: "table", headers: ["Group", "Intent", "Pipeline evidence"], rows: [
                ["PO — Prepare the Organization", "Roles, policies, toolchains defined", "Pipeline templates owned by platform, documented gates"],
                ["PS — Protect the Software", "Code and artifacts protected from tampering", "Branch protection, signed commits, signed images"],
                ["PW — Produce Well-Secured Software", "Design review, secure coding, testing", "Threat models, SAST/SCA results per build"],
                ["RV — Respond to Vulnerabilities", "Find, triage, fix, learn", "Issue SLAs, Jira tickets, root-cause trends"]
              ] },
              { t: "note", variant: "tip", html: "A common, defensible combination: adopt SDL-style mandatory activities, measure with SAMM yearly, map evidence to SSDF for attestations, and glance at BSIMM when leadership asks how you compare." },
              { t: "quiz", id: "found-ssdlc" },
              { t: "note", variant: "key", html: "<strong>Frameworks are lenses, not checklists to stack.</strong> Choose one to plan with and one to attest with, and generate the evidence from the pipeline rather than by hand." }
            ]
          }
        ]
      }
    ]
  };
})();
