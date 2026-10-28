/* =====================================================================
   COMPASS · Behavioral Course track  (curriculum + quizzes + widgets)
   window.TRACKS.beh — the human side of the interview loop, treated as
   an engineering problem: rubric, naming, selection, structure, repair.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGET HELPERS (local to this file)
     ===================================================================== */
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
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function segbar(items, isActive, onPick) {
    var wrap = h("div", { class: "w-seg" });
    var btns = [];
    items.forEach(function (it) {
      var b = h("button", { class: "w-seg-btn" + (isActive(it.v) ? " active" : ""), type: "button" }, it.label);
      b.addEventListener("click", function () {
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
        b.classList.add("active");
        onPick(it.v);
      });
      btns.push(b);
      wrap.appendChild(b);
    });
    return wrap;
  }

  var Widgets = {};

  /* ---------------------------------------------------------------
     WIDGET 1 — behSelector · "Pick the right story"
     Deterministic scoring of four bench stories against a probed
     signal, on Scope / Relevance / Uniqueness / Recency.
     Weighted score = relevance*3 + scope*2 + uniqueness*2 + recency*1
     (each raw criterion is 1..4, so the ceiling is 32).
  --------------------------------------------------------------- */
  Widgets.behSelector = function (mount) {
    shell(mount, "selector", "Pick the right story",
      "Choose a prompt, then pick the story you would actually tell. The panel scores your choice on scope, relevance, uniqueness and recency — so does this. Watch how often your instinct matches the best available pick.");

    var PROMPTS = [
      {
        v: "conflict", tab: "Disagreement",
        text: "Tell me about a time you disagreed with a teammate and still had to work with them afterwards.",
        signal: "Conflict and collaboration",
        why: "It is the only story on the bench with two defensible positions and a relationship that survived the argument. Scope is modest, and that is fine — this prompt is not scoring size."
      },
      {
        v: "ambiguity", tab: "Moving target",
        text: "Describe a project where the requirements kept moving under you.",
        signal: "Dealing with ambiguity",
        why: "Undefined owner, undefined finish line, and you created the structure that made it finishable. That is exactly the evidence this signal asks for."
      },
      {
        v: "scope", tab: "Biggest impact",
        text: "What is the largest-impact thing you have shipped?",
        signal: "Scope and impact",
        why: "Biggest blast radius, cleanest number, and recent enough that it still describes who you are now. Lead with the result, not the architecture."
      },
      {
        v: "ownership", tab: "It broke",
        text: "Tell me about a time something broke on your watch.",
        signal: "Ownership",
        why: "It edges out the latency rescue because nobody assigned it to you — and unassigned is where ownership actually gets proved. Two strong options here; break the tie on which one you have not spent yet."
      },
      {
        v: "action", tab: "No data",
        text: "Tell me about a decision you had to make without enough information.",
        signal: "Bias for action",
        why: "You moved before the root cause was confirmed, and you had a reversal plan. Speed proportional to the cost of being wrong is the whole signal."
      }
    ];

    var STORIES = [
      {
        v: "latency", name: "checkout latency rescue",
        one: "Revenue-visible p99 regression; you led the fix while the cause was still unconfirmed.",
        scope: 4, uniq: 2, rec: 4,
        rel: { conflict: 1, ambiguity: 2, scope: 4, ownership: 4, action: 4 }
      },
      {
        v: "migration", name: "the migration nobody owned",
        one: "A half-finished datastore move with no owner; you claimed it and defined what done meant.",
        scope: 3, uniq: 4, rec: 3,
        rel: { conflict: 2, ambiguity: 4, scope: 3, ownership: 4, action: 3 }
      },
      {
        v: "review", name: "the design review you lost",
        one: "You argued for one approach, were overruled, then made the other approach work.",
        scope: 2, uniq: 4, rec: 2,
        rel: { conflict: 4, ambiguity: 2, scope: 2, ownership: 1, action: 1 }
      },
      {
        v: "onboarding", name: "the onboarding rewrite",
        one: "Two new hires floundered, so you rewrote how the team brings people in.",
        scope: 2, uniq: 3, rec: 1,
        rel: { conflict: 2, ambiguity: 2, scope: 1, ownership: 3, action: 2 }
      }
    ];

    var WEAKNESS = {
      rel: "it does not actually prove the signal being probed, however good it is",
      scope: "it is too small to move a level — a tidy story about a small thing reads as a small candidate",
      uniq: "it is your obvious story, so you have probably already spent it earlier in the loop",
      rec: "it is old enough to invite the follow-up you do not want: and what about since then?"
    };

    var pIdx = 0, chosen = null, reps = 0, hits = 0;

    function relOf(st, p) { var r = st.rel[p.v]; return typeof r === "number" ? r : 1; }
    function scoreOf(st, p) { return relOf(st, p) * 3 + st.scope * 2 + st.uniq * 2 + st.rec; }
    function bestOf(p) {
      var top = STORIES[0], i;
      for (i = 1; i < STORIES.length; i++) if (scoreOf(STORIES[i], p) > scoreOf(top, p)) top = STORIES[i];
      return top;
    }
    function weakestOf(st, p) {
      var pairs = [
        { k: "rel", n: relOf(st, p) },
        { k: "scope", n: st.scope },
        { k: "uniq", n: st.uniq },
        { k: "rec", n: st.rec }
      ];
      var w = pairs[0], i;
      for (i = 1; i < pairs.length; i++) if (pairs[i].n < w.n) w = pairs[i];
      return w.k;
    }

    var promptLine = h("p", { style: "font-size:.95rem;line-height:1.55;margin-bottom:14px" });
    var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px" });
    var verdict = h("div", { style: "font-size:.86rem;line-height:1.6;min-height:52px" });
    var bars = h("div", { style: "margin-top:12px" });
    var readout = h("div", { class: "w-readout" });
    var stage = h("div", { class: "w-stage" }, promptLine, row, verdict, bars);

    var storyBtns = STORIES.map(function (st) {
      var b = h("button", { class: "w-btn", type: "button" }, st.name);
      b.addEventListener("click", function () {
        chosen = st;
        reps++;
        if (st === bestOf(PROMPTS[pIdx])) hits++;
        paint();
      });
      return b;
    });
    storyBtns.forEach(function (b) { row.appendChild(b); });

    function barRow(label, raw, weight, max) {
      var pct = Math.round((raw / 4) * 100);
      var fill = h("i", { style: "display:block;height:100%;width:" + pct + "%;background:var(--accent);border-radius:4px" });
      var track = h("span", { style: "display:block;flex:1;height:7px;border-radius:4px;background:var(--glass-border);overflow:hidden" }, fill);
      return h("div", { style: "display:flex;align-items:center;gap:10px;margin:5px 0;font-family:var(--font-mono);font-size:.68rem;color:var(--text-dim)" },
        h("span", { style: "min-width:82px" }, label),
        track,
        h("span", { style: "min-width:74px;text-align:right" }, raw + "/4 \u00d7" + weight + " = " + (raw * weight) + "/" + max));
    }

    function paint() {
      var p = PROMPTS[pIdx];
      var best = bestOf(p);
      promptLine.innerHTML = "<strong>Prompt:</strong> " + p.text;

      storyBtns.forEach(function (b, i) {
        var st = STORIES[i];
        b.textContent = st.name + " \u00b7 " + scoreOf(st, p) + "/32";
        b.className = "w-btn" + (chosen === st ? " primary" : "");
      });

      bars.innerHTML = "";
      if (!chosen) {
        verdict.innerHTML = "This prompt is probing <strong>" + p.signal + "</strong>. Pick the story you would open with, then compare.";
      } else {
        var mine = scoreOf(chosen, p), top = scoreOf(best, p);
        if (chosen === best) {
          verdict.innerHTML = "<strong>Match.</strong> " + cap(best.name) + " is the strongest pick for " + p.signal.toLowerCase() + ". " + p.why;
        } else {
          verdict.innerHTML = "<strong>Not the strongest pick.</strong> " + cap(chosen.name) + " scores " + mine +
            "/32 against " + top + "/32 for " + best.name + ". Its weakest criterion here: " + WEAKNESS[weakestOf(chosen, p)] +
            ". " + p.why;
        }
        bars.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.64rem;color:var(--text-faint);margin:10px 0 4px" },
          cap(chosen.name) + " \u2014 " + chosen.one));
        bars.appendChild(barRow("relevance", relOf(chosen, p), 3, 12));
        bars.appendChild(barRow("scope", chosen.scope, 2, 8));
        bars.appendChild(barRow("uniqueness", chosen.uniq, 2, 8));
        bars.appendChild(barRow("recency", chosen.rec, 1, 4));
      }

      readout.innerHTML = "";
      readout.appendChild(ro("probing", p.signal));
      readout.appendChild(ro("best pick", best.name));
      readout.appendChild(ro("your pick", chosen ? chosen.name : "\u2014"));
      readout.appendChild(ro("reps", reps));
      readout.appendChild(ro("matched best", hits + "/" + reps));
      readout.appendChild(ro("hit rate", reps ? Math.round((hits / reps) * 100) + "%" : "\u2014"));
    }

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    mount.appendChild(h("div", { class: "widget-controls" },
      segbar(PROMPTS.map(function (p, i) { return { v: i, label: p.tab }; }),
        function (v) { return v === pIdx; },
        function (v) { pIdx = v; chosen = null; reps++; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     WIDGET 2 — behSaltTimer · "Budget the two minutes"
     Pure arithmetic: shares per complexity, Actions absorbs the
     rounding residual so the beats always sum to the total.
     No clock, no interval — budgets only.
  --------------------------------------------------------------- */
  Widgets.behSaltTimer = function (mount) {
    shell(mount, "planner", "Budget the two minutes",
      "Pick a length and a story shape. The beats are budgeted deterministically so they always sum to the total. This shows budgets — it does not run a clock.");

    var SHARES = {
      simple: [0.18, 0.46, 0.22, 0.14],
      layered: [0.22, 0.44, 0.22, 0.12],
      multi: [0.28, 0.42, 0.20, 0.10]
    };
    var SHAPE_NOTE = {
      simple: "One team, one decision, one outcome. Setup can be two sentences because there is almost nothing to establish.",
      layered: "One team, but the decision had a real alternative you rejected. Setup has to carry a constraint as well as a situation.",
      multi: "Several teams, competing goals, a longer horizon. This is the shape that eats your Setup budget alive."
    };
    var BEATS = [
      { key: "setup", name: "Setup", must: "who, the stake, and the one constraint that made it hard" },
      { key: "actions", name: "Actions", must: "what you personally decided and did, in first person" },
      { key: "landing", name: "Landing", must: "a number or a direction, and who it affected" },
      { key: "takeaway", name: "Takeaway", must: "the habit you changed, and that you have used it since" }
    ];

    var total = 120, mode = "layered";

    function budget(tot, m) {
      var s = SHARES[m] || SHARES.layered;
      var t = typeof tot === "number" && tot > 0 ? tot : 120;
      var setup = Math.round(t * s[0]);
      var landing = Math.round(t * s[2]);
      var takeaway = Math.round(t * s[3]);
      var actions = t - setup - landing - takeaway;
      if (actions < 1) actions = 1;
      return { setup: setup, actions: actions, landing: landing, takeaway: takeaway, total: t };
    }

    var shapeLine = h("p", { style: "font-size:.86rem;line-height:1.55;color:var(--text-dim);margin-bottom:12px" });
    var beatBox = h("div", {});
    var warnBox = h("div", { style: "margin-top:12px;font-size:.84rem;line-height:1.55" });
    var readout = h("div", { class: "w-readout" });
    var stage = h("div", { class: "w-stage" }, shapeLine, beatBox, warnBox);

    var select = h("select", { "aria-label": "Total answer length in seconds" });
    [60, 90, 120, 180].forEach(function (n) {
      select.appendChild(h("option", { value: String(n) }, n + " seconds"));
    });
    select.value = "120";
    select.addEventListener("change", function () {
      var n = parseInt(select.value, 10);
      total = isNaN(n) ? 120 : n;
      paint();
    });

    function beatRow(name, secs, tot, must) {
      var pct = tot > 0 ? Math.round((secs / tot) * 100) : 0;
      var fill = h("i", { style: "display:block;height:100%;width:" + pct + "%;background:var(--accent);border-radius:4px" });
      var track = h("span", { style: "display:block;height:9px;border-radius:4px;background:var(--glass-border);overflow:hidden;margin:5px 0 3px" }, fill);
      return h("div", { style: "margin:0 0 12px" },
        h("div", { style: "display:flex;justify-content:space-between;gap:12px;font-family:var(--font-mono);font-size:.72rem;color:var(--text-dim)" },
          h("span", {}, name),
          h("b", { style: "color:var(--accent-ink)" }, secs + "s \u00b7 " + pct + "%")),
        track,
        h("div", { style: "font-size:.76rem;color:var(--text-faint);line-height:1.45" }, must));
    }

    function paint() {
      var b = budget(total, mode);
      var share = b.total > 0 ? b.setup / b.total : 0;
      var pct = Math.round(share * 100);

      shapeLine.textContent = SHAPE_NOTE[mode] || SHAPE_NOTE.layered;

      beatBox.innerHTML = "";
      BEATS.forEach(function (beat) {
        beatBox.appendChild(beatRow(beat.name, b[beat.key], b.total, beat.must));
      });

      if (share > 0.25) {
        warnBox.innerHTML = "<strong style='color:var(--accent-ink)'>Setup is over budget at " + pct + "%.</strong> " +
          "Past about a quarter of the answer, setup starts eating the beats that actually score. " +
          "Cut names, dates and org structure until only the stake and the constraint remain \u2014 target " +
          Math.round(b.total * 0.22) + "s or less.";
      } else {
        warnBox.innerHTML = "<strong>Setup is in budget at " + pct + "%.</strong> " +
          "Keep it there. The moment you start explaining the org chart you are spending Landing and Takeaway time.";
      }

      readout.innerHTML = "";
      readout.appendChild(ro("setup", b.setup + "s"));
      readout.appendChild(ro("actions", b.actions + "s"));
      readout.appendChild(ro("landing", b.landing + "s"));
      readout.appendChild(ro("takeaway", b.takeaway + "s"));
      readout.appendChild(ro("setup share", pct + "%"));
      readout.appendChild(ro("\u2248 words", Math.round(b.total * 2.25)));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "answer length", select),
      segbar([
        { v: "simple", label: "Simple" },
        { v: "layered", label: "Layered" },
        { v: "multi", label: "Multi-team" }
      ], function (v) { return v === mode; }, function (v) { mode = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {

    "beh-foundation": {
      title: "Foundations checkpoint",
      sub: "The rubric behind the round, reading the question behind the question, and choosing a story fast.",
      questions: [
        {
          q: "Why does the behavioral round so often decide the level of an offer rather than simply whether there is one?",
          options: [
            "Technical rounds are scored leniently, so the behavioral round exists to break ties",
            "It is usually scheduled last, so it carries the most recent-impression weight",
            "It produces written evidence of scope, ownership and judgement \u2014 which is exactly the language level bands are written in",
            "The hiring manager is the only interviewer who writes a debrief"
          ],
          answer: 2,
          explain: "Level bands are defined in terms of how large a problem you can be trusted with, how much ambiguity you absorb, and how far your influence reaches \u2014 and stories are the only evidence for any of that. Coding and design rounds mostly answer a yes/no question: can this person build the thing. Scheduling order and who writes the debrief do not enter the calibration."
        },
        {
          q: "An interviewer asks: tell me about a time you had to make a call without enough information. Which signal is this primarily probing?",
          options: ["Communication", "Scope and impact", "Growth and self-awareness", "Bias for action"],
          answer: 3,
          explain: "The prompt is built around acting under uncertainty, which is what bias for action measures \u2014 did you move, and did you move at a speed proportional to the cost of being wrong. Communication is probed by how you tell any story, not by what this one is about. A fast call can also carry scope, but that is a bonus rather than the probe."
        },
        {
          q: "What would you do if a teammate consistently missed their commitments? What kind of question is this, and what does preparing for it require?",
          options: [
            "Hypothetical \u2014 rehearse a decision process, then anchor it to something you actually did",
            "Background \u2014 walk the interviewer through your project history",
            "Behavioral \u2014 rehearse a matching story from your past",
            "Hypothetical \u2014 answer purely in the abstract so you cannot be pinned to specifics"
          ],
          answer: 0,
          explain: "What would you do is hypothetical, so the interviewer is scoring your reasoning process rather than your history. The strongest shape states how you would decide and then grounds it briefly in a real precedent, which converts an opinion into evidence. Answering purely in the abstract is the common failure: it reads as untested."
        },
        {
          q: "Once you have named the signal, what should the first sentence of your answer usually do?",
          options: [
            "Establish the company, the team size and the quarter",
            "Name the outcome, so the interviewer immediately knows what the story is evidence of",
            "Ask the interviewer to clarify what they are looking for",
            "State out loud which signal you are about to demonstrate"
          ],
          answer: 1,
          explain: "Opening on the outcome gives the listener a frame to hang every later detail on, and it protects you if the story gets cut short. Context-first openings spend your budget before you have said anything scoreable. Announcing the signal out loud sounds coached and scores nothing on its own."
        },
        {
          q: "You have a large, perfectly relevant story \u2014 but you already told it in an earlier round of the same loop. What does the Uniqueness criterion tell you to do?",
          options: [
            "Tell it again; consistency across rounds is itself a positive signal",
            "Tell it again but change the details so it sounds like a different story",
            "Lead with your next-best story for that signal and mention the first only if asked",
            "Decline the question and ask for a different one"
          ],
          answer: 2,
          explain: "Interviewers compare notes in the debrief, so a repeated story gives the panel one data point where they expected several, and your experience reads as thin. Disguising a repeat by changing details is dishonest and easy to catch when the notes are compared. Leading with your second-best story for that signal is exactly what keeping a shortlist is for."
        },
        {
          q: "What problem is the story shortlist actually solving?",
          options: [
            "It gives you a script so you never have to improvise wording",
            "It shortens your answers by letting you drop the Setup beat",
            "It guarantees you have a story for every one of the eight signal areas",
            "It turns story selection from invention under pressure into retrieval from a prepared, signal-indexed set"
          ],
          answer: 3,
          explain: "The hard part in the room is not telling a story, it is choosing one in about three seconds while your working memory is already full. Indexing a small set of stories by the signal each proves converts that choice into a lookup. It does not script your wording, and it does not by itself guarantee full coverage \u2014 checking coverage is a separate pass."
        },
        {
          q: "Which of these is the strongest evidence of ownership specifically, rather than of scope?",
          options: [
            "You noticed a problem that had not been assigned to anyone and carried it to a resolution",
            "The project touched four teams and reached about twelve million users",
            "You were the tech lead named on the design document",
            "You delivered the work two weeks ahead of the committed date"
          ],
          answer: 0,
          explain: "Ownership is measured by what you do when the responsibility has not been handed to you: noticing, claiming, and finishing. Team counts and user numbers are scope, a title on a document is assignment rather than ownership, and shipping early is execution. One story can carry several signals, but the ownership evidence is specifically the unassigned part."
        }
      ]
    },

    "beh-delivery": {
      title: "Delivery craft checkpoint",
      sub: "Four beats, time budgets, the big three questions, and the habits that quietly cost offers.",
      questions: [
        {
          q: "In SALT, what does the Takeaway beat buy you that the more familiar four-beat structure leaves out?",
          options: [
            "A second chance to restate the result with numbers",
            "Explicit evidence of growth and self-awareness \u2014 what you changed afterwards and have used since",
            "Extra runway, since it is the longest of the four beats",
            "A place to credit teammates so the story does not sound arrogant"
          ],
          answer: 1,
          explain: "The familiar four-beat version ends at the result, which shows you can execute but says nothing about whether you improve. The Takeaway is the only beat where growth and self-awareness get scored, and it is the beat candidates drop first when they run short on time. Credit for teammates belongs inside Actions, phrased so your own contribution stays separable."
        },
        {
          q: "In a two-minute answer, roughly how much of the time should Context take?",
          options: [
            "About half \u2014 the interviewer needs the full background before anything makes sense",
            "About ten seconds; skip almost straight to what you did",
            "About a fifth to a quarter, so roughly twenty to thirty seconds",
            "It varies so much between stories that a budget is not useful"
          ],
          answer: 2,
          explain: "Setup exists only to make the Actions legible, so it needs the stake and the one constraint that made the problem hard \u2014 usually twenty to thirty seconds of a two-minute answer. Spending half your budget there is the classic failure, because you then run out of time in the beats that actually score. Ten seconds is usually too thin for anything but the simplest story."
        },
        {
          q: "Why is saying we throughout a story the most damaging of the common habits?",
          options: [
            "It makes you sound arrogant about the team's work",
            "It wastes time, because we takes longer to say than I",
            "It signals that you are uncomfortable working in a team",
            "The interviewer cannot separate your contribution from the team's, so there is nothing individual left to score"
          ],
          answer: 3,
          explain: "The debrief asks what this candidate did, and a story told entirely in we gives the interviewer no sentence they can write down as your work. It is almost never read as arrogance or as poor teamwork; it is read as an absence of evidence, which scores the same as a weak story. Use we for the shared goal and I for every decision and action that was genuinely yours."
        },
        {
          q: "Your employer treats the real numbers as confidential. What is the strongest way to still deliver a Landing beat?",
          options: [
            "Give direction, relative magnitude and who it affected \u2014 for example, roughly halved the weekly on-call pages for a six-person team",
            "Say you are not able to discuss results and move on to the next question",
            "Use a plausible invented number so the shape of the answer is right",
            "Go deeper on the technical change instead, since that part is not confidential"
          ],
          answer: 0,
          explain: "Relative and directional results are almost always shareable and still let the interviewer size the impact, which is all the beat is for. Declining outright leaves the beat empty, and an empty Result scores the same as no result. Inventing numbers is disqualifying if it is caught, and extra technical depth is not a substitute for an outcome."
        },
        {
          q: "Which of these is a real Takeaway beat rather than a platitude?",
          options: [
            "I learned how important communication is on a big project",
            "I now write a one-page risk note before any migration that touches customer data, and I have used it on three since",
            "I learned that you should always test in a production-like environment",
            "I learned that I do my best work under pressure"
          ],
          answer: 1,
          explain: "A real takeaway names a specific behaviour change and shows that it stuck, which is what makes it evidence rather than a sentiment. Generic statements about communication, testing or pressure are unfalsifiable and interviewers hear them several times a week. Turning a lesson into a repeatable habit is what separates a scored Takeaway beat from a filler sentence."
        },
        {
          q: "You are approaching two minutes and the Landing is still ahead of you. What is the best recovery?",
          options: [
            "Speed up and get through all the remaining detail",
            "Stop and ask whether the interviewer would like you to continue",
            "Cut the remaining Actions detail, deliver Landing and Takeaway, and offer the detail on request",
            "Finish the Actions properly \u2014 what you did matters more than how it turned out"
          ],
          answer: 2,
          explain: "Landing and Takeaway are where the signal actually lives, so protect them by cutting Actions detail rather than dropping the ending. Offering the detail afterwards hands the interviewer control and reads as awareness rather than as running out of road. Speeding up only makes the same content harder to score."
        }
      ]
    },

    "beh-advanced": {
      title: "Advanced rounds checkpoint",
      sub: "Round types that need different handling, the new AI questions, and how to actually rehearse.",
      questions: [
        {
          q: "What is the recruiter screen really testing?",
          options: [
            "Technical depth, compressed into twenty minutes",
            "Your negotiating position, which is why the safest move is to refuse to discuss anything",
            "Nothing substantive; it is a scheduling call",
            "Coherence, plausible fit at the level advertised, and process risk \u2014 plus the practical constraints that shape the rest of the loop"
          ],
          answer: 3,
          explain: "A recruiter is screening for whether you are coherent, roughly at the advertised level, and unlikely to fall out of the process, while collecting the timing and expectation constraints everything downstream depends on. Treating it as a formality is how strong candidates get slotted at the wrong level before an engineer ever meets them. Refusing to engage at all reads as difficult rather than as leverage."
        },
        {
          q: "An employer publishes a named set of leadership principles and runs a round against them. What is the strongest preparation?",
          options: [
            "Map the stories you already own to the principles they genuinely demonstrate, then answer in your own words",
            "Ignore them \u2014 published principles are marketing",
            "Memorise the principle names and quote them as you answer",
            "Write one new story per principle, stretching the facts where you have to"
          ],
          answer: 0,
          explain: "The interviewer is scoring evidence against a rubric rather than checking whether you can recite it, so quoting the names back adds nothing and usually sounds rehearsed. Mapping stories you already own gets the right evidence into natural language and survives follow-up questions. Manufacturing a story per principle is both risky and unnecessary, since one strong story normally covers two or three."
        },
        {
          q: "For the Trust theme in AI questions, which answer shape is strongest?",
          options: [
            "I read every line it produces, every time, without exception",
            "I have a rule tied to blast radius \u2014 I move fast on scaffolding and tests, and I read generated code closely anywhere it touches data correctness, auth or money",
            "I trust it for anything I could have written myself and not for anything else",
            "I do not use it for production code at all"
          ],
          answer: 1,
          explain: "The theme is asking how you decide, so the strongest answer states a decision rule that is calibrated to consequence rather than applied uniformly. Blanket answers in either direction \u2014 verify everything, or never use it \u2014 signal that you have not priced the cost of verification. A rule tied to blast radius is honest and transfers to examples the interviewer invents on the spot."
        },
        {
          q: "Why is the Scaling theme \u2014 raising a team's effective use of AI \u2014 asked more often of senior candidates?",
          options: [
            "Senior engineers are expected to have tried a larger number of tools",
            "It is the only one of the five themes with a single correct answer",
            "It probes influence beyond your own output: whether you can change how other people work",
            "Junior engineers are usually not given access to the tooling"
          ],
          answer: 2,
          explain: "Scope and influence are what separate seniority bands, and this theme quietly converts a tooling question into an influence question. The evidence being sought is a change you made to a team's practice and what happened as a result, not the number of tools you have opened. It has no single right answer \u2014 it has a required shape."
        },
        {
          q: "On the rehearsal ladder, what is recording yourself good at that rehearsing in your head is not?",
          options: [
            "Building a larger inventory of usable stories",
            "Scoring your answers against the interviewer's rubric",
            "Generating unpredictable follow-up questions",
            "Exposing delivery problems you cannot hear from the inside \u2014 filler, pace, a Setup beat that ran to fifty seconds"
          ],
          answer: 3,
          explain: "Rehearsing in your head runs at thought speed and silently repairs your own gaps, so it makes you feel ready without testing delivery at all. A recording is the cheapest way to hear pace, filler and beat lengths the way an interviewer hears them. It cannot generate follow-ups or judge your level \u2014 that is what mock partners are for."
        },
        {
          q: "Four weeks out from a loop, what should the first week be spent on?",
          options: [
            "Building and indexing the story shortlist, so the later weeks have material to work on",
            "Rehearsing the three most common questions until the wording is word-perfect",
            "Full mock interviews with a professional interviewer",
            "Researching the employer's principles and writing one story for each"
          ],
          answer: 0,
          explain: "Rehearsal is only worth doing on stories you have actually chosen, so week one is inventory and indexing rather than delivery practice. Booking expensive mocks before the material exists wastes the scarcest resource in the plan. Memorising wording this early also tends to lock in a first draft you would otherwise have improved."
        }
      ]
    }
  });

  /* =====================================================================
     TRACK
     ===================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.beh = {
    id: "beh",
    name: "Behavioral Course",
    short: "COURSE",
    tagline: "Evidence, not vibes",
    color: "#fb7185",
    blurb: "The round with no whiteboard, treated as the structured exercise it actually is. What interviewers score and where it is written down, how to hear the question behind the question, how to choose a story in the three seconds you get, the four beats that make an answer scoreable, the habits that quietly cost offers, and how to rehearse until selection stops feeling like invention.",
    modules: [

      /* ==================== FOUNDATIONS ==================== */
      {
        id: "foundation",
        name: "Foundations",
        icon: "compass",
        lessons: [

          {
            id: "why-it-matters",
            title: "Why this round decides more than you think",
            summary: "The round with no whiteboard is the one that sets your level. Why that happens, why strong engineers under-prepare it, and what this track will do about it.",
            minutes: 7,
            tags: ["intro", "mental-model", "start-here"],
            blocks: [
              { t: "p", html: "The <strong>behavioral round</strong> is the interview where nobody asks you to write code. An engineer, a manager, or both ask you to describe things you have already done: a project you led, a disagreement you had, a decision you got wrong. It runs somewhere between thirty and forty-five minutes, and it appears at least once in almost every hiring process &mdash; the full set of interviews for one job, which this track will call the <strong>loop</strong>." },
              { t: "p", html: "Most candidates read it as the soft round. No whiteboard, no failing test, nothing you can be visibly wrong about. It feels like a conversation you either click in or you do not. That reading is wrong in a specific and expensive way, and this lesson is about the mechanism." },

              { t: "h", text: "It is not a formality" },
              { t: "p", html: "The person across from you is not deciding whether they like you. They are filling in a form. Employers that run a structured loop hand interviewers a written <strong>rubric</strong> &mdash; a fixed list of qualities to look for &mdash; and ask them to submit written evidence against each one, usually within a day. Your sentences become quotes in that write-up. Then people who never met you read the quotes and decide." },
              { t: "p", html: "What the form asks matters. It does not ask whether you were pleasant. It asks how large a problem you owned, what you did when nobody told you what to do, whether you changed your mind when the evidence changed. Those are <strong>signals</strong>, and <a href='#/beh/foundation/how-evaluated'>the next lesson</a> takes all eight of them apart." },
              {
                t: "stat", items: [
                  { v: "4\u20136", k: "interviews in a typical loop" },
                  { v: "30\u201345 min", k: "one behavioral round" },
                  { v: "3\u20135", k: "stories you actually get to tell" },
                  { v: "1 day", k: "usual debrief write-up window" }
                ]
              },
              { t: "note", variant: "tip", html: "<strong>The write-up is the product.</strong> When you are choosing how to phrase something, ask what sentence you want the interviewer typing into the debrief an hour later. If your answer contains no sentence anyone could copy down as evidence, it did not score \u2014 however good it felt in the room." },

              { t: "h", text: "This is the round that down-levels people" },
              { t: "p", html: "To <strong>down-level</strong> someone is to offer them the job one band below the one they interviewed for: senior instead of staff, mid instead of senior. It is not a rejection, which is exactly why it slips past people. You get an offer. It is simply for less money, less scope, and a longer climb back to where you thought you already were." },
              { t: "p", html: "Coding and design rounds are mostly gates &mdash; can this person build the thing, yes or no. They are surprisingly poor at separating a strong senior engineer from a staff engineer, because both will solve the problem in front of them. The behavioral round is where that difference shows up, because level bands are written in the language of scope, ambiguity and influence, and the only evidence for those is what you have actually done." },
              {
                t: "ul", items: [
                  "A clean technical loop with thin stories tends to produce an offer one band down, not a rejection.",
                  "The band you are offered sets the compensation range before any negotiation begins \u2014 see <a href='#/offer/anatomy/level-bands'>level bands</a> for what that costs.",
                  "Nobody will tell you this happened. The feedback is &ldquo;we felt the scope was more senior-appropriate&rdquo;, which is the polite form of &ldquo;your stories were small&rdquo;."
                ]
              },

              { t: "h", text: "Why strong engineers under-prepare it" },
              { t: "p", html: "The under-preparation has a cause, and it is not laziness. Technical prep has a visible gradient: you fail a problem, you learn the pattern, you solve the next one faster. Behavioral prep feels flat. No failing test, no answer key, and the whole thing feels <em>unfalsifiable</em> &mdash; like a personality assessment you pass by being yourself or fail for reasons nobody will explain." },
              {
                t: "compare",
                bad: { title: "How most people prepare", items: ["Skim a list of common questions the night before", "Assume the right story will surface in the moment", "Prepare content but never say a word of it out loud", "Treat &ldquo;be authentic&rdquo; as a strategy", "No idea which qualities are being scored"] },
                good: { title: "What preparation actually is", items: ["A small set of stories, chosen deliberately", "Each one indexed by the quality it proves", "Each one structured so the ending is unmissable", "Rehearsed aloud and timed, not just thought about", "A working read on what each question is probing"] }
              },
              { t: "p", html: "So the feeling is real and the conclusion is wrong. The round is unfalsifiable only from your side of the table. From the interviewer's side it is one of the most structured things in the loop: a fixed rubric, a small set of question shapes, and a debrief form with named fields. Everything structured can be reverse-engineered, and finite things can be learned. There are roughly eight qualities that get scored, three shapes a question can take, four criteria for choosing a story, and four beats a story should move through. All of them are in this track." },

              { t: "h", text: "What this track does" },
              {
                t: "ol", items: [
                  "<strong>Foundations</strong> \u2014 the rubric behind the round (<a href='#/beh/foundation/how-evaluated'>how you are evaluated</a>), reading what a prompt is really asking (<a href='#/beh/foundation/decode'>name the signal</a>), and choosing a story fast (<a href='#/beh/foundation/select'>pick the story</a>).",
                  "<strong>Delivery Craft</strong> \u2014 a four-beat structure (<a href='#/beh/delivery/deliver-salt'>SALT</a>), the three questions you are guaranteed to be asked (<a href='#/beh/delivery/big-three'>the big three</a>), and the habits that quietly cost offers (<a href='#/beh/delivery/pitfalls'>pitfalls</a>).",
                  "<strong>Advanced Rounds</strong> \u2014 the rounds that need different handling (<a href='#/beh/advanced/special-types'>special types</a>), the new questions about working with AI (<a href='#/beh/advanced/ai-questions'>AI questions</a>), and how to actually rehearse (<a href='#/beh/advanced/practicing'>practising</a>)."
                ]
              },
              { t: "p", html: "One thing worth starting today, because it takes longer than everything else combined: <a href='#/story/catalog/journaling'>keep a running log of what you do at work</a>. Stories are hard to invent and easy to lose. Ten minutes a week writing down what happened, what you decided, and what changed will out-perform any amount of cramming in the last week. Everything in this track operates on material; the log is where the material comes from." },
              { t: "cue", html: "You are ready to move on when you can answer this: if one interviewer had to write a single sentence about your work tomorrow, what would you want it to say? Hold on to that sentence. The rest of the track is machinery for making it the sentence they actually write." },
              { t: "note", variant: "key", html: "<strong>This is a rubric delivered conversationally, not a vibe check with a rubric bolted on.</strong> It rarely decides <em>whether</em> you get an offer. It very often decides <em>at what level</em> \u2014 and level is the expensive part. Prepare it like the structured exercise it is." }
            ]
          },

          {
            id: "how-evaluated",
            title: "How you are actually evaluated",
            summary: "The eight signal areas behind every rubric, the three shapes a question can take, and how the bar moves between mid, senior and staff.",
            minutes: 9,
            tags: ["rubric", "signals", "mechanism"],
            blocks: [
              { t: "p", html: "Hold this picture: the interviewer has a scorecard with a handful of named rows, and their job for the next forty minutes is to collect enough evidence to fill in each row with a rating and a quote. Your job is to hand them that evidence. Everything else &mdash; rapport, humour, how the conversation flows &mdash; is real but unscored." },
              { t: "p", html: "A <strong>signal</strong> is one of those rows: a named quality with a definition and an expected bar. Employers word them differently, group them differently, and publish them at different levels of detail, but the underlying set converges hard. Learn the eight below and you will recognise almost any rubric you meet, whatever it is called locally." },

              { t: "h", text: "The eight signal areas" },
              {
                t: "table",
                headers: ["Signal", "What it measures", "What counts as proof"],
                rows: [
                  ["<strong>Ownership</strong>", "Whether you take responsibility for outcomes nobody assigned you, including the parts that are not your job", "A problem you noticed, claimed, and carried past the point where you could have handed it back"],
                  ["<strong>Scope and impact</strong>", "How large a problem you can be trusted with \u2014 people affected, systems touched, time horizon", "A number, a blast radius, or a decision that outlived the project"],
                  ["<strong>Dealing with ambiguity</strong>", "What you do when the goal, the requirements or the owner is undefined", "Structure you created: a written definition of done, a first slice, a forced decision"],
                  ["<strong>Conflict and collaboration</strong>", "How you disagree, and whether the working relationship survives it", "A disagreement with a defensible position on both sides, and evidence you worked together again"],
                  ["<strong>Communication</strong>", "Whether people who were not in the room understood the decision", "Something you wrote or a briefing you gave that changed what somebody else did"],
                  ["<strong>Judgement and trade-offs</strong>", "Whether you decide on stated criteria, and whether you can name what you gave up", "The option you rejected, priced as a cost rather than dismissed as a flaw"],
                  ["<strong>Growth and self-awareness</strong>", "Whether you can hold a real failure without deflecting, and show a behaviour change", "A specific habit adopted after a specific mistake, and used since"],
                  ["<strong>Bias for action</strong>", "Whether you move under uncertainty at a speed proportional to the cost of being wrong", "A call made early, with a stated reversal plan and a check you would run"]
                ]
              },
              { t: "p", html: "The naming varies more than the content does. Some employers publish a branded list of principles and interview explicitly against it; some use a generic competency framework; some give interviewers three broad buckets and trust their calibration. If you are targeting a place with a published list, the useful move is translation rather than memorisation \u2014 map your existing stories onto their words. <a href='#/story/playbooks/principle-based'>Principle-based playbooks</a> and the per-employer breakdowns for <a href='#/loops/amazon/amazon-l5'>Amazon</a>, <a href='#/loops/meta/meta-e5'>Meta</a> and <a href='#/loops/google/google-l5'>Google</a> cover the translations in detail." },
              { t: "note", variant: "tip", html: "<strong>One story, several signals.</strong> A good story usually proves two or three signals at once, which is why six well-chosen stories can cover all eight. Do not try to build one story per row \u2014 that produces eight thin stories instead of six strong ones. Assembling and indexing that small set is what <a href='#/beh/foundation/select'>choosing the story</a> covers, two lessons on." },

              { t: "h", text: "The three question types" },
              { t: "p", html: "Every prompt you get is one of three shapes, and each needs a different kind of preparation. Mistaking the shape is a fast way to answer a question nobody asked." },
              {
                t: "table",
                headers: ["Type", "Sounds like", "What it scores", "How to prepare"],
                rows: [
                  ["<strong>Behavioral</strong>", "&ldquo;Tell me about a time you\u2026&rdquo;", "Evidence from your past: what you actually did, under real constraints", "Build a small indexed set of real stories and structure them"],
                  ["<strong>Hypothetical</strong>", "&ldquo;What would you do if\u2026&rdquo;", "Your reasoning process, live: what you would weigh and in what order", "Rehearse decision rules, not stories \u2014 then anchor each to a real precedent"],
                  ["<strong>Background</strong>", "&ldquo;Walk me through your project&rdquo;", "Depth and ownership: whether you really made the decisions you describe", "Pick one or two projects you can go three follow-ups deep on"]
                ]
              },
              { t: "p", html: "<strong>Behavioral</strong> questions are the bulk of the round, and the reason for keeping a prepared, indexed set of stories \u2014 the <a href='#/beh/foundation/select'>shortlist</a>. <strong>Hypothetical</strong> questions are the ones most people fumble, because they answer either in pure abstraction (&ldquo;I would talk to them and understand their perspective&rdquo;) or by silently converting it into a story they had ready. The strong shape is both: state how you would decide, then spend twenty seconds grounding it in a time you actually decided that way. <strong>Background</strong> questions are not warm-ups; they are depth probes, and the follow-ups are where the scoring happens." },
              {
                t: "compare",
                bad: { title: "Hypothetical, answered weakly", items: ["Pure abstraction with no decision rule", "&ldquo;It depends&rdquo; with nothing after it", "Silently swaps in a rehearsed story instead", "Lists considerations without ever choosing", "Nothing an interviewer can write down"] },
                good: { title: "Hypothetical, answered well", items: ["Names the rule first: what you optimise for and why", "States what you would check before deciding", "Commits to a call, then names the reversal plan", "Anchors it: &ldquo;the closest real case I had was\u2026&rdquo;", "Ends with what would change your mind"] }
              },

              { t: "h", text: "The same signals, a different bar" },
              { t: "p", html: "Levels do not add new signals; they raise the bar on the ones already there. This table is the single most useful calibration device in the track &mdash; when a story feels weak and you cannot say why, it is usually landing a row lower than you intend." },
              {
                t: "table",
                headers: ["Level", "What the story has to show", "The tell"],
                rows: [
                  ["<strong>Mid</strong>", "You owned a task or component and delivered it well, with the approach mostly set by someone else", "The story is about your own work, and the result is a shipped thing"],
                  ["<strong>Senior</strong>", "You owned a problem rather than a task: set the approach, made a trade-off you can defend, and moved a number beyond your own output", "There is a rejected alternative in the story, and you can price it"],
                  ["<strong>Staff</strong>", "You changed what other people do \u2014 influence without authority, a decision that outlived the project, impact stated in business or organisational terms", "The result includes people who do not report to you and were not asked to comply"]
                ]
              },
              { t: "cue", html: "<strong>Recognise the shape before you answer.</strong> &ldquo;Tell me about a time&rdquo; \u2192 reach for a prepared story. &ldquo;What would you do&rdquo; \u2192 lead with the rule, then anchor. &ldquo;Walk me through&rdquo; \u2192 slow down, this one has follow-ups. If you cannot tell which, the safest opening is a real story, because a hypothetical answered with evidence still scores." },
              { t: "note", variant: "key", html: "<strong>Eight signals, three question shapes, one moving bar.</strong> The signals tell you what evidence to bring, the shape tells you how to package it, and the level tells you how big the evidence has to be. Everything else in this track is machinery for hitting those three at once." }
            ]
          },

          {
            id: "decode",
            title: "The question behind the question",
            summary: "Every prompt is a probe for a specific signal. Name the signal, pick the story that proves it, and open on the outcome.",
            minutes: 8,
            tags: ["signal", "mechanism"],
            blocks: [
              { t: "p", html: "A behavioral prompt is never a request for information. It is a probe for one of the signals from <a href='#/beh/foundation/how-evaluated'>the previous lesson</a>, dressed in conversational clothing. The interviewer already knows what row of their scorecard they are trying to fill; the question is just the shortest sentence they could use to get you talking about it." },
              { t: "p", html: "This produces the most common quiet failure in the whole round: a well-told, well-structured, genuinely interesting story that answers the literal words and provides no evidence for the signal underneath. Nobody stops you. You feel it went well. The debrief says &ldquo;good communicator, unclear on ownership&rdquo;." },

              { t: "h", text: "Name it, pick it, land it" },
              {
                t: "ol", items: [
                  "<strong>Name the signal.</strong> Silently, in about two seconds. Not the topic \u2014 the quality being tested. &ldquo;Difficult stakeholder&rdquo; is a topic; conflict and collaboration is the signal.",
                  "<strong>Pick the story that proves it.</strong> From a prepared, indexed set \u2014 not from memory under load. That indexing is what <a href='#/beh/foundation/select'>the next lesson</a> builds.",
                  "<strong>Open with the outcome.</strong> First sentence names where the story ends, so the listener has somewhere to file every detail that follows."
                ]
              },
              { t: "p", html: "Step one is a habit, and it takes about a week of deliberate practice to become automatic. Say the signal name in your head before you say your first word out loud. That pause is short enough to read as thoughtful and long enough to stop you telling the wrong story." },
              { t: "p", html: "Step three is the one people resist, because narrative instinct says build to the ending. Interviews invert that. Opening on the outcome does three things at once: it frames the story so every later detail is interpretable, it proves in one sentence that the story has a point, and it protects you if you get cut off at ninety seconds \u2014 which happens constantly and is never announced." },

              { t: "h", text: "Five prompts, translated" },
              {
                t: "table",
                headers: ["Prompt", "Signal actually probed", "What a strong opening line does"],
                rows: [
                  ["&ldquo;Tell me about a time you had to work with someone difficult.&rdquo;", "Conflict and collaboration \u2014 and, quietly, whether you can describe a colleague fairly", "Names the <em>relationship</em> as the outcome: &ldquo;We ended up co-owning the next two projects, but it started badly.&rdquo; Signals immediately that this is not a complaint."],
                  ["&ldquo;Walk me through a project you are proud of.&rdquo;", "Scope and impact \u2014 how large a thing you can be trusted with", "Leads with size and result rather than architecture: &ldquo;I owned the checkout latency work \u2014 it took our slowest page from about four seconds to under one, across roughly two million weekly sessions.&rdquo;"],
                  ["&ldquo;Tell me about a time you failed.&rdquo;", "Growth and self-awareness \u2014 whether you can hold a real failure without deflecting", "Admits it in the first clause and points at the change: &ldquo;I shipped a migration that lost two days of analytics data, and it changed how I sequence every migration since.&rdquo;"],
                  ["&ldquo;How do you handle competing priorities?&rdquo;", "Judgement and trade-offs \u2014 whether you decide on criteria or on whoever is loudest", "States the rule before the story: &ldquo;I sort by what is reversible and what is not, and I protect the irreversible thing first \u2014 here is the time that actually mattered.&rdquo;"],
                  ["&ldquo;Tell me about a project where the requirements were not clear.&rdquo;", "Dealing with ambiguity \u2014 whether you create structure or wait for it", "Opens with the structure you created: &ldquo;Nobody could tell me what done meant, so I wrote a one-page definition and got three teams to agree to it inside a week.&rdquo;"]
                ]
              },
              {
                t: "compare",
                bad: { title: "Answering the literal words", items: ["&ldquo;Difficult person&rdquo; \u2192 a story about how difficult they were", "&ldquo;Failure&rdquo; \u2192 a failure that was really someone else's", "&ldquo;Proud of&rdquo; \u2192 the most technically interesting thing you built", "&ldquo;Competing priorities&rdquo; \u2192 a description of your ticket system", "The interviewer has to dig for the evidence, and often does not"] },
                good: { title: "Answering the signal", items: ["&ldquo;Difficult person&rdquo; \u2192 how you disagreed and kept working with them", "&ldquo;Failure&rdquo; \u2192 your call, your cost, your changed habit", "&ldquo;Proud of&rdquo; \u2192 the largest thing you genuinely owned", "&ldquo;Competing priorities&rdquo; \u2192 the criterion you sorted by, and what you dropped", "The evidence is in the first two sentences"] }
              },
              { t: "note", variant: "trap", html: "<strong>Do not over-read it.</strong> The literal words still constrain you. If they asked about a conflict with a <em>peer</em> and you tell a story about your manager, you have answered a different question, however well the signal maps. Name the signal, then honour the specifics of the prompt \u2014 both, not one." },

              { t: "h", text: "When you genuinely cannot tell" },
              { t: "p", html: "Some prompts are ambiguous on purpose, and some are just badly worded. Asking is cheap and scores as communication rather than as confusion, provided you ask a narrow question rather than a helpless one. Two sentences that always work: &ldquo;Happy to take that in a couple of directions \u2014 are you more interested in the technical call or how I handled the disagreement?&rdquo; and &ldquo;Do you want the biggest one, or the most recent one?&rdquo;" },
              { t: "p", html: "What does not work is asking what they want to hear, or narrating your uncertainty for twenty seconds before choosing. Ask once, take the answer, start. If they say &ldquo;whichever you like&rdquo;, that is information too: pick the one with the larger scope." },
              { t: "cue", html: "<strong>Signal triggers.</strong> &ldquo;Difficult / disagreed / pushback&rdquo; \u2192 conflict. &ldquo;Unclear / changing / no owner&rdquo; \u2192 ambiguity. &ldquo;Proud of / biggest / most impactful&rdquo; \u2192 scope. &ldquo;Failed / mistake / would do differently&rdquo; \u2192 growth. &ldquo;Convince / align / explain to&rdquo; \u2192 communication. &ldquo;Not enough time / not enough data&rdquo; \u2192 bias for action. &ldquo;Chose between / why not X&rdquo; \u2192 judgement. &ldquo;Nobody was assigned / went beyond&rdquo; \u2192 ownership." },
              { t: "note", variant: "key", html: "<strong>Answer the signal, not the sentence.</strong> Name the quality being probed, choose the story that proves it, and put the outcome in your first line. A story that answers the literal words but proves nothing is the most common way a good candidate scores badly and never finds out why." }
            ]
          },

          {
            id: "select",
            title: "Choosing the story in three seconds",
            summary: "Four criteria \u2014 Scope, Relevance, Uniqueness, Recency \u2014 and the story shortlist that turns selection from invention into retrieval.",
            minutes: 9,
            tags: ["selection", "shortlist", "mechanism"],
            blocks: [
              { t: "p", html: "You get about three seconds. In that window you have to search your entire career, evaluate candidates against a signal you have only just identified, and start talking with enough confidence that the opening line lands. Under load, unprepared, almost everyone does the same thing: they grab the most recent story, or the one they enjoy telling, and discover halfway through that it does not prove the thing being asked." },
              { t: "p", html: "The fix is not thinking faster. It is moving the work earlier, so that in the room selection is <strong>retrieval</strong> rather than <strong>invention</strong>. That is the whole idea. The rest of this lesson is the two mechanisms that make it work: criteria for judging a story, and an index for finding it." },

              { t: "h", text: "Four selection criteria" },
              {
                t: "table",
                headers: ["Criterion", "The question it asks", "The failure when you ignore it"],
                rows: [
                  ["<strong>Scope</strong>", "Is this big enough for the level I am interviewing at?", "A beautifully structured story about a small thing, which reads as a candidate one band lower \u2014 see <a href='#/story/catalog/scope-signal'>scope as a signal</a>"],
                  ["<strong>Relevance</strong>", "Does this actually prove the signal being probed?", "A strong story that answers a question nobody asked; the row on the scorecard stays empty"],
                  ["<strong>Uniqueness</strong>", "Have I already spent this story earlier in this loop?", "The panel compares notes and finds one data point where they expected four; your experience reads as thin"],
                  ["<strong>Recency</strong>", "Is this recent enough to describe who I am now?", "A five-year-old story invites the follow-up you do not want: and what have you done since?"]
                ]
              },
              { t: "p", html: "They are not equally weighted. Relevance dominates \u2014 a perfectly relevant medium story beats a huge irrelevant one every time, because the interviewer can only score the row they are on. Scope comes next, because it is what sets your level. Uniqueness and recency are tie-breakers, and they matter more than people expect: they are usually what decides between your two good options." },
              { t: "note", variant: "trap", html: "<strong>The one-story candidate.</strong> Almost everyone has a favourite \u2014 the biggest, best-rehearsed thing they ever did \u2014 and reaches for it three or four times in one loop. The panel notices. What they write is not &ldquo;great story&rdquo;, it is &ldquo;seems to have done one impressive thing&rdquo;. Uniqueness is a criterion precisely because your instincts will fight it." },

              { t: "h", text: "Build a shortlist, not a catalogue" },
              { t: "p", html: "A <strong>shortlist</strong> is a short, deliberately small set of stories, indexed by the signals each one proves rather than by the project it came from. Six to eight is the working range: fewer and you cannot cover eight signals or survive a five-round loop without repeating; more and you are back to searching under pressure, which is the problem you were trying to solve." },
              {
                t: "code", lang: "text", code:
                  "SHORTLIST  (6-8 stories; index by SIGNAL, never by project)\n" +
                  "\n" +
                  "  #1  checkout latency rescue     -> scope, bias for action, ownership\n" +
                  "  #2  the migration nobody owned  -> ownership, ambiguity\n" +
                  "  #3  the design review I lost    -> conflict, judgement, growth\n" +
                  "  #4  onboarding rewrite          -> communication, growth\n" +
                  "  #5  the deadline I missed       -> growth, judgement\n" +
                  "  #6  the vendor evaluation       -> judgement, communication, scope\n" +
                  "\n" +
                  "  RULE 1  every signal is covered at least twice\n" +
                  "  RULE 2  no story is the only proof of anything\n" +
                  "  RULE 3  at least four of the six are from the last two years"
              },
              { t: "p", html: "Indexing by signal rather than by project is the part that does the work. Your brain files experience chronologically and by project, which is useless in the room, because the question does not arrive as &ldquo;tell me about the migration&rdquo;. It arrives as &ldquo;tell me about a time you dealt with an unclear goal&rdquo;. Building the index once, on paper, is what makes retrieval possible later. If you want a systematic way to check the index for holes, the <a href='#/story/catalog/coverage-matrix'>coverage matrix</a> is the same idea with the gaps made visible, and <a href='#/story/catalog/story-anatomy'>story anatomy</a> covers how to write each entry down." },
              { t: "widget", id: "behSelector" },

              { t: "h", text: "What the shortlist costs you" },
              { t: "p", html: "This is a real trade-off, not a free win. A small shortlist makes you fast and consistent, and it makes you slightly less responsive to a question you did not anticipate. You will occasionally have a better story that is not on the shortlist and skip it because retrieval reached for the indexed one first." },
              {
                t: "compare",
                bad: { title: "Shortlist of fifteen", items: ["Something for every conceivable prompt", "Selection is still a search under load", "Half of them are under-rehearsed", "You forget which ones you already used", "Coverage is unknown because nobody can hold fifteen"] },
                good: { title: "Shortlist of six", items: ["Every one rehearsed, timed and openable", "Selection is a lookup, not a search", "You can track what you have spent per round", "Coverage gaps are visible on one page", "You accept missing the occasional better story"] }
              },
              { t: "p", html: "Take the trade. Consistency across five rounds is worth far more than the occasional perfect match, because the panel scores your worst answer as readily as your best. If a better story genuinely surfaces mid-answer, you can still switch \u2014 but you will switch from a prepared baseline rather than from nothing." },
              { t: "cue", html: "<strong>Selection triggers.</strong> Signal named \u2192 scan the shortlist, not your memory. Two candidates tie on relevance \u2192 take the larger scope. Still tied \u2014 take the one you have not spent in this loop. Still tied \u2014 take the more recent. Nothing on the shortlist fits \u2192 take the closest and say what makes it close, rather than stalling for a perfect match." },
              { t: "note", variant: "key", html: "<strong>Selection is retrieval, not invention \u2014 but only if you did the indexing.</strong> Six to eight stories, indexed by signal, every signal covered twice, judged on scope, relevance, uniqueness and recency in that order of weight. Build the shortlist once and the three seconds stop being frightening." },
              { t: "quiz", id: "beh-foundation" }
            ]
          }
        ]
      },

      /* ==================== DELIVERY CRAFT ==================== */
      {
        id: "delivery",
        name: "Delivery Craft",
        icon: "bolt",
        lessons: [

          {
            id: "deliver-salt",
            title: "SALT: the four beats of a scoreable answer",
            summary: "Setup, Actions, Landing, Takeaway \u2014 why the explicit Takeaway beat outperforms the four-part version everyone already knows, and how to budget two minutes across it.",
            minutes: 9,
            tags: ["structure", "salt", "delivery"],
            blocks: [
              { t: "p", html: "A story that is not structured is not scoreable. The interviewer is trying to extract four things &mdash; the setup, what <em>you</em> did, what changed, and what you took from it &mdash; and if they have to reconstruct those from a chronological ramble, they will get some of them wrong and miss the rest. Structure is not a stylistic preference. It is how the evidence survives the trip into the write-up." },
              { t: "p", html: "<strong>SALT</strong> is the shape: <strong>S</strong>etup, <strong>A</strong>ctions, <strong>L</strong>anding, <strong>T</strong>akeaway. Four words, in that order, and the last one is the one worth arguing about." },

              { t: "h", text: "The four beats" },
              {
                t: "table",
                headers: ["Beat", "What belongs here", "What does not"],
                rows: [
                  ["<strong>Setup</strong>", "Who was involved, what was at stake, and the one constraint that made this hard", "Org charts, dates, product history, the names of people the interviewer will never meet"],
                  ["<strong>Actions</strong>", "What you personally decided and did, in the first person, including the option you rejected", "&ldquo;We&rdquo; for anything that was a decision; a tour of the system architecture"],
                  ["<strong>Landing</strong>", "A number or a direction, who it affected, and how you know", "&ldquo;And then it shipped.&rdquo; A result nobody measured is a result nobody can score"],
                  ["<strong>Takeaway</strong>", "The habit you changed, and evidence you have used it since", "&ldquo;I learned the importance of communication.&rdquo; A platitude is a skipped beat with extra words"]
                ]
              },

              { t: "h", text: "Why the Takeaway beat is the point" },
              { t: "p", html: "The version most people already know has four parts too &mdash; situation, task, action, result &mdash; and it splits the setup across two beats while ending at the outcome. SALT merges the setup into one beat and spends the recovered time on <strong>Takeaway</strong>, and that swap is the entire argument." },
              { t: "p", html: "Ending at the result proves you can execute. It says nothing about whether you improve, and <em>growth and self-awareness</em> is one of the eight signals that has to be filled in. The Takeaway beat is the only place in a story where that evidence can appear. It is also the beat almost everyone drops, because it comes last and they have already used their time &mdash; which means a competent Takeaway beat is one of the cheapest ways to be memorable." },
              { t: "p", html: "The task beat is not lost, incidentally. What it contained &mdash; what you were responsible for &mdash; belongs in the first sentence of Actions, where it is stronger anyway: &ldquo;I owned the cutover&rdquo; does more work than a separate paragraph explaining that you owned the cutover." },

              { t: "h", text: "The same story, twice" },
              {
                t: "compare",
                bad: { title: "Told the default way", items: ["Fifty seconds of org chart before anything happens", "&ldquo;We decided&rdquo; for every single decision, so no action is attributable", "Deep on the technical mechanism, silent on why it mattered", "Ends on &ldquo;and then we shipped it&rdquo;", "No Takeaway beat \u2014 time ran out, which it always does"] },
                good: { title: "Told the scoreable way", items: ["Opens on the outcome, then twenty-five seconds of context", "&ldquo;I proposed\u2026 I owned\u2026 the team then\u2026&rdquo; \u2014 contribution stays separable", "One layer of technical depth, offered rather than dumped", "Ends on a measured result and who it affected", "Closes on a habit that has been used three times since"] }
              },
              { t: "p", html: "Same events, same person, same forty-five seconds of genuinely interesting engineering in the middle. One of them fills four rows on a scorecard and one fills none. The difference is entirely in what got cut and where the emphasis landed." },

              { t: "h", text: "Budgeting the two minutes" },
              { t: "p", html: "Two minutes is the working target for a main behavioral answer: long enough to carry four beats, short enough that the interviewer gets through their question list and you get through your shortlist. Under ninety seconds you are usually thin on Actions; over three minutes you are being cut off, whether or not anyone says so." },
              {
                t: "stat", items: [
                  { v: "26s", k: "Setup" },
                  { v: "54s", k: "Actions" },
                  { v: "26s", k: "Landing" },
                  { v: "14s", k: "Takeaway" }
                ]
              },
              { t: "p", html: "Those are the numbers for a two-minute answer about a moderately layered story. The shape shifts with complexity: a simple single-team story needs less setup, and a multi-team story with competing goals needs so much more that Setup starts eating the beats that actually score. Roughly a quarter of your total is the ceiling; past that you are spending Landing and Takeaway time on scenery." },
              { t: "widget", id: "behSaltTimer" },
              { t: "p", html: "The trade-off is real: structure costs spontaneity. A rigidly delivered SALT answer sounds rehearsed, and sounding rehearsed is its own penalty \u2014 it makes the interviewer discount everything, including the true parts. The resolution is to be rigid about the <em>beat order and budget</em> and loose about the wording. Never memorise sentences. Memorise the four landing points and let the words be different every time." },
              { t: "note", variant: "trap", html: "<strong>Never name the structure out loud.</strong> &ldquo;So, for context\u2026 and now the action\u2026&rdquo; is the single fastest way to sound coached. The structure is scaffolding for you, not signposting for them. The interviewer should feel a well-told story and, an hour later, find that their notes filled themselves in." },
              { t: "cue", html: "<strong>Say it out loud, once, before the round:</strong> outcome first, twenty-five seconds of setup, first person all the way through the middle, a number at the end, and one habit that changed. If any of the five is missing when you finish a rehearsal, that is the beat to fix \u2014 not the wording." },
              { t: "note", variant: "key", html: "<strong>Setup, Actions, Landing, Takeaway \u2014 with the Takeaway defended.</strong> It is the beat that proves you improve, the only place growth gets scored, and the first thing everyone drops. Protect it by cutting Setup, not by talking faster." }
            ]
          },

          {
            id: "big-three",
            title: "The three questions you will always get",
            summary: "Tell me about yourself, your hardest technical project, and a conflict \u2014 built out to the Standout tier rather than the Good one.",
            minutes: 9,
            tags: ["big-three", "calibration"],
            blocks: [
              { t: "p", html: "Three questions appear in almost every loop, often more than once, and they are worth building deliberately rather than improvising. They are also the three where the gap between an acceptable answer and a strong one is largest, because everybody prepares them a little and almost nobody prepares them properly." },
              { t: "p", html: "Each is graded below as <strong>Naive / Solid / Standout</strong>. Most prepared candidates land squarely on Good, which is why Good is not a compliment here \u2014 it is the middle of the distribution. Great is a small amount of extra work applied to the right place." },

              { t: "h", text: "1 \u00b7 Tell me about yourself" },
              { t: "p", html: "This is not a request for your history. It is an opening frame: the interviewer is deciding what to ask you for the next forty minutes, and your answer supplies the agenda they choose from. It is the one moment in the round where you control the agenda, and most people spend it reciting a CV in chronological order from university onwards." },
              { t: "p", html: "Target ninety seconds and four moves: where you are now and what you own, the through-line that got you here (one sentence, not a career history), one concrete proof point, and why this role specifically. The proof point is the lever &mdash; name your strongest story in a single line and the interviewer will very often ask about it, which means your best material comes up first while everyone is fresh." },
              {
                t: "table",
                headers: ["Tier", "What it sounds like", "What it scores"],
                rows: [
                  ["<strong>Naive</strong>", "A chronological walk from your degree to today, four minutes, every job included", "Nothing. The interviewer waits for you to finish and then asks the questions they had planned anyway"],
                  ["<strong>Solid</strong>", "Where you are now, a clear through-line, and why this role \u2014 in about ninety seconds", "Coherence and intent: you are a candidate with a direction rather than an application"],
                  ["<strong>Standout</strong>", "The same arc, but the through-line lands on your strongest story in one line, and the closing sentence names what this team actually needs", "Agenda control. The first follow-up is now about your best material, and the round starts on your ground"]
                ]
              },

              { t: "h", text: "2 \u00b7 Your hardest technical project" },
              { t: "p", html: "This one probes depth and ownership together, and the follow-ups are where it is decided. Anyone can describe a system they were near. The question is whether the decisions you are narrating were actually yours, and three follow-ups is usually enough to find out." },
              { t: "p", html: "The move that separates Good from Great is the <strong>rejected option</strong>. Describing what you built shows execution; describing what you deliberately did not build, and what that choice cost, shows judgement. Interviewers hear the first constantly and the second rarely. Have one alternative you seriously considered, one sentence on why you rejected it, and one honest sentence on what you gave up by doing so \u2014 every real decision costs something, and claiming otherwise reads as not having understood the decision." },
              { t: "p", html: "Depth is a separate axis from difficulty. Pick the project where you can survive interrogation, not the one with the most impressive name. If your loop also has architecture or algorithm rounds, prepare those in Blueprint and Codex respectively \u2014 here the technical detail is a vehicle for ownership and judgement, not the thing being graded." },
              {
                t: "table",
                headers: ["Tier", "What it sounds like", "What it scores"],
                rows: [
                  ["<strong>Naive</strong>", "The system explained in loving detail, with your own role never made explicit", "Nothing individual. Depth may be visible, but there is no evidence about you specifically"],
                  ["<strong>Solid</strong>", "The problem, your specific decisions, the result, and one layer of depth when asked", "Ownership and technical depth at the level you are claiming"],
                  ["<strong>Standout</strong>", "All of that, plus the option you rejected, what rejecting it cost, and the one thing you would do differently now", "Judgement \u2014 you can price the alternative instead of only defending the choice you made"]
                ]
              },

              { t: "h", text: "3 \u00b7 A conflict story" },
              { t: "p", html: "The most misread question of the three. Candidates hear &ldquo;prove you were right&rdquo; and deliver a story where a colleague was foolish and the data eventually vindicated them. That answer scores badly on a signal the candidate did not realise was being measured: whether you can describe someone you disagreed with fairly." },
              { t: "p", html: "The rule that fixes it is simple and almost nobody follows it: <strong>the Landing beat has to include the relationship</strong>, not only the technical outcome. Whose approach won is the least interesting part. What the interviewer needs to know is whether the two of you could still work together afterwards, because that is the thing that will determine what you are like on their team in six months." },
              { t: "p", html: "Practically: give the other person a defensible position, in their words, stated as though you understood it \u2014 because if their position was indefensible, this was not a conflict, it was you being right at someone. Then the process, then the resolution, then one sentence on what happened next between you. <a href='#/story/catalog/conflict-growth'>Conflict and growth stories</a> covers how to source one if your instinct is that you have never had a real disagreement." },
              {
                t: "table",
                headers: ["Tier", "What it sounds like", "What it scores"],
                rows: [
                  ["<strong>Naive</strong>", "The other person was simply wrong, you were proved right, and the story ends at the vindication", "Against you. It reads as an inability to describe a colleague fairly, whatever the technical merits were"],
                  ["<strong>Solid</strong>", "Two defensible positions, a real decision process, and a clean technical resolution", "Conflict handled \u2014 but the collaboration half of the signal is still unproven"],
                  ["<strong>Standout</strong>", "The same, plus what happened to the working relationship afterwards: you worked together again, and it went better because of how this was handled", "Conflict and collaboration together. This is the beat nearly everyone omits, which makes it cheap to win"]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>One conflict story is not enough.</strong> Expect a follow-up in the same round: &ldquo;tell me about another one&rdquo;, or &ldquo;what about a disagreement you lost?&rdquo;. Losing gracefully is a separate and equally scored story, and it is usually the stronger one \u2014 committing fully to a decision you argued against is exactly what senior collaboration looks like." },
              { t: "cue", html: "<strong>Build these three first.</strong> Yourself: ninety seconds, four moves, ending on a proof point you want them to ask about. Hardest project: three follow-ups deep, plus the rejected option and its price. Conflict: a fair account of the other side, and a Landing beat that includes the relationship." },
              { t: "note", variant: "key", html: "<strong>Good is the middle of the distribution.</strong> For all three, Great is one specific addition: an agenda-setting proof point, a priced alternative, and a relationship in the result. None of them takes more time to say \u2014 they take a decision made in advance about what to spend the time on." }
            ]
          },

          {
            id: "pitfalls",
            title: "What quietly costs the offer",
            summary: "Six habits that lose points without ever being flagged in the room \u2014 starting with the one that makes your contribution impossible to score.",
            minutes: 8,
            tags: ["pitfalls", "repair"],
            blocks: [
              { t: "p", html: "None of what follows will be mentioned in the room. Interviewers do not interrupt to say your story had no measurable result; they write it down afterwards. That is what makes these expensive: they are invisible from your side, they feel fine while you are doing them, and every one of them is fixable in a sentence or two once you know it is there." },

              { t: "h", text: "1 \u00b7 The missing “I”" },
              { t: "p", html: "The most common and most damaging habit by a wide margin. You describe a real project you genuinely contributed to, and you say &ldquo;we&rdquo; from beginning to end \u2014 we noticed, we decided, we shipped. It feels like good manners. What it produces is a story with no attributable actions in it, and an interviewer who cannot write down a single sentence about what <em>you</em> did." },
              { t: "p", html: "This is why it beats every other mistake for cost. A story with no result at least proves you did something. A story told entirely in &ldquo;we&rdquo; gives the panel a team's achievement and no way to score the candidate. It reads exactly the same as having contributed nothing." },
              {
                t: "compare",
                bad: { title: "Nothing to score", items: ["We noticed the queue was backing up", "We decided to shard by tenant", "We got the backlog under a second", "So we shipped it in about three weeks", "The write-up says: worked on a queue project"] },
                good: { title: "Scoreable, and still generous", items: ["I was on call the night the queue backed up", "I proposed sharding by tenant; two of us argued it out and I wrote the design up", "We got it under a second \u2014 my part was the shard key and the backfill", "The team shipped in three weeks; I ran the cutover", "The write-up says: proposed and owned the sharding approach"] }
              },
              { t: "note", variant: "trap", html: "<strong>Over-correcting is its own failure.</strong> A story where you did everything and no colleague ever appears reads as either untrue or as someone nobody wants on their team, and interviewers score that harder than modesty. The rule is not &ldquo;say I more often&rdquo;. It is <strong>&ldquo;we&rdquo; for the shared goal, &ldquo;I&rdquo; for every decision and action that was genuinely yours</strong>. If a sentence describes a choice, it needs a subject." },

              { t: "h", text: "2 \u00b7 No measurable result" },
              { t: "p", html: "&ldquo;And then we shipped it&rdquo; is not a Landing beat. Without a magnitude the interviewer cannot size the work, and the Scope row on the scorecard stays empty regardless of how large the project actually was. The usual objection is that the numbers are confidential \u2014 and that is almost always solvable, because a direction and a relative magnitude leak nothing." },
              {
                t: "ul", items: [
                  "<strong>Relative:</strong> &ldquo;roughly halved the weekly on-call pages&rdquo; \u2014 no absolute figure, full information about the size.",
                  "<strong>Directional with a unit:</strong> &ldquo;took the slowest page from about four seconds to under one&rdquo;.",
                  "<strong>Population:</strong> &ldquo;affected every merchant on the platform, not just the enterprise tier&rdquo;.",
                  "<strong>Durability:</strong> &ldquo;the runbook is still what the team uses two years later&rdquo; \u2014 the strongest one available to you when nothing was instrumented.",
                  "<strong>Counterfactual:</strong> &ldquo;without it we would have missed the compliance deadline&rdquo; \u2014 use sparingly, and only where it is honestly true."
                ]
              },
              { t: "p", html: "What is never acceptable is inventing a number. It is the one mistake here that is disqualifying rather than merely costly, and the follow-up question that exposes it (&ldquo;how did you measure that?&rdquo;) is completely routine." },

              { t: "h", text: "3 \u00b7 Blaming someone" },
              { t: "p", html: "A former manager who was unreasonable, a team that would not cooperate, an employer with a broken culture. Even when the account is entirely accurate, the interviewer cannot verify it and can only note how you talk about people who are not in the room \u2014 and they will assume that in two years, in some other interview, you will be talking about them the same way. The repair is not pretending everything was fine. It is describing the constraint without assigning a villain: &ldquo;the team was carrying two years of deferred maintenance and no allocated time&rdquo; carries exactly the same information as &ldquo;my manager refused to prioritise tech debt&rdquo;, and only one of them scores." },

              { t: "h", text: "4 \u00b7 A story with no difficulty in it" },
              { t: "p", html: "This one is invisible because the story is usually true, pleasant and well told: a project that went well, delivered on time, everyone happy. There is nothing to score, because nothing was hard. The signals are all defined in terms of pressure &mdash; ambiguity, conflict, incomplete information, competing goals &mdash; and a story with no resistance in it demonstrates none of them. Test each shortlist entry with one question: what was genuinely at risk of going wrong, and what would have happened if it had? If the honest answer is &ldquo;not much&rdquo;, keep the story as a warm-up but never spend a main question on it." },

              { t: "h", text: "5 \u00b7 Rambling past the point" },
              { t: "p", html: "Long answers are not penalised for length; they are penalised because the interviewer stops listening around the two-and-a-half minute mark and misses the Landing you eventually reached. The failure mode is nearly always the same: too much Setup, too much technical mechanism, and a landing that never quite arrives. There are two repairs. Prevention: budget the beats and open on the outcome, so the point is already delivered before you can lose it. Recovery, for when you notice you are long: stop expanding, say &ldquo;I will jump to the outcome \u2014 happy to go deeper on the cutover if that is useful&rdquo;, deliver Landing and Takeaway, and stop. Offering the detail hands them control and reads as self-awareness rather than as running out of road." },

              { t: "h", text: "6 \u00b7 A Takeaway beat that is a platitude" },
              { t: "p", html: "The last beat is where growth gets scored, and a generic sentiment scores exactly zero while consuming the time a real answer needed. The test is falsifiability: if the sentence could be said by anyone about any project, it is not evidence." },
              {
                t: "table",
                headers: ["Platitude", "Why it scores nothing", "The real version"],
                rows: [
                  ["&ldquo;I learned the importance of communication.&rdquo;", "True of every project ever run; names no behaviour and no change", "&ldquo;I now send a two-line written summary after any verbal decision \u2014 it has caught two misunderstandings since.&rdquo;"],
                  ["&ldquo;I learned to test more thoroughly.&rdquo;", "Unfalsifiable, and implies the lesson was obvious all along", "&ldquo;I write the rollback plan before the migration script now, because in this case we did not have one when we needed it.&rdquo;"],
                  ["&ldquo;I learned that I work well under pressure.&rdquo;", "A compliment to yourself, not a learning; nothing changed", "&ldquo;I stopped taking on-call and a launch in the same week \u2014 I made that call twice last quarter.&rdquo;"],
                  ["&ldquo;I learned to ask for help sooner.&rdquo;", "Right shape, but with no threshold it is still a sentiment", "&ldquo;I set a two-hour rule for being stuck before I escalate, and I say so in standup so it is visible.&rdquo;"]
                ]
              },
              { t: "cue", html: "<strong>Post-rehearsal checklist, six questions.</strong> Can someone name three things <em>I</em> did? Is there a magnitude in the Landing? Did I describe anyone unfairly? Was anything genuinely at risk? Did I land inside two minutes? Would my Takeaway sentence be false if said by someone else? Any &ldquo;no&rdquo; is the next thing to fix." },
              { t: "note", variant: "key", html: "<strong>These are scoring failures, not style points, and none of them will be flagged in the room.</strong> The worst is &ldquo;we&rdquo; throughout, because it converts a real achievement into an unscoreable one. &ldquo;We&rdquo; for the goal, &ldquo;I&rdquo; for the decisions \u2014 then a magnitude, a fair account of everyone involved, and a Takeaway sentence only you could say." },
              { t: "quiz", id: "beh-delivery" }
            ]
          }
        ]
      },

      /* ==================== ADVANCED ROUNDS ==================== */
      {
        id: "advanced",
        name: "Advanced Rounds",
        icon: "map",
        lessons: [

          {
            id: "special-types",
            title: "Rounds that need different handling",
            summary: "The recruiter screen, the values round, the project deep-dive, the cross-functional round and the hiring-manager conversation \u2014 what each is really testing.",
            minutes: 8,
            tags: ["round-types", "loop"],
            blocks: [
              { t: "p", html: "&ldquo;Behavioral round&rdquo; is a category, not a format. Five distinctly different conversations hide inside it, each with a different interviewer, a different scorecard and a different failure mode. Walking into all five with the same preparation is how strong candidates lose points in the ones that looked easy." },
              { t: "p", html: "The underlying signals do not change. What changes is which of them are being weighted, who is doing the weighting, and what you should be bringing that is not a story." },
              {
                t: "table",
                headers: ["Round", "What it is really testing", "What to bring"],
                rows: [
                  ["<strong>Recruiter screen</strong>", "Coherence, plausible fit at the advertised level, and process risk \u2014 plus the constraints (timing, location, expectations) that shape the whole loop", "A sixty-second background, the level you are targeting, and a deliberate position on compensation and timing"],
                  ["<strong>Leadership / values</strong>", "Whether your evidence maps onto the qualities this employer says it hires for", "Your existing stories pre-mapped to their language \u2014 not new stories written to order"],
                  ["<strong>Project deep-dive</strong>", "Depth and ownership: whether the decisions you narrate were genuinely yours", "One project you can survive three follow-ups on, including the parts that went badly"],
                  ["<strong>Cross-functional</strong>", "Whether people outside engineering can follow you, and whether you treat their constraints as real", "A story with a non-engineer in it, told without jargon, where their input actually changed your plan"],
                  ["<strong>Hiring manager / team match</strong>", "Whether they want you on the team next quarter, and whether the work will hold you", "Specific questions about the actual work, and a clear statement of what you want to be doing"]
                ]
              },

              { t: "h", text: "The recruiter screen" },
              { t: "p", html: "Treated as a formality more often than any other round, and it is the one where the most is quietly decided. The recruiter is screening for whether you are coherent, roughly at the level advertised, and unlikely to fall out of the process late &mdash; and simultaneously collecting the practical facts that everything downstream is built on, including the band they will slot you into before an engineer has met you." },
              { t: "p", html: "Two things to get right. First, have a sixty-second version of your background that names a level; vagueness here frequently results in being scheduled against a lower loop. Second, be deliberate rather than evasive about numbers &mdash; there is a real difference between a considered position and a refusal, and only one of them reads well. <a href='#/offer/execution/recruiter-scope'>What the recruiter actually controls</a> and <a href='#/offer/anatomy/leverage'>where leverage comes from</a> cover the mechanics; the behavioral point is simply that this call is scored." },

              { t: "h", text: "The leadership or values round" },
              { t: "p", html: "Where an employer publishes a named list of principles, this round interviews explicitly against it, often with one principle assigned per interviewer. The instinct is to memorise the list and quote it back. That is the weakest possible use of the preparation time, because the interviewer is scoring evidence against a rubric, not checking recall." },
              { t: "p", html: "What works is translation. Take the six to eight stories already on your shortlist and map each to the principles it genuinely demonstrates, then answer in your own words with the right evidence attached. If a principle has no story behind it, that is a real gap worth filling &mdash; but fill it with something you actually did, not something reverse-engineered to fit the wording. <a href='#/story/playbooks/principle-based'>Principle-based playbooks</a> works through the mapping." },

              { t: "h", text: "The project deep-dive" },
              { t: "p", html: "Forty-five minutes on one thing you built, with the interviewer probing until they hit the bottom of your understanding. It is graded on depth and ownership together, and the follow-ups are the whole exercise: the first two questions establish the shape and the third finds out whether you made the decisions or were near them." },
              { t: "p", html: "Choose for survivability, not impressiveness. A medium project you can defend three levels down beats a famous one where the second question exposes that someone else made the call. Include what went wrong \u2014 an unbroken success narrative reads as either sanitised or shallow, and the recovery is usually where the ownership evidence lives. If the deep-dive shades into system design or algorithms, that is a different preparation entirely and lives in Blueprint and Codex." },

              { t: "h", text: "The cross-functional round" },
              { t: "p", html: "An interviewer from product, design, data science or operations. Their scorecard is mostly communication and collaboration, and the failure mode is specific: engineers answer them at the same technical altitude they would use with an engineer, and it lands as either incomprehensible or dismissive." },
              {
                t: "compare",
                bad: { title: "How this round is usually lost", items: ["Technical altitude never drops", "Their constraint is described as an obstacle you routed around", "The story has no non-engineer in it with agency", "&ldquo;They wanted it fast so we cut corners&rdquo;", "No evidence you changed your plan because of them"] },
                good: { title: "What lands", items: ["Explains the decision in outcome terms first, mechanism only if asked", "Their constraint is stated as legitimate and priced", "A named counterpart who influenced the design", "&ldquo;Their launch date was fixed, so we shipped the read path first&rdquo;", "A plan that visibly changed after their input"] }
              },

              { t: "h", text: "The hiring manager and team match" },
              { t: "p", html: "This is the one conversation in the loop that is genuinely bidirectional, and the only one where your questions are part of the assessment. The manager is deciding whether they want you specifically, next quarter, on work that already exists &mdash; and whether that work will hold your interest long enough to be worth the hiring cost." },
              { t: "p", html: "So bring questions about the actual work rather than about culture: what is on the roadmap this half, what the team is worst at right now, what the last person in this role spent their time on, what would make the first six months a failure. And be specific about what you want to be doing. Vagueness here is usually read as either indifference or as not knowing, and both make a match harder to argue for." },
              { t: "note", variant: "warn", html: "<strong>Team match is where fit is decided, not just measured.</strong> If two teams want you, the one you were specific with is the one that argues for you internally. &ldquo;I am flexible&rdquo; sounds accommodating and functions as an absence of preference \u2014 which usually means you get assigned rather than chosen." },
              { t: "cue", html: "<strong>Before each round, ask who is in the room and what they are accountable for.</strong> Recruiter \u2192 coherence and level. Values interviewer \u2192 mapped evidence in their language. Deep-dive engineer \u2192 depth you can survive. Cross-functional partner \u2192 outcome language and a plan you changed. Hiring manager \u2192 specificity, in both directions." },
              { t: "note", variant: "key", html: "<strong>Same signals, different weightings and different interviewers.</strong> The one nobody prepares is the recruiter screen, and it is the one that sets the level everything else is measured against. Ask who you are meeting before every round, and adjust what you bring." }
            ]
          },

          {
            id: "ai-questions",
            title: "The new questions about working with AI",
            summary: "Five themes \u2014 Work, Trust, Iteration, Growth and Scaling \u2014 that are now asked in most loops and prepared for in almost none.",
            minutes: 9,
            tags: ["ai", "modern", "differentiator"],
            blocks: [
              { t: "p", html: "A set of questions has appeared in engineering loops over the last couple of years that most candidates have not thought about even once before being asked. They are not tool trivia. They are the same eight signals, probed through a new surface, and they are unusually revealing because there is no rehearsed script in circulation yet to hide behind." },
              { t: "p", html: "There is also a scoring asymmetry worth knowing. Both extremes are penalised: enthusiasm with no judgement (&ldquo;I use it for everything, it is amazing&rdquo;) and refusal with no reasoning (&ldquo;I do not use it, I prefer to write my own code&rdquo;) both read as an absence of thought. What is being scored is calibration &mdash; whether you have a rule, and whether the rule is tied to consequence." },

              { t: "h", text: "The five themes" },
              {
                t: "table",
                headers: ["Theme", "The question behind it", "Weak answer shape", "Strong answer shape"],
                rows: [
                  ["<strong>Work</strong>", "How does this concretely change your day?", "&ldquo;I use it for everything&rdquo; or &ldquo;I do not really use it&rdquo;", "Two or three named places in your workflow, with the reason each one fits and one place you deliberately do not"],
                  ["<strong>Trust</strong>", "How do you decide what to verify?", "&ldquo;I check everything&rdquo; or &ldquo;I trust it for code&rdquo;", "A rule tied to blast radius: fast where verification is cheap, slow where it touches data correctness, auth or money"],
                  ["<strong>Iteration</strong>", "What do you do when it is confidently wrong?", "&ldquo;I re-prompt until it works&rdquo;", "A diagnosis step \u2014 you can say what it got wrong and why \u2014 then narrowing the task rather than re-asking the same one"],
                  ["<strong>Growth</strong>", "How do you keep learning when generation is cheap?", "&ldquo;I still read the documentation&rdquo;", "A rule about what you refuse to delegate, plus one thing you learned deeply on purpose this year and why that one"],
                  ["<strong>Scaling</strong>", "Can you change how a team works, not just how you work?", "&ldquo;I would share some good prompts with the team&rdquo;", "A change you actually made to a team's practice \u2014 a review norm, a guardrail, a shared evaluation \u2014 and what happened as a result"]
                ]
              },

              { t: "h", text: "Work \u2014 what you actually do with it" },
              { t: "p", html: "The probe is concreteness. A generic answer suggests you are describing what you have read rather than what you do, and the follow-up (&ldquo;can you give me an example from this week?&rdquo;) arrives immediately. Name specific places: scaffolding a service you have written five times before, drafting tests against an interface you already designed, working through an unfamiliar API, reviewing your own change before a human sees it. Then name one place you deliberately do not, and say why. The exclusion is what makes the rest credible." },

              { t: "h", text: "Trust \u2014 where you rely on it, and how you decide" },
              { t: "p", html: "The most revealing of the five, because uniform answers in either direction are wrong for the same reason: verification has a cost, and applying the same level of it everywhere means you are not thinking about consequence. The strong shape states a rule keyed to blast radius." },
              {
                t: "compare",
                bad: { title: "Uniform, and therefore uncalibrated", items: ["&ldquo;I review every line it writes, always&rdquo;", "&ldquo;It is right most of the time so I ship it&rdquo;", "&ldquo;I never use it for production code&rdquo;", "No mention of what the code touches", "No account of what verification costs"] },
                good: { title: "Keyed to consequence", items: ["Cheap to verify \u2014 tests, scaffolding, throwaway scripts \u2014 move fast", "Expensive to verify \u2014 data correctness, auth, money, migrations \u2014 read every line", "Names the failure that would be hardest to detect later", "Explains what happens when the rule is wrong", "Has an example of each side"] }
              },

              { t: "h", text: "Iteration \u2014 correcting it when it is wrong" },
              { t: "p", html: "&ldquo;I re-prompt until it works&rdquo; is the weak answer because it describes persistence rather than diagnosis. The strong answer contains a step in the middle: you noticed the output was wrong, you can say <em>what</em> was wrong with it and why the model went that way \u2014 a stale API shape, a misread constraint, a plausible-looking invention \u2014 and then you narrowed the task or supplied the missing constraint instead of asking the same question again. That is debugging, applied to a new kind of output, and it is scored as judgement." },

              { t: "h", text: "Growth \u2014 learning when generation is cheap" },
              { t: "p", html: "The real concern behind this one is whether your understanding is keeping pace with your output. If you can produce more code than you can explain, that is a compounding risk to a team, and interviewers who have seen it happen ask about it directly." },
              { t: "p", html: "The strongest answers name a deliberate boundary: something you refuse to delegate because understanding it is the point, and one thing you have learned deeply on purpose in the last year with a reason for choosing that thing. &ldquo;I read the generated code before accepting it&rdquo; is table stakes. &ldquo;I write the first implementation myself in any area I intend to own&rdquo; is a policy, and policies score." },

              { t: "h", text: "Scaling \u2014 raising a team's effective use" },
              { t: "p", html: "Asked disproportionately of senior and staff candidates, because it converts a tooling question into an influence question &mdash; can you change how other people work, not just how you work. That is the same thing the staff row of the level table is asking for, and the shape of a strong answer is identical to any other influence story: a change you made to a team's practice, how you got agreement, and what measurably happened." },
              { t: "p", html: "Concrete examples that land: a review norm for generated code, a rule about what must be hand-written in a critical path, a shared prompt or evaluation for a task the whole team repeats, an onboarding change that got new people productive faster. If you have not done any of this, say so and describe what you would try and how you would know it worked \u2014 answered as a hypothetical, which as <a href='#/beh/foundation/how-evaluated'>the question types</a> covers, still scores if you give it a decision rule and a check." },
              { t: "note", variant: "trap", html: "<strong>Do not oversell.</strong> These questions are asked by people who use the same tools daily and know exactly where they break. An inflated claim invites a specific follow-up you cannot answer, and being caught overstating on this topic contaminates every other answer in the round. Understating slightly and being precise beats the reverse every time." },
              { t: "cue", html: "<strong>Prepare one concrete example per theme.</strong> One workflow you changed, one verification rule and why, one time you diagnosed a wrong output rather than re-prompting, one thing you refuse to delegate, and one change you made to how your team works. Five examples, roughly thirty seconds each \u2014 the cheapest differentiation available in the current market." },
              { t: "note", variant: "key", html: "<strong>They are scoring calibration, not enthusiasm.</strong> Every one of the five themes rewards a rule tied to consequence and punishes a uniform position in either direction. Prepare five short concrete examples and you will be better prepared than nearly everyone else in the pipeline." }
            ]
          },

          {
            id: "practicing",
            title: "How to actually get better",
            summary: "The rehearsal ladder from solo repetition to professional mocks, what each rung is good and bad at, and a four-week plan that puts them in the right order.",
            minutes: 9,
            tags: ["practice", "plan", "closing"],
            blocks: [
              { t: "p", html: "Reading this track will not improve your delivery. Behavioral performance is a motor skill wearing an intellectual disguise: the gap between knowing what a good answer contains and producing one out loud, under mild social pressure, in two minutes, is closed only by reps. What follows is how to spend those reps so they compound." },
              { t: "p", html: "The ladder below runs from cheapest to most expensive. Each rung is genuinely good at something the one below it cannot do, and each has a real limitation. Climbing in order matters, because every rung above the first is wasted if you do not yet have material to rehearse." },

              { t: "h", text: "The rehearsal ladder" },
              {
                t: "table",
                headers: ["Rung", "Good at", "Bad at"],
                rows: [
                  ["<strong>1 \u00b7 Solo, in your head</strong>", "Free and unlimited; fixing story selection, beat order and openings", "Runs at thought speed and silently repairs your own gaps \u2014 it makes you feel ready without testing delivery at all"],
                  ["<strong>2 \u00b7 Recording yourself</strong>", "The cheapest way to hear pace, filler and a Setup beat that ran to fifty seconds; brutally accurate on timing", "No follow-ups, no pressure, and you will invent reasons not to watch it back"],
                  ["<strong>3 \u00b7 An AI interviewer</strong>", "Unlimited reps with unpredictable follow-ups; safe to fail; excellent for covering questions you have never been asked", "Too agreeable \u2014 it rarely pushes back the way a sceptical engineer does, and it cannot tell you whether your scope reads as senior"],
                  ["<strong>4 \u00b7 Peer mocks</strong>", "Real interpersonal pressure, and a second read on whether the story actually landed", "Your peer's calibration may be wrong, and scheduling is the bottleneck that quietly kills most practice plans"],
                  ["<strong>5 \u00b7 Professional mocks</strong>", "Calibrated feedback on <em>level</em>, which is the one thing you cannot assess about yourself", "Expensive, slow to book, and largely wasted if your material is not ready"]
                ]
              },
              { t: "p", html: "Two rungs deserve extra attention. <strong>Recording</strong> is the highest-value-per-minute rung and the one people skip, because watching yourself is unpleasant &mdash; but it is the only cheap way to discover that your Setup beat is twice its budget or that you say &ldquo;kind of&rdquo; eleven times. Watch once with the sound off to see your pace, once with your eyes closed to hear the filler." },
              { t: "p", html: "<strong>AI interviewers</strong> are genuinely good at breadth: they will ask about the fourth-most-common conflict variant when you have only rehearsed the first. Use them for coverage and for surviving surprise. Do not use them for calibration \u2014 they will tell you a mid-level story is strong, because they have no bar to compare it against. <a href='#/story/playbooks/mock-drills'>Mock drills</a> has structured prompt sets for this." },
              { t: "note", variant: "trap", html: "<strong>Over-rehearsal has a distinct failure signature.</strong> Word-perfect delivery, identical phrasing on the second telling, and visible derailment when a follow-up arrives mid-story. Interviewers recognise it instantly and discount everything that follows, including the parts that are true. Rehearse the four landing points, never the sentences \u2014 if a story sounds slightly different every time, you are doing it right." },

              { t: "h", text: "Four weeks" },
              { t: "p", html: "If you have a loop scheduled, this is the order. The sequencing is the point: rehearsal is only worth doing on stories you have chosen, and expensive mocks are only worth booking on delivery that is already close." },
              {
                t: "table",
                headers: ["Week", "Focus", "Done when"],
                rows: [
                  ["<strong>1 \u00b7 Inventory</strong>", "Mine the last two to three years for candidate stories. Five lines each: situation, what you did, what changed, what you learned, roughly when. No structuring, no rehearsing \u2014 just get them out of your head", "You have ten to twelve raw stories written down and can see which parts of your experience are thin"],
                  ["<strong>2 \u00b7 Select and structure</strong>", "Cut to six to eight. Index each by signal, put each into four beats, and write only the opening line properly. Check coverage and fill the worst gap", "Every signal is covered at least twice, and every story opens on its outcome"],
                  ["<strong>3 \u00b7 Delivery</strong>", "Record every story once. Time it against its budget. Cut Context first. Re-record the three worst. Add the big three and the five AI examples", "Every story lands inside two minutes without sounding memorised, and you have watched all of it back"],
                  ["<strong>4 \u00b7 Pressure</strong>", "Two peer or professional mocks. AI reps on every question shape you have not been asked yet. Fix only what the mocks surface", "You have been surprised at least twice and recovered without losing the beat structure"]
                ]
              },
              { t: "p", html: "Compressed timelines: with one week, do a compressed version of weeks one and two and record the big three. With one day, write the six-story shortlist and say each opening line out loud five times. Selection and openings are where the marginal return is highest \u2014 they are what prevents the two worst outcomes, which are telling the wrong story and burying a good one." },
              { t: "p", html: "The trade-off worth naming: all of this competes with technical preparation for the same finite hours. The honest allocation is roughly proportional to the number of rounds and the size of your gap \u2014 but people systematically under-allocate here, because behavioral progress is invisible while a solved problem is not. If you have never recorded yourself, the first hour spent on this will return more than the fifth hour of problem practice." },

              { t: "h", text: "Where this leaves you" },
              { t: "p", html: "The arc of the track was one claim, made in <a href='#/beh/foundation/why-it-matters'>the first lesson</a> and then dismantled: that this round is unfalsifiable. It is not. There is a rubric of eight signals and a bar that moves with level (<a href='#/beh/foundation/how-evaluated'>how you are evaluated</a>). Every prompt probes one of them, and answering the signal rather than the sentence is a learnable habit (<a href='#/beh/foundation/decode'>name the signal</a>). Selection becomes retrieval once you have indexed a small shortlist (<a href='#/beh/foundation/select'>pick the story</a>). Four beats make an answer scoreable, and the last one is the one to defend (<a href='#/beh/delivery/deliver-salt'>SALT</a>). Three questions are guaranteed and worth building to the Standout tier (<a href='#/beh/delivery/big-three'>the big three</a>). Six habits quietly cost offers, and the worst is talking entirely in &ldquo;we&rdquo; (<a href='#/beh/delivery/pitfalls'>pitfalls</a>). Rounds differ in what they weight (<a href='#/beh/advanced/special-types'>special types</a>), and one whole category of question is new enough that preparing it is nearly free (<a href='#/beh/advanced/ai-questions'>AI questions</a>)." },
              { t: "p", html: "What remains is material and reps. Build the shortlist from your own work \u2014 <a href='#/story/catalog/journaling'>the log</a> if you have been keeping one, the last two years of your commit history and calendar if you have not \u2014 and then say it out loud until selection stops feeling like invention. When an offer does arrive, the level it arrives at is largely what these rounds decided, and what to do with it from there is <a href='#/offer/anatomy/components'>a different set of skills entirely</a>." },
              { t: "cue", html: "<strong>Start here, today, in this order.</strong> Write down ten stories from the last two years. Index them by signal and cut to six. Record yourself telling three of them and watch it back once. That is one evening, and it puts you ahead of most of the pipeline \u2014 everything after it is refinement." },
              { t: "note", variant: "key", html: "<strong>Climb the ladder in order, and never skip recording yourself.</strong> Material first, structure second, delivery third, pressure last \u2014 mocks booked before the material exists are wasted, and reps run only in your head test nothing. Rehearse the landing points, never the sentences." },
              { t: "quiz", id: "beh-advanced" }
            ]
          }
        ]
      }
    ]
  };
})();
