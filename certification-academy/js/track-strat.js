/* track-strat.js — certification exam strategy (unofficial, original prep) */
(function () {
  "use strict";
  var TID = "strat";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    mount.appendChild(h("p", { class: "widget-desc" }, desc));
    var stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    return stage;
  }
  function seg(label, opts, active, onPick) {
    var wrap = h("div", { class: "su-ctl" }, h("span", { class: "su-ctl-label" }, label));
    var box = h("div", { class: "w-seg", role: "group", "aria-label": label });
    var btns = opts.map(function (o, i) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (i === active ? " active" : ""), "aria-pressed": i === active ? "true" : "false" }, o);
      b.addEventListener("click", function () {
        btns.forEach(function (x, j) { x.className = "w-seg-btn" + (j === i ? " active" : ""); x.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        onPick(i);
      });
      box.appendChild(b);
      return b;
    });
    wrap.appendChild(box);
    return wrap;
  }
  function ro(label) {
    var b = h("b", {}, "-");
    var el = h("div", { class: "ro" }, label + ": ", b);
    return { el: el, set: function (v) { b.textContent = String(v); } };
  }
  function hashStr(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  var bag = [];
  function slot(seedText) {
    if (!bag.length) {
      bag = [0, 1, 2, 3];
      var r = hashStr(TID + seedText);
      for (var i = 3; i > 0; i--) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; var j = (r >>> 8) % (i + 1); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    }
    return bag.pop();
  }
  function Q(q, right, wrong, explain) {
    var pos = slot(q);
    var options = wrong.slice(0, 3);
    options.splice(pos, 0, right);
    return { q: q, options: options, answer: pos, explain: explain };
  }
  var QZ = {};
  function L(id, title, summary, minutes, tags, blocks, questions) {
    var qid = TID + "-" + id;
    QZ[qid] = { title: "Checkpoint: " + title, sub: questions.length + " original practice questions with explanations", questions: questions };
    var b = blocks.slice(0, -1).concat([{ t: "quiz", id: qid }], blocks.slice(-1));
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: b };
  }
  var VERIFY = { t: "note", variant: "warn", html: "Exam lengths, question counts, passing scores, retake rules and delivery options differ by vendor and change over time. <strong>Verify the current official exam guide and candidate policies</strong> before you plan." };

  /* ---------- widgets ---------- */
  var Widgets = {};

  Widgets.suSpacing = function (mount) {
    var stage = shell(mount, "planner", "Spaced review scheduler", "Choose how many days remain and how well you know a topic. The schedule spreads reviews out, with gaps that grow as recall improves.");
    var st = { days: 1, conf: 0 };
    var DAYS = [14, 30, 60], CONF = ["shaky", "okay", "solid"];
    var GAPS = [[1, 2, 4, 7, 12, 20, 30, 45], [2, 5, 10, 18, 30, 45], [4, 10, 21, 40]];
    var list = h("ul", { class: "su-list" });
    var a = ro("Reviews before exam"), b = ro("Final review");
    function paint() {
      list.textContent = "";
      var gaps = GAPS[st.conf], d = 0, n = 0, last = 0;
      for (var i = 0; i < gaps.length; i++) {
        d = gaps[i];
        if (d >= DAYS[st.days]) break;
        n++; last = d;
        list.appendChild(h("li", {}, "Day " + d + ": recall from memory first, then check notes"));
      }
      a.set(n + " (topic is " + CONF[st.conf] + ")");
      b.set(n ? "day " + last + ", plus a light skim the day before the exam" : "only the day before; start earlier if you can");
    }
    stage.appendChild(seg("Days until exam", ["14", "30", "60"], 1, function (i) { st.days = i; paint(); }));
    stage.appendChild(seg("Current confidence", CONF, 0, function (i) { st.conf = i; paint(); }));
    stage.appendChild(list);
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el));
    paint();
  };

  Widgets.suEliminator = function (mount) {
    var stage = shell(mount, "technique", "Option elimination drill", "A sample scenario with four options. Strike out options one at a time and read why each is weaker. The last one standing is the best answer.");
    var stem = "A team needs nightly reports to finish faster. Data volume doubled last quarter. Cost should stay predictable, and the change must not need application rewrites.";
    var opts = [
      ["Rewrite the reporting job in a new language", "Violates the no-rewrite constraint stated in the stem."],
      ["Scale up the compute that runs the job during the nightly window only", "Survives: addresses speed, needs no rewrite, and limits cost to the window."],
      ["Run the job continuously all day to spread the load", "Wastes cost and does not respect predictability."],
      ["Delete older data so there is less to process", "Changes business data to solve a performance problem; not requested."]
    ];
    var st = { struck: [false, false, false, false] };
    var list = h("ol", { class: "su-list" });
    var a = ro("Remaining"), b = ro("Reasoning");
    function paint(lastIdx) {
      list.textContent = "";
      opts.forEach(function (o, i) {
        var li = h("li", { class: st.struck[i] ? "is-bad" : "" }, o[0]);
        list.appendChild(li);
      });
      var left = st.struck.filter(function (x) { return !x; }).length;
      a.set(left + " of 4");
      b.set(lastIdx == null ? "Strike the option that most clearly breaks a stated constraint." : opts[lastIdx][1]);
    }
    var btn = h("button", { type: "button", class: "w-btn primary" }, "Strike next weakest");
    var reset = h("button", { type: "button", class: "w-btn" }, "Reset");
    var ORDER = [0, 3, 2];
    btn.addEventListener("click", function () {
      for (var k = 0; k < ORDER.length; k++) {
        if (!st.struck[ORDER[k]]) { st.struck[ORDER[k]] = true; paint(ORDER[k]); return; }
      }
      paint(1);
    });
    reset.addEventListener("click", function () { st.struck = [false, false, false, false]; paint(null); });
    stage.appendChild(h("p", { class: "su-dim" }, stem));
    stage.appendChild(list);
    stage.appendChild(h("div", { class: "su-row" }, btn, reset));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el));
    paint(null);
  };

  Widgets.suPacing = function (mount) {
    var stage = shell(mount, "pacing", "Pacing calculator", "Pick a sample exam length and question count (illustrative only). See the time per question and checkpoints to hit, with a reserve for review.");
    var st = { mins: 1, qs: 1, reserve: 1 };
    var MINS = [90, 130, 180], QS = [50, 65, 90], RES = [0, 10, 15];
    var a = ro("Seconds per question"), b = ro("Checkpoints"), c = ro("Reserve");
    var bar = h("div", { class: "su-timeline", role: "img", "aria-label": "Exam timeline" });
    function paint() {
      var total = MINS[st.mins], usable = total - RES[st.reserve], q = QS[st.qs];
      var per = Math.floor((usable * 60) / q);
      a.set(per + " s (about " + (per / 60).toFixed(1) + " min)");
      var cps = [0.25, 0.5, 0.75].map(function (f) { return "Q" + Math.round(q * f) + " by " + Math.round(usable * f) + " min"; });
      b.set(cps.join(" · "));
      c.set(RES[st.reserve] + " min for flagged review");
      bar.textContent = "";
      var work = h("div", { class: "su-tl-seg tt" }, "answering");
      work.style.flex = String(usable);
      bar.appendChild(work);
      if (RES[st.reserve]) {
        var rv = h("div", { class: "su-tl-seg fs" }, "review");
        rv.style.flex = String(RES[st.reserve]);
        bar.appendChild(rv);
      }
    }
    stage.appendChild(seg("Exam minutes (example)", ["90", "130", "180"], 1, function (i) { st.mins = i; paint(); }));
    stage.appendChild(seg("Questions (example)", ["50", "65", "90"], 1, function (i) { st.qs = i; paint(); }));
    stage.appendChild(seg("Review reserve (min)", ["0", "10", "15"], 1, function (i) { st.reserve = i; paint(); }));
    stage.appendChild(bar);
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- lessons ---------- */
  var plan = [
    L("objectives-first", "Start from the official objectives", "Turn the exam guide into a checklist before touching any course.", 7, ["planning"], [
      VERIFY,
      { t: "p", html: "Every vendor publishes an exam guide listing domains and objectives. That document, not a course or a forum post, defines what can be tested. Copy each objective into a tracker and rate yourself honestly." },
      { t: "ol", items: ["Download the current guide and note its version or date.", "List every objective as a row.", "Rate each 0 to 3: never heard of it, recognize it, can explain it, can apply it in a scenario.", "Sort by domain size and your rating; low rating in a large domain goes first.", "Re-rate weekly. The ratings, not hours studied, measure progress."] },
      { t: "note", variant: "tip", html: "Summit's Readiness dashboard and per-domain simulator scores give you a second, evidence-based rating to compare with your self-rating." },
      { t: "note", variant: "trap", html: "Domain weights are approximate and change between versions. Use them to prioritize, not to skip a domain." },
      { t: "note", variant: "key", html: "The current official objectives are the syllabus. Track each one, rate it, and study the large, weak domains first." }
    ], [
      Q("What should define the scope of your study plan?", "The current official exam objectives", ["The longest available course", "Questions memorized from strangers online", "Last year's forum discussions"], "Official objectives define what can be tested. Courses help, but should be mapped back to the guide."),
      Q("You rate an objective as 'can recognize it but cannot explain it'. What is the best next action?", "Study it until you can explain it, then practise applying it in scenarios", ["Mark it done", "Skip it because it seems small", "Memorize one answer about it"], "Recognition is not enough; scenario questions require explanation and application."),
      Q("Why note the version or date of the exam guide you use?", "Objectives change, and you need to know your material matches the version you will sit", ["Vendors require it at check-in", "It changes your passing score", "It unlocks extra time"], "Exams are revised periodically. Studying an outdated version wastes time on removed topics and misses new ones."),
      Q("Two domains are both weak. One is listed with a larger share of the exam. Which should usually come first?", "The larger domain", ["The smaller domain", "Neither until the week of the exam", "Whichever has more videos"], "Prioritizing large, weak areas gives the biggest score improvement per hour."),
      Q("What is the best evidence that you are improving?", "Rising self-ratings confirmed by better practice scores per domain", ["Total hours of videos watched", "Number of notes written", "How many tabs you have open"], "Outcome measures such as accuracy per domain matter more than input measures."),
      Q("A domain is shown with a small approximate weight. How should you treat it?", "Study it proportionally; it can still decide a pass", ["Skip it entirely", "Study it the most", "Ignore weights completely"], "Weights guide emphasis but every domain contributes points.")
    ]),

    L("study-plan", "Build a realistic study plan", "Weeks, sessions, review cycles and buffers that survive real life.", 8, ["planning", "habits"], [
      { t: "p", html: "A plan you can keep beats an ambitious one you abandon. Work backward from a target date, allocate weeks to domains, and reserve time for review and practice exams." },
      { t: "widget", id: "suSpacing" },
      { t: "table", headers: ["Phase", "Share of plan (rough)", "Focus"], rows: [
        ["Learn", "About half", "Cover each objective once, with notes and labs"],
        ["Practise", "About a third", "Domain quizzes, explain wrong answers"],
        ["Rehearse", "The rest", "Full timed simulations, weak-area patching"]
      ] },
      { t: "ul", items: ["Short daily sessions plus one longer weekly block are easier to sustain than occasional marathons.", "Build in a buffer week for illness or work spikes.", "Retrieval practice (answering from memory) builds recall better than re-reading.", "Interleave topics in practice so you learn to identify which concept a question is about."] },
      { t: "note", variant: "tip", html: "Summit's Plans page generates a week-by-week plan per certification from your exam date and lets you tick sessions off." },
      { t: "note", variant: "key", html: "Work backward from a date, learn then practise then rehearse, use spaced retrieval, and keep a buffer." }
    ], [
      Q("Which study technique most improves long-term recall?", "Retrieval practice spaced over increasing intervals", ["Re-reading the same chapter many times in one evening", "Highlighting every line", "Watching videos at double speed only"], "Recalling from memory, spaced out, strengthens retention far more than passive review."),
      Q("Why include a buffer week in a study plan?", "Unexpected events happen, and a buffer protects the exam date", ["Vendors require it", "It replaces practice exams", "It removes the need for review"], "Plans without slack tend to collapse after the first disruption."),
      Q("What is interleaving?", "Mixing topics in practice so you must identify which concept applies", ["Studying one topic for an entire month", "Taking the exam twice", "Reading only summaries"], "Interleaving mirrors the exam, where questions from different domains appear in random order."),
      Q("When should full timed simulations be emphasized?", "In the final phase, after objectives have been covered", ["Only on day one", "Never; they waste time", "Only after passing"], "Simulations measure readiness and train pacing once you have the knowledge base."),
      Q("A learner studies eight hours every second Saturday and nothing in between. What is a better pattern?", "Shorter, frequent sessions plus one longer weekly block", ["One sixteen-hour session per month", "Only studying the night before", "Stopping review once a topic feels familiar"], "Frequent, spaced sessions sustain progress and improve retention."),
      Q("After a practice quiz, what should you do with wrong answers?", "Explain why the right option is right and why your choice was wrong", ["Memorize the letter of the right option", "Ignore them", "Retake immediately until you score 100 percent"], "Understanding the reasoning transfers to new questions; memorizing positions does not.")
    ]),

    L("labs-hands-on", "Hands-on labs that stick", "Practise safely in sandboxes and turn tasks into muscle memory.", 8, ["labs"], [
      { t: "p", html: "Scenario and performance-based items reward people who have actually done the work. Use free tiers, local clusters and trial accounts, and always clean up resources." },
      { t: "table", headers: ["Track", "Practical lab idea"], rows: [
        ["Cloud architect", "Build a two-tier app across zones, then break one zone and observe"],
        ["Data platform", "Load semi-structured files, query them, clone a table, use time travel"],
        ["Kubernetes admin", "Install a small cluster, back up etcd, drain a node, fix a broken pod"],
        ["Security", "Harden a VM baseline, review logs, write an incident timeline"]
      ] },
      { t: "ul", items: ["Set budget alerts and use the smallest sizes; delete everything after each session.", "Never use production accounts or real customer data for practice.", "Keep a lab journal: task, commands, what broke, how you fixed it.", "Repeat key tasks against a timer until they are routine."] },
      { t: "note", variant: "warn", html: "Use personal or sanctioned sandbox environments only. Do not test against systems you do not own or have written permission to use." },
      { t: "note", variant: "key", html: "Do the tasks for real in a safe, budgeted sandbox, write down what broke, and repeat under time until it is routine." }
    ], [
      Q("What is the safest way to practise cloud tasks on a personal account?", "Use small resources, set budget alerts and delete everything after each session", ["Use the company production account", "Leave resources running for convenience", "Share root credentials with study partners"], "Budget controls and cleanup prevent surprise bills and security exposure."),
      Q("Why keep a lab journal?", "Writing down what broke and how you fixed it reinforces troubleshooting patterns", ["Vendors collect it at the exam", "It replaces hands-on practice", "It is required to start a lab"], "Recording failures and fixes builds the diagnostic memory that scenario questions test."),
      Q("Which practice is appropriate for a security study lab?", "Testing only systems you own or have written permission to test", ["Scanning random internet hosts", "Using a coworker's account", "Copying real customer data into the lab"], "Authorization and synthetic data keep practice legal and ethical."),
      Q("For a hands-on administrator exam, how should you practise frequent tasks?", "Repeat them against a timer until they are routine", ["Read about them once", "Only watch someone else do them", "Memorize screenshots"], "Timed repetition builds the speed and accuracy needed in performance-based exams."),
      Q("A lab objective is resilience. What is a useful experiment?", "Deliberately remove one component and observe how the system responds", ["Never change anything once it works", "Disable all logging", "Only take screenshots"], "Breaking things on purpose shows whether redundancy works and teaches recovery steps."),
      Q("Which data should a practice environment contain?", "Synthetic or public sample data", ["Real customer records", "Production password files", "Colleagues' private messages"], "Practice environments should never hold sensitive real data.")
    ]),

    L("ethics-integrity", "Integrity: why dumps hurt you", "Protect your credential and your skills by preparing honestly.", 6, ["ethics"], [
      { t: "p", html: "Certification programs ask candidates to agree to confidentiality and conduct rules. Using leaked or memorized live exam content breaks those rules and can lead to revoked certifications and bans." },
      { t: "ul", items: ["Prepare with original practice material and official resources.", "Do not share or seek actual exam questions after sitting an exam.", "If a resource claims to contain real exam questions, avoid it and consider reporting it to the program.", "Memorized answers fail on rephrased items and fail you on the job."] },
      { t: "table", headers: ["Honest preparation", "Why it wins"], rows: [
        ["Understand concepts", "Works on any wording of a question"],
        ["Hands-on practice", "Prepares you for performance items and real work"],
        ["Original practice questions", "Train reasoning without breaking agreements"]
      ] },
      { t: "note", variant: "tip", html: "All Summit questions are original and unofficial. They train reasoning on the same concepts, not recall of any real exam item." },
      { t: "note", variant: "key", html: "Prepare with original material, never use or share leaked content, and build skills that survive new wording and real jobs." }
    ], [
      Q("A website offers 'real exam questions from last week'. What should a candidate do?", "Avoid it; using leaked content can violate the candidate agreement", ["Buy it to save time", "Share it with friends", "Use it only for the final week"], "Leaked content breaks confidentiality agreements and can lead to revoked credentials."),
      Q("After passing, a colleague asks which exact questions you saw. What is the appropriate response?", "Decline and suggest studying the objectives and hands-on practice", ["Write down as many as you remember", "Share only the hard ones", "Post them publicly"], "Candidate agreements typically prohibit disclosing exam content."),
      Q("Why are memorized answers risky even apart from rules?", "Rephrased or new questions break memorization, and job tasks need understanding", ["Exams never change", "Memorization guarantees a pass", "Understanding is not tested"], "Concept understanding transfers to new wording and real scenarios."),
      Q("Which resource is appropriate for preparation?", "Original practice questions mapped to published objectives", ["A collection of leaked live items", "Screenshots taken during an exam", "Questions recorded by a proxy test-taker"], "Original material builds skill without breaching exam security."),
      Q("What can happen to a candidate found using leaked exam content?", "Revocation of the certification and possible bans", ["An automatic score bonus", "Free retakes", "Nothing at all"], "Programs enforce conduct agreements with sanctions."),
      Q("What is the long-term benefit of honest preparation?", "Skills and credibility that hold up in real work", ["A shorter exam", "Guaranteed promotion", "No need to recertify"], "Employers value people who can do the work the credential represents.")
    ])
  ];

  var technique = [
    L("read-the-stem", "Read the stem like a requirements doc", "Find the ask, the constraints and the qualifier words.", 8, ["technique"], [
      { t: "p", html: "A scenario stem hides three things: the <strong>ask</strong> (what you must choose), the <strong>constraints</strong> (cost, time, effort, compliance), and the <strong>qualifier</strong> (most, least, first, best)." },
      { t: "ol", items: ["Read the final sentence first to learn the ask.", "Read the full stem, noting every constraint.", "Circle the qualifier: MOST cost-effective, LEAST operational effort, FIRST step.", "Predict an answer before reading options.", "Compare options against constraints, not against what you would like to build."] },
      { t: "table", headers: ["Qualifier", "Usually favours"], rows: [
        ["Least operational overhead", "Managed or serverless services, automation"],
        ["Most cost-effective", "Right-sized, on-demand or tiered options that still meet requirements"],
        ["First step", "Identify, assess or contain before fixing or rebuilding"],
        ["Most secure", "Least privilege, encryption, no long-lived secrets"]
      ] },
      { t: "note", variant: "trap", html: "A technically excellent option that ignores a stated constraint is wrong. The stem decides; your preference does not." },
      { t: "note", variant: "key", html: "Find the ask, list constraints, mark the qualifier, predict, then choose the option that satisfies all constraints." }
    ], [
      Q("What should you identify first in a long scenario question?", "What the question is actually asking you to choose", ["The longest answer option", "The vendor's brand colors", "How many words the stem has"], "Knowing the ask focuses how you read the rest of the stem."),
      Q("A question asks for the solution with the LEAST operational overhead. Which kind of option is usually favoured?", "A managed service that meets the requirements", ["A self-managed cluster you patch yourself", "A custom script run manually each day", "Buying new physical servers"], "Least overhead points toward managed or automated options, provided they meet every requirement."),
      Q("A question asks for the FIRST thing to do when an incident is suspected. Which type of answer is usually right?", "Identify or contain before rebuilding", ["Rebuild every server", "Buy new hardware", "Announce the incident publicly before analysis"], "First-step questions reward assessing and containing before larger actions."),
      Q("An option is the fastest design but exceeds a stated budget constraint. How should you treat it?", "Eliminate it because it violates a constraint", ["Choose it because speed matters most", "Choose it if it uses newer technology", "Ignore the constraint"], "Constraints in the stem are requirements; violating one disqualifies the option."),
      Q("Why predict an answer before reading the options?", "It reduces the pull of plausible-sounding distractors", ["It is required by exam rules", "It makes the exam shorter", "Options are always in alphabetical order"], "Forming your own answer first makes it easier to see which option actually matches."),
      Q("Which word in a stem most changes which answer is correct?", "A qualifier such as most, least or first", ["The company's name", "The day of the week", "The font of the question"], "Qualifiers define the criterion used to rank otherwise valid options.")
    ]),

    L("elimination", "Elimination and distractor patterns", "Remove wrong options systematically to raise your odds.", 8, ["technique"], [
      { t: "p", html: "You often cannot spot the best answer immediately, but you can usually spot two that are wrong. Each removal improves your odds and clarifies the comparison." },
      { t: "widget", id: "suEliminator" },
      { t: "table", headers: ["Distractor pattern", "Tell"], rows: [
        ["Violates a constraint", "Requires a rewrite, costs more, adds manual work"],
        ["Solves a different problem", "True statement, but not what was asked"],
        ["Too extreme", "Deletes data, disables security, rebuilds everything"],
        ["Partially correct", "Right idea, missing a key requirement such as encryption or HA"],
        ["Absolute language", "Always, never, guarantees (rarely true in practice)"]
      ] },
      { t: "note", variant: "tip", html: "When two options remain, ask which one satisfies <em>every</em> requirement with the least added complexity." },
      { t: "note", variant: "key", html: "Strike options that break constraints, answer a different question or go to extremes; then compare survivors on every requirement." }
    ], [
      Q("Two options remain. Both work, but one adds a component the stem never required. Which is usually better?", "The simpler option that meets every requirement", ["The more complex option", "Neither; skip the question permanently", "Whichever is listed first"], "Unrequired complexity adds cost and risk. The best answer meets all requirements simply."),
      Q("An option says a setting 'guarantees zero risk'. What should this suggest?", "It is likely a distractor because absolute claims are rarely true", ["It is definitely correct", "It must be a trick about wording only", "All options with 'zero' are correct"], "Security and reliability rarely offer absolute guarantees."),
      Q("An option is a true statement about the technology but does not address the stem's problem. What is it?", "A distractor that solves a different problem", ["The correct answer", "A required second answer", "A sign the stem is broken"], "True-but-irrelevant options are common distractors."),
      Q("If you can eliminate two of four options, what happens to a guess?", "Your chance improves from about one in four to about one in two", ["It stays one in four", "It drops to zero", "It becomes certain"], "Elimination concentrates probability on the remaining options."),
      Q("Which option is most likely a distractor for a performance problem?", "Deleting historical business data to speed up queries", ["Right-sizing compute for the workload", "Adding an appropriate cache", "Tuning the slow query"], "Extreme actions that harm the business are rarely the intended solution."),
      Q("An option meets performance needs but omits encryption that the stem requires. How do you classify it?", "Partially correct, and therefore wrong", ["Fully correct", "Correct if cheaper", "Correct because encryption is optional"], "Missing any stated requirement disqualifies an option.")
    ]),

    L("scenario-patterns", "Recurring scenario patterns", "Recognize common question shapes across cloud, data, Kubernetes and security.", 9, ["technique", "patterns"], [
      { t: "p", html: "Across certifications, the same shapes recur. Recognizing the shape tells you which concept is being tested." },
      { t: "table", headers: ["Shape", "What it tests", "Example thinking"], rows: [
        ["Decouple a spike", "Queues and asynchronous processing", "Buffer requests so producers and consumers scale separately"],
        ["Survive a failure", "Redundancy and failover", "Spread across zones; remove single points of failure"],
        ["Cut cost without losing function", "Right-sizing, tiering, scheduling", "Pay for what is used; move cold data down a tier"],
        ["Least privilege", "Scoped roles and short-lived credentials", "Grant the minimum to the identity that needs it"],
        ["Broken thing, find cause", "Systematic troubleshooting", "Check status, events and logs in order"],
        ["Protect data", "Encryption, classification, access", "Match the control to data state and sensitivity"]
      ] },
      { t: "ul", items: ["Name the shape in two or three words before choosing.", "Most shapes have one canonical answer pattern; distractors are near-misses of it.", "Hybrid shapes combine two patterns; satisfy both."] },
      { t: "note", variant: "tip", html: "Keep a personal list of shapes you miss in practice. Patterns you name are patterns you recognize under time pressure." },
      { t: "note", variant: "key", html: "Name the scenario shape, recall its canonical pattern, and check options against it." }
    ], [
      Q("A stem says web traffic spikes overwhelm a backend that processes orders slowly. Which pattern is most likely tested?", "Decoupling with a queue", ["Disabling logging", "Manual capacity requests", "Deleting old orders"], "A queue absorbs spikes and lets the backend process at its own rate."),
      Q("A stem describes a single database server whose failure stops the application. Which pattern applies?", "Remove the single point of failure with redundancy and failover", ["Add more application code", "Increase the logo size", "Reduce backups"], "Survive-a-failure questions are about redundancy across fault domains."),
      Q("A stem mentions rarely accessed data stored on expensive fast storage. Which pattern is tested?", "Tiering data to cheaper storage classes", ["Scaling compute up", "Opening more firewall ports", "Adding more administrators"], "Cost questions often reward moving cold data to cheaper tiers."),
      Q("An application uses a long-lived admin key embedded in code. Which pattern is being tested?", "Least privilege with short-lived, scoped credentials", ["High availability", "Caching", "Data masking for display"], "Replacing embedded broad secrets with scoped roles and temporary credentials is the canonical fix."),
      Q("A pod keeps restarting and the stem shows its events. Which shape is this?", "Broken thing, find the cause systematically", ["Cost optimization", "Data classification", "Exam registration"], "Troubleshooting shapes reward reading status, events and logs in order."),
      Q("Why name a scenario shape before choosing?", "It recalls the canonical solution and makes near-miss distractors easier to spot", ["It increases time per question", "Shapes are graded separately", "It changes the scoring"], "Pattern recognition speeds reasoning and highlights what the right answer must contain.")
    ]),

    L("confidence-flagging", "Confidence, flagging and changing answers", "Use flags and confidence ratings deliberately, not anxiously.", 7, ["technique", "review"], [
      { t: "p", html: "Mark each answer as <strong>sure</strong>, <strong>unsure</strong> or <strong>guess</strong>. Flag unsure and guess items, move on, and come back with fresh eyes if time allows." },
      { t: "ul", items: ["Always choose an answer before flagging, in case you run out of time (if unanswered items score as wrong, which is common; check the rules).", "Change an answer on review only with a concrete reason: you misread a constraint, or a later question jogged a fact.", "Do not change answers just because of a vague feeling.", "Track calibration in practice: are your 'sure' answers right most of the time?"] },
      { t: "table", headers: ["Calibration pattern", "Meaning", "Action"], rows: [
        ["Sure but often wrong", "Overconfidence", "Slow down; reread constraints"],
        ["Guess but often right", "Underconfidence", "Trust your first reasoning more"],
        ["Sure and usually right", "Well calibrated", "Spend review time on unsure items"]
      ] },
      { t: "note", variant: "tip", html: "The Summit simulator records confidence on every answer and shows calibration per level on the results screen." },
      { t: "note", variant: "key", html: "Answer, rate confidence, flag what is uncertain, change answers only with a concrete reason, and check calibration in practice." }
    ], [
      Q("You are unsure on a question. What should you do before flagging it?", "Select your best answer so it is not left blank", ["Leave it blank", "Close the exam", "Pick the first option without reading"], "If time runs out, an answered item may still earn points; a blank usually does not."),
      Q("When is changing an answer on review most justified?", "When you find a specific misread constraint or recall a concrete fact", ["Whenever you feel slightly uneasy", "Always change at least three answers", "Never, under any circumstances"], "Concrete reasons justify a change; vague doubt does not."),
      Q("Practice results show your 'sure' answers are often wrong. What does this indicate?", "Overconfidence; slow down and reread constraints", ["Perfect calibration", "Underconfidence", "The questions are broken"], "Calibration data shows when confidence does not match accuracy."),
      Q("Your 'guess' answers are right far more often than chance. What might that suggest?", "Underconfidence; your reasoning is better than you think", ["You should guess every question", "Overconfidence", "You should skip reviewing entirely"], "Being right on guesses suggests knowledge you are not trusting."),
      Q("Which items deserve review time first?", "Flagged items marked unsure, where reasoning can change the outcome", ["Items you were sure about", "Only the first question", "Items with the shortest stems"], "Review effort pays off most on uncertain items."),
      Q("Why rate confidence during practice at all?", "It reveals calibration so you can fix over- or underconfidence", ["It changes the official score", "It is required by every vendor", "It shortens the exam"], "Confidence data lets you see whether your certainty matches your accuracy.")
    ])
  ];

  var day = [
    L("pacing", "Pacing and time management", "Checkpoints, reserves and what to do with a slow question.", 7, ["exam-day", "pacing"], [
      VERIFY,
      { t: "p", html: "Divide usable time by the number of questions to get a target per question. Set checkpoints (a quarter, half, three quarters) and keep a small reserve for flagged items." },
      { t: "widget", id: "suPacing" },
      { t: "ul", items: ["If a question is taking about twice your target, answer your best guess, flag it, and move on.", "Long scenario items take longer; short recall items buy that time back.", "Check your pace at each checkpoint and adjust early, not in the last ten minutes.", "Performance-based or lab tasks may need their own time budget; check how they are presented."] },
      { t: "note", variant: "tip", html: "Use the Summit simulator's timed mode with a time limit that roughly matches your target exam to rehearse checkpoints." },
      { t: "note", variant: "key", html: "Know your seconds per question, set checkpoints, guess and flag slow items, and keep a review reserve." }
    ], [
      Q("You have 100 usable minutes and 50 questions. What is the target per question?", "About 2 minutes", ["About 5 minutes", "About 30 seconds", "About 10 minutes"], "100 minutes divided by 50 questions is 2 minutes each."),
      Q("A question has taken twice your target time and you are still unsure. What should you do?", "Choose your best answer, flag it and move on", ["Keep working until certain", "Leave it blank and never return", "Restart the exam"], "Protecting time for remaining questions matters more than one hard item."),
      Q("Why set checkpoints at a quarter, half and three quarters?", "To detect pace problems early enough to adjust", ["To satisfy the proctor", "To earn bonus points", "To reduce the number of questions"], "Early correction is easier than a rush at the end."),
      Q("What is a review reserve?", "A few minutes kept at the end for flagged questions", ["Extra questions added by the vendor", "A break you take before starting", "A second attempt at the exam"], "A reserve gives time to revisit uncertain items."),
      Q("Short recall questions take less than the average time. How does that help?", "They bank time for longer scenario items", ["They do not count", "They must be skipped", "They reduce the passing score"], "Average pacing balances quick and long items."),
      Q("Where should you confirm how lab or performance tasks are timed?", "The official exam guide or candidate information", ["Rumors from forums", "The practice app's color theme", "Assume they are untimed"], "Delivery details vary by vendor and change; verify them officially.")
    ]),

    L("online-vs-center", "Online proctoring versus a test center", "Prepare the environment so logistics never cost you points.", 7, ["exam-day", "logistics"], [
      { t: "p", html: "Both delivery options have strict rules. Read the current candidate policies for your program; the details below are general preparation habits, not policy." },
      { t: "table", headers: ["Item", "Online proctored", "Test center"], rows: [
        ["Environment", "Clear desk, quiet private room, stable internet", "Provided; arrive early"],
        ["Identification", "Valid ID shown on camera", "Valid ID checked at the desk"],
        ["Technology check", "Run the system test days ahead and again on the day", "Not needed"],
        ["Interruptions", "Can end the session; plan for none", "Controlled by the center"],
        ["Breaks", "Often restricted; verify the rules", "Depends on program rules"]
      ] },
      { t: "ul", items: ["Confirm the appointment time zone.", "Prepare ID that exactly matches your registration name.", "Sleep, eat and hydrate as you would before any important event.", "Know the rescheduling deadline in case you are not ready."] },
      { t: "note", variant: "trap", html: "Reading aloud, looking off screen or having notes nearby can be flagged in online sessions. Treat the rules literally." },
      { t: "note", variant: "key", html: "Read current candidate rules, test your setup in advance, match your ID to your registration, and remove logistics risk." }
    ], [
      Q("When should you run the online proctoring system check?", "Days before the exam and again on the day", ["Only after the exam starts", "Never; it is optional", "Only if the exam fails to launch"], "Early checks leave time to fix hardware, network or software problems."),
      Q("Your ID shows a different name format from your registration. What should you do?", "Fix the mismatch with the program before exam day", ["Hope the proctor ignores it", "Bring a friend to vouch for you", "Use someone else's ID"], "Name mismatches can prevent admission; resolve them early."),
      Q("Which behaviour can raise a flag during an online proctored exam?", "Repeatedly looking away from the screen", ["Sitting still at a clear desk", "Having only permitted items present", "Following the proctor's instructions"], "Online rules are strict about attention and environment."),
      Q("Where can you find accurate rules for breaks and permitted items?", "The program's current candidate policies", ["A random blog post", "The practice app's flashcards", "Assumptions based on another vendor"], "Policies vary by program and change; use the official source."),
      Q("You realize two days before the exam you are not ready. What should you check?", "The rescheduling deadline and policy", ["Whether you can take it with notes", "If someone else can sit for you", "Nothing; just go"], "Knowing the deadline may let you move the date without losing the fee."),
      Q("What is a good reason to choose a test center?", "You cannot guarantee a quiet, private room with stable internet at home", ["Test centers allow open books", "Test centers have no rules", "Online exams are always longer"], "If your environment is unreliable, a center removes that risk.")
    ]),

    L("performance-based", "Performance-based and lab tasks", "Approach hands-on items methodically and avoid time sinks.", 8, ["exam-day", "labs"], [
      { t: "p", html: "Some exams include simulations, drag-and-drop ordering or full command-line tasks. They test doing, not recognizing, and they can consume time quickly." },
      { t: "ol", items: ["Read the whole task and note every required outcome.", "Check the context: which environment, cluster, account or namespace.", "Do the easiest, highest-value parts first.", "Verify each outcome (get, describe, test) before moving on.", "If stuck, make partial progress where allowed and move on; return later."] },
      { t: "ul", items: ["Use built-in help and documentation where the rules allow it; practise finding things fast.", "Imperative commands with a dry run can generate correct templates quickly.", "Simulation items may allow partial credit; check how your program scores them.", "Some exams present simulations first; plan your time knowing this can happen."] },
      { t: "note", variant: "trap", html: "Working in the wrong context (cluster, account, namespace) is the classic way to do everything right and score nothing. Confirm context at the start of every task." },
      { t: "note", variant: "key", html: "Read every required outcome, confirm context, do high-value parts first, verify, and do not let one task consume your time." }
    ], [
      Q("What should you do at the start of every hands-on task in a multi-environment exam?", "Confirm you are working in the required environment or context", ["Start typing immediately", "Reboot the lab", "Skip reading the task"], "Correct work in the wrong context often earns no credit."),
      Q("A hands-on task has three outcomes; one is quick and two are hard. What is a sensible order?", "Complete the quick, valuable outcome first, then the harder ones", ["Always do the hardest first", "Do none until you understand everything", "Only do one outcome"], "Banking easy points first protects your score if time runs short."),
      Q("How should you confirm a configuration task is complete?", "Verify the result with a read or test command", ["Assume it worked", "Close the task immediately", "Check only the command history"], "Verification catches typos and missed fields."),
      Q("You are stuck on a lab task for a long time. What is usually best?", "Make allowed partial progress, flag it and move on", ["Keep going until time runs out", "Restart the whole exam", "Give up on the remaining questions"], "Time is shared across all items; protect the rest of the exam."),
      Q("Why practise using allowed documentation quickly?", "Finding syntax fast saves minutes on hands-on tasks", ["Documentation answers every question exactly", "It is never allowed", "It replaces understanding"], "Knowing where things are in permitted docs turns lookups into seconds."),
      Q("Where should you check whether simulation items earn partial credit?", "The program's official exam information", ["Assume they never do", "Assume they always do", "Ask other candidates for exam content"], "Scoring details vary; verify them from official sources without seeking exam content.")
    ]),

    L("after-exam", "After the exam: results, retakes and recertification", "Turn any result into a next step.", 6, ["exam-day", "career"], [
      { t: "p", html: "Whatever the outcome, capture what you learned while it is fresh, without recording any exam content." },
      { t: "table", headers: ["Outcome", "Next step"], rows: [
        ["Pass", "Save the record, note the renewal date, plan continuing education or the next certification"],
        ["Fail", "Read the domain-level feedback, rebuild the plan around the weak domains, check retake policy"],
        ["Close fail", "Usually one or two domains; target them and rehearse timing"]
      ] },
      { t: "ul", items: ["Write down which domains felt weak and which skills felt slow, not specific questions.", "Retake waiting periods and limits vary; verify them officially.", "Many certifications expire; renewal may use continuing education, a newer exam or a shorter assessment.", "Apply the skills at work quickly so they stay fresh."] },
      { t: "note", variant: "tip", html: "Re-run Summit's Readiness dashboard and use 'Practise weak areas' in the simulator to rebuild focus after a result." },
      { t: "note", variant: "key", html: "Record domain-level impressions (never exam content), plan renewal or retake from official rules, and keep using the skills." }
    ], [
      Q("After a failed attempt, which notes are appropriate to write down?", "Which domains and skills felt weak, without recording questions", ["Every question you remember word for word", "Screenshots of the exam", "Answers to share online"], "Domain-level reflections guide study without breaching confidentiality."),
      Q("What should guide a retake plan?", "Domain-level feedback from the score report and practice data", ["Only gut feeling", "The same plan unchanged", "Leaked question banks"], "Feedback shows which domains to rebuild."),
      Q("Where should you confirm retake waiting periods?", "The program's official retake policy", ["A friend's memory of an old policy", "The practice app", "Assume there are none"], "Policies vary and change; check official sources."),
      Q("After passing, what should you note for later?", "The expiration or renewal date and renewal options", ["Nothing; certifications never expire", "The exam questions", "The proctor's name"], "Many certifications require renewal; planning avoids lapses."),
      Q("What helps skills stay fresh after the exam?", "Applying them in real or lab work soon after", ["Never using them again", "Deleting your notes", "Only rereading the certificate"], "Regular use keeps knowledge active; skills that are never applied fade within months."),
      Q("A close fail usually indicates what?", "One or two domains need targeted work, plus timing practice", ["Everything must be relearned from scratch", "The exam was unfair", "Practice exams are useless"], "Near misses are often fixed by focused effort on weak areas.")
    ])
  ];

  window.QUIZZES = Object.assign(window.QUIZZES || {}, QZ);

  window.SUMMIT_CARDS = (window.SUMMIT_CARDS || []).concat([
    { front: "Source of exam scope", back: "The current official exam objectives or guide.", track: TID },
    { front: "Objective self-rating", back: "0 unknown, 1 recognize, 2 explain, 3 apply in a scenario.", track: TID },
    { front: "Retrieval practice", back: "Answer from memory before checking notes; space it out.", track: TID },
    { front: "Interleaving", back: "Mix topics in practice so you learn which concept applies.", track: TID },
    { front: "Lab safety", back: "Own or sanctioned sandboxes, budget alerts, synthetic data, clean up.", track: TID },
    { front: "Integrity", back: "Never use or share leaked exam content; prepare with original material.", track: TID },
    { front: "Stem reading order", back: "Ask, constraints, qualifier, predict, then compare options.", track: TID },
    { front: "Least operational overhead", back: "Usually favours managed or automated options that still meet requirements.", track: TID },
    { front: "Distractor tells", back: "Breaks a constraint, solves another problem, too extreme, partial, absolute.", track: TID },
    { front: "Changing answers", back: "Only with a concrete reason, not a vague feeling.", track: TID },
    { front: "Calibration", back: "Compare confidence with accuracy: sure-but-wrong means slow down.", track: TID },
    { front: "Pacing", back: "Usable minutes divided by questions; checkpoints at 25, 50, 75 percent.", track: TID },
    { front: "Slow question rule", back: "About twice the target time: best guess, flag, move on.", track: TID },
    { front: "Hands-on first step", back: "Confirm the context (account, cluster, namespace) before any change.", track: TID },
    { front: "After a result", back: "Note weak domains (not questions), check renewal or retake rules officially.", track: TID }
  ]);

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.strat = {
    id: "strat",
    name: "Exam strategy",
    short: "STRAT",
    tagline: "Plan, reason, pace and finish well",
    color: "#f472b6",
    blurb: "Vendor-neutral strategy for any certification: start from official objectives, build a realistic plan, practise hands-on, prepare with integrity, read stems, eliminate distractors, calibrate confidence, pace yourself and handle exam-day logistics.",
    modules: [
      { id: "plan", name: "Plan your preparation", icon: "compass", lessons: plan },
      { id: "technique", name: "Question technique", icon: "diamond", lessons: technique },
      { id: "day", name: "Exam day and after", icon: "trend", lessons: day }
    ]
  };
})();
