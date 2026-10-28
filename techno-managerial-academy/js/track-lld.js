/* =====================================================================
   TECHLEAD · LLD Leadership track  (curriculum + quizzes + widget)

   Self-contained: registers window.TRACKS.lld, its lld-* quizzes, and the
   retry-safety lab those lessons mount.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGET
     ===================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  }
  function seg(opts, getCur, onPick) {
    var wrap = h("div", { class: "w-seg" });
    opts.forEach(function (o) {
      var b = h("button", { class: "w-seg-btn" + (o.v === getCur() ? " active" : ""), type: "button" }, o.label);
      b.addEventListener("click", function () {
        onPick(o.v);
        var all = wrap.querySelectorAll("button");
        for (var i = 0; i < all.length; i++) all[i].classList.remove("active");
        b.classList.add("active");
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  function ro(label, value, accent) {
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent-ink)" } : {}, String(value)));
  }
  function rowsTable(headers, rows) {
    var t = h("table", { style: "width:100%;border-collapse:collapse;font-size:.72rem" });
    var hr = h("tr", {});
    headers.forEach(function (x) {
      hr.appendChild(h("th", { style: "text-align:left;padding:5px 8px;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);border-bottom:1px solid var(--border)" }, x));
    });
    t.appendChild(hr);
    rows.forEach(function (r) {
      var tr = h("tr", {});
      r.forEach(function (cell, ci) {
        tr.appendChild(h("td", { style: "padding:6px 8px;border-bottom:1px solid var(--border)" + (ci === 0 ? ";font-weight:600" : ";color:var(--text-dim)") }, String(cell)));
      });
      t.appendChild(tr);
    });
    return t;
  }

  var Widgets = {};

  /* ---------------------------------------------------------------
     RETRY-SAFETY LAB
     Pick a side effect and a guard, fire N attempts, count the
     duplicate side effects that actually reach the customer.
     --------------------------------------------------------------- */
  Widgets["tm-retry-safety"] = function (mount) {
    shell(mount, "lab", "Retry-safety lab",
      "Retries are normal \u2014 timeouts, load balancer resets, an impatient customer clicking twice. Duplicate side effects are a design decision you either made or did not.");

    var OPS = [
      { v: "charge", label: "Charge a card", unit: "charge", harm: "The customer is billed twice and disputes it.", reversible: "refundable, but the trust damage is not" },
      { v: "email", label: "Send an email", unit: "email", harm: "The customer receives the same notice repeatedly.", reversible: "not reversible \u2014 it has been read" },
      { v: "balance", label: "Increment a balance", unit: "credit", harm: "The ledger drifts and reconciliation fails silently.", reversible: "correctable only if you can identify the extra writes" }
    ];
    var GUARDS = [
      { v: "none", label: "No guard", dedupes: false, detectsConflict: false, note: "every attempt applies" },
      { v: "inflight", label: "In-memory lock", dedupes: false, detectsConflict: false, note: "holds within one process, useless across instances or restarts" },
      { v: "key", label: "Idempotency key", dedupes: true, detectsConflict: false, note: "same key returns the first result" },
      { v: "keyhash", label: "Key + payload check", dedupes: true, detectsConflict: true, note: "same key, different payload is rejected rather than silently applied" }
    ];
    var op = "charge", guard = "none", attempts = 3, sameKey = true;

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var o = OPS.filter(function (x) { return x.v === op; })[0];
      var g = GUARDS.filter(function (x) { return x.v === guard; })[0];

      /* A retry carrying a *different* payload under the same key is the
         case that separates the last two guards. */
      var applied, rejected = 0, verdict;
      if (!g.dedupes) {
        applied = attempts;
      } else if (sameKey) {
        applied = 1;
      } else {
        /* different payload, same key */
        applied = g.detectsConflict ? 1 : attempts;
        rejected = g.detectsConflict ? attempts - 1 : 0;
      }
      var duplicates = Math.max(0, applied - 1);

      if (duplicates === 0) verdict = "safe";
      else if (g.dedupes) verdict = "unsafe \u2014 the guard was bypassed by the payload change";
      else verdict = "unsafe \u2014 " + duplicates + " duplicate " + o.unit + (duplicates === 1 ? "" : "s") + " reached the customer";

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Attempt", "What the system does"],
        (function () {
          var rows = [];
          for (var i = 1; i <= attempts; i++) {
            var what;
            if (i === 1) what = "applied \u2014 first attempt, record written";
            else if (!g.dedupes) what = "applied again \u2014 " + g.note;
            else if (sameKey) what = "recognised, original result returned";
            else if (g.detectsConflict) what = "rejected \u2014 same key, different payload";
            else what = "applied again \u2014 key matched but payload was never compared";
            rows.push(["#" + i, what]);
          }
          return rows;
        })()
      ));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        duplicates > 0
          ? h("span", {}, h("b", { style: "color:var(--rose-ink)" }, "Customer impact: "), o.harm + " Recovery is " + o.reversible + ".")
          : h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Safe. "), "The guard is durable and the payload is checked, so a retry is indistinguishable from a duplicate submission \u2014 which is the property you actually want.")));

      readout.innerHTML = "";
      readout.appendChild(ro("side effects applied", applied, true));
      readout.appendChild(ro("duplicates", duplicates));
      readout.appendChild(ro("rejected", rejected));
      readout.appendChild(ro("verdict", verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(OPS.map(function (x) { return { v: x.v, label: x.label }; }), function () { return op; }, function (v) { op = v; paint(); }),
      seg(GUARDS.map(function (x) { return { v: x.v, label: x.label }; }), function () { return guard; }, function (v) { guard = v; paint(); }),
      seg([{ v: 2, label: "2 attempts" }, { v: 3, label: "3 attempts" }, { v: 5, label: "5 attempts" }], function () { return attempts; }, function (v) { attempts = v; paint(); }),
      seg([{ v: "same", label: "Identical retry" }, { v: "diff", label: "Same key, changed amount" }], function () { return sameKey ? "same" : "diff"; }, function (v) { sameKey = v === "same"; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "lld-modeling": {
      title: "Modeling and contracts checkpoint",
      sub: "Invariants before class names, domain language, contracts that survive change, and retry safety.",
      questions: [
        {
          q: "You are asked to design a payout workflow at the code level. What is the strongest first move?",
          options: [
            "List the classes and their responsibilities",
            "Choose the framework and persistence layer",
            "Draw the sequence diagram for the happy path",
            "Name the states, the legal transitions, and the invariants that must never break"
          ],
          answer: 3,
          explain: "States, transitions and invariants are the part of the design that is true regardless of language, framework or class layout, so they are what everything else is derived from. Starting with class names produces a vocabulary that has to be rearranged as soon as a rule appears. The happy path is worth drawing, but it is the least informative path in the system."
        },
        {
          q: "Which change to a published REST contract is least likely to break existing consumers?",
          options: [
            "Adding a new optional field to the response",
            "Removing a field nobody appears to use",
            "Changing an id from an integer to a string",
            "Narrowing the meaning of an existing status value"
          ],
          answer: 0,
          explain: "Well-behaved consumers ignore fields they do not know about, so adding an optional one is the classic additive change. Removing a field breaks anyone who reads it, and \u201cnobody appears to use it\u201d is a statement about your logs rather than about your consumers. Changing a type or a meaning is worse still, because the code keeps working and starts being wrong."
        },
        {
          q: "An in-memory lock around a card charge does not make retries safe. Why?",
          options: [
            "It does not survive a process restart or a second instance, which is exactly when retries arrive",
            "Locks are too slow for payment paths",
            "The lock would need to be held for the whole request",
            "Payment providers do not permit client-side locking"
          ],
          answer: 0,
          explain: "The duplicate you care about usually comes from a different process \u2014 a load-balancer retry hitting another instance, or the same instance after a deploy. A guard that lives in one process's memory is invisible to both cases. Safety has to be durable and shared, which in practice means a stored idempotency record."
        },
        {
          q: "A retry arrives with an idempotency key you have already seen, but a different amount. What should the service do?",
          options: [
            "Apply the new amount, since it is presumably a correction",
            "Return the original result, ignoring the amount",
            "Reject the request, because the same key now describes two different operations",
            "Create a new operation under a generated key"
          ],
          answer: 2,
          explain: "A key is a promise that two requests are the same operation, so a changed payload means that promise has been broken and the service cannot know which one the caller meant. Silently returning the first result hides a real client bug, and applying the second turns the key into decoration. Rejecting is the only answer that surfaces the defect while still refusing to double-charge."
        },
        {
          q: "Which is the best reason to model approval as an explicit state machine rather than a set of boolean flags?",
          options: [
            "State machines are a recognised design pattern",
            "It reduces the number of database columns",
            "Illegal combinations become unrepresentable, so the rules live in one place instead of being re-checked everywhere",
            "It makes the code shorter"
          ],
          answer: 2,
          explain: "Independent booleans can express combinations the business considers impossible \u2014 approved and rejected at once, paid before approved \u2014 and every call site then has to re-derive which combinations are legal. A single state with explicit transitions makes those combinations impossible to construct and puts the rule in one auditable place. Pattern names and line counts are not the argument."
        }
      ]
    },

    "lld-quality": {
      title: "Consistency and quality checkpoint",
      sub: "Transaction boundaries, cross-system side effects, choosing the test that matches the risk, and owning the suite as a strategy.",
      questions: [
        {
          q: "Two services must both change state as part of one business operation. Which approach is soundest?",
          options: [
            "Hold one database transaction open across both service calls",
            "Write locally and publish an event through an outbox in the same transaction, then handle failure with a compensating action",
            "Call both services and retry whichever one fails",
            "Use a two-phase commit coordinator across both services"
          ],
          answer: 1,
          explain: "A transaction cannot span two independently deployable services in any way you would want to operate, so the realistic goal is atomicity between your state change and your intent to publish. The outbox gives you that locally, and a compensating action handles the business reversal when the second step ultimately fails. Naive retries leave you with a partial state and no record of it."
        },
        {
          q: "When is optimistic locking the wrong choice?",
          options: [
            "When updates are rare and conflicts almost never happen",
            "When the entity is read far more often than it is written",
            "When the update must be audited",
            "When many callers contend for the same row, so most attempts fail and retry"
          ],
          answer: 3,
          explain: "Optimistic locking is free when there is no conflict, which is why it suits low-contention updates. Under genuine contention the same work is done repeatedly and thrown away, and throughput collapses into a retry storm. At that point taking a real lock, or serialising through a queue, is the honest answer."
        },
        {
          q: "You are testing a refund flow that calls payment, inventory and notification services. Which test gives the most protection per unit of effort?",
          options: [
            "Unit tests over the refund rules, plus contract tests against each dependency",
            "An end-to-end test against live sandboxes for all three dependencies",
            "A manual test script executed before each release",
            "Snapshot tests over the response payloads"
          ],
          answer: 0,
          explain: "The two risks are that your own rules are wrong and that a dependency's expectations have drifted, and those are exactly what unit and contract tests cover cheaply and deterministically. Full end-to-end coverage catches integration problems but is slow and flaky enough that teams stop trusting it. Snapshots pin shape rather than behaviour, so they fail on harmless changes and pass on harmful ones."
        },
        {
          q: "Before refactoring a legacy rule engine nobody fully understands, what comes first?",
          options: [
            "Extract interfaces so the new implementation can be swapped in",
            "Document the intended behaviour from the original requirements",
            "Add logging so you can observe it in production",
            "Write characterization tests that pin the current behaviour, correct or not"
          ],
          answer: 3,
          explain: "You cannot preserve behaviour you have not captured, and in legacy code the current behaviour \u2014 including its bugs \u2014 is what consumers depend on. Characterization tests give you a definition of \u201cI changed nothing\u201d before you start moving code. Original requirements describe what someone once intended, which is frequently not what has been running for six years."
        },
        {
          q: "Which readiness gate is most likely to be gamed into meaninglessness?",
          options: [
            "\u201cAll invariant tests pass\u201d",
            "\u201cThe runbook exists and the dashboard is live\u201d",
            "\u201cCode quality is good\u201d",
            "\u201cSensitive data paths have been reviewed and the reviewer is named\u201d"
          ],
          answer: 2,
          explain: "A gate has to be checkable by someone who was not in the argument, and \u201cgood\u201d is an opinion that the most motivated person in the room will always declare satisfied. The other three name an artifact or an outcome you can point at. Subjective gates do not raise quality; they just relocate the debate to the worst possible moment."
        },
        {
          q: "The team's pull-request suite has grown to 40 minutes and a handful of tests fail intermittently. As the lead who owns testing strategy, what do you do first?",
          options: [
            "Set a suite time budget, quarantine flaky tests within a day with a named owner and a fix-or-delete deadline, and move slow integration paths to a later pipeline stage",
            "Raise the coverage target so the extra tests are at least useful",
            "Re-run failing tests automatically until they pass",
            "Ask each engineer to fix the flaky tests they notice in their spare time"
          ],
          answer: 0,
          explain: "A slow, flaky suite stops being trusted, and an untrusted suite is skipped or retried until green \u2014 which is worse than having fewer tests. A time budget, an explicit quarantine with an owner and a deadline, and staging slower tests later restore the suite as a signal. Automatic retries hide the flakiness, a coverage target makes the suite slower, and unowned spare-time fixes never happen."
        }
      ]
    },

    "lld-leadership": {
      title: "Review and extensibility checkpoint",
      sub: "Reviews that teach, API governance across teams, abstractions that earn their keep, and launch gates that mean something.",
      questions: [
        {
          q: "Which review comment is most likely to improve both the code and the author?",
          options: [
            "\u201cThis is too complex, please simplify.\u201d",
            "\u201cI would not have written it this way.\u201d",
            "\u201cThis check bypasses the invariant \u2014 move it into the domain service so every caller gets it.\u201d",
            "\u201cPlease follow the team style for this kind of method.\u201d"
          ],
          answer: 2,
          explain: "The useful comment names the specific risk and the principle behind the fix, so the author can apply it next time without you. \u201cToo complex\u201d and \u201cI would not have\u201d describe your reaction rather than a defect, which leaves the author guessing or defending. Style belongs in a linter, not in a human review."
        },
        {
          q: "What is the strongest evidence that an abstraction has earned its keep?",
          options: [
            "There is a named axis of variation that has already changed, or is contractually about to",
            "It reduces duplication between two existing call sites",
            "It matches a pattern from a well-known catalogue",
            "It makes the class diagram more symmetric"
          ],
          answer: 0,
          explain: "Abstractions are insurance against change, so the premium is only worth paying where change is real \u2014 a second tenant with different limits, a signed commitment to a new channel. Duplication alone is sometimes the cheaper state, especially when the two copies are diverging. Pattern names and diagram symmetry are aesthetics, and they are how speculative generality gets approved."
        },
        {
          q: "A reviewer and an author disagree on a design point and neither is moving. What is the best next step?",
          options: [
            "Defer to whoever is more senior",
            "Merge it and revisit later if it causes problems",
            "Escalate to the manager for a decision",
            "Agree the decision criteria, time-box a spike for the missing evidence, and record the outcome"
          ],
          answer: 3,
          explain: "A stuck disagreement is usually a missing fact rather than a clash of taste, so the productive move is to name what evidence would settle it and cap the time spent getting it. Seniority ends the discussion without improving the answer, and merging to revisit later means the decision is made by inertia. Escalation is for when criteria genuinely conflict, not as a substitute for stating them."
        },
        {
          q: "You need to support several payout rules that vary by tenant. What is the most defensible design?",
          options: [
            "One method with a growing chain of tenant conditionals",
            "A strategy per rule, selected by configuration, with a documented default",
            "A base class per tenant with the shared logic inherited",
            "A rules engine that reads rules from the database at runtime"
          ],
          answer: 1,
          explain: "Tenant-varying policy is a real, named axis of variation, so isolating each rule behind one interface and choosing it by configuration keeps the variation in one place. Conditional chains spread the policy across every call site, and a class per tenant makes the tenant list part of your type hierarchy. A full runtime rules engine may eventually be right, but it is a large operational commitment to make before the simpler design has failed."
        },
        {
          q: "Which set of launch gates keeps risk visible without becoming subjective perfectionism?",
          options: [
            "Every known bug fixed, and the code reviewed by two senior engineers",
            "Invariant tests green, dashboards and runbook in place, sensitive data paths reviewed, and the migration reversible",
            "A sign-off meeting with all stakeholders present",
            "Test coverage above a fixed percentage across the whole service"
          ],
          answer: 1,
          explain: "Good gates name checkable artifacts and outcomes across the dimensions that actually cause incidents: correctness, operability, security and reversibility. \u201cEvery known bug\u201d and a coverage number are proxies that can be satisfied while the risky path stays untested. A sign-off meeting records agreement rather than readiness."
        },
        {
          q: "Forty teams publish internal APIs and breaking changes keep reaching consumers. Which governance model scales best?",
          options: [
            "A central API review board that approves every endpoint before release",
            "Tier APIs by audience, enforce a style guide and breaking-change detection automatically in CI, and reserve human review for partner and public APIs",
            "Let each team choose its own conventions and resolve breakages bilaterally",
            "Freeze all existing APIs and allow only new versions"
          ],
          answer: 1,
          explain: "Most breakages are mechanical \u2014 a removed field, a changed type, a new required parameter \u2014 and a machine catches them on every change without a queue. Tiering keeps human attention for the APIs where a mistake reaches customers or partners. A board that reviews everything becomes the bottleneck teams route around, bilateral resolution does not scale past a handful of teams, and a freeze multiplies versions without reducing breakage."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.lld = {
    id: "lld",
    name: "LLD Leadership",
    short: "LLD",
    tagline: "Stay concrete when the round drops a level",
    color: "#06b6d4",
    blurb: "The moment a techno managerial interview stops asking about architecture and starts asking about code. Invariants and state before class names, contracts that survive other teams, retry safety and transaction boundaries, the test that matches the risk, refactoring without losing trust, reviews that teach, and abstractions that earn their keep.",
    modules: [
      {
        id: "modeling",
        name: "Modeling and Contracts",
        icon: "blocks",
        lessons: [
          {
            id: "hld-to-lld",
            title: "From architecture to maintainable code",
            summary: "Translating boxes into boundaries, contracts, invariants and tests \u2014 without pattern theater.",
            minutes: 9,
            tags: ["modeling", "boundaries"],
            blocks: [
              { t: "p", html: "The handover from high-level to low-level design fails in a predictable way: the boxes become packages, the arrows become method calls, and nobody ever states what must remain true. Start instead from <strong>responsibilities and state</strong> \u2014 what does this component own, what can it never allow, and what change is it there to absorb." },
              { t: "table",
                headers: ["Design move", "The leadership signal it carries"],
                rows: [
                  ["A boundary", "You can name a single owner and a single reason this changes"],
                  ["An interface", "You can name the variation it exists for, and the pressure is real"],
                  ["A state machine", "You have found the invariants and refused to let callers break them"],
                  ["A test", "You can say which invariant or integration risk it protects"],
                  ["A deletion", "You noticed something was carrying cost and no longer earning it"]
                ]
              },
              { t: "h", text: "How to run the translation" },
              { t: "ul", items: [
                "<strong>Start with responsibilities and state, not class names.</strong> Names are the last decision, not the first, and the wrong first name will distort everything after it.",
                "<strong>Say what change pressure each abstraction absorbs.</strong> If you cannot finish the sentence \u201cthis exists so that when X changes, only Y moves\u201d, you have not justified it yet.",
                "<strong>Walk one happy path and two failure paths.</strong> The failure paths are where the design is actually decided.",
                "<strong>Name where side effects cross the boundary.</strong> That is where idempotency, ordering and compensation questions live."
              ] },
              { t: "code", lang: "text", code:
                "Payout workflow, derived in order\n" +
                "\n" +
                "1. INVARIANTS   one payout per (period, payee); never negative;\n" +
                "                never paid before approved\n" +
                "2. STATES       draft -> approved -> submitted -> settled\n" +
                "                                  \\-> failed -> (retry|cancelled)\n" +
                "3. BOUNDARIES   Calculation (pure) | Approval (policy) |\n" +
                "                Submission (side effects, retryable)\n" +
                "4. CONTRACTS    submit(payoutId, idempotencyKey) -> Receipt\n" +
                "5. TESTS        one per invariant; contract test on submit\n" +
                "\n" +
                "Class names come after step 5, and they are the easy part."
              },
              { t: "compare",
                bad: { title: "Pattern theater", items: ["A factory that builds one thing", "An interface with exactly one implementation and no second in sight", "Layers that exist because layers are good"] },
                good: { title: "Justified structure", items: ["A boundary with a named owner and a reason to change", "An interface introduced when the second tenant arrived", "Layers that isolate a side effect from a pure calculation"] }
              },
              { t: "note", variant: "trap", html: "<strong>Reciting patterns is read as inexperience, not fluency.</strong> The senior version of the same knowledge is naming the pressure first and the pattern second \u2014 and being willing to say \u201cnone yet, a function is fine\u201d." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can sketch classes and methods for a component."],
                  ["Senior", "Starts from states, transitions and invariants, then derives the structure from them."],
                  ["Staff", "Picks the two or three code-level decisions that carry the risk \u2014 side-effect boundary, transaction scope, contract \u2014 and spends the time there instead of on the class diagram."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When an interviewer says <em>\u201cnow design the classes\u201d</em> or <em>\u201chow would you implement that\u201d</em>, they are checking whether your architecture was ever grounded. Answer with state and invariants before you answer with structure." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Turn a payout workflow into components and state transitions in ninety seconds, naming the invariant each boundary protects." },
              { t: "note", variant: "key", html: "<strong>Structure is only defensible once you can name what it protects or absorbs.</strong> Invariants first, boundaries second, names last \u2014 in the other order you get a tidy diagram of a system that cannot express its own rules." }
            ]
          },
          {
            id: "domain-modeling",
            title: "Domain modeling for delivery leaders",
            summary: "Turning overloaded business language into entities, values, policies and states \u2014 and making illegal states impossible where it pays.",
            minutes: 9,
            tags: ["modeling", "domain"],
            blocks: [
              { t: "p", html: "Ambiguous business words are where defects are born. When \u201caccount\u201d means the billing entity to finance, the login to support, and the tenant to engineering, every conversation appears to agree and every implementation diverges. <strong>Finding the overloaded noun is often the whole design task.</strong>" },
              { t: "table",
                headers: ["Concept", "How to explain it in an interview"],
                rows: [
                  ["Entity", "Identity that persists while its attributes change \u2014 this payout, this tenant"],
                  ["Value object", "Equal when its contents are equal, and replaced wholesale rather than mutated \u2014 Money, DateRange"],
                  ["Aggregate", "The consistency boundary: what must be true together, in one transaction"],
                  ["Policy", "A rule that varies by product, tenant or mode, isolated so it can vary"],
                  ["Domain service", "Behaviour that belongs to no single entity but still belongs to the domain"]
                ]
              },
              { t: "h", text: "Three moves that pay immediately" },
              { t: "ul", items: [
                "<strong>Hunt the overloaded noun.</strong> Ask two stakeholders to define the same word separately; the difference is your model.",
                "<strong>Make illegal states unrepresentable where it is cheap.</strong> A single state field beats four independent booleans that can express \u201capproved and rejected\u201d.",
                "<strong>Keep invariants next to the data they protect.</strong> A rule enforced in three call sites is a rule that will be missing from the fourth.",
                "<strong>Use " + tok("Money") + " rather than a number.</strong> Currency, rounding and scale are domain rules, and a raw float will lose all three."
              ] },
              { t: "code", lang: "text", code:
                "Four booleans: 16 combinations, 11 of them nonsense\n" +
                "  isDraft, isApproved, isRejected, isPaid\n" +
                "  -> approved AND rejected      representable\n" +
                "  -> paid but not approved      representable\n" +
                "  -> every caller re-checks which combos are legal\n" +
                "\n" +
                "One state: 5 states, 6 legal transitions, 0 nonsense\n" +
                "  DRAFT -> APPROVED -> PAID\n" +
                "  DRAFT -> REJECTED\n" +
                "  APPROVED -> CANCELLED\n" +
                "  -> illegal combinations cannot be constructed at all"
              },
              { t: "note", variant: "trap", html: "<strong>Do not model the whole domain before shipping any of it.</strong> Model the part with rules that bite \u2014 money, state transitions, permissions \u2014 and leave the rest as plain data until it earns more." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Identifies the main entities and their fields."],
                  ["Senior", "Distinguishes entities from value objects and makes illegal states unrepresentable for the rules that matter."],
                  ["Staff", "Aligns model boundaries with team boundaries, so the most common change lives inside one module owned by one team."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The trigger is any requirement where two stakeholders use the same word confidently and mean different things, or where a status is expressed as several independent flags." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Model an approval workflow with explicit states, then name the invariant that the booleans version would have let someone break." },
              { t: "note", variant: "key", html: "<strong>Every illegal state you make representable is a bug you have agreed to catch by hand forever.</strong> Collapsing flags into one state with explicit transitions moves the rule from every call site into the type, which is the cheapest correctness win available at this level." }
            ]
          },
          {
            id: "api-contracts",
            title: "Contracts that survive other teams",
            summary: "Protecting consumers from churn while leaving yourself room to evolve \u2014 additive change, honest versioning, and errors somebody can act on.",
            minutes: 9,
            tags: ["modeling", "contracts"],
            blocks: [
              { t: "p", html: "A contract has two customers with opposite interests: the consumer who wants nothing to ever change, and you, who needs to keep shipping. The resolution is not compromise \u2014 it is <strong>making the cheap changes additive and reserving version bumps for changes of meaning</strong>, because coordinated cross-team releases are the expensive thing you are trying to avoid." },
              { t: "table",
                headers: ["Concern", "Design move", "What it costs"],
                rows: [
                  ["Adding data", "New optional field; consumers ignore unknowns", "Response grows; two shapes in the wild for a while"],
                  ["Validation", "Field-level errors with stable machine-readable codes", "You now owe those codes backwards compatibility too"],
                  ["Pagination", "Cursors rather than offsets on mutable lists", "Opaque cursors are harder to debug by hand"],
                  ["Meaning change", "A new version, running alongside the old", "Two implementations, until the old one is genuinely empty"],
                  ["Deprecation", "Usage metrics, a dated timeline, a migration path", "Calendar time, and chasing the last consumer"]
                ]
              },
              { t: "h", text: "Errors are part of the contract" },
              { t: "p", html: "An error that says " + tok("400 Bad Request") + " with no body forces every consumer to guess, and they will guess by string-matching your message text \u2014 at which point your prose is a contract you did not know you signed. Return a stable code per field, and a correlation id so support can find the request." },
              { t: "code", lang: "text", code:
                "422 Unprocessable Entity\n" +
                "{\n" +
                "  \"error\": \"validation_failed\",\n" +
                "  \"correlationId\": \"7f3a-...\",\n" +
                "  \"fields\": [\n" +
                "    { \"path\": \"payee.iban\",   \"code\": \"format_invalid\" },\n" +
                "    { \"path\": \"amount\",       \"code\": \"below_minimum\",\n" +
                "      \"detail\": { \"minimum\": \"1.00\", \"currency\": \"EUR\" } }\n" +
                "  ]\n" +
                "}\n" +
                "\n" +
                "Partial failure reported per field, machine-readable codes,\n" +
                "one id that ties this to a log line. The message text is for\n" +
                "humans and is explicitly NOT the contract."
              },
              { t: "note", variant: "trap", html: "<strong>Removing a field because the logs show nobody reading it</strong> tells you about the consumers you can see. The one you cannot see is the batch job that runs quarterly." },
              { t: "table",
                headers: ["Tier", "Change to a status enum", "Why it lands there"],
                rows: [
                  ["Naive", "Reuse " + tok("PENDING") + " to also mean \u201cawaiting review\u201d", "Consumers keep working and start being wrong \u2014 the worst failure mode there is."],
                  ["Solid", "Add " + tok("AWAITING_REVIEW") + " and document that unknown values must be tolerated", "Additive, and it tells consumers how to be resilient."],
                  ["Standout", "The same, plus a metric on which consumers still cannot handle the new value, and a dated deprecation of the old behaviour", "You can see the migration finish instead of assuming it."]
                ]
              },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Designs a clean request and response shape."],
                  ["Senior", "Defaults to additive change, versions only on meaning changes, and publishes error semantics as part of the contract."],
                  ["Staff", "Sets the compatibility policy for the organisation and builds the checks that catch a breaking change before a reviewer has to."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Anything phrased as <em>\u201canother team wants to change the contract we depend on\u201d</em> is asking about consumer impact, a compatibility window, contract tests and a deprecation plan \u2014 in that order." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Design the error response for a request where two fields fail validation for different reasons, and say what makes it safe to add a third reason later." },
              { t: "note", variant: "key", html: "<strong>The dangerous change is not the one that breaks consumers \u2014 it is the one that lets them keep working while being wrong.</strong> Adding is safe, removing is loud, and quietly redefining a value is silent, which is why meaning changes are the only ones that genuinely require a version." }
            ]
          },
          {
            id: "idempotency",
            title: "Idempotency in real systems",
            summary: "Retries are normal and duplicate side effects are a design bug. Durable keys, payload checks, dedupe windows.",
            minutes: 9,
            tags: ["modeling", "idempotency"],
            blocks: [
              { t: "p", html: "Assume every request will be sent more than once. A timeout leaves the caller genuinely unable to tell success from failure, so retrying is the correct client behaviour \u2014 which makes <strong>the duplicate side effect your problem, not theirs</strong>. The question is only whether you decided how to absorb it." },
              { t: "table",
                headers: ["Case", "What the duplicate does", "How visible it is"],
                rows: [
                  ["Payment retry", "Charges the customer twice", "Immediately, and they will tell you"],
                  ["Webhook replay", "Advances a state machine twice", "Later, as an impossible state"],
                  ["File ingest retry", "Doubles rows for one partition", "At month end, as a variance nobody can explain"],
                  ["Notification retry", "Sends the same email repeatedly", "Instantly, and it cannot be unsent"]
                ]
              },
              { t: "widget", id: "tm-retry-safety" },
              { t: "h", text: "What a real guard requires" },
              { t: "ul", items: [
                "<strong>Durable, not in-memory.</strong> The retry usually lands on a different instance, or on the same one after a restart \u2014 which is precisely when a process-local lock is gone.",
                "<strong>Placed at the side-effect boundary.</strong> Deduplicating in the API layer does nothing if the retry enters through the queue consumer.",
                "<strong>Payload-checked.</strong> Same key with a different amount means the caller has broken the promise the key represents; reject it rather than guessing which one they meant.",
                "<strong>Bounded by a stated window.</strong> Records cost storage, so you must decide how late a retry can arrive and still be recognised \u2014 and say what happens after that."
              ] },
              { t: "code", lang: "text", code:
                "Dedupe window: the trade-off, stated\n" +
                "\n" +
                "  window = 1 hour   cheap storage; a retry from a queue that\n" +
                "                    was paused overnight double-charges\n" +
                "  window = 7 days   covers realistic replay; ~7d of keys to\n" +
                "                    store and index\n" +
                "  window = forever  no duplicate is ever possible; the table\n" +
                "                    grows without bound and needs its own plan\n" +
                "\n" +
                "Pick from the longest credible replay delay in YOUR system\n" +
                "(queue retention, batch reruns, support-triggered replays)\n" +
                "and write the number down where the on-call can find it."
              },
              { t: "note", variant: "trap", html: "<strong>\u201cThe client should not retry\u201d is not a design.</strong> Load balancers, proxies, mobile networks and impatient people all retry, and none of them read your documentation." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows that retries can cause duplicates."],
                  ["Senior", "Places a durable idempotency key at the side-effect boundary and defines what a same-key, different-payload request does."],
                  ["Staff", "Makes idempotency a default \u2014 a shared library, a review checklist item, a test fixture \u2014 so individual teams cannot forget it."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Every question containing <em>timeout</em>, <em>submitted twice</em>, <em>replay</em>, or <em>at-least-once</em> is an idempotency question, whatever it appears to be about on the surface." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A customer submits checkout twice during a timeout. Design the safe path, and say what you do when the second request has a different total." },
              { t: "note", variant: "key", html: "<strong>Idempotency is a durable record at the side-effect boundary, not a lock and not a client instruction.</strong> Get the placement and the payload check right and a retry becomes indistinguishable from a duplicate click \u2014 which is exactly the property that lets the rest of your system be at-least-once." },
              { t: "quiz", id: "lld-modeling" }
            ]
          }
        ]
      },
      {
        id: "quality",
        name: "Consistency and Quality",
        icon: "wrench",
        lessons: [
          {
            id: "transactions",
            title: "Transaction boundaries are business boundaries",
            summary: "What must be true together decides your transaction, and crossing services means giving up atomicity for something you can actually operate.",
            minutes: 9,
            tags: ["quality", "consistency"],
            blocks: [
              { t: "p", html: "A transaction boundary is a statement about the business: <strong>these facts must be true together or not at all</strong>. Choose it from the invariants, not from which tables happen to live in the same database \u2014 and accept that once a second service is involved, atomicity is no longer on the menu." },
              { t: "table",
                headers: ["Pattern", "When it fits", "What you give up"],
                rows: [
                  ["Single local transaction", "Everything that must agree is in one datastore", "Nothing \u2014 take this whenever you can get it"],
                  ["Optimistic locking", "Contested updates that rarely actually collide", "Under real contention it becomes a retry storm"],
                  ["Transactional outbox", "A local write plus a reliable event", "Exactly-once; consumers must be idempotent"],
                  ["Compensating action", "Multi-step process that can fail halfway", "Atomicity, and the reversal is customer-visible"],
                  ["Distributed two-phase commit", "Rarely, and usually inside one vendor's stack", "Availability, plus a coordinator you now operate"]
                ]
              },
              { t: "h", text: "Deriving a boundary" },
              { t: "p", html: "Take coupon redemption. The invariant is that a coupon is redeemed at most once and the discount applied exactly once. That pair must be atomic, so they belong in one transaction. Emailing the customer does not \u2014 and if you put it inside, a mail outage now fails checkouts." },
              { t: "code", lang: "text", code:
                "Coupon redemption, boundary drawn from the invariant\n" +
                "\n" +
                "  INSIDE the transaction\n" +
                "    mark coupon redeemed (unique on coupon_id)\n" +
                "    apply discount to the order\n" +
                "    append outbox row: CouponRedeemed\n" +
                "\n" +
                "  OUTSIDE\n" +
                "    publish the event (relay reads the outbox)\n" +
                "    send the confirmation email  (at-least-once, idempotent)\n" +
                "    update the analytics rollup\n" +
                "\n" +
                "Test: if the thing outside fails forever, is the ledger still\n" +
                "correct? Yes -> the boundary is right."
              },
              { t: "note", variant: "trap", html: "<strong>Putting a network call inside a database transaction</strong> holds locks for the duration of somebody else's outage. It is the most common way a dependency's bad day becomes your write-path incident." },
              { t: "compare",
                bad: { title: "Boundary from the schema", items: ["Everything in the same database goes in one transaction", "A remote call inside the transaction \u201cfor consistency\u201d", "Nothing stated about what may be eventual"] },
                good: { title: "Boundary from the invariant", items: ["Only what must agree is atomic", "Side effects moved outside, made idempotent", "Written down: what is immediate, what is eventual, and by how long"] }
              },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Wraps related writes in a transaction."],
                  ["Senior", "Chooses the boundary from what must be true together, and uses an outbox or a compensation where a transaction cannot reach."],
                  ["Staff", "Explains the customer consequence of each consistency choice to product owners, so a compensating action is designed into the journey rather than discovered in support tickets."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The trigger is any requirement of the form <em>\u201cboth of these must happen\u201d</em>. Ask immediately whether both must happen <em>together</em>, or merely both eventually \u2014 the answers produce completely different systems." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Choose the transaction boundary for coupon redemption and justify what you deliberately left outside it." },
              { t: "note", variant: "key", html: "<strong>Ask what must be true together, and put exactly that in one transaction.</strong> Everything else becomes an event plus an idempotent consumer \u2014 which is slower to reason about but is the only version that survives a dependency being down." }
            ]
          },
          {
            id: "testing-design",
            title: "Tests as design feedback",
            summary: "Choose the test from the risk. Invariants get unit tests, consumers get contract tests, and legacy behaviour gets characterized before it is touched.",
            minutes: 8,
            tags: ["quality", "testing"],
            blocks: [
              { t: "p", html: "Stop asking how much testing is enough and ask <strong>which risk each test retires</strong>. That reframing does two things: it kills the coverage-percentage argument, and it makes hard-to-test code legible as a design problem rather than a testing problem." },
              { t: "table",
                headers: ["Risk", "Test that actually retires it", "Why not the others"],
                rows: [
                  ["A domain rule is wrong", "Unit test on the rule, with the edge cases", "An end-to-end test proves it once, slowly, through six layers of noise"],
                  ["A consumer's expectations drift", "Contract test against the published shape", "Unit tests cannot see the other team's assumptions"],
                  ["Persistence side effects", "Integration test against a real engine", "Mocks confirm your beliefs about the database, not the database"],
                  ["Legacy behaviour changing under a refactor", "Characterization test written before you start", "Requirements describe intent, not what has been running"],
                  ["A whole journey is broken", "One or two end-to-end smoke paths", "More than a handful becomes flaky and gets ignored"]
                ]
              },
              { t: "ul", items: [
                "<strong>Unit-test the rules, not the plumbing.</strong> A test that asserts a getter returns what the setter set retires no risk.",
                "<strong>Contract-test at every boundary you publish</strong> \u2014 APIs and event schemas both.",
                "<strong>Characterize before refactoring.</strong> The current behaviour, bugs included, is what consumers depend on.",
                "<strong>Treat untestable code as a design signal.</strong> Needing six mocks to test one rule usually means the rule is entangled with I/O and wants extracting."
              ] },
              { t: "note", variant: "trap", html: "<strong>Snapshot tests pin shape, not behaviour.</strong> They fail on harmless formatting changes and pass while the numbers inside are wrong, which trains the team to update them without reading them." },
              { t: "note", variant: "warn", html: "<strong>Coverage is a diagnostic, not a target.</strong> Made a goal, it reliably produces tests that execute lines and assert nothing \u2014 the number goes up and the protection does not." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Writes unit and integration tests for their own changes."],
                  ["Senior", "Chooses each test by the risk it retires, and treats hard-to-test code as design feedback."],
                  ["Staff", "Shapes the suite so it stays fast and trusted as the team grows, and can name the risks deliberately left to production monitoring."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When an interviewer asks what you would test, answer in risks: correctness of a rule, compatibility with a consumer, side effects on persistence, and one journey end to end. Naming the risk is the answer; the test type follows." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Pick the tests for a refund workflow that calls payment, inventory and notification, and justify each by the risk it retires." },
              { t: "note", variant: "key", html: "<strong>Every test should be traceable to a risk you can name.</strong> That single discipline replaces the coverage argument, keeps the suite fast enough to be trusted, and turns \u201cthis is hard to test\u201d into the design feedback it actually is." }
            ]
          },
          {
            id: "testing-strategy",
            title: "Owning the team\u2019s testing strategy",
            summary: "Choosing a test per risk is an engineer\u2019s skill. Keeping the whole suite fast, trusted and pointed at the right risks is the lead\u2019s job.",
            minutes: 9,
            tags: ["quality", "testing", "leadership"],
            blocks: [
              { t: "p", html: "<a class='inline' href='#/lld/quality/testing-design'>Tests as design feedback</a> covers choosing the right test for a risk. The lead\u2019s problem is one level up: <strong>a suite of thousands of tests written by many people over years</strong>, which is either a trusted signal that lets the team ship daily or a slow, flaky ritual everyone retries until it goes green. Which one you have is a management outcome, not an accident." },
              { t: "table",
                headers: ["Strategy decision", "A workable default", "Why"],
                rows: [
                  ["Pull-request suite time", "A budget, typically under ten minutes", "Past that, people batch changes and stop running it locally"],
                  ["Flaky tests", "Quarantined within a day, owner named, fixed or deleted within a week", "One known-flaky test teaches everyone to ignore red"],
                  ["Cross-team boundaries", "Consumer-driven contract tests, run in the provider\u2019s pipeline", "The provider learns it broke a consumer before merging, not after deploying"],
                  ["End-to-end tests", "A handful of journey smoke tests, owned by named teams", "More become slow, flaky and unowned"],
                  ["Test data", "Synthetic fixtures and factories; never production copies with personal data", "Production copies leak, drift, and make tests order-dependent"],
                  ["Escaped defects", "Each one asks which layer should have caught it", "Turns incidents into specific gaps in the suite rather than general guilt"]
                ]
              },
              { t: "h", text: "Measuring whether the strategy works" },
              { t: "ul", items: [
                "<strong>Change-failure rate.</strong> The share of deploys that need a fix or rollback. It is the outcome the suite exists to move.",
                "<strong>Escaped defects by layer.</strong> Rules escaping means weak unit tests; integration escapes point at mocks standing in for real engines.",
                "<strong>Suite time and flake rate, trended.</strong> Both creep a little every week and are only fixable when caught early.",
                "<strong>Time to diagnose a failure.</strong> A red build that takes an hour to interpret is nearly as costly as a flaky one."
              ] },
              { t: "code", lang: "text", code:
                "Testing strategy on one page\n" +
                "\n" +
                "BUDGET     PR suite <= 8 min; full suite <= 25 min, pre-deploy\n" +
                "LAYERS     rules: unit | persistence: real engine in container\n" +
                "           boundaries: consumer contracts in provider CI\n" +
                "           journeys: 6 smoke paths, owners listed below\n" +
                "FLAKES     auto-quarantine on 2 fails in 50 runs; owner paged\n" +
                "           in channel; fix or delete in 5 working days\n" +
                "DATA       factories only; no production snapshots\n" +
                "REVIEW     monthly: change-failure rate, escapes by layer,\n" +
                "           suite time, flake rate\n" +
                "NOT TESTED in CI: load (weekly job), third-party sandboxes\n" +
                "           (nightly), visual layout (manual before release)"
              },
              { t: "note", variant: "trap", html: "<strong>Mandating a coverage percentage is the most common way a lead degrades a suite.</strong> It rewards tests that execute lines and assert nothing, slows the suite, and moves the change-failure rate not at all. Use coverage to find untested risky code, never as a target." },
              { t: "note", variant: "warn", html: "<strong>Automatic retries on failure hide flakiness instead of fixing it.</strong> They make the build green and the signal meaningless, and the real intermittent bug in production code is retried away along with the bad tests." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Writes good tests for their own changes and fixes the ones they break."],
                  ["Senior", "Sets the suite time budget and flaky-test policy, and introduces contract tests at team boundaries."],
                  ["Staff", "Runs testing as a strategy measured by change-failure rate and escapes by layer, and states which risks are deliberately left to monitoring."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cOur builds are slow and flaky\u201d</em>, <em>\u201cbugs keep escaping to production\u201d</em> or <em>\u201chow do you ensure quality on your team\u201d</em> are asking for a strategy with a budget, a policy and an outcome metric \u2014 not a list of test types." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Your pull-request suite takes 40 minutes and fails intermittently about one run in ten. Lay out the first two weeks of changes and the metric you would report a month later." },
              { t: "note", variant: "key", html: "<strong>A suite is only worth what the team trusts it to say.</strong> Protect its speed with a budget, its signal with a flaky-test policy that has an owner and a deadline, and its aim with escaped-defect reviews \u2014 then report change-failure rate, which is the number the suite exists to move." }
            ]
          },
          {
            id: "safe-refactoring",
            title: "Refactoring without losing trust",
            summary: "Refactoring is a delivery strategy when it preserves behaviour and reduces future risk \u2014 and a credibility loss when it is presented as tidying.",
            minutes: 9,
            tags: ["quality", "refactoring"],
            blocks: [
              { t: "p", html: "Nobody funds tidying. Refactoring gets approved when you can connect it to something the business already feels: <strong>lead time, incident rate, change-failure rate, support load, or a roadmap item that is currently blocked</strong>. The engineering work is the easy half; the framing is what gets you the time." },
              { t: "table",
                headers: ["Step", "Why it comes here"],
                rows: [
                  ["Characterize", "You cannot preserve behaviour you have not captured"],
                  ["Find a seam", "Substitution has to be possible before it can be safe"],
                  ["Change in small commits", "Each one is independently reviewable and revertible"],
                  ["Keep it behind a flag if behaviour could shift", "The undo path stays measured in minutes"],
                  ["Measure the reduction", "\u201cCleaner\u201d is an opinion; a lead-time or defect trend is evidence"],
                  ["Stop when the risk exceeds the value", "The senior move nobody rehearses is abandoning a half-finished refactor deliberately"]
                ]
              },
              { t: "h", text: "Making the case" },
              { t: "ul", items: [
                "<strong>Bring a trend, not an anecdote.</strong> Lead time on this module, escaped defects, how long a change sits blocked \u2014 three months of data beats any adjective.",
                "<strong>Propose a slice, not a programme.</strong> \u201cTwo weeks on the pricing rules\u201d is fundable; \u201crewrite the billing engine\u201d is a negotiation you will lose.",
                "<strong>Name the feature it unblocks.</strong> Refactoring justified by future features is speculative; justified by a specific blocked item it is a dependency.",
                "<strong>State the success metric before you start.</strong> Otherwise you cannot tell whether it worked, and neither can the person who approved it."
              ] },
              { t: "code", lang: "text", code:
                "The ask, in the form that gets approved\n" +
                "\n" +
                "EVIDENCE   Pricing changes: median 9 days, 3 of the last 7\n" +
                "           needed a follow-up fix. Comparable modules: 2 days.\n" +
                "BLOCKED    Tiered pricing (Q3 commitment) needs 4 call sites\n" +
                "           changed in lockstep; that is where the fixes come from.\n" +
                "SLICE      2 weeks: characterize, extract the rule from the\n" +
                "           controller, one strategy per tier.\n" +
                "METRIC     Next pricing change lands in under 3 days with no\n" +
                "           follow-up fix.\n" +
                "NOT DOING  The billing engine. Out of scope, deliberately."
              },
              { t: "note", variant: "trap", html: "<strong>A refactor that changes behaviour and gets called a refactor destroys the word for everyone.</strong> If behaviour moves, it is a change, it needs a flag, and it needs to be reviewed as one." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Refactors in small steps with tests."],
                  ["Senior", "Characterises first, ships behind a flag where behaviour could shift, and funds the work with a trend and a blocked commitment."],
                  ["Staff", "Runs refactoring as a portfolio against measured cycle-time and defect data, and stops a half-done refactor deliberately when the value runs out."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The trigger for this framing is any version of <em>\u201cwhy should we spend a sprint on tech debt\u201d</em>. Answer with a trend, a blocked commitment, a slice and a metric \u2014 never with maintainability as an end in itself." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Order a safe refactor of a legacy rule engine, then make the two-minute case for it to a product manager who wants features." },
              { t: "note", variant: "key", html: "<strong>Refactoring is funded by risk and cycle time, never by cleanliness.</strong> Characterize first so you can prove you changed nothing, ship in small reverts-friendly steps, and state up front the number that will show it worked \u2014 including the point at which you would stop." },
              { t: "quiz", id: "lld-quality" }
            ]
          }
        ]
      },
      {
        id: "leadership",
        name: "Review and Extensibility",
        icon: "share",
        lessons: [
          {
            id: "code-review",
            title: "Code review leadership",
            summary: "Reviews that improve the design and the reviewer's team without turning into style fights.",
            minutes: 8,
            tags: ["leadership", "review"],
            blocks: [
              { t: "p", html: "A review has two outputs: this change gets better, and the author gets better. Most reviews deliver only the first, and many deliver neither, because the comments <strong>describe the reviewer's reaction rather than a defect or a principle</strong>. Tiering your comments fixes most of it." },
              { t: "table",
                headers: ["Tier", "What it means", "Does it block?"],
                rows: [
                  ["Correctness", "This is wrong, or it breaks an invariant", "Yes"],
                  ["Risk", "This will hurt in production \u2014 unbounded query, missing idempotency", "Yes"],
                  ["Maintainability", "The next person will misread this", "Discuss; often yes"],
                  ["Preference", "I would have written it differently", "No \u2014 and label it so"]
                ]
              },
              { t: "compare",
                bad: { title: "Reaction", items: ["\u201cThis is too complex.\u201d", "\u201cI don't like this approach.\u201d", "\u201cPlease rewrite.\u201d", "Fourteen unlabelled comments of equal apparent weight."] },
                good: { title: "Defect plus principle", items: ["\u201cThis check bypasses the invariant \u2014 move it into the domain service so every caller gets it.\u201d", "\u201cCan we split orchestration from policy, so the rule is unit-testable without the HTTP layer?\u201d", "\u201cBlocking: this query has no bound and the table grows per tenant.\u201d", "Three blocking comments, the rest labelled preference."] }
              },
              { t: "h", text: "Habits that compound" },
              { t: "ul", items: [
                "<strong>Label the tier explicitly.</strong> An author who cannot tell blocking from taste will either fight everything or concede everything.",
                "<strong>Ask questions that carry a reusable principle.</strong> \u201cWhat happens if this is delivered twice?\u201d teaches idempotency better than a lecture would.",
                "<strong>Cap your blocking comments.</strong> Three that matter change the code; fourteen produce a defensive author and a rubber-stamp next time.",
                "<strong>Send style to a linter.</strong> Every human comment spent on formatting is one not spent on a real risk.",
                "<strong>Approve with the nits noted.</strong> Blocking a correct change on preferences is how review becomes a bottleneck people route around."
              ] },
              { t: "h", text: "Standards a lead sets for the team" },
              { t: "table",
                headers: ["Standard", "A workable default", "What it prevents"],
                rows: [
                  ["First-response time", "Within one working day; same day for anything blocking a release", "Changes ageing in a queue until the author context-switches away"],
                  ["Change size", "Aim for a few hundred lines; split anything larger by behaviour", "Rubber-stamp approvals on diffs nobody can hold in their head"],
                  ["Who must review", "A second reviewer on money, auth, data deletion and migrations; one elsewhere", "Uniform ceremony that over-reviews trivia and under-reviews the risky paths"],
                  ["Author\u2019s description", "What changed, why, how it was tested, how to roll it back", "Reviewers reverse-engineering intent from the diff"],
                  ["Disagreement path", "Two rounds in comments, then a short call, then the code owner decides", "Week-long comment threads that end in whoever gives up first"]
                ]
              },
              { t: "p", html: "Check the standards against outcomes every quarter: review turnaround, change size, and how many escaped defects a reviewer could plausibly have caught. A review process that never catches anything and always slows delivery needs changing, not defending." },
              { t: "note", variant: "trap", html: "<strong>The reviewer who leaves fifty comments is often the least effective one on the team.</strong> Volume signals thoroughness and delivers noise; the author cannot find the two that mattered, and neither can the next reviewer." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Leaves accurate, polite comments."],
                  ["Senior", "Tiers comments so blocking is unmistakable, keeps the blocking set small, and teaches a reusable principle."],
                  ["Staff", "Sets the team\u2019s review standards \u2014 turnaround, change size, who must review what \u2014 and checks whether review is catching defects or only slowing delivery."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When you are asked how you would handle a disagreement in review, the expected shape is: separate correctness from preference, name the criteria, time-box the missing evidence, and record what was decided." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Rewrite \u201cthis is too complex, please simplify\u201d into a comment that names a defect and teaches a principle the author can reuse." },
              { t: "note", variant: "key", html: "<strong>A comment earns its place by naming a specific risk and the principle behind the fix.</strong> Tier them so blocking is unmistakable, keep the blocking set small, and hand formatting to a tool \u2014 that is what makes review a teaching mechanism instead of a toll gate." }
            ]
          },
          {
            id: "extensibility",
            title: "Extensibility without overengineering",
            summary: "Design for change you can name, not change you can imagine. Every abstraction is a bet, and most speculative ones lose.",
            minutes: 8,
            tags: ["leadership", "design"],
            blocks: [
              { t: "p", html: "Every abstraction is insurance: you pay a premium in indirection now against a change you expect later. The discipline is refusing to pay premiums on <strong>changes you cannot name</strong> \u2014 because an unused extension point is not free, it is a permanent tax on everyone reading the code, plus a shape that constrains the change that actually arrives." },
              { t: "table",
                headers: ["An abstraction earns its keep when\u2026", "Concrete example"],
                rows: [
                  ["A policy varies by tenant or product today", "Pricing or approval rules that already differ between two customers"],
                  ["A second integration is contractually committed", "A signed deal requiring a second notification channel next quarter"],
                  ["Configuration differs per environment or tenant", "Rate limits and retention windows driven by config, not code"],
                  ["The variation axis has already changed once", "You have edited the same conditional for the third time this quarter"]
                ]
              },
              { t: "h", text: "The two failure modes, and they are not symmetric" },
              { t: "ul", items: [
                "<strong>Too little structure</strong> shows up as a conditional chain that everyone can see, and it is cheap to fix when the pressure finally arrives.",
                "<strong>Too much structure</strong> shows up as five files to trace one behaviour, and it is expensive to fix because removing an abstraction feels like a regression to reviewers.",
                "<strong>So default to concrete.</strong> Duplicate twice, then abstract on the third occurrence \u2014 by which point you can see the real axis rather than guessing it.",
                "<strong>Keep the default obvious.</strong> A configurable system with no clear default pushes a decision onto every operator forever."
              ] },
              { t: "code", lang: "text", code:
                "Same requirement, three designs\n" +
                "\n" +
                "  ONE tenant, one rule\n" +
                "    a function. No interface. This is the correct answer\n" +
                "    and it is the one people are embarrassed to give.\n" +
                "\n" +
                "  TWO tenants, rules differ\n" +
                "    an interface with two implementations, chosen by config,\n" +
                "    with the common case as the documented default.\n" +
                "\n" +
                "  ONE tenant, \"we might add more later\"\n" +
                "    a function. Still. \"Might\" is not change pressure, and\n" +
                "    the interface you guess now will be the wrong shape."
              },
              { t: "note", variant: "trap", html: "<strong>An interface with one implementation and no named second is a guess wearing a design pattern.</strong> It costs indirection today and usually turns out to be the wrong seam when the real second case arrives." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the common patterns and when they apply."],
                  ["Senior", "Abstracts only on named change pressure and can argue the concrete version honestly."],
                  ["Staff", "Removes abstractions that never earned their keep, and makes that removal socially acceptable on the team."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The honest test is whether you can finish this sentence with something specific: <em>\u201cthis exists so that when ___ changes, only ___ has to move.\u201d</em> If either blank is vague, write the simple version." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Design an extension point for multiple payout rules, then argue the opposite case \u2014 why a single function might be the better answer this quarter." },
              { t: "note", variant: "key", html: "<strong>Abstract on named pressure, not on imagination.</strong> The asymmetry is what decides it: too little structure is visible and cheap to fix, too much is invisible and socially expensive to remove \u2014 so when in doubt, ship the concrete version." }
            ]
          },
          {
            id: "api-governance",
            title: "API governance across many teams",
            summary: "Contracts survive other teams when compatibility is checked by machines and human review is reserved for the APIs where mistakes reach customers.",
            minutes: 9,
            tags: ["leadership", "api", "governance"],
            blocks: [
              { t: "p", html: "<a class='inline' href='#/lld/modeling/api-contracts'>Contracts that survive other teams</a> covers designing one API well. Governance is the organisational version: <strong>forty teams publishing hundreds of endpoints, with consistent conventions and no surprise breakages</strong>, without creating a review board that every change has to queue for." },
              { t: "table",
                headers: ["Audience tier", "Examples", "Governance it needs"],
                rows: [
                  ["Team-internal", "Calls between a team\u2019s own services", "Linting only; the team can change both sides together"],
                  ["Internal shared", "A platform or domain API other teams consume", "Style guide, breaking-change detection in CI, a consumer list and a deprecation window"],
                  ["Partner", "Integrations with named external organisations", "All of the above, plus human design review and contractual notice periods"],
                  ["Public", "Anything a stranger can build against", "All of the above, plus versioning policy, a changelog and a long support window"]
                ]
              },
              { t: "h", text: "Mechanisms, cheapest first" },
              { t: "ul", items: [
                "<strong>A short style guide, enforced by a linter.</strong> Naming, pagination, error shape, idempotency headers. If a rule cannot be linted, question whether it needs to be a rule.",
                "<strong>Breaking-change detection on every change.</strong> Compare the new specification against the published one in CI and fail on removed fields, narrowed types or new required parameters.",
                "<strong>An ownership and consumer registry.</strong> Every API has an owning team and a list of known consumers, which is what makes a deprecation possible at all.",
                "<strong>A deprecation policy with dates.</strong> Notice period, brownout schedule and removal date per tier \u2014 so retiring an endpoint is a process, not a negotiation.",
                "<strong>Human review where the audience is external.</strong> Partner and public APIs are one-way doors; internal ones mostly are not."
              ] },
              { t: "code", lang: "text", code:
                "API change policy, internal shared tier\n" +
                "\n" +
                "ALLOWED     add optional field, add endpoint, add enum value\n" +
                "            (consumers must ignore unknown values)\n" +
                "BLOCKED     remove or rename field, narrow a type, add a\n" +
                "  IN CI     required parameter, change error semantics\n" +
                "BREAKING    new version alongside old; notify every\n" +
                "  CHANGE    registered consumer; 90-day window; brownouts\n" +
                "            at day 60 and 75; remove at 90\n" +
                "EXCEPTIONS  platform lead approves, in writing, with a\n" +
                "            named owner for the migration"
              },
              { t: "note", variant: "trap", html: "<strong>A central API board that approves every endpoint becomes the slowest part of every delivery.</strong> Teams respond by tunnelling new behaviour through existing endpoints or skipping review altogether, which produces exactly the inconsistency the board was created to prevent. Automate the mechanical checks; spend humans on the external tiers." },
              { t: "p", html: "For the design mechanics \u2014 versioning schemes, schema evolution, designing for real clients \u2014 Blueprint covers <a class='inline' href='../hld-lld-academy/index.html#/hld/architecture/api-schema-evolution'>API versioning and schema evolution</a> and <a class='inline' href='../hld-lld-academy/index.html#/hld/api/api-design-real-clients'>API design for real clients</a>. Running the removal itself is covered in <a class='inline' href='#/strategy/execution/deprecations'>deprecations people actually finish</a>." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Follows the API style guide and avoids breaking changes in their own endpoints."],
                  ["Senior", "Adds breaking-change detection and a consumer list for their team\u2019s shared APIs, and runs deprecations to a date."],
                  ["Staff", "Designs the tiered governance model for the organisation, automates the mechanical checks, and keeps human review where it prevents external harm."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cTeams keep breaking each other\u2019s integrations\u201d</em>, <em>\u201cevery team designs APIs differently\u201d</em> or <em>\u201cour API review is a bottleneck\u201d</em> is asking for tiering and automation, not for a stricter board." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> You inherit an organisation where a removed field broke three consumers last month. Describe the two mechanisms you would put in place first, and what you would deliberately not require human review for." },
              { t: "note", variant: "key", html: "<strong>Govern by audience and automate the mechanical rules.</strong> Breaking-change detection, a consumer registry and a dated deprecation policy prevent most breakages without a queue; human design review is worth its cost only where the consumer is outside your organisation." }
            ]
          },
          {
            id: "quality-gates",
            title: "Quality gates for delivery",
            summary: "Readiness gates keep code-level risk visible before launch \u2014 as long as they name checkable outcomes rather than subjective standards.",
            minutes: 8,
            tags: ["leadership", "readiness"],
            blocks: [
              { t: "p", html: "A gate exists so that risk is visible <strong>before</strong> the launch conversation, not discovered during it. That only works if a gate is checkable by someone who was not in the argument \u2014 which is why \u201ccode quality is good\u201d is not a gate and \u201cthe migration is reversible, and here is the rehearsal record\u201d is." },
              { t: "table",
                headers: ["Gate", "The signal", "How it gets gamed"],
                rows: [
                  ["Correctness", "Invariant tests green, edge cases enumerated", "Tests that execute lines and assert nothing"],
                  ["Operability", "Runbook written, dashboard live, alert on a user journey", "A runbook that says \u201cescalate to the team\u201d"],
                  ["Security", "Sensitive data paths reviewed, reviewer named", "A review nobody signed"],
                  ["Migration", "Reversible, and the rollback has been rehearsed with a duration", "\u201cWe can roll back\u201d, untested"],
                  ["Support", "Top three failure modes have a customer-facing answer", "Deferred to launch day"]
                ]
              },
              { t: "ul", items: [
                "<strong>Make every gate measurable.</strong> If two reasonable people can disagree about whether it is met, it is a preference wearing a checklist.",
                "<strong>Name the owner per gate.</strong> Unowned gates are met by acclamation on the day.",
                "<strong>Allow explicit waivers.</strong> A gate that can only pass will be quietly bypassed; a gate with a written waiver and a named acceptor stays honest.",
                "<strong>Keep the list short.</strong> Five real gates get checked; twenty become a ritual, and the ritual hides the one that mattered."
              ] },
              { t: "note", variant: "trap", html: "<strong>Blocking a launch on subjective perfection costs you the gate itself.</strong> After the first time, the team routes around it \u2014 and you have lost the mechanism that would have caught a genuine problem." },
              { t: "compare",
                bad: { title: "Unusable gates", items: ["\u201cCode quality is good\u201d", "\u201cNo known bugs\u201d", "\u201cCoverage above 80%\u201d", "\u201cThe team feels ready\u201d"] },
                good: { title: "Checkable gates", items: ["\u201cEvery invariant has a failing-first test\u201d", "\u201cRollback rehearsed; 6 minutes, recorded\u201d", "\u201cAlert fires on checkout success rate, verified in staging\u201d", "\u201cData-path review signed by a named reviewer\u201d"] }
              },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Follows the release checklist."],
                  ["Senior", "Writes gates a stranger could verify, with named owners and a written waiver path."],
                  ["Staff", "Keeps the list short by retiring gates that never catch anything, and uses escaped defects to decide which gate is missing."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Whenever you hear <em>\u201care we ready to launch\u201d</em>, the useful reply is a short list of checkable conditions with owners \u2014 plus which ones are being waived, and by whom." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Create five readiness gates for a new approval-workflow service, each phrased so a stranger could verify it." },
              { t: "note", variant: "key", html: "<strong>A gate is only real if a stranger can check it and someone can waive it in writing.</strong> Measurable conditions with named owners keep risk visible; subjective standards get bypassed after the first argument, taking the whole mechanism with them." },
              { t: "quiz", id: "lld-leadership" }
            ]
          }
        ]
      }
    ]
  };
})();
