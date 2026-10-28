/* =====================================================================
   COMPASS · Story Bank & Playbooks
   window.TRACKS.story — engineering the raw material behind every
   behavioral answer, plus adapting one catalog to different loop styles.
   Owns: quizzes story-catalog / story-playbooks,
         widgets storyMatrix / storyDrill.
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     DOM helpers (local to this file, ES5-safe)
  ------------------------------------------------------------------ */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  }

  /* segmented control: labels + a picker callback, first item active */
  function seg(labels, onPick) {
    var wrap = h("div", { class: "w-seg" });
    function bind(button, idx) {
      button.addEventListener("click", function () {
        var all = wrap.querySelectorAll("button");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
        button.classList.add("active");
        onPick(idx);
      });
    }
    for (var i = 0; i < labels.length; i++) {
      var b = h("button", { class: "w-seg-btn" + (i === 0 ? " active" : ""), type: "button" }, labels[i]);
      bind(b, i);
      wrap.appendChild(b);
    }
    return wrap;
  }

  function btn(label, cls, onClick) {
    return h("button", { class: "w-btn " + (cls || ""), type: "button", onclick: onClick }, label);
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  var Widgets = {};

  /* ==================================================================
     WIDGET 1 · storyMatrix — where is your bank thin?
  ================================================================== */
  var MX_SIGNALS = [
    "Ownership", "Scope & impact", "Collaboration", "Conflict",
    "Ambiguity", "Delivery pressure", "Growth", "Influence"
  ];

  /* what you would go and get if this column is empty */
  var MX_FILL = [
    "a problem nobody owned that you picked up and closed",
    "a decision whose blast radius reached past your own service",
    "a story where the hard part was other people's schedules, not the code",
    "a disagreement with a named colleague where the relationship survived",
    "a call you made with information missing, plus the tripwire you set",
    "a delivery where you cut something and told the sponsor early",
    "a failure with a real cost and a change you can point at",
    "a change adopted by people who did not report to you"
  ];

  /* signals ranked by how often a loop asks for them, most first */
  var MX_PRIORITY = [3, 6, 2, 7, 4, 0, 1, 5];

  var MX_BASE4 = [
    { n: "Gateway migration", s: [1, 4, 5] },
    { n: "Search latency fix", s: [0, 1, 5] },
    { n: "Onboarding revamp", s: [2, 7] },
    { n: "Flaky test cleanup", s: [0] }
  ];
  var MX_BASE7 = MX_BASE4.concat([
    { n: "Incident postmortem", s: [0, 5, 6] },
    { n: "Design review pushback", s: [3, 7] },
    { n: "Cross-team API contract", s: [2, 3, 7] }
  ]);
  var MX_PRESETS = [
    {
      label: "4 stories",
      blurb: "A starter bank: two project stories, one people story, one clean-up.",
      stories: MX_BASE4
    },
    {
      label: "7 stories",
      blurb: "The starter bank plus an incident, a design-review disagreement and a cross-team contract.",
      stories: MX_BASE7
    },
    {
      label: "10 stories",
      blurb: "Seven, plus an unowned problem, a failure with a cost, and a mentoring story.",
      stories: MX_BASE7.concat([
        { n: "Unowned billing alerts", s: [0, 4, 7] },
        { n: "Launch called too late", s: [5, 6] },
        { n: "Mentoring a struggling teammate", s: [2, 6, 7] }
      ])
    },
    {
      label: "Project-heavy",
      blurb: "Four large project stories and nothing else — the most common real bank.",
      stories: [
        { n: "Platform re-architecture", s: [1, 4, 5] },
        { n: "Multi-region rollout", s: [1, 5] },
        { n: "Cost reduction program", s: [0, 1, 5] },
        { n: "Data model migration", s: [1, 4] }
      ]
    }
  ];

  function mxCount(stories) {
    var counts = [0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < stories.length; i++) {
      var s = stories[i].s || [];
      for (var j = 0; j < s.length; j++) {
        if (s[j] >= 0 && s[j] < counts.length) counts[s[j]]++;
      }
    }
    return counts;
  }

  function mxFirstByPriority(counts, want) {
    for (var i = 0; i < MX_PRIORITY.length; i++) {
      var idx = MX_PRIORITY[i];
      if (counts[idx] === want) return idx;
    }
    return -1;
  }

  Widgets.storyMatrix = function (mount) {
    shell(mount, "coverage grid", "Where is your bank thin?",
      "Pick a bank and the grid recomputes which signals are covered, which run on a single story, and which are missing entirely. The verdict names the one story worth going and getting next.");

    var picker = seg(["4 stories", "7 stories", "10 stories", "Project-heavy"], function (i) { paint(i); });
    var blurb = h("p", { class: "widget-desc" }, "");
    var list = h("div", { style: "font-size:0.78rem;line-height:1.7;margin-bottom:14px" });
    var grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px" });
    var readout = h("div", { class: "w-readout" });
    var verdict = h("p", { style: "margin-top:14px;font-size:0.85rem;line-height:1.65" }, "");

    var stage = h("div", { class: "w-stage" }, list, grid);
    mount.appendChild(h("div", { style: "margin-bottom:14px" }, picker));
    mount.appendChild(blurb);
    mount.appendChild(stage);
    mount.appendChild(readout);
    mount.appendChild(verdict);

    function row(name, count) {
      var state = count === 0 ? "no story" : (count === 1 ? "single story" : count + " stories");
      var color = count === 0 ? "#fb7185" : (count === 1 ? "#fbbf24" : "#34d399");
      var pips = h("span", { style: "letter-spacing:2px;color:oklch(from " + color + " var(--ink-l) c h)" });
      pips.appendChild(document.createTextNode(count === 0 ? "···" : (count === 1 ? "•··" : (count === 2 ? "••·" : "•••"))));
      return h("div", {
        style: "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;" +
               "border:1px solid " + color + "55;border-radius:9px;font-size:0.8rem"
      },
        h("span", {}, name),
        h("span", { style: "display:flex;align-items:center;gap:8px" },
          pips,
          h("span", { style: "color:oklch(from " + color + " var(--ink-l) c h);font-size:0.72rem" }, state)));
    }

    function paint(i) {
      var preset = MX_PRESETS[i] || MX_PRESETS[0];
      var stories = preset.stories || [];
      var counts = mxCount(stories);

      blurb.textContent = preset.blurb;

      clear(list);
      var names = [];
      for (var s = 0; s < stories.length; s++) names.push(stories[s].n);
      list.appendChild(h("span", { style: "opacity:0.72" }, "bank: "));
      list.appendChild(document.createTextNode(names.join(" · ")));

      clear(grid);
      for (var g = 0; g < MX_SIGNALS.length; g++) grid.appendChild(row(MX_SIGNALS[g], counts[g]));

      var covered = 0, thin = 0, gaps = 0;
      for (var c = 0; c < counts.length; c++) {
        if (counts[c] === 0) gaps++;
        else if (counts[c] === 1) thin++;
        else covered++;
      }

      clear(readout);
      readout.appendChild(ro("covered", covered));
      readout.appendChild(ro("single-story", thin));
      readout.appendChild(ro("uncovered", gaps));
      readout.appendChild(ro("stories", stories.length));

      var pick = mxFirstByPriority(counts, 0);
      var text;
      if (pick >= 0) {
        text = gaps + " of the eight signals have nothing behind them" +
          (gaps >= 4 ? ", and every one of them is a people signal — a fifth project story adds no coverage at all. " : ". ") +
          "Highest-value addition: " + MX_FILL[pick] + " (" + MX_SIGNALS[pick] + ").";
      } else {
        var thinPick = mxFirstByPriority(counts, 1);
        if (thinPick >= 0) {
          text = "No empty columns, but " + thin + " signal" + (thin === 1 ? "" : "s") +
            " rest on a single story — spend one early and a later interviewer scoring the same signal gets nothing. " +
            "Highest-value addition: " + MX_FILL[thinPick] + " (" + MX_SIGNALS[thinPick] + ").";
        } else {
          text = "Every signal has at least two options behind it. Story eleven buys you almost nothing now; " +
            "the marginal hour goes into surviving the follow-ups on what you already have.";
        }
      }
      clear(verdict);
      verdict.appendChild(h("strong", {}, "Verdict. "));
      verdict.appendChild(document.createTextNode(text));
    }

    paint(0);
  };

  /* ==================================================================
     WIDGET 2 · storyDrill — survive the follow-ups
  ================================================================== */
  var DRILL_TAGS = [
    "probe 1 · your contribution",
    "probe 2 · the option you rejected",
    "probe 3 · the measurement"
  ];

  var DRILLS = [
    {
      label: "Migration",
      opening: "\"We moved payments off the legacy gateway last year and cut failed checkouts by about a third.\"",
      probes: [
        { q: "Who decided to run a shadow period instead of a big-bang cutover?",
          want: "A first-person sentence, plus what you did not own. \"I chose the shadow window; the platform team owned the cluster.\"" },
        { q: "What was the option you argued against, and what would have made you pick it?",
          want: "The fork, named, and the condition that would have flipped you. That is what separates judgement from luck." },
        { q: "A third of what, measured how, over what window?",
          want: "A baseline, a window, and someone other than you who saw the number." }
      ],
      verdict: "This one holds only if your journal kept the rejected cutover plan and the before/after window. Most candidates lose it at probe 3, because the number lived in a dashboard nobody kept."
    },
    {
      label: "Design review",
      opening: "\"I pushed back on a design in review and we ended up changing the storage model.\"",
      probes: [
        { q: "What did you actually say, and what did the author say back?",
          want: "Their argument stated fairly enough that they would recognise it. If you cannot, the interviewer concludes you never understood it." },
        { q: "What did you concede?",
          want: "A real concession. Pushback with nothing given up usually means you missed the constraint they were solving for." },
        { q: "How did the change turn out — and would the original design actually have failed?",
          want: "An honest answer, including \"probably it would have been fine, but it would have cost us X later.\"" }
      ],
      verdict: "A conflict story is scored on the relationship and on whether you can argue the other side. With no concession and no after-state, this reads as someone who wins arguments, which is not the same as a colleague."
    },
    {
      label: "Billing alerts",
      opening: "\"Nobody owned our billing alerts, so I took them over and got the page volume down.\"",
      probes: [
        { q: "Was taking it on your idea, or were you asked?",
          want: "The honest answer, plus the part you extended past the ask. Ownership lives in the gap between the two." },
        { q: "What did you decide not to do, and what did you drop to make room?",
          want: "A trade-off. Nobody adds work for free; the thing you stopped doing is evidence you were choosing, not just busy." },
        { q: "Down from what to what — and did anything get missed after you tuned them?",
          want: "Both halves. Volunteering the one alert you tuned too aggressively is worth more than a clean number." }
      ],
      verdict: "Ownership stories live or die on probe 1. \"My manager suggested it\" turns this into an assignment — the fix is not to lie but to name what you extended. Probe 3 is where an alert-tuning story can quietly backfire."
    },
    {
      label: "Late launch",
      opening: "\"I called a launch go when I shouldn't have, and we spent two weeks rolling back.\"",
      probes: [
        { q: "Whose decision was it, formally?",
          want: "Yours, said plainly. A failure story where the decision belonged to someone else is not a failure story." },
        { q: "What signal did you have at the time that you discounted?",
          want: "The specific thing you saw and waved past. This is the sentence a rehearsed failure story never has." },
        { q: "What did the two weeks cost, and what changed in how you run a go/no-go now?",
          want: "A cost, and a change that is checkable — a rule, a document, a veto someone else now holds." }
      ],
      verdict: "Failure stories are the easiest to hollow out. Probe 2 is the honest one; probe 3 needs a change someone could verify, because \"I learned to communicate better\" is unfalsifiable and scores as nothing."
    }
  ];

  Widgets.storyDrill = function (mount) {
    shell(mount, "follow-up drill", "Survive the follow-ups",
      "Pick an opening line, then press further. The same three probes run on every story — contribution, then the option you rejected, then the measurement — because that is the order a real interviewer uses.");

    var si = 0, step = 0;

    var picker = seg(["Migration", "Design review", "Billing alerts", "Late launch"], function (i) {
      si = i; step = 0; paint();
    });
    var opening = h("p", { style: "font-size:0.92rem;line-height:1.7;margin:0" }, "");
    var readout = h("div", { class: "w-readout" });
    var detail = h("p", { style: "margin-top:12px;font-size:0.85rem;line-height:1.65" }, "");
    var stage = h("div", { class: "w-stage" }, opening, readout, detail);

    var further = btn("Press further", "primary", function () {
      if (step < 3) step++;
      paint();
    });
    var reset = btn("Reset", "ghost", function () { step = 0; paint(); });

    mount.appendChild(h("div", { style: "margin-bottom:14px" }, picker));
    mount.appendChild(stage);
    mount.appendChild(h("div", { style: "display:flex;gap:10px;margin-top:14px" }, further, reset));

    function paint() {
      var d = DRILLS[si] || DRILLS[0];
      opening.textContent = d.opening;

      clear(readout);
      clear(detail);

      if (step >= 3) {
        readout.appendChild(h("span", { class: "ro" },
          "verdict ", h("b", { style: "color:oklch(from #fbbf24 var(--ink-l) c h)" }, "3 of 3 probes answered")));
        detail.appendChild(h("strong", {}, "What the story needed. "));
        detail.appendChild(document.createTextNode(d.verdict));
        further.textContent = "No probes left";
        further.disabled = true;
        return;
      }

      var p = d.probes[step];
      readout.appendChild(h("span", { class: "ro" },
        DRILL_TAGS[step] + " ", h("b", {}, (step + 1) + "/3")));
      readout.appendChild(h("span", { class: "ro" }, "\u201c" + p.q + "\u201d"));
      detail.appendChild(h("strong", {}, "A good answer supplies: "));
      detail.appendChild(document.createTextNode(p.want));
      further.textContent = step === 2 ? "Show verdict" : "Press further";
      further.disabled = false;
    }

    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     QUIZZES
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "story-catalog": {
      title: "Story bank checkpoint",
      sub: "Capture, anatomy, scope evidence, and the shapes that prove ownership, conflict and growth.",
      questions: [
        {
          q: "You expect to interview in about eight months. Which habit produces the strongest bank?",
          options: [
            "Draft ten polished stories now and rehearse them weekly until the loop",
            "Wait until the loop is scheduled, then mine your résumé in one long sitting",
            "Ask your manager to write up your best projects in your next review",
            "Spend ten minutes a week logging anything that had a real fork in it"
          ],
          answer: 3,
          explain: "The scarce resource is not writing time, it is memory: exact numbers, the option you rejected and who pushed back all decay within weeks. Weekly capture keeps them recoverable for almost no cost, while polishing ten stories eight months early spends effort on stories you may never use. A single mining session can only recover whatever happened to survive."
        },
        {
          q: "What makes one story able to answer four or five different prompts?",
          options: [
            "It contains a real fork, an isolated contribution and a measured result, so different facets can be foregrounded",
            "It is long enough to fill the answer slot without needing follow-ups",
            "It involves a technology the interviewer is likely to recognise",
            "It ends with a lesson general enough to apply to any job"
          ],
          answer: 0,
          explain: "Reusability comes from having several load-bearing parts, not from length or subject matter. Because the story contains a decision, a first-person contribution and a number, you can re-point the opening line and expand a different twenty seconds for each prompt. A deliberately generic closing lesson does the opposite — it makes every version sound identical."
        },
        {
          q: "A candidate changed one service's cache policy but describes it as leading a company-wide latency effort. What is the real cost when the interviewer probes?",
          options: [
            "Nothing — interviewers expect candidates to frame their work confidently",
            "The seam shows, and the interviewer starts discounting the other answers too",
            "The claim is simply re-scored down to the rung it actually deserves",
            "It still scores higher, because scope is the signal that drives level"
          ],
          answer: 1,
          explain: "Two ordinary follow-ups — who owned rollout in the other services, what did you personally decide — are enough to expose an inflated rung. The damage is not the lost point on that story; it is that one caught exaggeration makes every other unverifiable claim in the loop look unreliable. Accurate framing at the true rung outscores a claim that collapses."
        },
        {
          q: "Which of these is the weakest ownership story?",
          options: [
            "You picked up a project after its lead left and cut its scope so it could ship",
            "You noticed an alerting gap nobody owned, fixed it, and got it permanently staffed",
            "You were assigned a migration, planned it carefully and delivered it on time",
            "You did the test cleanup nobody wanted, and build failures dropped"
          ],
          answer: 2,
          explain: "Delivering an assignment well is competence, and the technical rounds already measure that. Ownership shows in the gap between what you were told to do and what you actually did — an unclaimed problem, a scope cut you decided, or work nobody would have noticed you skipping."
        },
        {
          q: "In a conflict story, which element do candidates most often leave out of the result?",
          options: [
            "The technical detail of what was being argued about",
            "Evidence that their position turned out to be the correct one",
            "The seniority of the person they disagreed with",
            "What happened to the working relationship afterwards"
          ],
          answer: 3,
          explain: "The round is checking whether you can disagree and still have a colleague on the other side, so the relationship is part of the result rather than an afterthought. \"I was right and they stopped inviting me to reviews\" scores badly even when the technical call was correct."
        },
        {
          q: "Which failure story is most likely to hurt the candidate who tells it?",
          options: [
            "A mislabelled chart in a deck, corrected the following morning",
            "A go/no-go call they got wrong, costing two weeks of rollback",
            "A design they pushed through that had to be rewritten a year later",
            "A hire that did not work out, which they then had to unwind"
          ],
          answer: 0,
          explain: "A failure with no cost signals that the candidate has never owned anything with real downside, which makes it a scope answer as much as a growth answer. Interviewers read the size of the failure you are willing to discuss as a proxy for the size of the decisions you have been trusted with."
        },
        {
          q: "Your grid shows seven stories and no empty columns, but growth is covered by exactly one story. What is the risk?",
          options: [
            "None — one solid story per signal is the target",
            "If it gets spent early or probed hard, you have nothing left for that signal",
            "You will run short of material inside a single answer",
            "The interviewer will notice that your bank is unbalanced"
          ],
          answer: 1,
          explain: "A single-covered signal is a single point of failure: use it in round one and a later interviewer scoring the same signal gets nothing. Nobody ever sees your grid, so the imbalance itself is invisible — the real exposure is having no second option for a signal that almost every loop asks about."
        },
        {
          q: "A résumé bullet reads \"Improved pipeline performance 10×\". In the deep-dive, which follow-up is this line most exposed to?",
          options: [
            "\"Which programming language did you use?\"",
            "\"Ten times on what, measured over which window, and what was the baseline?\"",
            "\"Who else was on the team?\"",
            "\"Why did you leave that company?\""
          ],
          answer: 1,
          explain: "An unanchored multiplier invites the baseline question first. If you cannot state what was measured, over what window and from what starting point, the number costs more credibility than it earned — use the figure you can reconstruct, with its window."
        },
        {
          q: "Which project should you prepare for a full-hour deep-dive?",
          options: [
            "The one with the most famous product name",
            "The most recent one, whatever it was",
            "The one where you personally made the most consequential decisions and can defend each alternative you rejected",
            "The largest team you were part of"
          ],
          answer: 2,
          explain: "Deep-dives score judgement, so the best project is the one with real forks that were yours. A famous name or a big team gives the interviewer nothing to probe if your own decisions in it were small."
        }
      ]
    },

    "story-playbooks": {
      title: "Playbooks checkpoint",
      sub: "Large-company loops, principle-based rubrics, small companies, the manager round, and drills.",
      questions: [
        {
          q: "Why is repeating one story across three rounds riskier in a large-company loop than in a two-round startup process?",
          options: [
            "Interviewers compare notes with each other during the day",
            "Most large companies have an explicit rule against reusing stories",
            "Written feedback is pooled afterwards, so the repetition is visible to people who never met you",
            "A story loses persuasive force each time it is retold"
          ],
          answer: 2,
          explain: "Each interviewer writes up the round independently, and the record is then read by a committee or hiring manager who never sat in any of the rooms. Repetition that felt invisible in the moment is obvious in the aggregate, and it reads as a thin bank rather than coincidence. Saying out loud that you may be covering ground twice is what turns it into organisation instead."
        },
        {
          q: "You are in a loop scored against a published list of named principles. Which move reads worst?",
          options: [
            "Telling a story that plainly demonstrates the principle without ever naming it",
            "Using one story as evidence for two related principles",
            "Asking at the start which areas this round will cover",
            "Naming the principle back verbatim and then telling a thin story"
          ],
          answer: 3,
          explain: "The interviewer's form already has the principle written on it; what it lacks is evidence. Quoting the name signals that you studied the list, and it sets an expectation the thin story immediately fails to meet. Demonstrating the behaviour and letting them file it under whichever principle they like is strictly stronger."
        },
        {
          q: "One of the company's principles matches nothing in your bank. What is the best move?",
          options: [
            "Use your nearest real evidence and be explicit about its actual scale",
            "Combine two real projects into one story that covers the principle properly",
            "Explain how you would apply the principle in the role going forward",
            "Redirect to your strongest story and hope the topic does not come back"
          ],
          answer: 0,
          explain: "A small true story survives probing; a composite does not, because the timeline stops being consistent about two questions in. Naming the true scale — \"this was one team, not the org\" — costs you a little on that principle and protects your credibility everywhere else. A forward-looking hypothetical is a last resort, not an opening move."
        },
        {
          q: "A large-company engineer is interviewing at a twenty-person startup. Which re-angle of an existing story helps most?",
          options: [
            "More architectural depth, to establish technical strength early",
            "The runbook they wrote, the pager they carried and the customers they called themselves",
            "The approvals and review gates they navigated to get it shipped",
            "The traffic volumes the system handled at peak"
          ],
          answer: 1,
          explain: "A founder is testing whether you can carry an undefined job with no platform team, no QA function and no process to hide behind. The parts of the story you normally compress — the unglamorous breadth — are the evidence here, while approvals navigated can actively read as dependence on structure."
        },
        {
          q: "An engineering-manager candidate is asked about a difficult performance conversation and answers by describing how they rewrote the failing service themselves. What does that signal?",
          options: [
            "Technical credibility, which is what this round is checking",
            "Appropriate ownership at a moment when delivery was at risk",
            "That they stepped around the people problem the question was about",
            "Discretion about a report's performance"
          ],
          answer: 2,
          explain: "The question is about whether you can hold the conversation — on a timeline, with support in place and a real outcome. Substituting engineering work is the classic reversion to senior IC, and it also answers a question nobody asked: that the performance problem itself was never addressed."
        },
        {
          q: "What does the three-probe follow-up drill build that rehearsing your answers does not?",
          options: [
            "A cleaner opening line for each story",
            "Shorter answers that leave more room for the interviewer's questions",
            "A memorised script for each of the signal areas",
            "The habit of supplying specifics — your contribution, the rejected option, the measurement — after the prepared part runs out"
          ],
          answer: 3,
          explain: "Answers rarely fail in the first ninety seconds; they fail at minute four, when the prepared material is exhausted and the probes keep coming. Running the same three probes on every story tells you which ones have a second layer and which need a number you never recorded. A memorised script makes exactly this problem worse."
        }
      ]
    }
  });

  /* ==================================================================
     TRACK
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.story = {
    id: "story",
    name: "Story Bank & Playbooks",
    short: "STORIES",
    tagline: "Build the material once, aim it many times",
    color: "#34d399",
    blurb: "A behavioral loop is an evidence exam, and the evidence is built long before the interview. This track is the engineering discipline behind the answers: a weekly capture habit that catches stories while the numbers are still recoverable, the anatomy that lets one story answer five prompts, honest scope evidence, the shapes that prove ownership, conflict and growth, and a coverage grid that shows you where the bank is thin. Then you adapt the same catalog to a large-company loop, a principle-scored rubric, a twenty-person startup and the manager round — and drill it until it survives the third follow-up.",
    modules: [
      /* ==================== MODULE 1 · CATALOG ==================== */
      {
        id: "catalog",
        name: "Engineering A Story Bank",
        icon: "blocks",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "journaling",
            title: "The work journal that becomes your bank",
            summary: "Capture stories while the work is fresh — five fields a week beats a frantic invention session the night before.",
            minutes: 9,
            tags: ["catalog", "habit", "capture"],
            blocks: [
              { t: "p", html: "A <strong>story bank</strong> is the small set of real experiences you draw on when an interviewer says \"tell me about a time when…\". Almost everyone builds it the wrong way round: the week before the loop, they sit down and try to <em>remember</em> something impressive. What comes out is thin — a project name, a vague outcome, no numbers, and no trace of the decision that made it interesting." },
              { t: "p", html: "The winning move is unglamorous. You keep a running journal of your own work, written while it is still fresh, and the bank falls out of it later. This track is about that raw material and how to maintain it; the techniques for <em>choosing</em> and <em>telling</em> a story live in the course track — start with <a href=\"#/beh/foundation/why-it-matters\">why the round exists</a> and <a href=\"#/beh/delivery/deliver-salt\">the structure you deliver it in</a> if you have not read them yet." },
              { t: "h", text: "Memory is the wrong storage layer" },
              { t: "p", html: "The parts of a story that earn credit are exactly the parts that decay fastest. Within about a month you still know what you built. What you have already lost is everything that made it a decision." },
              {
                t: "ul", items: [
                  "The <strong>numbers</strong> — the before, the after, and the window you measured over.",
                  "The <strong>option you rejected</strong>, and what would have made you choose it instead.",
                  "Who <strong>pushed back</strong>, and what their argument actually was.",
                  "The <strong>timeline</strong> — when you first knew, versus when you acted.",
                  "What you <strong>did not know</strong> at the time, which is the whole substance of an ambiguity story."
                ]
              },
              { t: "note", variant: "warn", html: "That last one is the cruellest. Once you know how something turned out, you cannot reconstruct the uncertainty you were standing in — and the uncertainty is the part the interviewer is scoring." },
              { t: "h", text: "The five fields" },
              { t: "p", html: "One entry, five fields, three minutes. Do not write prose; write the raw material." },
              {
                t: "table",
                headers: ["Field", "What you write", "Why it is worth the keystrokes"],
                rows: [
                  ["Situation &amp; stakes", "One line: what was at risk, and for whom", "A story with no stakes has nowhere to go, however hard the work was"],
                  ["The fork", "The decision, and the option you rejected", "Judgement is only visible at a fork; no fork, no story"],
                  ["Your move", "What <em>you</em> did, first person, separated from the team", "The one field you cannot reconstruct afterwards"],
                  ["Numbers", "Before, after, dates, size of the thing", "Precision is read as ownership — vagueness is read as distance"],
                  ["What it changed", "The practice or rule you kept afterwards", "Turns an anecdote into a growth story a year later"]
                ]
              },
              { t: "note", variant: "tip", html: "Storage should be boring: one plain text file, one heading per week, newest at the top. Do not polish, do not structure it as an answer, do not delete entries that look unimpressive. Shaping is cheap later; remembering is not." },
              { t: "h", text: "The weekly ten minutes" },
              {
                t: "ol", items: [
                  "Pick a fixed slot — Friday afternoon works because the week is still loaded in your head.",
                  "Skim your merged changes, closed tickets and calendar. Two minutes, no judgement.",
                  "Ask one question: <strong>did anything this week have a fork in it?</strong> A choice, a disagreement, a thing that nearly went wrong.",
                  "If yes, write one entry against the five fields. Three sentences is plenty.",
                  "If no, write nothing and close the file. An empty week is not a failure — it is data."
                ]
              },
              { t: "p", html: "The <em>fork test</em> is what keeps the journal short. Most weeks contain competent execution and nothing else, and logging competent execution produces a bank full of stories that cannot be scored. You are collecting decisions, not activity." },
              { t: "note", variant: "warn", html: "A run of three or four empty months is worth taking seriously. It usually means you are executing work someone else scoped — which is a career signal before it is a bank problem, and it is exactly what <a href=\"#/story/catalog/scope-signal\">proving scope</a> later in this module is about." },
              { t: "h", text: "Mining the bank you already have" },
              { t: "p", html: "Starting cold is not starting from zero. Your past self left evidence in five places, and mining them is a two-hour job that usually yields most of a working bank." },
              {
                t: "table",
                headers: ["Where to look", "What to look for", "What it usually yields"],
                rows: [
                  ["Résumé bullets", "Any bullet with a number in it — you wrote that number for a reason", "Scope and impact"],
                  ["Performance reviews and self-assessments", "The paragraph about your hardest quarter, and any feedback you disagreed with", "Delivery under pressure, growth"],
                  ["Design docs you wrote", "The <em>alternatives considered</em> section", "Judgement and trade-offs — the richest section in your whole archive"],
                  ["Incident write-ups", "Your own actions in the timeline, and which follow-ups you owned", "Ownership, failure and recovery"],
                  ["Old threads where you disagreed", "The message where someone changed their mind — either of you", "Conflict and influence"]
                ]
              },
              { t: "p", html: "The design-doc row deserves special attention. An <em>alternatives considered</em> section is already written in the shape an interviewer wants: here was the fork, here is what we chose, here is what we gave up. If you have written three design docs, you have three stories with the hardest part already done." },
              {
                t: "compare",
                bad: { title: "The week-before scramble", items: ["Stories chosen for how impressive the project sounds", "Numbers rounded, then hedged when probed", "Rejected options forgotten, so no fork to show", "Your contribution blurred into the team's", "Four stories, all the same shape"] },
                good: { title: "The running journal", items: ["Stories chosen for the decision inside them", "Numbers as recorded, with the window attached", "The rejected option is right there in the entry", "First-person move captured while it was obvious", "Enough entries that you can afford to discard some"] }
              },
              { t: "cue", html: "<strong>Keep the entry if it passes three tests.</strong> Was there a fork you can name? Can you attach at least one number? Could a stranger understand the stakes from one sentence? Two out of three is worth keeping; one out of three is activity, not a story." },
              { t: "note", variant: "key", html: "<strong>Capture beats recall.</strong> Ten minutes a week, five fields, and only for weeks that contained a real fork. The bank you interview with is assembled from entries, not invented from memory — and the fields that decide your score are the ones that disappear first." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "story-anatomy",
            title: "Anatomy of a reusable story",
            summary: "The five load-bearing parts, and the re-pointing trick that lets seven stories answer thirty prompts.",
            minutes: 9,
            tags: ["catalog", "anatomy", "reuse"],
            blocks: [
              { t: "p", html: "Think of a story as a <strong>component</strong> rather than a narrative. Prompts are callers. A well-built component has one body and several entry points, which is why a bank of seven can cover a loop of five rounds. A badly built one has exactly one entry point and sits unused whenever the prompt is phrased differently." },
              { t: "h", text: "The five load-bearing parts" },
              {
                t: "ul", items: [
                  "<strong>A stakes-bearing situation.</strong> Something was at risk — revenue, a launch date, a customer, a person. \"We had technical debt\" is not stakes.",
                  "<strong>A fork that could have gone the other way.</strong> If there was only one sensible option, you demonstrated diligence, not judgement.",
                  "<strong>Your contribution, isolated.</strong> One sentence that is true of you alone and would be false of your teammate.",
                  "<strong>A measured result.</strong> A number, or a state change someone else would confirm.",
                  "<strong>A transferable lesson.</strong> Specific enough to be falsifiable — a rule you now follow, not \"I learned the value of communication\"."
                ]
              },
              { t: "note", variant: "trap", html: "<strong>The commonest defect is a story with no fork.</strong> \"We had a scaling problem, I worked hard, we fixed it.\" There is nothing to score: no alternative, no risk taken, no judgement exposed. If your journal entry has no fork, do not try to rescue it with delivery — pick a different entry." },
              { t: "h", text: "Isolating your contribution" },
              { t: "p", html: "The habit of saying \"we\" is a delivery problem the course track covers under <a href=\"#/beh/delivery/pitfalls\">pitfalls</a>. What concerns us here is the <em>construction</em> problem underneath it: if the raw material never contained a first-person sentence, no amount of rephrasing in the room will produce one. You will hedge, because you genuinely cannot remember which part was yours." },
              {
                t: "compare",
                bad: { title: "Team-level telling", items: ["\"We decided to shard by tenant\"", "\"We got the error rate down\"", "\"The team pushed back on the deadline\"", "Interviewer cannot tell if you led it or watched it"] },
                good: { title: "Contribution isolated", items: ["\"I argued for sharding by tenant; the lead wanted by region\"", "\"I owned the retry policy — that is the part that moved the error rate\"", "\"I was the one who told the sponsor we would miss it, in week two\"", "One sentence that would be false if said by your teammate"] }
              },
              { t: "h", text: "Re-pointing: one story, many prompts" },
              { t: "p", html: "Re-pointing means keeping the body of the story and changing two things: the <strong>opening line</strong>, which tells the interviewer which question you think you are answering, and <strong>which twenty seconds you expand</strong>. Everything else compresses. Here is one story — a payments gateway migration — pointed five ways." },
              {
                t: "table",
                headers: ["Prompt", "Opening line you re-point to", "What you expand", "What you compress"],
                rows: [
                  ["Your biggest impact", "\"The clearest was cutting failed checkouts by about a third.\"", "The result and how it was measured", "The politics and the timeline"],
                  ["Working with incomplete information", "\"We committed to the migration before we understood the new gateway's failure modes.\"", "The unknowns, and the reversal plan you kept", "The result"],
                  ["A time you disagreed", "\"My tech lead wanted a big-bang cutover; I wanted a shadow period.\"", "How you handled it and where you landed", "The technical detail"],
                  ["Something you would do differently", "\"I under-invested in reconciliation tooling and paid for it in week three.\"", "The cost, and the change you made after", "The win"],
                  ["Influence without authority", "\"Nobody reported to me, and I needed three teams to change their retry logic.\"", "How you got agreement", "The migration mechanics"]
                ]
              },
              { t: "p", html: "Notice that nothing in the body changed. The migration happened once; each row is a different projection of it. This is the arithmetic that makes a small bank sufficient — and it is why depth in each story matters more than adding a ninth." },
              {
                t: "stat", items: [
                  { v: "7", k: "stories in a working bank" },
                  { v: "3-5", k: "prompts each can answer" },
                  { v: "1", k: "primary story per round" }
                ]
              },
              { t: "note", variant: "warn", html: "Re-pointing has a ceiling. Within one loop, the same story used in three rounds is visible — not to each interviewer, but to whoever reads the written feedback afterwards. Managing that is the whole subject of <a href=\"#/story/playbooks/big-tech\">adapting to a large-company loop</a> later in this track." },
              { t: "h", text: "Where structure lives" },
              { t: "p", html: "<a href=\"#/beh/delivery/deliver-salt\">SALT</a> is the container you pour a story into, and the course track owns it. Anatomy is what you pour. The two failure modes are independent: a well-structured story with no fork scores nothing, and a story with a real fork told out of order still earns partial credit because the interviewer can dig for the rest. Build the material first." },
              { t: "cue", html: "<strong>Audit any candidate story with four questions.</strong> What was at risk? What was the fork? What did <em>I</em> do that my teammate did not? What number moved? If you cannot answer all four in one breath, the story is not ready — and the missing answer tells you which field of your journal entry was thin." },
              { t: "note", variant: "key", html: "<strong>Reusability is engineered, not discovered.</strong> Stakes, a fork, an isolated contribution, a measured result, a falsifiable lesson — five parts, and each one is an entry point another prompt can call. Seven well-built stories beat fifteen anecdotes that each answer one question." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "scope-signal",
            title: "Proving scope without inflating it",
            summary: "The evidence ladder from task to organisation, what each rung sounds like, and why exaggeration is expensive.",
            minutes: 10,
            tags: ["catalog", "scope", "level"],
            blocks: [
              { t: "p", html: "Of all the signals in a behavioral loop, <strong>scope</strong> is the one that most often decides your level rather than your outcome. The interviewer is not really asking whether the work was hard. They are asking how big the thing was that you were trusted to be responsible for." },
              { t: "p", html: "How the signal gets scored is covered in <a href=\"#/beh/foundation/how-evaluated\">how you are evaluated</a>, and what a level is worth once the offer arrives is in <a href=\"#/offer/anatomy/level-bands\">level bands</a>. This lesson is about the evidence: producing it, and framing it at its true size." },
              { t: "h", text: "The evidence ladder" },
              {
                t: "table",
                headers: ["Rung", "What you were responsible for", "What it sounds like out loud"],
                rows: [
                  ["Task", "A well-defined piece of work someone else scoped", "\"I implemented the retry logic they specified.\""],
                  ["Feature", "An outcome, including deciding how", "\"I owned checkout retries end to end — design, rollout, the metric.\""],
                  ["System", "A component and its ongoing behaviour, including failure", "\"I own the payments gateway integration: the interface, the on-call, and the decision to shadow before cutover.\""],
                  ["Cross-team", "An outcome that required teams you do not control", "\"Three teams had to change their retry behaviour; I ran that agreement and the sequencing.\""],
                  ["Organisational", "A practice, standard or structure that outlives the project", "\"The rollout pattern I wrote up is now how the group does gateway changes.\""]
                ]
              },
              { t: "p", html: "The ladder measures the <strong>blast radius of your decisions</strong> — not headcount, not title, not how many people were in the room. A single engineer who owned a decision that three teams had to live with is on a higher rung than a lead who executed someone else's plan with six reports." },
              { t: "h", text: "The same project, told at four grades" },
              { t: "p", html: "One candidate, one piece of cache work, four ways of describing it." },
              {
                t: "table",
                headers: ["Tier", "How the candidate describes the caching work", "Why it lands there"],
                rows: [
                  ["<strong>Naive</strong> — vague", "\"I worked on caching to improve performance.\"", "Places you on no rung at all. The interviewer has to guess, and a guess under time pressure lands low."],
                  ["<strong>Naive</strong> — inflated", "\"I led the company-wide effort to cut our p99.\"", "Claims the cross-team rung with no cross-team evidence. One question — who owned rollout in the other services? — collapses it."],
                  ["<strong>Solid</strong>", "\"I owned the cache layer for the catalogue service: chose the eviction policy, wrote the warm-up job, ran the rollout. Read p99 went from roughly 180 ms to roughly 40 ms.\"", "An unambiguous system rung, decisions that are clearly yours, and a measured result with a stated unit."],
                  ["<strong>Standout</strong>", "\"…and when two other services copied the pattern I wrote up the policy and reviewed their rollouts, which is how it became the default for the group.\"", "Earns the rung above by naming the mechanism — writing it down and reviewing adopters — instead of claiming the outcome."]
                ]
              },
              { t: "p", html: "The distance between Good and Great is not more impressive work. It is the same work plus the sentence that shows how your decision propagated. Most candidates have that sentence available and never say it, because it feels like a footnote." },
              { t: "note", variant: "warn", html: "<strong>Inflation is detectable and expensive.</strong> Three ordinary probes find the seam: <em>who else was involved in that decision?</em>, <em>what did you personally choose?</em>, <em>what happened when it went wrong?</em> The cost is not the point you lose on that story — it is that once a claim collapses, the interviewer quietly discounts every other claim they cannot verify. Accurate framing at a lower rung beats a higher claim that fails." },
              { t: "h", text: "Climbing honestly" },
              { t: "p", html: "There are legitimate ways your evidence reaches a higher rung than the job description implies. All of them are things you can check against your journal." },
              {
                t: "ul", items: [
                  "You wrote something down and other people adopted it — a policy, a template, a runbook.",
                  "You were the person consulted before other teams shipped in that area.",
                  "You held the <strong>rollback or go/no-go decision</strong>, which is a scope claim regardless of the code you wrote.",
                  "You changed a process rather than a system — the organisational rung is usually reached this way, not by building something big.",
                  "You absorbed a decision nobody else wanted to make, and it stuck."
                ]
              },
              {
                t: "compare",
                bad: { title: "Padding", items: ["Borrowing team-level outcomes as \"my impact\"", "Using headcount as a proxy for scope", "\"We\" in every sentence about the decisions", "Claiming the org rung because leadership saw a slide", "Percentages with no baseline"] },
                good: { title: "Accurate framing", items: ["Naming the rung plainly, then the decisions inside it", "Saying who owned the parts you did not", "First person for choices, \"we\" for execution", "Claiming the higher rung only with the mechanism attached", "Numbers with a unit, a baseline and a window"] }
              },
              { t: "h", text: "Numbers that survive a follow-up" },
              { t: "p", html: "A scope claim is only as strong as the sentence underneath it. Write your two or three biggest claims out like this, in your journal, and the follow-ups stop being dangerous." },
              {
                t: "code", lang: "text", code:
                  "claim      : cut read p99 for the catalogue service from ~180 ms to ~40 ms\n" +
                  "backing    : 12 services read the catalogue; ~2.4k reads/sec at peak\n" +
                  "your part  : eviction policy, warm-up job, the 3-week staged rollout\n" +
                  "not yours  : the shared cache cluster (platform team), the client SDK change\n" +
                  "what broke : week 2 stampede on cold start -> added jittered warm-up"
              },
              { t: "p", html: "Say the <code class='tok'>not yours</code> line out loud in the interview. Ceding the parts you did not own is what makes the parts you did own believable, and it costs you nothing — the interviewer was going to find that boundary anyway, and finding it themselves is worse." },
              { t: "cue", html: "<strong>Phrases that place you on a rung.</strong> \"I owned…\" (feature or system), \"I decided…\" (any rung, and the strongest of these), \"I was the one they came to before…\" (cross-team), \"that is now how we…\" (organisational). Weak by contrast: \"I was involved in\", \"I helped with\", \"our team delivered\"." },
              { t: "note", variant: "key", html: "<strong>Frame at the true rung, then name the mechanism.</strong> Scope is the blast radius of your decisions, and it is proved by naming what you decided and what you did not own. Inflation is cheap to attempt, trivially detectable under three follow-ups, and it contaminates every other claim you make." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "resume-evidence",
            title: "Résumé lines that survive the deep-dive",
            summary: "Every bullet on your résumé is a story prompt you wrote yourself — write each one so the follow-up questions have answers.",
            minutes: 8,
            tags: ["catalog", "resume", "deep-dive", "evidence"],
            blocks: [
              { t: "p", html: "Interviewers do not read your résumé as a list of achievements. They read it as a <strong>menu of questions</strong>. Whichever line looks most interesting becomes the opening of a project deep-dive, and from that moment the line is a claim you have to defend for twenty minutes. A résumé is therefore part of the story bank: each bullet is an entry you have already published." },
              { t: "p", html: "The worked example in this lesson comes from data engineering, because it makes the numbers easy to see — but the method is the same for any role. It pairs with <a href=\"#/story/catalog/scope-signal\">proving scope</a>, which is about the size of what you owned, and <a href=\"#/story/catalog/story-anatomy\">story anatomy</a>, which is about how one story answers several prompts." },
              { t: "h", text: "Three shapes of the same bullet" },
              {
                t: "table",
                headers: ["Version", "What it says", "What the interviewer hears"],
                rows: [
                  ["Activity", "\"Worked on Spark pipelines for the analytics team.\"", "Present, but not responsible. Nothing to ask except \"what did you do?\""],
                  ["Technique", "\"Used broadcast joins and partition tuning in Spark.\"", "Knows vocabulary. Will now be quizzed on the vocabulary."],
                  ["Outcome with evidence", "\"Cut the nightly revenue job from 4 h to 50 min by removing a shuffle of a 2 TB fact table and making reruns replay-safe; on-call pages for it dropped from weekly to none in a quarter.\"", "Owned a decision with a before, an after and a consequence. The deep-dive will be about judgement — which is where you want it."]
                ]
              },
              { t: "p", html: "The third version is longer, and that is fine. It names <strong>scale</strong> (2 TB, nightly), the <strong>outcome</strong> (4 h to 50 min, pages to zero), the <strong>technique</strong> in passing, and the <strong>surrounding system</strong> (on-call, reruns) that shows you owned it end to end rather than tuned one query." },
              { t: "h", text: "The follow-up ladder" },
              { t: "p", html: "Before a bullet goes on the page, walk it up the ladder the interviewer will climb. If you cannot answer a rung from memory, either recover the evidence from your <a href=\"#/story/catalog/journaling\">work journal</a> or soften the claim." },
              {
                t: "ol", items: [
                  "<strong>Baseline</strong> — what was it before, and over what window did you measure it?",
                  "<strong>Your part</strong> — which piece did <em>you</em> decide or build, separately from the team?",
                  "<strong>The fork</strong> — what was the obvious alternative (a bigger cluster, a rewrite), and why did you reject it?",
                  "<strong>How you knew</strong> — what did you look at to find the cause? In the example: the physical plan and the stage timeline, not a hunch.",
                  "<strong>Second-order effect</strong> — what got better or worse elsewhere because of it (cost, reliability, someone else's job)?",
                  "<strong>What you would do now</strong> — the honest limitation, and the next step you did not get to."
                ]
              },
              { t: "note", variant: "warn", html: "Numbers you cannot defend are worse than no numbers. \"Improved performance 10×\" invites \"10× on what, measured how?\", and a pause there costs more than the bullet earned. Use the number you can reconstruct, with its window, even if it is less dramatic." },
              { t: "h", text: "Name techniques, but anchor them" },
              { t: "p", html: "Technique words are useful: they let a screener map you to the role, and they tell a technical interviewer where to start probing. Put them <em>inside</em> an outcome sentence rather than in a free-floating skills list, so each one arrives with a reason. A reader who sees \"partition pruning\" next to \"scan dropped from 2 TB to 40 GB\" knows you used it; a reader who sees it in a keyword cloud does not." },
              { t: "p", html: "Pair the core skill with the system around it. A data engineer who mentions orchestration, data-quality checks and replay-safe writes alongside the engine signals end-to-end ownership; the same is true of a backend engineer who mentions rollout, observability and on-call next to the service." },
              { t: "h", text: "Prepare one project for the full hour" },
              { t: "p", html: "Most loops include at least one conversation that goes deep on a single piece of your work. Choose it deliberately: the project where you made the most consequential decisions, not the one with the most famous name. Prepare it at three zoom levels." },
              {
                t: "table",
                headers: ["Zoom", "You should be able to…", "Example (the revenue job)"],
                rows: [
                  ["30 seconds", "State problem, your decision and the outcome", "Nightly job missed its SLA; I removed the big-side shuffle and made writes idempotent; 4 h to 50 min, no more pages"],
                  ["5 minutes", "Draw the system and mark your part", "Sources, the join, the write; where the shuffle was; why a broadcast was safe at that dimension size"],
                  ["30 minutes", "Defend each decision and its alternatives", "Why not a bigger cluster; how you verified correctness; what happens when the dimension grows past the threshold"]
                ]
              },
              { t: "cue", html: "<strong>Rehearse the line, not just the story.</strong> Read each bullet aloud and answer the six rungs of the ladder without notes. Any bullet that makes you hesitate on rung one or two gets rewritten or removed before the next application goes out." },
              { t: "note", variant: "key", html: "<strong>Write every line as a promise about the conversation that follows.</strong> A good résumé bullet is short enough to scan, specific enough to be interesting, and true enough that the interviewer's third follow-up lands on evidence. The line that survives the deep-dive is the one whose numbers you measured and whose decision you can explain — a sentence like \"scan less, move less, and make every write replay-safe\" earns its place only when a real before-and-after sits behind it." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "ownership-ambiguity",
            title: "Ownership and ambiguity stories",
            summary: "Four shapes that prove you act without a mandate — and the assigned-and-completed story that proves nothing.",
            minutes: 9,
            tags: ["catalog", "ownership", "ambiguity"],
            blocks: [
              { t: "p", html: "<strong>Ownership</strong> lives in the gap between what you were told to do and what you did. <strong>Ambiguity</strong> is what you did when the information ran out. They sit together because they share a failure mode: candidates offer stories about doing assigned work well, which is competence, and competence is what the technical rounds already measured." },
              { t: "h", text: "Four shapes that work" },
              {
                t: "table",
                headers: ["Shape", "What the interviewer is checking", "The sentence that proves it"],
                rows: [
                  ["A problem nobody owned", "Whether you need a mandate before you act", "\"Nobody owned the billing alerts, so I took them and got them staffed properly.\""],
                  ["A decision on incomplete information", "Whether you freeze, or act cheaply and stay reversible", "\"We did not know the vendor's rate limits, so I built the importer to resume from any point.\""],
                  ["The unglamorous work", "Whether you optimise for the team's throughput or your visibility", "\"Nobody was going to be promoted for fixing the flaky tests, and it was costing us a day a week.\""],
                  ["Escalated versus decided", "Whether you know which calls are yours", "\"I decided the schema. I escalated the vendor spend, because that was a budget call I did not own.\""]
                ]
              },
              { t: "h", text: "The weak ownership story" },
              {
                t: "compare",
                bad: { title: "Assigned and completed", items: ["\"I was given the migration and delivered it on time\"", "The scope was set by someone else", "Every decision inside it was already made", "Proves you are reliable — which was never in doubt", "Interviewer has to score competence, not ownership"] },
                good: { title: "Claimed and closed", items: ["\"The migration stalled for a quarter, so I wrote the plan and got it funded\"", "You set or changed the scope", "You made a decision that could have gone another way", "Proves you close problems rather than tickets", "Interviewer can score initiative directly"] }
              },
              { t: "p", html: "This is not a trick of phrasing. If the story genuinely was \"assigned, then delivered\", re-labelling it as ownership will not survive the first probe — <em>whose idea was it?</em> — and now you have an honesty problem on top of a weak story. The move is to find the part you extended past the ask, or pick a different entry. <a href=\"#/beh/foundation/how-evaluated\">How you are evaluated</a> is worth re-reading if you are unsure which signal each story is carrying." },
              { t: "h", text: "Acting when the information runs out" },
              { t: "p", html: "The instinct is to tell an ambiguity story as courage: we did not know, I made the call, it worked. Interviewers reward something quieter — a <em>cheap</em> decision rather than a bold one, made in a way that could be undone." },
              {
                t: "ol", items: [
                  "<strong>Name the unknowns out loud.</strong> Two or three, specifically. This is what separates ambiguity from ignorance.",
                  "<strong>Pick the reversible option</strong> where one exists, and say that reversibility was why you picked it.",
                  "<strong>Set a tripwire.</strong> The condition that would make you change course, decided in advance.",
                  "<strong>Write the decision down</strong> so it could be revisited by someone who was not in the room.",
                  "<strong>Say what actually happened to the unknowns.</strong> Two resolved harmlessly, one bit you — that is a real story."
                ]
              },
              { t: "note", variant: "tip", html: "The tripwire sentence is the highest-value line in an ambiguity story: \"we agreed that if reconciliation drifted more than 0.1% in week one we would roll back and re-plan.\" It shows you were managing risk rather than hoping, and it is impossible to fake convincingly because it has to be specific." },
              { t: "h", text: "Escalation is ownership, not its absence" },
              { t: "p", html: "Plenty of candidates hide escalations because they read as asking permission. The opposite is true: knowing which decisions are not yours is a seniority signal, and the story that contains both halves is stronger than the story that contains only bravery." },
              { t: "p", html: "The shape is one sentence with two clauses — what you decided, and what you escalated <em>with a reason tied to authority rather than difficulty</em>. \"I escalated because it was hard\" reads as avoidance; \"I escalated because it committed budget I do not control\" reads as judgement." },
              { t: "note", variant: "trap", html: "<strong>The hero story.</strong> You noticed the problem, bypassed the owner, shipped the fix over the weekend, and it worked. Candidates love this one. A senior interviewer hears: this person will do that to my team, and next time it will not work. If your best ownership story involves going around someone, tell the version where you also went back and told them." },
              { t: "h", text: "Unglamorous work is a scope signal too" },
              { t: "p", html: "Test cleanup, on-call hygiene, the documentation nobody reads, the deprecation nobody wants. These stories are underused because they feel small, but they carry a signal nothing else does: you chose work by its effect on the team rather than its effect on your visibility. Attach a number and it climbs the <a href=\"#/story/catalog/scope-signal\">evidence ladder</a> faster than you would expect — a day a week of engineering time recovered is a real result." },
              { t: "cue", html: "<strong>Recognise these prompts.</strong> \"A time you went beyond your role\", \"a project with no clear owner\", \"a decision with incomplete information\", \"something you did that nobody asked for\", \"how do you decide what to work on\". All four shapes above answer at least two of these." },
              { t: "note", variant: "key", html: "<strong>Ownership is the gap between the ask and what you did; ambiguity is judged on cheapness, not courage.</strong> Assigned-and-completed proves reliability the technical rounds already established. Name the unknowns, name the tripwire, and say which call you escalated and why." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "conflict-growth",
            title: "Conflict and growth, the two hardest",
            summary: "In a conflict story the result includes the relationship; in a growth story the failure has to have cost something.",
            minutes: 10,
            tags: ["catalog", "conflict", "growth"],
            blocks: [
              { t: "p", html: "These two are the hardest stories to tell well, and the reason is the same for both: they are <strong>trust probes</strong>. While you answer, the interviewer is imagining being on the other side of the table from you — in a design review you disagree with, or on a project that has just failed." },
              { t: "h", text: "Conflict: the result includes the relationship" },
              { t: "p", html: "Most candidates optimise a conflict story for vindication. They arrive at \"and I was right\", pause for credit, and lose the point. The scoring rule is blunter than that: <strong>the state of the relationship afterwards is part of the result</strong>. A story where you were right and the colleague was alienated scores worse than one where you lost the argument and kept a working partnership." },
              {
                t: "compare",
                bad: { title: "Right and alienated", items: ["\"I showed them the benchmark and that ended the discussion\"", "Their position summarised as a mistake", "No mention of what happened next between you", "Conflict framed as a contest you won", "Interviewer imagines being on the losing side"] },
                good: { title: "Converged, still working together", items: ["\"I asked what failure they were protecting against — it was the on-call load\"", "Their position stated fairly enough that they would agree", "\"We still review each other's designs; she caught a bug in mine last month\"", "Conflict framed as a shared decision under different constraints", "Interviewer imagines disagreeing with you safely"] }
              },
              { t: "h", text: "The skeleton that scores" },
              {
                t: "ol", items: [
                  "<strong>The disagreement was about substance.</strong> Style clashes and personality stories are much weaker — they give the interviewer nothing technical to evaluate.",
                  "<strong>State their argument fairly.</strong> This is the actual test, and most candidates fail it here.",
                  "<strong>Show what you did to find their model</strong> — the question you asked, the data you went and got, the constraint you had missed.",
                  "<strong>Resolve it honestly</strong>: you converged, or you escalated cleanly with both positions represented, or you committed to their call and made it work.",
                  "<strong>Name the after-state.</strong> One concrete sentence about the working relationship since."
                ]
              },
              { t: "note", variant: "tip", html: "The fairness test is easy to rehearse and hard to fake. Say their position out loud as if you were them, without editorial. If your version makes them sound careless, you have not understood the constraint they were protecting — and the interviewer, who has been the person in that position, will hear it immediately." },
              { t: "p", html: "A conflict you <em>lost</em> can be your strongest story, provided you committed properly afterwards: you argued hard, the decision went the other way, you executed it as though it had been your idea, and you can say what you learned from being wrong — or what you still think, without bitterness. The specific pitfalls that undercut all of this in delivery are in <a href=\"#/beh/delivery/pitfalls\">pitfalls</a>." },
              { t: "h", text: "Growth: a real failure with a real cost" },
              { t: "p", html: "The growth story has one requirement that candidates route around endlessly: something has to have <strong>cost something</strong>. Here is the same prompt answered at four grades." },
              {
                t: "table",
                headers: ["Tier", "The failure offered", "How it reads"],
                rows: [
                  ["<strong>Naive</strong> — trivial", "\"I mislabelled a chart in a deck and corrected it the next morning.\"", "Signals you have never owned anything with downside. Answers a scope question you were not asked, badly."],
                  ["<strong>Naive</strong> — disguised brag", "\"I took on too much because I care about the work too deeply.\"", "The interviewer stops believing the rest of your answers. This is the single most common failure-question answer and it is transparent."],
                  ["<strong>Solid</strong>", "\"I called a launch go when the error budget said no. We spent two weeks rolling back.\"", "Real cost, unambiguous ownership of the decision, no blame placed elsewhere."],
                  ["<strong>Standout</strong>", "\"…so I changed how I run go/no-go: whoever owns the rollback now has a veto. I have seen it used twice, once against my own launch.\"", "The change is durable, specific and checkable — and the last clause proves it was not written for the interview."]
                ]
              },
              { t: "note", variant: "trap", html: "<strong>The failure so small it becomes a scope answer.</strong> If the worst thing you can produce is a typo or a missed meeting, you have told the interviewer that nobody has trusted you with a decision that could go badly. Candidates choose these because they feel safe; they are the most expensive answer in the set." },
              { t: "p", html: "The other half of the requirement is that <strong>the change has to be checkable</strong>. A habit, a document, a rule, a person who now holds a veto. \"I learned to communicate better\" is unfalsifiable, so it scores as nothing — and worse, it invites the follow-up \"how would I know?\", which you cannot answer." },
              { t: "h", text: "Choosing which failure to tell" },
              {
                t: "ul", items: [
                  "The cost was <strong>real and nameable</strong> — weeks, money, a customer, a person's trust.",
                  "You were genuinely <strong>responsible for the decision</strong>, not for someone else's.",
                  "The change you made afterwards has a name and a date.",
                  "You can tell it without blaming a named person, including anyone the interviewer might know.",
                  "It is far enough behind you to be resolved. A failure still in progress turns the round into a live incident review."
                ]
              },
              { t: "note", variant: "warn", html: "Honesty is not the same as volunteering disqualifying material. A failure that reveals a values problem, or a year-long slip you never mitigated, is not \"brave\" — it is a different conversation you cannot win. Choose a failure with a real cost <em>and</em> a real recovery; there is almost always one available." },
              { t: "cue", html: "<strong>The two closing lines to have ready.</strong> For conflict: \"we still work together — she reviewed my design last month.\" For growth: \"the rule I changed is X, and it has been used since.\" Interviewers write down closing lines, because those are the sentences that survive into the written feedback." },
              { t: "note", variant: "key", html: "<strong>Conflict is scored on the relationship; growth is scored on the cost and the correction.</strong> Be able to state the other side's argument fairly enough that they would sign it, and choose a failure big enough to prove you have been trusted with something that could break." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "coverage-matrix",
            title: "Coverage: finding where your bank is thin",
            summary: "Grid your stories against the signals, tell an incidental gap from a structural one, and go do work that fills it.",
            minutes: 10,
            tags: ["catalog", "coverage", "planning"],
            blocks: [
              { t: "p", html: "Once you have eight or nine entries, your bank stops being a collection and becomes a <strong>coverage problem</strong>. The question is no longer \"do I have good stories\" but \"is there a signal a loop will ask about that I have nothing for\". Those two questions have very different answers, and only the second one predicts how the loop goes." },
              { t: "p", html: "The eight signal areas themselves are defined in <a href=\"#/beh/foundation/how-evaluated\">how you are evaluated</a> — that lesson is the authority. Here they are just column headings, and the shorthand labels below are for building the grid." },
              { t: "h", text: "Build the grid" },
              {
                t: "ol", items: [
                  "Rows are your stories. Columns are the eight signal areas.",
                  "Mark each cell <strong>2</strong> if the story is primary evidence for that signal, <strong>1</strong> if you could mention it there, blank if it does not belong.",
                  "Total each column. Ignore the row totals — a story that is only ever primary for one signal is perfectly fine.",
                  "Read the columns, not the cells. The columns are what a loop actually samples."
                ]
              },
              { t: "p", html: "A compact version is enough. You do not need a spreadsheet; four columns per story will do." },
              {
                t: "table",
                headers: ["Story", "Primary evidence for", "Also usable for", "Do not use it for"],
                rows: [
                  ["Gateway migration", "Scope &amp; impact", "Ambiguity, delivery pressure", "Conflict — the disagreement was minor"],
                  ["Design review pushback", "Conflict", "Influence", "Scope — it was one service"],
                  ["Incident postmortem", "Growth", "Ownership, delivery pressure", "Collaboration — you did it alone"],
                  ["Mentoring a teammate", "Collaboration", "Influence, growth", "Delivery pressure — no deadline in it"]
                ]
              },
              { t: "h", text: "Three shapes worth spotting" },
              {
                t: "ul", items: [
                  "<strong>An empty column.</strong> No story at all for a signal a loop will ask about. This is the only urgent problem on the grid.",
                  "<strong>A column with exactly one.</strong> A single point of failure: spend it in round one, and a later interviewer scoring the same signal gets nothing.",
                  "<strong>A story that is primary for nothing.</strong> Not a defect, but it means your bank is bigger than its coverage — and bank size is not the metric."
                ]
              },
              { t: "widget", id: "storyMatrix" },
              { t: "p", html: "The project-heavy preset is the most common real bank, especially for strong engineers: four large, genuinely impressive project stories and no people stories at all. Note what the grid says about it — the fifth project story adds nothing, because the empty columns are all on the human side." },
              { t: "h", text: "Two kinds of gap" },
              {
                t: "table",
                headers: ["Gap", "What it means", "What to do about it"],
                rows: [
                  ["Incidental", "You have done the thing; you just never captured it", "Go back through <a href=\"#/story/catalog/journaling\">the mining sources</a> — design docs and old disagreement threads fill these fastest"],
                  ["Structural", "You genuinely have not done it", "Either go and do it, if you have runway, or plan to answer at a smaller true scale"]
                ]
              },
              { t: "p", html: "Most gaps are incidental, which is good news: an afternoon of mining usually closes two columns. Test it before you conclude otherwise — candidates routinely believe they have \"no conflict story\" when they have three, all filed in memory as ordinary Tuesdays." },
              { t: "h", text: "Filling a structural gap on purpose" },
              { t: "p", html: "With three months or more before you interview, a genuine gap is a work-planning problem, and this is the most underused move in interview preparation. You are not manufacturing an anecdote; you are going and doing the thing you cannot currently talk about." },
              {
                t: "ol", items: [
                  "Pick the <strong>unowned problem</strong> in your area that nobody wants. That single move can fill ownership, ambiguity and delivery at once.",
                  "Volunteer for the piece that needs another team's agreement — that is the only way to get cross-team scope evidence.",
                  "Ask to run the next postmortem. It is the cheapest route to a growth story with a real cost attached.",
                  "Take the mentee, or the onboarding of the next hire, if collaboration and influence are your empty columns.",
                  "Journal it the same week, against the five fields, while the unknowns are still live."
                ]
              },
              { t: "note", variant: "warn", html: "<strong>The trade-off is real.</strong> Chasing coverage can pull you off the work your current review is judged on, and manufactured experience is detectable — a project with no stakes reads exactly like what it is. Choose gaps that are also genuinely useful to your team, and if there is no overlap, take the smaller true story instead." },
              { t: "p", html: "With less than about three weeks of runway, coverage work is off the table. The play then is re-mining what you already have, deciding consciously which signal you will answer at a smaller scale, and spending the rest of the time on <a href=\"#/story/playbooks/mock-drills\">the drills</a> — depth on eight stories beats a ninth story you have never said out loud." },
              { t: "cue", html: "<strong>The grid is done when</strong> every commonly asked signal has two credible options, you know which story you would sacrifice to a weak prompt, and you can name — without looking — the one signal you are still weakest on. That last one matters, because you will be asked something in that area." },
              { t: "note", variant: "key", html: "<strong>Read the columns, not the collection.</strong> Empty columns are the only urgent problem; single-story columns are single points of failure. Most gaps are incidental and close with an afternoon of mining — and a real structural gap, with months of runway, is an argument for changing what you work on, not for inventing a story." },
              { t: "quiz", id: "story-catalog" }
            ]
          }
        ]
      },

      /* ==================== MODULE 2 · PLAYBOOKS ==================== */
      {
        id: "playbooks",
        name: "Adapting Your Catalog",
        icon: "grid",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "big-tech",
            title: "Adapting to a large-company loop",
            summary: "More rounds, overlapping interviewers, and written feedback read by strangers — so map rounds to stories and check for collisions.",
            minutes: 10,
            tags: ["playbooks", "big-tech", "planning"],
            blocks: [
              { t: "p", html: "A large-company loop is not one long conversation. It is several independent observations that get <strong>reconciled afterwards</strong>: every interviewer writes up their round alone, and the decision is made by people reading that record — some of whom never met you. You are optimising the written record, not the room." },
              { t: "h", text: "Four things that change" },
              {
                t: "ul", items: [
                  "<strong>More rounds.</strong> Four to six, often with two carrying most of the behavioral weight, plus behavioral questions bolted onto technical rounds.",
                  "<strong>Overlap.</strong> Two interviewers are frequently assigned the same signal on purpose, to see whether it holds up twice.",
                  "<strong>Aggregated written feedback.</strong> Your answers are compressed into a few paragraphs each and read side by side by strangers.",
                  "<strong>Depth of follow-up.</strong> Three probes deep is routine here, not adversarial — and it is what punishes a story with no second layer."
                ]
              },
              { t: "p", html: "The first consequence is that your interviewer becomes a <em>narrator</em>. An hour later they will type a summary from memory, and whatever they can recall is what gets scored. Give them a line worth typing." },
              { t: "note", variant: "tip", html: "<strong>The quotable sentence.</strong> One line containing the rung, the decision and the number: \"I owned the gateway integration, chose to shadow rather than cut over, and failed checkouts dropped about a third.\" That sentence can be transcribed. \"It was a really complex migration with a lot of moving parts\" cannot." },
              { t: "h", text: "The mapping step" },
              { t: "p", html: "The mapping step takes twenty minutes and prevents the most avoidable loop failure: telling your best story three times and having nothing for the fourth round." },
              {
                t: "ol", items: [
                  "<strong>List the rounds.</strong> Ask the recruiter what the loop is — they will usually tell you the shape and who each round is with. (<a href=\"#/offer/execution/recruiter-scope\">Scoping the recruiter conversation</a> covers how to ask.)",
                  "<strong>Name the likely primary signal</strong> for each round, based on who is running it.",
                  "<strong>Assign one primary and one backup story</strong> per round, from your grid.",
                  "<strong>Check collisions</strong> — any story appearing as primary more than once.",
                  "<strong>Keep one story unassigned</strong> as a floater, for the round that goes somewhere you did not predict."
                ]
              },
              {
                t: "code", lang: "text", code:
                  "round 1  hiring manager    primary: gateway migration    backup: billing alerts\n" +
                  "round 2  peer engineer     primary: design review push   backup: flaky tests\n" +
                  "round 3  cross-functional  primary: cross-team contract  backup: onboarding\n" +
                  "round 4  senior leader     primary: gateway migration    backup: postmortem\n" +
                  "\n" +
                  "collision: gateway migration is primary in rounds 1 and 4\n" +
                  "  -> keep it in round 1 (impact framing)\n" +
                  "  -> round 4 becomes postmortem (growth), backup: cost reduction\n" +
                  "floater: mentoring story, for a round that runs short"
              },
              { t: "p", html: "Repeating a story is not forbidden — it is <em>managed</em>. If a fourth interviewer probes a signal you only have one story for, say so: \"I may have covered this with the hiring manager, so let me take it from a different angle.\" That reads as organised. Telling it identically twice, and being caught by the written record, reads as a bank with two stories in it." },
              { t: "h", text: "Matching stories to round types" },
              {
                t: "table",
                headers: ["Round type", "Signal it usually carries", "Story shape that fits"],
                rows: [
                  ["Hiring manager", "Scope, impact, ownership", "Your highest true rung, with the decisions named"],
                  ["Peer engineer", "Collaboration, conflict, how you are to work with", "A substantive disagreement where the relationship survived"],
                  ["Cross-functional partner", "Influence, communication, working across boundaries", "An outcome that needed people who did not report to you"],
                  ["Senior interviewer from outside the team", "Consistency and judgement, calibrated against many candidates", "A failure with a real cost, or a decision you would defend under pressure"]
                ]
              },
              { t: "p", html: "The last row is the one candidates misread. An interviewer whose job is consistency across many loops is not trying to trip you; they are checking that your level claim survives contact with a probe they have run a hundred times. Their round is where thin stories die, and it is why <a href=\"#/story/playbooks/mock-drills\">the follow-up drill</a> at the end of this module exists." },
              { t: "p", html: "Per-company specifics — how many rounds, which signals get named, what the written form asks for — are in the loop guides: <a href=\"#/loops/meta/meta-e5\">one large-company senior loop</a>, <a href=\"#/loops/google/google-l5\">another</a>, and <a href=\"#/loops/amazon/amazon-l5\">a principle-scored one</a>. The unusual round formats you may hit are covered in <a href=\"#/beh/advanced/special-types\">special round types</a>." },
              { t: "note", variant: "warn", html: "<strong>Do not over-fit the map.</strong> A rigid plan makes you sound scripted and shatters when the interviewer asks something off-plan — and candidates who are mid-script often answer the question they prepared instead of the one they were asked. Hold the map as primary-plus-backup, and if the prompt does not fit, answer the prompt." },
              { t: "cue", html: "<strong>Signs the loop is testing overlap.</strong> Two interviewers use near-identical prompt phrasing; someone asks \"has anyone else asked you about a conflict today?\"; a later interviewer opens with a follow-up that only makes sense if they read an earlier note. Answer honestly and change the angle." },
              { t: "note", variant: "key", html: "<strong>Optimise the written record, not the room.</strong> List the rounds, assign a primary and a backup story to each, check for collisions, keep a floater — and give every interviewer one quotable sentence with the rung, the decision and the number in it." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "principle-based",
            title: "Loops scored against named principles",
            summary: "Translate your catalog into someone else's vocabulary without contorting it — and never recite the principle back.",
            minutes: 9,
            tags: ["playbooks", "principles", "values"],
            blocks: [
              { t: "p", html: "Some companies publish a named set of principles or values and score you against them explicitly. The interviewer often has a form with the principle written at the top and a box underneath for evidence. Your job is <strong>translation</strong>: the same stories, expressed in their vocabulary. Not new stories, and not the same story bent until it fits." },
              { t: "h", text: "How the mapping works" },
              { t: "p", html: "Published sets differ in wording and length, but they cluster into a handful of families. Map your grid onto the families first, then onto the specific names when you know them." },
              {
                t: "table",
                headers: ["Principle family", "What the interviewer wants to see", "Evidence that satisfies it"],
                rows: [
                  ["Customer outcome", "That you optimised for the user, not the architecture", "A time you cut a technically better design because it did not help the user"],
                  ["Speed under uncertainty", "That you move without complete information", "A reversible decision made early, with the tripwire you set"],
                  ["Quality bar", "That you hold a standard when it is inconvenient", "A ship date you pushed, or a review you failed, with the reasoning"],
                  ["Disagreement then commitment", "That you argue hard and then execute a decision that went against you", "A conflict you lost and delivered anyway, without hedging"],
                  ["Resourcefulness under constraint", "That you get outcomes without headcount or budget", "The thing you did not build, or the manual process you ran on purpose"],
                  ["Long horizon", "That you weigh the second-order cost", "A short-term slowdown you accepted to avoid a structural problem"],
                  ["Growing people", "That other people got better because of you", "A specific person, a specific change, and what they can do now"]
                ]
              },
              { t: "p", html: "One story can legitimately serve two or three families — the facts stay put, the emphasis moves, exactly as in <a href=\"#/story/catalog/story-anatomy\">re-pointing</a>. What changes is which twenty seconds you expand." },
              { t: "note", variant: "trap", html: "<strong>Do not recite the principle back.</strong> \"This is a great example of how I embody [principle name]\" reads as list-study rather than lived behaviour, and it sets an expectation your story then has to clear. The name is already on the interviewer's form; what they lack is evidence. Demonstrate it and let them file it." },
              { t: "h", text: "Contorting versus translating" },
              {
                t: "compare",
                bad: { title: "Contorted", items: ["A refactor retold as customer obsession because a user filed a bug once", "Frugality claimed for a project that simply had no budget approved yet", "A story stretched to cover five principles, thinning at every step", "Vocabulary borrowed wholesale: \"I raised the bar and disagreed and committed\"", "Collapses on the first \"what specifically did you do there?\""] },
                good: { title: "Translated", items: ["The same refactor told through the two customers whose latency it fixed", "Resourcefulness claimed where you deliberately chose the manual process", "One story mapped to two families, with different emphasis in each", "Their vocabulary in your own words, no quoting", "Holds up under three probes because nothing was invented"] }
              },
              { t: "h", text: "The principle you have no story for" },
              { t: "p", html: "It happens on every published list — usually the one about frugality, or the one about hiring, or the long-horizon one if you are early in your career. There are three moves, and they are strictly ordered." },
              {
                t: "ol", items: [
                  "<strong>Nearest real evidence, at its true scale.</strong> \"This was one team rather than the organisation, but here is the same behaviour\" — an honest downgrade costs you a little and buys you credibility.",
                  "<strong>A smaller true story, told cleanly.</strong> A genuinely modest example with a real decision in it outscores an impressive one with nothing underneath.",
                  "<strong>Name the gap.</strong> Only if asked directly and you truly have nothing: say what you have not had the chance to do, then what you would do, briefly. Last resort — but far better than a fabrication."
                ]
              },
              { t: "note", variant: "warn", html: "<strong>The composite story is the tempting cheat.</strong> Stitching two real events into one that covers the principle properly feels harmless — nothing in it is invented. It is also the easiest thing to catch in a loop that probes: the timeline stops being consistent about two questions in, and \"wait, was that before or after the launch?\" is an unrecoverable moment." },
              { t: "h", text: "Noticing when the principle switches" },
              { t: "p", html: "The general skill of hearing the question behind the question belongs to <a href=\"#/beh/foundation/decode\">naming the signal behind the prompt</a>. The wrinkle specific to these loops is that one round usually has to produce evidence for two or three named principles, so the interviewer will steer mid-answer to collect the second one." },
              {
                t: "table",
                headers: ["What they ask next", "Principle usually being collected", "What to foreground"],
                rows: [
                  ["\"How did you decide it was worth doing at all?\"", "Customer outcome or long horizon", "Who it was for, and the second-order cost you weighed"],
                  ["\"What did you do when the data was not there?\"", "Speed under uncertainty", "The reversible choice and the tripwire"],
                  ["\"What did your teammate think?\"", "Disagreement then commitment", "Their argument, fairly stated, and what you did after the decision"],
                  ["\"What would you have done with half the time?\"", "Resourcefulness under constraint", "The thing you would cut, and who you would tell"]
                ]
              },
              { t: "p", html: "When the steer comes, follow it. Finishing your prepared arc while the interviewer is trying to collect a different box is how a strong story produces a weak write-up. If you are also being asked about how you work with AI tools, <a href=\"#/beh/advanced/ai-questions\">those questions</a> often map straight onto the speed and quality-bar families." },
              { t: "cue", html: "<strong>Recognise the loop style.</strong> The recruiter names the principles unprompted; the interviewer visibly writes under a heading; prompts arrive in pairs on the same theme; a follow-up feels like a change of subject rather than a deepening. That last one is the steer — go with it." },
              { t: "note", variant: "key", html: "<strong>Translate, do not contort.</strong> Map your grid onto principle families rather than writing new stories; let one story serve two or three by changing emphasis; never quote the principle name back; and when you have no evidence, use the smaller true story at its real scale rather than a composite that cannot survive probing." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "startup-vs-scale",
            title: "Startups and scale-ups",
            summary: "Breadth over depth, evidence you can operate without structure, and a founder judging fit for a role that does not exist yet.",
            minutes: 9,
            tags: ["playbooks", "startup", "fit"],
            blocks: [
              { t: "p", html: "At a large company you are being slotted into a level that already exists. At a twenty-person company you are being asked whether you can carry a job that has not been defined yet, and that will change twice before your first anniversary. Same catalog, very different emphasis." },
              { t: "h", text: "What is actually being tested" },
              {
                t: "ul", items: [
                  "<strong>Breadth over depth.</strong> Can you cover the four things nobody is hired for yet — deploys, on-call, the customer call, the migration script?",
                  "<strong>Operating without structure.</strong> There is no platform team, no QA function, and no process to appeal to. Did you ever create the structure rather than use it?",
                  "<strong>Appetite for unglamorous work.</strong> At this size everyone does it, and someone who signals they are above it is a fast no.",
                  "<strong>Durability through change.</strong> Will you still be useful when the product pivots and your speciality stops mattering?"
                ]
              },
              {
                t: "table",
                headers: ["Dimension", "Large-company loop", "Small-company loop"],
                rows: [
                  ["Who interviews you", "Trained interviewers, often outside your team", "Founders and the first few engineers, usually untrained"],
                  ["Calibration", "Rubrics, written feedback, cross-candidate comparison", "Taste, gut, and comparison to whoever they hired last"],
                  ["Signal depth", "Three probes deep on one story", "Broad sweep across many things you have done"],
                  ["What a rejection means", "A specific signal came in below the bar", "Often fit or taste rather than a bar — much noisier evidence"],
                  ["Variance", "Low; the process is the product", "High; a good conversation can carry the whole loop"]
                ]
              },
              { t: "p", html: "That table is not a ranking. The large-company loop is fairer and slower; the small-company loop is faster and noisier. The practical consequence is that you should not over-correct your bank after a single startup rejection — the sample size is one interviewer's taste." },
              { t: "h", text: "Re-angling the same story" },
              { t: "p", html: "The parts of your story you normally compress are the parts that matter here. Nothing is invented; you are expanding a different twenty seconds." },
              {
                t: "compare",
                bad: { title: "The big-company answer, replayed", items: ["\"I worked with the platform team to provision the cluster\"", "\"It went through architecture review and the migration council\"", "\"My scope was the gateway integration specifically\"", "\"We had a dedicated on-call rotation for it\"", "Founder hears: needs a lot of scaffolding to function"] },
                good: { title: "The same story, re-angled", items: ["\"There was no platform team, so the migration plan and the on-call rotation were the same document\"", "\"I wrote the plan, got the two people who cared to review it, and started\"", "\"I owned the integration, the runbook, and the two customer calls when it broke\"", "\"I carried the pager for it for the first month, on purpose\"", "Founder hears: this person will close things end to end"] }
              },
              { t: "note", variant: "tip", html: "The strongest single sentence you can offer a founder is one where a support function was absent and you absorbed it anyway. It answers breadth, ownership and appetite in one move — and unlike most claims, it is self-evidently true or false under a follow-up." },
              { t: "h", text: "Evidence you can operate without structure" },
              {
                t: "ul", items: [
                  "You <strong>created the process that did not exist</strong> — the first postmortem template, the first on-call rota — and kept it lightweight.",
                  "You <strong>chose what not to build</strong>, and can say what you deliberately did by hand instead.",
                  "You shipped with no QA function, and can describe what you did instead of hoping.",
                  "You <strong>talked to users directly</strong> rather than through a product manager.",
                  "You worked without a spec, and wrote the spec that ended the confusion."
                ]
              },
              { t: "note", variant: "warn", html: "<strong>The trade-off cuts both ways.</strong> Scrappiness told at a large company reads as process-hostile — they hear \"will ship around review\". Process discipline told at a startup reads as slow and dependent. And do not over-rotate: a founder who concludes you will ignore <em>all</em> process is also a no, because they have been burned by exactly that hire. The line to hold is \"I create the minimum structure the problem needs, and I say why\"." },
              { t: "h", text: "The founder round" },
              { t: "p", html: "A founder is judging fit for a role that does not exist yet, usually with no rubric and no calibration. Story <em>selection</em> therefore matters more here than anywhere else — see <a href=\"#/beh/foundation/select\">selecting the right story</a> — because a well-told story about the wrong thing lands flat and you will not be told why." },
              { t: "p", html: "Expect \"why would you leave a stable job for this?\". Answer it about the work — the surface area, the closeness to users, the speed of the loop between decision and consequence. Answering it about equity invites a conversation about risk you are unlikely to win, and answering it about frustration makes you a flight risk twice over." },
              { t: "cue", html: "<strong>Adjust when you hear these.</strong> \"There is no one else doing this right now\", \"we all take support shifts\", \"the role will probably change in six months\", \"what would you do in your first two weeks?\". Every one of them is asking for the breadth-and-no-structure version of your catalog." },
              { t: "note", variant: "key", html: "<strong>Same stories, different twenty seconds.</strong> Expand the runbook, the pager, the customer call, the structure you created from nothing — and compress the review gates and the platform-team support. Hold the honest line between scrappy and reckless, because both companies are screening for the same failure from opposite sides." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "manager-track",
            title: "The engineering-manager round",
            summary: "People stories instead of code stories, the difficult conversation, delivery under constraint, and credibility without taking the keyboard.",
            minutes: 10,
            tags: ["playbooks", "manager", "leadership"],
            blocks: [
              { t: "p", html: "The manager round asks what happened to the <strong>people and the delivery</strong>. Your best engineering stories become backdrop: the system you built is context, and the story is what you did about the person who was struggling, the date that was not going to be met, or the hire you got wrong." },
              { t: "p", html: "Candidates moving from a senior IC role usually have a bank that is entirely code stories and assume it transfers. It does not. This is a coverage problem of exactly the kind <a href=\"#/story/catalog/coverage-matrix\">the grid</a> is for — with different columns." },
              { t: "h", text: "The five areas you need material for" },
              {
                t: "table",
                headers: ["Area", "The question underneath", "What the story must contain"],
                rows: [
                  ["Performance management", "Will you have the hard conversation, early, with support?", "The first sentence you said, the timeline, and the outcome — including if they left"],
                  ["Delivery under constraint", "Do you cut scope and communicate, or absorb and hope?", "What you cut, who you told, and when you told them"],
                  ["Hiring", "Can you hold a bar under pressure to fill a seat?", "A bar call you held, or a hire you got wrong and what you changed"],
                  ["Growing people", "Do people get better on your team?", "One named-but-anonymised person, one change, and what they can do now"],
                  ["The technical call you did not make yourself", "Can you be credible without taking over?", "The risk you named, the design you pushed back on, and who you trusted to decide"]
                ]
              },
              { t: "h", text: "The difficult conversation" },
              { t: "p", html: "This is the round's centre of gravity, and vagueness here is fatal. \"I gave them feedback and we made a plan\" is not a story; it is a summary of a story you are declining to tell." },
              {
                t: "ol", items: [
                  "<strong>The first sentence you actually said.</strong> Quote yourself. This single detail is the strongest signal in the answer.",
                  "<strong>The timeline.</strong> When you first noticed, versus when you spoke. If the gap was three months, say so and say why — that is the honest version.",
                  "<strong>The support you put in place.</strong> What you changed about the work, the pairing, the expectations.",
                  "<strong>The outcome, including the uncomfortable one.</strong> They improved, they moved, or they left. All three are acceptable answers; \"it resolved itself\" is not.",
                  "<strong>What you would do earlier.</strong> Almost always: speak sooner. Say what stopped you last time."
                ]
              },
              { t: "note", variant: "tip", html: "Managers who have really had these conversations remember the opening line, because they rehearsed it and then sat with it. Interviewers know this. Being able to say \"I opened with: I want to talk about the last two sprints, and I am worried\" is worth more than any amount of framework vocabulary." },
              { t: "note", variant: "trap", html: "<strong>Two failure modes, both instant.</strong> The first is badmouthing the report — a manager who criticises a former report's character to a stranger will do it to their next team, and the interviewer will end the line of questioning right there. The second is the story where you never actually said the hard thing and the problem resolved itself; a listening interviewer notices the conversation is missing from your conversation story." },
              { t: "p", html: "Discretion is part of the answer. Anonymise, describe behaviour rather than character, never state a real person's rating, and do not make the interviewer feel like a confidant in something they should not know. Doing this well is itself a signal — it shows how you will talk about your team when they are not in the room." },
              { t: "h", text: "Delivery under constraint" },
              { t: "p", html: "The engineering version of this story is \"we worked hard and got it done\". The manager version is <strong>what you cut, who you told, and when</strong>. The cut is the story; the heroics are a warning sign, because a team that got there by burning itself did not have a manager managing." },
              {
                t: "code", lang: "text", code:
                  "constraint : 6 weeks, 4 engineers, an external date that could not move\n" +
                  "cut        : the admin UI -> replaced by a script the ops team ran manually\n" +
                  "told       : the sponsor in week 1, with the trade-off written down\n" +
                  "held       : no weekends; two people were already close to burnt out\n" +
                  "result     : external commitment shipped; admin UI landed 5 weeks later\n" +
                  "your part  : made the cut, negotiated it, carried the message upward"
              },
              { t: "p", html: "Week one is the load-bearing detail. Telling the sponsor in week five is a different story with a different score, and interviewers ask for the date precisely to find out which one you are telling. The three questions you can count on being asked in any round are covered in <a href=\"#/beh/delivery/big-three\">the big three</a>; the manager variants are the same questions aimed at people rather than systems." },
              { t: "h", text: "Technical credibility without the keyboard" },
              {
                t: "compare",
                bad: { title: "Reverting to senior IC", items: ["\"So I rewrote the service myself over that weekend\"", "Answers a people question with an engineering solution", "Design critique that reads as \"my design was better\"", "Team's technical decisions all trace back to you", "Reads as: will not scale past six reports"] },
                good: { title: "Credible without taking over", items: ["\"I asked the two questions that surfaced the migration risk\"", "Names the risk they raised and who owned the decision", "\"I pushed back once, they convinced me, and they were right\"", "Can say which engineer they trust on what, and why", "Reads as: technical judgement, applied through people"] }
              },
              { t: "p", html: "Credibility is demonstrated by the questions you asked, the risk you named that turned out to be the one that bit, the design you pushed back on with a reason, and knowing which of your engineers to trust on which kind of problem. All four are available to a manager who has not written production code in two years — and all four are more convincing than a story about your own commit." },
              { t: "cue", html: "<strong>Prompts that need a people story, not a project story.</strong> \"Tell me about a time you had to give difficult feedback\", \"a project that was going to miss\", \"someone on your team who was not performing\", \"a hire you regret\", \"how do you know whether your team is doing good work?\" If your instinct is to answer any of these with an architecture, that is the gap to fill first." },
              { t: "note", variant: "key", html: "<strong>People stories, with dates and sentences in them.</strong> Quote your opening line in the difficult conversation, name what you cut and when you told the sponsor, and prove technical credibility through the questions and risks you raised rather than the code you wrote. Never criticise a former report's character — that answer ends the round." }
            ]
          },

          /* ---------------------------------------------------------- */
          {
            id: "mock-drills",
            title: "Drills that actually build the skill",
            summary: "A prompt rotation, the three-probe follow-up drill, self-scoring against the signals, and a four-week schedule.",
            minutes: 10,
            tags: ["playbooks", "practice", "drills"],
            blocks: [
              { t: "p", html: "Answers almost never fail in the first ninety seconds. They fail at minute four, when the prepared material runs out and the interviewer is still asking. So drill the part that fails: selection speed at the front, and depth under probing at the back." },
              { t: "p", html: "The general practice advice — out loud, recorded, with a partner, spaced out rather than crammed — is in <a href=\"#/beh/advanced/practicing\">how to practise</a>. This lesson is the drill protocol for the bank you have just built." },
              { t: "h", text: "Drill 1 · the rotation" },
              {
                t: "ol", items: [
                  "Write twelve prompts on cards — two per signal for the six you are most likely to be asked about.",
                  "Shuffle. Draw one. Start a two-minute timer.",
                  "<strong>Name the story within ten seconds.</strong> Out loud, before you start answering.",
                  "Answer for the remaining time. Stop when the timer stops, mid-sentence if necessary.",
                  "Draw again. Six prompts is a session, and a session is fifteen minutes."
                ]
              },
              { t: "p", html: "The ten-second rule is the actual drill. In the room, the silence while you hunt for a story is where you commit to the wrong one — you reach for the most impressive rather than the most relevant, and then spend three minutes defending that choice. The selection technique itself is in <a href=\"#/beh/foundation/select\">selecting a story</a>; the rotation is what makes it fast enough to use under pressure." },
              {
                t: "stat", items: [
                  { v: "10 s", k: "to name the story" },
                  { v: "2 min", k: "per answer" },
                  { v: "3", k: "probes after every answer" }
                ]
              },
              { t: "h", text: "Drill 2 · the three probes" },
              { t: "p", html: "After every answer, three follow-ups, always in the same order: <strong>your contribution</strong>, then <strong>the option you rejected</strong>, then <strong>the measurement</strong>. Deliberately predictable, because the point is not to surprise you — it is to find out whether the material exists." },
              { t: "widget", id: "storyDrill" },
              { t: "p", html: "Notice how boring the probes are. That is the finding: a real interviewer's follow-ups are largely predictable, so a story either has a second layer or it does not, and you can know which before the loop rather than during it. Where a probe comes back empty, the fix is usually in your journal entry, not in your delivery." },
              { t: "h", text: "Drill 3 · self-scoring" },
              {
                t: "table",
                headers: ["Score", "What it means", "What to fix"],
                rows: [
                  ["0", "The element was absent", "Go back to the journal entry, or retire the story"],
                  ["1", "Present but vague — the interviewer would have to dig", "Write one specific sentence for it and say that sentence out loud next time"],
                  ["2", "Stated clearly, without prompting", "Nothing. Leave it alone and stop polishing it"]
                ]
              },
              { t: "p", html: "Score four elements after each answer. It takes thirty seconds and it is the only part of practice that tells you where to spend the next hour." },
              {
                t: "code", lang: "text", code:
                  "prompt : \"tell me about a time you disagreed with someone\"\n" +
                  "story  : design review pushback\n" +
                  "\n" +
                  "  contribution isolated ....... 2\n" +
                  "  the fork is visible ......... 1   <- name the option I argued against\n" +
                  "  result has a number ......... 0   <- no number exists; go find one\n" +
                  "  after-state addressed ....... 2\n" +
                  "\n" +
                  "next action: 10 min in the old review thread for the latency figure"
              },
              { t: "note", variant: "warn", html: "<strong>Over-rehearsal is a real cost.</strong> Drill the material, not the wording. A word-for-word answer reads canned, and it collapses when the prompt shifts even slightly, because you are now recalling a script instead of describing something you did. Warning signs: identical phrasing across two sessions, no natural hesitation at all, and irritation when someone interrupts you." },
              { t: "h", text: "A four-week schedule" },
              {
                t: "table",
                headers: ["Week", "Focus", "The session"],
                rows: [
                  ["1", "Coverage", "Mine your archive, fill the empty columns on the grid, write the five fields for anything new"],
                  ["2", "Selection", "Rotation drill, three sessions. Self-score. No probes yet"],
                  ["3", "Depth", "Three probes on your weakest four stories. Fix the zeros by finding the missing number or retiring the story"],
                  ["4", "Integration", "Full mock in your actual round order, using the map from <a href=\"#/story/playbooks/big-tech\">the mapping step</a>, with a partner running the probes"]
                ]
              },
              { t: "p", html: "If you have less time, cut week two before week three. Selection improves quickly with a handful of reps; depth only improves by going back to the source material, and that takes calendar time you cannot compress." },
              { t: "h", text: "Closing the arc" },
              { t: "p", html: "The whole track is one pipeline. <a href=\"#/story/catalog/journaling\">Capture</a> produces raw entries; <a href=\"#/story/catalog/story-anatomy\">anatomy</a> turns an entry into something several prompts can call; <a href=\"#/story/catalog/scope-signal\">scope</a>, <a href=\"#/story/catalog/ownership-ambiguity\">ownership</a> and <a href=\"#/story/catalog/conflict-growth\">conflict and growth</a> shape it for the signals that decide the outcome; <a href=\"#/story/catalog/coverage-matrix\">the grid</a> tells you what is missing; and the playbooks aim the same catalog at whichever loop you are walking into." },
              { t: "p", html: "The thing worth internalising is that the bank is an <strong>asset with a maintenance schedule</strong>, not a project you finish. Keep the Friday ten minutes running after this loop closes. The next search will cost you a fraction of this one, and a loop where every round had real material behind it is what produces multiple live offers — which is where <a href=\"#/offer/anatomy/leverage\">negotiating leverage</a> comes from in the first place." },
              { t: "cue", html: "<strong>You are ready when</strong> you can name a story within ten seconds of any of your twelve prompts, every story survives three probes without a zero, no signal rests on a single story, and you have said each of them out loud to another human at least once." },
              { t: "note", variant: "key", html: "<strong>Drill selection at the front and depth at the back.</strong> Ten seconds to name the story, two minutes to tell it, three predictable probes after it, and a four-element score that tells you where the next hour goes. Rehearse the material, never the wording — and keep the journal running, because the bank is an asset you maintain rather than a thing you build once." },
              { t: "quiz", id: "story-playbooks" }
            ]
          }
        ]
      }
    ]
  };
})();
