/* =====================================================================
   TECHLEAD · People and Org Leadership track (curriculum + quizzes + widgets)

   Self-contained: registers window.TRACKS.people, its people-* quizzes, and
   the feedback-conversation simulator and team-health check those lessons
   mount. Story mechanics for "tell me about a time" answers live in Compass
   (behavioral-academy) and are cross-referenced rather than repeated here.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGETS
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
  /* one-of-N segmented control */
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
  function rowsTable(headers, rows, markIdx) {
    var t = h("table", { class: "w-mini-table", style: "width:100%;border-collapse:collapse;font-size:.72rem" });
    var hr = h("tr", {});
    headers.forEach(function (x) {
      hr.appendChild(h("th", { style: "text-align:left;padding:5px 8px;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);border-bottom:1px solid var(--line)" }, x));
    });
    t.appendChild(hr);
    rows.forEach(function (r, ri) {
      var tr = h("tr", markIdx === ri ? { style: "background:color-mix(in srgb, var(--accent) 12%, transparent)" } : {});
      r.forEach(function (cell, ci) {
        tr.appendChild(h("td", { style: "padding:6px 8px;border-bottom:1px solid var(--line)" + (ci === 0 ? ";font-weight:600" : ";color:var(--text-dim)") }, String(cell)));
      });
      t.appendChild(tr);
    });
    return t;
  }
  function labelRow(text) {
    return h("span", { style: "font-family:var(--font-mono);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);min-width:140px" }, text);
  }

  var Widgets = {};

  /* ---------------------------------------------------------------
     1. FEEDBACK CONVERSATION SIMULATOR
     Assemble a corrective conversation one beat at a time and read
     how the receiver is likely to hear each line.
     --------------------------------------------------------------- */
  Widgets["tm-feedback-sim"] = function (mount) {
    shell(mount, "simulator", "Feedback conversation simulator",
      "Sam, a senior engineer, has been marking most review comments as blocking, and a newer engineer has started routing reviews around Sam. Pick one line for each beat. The script starts on the lines most people actually say.");

    var BEATS = [
      { id: "sit", name: "Situation", opts: [
        { label: "Name the moment", line: "\u201cIn Tuesday\u2019s review of the refund-retry change\u2026\u201d", clarity: 2, heat: 0, hears: "Sam knows exactly which conversation this is about and can recall it." },
        { label: "Vague pattern", line: "\u201cLately, in code reviews\u2026\u201d", clarity: 0, heat: 1, hears: "Sam starts searching for which review you mean \u2014 and for a defence." },
        { label: "Praise first", line: "\u201cYou\u2019re one of our strongest engineers, but\u2026\u201d", clarity: -1, heat: 1, hears: "Sam waits for the \u2018but\u2019 and discounts the praise, this time and next time." }
      ] },
      { id: "beh", name: "Behaviour", opts: [
        { label: "Observable", line: "\u201c\u2026you marked eleven comments as blocking, and seven were naming or style preferences.\u201d", clarity: 2, heat: 0, hears: "It is countable and checkable, so the conversation stays on facts." },
        { label: "Judgement", line: "\u201c\u2026you were pretty harsh.\u201d", clarity: -1, heat: 2, hears: "\u2018Harsh\u2019 is your interpretation; Sam will argue the adjective instead of the behaviour." },
        { label: "Hearsay", line: "\u201c\u2026a few people feel you\u2019re not a team player.\u201d", clarity: -2, heat: 3, hears: "Unnamed sources and a character label. Sam now mostly wants to know who said it." }
      ] },
      { id: "imp", name: "Impact", opts: [
        { label: "Concrete effect", line: "\u201cPriya rebased three times, the fix shipped two days late, and she now asks others to review her work instead of you.\u201d", clarity: 2, heat: 0, hears: "The cost is real and specific, and it lands on something Sam cares about \u2014 being useful to the team." },
        { label: "Abstract", line: "\u201cIt isn\u2019t a great look for the team.\u201d", clarity: -1, heat: 1, hears: "A look to whom? Sam hears image management rather than a problem." },
        { label: "Skip it", line: "\u201cI just wanted to flag it.\u201d", clarity: -1, heat: 0, hears: "With no stated effect, Sam can reasonably conclude it does not matter." }
      ] },
      { id: "ask", name: "Next step", opts: [
        { label: "Ask, then agree", line: "\u201cWhat was going on from your side? \u2026 Could we try labelling each comment blocking or optional for two weeks, then look at it together?\u201d", clarity: 2, heat: -1, hears: "Sam gets to give context you may not have, and leaves with a small, checkable experiment." },
        { label: "Directive", line: "\u201cI need you to stop doing that.\u201d", clarity: 0, heat: 2, hears: "Stop doing what, exactly? Compliance at best, and nothing learned about why." },
        { label: "Retreat", line: "\u201cAnyway, it\u2019s not a big deal.\u201d", clarity: -2, heat: 0, hears: "You have just told Sam to ignore everything you said before this line." }
      ] }
    ];
    var pick = { sit: 1, beh: 1, imp: 1, ask: 1 };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var clarity = 0, heat = 0, worst = null;
      var rows = BEATS.map(function (b) {
        var o = b.opts[pick[b.id]];
        clarity += o.clarity;
        heat += o.heat;
        if (!worst || (o.clarity - o.heat) < (worst.o.clarity - worst.o.heat)) worst = { b: b, o: o };
        return [b.name, o.line, o.hears];
      });
      var lands = clarity >= 7 && heat <= 0;
      var verdict = lands ? "lands" : clarity >= 4 && heat <= 2 ? "partly lands" : "changes nothing";
      var heatLbl = heat <= 0 ? "low" : heat <= 2 ? "moderate" : "high";

      stage.innerHTML = "";
      stage.appendChild(rowsTable(["Beat", "What you say", "How it is likely heard"], rows));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        lands
          ? h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "This one lands. "), "Every line is specific enough to check, the impact is a cost Sam would also care about, and the close leaves room for context you might not have. Now book the follow-up \u2014 feedback without one is a single data point.")
          : h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Weakest beat: " + worst.b.name.toLowerCase() + ". "), worst.o.hears)));

      readout.innerHTML = "";
      readout.appendChild(ro("clarity", clarity + " / 8", true));
      readout.appendChild(ro("defensiveness", heatLbl));
      readout.appendChild(ro("verdict", verdict));
    }

    var controls = h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-bottom:18px" });
    BEATS.forEach(function (b) {
      controls.appendChild(h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
        labelRow(b.name),
        seg(b.opts.map(function (o, i) { return { v: i, label: o.label }; }), function () { return pick[b.id]; }, function (v) { pick[b.id] = v; paint(); })));
    });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     2. TEAM HEALTH CHECK
     Set five load signals for one team and see which single move
     would relieve the most pressure.
     --------------------------------------------------------------- */
  Widgets["tm-team-health"] = function (mount) {
    shell(mount, "diagnostic", "Team health check",
      "A seven-person team owns part of the payments platform. Set each signal to what you actually observe. The point is not the total \u2014 it is which single change relieves the most load first.");

    var DIMS = [
      { id: "own", label: "Services owned", levels: ["1\u20133", "4\u20137", "8+"],
        signal: ["Everyone can explain every service", "Some services have one person who understands them", "Several services nobody has touched in a quarter"],
        move: "Retire, merge or hand off services until each has a named owner who could debug it at 02:00. Ownership beyond the team\u2019s cognitive budget is ownership on paper." },
      { id: "handoff", label: "Teams to ship a feature", levels: ["1", "2", "3+"],
        signal: ["The team ships end to end", "One regular handoff, usually manageable", "Most features queue behind other teams"],
        move: "Re-cut the boundary so the most common change lives inside one team. Handoffs are where weeks disappear, and no amount of process makes a queue free." },
      { id: "pages", label: "Pages per on-call week", levels: ["<3", "3\u201310", "10+"],
        signal: ["On-call is boring, as it should be", "Sleep is interrupted most weeks", "On-call is the job; roadmap work stalls"],
        move: "Fix the top three alert sources before anything else. A noisy rota burns out exactly the people who know the system best." },
      { id: "unplanned", label: "Unplanned work", levels: ["<15%", "15\u201335%", ">35%"],
        signal: ["Plans mostly survive the sprint", "Plans bend every sprint", "Plans are fiction"],
        move: "Make interrupts visible and rotate a weekly interrupt owner so the rest of the team can plan. Then attack the biggest interrupt source by name." },
      { id: "flags", label: "Burnout signals in 1:1s", levels: ["none", "one", "several"],
        signal: ["No one is running on empty", "One person is stretched", "The strain is systemic, not individual"],
        move: "Treat it as a load problem first: remove work, cut scope, protect evenings. A wellness session on top of the same workload reads as not listening." }
    ];
    var lvl = { own: 1, handoff: 2, pages: 1, unplanned: 1, flags: 0 };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var total = 0, top = null, topIdx = -1;
      DIMS.forEach(function (d, i) {
        total += lvl[d.id];
        if (lvl[d.id] > 0 && (!top || lvl[d.id] > lvl[top.id])) { top = d; topIdx = i; }
      });
      var verdict = total <= 3 ? "healthy" : total <= 6 ? "stretched" : "overloaded";

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Signal", "Observed", "What it usually means"],
        DIMS.map(function (d) { return [d.label, d.levels[lvl[d.id]], d.signal[lvl[d.id]]]; }),
        topIdx
      ));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        top
          ? h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "First move \u2014 " + top.label.toLowerCase() + ". "), top.move)
          : h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Nothing to fix. "), "Protect it: this is the state a reorg or a new mandate most easily destroys, so say so when the next one is proposed.")));

      readout.innerHTML = "";
      readout.appendChild(ro("load score", total + " / 10", true));
      readout.appendChild(ro("verdict", verdict));
      readout.appendChild(ro("first move", top ? top.label : "none"));
    }

    var controls = h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-bottom:18px" });
    DIMS.forEach(function (d) {
      controls.appendChild(h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
        labelRow(d.label),
        seg(d.levels.map(function (l, i) { return { v: i, label: l }; }), function () { return lvl[d.id]; }, function (v) { lvl[d.id] = v; paint(); })));
    });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  var COMPASS_SALT = "<a class='inline' href='../behavioral-academy/index.html#/beh/delivery/deliver-salt'>SALT structure in Compass</a>";
  var COMPASS_ANATOMY = "<a class='inline' href='../behavioral-academy/index.html#/story/catalog/story-anatomy'>reusable story anatomy in Compass</a>";
  var COMPASS_MANAGER = "<a class='inline' href='../behavioral-academy/index.html#/story/playbooks/manager-track'>manager-round playbook in Compass</a>";

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "people-hiring": {
      title: "Hiring and onboarding checkpoint",
      sub: "Scorecards, structured interviews, debriefs, and the first ninety days.",
      questions: [
        {
          q: "Before opening a senior role, what should exist first?",
          options: [
            "A job description listing the required technologies",
            "A scorecard naming the outcomes the hire must deliver in their first year and the competencies that predict them",
            "An interview loop copied from the last successful hire",
            "A salary band approved by finance"
          ],
          answer: 1,
          explain: "The scorecard is the specification every interviewer grades against; without it, each person interviews for a slightly different job and the debrief becomes a negotiation between those jobs. A technology list describes inputs, not what success looks like. The band matters, but it is derived from the level the outcomes imply rather than the other way round."
        },
        {
          q: "In a debrief, the most senior interviewer speaks first and strongly. What practice most reduces the damage?",
          options: [
            "Letting the hiring manager speak first instead",
            "Requiring a unanimous vote",
            "Asking interviewers to keep their comments short",
            "Requiring every interviewer to submit written feedback with evidence before seeing anyone else\u2019s"
          ],
          answer: 3,
          explain: "Anchoring happens before the meeting starts if people can read or hear each other\u2019s verdicts first, so independent written evidence is the control. Reordering speakers only changes who anchors. Unanimity gives every interviewer a veto without requiring them to justify it, which is a different failure."
        },
        {
          q: "An interviewer\u2019s feedback says \u201cnot a culture fit\u201d with no further detail. What should you do?",
          options: [
            "Ask for the specific behaviour observed and which scorecard competency it maps to; if there is none, discount it",
            "Accept it, since culture is hard to articulate",
            "Remove that interviewer from future loops",
            "Schedule another interview to get a tie-breaker"
          ],
          answer: 0,
          explain: "Unexplained fit judgements are where similarity bias hides, so the feedback has to be converted into evidence against the scorecard or set aside. That is also how you coach the interviewer rather than punishing them. Another interview just adds an opinion without fixing the standard."
        },
        {
          q: "Which is the best primary measure of whether onboarding worked?",
          options: [
            "All accounts and tools provisioned in the first week",
            "The new hire completed the reading list",
            "Time until the hire independently ships a meaningful change on a real production path",
            "Their satisfaction score in a 30-day survey"
          ],
          answer: 2,
          explain: "Onboarding exists to produce a trusted, independent contributor, so the measure is time to that state. Provisioning is a prerequisite and a reading list is an input. Satisfaction matters but can be high while the person is still unable to work on their own."
        },
        {
          q: "A very experienced hire wants to replace the team\u2019s deployment process in week two. What is the strongest response?",
          options: [
            "Approve it \u2014 that experience is why you hired them",
            "Refuse, since new hires should not change process",
            "Let them do it in a separate branch without telling the team",
            "Agree a short listening period with a written write-up of what they would change and why, then decide together"
          ],
          answer: 3,
          explain: "Senior hires fail by changing things before they understand why they are the way they are, and the team loses trust in them quickly when that happens. A time-boxed listening period with a written proposal keeps the fresh perspective while forcing them to learn the constraints. Outright refusal wastes the reason you hired them."
        }
      ]
    },

    "people-coaching": {
      title: "Coaching and feedback checkpoint",
      sub: "1:1s, mentoring against sponsoring, situation-behaviour-impact feedback, and conflict.",
      questions: [
        {
          q: "Whose agenda should come first in a weekly 1:1?",
          options: [
            "The report\u2019s",
            "The manager\u2019s, since they have the wider context",
            "Whichever project is most at risk",
            "Nobody\u2019s \u2014 1:1s work best unstructured"
          ],
          answer: 0,
          explain: "A 1:1 is the report\u2019s meeting; leading with their topics is what surfaces the problems you would otherwise hear about too late. Project risk belongs in a status channel that does not consume the only private time you have together. Unstructured 1:1s drift into status by default."
        },
        {
          q: "A strong engineer is ready for staff-level scope but nobody outside the team knows their work. What intervention fits best?",
          options: [
            "Mentoring them on how you got promoted",
            "Coaching them to reflect on their goals",
            "Sending them to a leadership course",
            "Sponsoring them \u2014 putting their name forward for a visible, cross-team problem and vouching for them"
          ],
          answer: 3,
          explain: "The gap is opportunity and visibility, not skill or insight, and only sponsorship spends your credibility to close that gap. Mentoring and coaching both help the person grow but leave them invisible to the people who decide. Courses add knowledge they already have."
        },
        {
          q: "Which sentence is a behaviour, in situation-behaviour-impact terms?",
          options: [
            "\u201cYou seemed disengaged in planning.\u201d",
            "\u201cYou were on your laptop for most of planning and did not estimate any of the four stories.\u201d",
            "\u201cPeople think you don\u2019t care about planning.\u201d",
            "\u201cYour attitude in planning needs to improve.\u201d"
          ],
          answer: 1,
          explain: "A behaviour is something a camera could record: it can be checked, so it can be discussed rather than disputed. \u201cDisengaged\u201d and \u201cattitude\u201d are your interpretations, and hearsay adds an unnamed accuser. Interpretations invite argument about the label instead of change in the behaviour."
        },
        {
          q: "Two senior engineers keep clashing over a service design. What should you establish first?",
          options: [
            "Which of the two is more senior",
            "Whether a team-building session would help",
            "What kind of conflict it is \u2014 different goals, different information, unclear decision rights, or something interpersonal",
            "Whether one of them should move to another team"
          ],
          answer: 2,
          explain: "The remedy depends entirely on the source: shared information fixes an information gap, a named decider fixes unclear rights, and neither is helped by team-building. Seniority is not a decision rule. Moving someone treats the symptom and teaches the team that conflict ends in transfers."
        },
        {
          q: "You hear that one engineer has made demeaning remarks about a colleague\u2019s background. What is the right approach?",
          options: [
            "Treat it as a conduct issue: act on it directly and involve HR according to policy, rather than mediating it as a disagreement",
            "Mediate a conversation between the two so they can understand each other",
            "Give it time to see if it repeats",
            "Mention it in the next team meeting without naming anyone"
          ],
          answer: 0,
          explain: "Mediation assumes two legitimate positions, and demeaning someone for who they are is not a position \u2014 it is conduct that your policies already cover. Waiting signals tolerance to the person affected and everyone who noticed. An anonymous team announcement neither protects the colleague nor addresses the behaviour."
        }
      ]
    },

    "people-performance": {
      title: "Performance and careers checkpoint",
      sub: "Underperformance, calibration, career ladders, and delegating decisions.",
      questions: [
        {
          q: "A previously solid engineer has missed several commitments this quarter. What is your first step?",
          options: [
            "Open a formal performance plan to create a record",
            "Diagnose privately whether this is about clarity, capability, capacity, or something outside work",
            "Reassign their work to a stronger engineer",
            "Raise it at their next review cycle"
          ],
          answer: 1,
          explain: "A change in a previously solid performer usually has a cause \u2014 unclear expectations, a skill gap in new work, overload, or personal circumstances \u2014 and each needs a different response. A formal plan as the first move destroys trust and may be the wrong tool. Waiting for review cycle breaks the rule that nothing in a review should be a surprise."
        },
        {
          q: "What most distinguishes a genuine underperformance plan from one written to justify an exit?",
          options: [
            "Specific, measurable expectations, a realistic time box, named support, and regular check-ins where success is a real possibility",
            "It is shorter",
            "HR is not involved",
            "It is kept confidential from the employee until the end"
          ],
          answer: 0,
          explain: "A real plan is designed so the person can succeed: they know exactly what good looks like, have the support to get there, and hear how they are tracking every week. Excluding HR removes a safeguard rather than adding sincerity. A plan the employee cannot see is not a plan at all."
        },
        {
          q: "In calibration, which practice most reduces bias?",
          options: [
            "Ranking everyone against each other on a single list",
            "Letting each manager\u2019s rating stand unchallenged",
            "Comparing each person\u2019s evidence against the written level expectations and checking outcomes across groups afterwards",
            "Using last cycle\u2019s ratings as the starting point"
          ],
          answer: 2,
          explain: "Comparing against a written standard rather than against each other reduces both recency and proximity effects, and a post-hoc check across groups catches the drift that individual judgements cannot see. Stack ranking rewards whoever is described most vividly. Starting from last cycle anchors everyone to an old answer."
        },
        {
          q: "A key engineer threatens to leave unless promoted, but they are not yet operating at the next level. What is the strongest response?",
          options: [
            "Promote them to retain them",
            "Promise the promotion next cycle",
            "Tell them the threat is unprofessional",
            "Be honest about the specific gaps against the ladder, agree a plan with visible opportunities, and address retention separately through scope or compensation where justified"
          ],
          answer: 3,
          explain: "Promotion as a retention tool sets them up to fail at a level they are not ready for and tells everyone else that threats work. A future promise is a commitment you may not control. Separating the level conversation from the retention conversation lets you be honest on one and generous on the other."
        },
        {
          q: "You delegate a vendor selection to a senior engineer but expect to see the recommendation before anything is signed. What should you say?",
          options: [
            "\u201cIt\u2019s yours \u2014 do whatever you think is best.\u201d",
            "\u201cResearch the options, make the call, and walk me through it before we sign anything.\u201d",
            "Nothing; they will check in if they need to",
            "\u201cSend me the three vendors and I\u2019ll choose.\u201d"
          ],
          answer: 1,
          explain: "Stating the delegation level explicitly \u2014 they decide, you see it before an irreversible step \u2014 is what prevents both the surprise signature and the silent takeback. \u201cDo whatever\u201d over-delegates relative to what you actually expect, and the gap shows up as an override later. Choosing yourself is not delegation."
        }
      ]
    },

    "people-org": {
      title: "Teams and culture checkpoint",
      sub: "Team shape and load, distributed work, managing up, burnout, reorgs, and quality culture.",
      questions: [
        {
          q: "A team ships slowly because most features need changes from two other teams. What is the structural fix?",
          options: [
            "Add a program manager to coordinate the handoffs",
            "Hold a weekly cross-team sync",
            "Redraw ownership so the most common kind of change lives inside one team",
            "Ask the other teams to prioritise this team\u2019s requests"
          ],
          answer: 2,
          explain: "Handoffs are queues, and coordination only makes a queue more visible; moving the boundary removes it. Syncs and program managers are useful for genuinely cross-cutting work but become permanent overhead when the boundary is simply wrong. Asking for priority just moves the delay onto someone else\u2019s roadmap."
        },
        {
          q: "Your team spans three time zones with two hours of overlap. Which default matters most?",
          options: [
            "Requiring cameras on in every meeting",
            "Making written, asynchronous decision-making the default, with overlap hours reserved for discussion",
            "Scheduling all meetings in the headquarters time zone",
            "Tracking online status to confirm availability"
          ],
          answer: 1,
          explain: "With little overlap, anything that needs a meeting waits a day, so written proposals and decision logs are what keep work moving. Meetings in one time zone push the cost onto the same people every time. Camera and presence rules measure attendance rather than progress."
        },
        {
          q: "You learn a committed date is going to slip by three weeks. When should your manager hear about it?",
          options: [
            "Now, with the cause, the options, and your recommendation",
            "Once you have a recovery plan fully worked out",
            "At the next scheduled status review",
            "Only if the team cannot recover the time"
          ],
          answer: 0,
          explain: "Early bad news gives your manager options; late bad news gives them only consequences, and it is what costs you trust. Bringing options with it turns the conversation into a decision rather than a confession. A fully worked plan is not a reason to wait \u2014 you can share it as it firms up."
        },
        {
          q: "Several engineers show signs of burnout after a long incident-heavy quarter. Which response addresses the cause?",
          options: [
            "Organise a wellness workshop",
            "Encourage everyone to take a day off",
            "Remove or defer work, fix the top alert sources, and protect the on-call rota",
            "Ask HR to run a stress survey"
          ],
          answer: 2,
          explain: "Burnout is mostly a load and control problem, so the remedy is less load and more control over it. Workshops and days off on top of an unchanged workload read as not listening and leave the same pressure waiting on return. A survey tells you what the signals already said."
        },
        {
          q: "An engineer reports that their own change caused last night\u2019s outage. Which response most strengthens a quality culture?",
          options: [
            "Thank them publicly, run a blameless review, and fix the system gap that let the change through",
            "Note it privately in their performance file",
            "Add a manual approval step for all of their future changes",
            "Keep it quiet to protect their reputation"
          ],
          answer: 0,
          explain: "What gets rewarded is what culture becomes: thanking early reporting makes the next person report faster. Penalising them \u2014 formally or through a personal approval gate \u2014 teaches everyone to wait until someone else notices. Keeping it quiet loses the lesson the whole team needed."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.people = {
    id: "people",
    name: "People and Org Leadership",
    short: "PPL",
    tagline: "Build the team that builds the system",
    color: "#a78bfa",
    blurb: "The half of the techno managerial round that is about humans: hiring against a scorecard, structured interviews and honest debriefs, onboarding to real ownership, 1:1s, mentoring against sponsoring, feedback that lands, conflict, performance conversations, calibration and career ladders, delegation, team shape and load, managing up, burnout, reorgs, and building a culture where quality and security are the easy path.",
    modules: [
      /* ==================== MODULE 1 · HIRING ==================== */
      {
        id: "hiring",
        name: "Hiring and Onboarding",
        icon: "compass",
        lessons: [
          {
            id: "role-scorecards",
            title: "Role scorecards before job posts",
            summary: "Decide what the hire must achieve in their first year before deciding what to ask \u2014 or every interviewer grades a different job.",
            minutes: 9,
            tags: ["hiring", "scorecards"],
            blocks: [
              { t: "p", html: "Most bad hires are decided before the first interview, when a role is opened from an old job description and a list of technologies. Every interviewer then fills the gap with their own picture of the job. A <strong>scorecard</strong> replaces that picture with a written one: what this person must achieve, how you will know, and which competencies predict it." },
              { t: "table",
                headers: ["Field", "Example", "What goes wrong without it"],
                rows: [
                  ["Mission", "Make payment retries safe and observable across all providers", "Interviewers optimise for general brilliance instead of this job"],
                  ["Twelve-month outcomes", "Duplicate-charge rate under 0.01%; on-call pages halved", "Nobody can say afterwards whether the hire worked"],
                  ["Competencies", "Distributed-systems judgment, incident leadership, written design", "Each interviewer tests whatever they happen to know"],
                  ["Anti-signals", "Rewrites before understanding; blames upstream teams", "Red flags get noticed and then argued away"],
                  ["Level calibration", "Senior: owns a domain; Staff: sets direction across teams", "Strong mid-level candidates are rejected as weak seniors, or the reverse"]
                ]
              },
              { t: "h", text: "Writing outcomes instead of adjectives" },
              { t: "ul", items: [
                "<strong>Start from the problem the team cannot currently solve.</strong> If the hire would not change any outcome in a year, the role is a backfill and should be scoped as one.",
                "<strong>Write two to four outcomes, each measurable.</strong> \u201cStrong communicator\u201d is an adjective; \u201cpublishes a design every quarter that two other teams adopt\u201d is an outcome.",
                "<strong>Map every interview to one or two competencies.</strong> An interview that tests nothing on the scorecard is a conversation, and it will produce an opinion.",
                "<strong>Get the panel to agree the scorecard before the first candidate.</strong> Changing the bar mid-search is how the last candidate standing becomes the hire."
              ] },
              { t: "code", lang: "text", code:
                "Scorecard \u2014 Senior engineer, payments reliability\n" +
                "\n" +
                "  MISSION    Retries are safe, provider failures degrade\n" +
                "             gracefully, and on-call is boring.\n" +
                "  OUTCOMES   1. duplicate-charge rate < 0.01% by month 9\n" +
                "             2. provider-outage runbooks for all 4 providers\n" +
                "             3. pages per on-call week halved by month 12\n" +
                "  COMPETENCY interview\n" +
                "    idempotency & failure design     system design\n" +
                "    incident leadership              past-incident deep dive\n" +
                "    written design                   take-home design note\n" +
                "    collaboration under disagreement behavioural\n" +
                "  ANTI-SIGNALS  rewrites first; vague about own decisions"
              },
              { t: "compare",
                bad: { title: "A requirements list", items: ["Eight years of experience", "Expert in three named frameworks", "Strong communicator", "Team player"] },
                good: { title: "A scorecard", items: ["One-sentence mission", "Two to four measurable outcomes", "Competencies mapped to interviews", "Named anti-signals the panel watches for"] }
              },
              { t: "note", variant: "trap", html: "<strong>Years of experience and technology lists filter for familiarity, not for the outcome.</strong> They exclude people who learned faster elsewhere and admit people who did the same year eight times." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can run a fair interview against questions someone else wrote."],
                  ["Senior", "Writes the scorecard for their own hires and maps interviews to competencies."],
                  ["Staff", "Makes scorecards the default across an org and audits whether hires actually delivered the outcomes they were hired for."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you hire?\u201d, \u201cHow do you decide what a role needs?\u201d, or \u201cTell me about a hire that did not work out\u201d all start with the same move: what outcome was the role for, and did the interviews test for it?" },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you made a hiring mistake.\u201d Answer in two minutes, naming what the scorecard missed and what you changed afterwards. For the story structure itself, use the " + COMPASS_SALT + "." },
              { t: "note", variant: "key", html: "<strong>Write the job before you interview for it.</strong> A scorecard of outcomes, competencies and anti-signals, agreed by the panel before the first candidate, is the single cheapest control on hiring quality \u2014 everything downstream grades against it." }
            ]
          },
          {
            id: "structured-interviews",
            title: "Structured interviews and honest debriefs",
            summary: "Same questions, anchored ratings, independent write-ups before the debrief \u2014 and a bar that does not drop when the pipeline is thin.",
            minutes: 10,
            tags: ["hiring", "interviews", "debrief"],
            blocks: [
              { t: "p", html: "An unstructured interview mostly measures rapport: how similar the candidate is to the interviewer and how well the conversation flowed. <strong>Structure is what turns a pleasant hour into evidence</strong> \u2014 each interviewer owns specific competencies, asks comparable questions, and rates against anchors written before anyone met a candidate." },
              { t: "table",
                headers: ["Practice", "What it prevents", "What it costs"],
                rows: [
                  ["One or two competencies per interviewer", "Five people testing the same thing and nobody testing the rest", "Up-front loop design"],
                  ["A shared question bank per competency", "Incomparable evidence across candidates", "Maintenance as questions leak"],
                  ["Anchored rating scale", "\u201cStrong hire\u201d meaning different things to different people", "Writing what a 2 and a 4 actually look like"],
                  ["Written feedback before the debrief", "Anchoring on the loudest or most senior voice", "Interviewers must write within hours, not days"],
                  ["An independent bar holder", "The hiring manager lowering the bar under deadline pressure", "One more interviewer, and occasional friction"]
                ]
              },
              { t: "h", text: "Running the debrief" },
              { t: "ol", items: [
                "<strong>Everyone submits evidence before reading anyone else\u2019s.</strong> The order is the control; without it, the rest is theatre.",
                "<strong>Discuss competency by competency, not person by person.</strong> \u201cWhat evidence do we have on incident leadership?\u201d beats a round of thumbs.",
                "<strong>Separate evidence from inference.</strong> \u201cThey did not mention rollback\u201d is evidence; \u201cthey would be careless in production\u201d is an inference that needs more than one data point.",
                "<strong>Name the decision owner.</strong> Usually the hiring manager decides, and an independent bar holder can block but not force a hire.",
                "<strong>Record the reasoning.</strong> When the hire succeeds or fails, you want to know which signal predicted it."
              ] },
              { t: "code", lang: "text", code:
                "Debrief note \u2014 candidate 14, senior payments\n" +
                "\n" +
                "  idempotency & failure   3/4  designed keyed retries unprompted;\n" +
                "                                 missed same-key/different-payload\n" +
                "  incident leadership     4/4  mitigated before diagnosing; clear\n" +
                "                                 comms cadence; owned a mistake\n" +
                "  written design          2/4  correct but no options considered\n" +
                "  collaboration           3/4  disagreed with interviewer, held it\n" +
                "                                 on evidence, conceded one point\n" +
                "\n" +
                "  DECISION  hire at senior. Gap on written design is coachable\n" +
                "            and named in the onboarding plan."
              },
              { t: "note", variant: "warn", html: "<strong>\u201cNot a culture fit\u201d is not evidence until it names a behaviour.</strong> Ask which observed behaviour it refers to and which scorecard item it maps to. If it maps to nothing, it is similarity bias and should be set aside \u2014 and the interviewer coached." },
              { t: "note", variant: "trap", html: "<strong>The bar drops quietly when the pipeline is thin.</strong> A role open for four months produces a debrief where \u201cgood enough\u201d sounds reasonable. That is the moment the independent bar holder exists for, and the reason their block should be hard to override." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Writes evidence-based feedback against the competency they were assigned."],
                  ["Senior", "Designs the loop, runs a debrief that separates evidence from inference, and holds the bar under schedule pressure."],
                  ["Staff", "Trains interviewers, calibrates rating anchors across teams, and checks whether debrief signals actually predicted performance."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you run a hiring loop?\u201d, \u201cTwo interviewers disagree \u2014 what do you do?\u201d, or \u201cHave you ever hired someone you were unsure about?\u201d are all asking whether your process produces evidence or opinions." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you disagreed with the rest of a hiring panel.\u201d Name the competency in dispute, the evidence on each side, and who decided. Build the story using the " + COMPASS_ANATOMY + " so it also answers conflict and judgement prompts." },
              { t: "note", variant: "key", html: "<strong>Evidence first, independently, then discussion.</strong> Written feedback before the debrief, mapped to scorecard competencies, is what keeps one confident voice from deciding a hire \u2014 and an independent bar holder is what keeps a thin pipeline from lowering the bar." }
            ]
          },
          {
            id: "onboarding",
            title: "Onboarding to first real ownership",
            summary: "The goal is time to an independent, meaningful change on a real path \u2014 not a laptop, a reading list and a month of shadowing.",
            minutes: 8,
            tags: ["hiring", "onboarding"],
            blocks: [
              { t: "p", html: "Onboarding is usually designed as logistics: accounts, a reading list, and some shadowing. The thing it should produce is <strong>a trusted, independent contributor</strong>, and the measure is how long that takes. Every week a strong hire spends waiting for context is a week of salary and enthusiasm burned." },
              { t: "table",
                headers: ["By", "Outcome", "Evidence", "Your job as the manager"],
                rows: [
                  ["Week 1", "Environment working; one small change merged", "A real commit on a real path", "Pick the first change before they arrive"],
                  ["Day 30", "Owns a scoped piece of work end to end", "Shipped, with a design note", "Agree written expectations; first feedback conversation"],
                  ["Day 60", "Joins on-call shadow; reviews others\u2019 changes", "Review comments other people act on", "Check the scorecard gaps named at hire"],
                  ["Day 90", "Independent owner of a component", "Named as owner; handles an incident or escalation", "Explicit check-in: is this the job they expected?"]
                ]
              },
              { t: "ul", items: [
                "<strong>Assign a buddy who is not their manager.</strong> New people ask peers the questions they would never ask the person who writes their review.",
                "<strong>Make the first project real but small.</strong> A change that ships to production teaches the deploy path, the review culture and the on-call reality at once.",
                "<strong>Write the context down.</strong> A one-page map of systems, owners and current problems saves dozens of interrupted conversations.",
                "<strong>Give feedback at two weeks, not at review time.</strong> Early small corrections are cheap; a surprise at six months is not."
              ] },
              { t: "code", lang: "text", code:
                "Onboarding plan \u2014 first 30 days\n" +
                "\n" +
                "  before day 1  first change chosen: add provider name to\n" +
                "                retry-failure log line (touches deploy path)\n" +
                "  week 1        buddy: Lin. Ship the change. Read the\n" +
                "                payments context page; list 5 questions.\n" +
                "  week 2        feedback conversation #1 (15 min)\n" +
                "  weeks 2-4     own: idempotency key for the refund API\n" +
                "                (design note -> review -> ship)\n" +
                "  day 30        written expectations for days 30-90,\n" +
                "                including the design-writing gap from hiring"
              },
              { t: "note", variant: "trap", html: "<strong>A reading list is not onboarding.</strong> Documentation without a task to apply it to is forgotten within a week, and it delays the moment the new hire discovers what the documents got wrong." },
              { t: "note", variant: "warn", html: "<strong>Senior hires fail the opposite way.</strong> They arrive with strong opinions and change things before they understand why they are the way they are. Agree a short listening period that ends in a written proposal, so the fresh perspective is kept and the team\u2019s trust is not spent." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you onboard engineers?\u201d or \u201cA new senior hire is struggling at sixty days \u2014 what happened?\u201d Answer with the outcome you were aiming for and the checkpoints that would have caught the drift." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Describe your onboarding plan for a senior hire in four sentences, naming the first change they ship and when they first hear feedback from you." },
              { t: "note", variant: "key", html: "<strong>Measure onboarding by time to independent ownership.</strong> A real first change in week one, a buddy who is not the manager, written expectations at thirty days and feedback at two weeks do more than any reading list \u2014 and senior hires need a listening period, not a free hand." },
              { t: "quiz", id: "people-hiring" }
            ]
          }
        ]
      },

      /* ==================== MODULE 2 · COACHING ==================== */
      {
        id: "coaching",
        name: "Coaching and Feedback",
        icon: "share",
        lessons: [
          {
            id: "one-on-ones",
            title: "1:1s that are not status meetings",
            summary: "The report\u2019s agenda first, a running document, career on a cadence \u2014 and the discipline not to cancel when you are busy.",
            minutes: 8,
            tags: ["coaching", "one-on-ones"],
            blocks: [
              { t: "p", html: "A 1:1 is the only regular private time you have with each person, which makes it the earliest warning system you own. <strong>When it turns into a status meeting, you lose the warning</strong> \u2014 status has a dashboard; the frustration, the job offer and the conflict with a peer do not." },
              { t: "table",
                headers: ["What you hear", "What it often means", "The move"],
                rows: [
                  ["\u201cEverything\u2019s fine\u201d for several weeks running", "Nothing to say, or nothing they want to say to you", "Ask a specific question: what would you change about the team if you could?"],
                  ["Repeated complaints about another team", "A boundary or decision-rights problem", "Find out who decides; take it to that person"],
                  ["Questions about promotion timing", "They feel stalled, or have an outside offer", "Have the career conversation now, not at review time"],
                  ["Shorter answers, fewer topics", "Disengagement, overload, or something personal", "Name what you have noticed and ask, without diagnosing"]
                ]
              },
              { t: "ul", items: [
                "<strong>Their agenda first.</strong> Your items go last, and most of them could be a message.",
                "<strong>Keep a shared running document.</strong> Topics, decisions and follow-ups, newest first \u2014 it is also the record that makes reviews fair.",
                "<strong>Talk about career roughly monthly.</strong> Not in every 1:1, but often enough that the annual review contains no new information.",
                "<strong>Do not cancel; move.</strong> Cancelling when you are busy tells the person exactly where they rank."
              ] },
              { t: "code", lang: "text", code:
                "1:1 running doc \u2014 Ana / manager (newest first)\n" +
                "\n" +
                "  2026-10-21\n" +
                "    Ana   frustrated: platform team keeps changing the\n" +
                "          deploy API without notice\n" +
                "    me    who decides API changes? -> no one; raising with\n" +
                "          platform lead this week (owner: me, Fri)\n" +
                "    career  wants incident-commander experience; next\n" +
                "          Sev2 she leads with me shadowing\n" +
                "    follow-up from last week: design review done (yes)"
              },
              { t: "compare",
                bad: { title: "Status in a private room", items: ["Manager asks what got done", "Ticket-by-ticket walkthrough", "Cancelled during crunch", "No record of what was agreed"] },
                good: { title: "A 1:1 that earns its slot", items: ["Report\u2019s topics first", "Problems, people and career", "Moved but never dropped", "Running document with owners and dates"] }
              },
              { t: "note", variant: "trap", html: "<strong>Asking \u201chow are things?\u201d and accepting \u201cfine\u201d is how you learn about a resignation from the resignation.</strong> Specific questions get specific answers; generic ones get the polite default." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you run 1:1s?\u201d or \u201cHow would you know a strong engineer was about to leave?\u201d Both are asking whether your 1:1s surface problems early or just collect status." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time a 1:1 changed a decision you had already made.\u201d Name what you heard, what you did, and what would have happened if you had not asked. The " + COMPASS_MANAGER + " covers how manager rounds probe this." },
              { t: "note", variant: "key", html: "<strong>A 1:1 is an early-warning system, not a status meeting.</strong> Their agenda first, a running document, career on a monthly cadence, and never cancelling \u2014 those four habits are what make the problems arrive while they are still small." }
            ]
          },
          {
            id: "mentor-coach-sponsor",
            title: "Mentoring, coaching and sponsoring",
            summary: "Three different interventions: share what you know, help them find it, or spend your credibility to get them the opportunity.",
            minutes: 9,
            tags: ["coaching", "sponsorship", "growth"],
            blocks: [
              { t: "p", html: "Managers often say they \u201cmentor\u201d everyone when they are doing one of three quite different things. <strong>Mentoring</strong> shares your experience and answers. <strong>Coaching</strong> asks questions so the person finds their own answer. <strong>Sponsoring</strong> spends your credibility, in rooms they are not in, to get them an opportunity. Choosing the wrong one is how a capable engineer gets advice when what they needed was a door opened." },
              { t: "table",
                headers: ["Mode", "You", "Best when", "Failure mode"],
                rows: [
                  ["Mentoring", "Share what worked for you and why", "They lack knowledge or context you have", "Creating a copy of yourself; advice that fit your era, not theirs"],
                  ["Coaching", "Ask, reflect, and let them decide", "They have the knowledge but are stuck on a choice", "Withholding an answer they genuinely needed, and calling it growth"],
                  ["Sponsoring", "Name them for a visible problem and vouch for them", "They are ready and nobody senior knows it", "Sponsoring only people who remind you of yourself"],
                  ["Directing", "Tell them what to do", "Stakes are high, time is short, and they are new to it", "Becoming the permanent bottleneck for their decisions"]
                ]
              },
              { t: "h", text: "Choosing the mode" },
              { t: "ul", items: [
                "<strong>Ask what is missing: knowledge, confidence, or opportunity.</strong> Knowledge calls for mentoring, a stuck choice for coaching, and a missing opportunity for sponsorship.",
                "<strong>Check the stakes and the clock.</strong> Coaching is slow by design; it is the wrong tool in the middle of a Sev1.",
                "<strong>Say which mode you are in.</strong> \u201cI\u2019m going to ask questions rather than tell you what I\u2019d do\u201d stops coaching from feeling like evasion.",
                "<strong>Audit who you sponsor.</strong> Write down whose name you put forward last year. The pattern is usually less even than you think."
              ] },
              { t: "code", lang: "text", code:
                "A coaching ladder \u2014 for a stuck decision\n" +
                "\n" +
                "  1. What are you actually trying to achieve here?\n" +
                "  2. What have you already tried, and what happened?\n" +
                "  3. What options can you see? What else?\n" +
                "  4. What would you advise a peer in your position?\n" +
                "  5. What is the smallest next step, and by when?\n" +
                "\n" +
                "If they reach step 5 with no options at all, stop coaching:\n" +
                "they need knowledge, and withholding it is not kindness."
              },
              { t: "note", variant: "warn", html: "<strong>Many engineers are over-mentored and under-sponsored.</strong> Advice is cheap to give and feels generous; putting someone\u2019s name forward for the hard cross-team problem costs you something, which is exactly why it moves careers." },
              { t: "note", variant: "trap", html: "<strong>Coaching someone who needs an answer is a failure dressed as patience.</strong> If a person lacks the knowledge, five open questions only make them feel slow." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Mentors newer engineers on technical topics when asked."],
                  ["Senior", "Chooses deliberately between mentoring, coaching and directing, and says which one they are doing."],
                  ["Staff", "Sponsors people across teams, tracks whose names they put forward, and corrects the pattern when it skews."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you grow engineers?\u201d or \u201cTell me about someone you helped get promoted\u201d \u2014 the strong answer names which mode you used and why, and includes at least one case of sponsorship." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you helped someone grow.\u201d Make the decision in the story explicit: what was missing for them, and which of the three modes you chose. Use the " + COMPASS_SALT + " to keep the landing measurable." },
              { t: "note", variant: "key", html: "<strong>Diagnose what is missing before choosing how to help.</strong> Knowledge calls for mentoring, a stuck choice for coaching, and a missing opportunity for sponsorship \u2014 and sponsorship is the one that costs you something, which is why it is the one that moves careers." }
            ]
          },
          {
            id: "feedback-sbi",
            title: "Feedback that lands: situation, behaviour, impact",
            summary: "Name the moment, describe what a camera would have seen, state the effect \u2014 then ask for their side and agree a next step.",
            minutes: 10,
            tags: ["coaching", "feedback"],
            blocks: [
              { t: "p", html: "Most corrective feedback fails because it is either too vague to act on or too judgemental to hear. <strong>Situation, behaviour, impact</strong> fixes both: anchor it to a specific moment, describe the behaviour as something observable, state its concrete effect, and only then ask for the other person\u2019s view. The same structure works for praise, which is the half people skip." },
              { t: "table",
                headers: ["Part", "Weak version", "Strong version"],
                rows: [
                  ["Situation", "\u201cLately\u2026\u201d", "\u201cIn Tuesday\u2019s incident review\u2026\u201d"],
                  ["Behaviour", "\u201cYou were dismissive.\u201d", "\u201cYou interrupted Lee twice before the timeline was finished.\u201d"],
                  ["Impact", "\u201cIt wasn\u2019t great.\u201d", "\u201cWe never heard the part where the alert fired late, and that was the actual cause.\u201d"],
                  ["Next step", "\u201cJust be nicer.\u201d", "\u201cWhat was going on for you? Could we try holding questions until the timeline ends?\u201d"]
                ]
              },
              { t: "widget", id: "tm-feedback-sim" },
              { t: "h", text: "Delivering it" },
              { t: "ul", items: [
                "<strong>Soon, while the moment is still recallable.</strong> Feedback saved for a review is a verdict, not feedback.",
                "<strong>Corrective in private; recognition can be public.</strong> But make recognition specific too \u2014 \u201cgreat job\u201d teaches nothing.",
                "<strong>Ask before you conclude.</strong> They may have context you lack, and asking is what makes it a conversation rather than a citation.",
                "<strong>End with something small and checkable.</strong> Then follow up; one conversation is a data point, not a change."
              ] },
              { t: "compare",
                bad: { title: "Cushioned feedback", items: ["Praise, criticism, praise", "Character words: harsh, lazy, negative", "\u201cSome people feel\u2026\u201d", "No next step, no follow-up"] },
                good: { title: "Direct and specific", items: ["One specific moment", "Observable behaviour, ideally countable", "A concrete effect they would also care about", "Their view, then a small experiment and a follow-up date"] }
              },
              { t: "note", variant: "trap", html: "<strong>Feedback by hearsay is not feedback.</strong> \u201cA few people have said\u2026\u201d turns the conversation into a hunt for the source. If you did not observe it, get the specifics first or encourage the person who did to raise it." },
              { t: "note", variant: "warn", html: "<strong>Comment on behaviour, never on identity or personality.</strong> \u201cYou interrupted twice\u201d can change by next week; \u201cyou\u2019re abrasive\u201d cannot, and it will be remembered long after the incident is forgotten." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cTell me about a time you gave difficult feedback\u201d is scored on whether your feedback was specific, timely and followed up \u2014 and whether you listened to their side before deciding what it meant." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Give a senior peer feedback about a pattern of late code reviews in four sentences: situation, behaviour, impact, and a question. Then tell it as a story using the " + COMPASS_SALT + "." },
              { t: "note", variant: "key", html: "<strong>Specific moment, observable behaviour, concrete impact, then their side.</strong> Judgement words and hearsay make people defend themselves instead of changing, and feedback with no follow-up is a single data point \u2014 so book the follow-up before you leave the room." }
            ]
          },
          {
            id: "conflict-resolution",
            title: "Resolving conflict between engineers",
            summary: "Most conflict is about goals, information or decision rights, not personality \u2014 diagnose the type before choosing the remedy.",
            minutes: 9,
            tags: ["coaching", "conflict"],
            blocks: [
              { t: "p", html: "When two engineers keep clashing, it is tempting to treat it as a personality problem and reach for a mediation or a team offsite. <strong>Most recurring conflict has a structural source</strong>: they are optimising for different goals, working from different information, or nobody has said who decides. Fix the structure and the personalities often turn out to be fine." },
              { t: "table",
                headers: ["Source", "Symptom", "The move"],
                rows: [
                  ["Different goals", "Each is right against their own objective", "Make the trade-off explicit and get it decided at the level that owns both goals"],
                  ["Different information", "Each thinks the other is ignoring something obvious", "Put both sets of facts in one document; often the conflict disappears"],
                  ["Unclear decision rights", "The same argument reopens every week", "Name a decider and who is consulted, in writing"],
                  ["Different standards", "Arguments about quality bars or review strictness", "Agree the team standard once, explicitly, rather than per pull request"],
                  ["Interpersonal", "Tension regardless of topic", "Separate conversations first, then a joint one about specific behaviours"]
                ]
              },
              { t: "ol", items: [
                "<strong>Talk to each person separately first.</strong> Restate their position until they agree you have it right.",
                "<strong>Diagnose the source.</strong> Use the table: the remedy depends entirely on which row you are in.",
                "<strong>Bring them together on interests, not positions.</strong> \u201cYou both want fewer pages\u201d is a better starting point than \u201cyou want queues and you want retries.\u201d",
                "<strong>Leave with a decision and a decider.</strong> If they cannot agree, someone decides, and the decision record names the option that lost fairly.",
                "<strong>Follow up in two weeks.</strong> Recurring conflict that stops recurring is the only evidence it was resolved."
              ] },
              { t: "code", lang: "text", code:
                "Decision rights \u2014 retry policy for provider calls\n" +
                "\n" +
                "  DECIDES      Ana (payments tech lead)\n" +
                "  CONSULTED    Ravi (platform), on-call rota\n" +
                "  INFORMED     support lead, finance ops\n" +
                "  REVISIT IF   duplicate-charge rate > 0.01% for 7 days\n" +
                "\n" +
                "The argument had reopened four times in a month.\n" +
                "It never reopened after this was written down."
              },
              { t: "note", variant: "trap", html: "<strong>Splitting the difference is not resolution.</strong> Half a queue and half a retry policy usually satisfies nobody and produces a design neither person will defend when it fails." },
              { t: "note", variant: "warn", html: "<strong>Know when it is not a disagreement.</strong> Harassment, discrimination or demeaning behaviour is a conduct issue covered by policy, and it goes to HR \u2014 mediation implies two legitimate positions, and there are not two here." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Resolves their own disagreements on evidence and escalates cleanly when they cannot."],
                  ["Senior", "Diagnoses the source of a team conflict and fixes the structure \u2014 information, goals or decision rights \u2014 rather than the symptom."],
                  ["Staff", "Prevents the class of conflict across teams with clear ownership boundaries and decision-rights conventions."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cTwo of your senior engineers don\u2019t get along\u201d or \u201cTell me about a conflict you resolved\u201d \u2014 the panel is listening for diagnosis before remedy, and for a decision rather than a compromise." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you resolved a conflict between two people on your team.\u201d Name which kind of conflict it turned out to be, and what structural change stopped it recurring. The " + COMPASS_ANATOMY + " shows how to reuse this story for ownership prompts too." },
              { t: "note", variant: "key", html: "<strong>Diagnose the source before choosing the remedy.</strong> Different goals, missing information and unclear decision rights look like personality clashes and are fixed by structure \u2014 and genuine misconduct is not a conflict to mediate at all." },
              { t: "quiz", id: "people-coaching" }
            ]
          }
        ]
      },

      /* ==================== MODULE 3 · PERFORMANCE ==================== */
      {
        id: "performance",
        name: "Performance and Careers",
        icon: "trend",
        lessons: [
          {
            id: "performance-conversations",
            title: "Performance conversations and underperformance plans",
            summary: "Diagnose clarity, capability, capacity and context first; when a formal plan is needed, design it so success is a real possibility.",
            minutes: 10,
            tags: ["performance", "underperformance"],
            blocks: [
              { t: "p", html: "The rule that governs every performance conversation is <strong>no surprises</strong>: nothing in a review or a formal plan should be the first time the person hears it. The second rule is that underperformance has causes, and the cause decides the response. A previously strong engineer who starts missing commitments is telling you something changed." },
              { t: "table",
                headers: ["Cause", "Typical signal", "Response"],
                rows: [
                  ["Clarity", "Busy, but on the wrong things", "Write the expectation down; agree what good looks like"],
                  ["Capability", "Struggles specifically in new kinds of work", "Pair, train, or rescope while the skill builds"],
                  ["Capacity", "Quality slips across everything at once", "Remove load; check on-call and interrupt share"],
                  ["Context", "Sudden change in a reliable person", "Ask, without prying; adjust while it lasts"],
                  ["Motivation or fit", "Capable, clear, and still disengaged", "Honest conversation about what they want; sometimes a different role"]
                ]
              },
              { t: "h", text: "When it becomes a formal plan" },
              { t: "ul", items: [
                "<strong>Write specific, measurable expectations.</strong> \u201cImprove ownership\u201d cannot be passed or failed; \u201cleads the next two releases to production with a rollback plan\u201d can.",
                "<strong>Time-box it realistically.</strong> Long enough to show change on real work, typically several weeks; short enough that nobody is left in limbo.",
                "<strong>Name the support.</strong> Pairing, a mentor, reduced load \u2014 a plan with no support is a countdown.",
                "<strong>Check in weekly, in writing.</strong> They should always know whether they are on track.",
                "<strong>Involve HR early.</strong> Process, documentation and local employment rules vary, and getting them wrong harms everyone involved."
              ] },
              { t: "code", lang: "text", code:
                "Improvement plan excerpt \u2014 6 weeks\n" +
                "\n" +
                "  EXPECTATION 1  own the refund-API release end to end:\n" +
                "                 design note reviewed by wk 2, shipped by wk 5\n" +
                "  EXPECTATION 2  respond to assigned reviews within 1 day\n" +
                "                 (currently 4 days median)\n" +
                "  SUPPORT        weekly pairing with Lin; interrupt rota\n" +
                "                 paused for the duration\n" +
                "  CHECK-INS      Fridays, written summary after each\n" +
                "  OUTCOME        met -> plan closes; not met -> HR-led next step"
              },
              { t: "compare",
                bad: { title: "A plan written to justify an exit", items: ["Vague expectations", "Unrealistic deadline", "No support named", "Silence until the final meeting"] },
                good: { title: "A plan designed to succeed", items: ["Measurable expectations on real work", "Realistic time box", "Named support and reduced load", "Weekly written check-ins"] }
              },
              { t: "note", variant: "trap", html: "<strong>Waiting too long is the most common failure, and the team pays for it.</strong> Everyone around an underperformer has usually noticed months before the manager acts, and every week of delay costs you credibility with the people who are carrying the gap." },
              { t: "note", variant: "warn", html: "<strong>This lesson is not legal or HR advice.</strong> Formal performance processes are governed by company policy and local law; involve your HR partner before anything is written down." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cTell me about an underperformer you managed\u201d is scored on diagnosis, timeliness and fairness \u2014 whether you found the cause, acted early, and gave them a real chance." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you managed someone who was underperforming.\u201d Name the cause you diagnosed, when you first raised it, and how it ended \u2014 including if it ended in an exit. Use the " + COMPASS_SALT + " so the landing is a clear outcome rather than a feeling." },
              { t: "note", variant: "key", html: "<strong>No surprises, and diagnose before you act.</strong> Clarity, capability, capacity and context each need a different response; when a formal plan is warranted, measurable expectations, named support and weekly check-ins are what make it fair." }
            ]
          },
          {
            id: "promotions-calibration",
            title: "Promotions, calibration and career ladders",
            summary: "Ladders describe scope and impact, not tenure; calibration compares evidence against the ladder, not people against each other.",
            minutes: 10,
            tags: ["performance", "promotion", "calibration"],
            blocks: [
              { t: "p", html: "A career ladder is a description of <strong>scope, ambiguity and influence</strong> at each level, not a list of years or technologies. A promotion recognises that someone has been operating at the next level for a sustained period \u2014 it is a statement about evidence, not a reward for effort or a retention bonus." },
              { t: "table",
                headers: ["Dimension", "Senior", "Staff"],
                rows: [
                  ["Scope", "A component or service, end to end", "A problem spanning several teams"],
                  ["Ambiguity", "Turns a defined problem into a plan", "Turns an ill-defined problem into a defined one"],
                  ["Influence", "Changes decisions inside the team", "Changes decisions in teams they do not belong to"],
                  ["Execution", "Delivers reliably and unblocks peers", "Delivers through others, and leaves standards behind"],
                  ["Evidence", "Shipped work, reviews, incidents led", "Adopted designs, cross-team outcomes, people they grew"]
                ]
              },
              { t: "h", text: "Calibration that is fair" },
              { t: "ul", items: [
                "<strong>Write evidence packets against the ladder.</strong> Specific work, its scope and its effect \u2014 not adjectives.",
                "<strong>Compare to the written standard, not to each other.</strong> Ranking people side by side rewards whoever is described most vividly.",
                "<strong>Name the biases out loud at the start.</strong> Recency, proximity to the decision-makers, and visibility of the work all distort in predictable directions.",
                "<strong>Check outcomes across groups afterwards.</strong> Individual decisions can each look reasonable while the pattern is skewed.",
                "<strong>Record the rationale, and tell people what they need to show.</strong> A \u201cnot yet\u201d with no specific gap is not feedback."
              ] },
              { t: "code", lang: "text", code:
                "Promotion packet skeleton \u2014 Senior -> Staff\n" +
                "\n" +
                "  CLAIM      has operated at staff scope for 3 quarters\n" +
                "  EVIDENCE   1. retry standard adopted by 4 teams (links)\n" +
                "             2. led cross-team cutover; zero data loss\n" +
                "             3. grew two engineers into on-call leads\n" +
                "  LADDER MAP scope: multi-team  influence: outside team\n" +
                "  GAPS       written strategy: one doc so far, not yet a habit\n" +
                "  PEERS      3 written statements from other teams"
              },
              { t: "note", variant: "trap", html: "<strong>Promotion as a retention tool sets the person up to fail.</strong> It places them at a level whose expectations they cannot yet meet, and it teaches everyone watching that an outside offer is the fastest route up." },
              { t: "note", variant: "warn", html: "<strong>Do not promise \u201cnext cycle\u201d.</strong> You rarely control calibration outright. Promise the specific gaps, the opportunities to close them, and your sponsorship \u2014 those you do control." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Understands the ladder and can say where they sit on it."],
                  ["Senior", "Writes evidence-based packets for their reports and gives specific \u201cnot yet\u201d feedback."],
                  ["Staff", "Shapes the ladder itself, runs calibration against the written standard, and checks the outcomes for skew."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you decide who gets promoted?\u201d or \u201cA high performer is threatening to leave unless promoted\u201d \u2014 both test whether you separate the evidence conversation from the retention conversation." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you disagreed with a calibration outcome.\u201d Name the evidence, the standard, and what you did after the decision \u2014 including if you accepted it. The " + COMPASS_MANAGER + " covers how these are scored in manager rounds." },
              { t: "note", variant: "key", html: "<strong>Promote on sustained evidence against a written ladder.</strong> Compare people to the standard rather than to each other, check outcomes across groups, and never use a promotion to buy retention \u2014 handle retention separately and honestly." }
            ]
          },
          {
            id: "delegation",
            title: "Delegation by decision, not by task",
            summary: "Delegate outcomes with an explicit decision level, matched to reversibility and track record \u2014 and never take it back silently.",
            minutes: 8,
            tags: ["performance", "delegation"],
            blocks: [
              { t: "p", html: "Delegating tasks keeps you as the bottleneck for every decision inside them. <strong>Delegating decisions \u2014 with an explicit level of authority \u2014 is what scales you</strong>, and what grows the person. The trouble is rarely the delegation itself; it is that the level was never said out loud, so both people assumed a different one." },
              { t: "table",
                headers: ["Level", "They", "You", "Use when"],
                rows: [
                  ["1", "Do exactly what was asked", "Specify the how", "Brand-new to the area; the cost of error is high"],
                  ["2", "Research options and recommend", "Decide", "Building judgement on an unfamiliar decision"],
                  ["3", "Decide, and tell you before acting", "Can veto before the irreversible step", "One-way doors with a capable owner"],
                  ["4", "Decide and act, tell you after", "Review outcomes, not choices", "Reversible decisions with a good track record"],
                  ["5", "Own it completely", "Hear about it in the normal cadence", "Their area, their call"]
                ]
              },
              { t: "ul", items: [
                "<strong>Say the level explicitly.</strong> \u201cThis is a level 3: make the call, but walk me through it before we sign.\u201d",
                "<strong>Match the level to reversibility, not to how much you care.</strong> A reversible decision at level 2 just slows everyone down.",
                "<strong>Raise the level as trust builds.</strong> And say when you have \u2014 people do not notice an unspoken promotion of authority.",
                "<strong>If you must take a decision back, say so and say why.</strong> Silent overrides teach people that the level was never real."
              ] },
              { t: "code", lang: "text", code:
                "Delegation brief \u2014 observability vendor selection\n" +
                "\n" +
                "  OUTCOME     a contract signed by end of Q1 that cuts\n" +
                "              log costs >= 30% with no loss of retention\n" +
                "  OWNER       Ravi\n" +
                "  LEVEL       3 \u2014 Ravi decides; I see the recommendation\n" +
                "              before signature (one-way door: 2-yr term)\n" +
                "  CONSTRAINTS budget cap; security review required\n" +
                "  CHECK-IN    fortnightly 15 min, plus before signing"
              },
              { t: "compare",
                bad: { title: "Delegation that backfires", items: ["\u201cCan you take care of this?\u201d", "Level never stated", "Manager rewrites the outcome at the end", "Owner learns not to decide next time"] },
                good: { title: "Delegation that scales", items: ["Outcome, owner and constraints written down", "Level stated and matched to reversibility", "Check-ins on a cadence, not by ambush", "Overrides explained, rarely needed"] }
              },
              { t: "note", variant: "trap", html: "<strong>Snatching the work back near the deadline is the most expensive delegation mistake.</strong> It saves one decision and teaches the person \u2014 and everyone watching \u2014 that ownership here is provisional." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you scale yourself?\u201d, \u201cWhat do you delegate and what do you keep?\u201d, or \u201cTell me about a time a delegated project went wrong\u201d all hinge on whether you set the decision level explicitly." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Name one decision you would delegate at level 4 and one you would keep at level 3, and explain the difference using reversibility rather than importance." },
              { t: "note", variant: "key", html: "<strong>Delegate decisions with an explicit level, matched to reversibility.</strong> Unspoken levels are why delegation fails; saying the level, raising it as trust builds, and explaining any override is what turns delegation into growth instead of confusion." },
              { t: "quiz", id: "people-performance" }
            ]
          }
        ]
      },

      /* ==================== MODULE 4 · ORG ==================== */
      {
        id: "org",
        name: "Teams, Stakeholders and Culture",
        icon: "blocks",
        lessons: [
          {
            id: "team-health",
            title: "Team shape, cognitive load and distance",
            summary: "Teams are the unit of delivery; size their ownership to their cognitive budget, cut boundaries to minimise handoffs, and design for time zones.",
            minutes: 11,
            tags: ["org", "team-design", "remote"],
            blocks: [
              { t: "p", html: "Your system\u2019s architecture and your org chart tend to converge \u2014 whichever one you design, the other bends to match. That makes <strong>team boundaries an architecture decision</strong>. The two variables that matter most are how much a team owns relative to what it can hold in its head, and how many other teams it must wait on to ship." },
              { t: "table",
                headers: ["Team kind", "Purpose", "Healthy interaction", "Smell"],
                rows: [
                  ["Stream-aligned", "Owns a user-facing flow end to end", "Consumes platforms as a service", "Waits on other teams for most changes"],
                  ["Platform", "Makes common capabilities self-service", "Treats other teams as customers", "Ticket queue instead of a product"],
                  ["Enabling", "Helps other teams adopt a practice, then leaves", "Time-boxed collaboration", "Becomes a permanent dependency"],
                  ["Specialist subsystem", "Owns a part needing rare expertise", "Clear, stable interface", "Every change needs their review"]
                ]
              },
              { t: "widget", id: "tm-team-health" },
              { t: "h", text: "Signals of overload" },
              { t: "ul", items: [
                "<strong>Services nobody has touched in a quarter.</strong> Ownership on paper only; the next incident in one of them will be slow.",
                "<strong>Most features need another team.</strong> Handoffs are queues, and coordination only makes the queue visible.",
                "<strong>On-call dominates the week.</strong> Roadmap work stalls, and the people who know the system best burn out first.",
                "<strong>Unplanned work above a third.</strong> At that point the plan is fiction and the team knows it."
              ] },
              { t: "h", text: "Distance changes the defaults" },
              { t: "table",
                headers: ["Practice", "Why it matters across time zones"],
                rows: [
                  ["Written proposals and decision logs by default", "With two hours of overlap, anything needing a meeting waits a day"],
                  ["Overlap hours reserved for discussion, not status", "Status travels fine in writing; disagreement does not"],
                  ["Rotate meeting times", "Otherwise the same people always pay the late-night cost"],
                  ["Align ownership with location where possible", "A component owned across three time zones has a twelve-hour review loop"],
                  ["Hand-offs written at the end of each day", "Follow-the-sun only works if the next person can start without asking"]
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Splitting a team by function across time zones \u2014 backend here, frontend there \u2014 builds a handoff into every feature.</strong> Split by ownership of a flow instead, so each location can ship something on its own." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cYour team is always blocked\u201d, \u201cOn-call is burning people out\u201d, or \u201cYou are inheriting a team in two countries\u201d \u2014 start with ownership, handoffs and load before you reach for process." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A seven-person team owns eleven services and needs two other teams for most features. Recommend one structural change and say what it costs." },
              { t: "note", variant: "key", html: "<strong>Team boundaries are architecture.</strong> Size ownership to the team\u2019s cognitive budget, cut boundaries so the common change lives in one team, and across time zones make writing the default \u2014 process cannot compensate for a boundary that is simply in the wrong place." }
            ]
          },
          {
            id: "managing-up",
            title: "Managing up and across",
            summary: "Your manager and peers are stakeholders: know their goals, never surprise them, and escalate early with options and a recommendation.",
            minutes: 9,
            tags: ["org", "stakeholders", "managing-up"],
            blocks: [
              { t: "p", html: "Managing up is not flattery or politics; it is <strong>making it easy for the people above and beside you to make good decisions</strong> about your work. That means knowing what they are measured on, giving them bad news early, and arriving with options rather than problems." },
              { t: "table",
                headers: ["Stakeholder", "What they need from you", "Cadence"],
                rows: [
                  ["Your manager", "No surprises; early risk; decisions framed with options", "Weekly written update plus 1:1"],
                  ["Peer managers", "Dependencies and dates you will actually hit", "On change, and at planning"],
                  ["Product partner", "Trade-offs in their language: scope, date, risk", "Continuously; shared planning"],
                  ["Skip-level and executives", "Outcome, risk and the ask, in a paragraph", "On milestones and escalations"],
                  ["Dependent teams", "Notice before you change anything they rely on", "Before every breaking change"]
                ]
              },
              { t: "ul", items: [
                "<strong>Learn what your manager is measured on.</strong> Framing your problem in terms of their goals is not manipulation; it is relevance.",
                "<strong>Send a short written update weekly.</strong> Progress, risks, decisions needed. It replaces a dozen ad-hoc questions.",
                "<strong>Escalate early, with options and a recommendation.</strong> An escalation is a request for a decision, not a complaint.",
                "<strong>Disagree in the room, then commit visibly.</strong> Relitigating a lost decision in the corridor costs more trust than losing it."
              ] },
              { t: "code", lang: "text", code:
                "Escalation note \u2014 3-week slip on the provider migration\n" +
                "\n" +
                "  WHAT      date moves from 14 Nov to 5 Dec\n" +
                "  WHY       provider sandbox lacks refund API; found wk 6\n" +
                "  OPTIONS   A) hold date, ship without refunds (manual ops)\n" +
                "            B) move date 3 weeks, ship complete\n" +
                "            C) hold date, add 2 engineers (risky: ramp time)\n" +
                "  RECOMMEND B \u2014 manual refunds at our volume need 1.5 FTE\n" +
                "  ASK       your decision by Thursday; I'll tell sales"
              },
              { t: "compare",
                bad: { title: "Escalation as complaint", items: ["\u201cWe\u2019re blocked by platform again\u201d", "No options", "Raised after the date has passed", "Blames another team"] },
                good: { title: "Escalation as decision request", items: ["What changed and why", "Two or three options with costs", "A recommendation", "A specific ask and a deadline"] }
              },
              { t: "note", variant: "trap", html: "<strong>Shielding the team by withholding bad news from above backfires.</strong> Your manager finds out later, from someone else, with fewer options \u2014 and the team loses the cover you were trying to give it." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cTell me about a time you disagreed with your manager\u201d or \u201cHow do you handle a stakeholder who keeps changing priorities?\u201d \u2014 both test whether you escalate with options and commit once a decision is made." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you pushed back on a senior leader.\u201d Name the decision, your options, the outcome, and \u2014 if you lost \u2014 how you committed. The " + COMPASS_SALT + " keeps the landing on the outcome." },
              { t: "note", variant: "key", html: "<strong>Make the people above and beside you able to decide well.</strong> Know their goals, never surprise them, and escalate early as a request for a decision \u2014 with options, a recommendation and a deadline \u2014 then commit visibly when it goes against you." }
            ]
          },
          {
            id: "burnout-reorgs",
            title: "Burnout, reorgs and leading when capacity drops",
            summary: "Burnout is a load and control problem; a reorg is a trust event. Lead both by removing work and saying what you know and do not know.",
            minutes: 10,
            tags: ["org", "burnout", "reorg"],
            blocks: [
              { t: "p", html: "Burnout and reorgs look like different problems, but they share a cause and a failure. The cause is <strong>sustained pressure with too little control over it</strong>. The failure is responding with messaging instead of changes \u2014 a wellness session for an overloaded team, or a cheerful announcement for a reorg nobody understands." },
              { t: "table",
                headers: ["Signal", "What it usually means", "What actually helps"],
                rows: [
                  ["Strong people going quiet in meetings", "Withdrawal; they have stopped expecting to be heard", "Ask directly in a 1:1; act on one thing they say"],
                  ["Messages late at night as a habit", "The day is all interrupts; real work moved to evenings", "Cut interrupts; protect focus blocks"],
                  ["Cynical jokes about the roadmap", "The plan has lost credibility", "Remove work visibly and say what was cut"],
                  ["Sick days rising on one rota", "On-call load is unsustainable", "Fix the top alert sources; add people to the rota"]
                ]
              },
              { t: "ul", items: [
                "<strong>Remove work; do not add wellness on top.</strong> Defer a project and say so publicly. That is the signal people believe.",
                "<strong>Give back control.</strong> Let the team choose what gets cut, or how on-call is shared.",
                "<strong>Model it.</strong> If you send messages at midnight, your team will read them as expectations whatever you say."
              ] },
              { t: "h", text: "Leading through a reorg" },
              { t: "ol", items: [
                "<strong>Understand the why before you announce.</strong> If you cannot explain the reason in two sentences, you are not ready to tell your team.",
                "<strong>Say what changes, what does not, and what is still unknown.</strong> The unknown list is the part people trust you for.",
                "<strong>Hold 1:1s within two days.</strong> Everyone\u2019s first question is about themselves, and a group meeting cannot answer it.",
                "<strong>Rebuild the ownership map.</strong> Reorgs orphan services and on-call responsibilities silently.",
                "<strong>Watch attrition for the next quarter.</strong> The people with the most options leave first, and they rarely say why."
              ] },
              { t: "code", lang: "text", code:
                "Reorg announcement skeleton\n" +
                "\n" +
                "  WHY        payments and billing teams merge so refunds\n" +
                "             stop needing two roadmaps to ship\n" +
                "  CHANGES    reporting line for 6 people; one planning cycle\n" +
                "  UNCHANGED  your projects this quarter; on-call rota; levels\n" +
                "  UNKNOWN    final team names; who owns invoicing service\n" +
                "             (decision by 15 Nov, I will tell you that day)\n" +
                "  NEXT       1:1 with each of you by Thursday"
              },
              { t: "note", variant: "trap", html: "<strong>Spinning a reorg as purely positive, or blaming leadership for it, both cost you.</strong> The first sounds like you have not noticed what people are losing; the second tells your team you will not defend decisions you are part of." },
              { t: "note", variant: "warn", html: "<strong>Never promise \u201cno more changes\u201d.</strong> You do not control it, and the next reorg will make you the person who said it." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cYour team is exhausted after a hard quarter\u201d or \u201cTell me about leading a team through a reorg\u201d \u2014 the strong answer removes work or states the unknowns, rather than managing morale with messaging." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time your team was burning out.\u201d Name the specific work you removed and what it cost the roadmap. Shape the story with the " + COMPASS_ANATOMY + " so it also answers prioritisation prompts." },
              { t: "note", variant: "key", html: "<strong>Change the load, not the messaging.</strong> Burnout is fixed by removing work and returning control; a reorg is led by stating what changes, what does not and what is still unknown \u2014 then talking to every person individually within days." }
            ]
          },
          {
            id: "quality-culture",
            title: "Building a security and quality culture",
            summary: "Culture is what gets rewarded and what is easy. Make the safe path the default path, and thank the people who report problems.",
            minutes: 9,
            tags: ["org", "culture", "security", "quality"],
            blocks: [
              { t: "p", html: "Every team says it values quality and security. Culture is what happens when those values cost something: <strong>what gets rewarded, what is easy, and what happens to the person who reports a mistake</strong>. You build it by changing defaults and incentives, not by posters or annual training." },
              { t: "table",
                headers: ["Lever", "Example", "Why it works"],
                rows: [
                  ["Secure and tested by default", "Service template ships with auth, secrets handling, tests and alerts", "The easy path and the right path are the same path"],
                  ["Visible signals", "Escaped defects and dependency age on the team dashboard", "What is measured in the open gets discussed"],
                  ["Celebrated catches", "Public thanks for the engineer who found a vulnerability in review", "Rewards the behaviour you want repeated"],
                  ["Blameless reviews", "Postmortems on system gaps, not individual fault", "People report early when reporting is safe"],
                  ["Embedded champions", "One engineer per team with time to steward security practices", "Expertise sits where decisions are made"],
                  ["Gates that are checks, not opinions", "Pipeline blocks on a failed dependency scan with a written waiver path", "Consistent, fast, and honest about exceptions"]
                ]
              },
              { t: "ul", items: [
                "<strong>Fix the paved road first.</strong> If the secure way is slower, people will route around it under deadline, and they will be right to.",
                "<strong>Budget time explicitly.</strong> Security and quality work with no capacity attached is a wish.",
                "<strong>Respond to bad news with gratitude.</strong> The first incident report after you thank someone sets the pattern for the next year.",
                "<strong>Make exceptions written and time-limited.</strong> A waiver with an owner and an expiry is honest; a quiet bypass is not."
              ] },
              { t: "compare",
                bad: { title: "Compliance theatre", items: ["Annual training, then nothing", "Gates people bypass with a flag", "Incidents trigger a hunt for who did it", "Security owns security"] },
                good: { title: "A culture that holds", items: ["Secure, tested templates by default", "Gates with a written, expiring waiver", "Blameless reviews that fix the system", "Every team owns its own risk, with champions"] }
              },
              { t: "note", variant: "trap", html: "<strong>Punishing the person who reported their own mistake is the fastest way to destroy a quality culture.</strong> It teaches everyone that the safe move is to wait until someone else notices." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Follows the team\u2019s practices and raises problems they find."],
                  ["Senior", "Makes the secure, tested path the default in their area and runs blameless reviews."],
                  ["Staff", "Changes incentives and defaults across an org, and can show the trend in escaped defects or findings moving."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you get engineers to care about security?\u201d or \u201cAn engineer caused an outage \u2014 what do you do?\u201d Both are asking what you reward and what you make easy." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you raised the quality bar on a team.\u201d Name the default you changed, the metric that moved, and the exception process you kept." },
              { t: "note", variant: "key", html: "<strong>Culture is defaults and incentives.</strong> Make the secure, tested path the easiest one, put the signals where everyone can see them, and thank the person who reports a mistake \u2014 every other quality initiative depends on that last one." },
              { t: "quiz", id: "people-org" }
            ]
          }
        ]
      }
    ]
  };
})();
