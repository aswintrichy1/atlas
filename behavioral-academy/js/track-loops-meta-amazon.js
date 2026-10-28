/* =====================================================================
   COMPASS · Company & Level Playbooks — Meta and Amazon loops

   Joins (or creates) window.TRACKS.loops and owns its first two modules:
   `meta` and `amazon`. Sibling files add further modules to the same
   track, so registration here is order-independent and every shared
   namespace is merged, never reassigned.

   Everything below describes patterns that candidates report publicly
   and consistently. Nothing here is insider information, and no real
   interview question is reproduced — only the recurring shapes.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGET — owned by this file
     ===================================================================== */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
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

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /* Will your story survive the drill? — deterministic depth simulator. */
  Widgets.loopsDepthDrill = function (mount) {
    if (!mount) return;
    mount.classList.add("widget");

    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "drill"),
      h("h3", {}, "Will your story survive the drill?")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Pick the depth your best story currently has, then pick the angle the interviewer probes from. "
      + "The readout tells you how many minutes of follow-up it holds, which question cracks it first, "
      + "and the exact probe to rehearse."));

    var DEPTHS = [
      {
        label: "Headline only",
        gloss: "I improved the checkout flow.",
        mins: "1-2",
        breaks: "What did you personally do, as opposed to your team?",
        verdict: "A resume line, not a story. The interviewer has no evidence at all yet."
      },
      {
        label: "Situation and outcome",
        gloss: "It was slow, we rebuilt it, latency dropped.",
        mins: "4-5",
        breaks: "Walk me through the decision you made in the middle of that.",
        verdict: "Feels complete out loud and dies on the second follow-up. Most candidates stop here."
      },
      {
        label: "Full SALT with metrics",
        gloss: "Context, your actions in first person, the measured result, the lesson.",
        mins: "12-15",
        breaks: "What would you do differently if you ran it again next quarter?",
        verdict: "Holds through a real drill. Strong for most rounds, with one gap left at the end."
      },
      {
        label: "SALT plus retro and lesson",
        gloss: "All of the above, plus what you would change and what it taught you.",
        mins: "18-20",
        breaks: "Nothing structural. Follow-ups turn into pressure-tests of your judgement instead.",
        verdict: "Drill-proof. This is the depth worth building for three or four stories, not for ten."
      }
    ];

    var ANGLES = [
      {
        label: "My specific contribution",
        q: "Which parts of that were yours, and what did other people own?",
        at: [
          "You have not named a single action of your own, so there is nothing to answer with.",
          "You can name the project but not your verbs. This is exactly where a we answer loses the point.",
          "You have first-person actions ready. Answer in I, then name who owned the rest without hedging.",
          "You can also say what you deliberately delegated, which reads as judgement rather than modesty."
        ]
      },
      {
        label: "The trade-off I rejected",
        q: "What other options did you consider, and why did you not take them?",
        at: [
          "No options means no decision, and no decision means no seniority signal.",
          "You will invent an alternative on the spot and it will sound invented. Prepare the real one.",
          "Name the option you rejected and the cost you refused to pay. That sentence is the whole answer.",
          "You can go one further and say which rejected option you would revisit now, and on what evidence."
        ]
      },
      {
        label: "How I measured it",
        q: "How did you know it worked, and what was the number before you started?",
        at: [
          "Improved is not a measurement. The follow-up will land immediately and you will stall.",
          "You have an after number and no before number, so the delta is unprovable.",
          "Give before, after, and the window it was measured over. Then say who else saw the number.",
          "Add the metric you chose not to optimise, and why moving it would have been the wrong win."
        ]
      },
      {
        label: "What I would change",
        q: "If you ran it again next quarter, what would you do differently?",
        at: [
          "With no detail underneath, any answer here sounds like a rehearsed weakness.",
          "You can only critique the outcome, not your own decisions, which reads as blame-shifting.",
          "This is the gap in a metrics-complete story. Name one decision you would reverse, and why.",
          "Already covered. Use the time to connect the lesson to something you changed afterwards."
        ]
      }
    ];

    var depthIdx = -1;
    var angleIdx = -1;

    var stage = h("div", { class: "w-stage" });
    var depthSeg = h("div", { class: "w-seg" });
    var angleSeg = h("div", { class: "w-seg" });
    var depthOut = h("div", { class: "w-readout" });
    var angleOut = h("div", { class: "w-readout" });
    var depthBtns = [];
    var angleBtns = [];

    function paint() {
      var d = depthIdx >= 0 ? DEPTHS[depthIdx] : null;
      var a = angleIdx >= 0 ? ANGLES[angleIdx] : null;

      depthBtns.forEach(function (b, i) {
        if (i === depthIdx) b.classList.add("active"); else b.classList.remove("active");
      });
      angleBtns.forEach(function (b, i) {
        if (i === angleIdx) b.classList.add("active"); else b.classList.remove("active");
      });

      clear(depthOut);
      if (!d) {
        depthOut.appendChild(ro("depth", "pick one above — the scale runs from a resume line to drill-proof"));
      } else {
        depthOut.appendChild(ro("sounds like", d.gloss));
        depthOut.appendChild(ro("survives", d.mins + " min of follow-ups"));
        depthOut.appendChild(ro("first crack", d.breaks));
        depthOut.appendChild(ro("verdict", d.verdict));
      }

      clear(angleOut);
      if (!a) {
        angleOut.appendChild(ro("probe angle", "pick one above to see the exact question to expect"));
      } else {
        angleOut.appendChild(ro("expect word for word", a.q));
        angleOut.appendChild(ro("at this depth", d ? a.at[depthIdx] : "pick a depth above to see whether your story holds under it"));
      }
    }

    DEPTHS.forEach(function (d, i) {
      var b = h("button", {
        class: "w-seg-btn",
        type: "button",
        onclick: function () { depthIdx = i; paint(); }
      }, d.label);
      depthBtns.push(b);
      depthSeg.appendChild(b);
    });

    ANGLES.forEach(function (a, i) {
      var b = h("button", {
        class: "w-seg-btn",
        type: "button",
        onclick: function () { angleIdx = i; paint(); }
      }, a.label);
      angleBtns.push(b);
      angleSeg.appendChild(b);
    });

    stage.appendChild(h("div", { class: "w-field" }, "1 - How deep is the story today?"));
    stage.appendChild(depthSeg);
    stage.appendChild(depthOut);
    stage.appendChild(h("div", { class: "w-field", style: "margin-top:18px" }, "2 - Which angle does the interviewer probe from?"));
    stage.appendChild(angleSeg);
    stage.appendChild(angleOut);
    mount.appendChild(stage);

    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =====================================================================
     QUIZZES — owned by this file
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "loops-meta": {
      title: "Meta loop checkpoint",
      sub: "Five competencies, the loop lead, and the level the behavioral round can cost you.",
      questions: [
        {
          q: "The behavioral round in a Meta loop is commonly reported to be run by which interviewer?",
          options: [
            "A peer engineer picked at random from another organisation",
            "The loop lead, who aggregates the whole loop's feedback and makes the hiring recommendation",
            "A recruiter, with no engineer in the room",
            "An outside assessor who never sees the technical scores"
          ],
          answer: 1,
          explain: "Candidates consistently report that the behavioral interviewer is the loop lead — the person who "
            + "collects every write-up and carries the recommendation forward. That is why the round that feels like a "
            + "friendly chat is the highest-leverage conversation of the day. Treat it as the round that frames all the "
            + "others, not as a cooldown between coding rounds."
        },
        {
          q: "Roughly how many behavioral stories should you plan to bring, and why that number?",
          options: [
            "About twenty-five — one for every question you can imagine being asked",
            "Two — one strong story can be stretched to cover every competency",
            "About ten — five named competencies with roughly two stories each",
            "None — behavioral signal is inferred from how you talk during the coding rounds"
          ],
          answer: 2,
          explain: "Five competencies are commonly reported as the assessed set, with roughly two stories each, which "
            + "lands at about ten. Ten is small enough to rehearse to real depth and large enough that you are never "
            + "forced to reuse a story inside one round. Build the coverage grid first, then write stories to fill the "
            + "gaps it exposes."
        },
        {
          q: "A candidate interviewing at E5 codes and designs well but gives thin behavioral answers drawn from one small project. What is the commonly reported consequence?",
          options: [
            "The behavioral score is discounted because the technical rounds were stronger",
            "An extra behavioral round is added until the signal is clear",
            "Nothing — behavioral feedback is advisory only",
            "They can be down-levelled to E4 on behavioral performance alone"
          ],
          answer: 3,
          explain: "Candidates consistently report that behavioral performance by itself can turn an E5 loop into an E4 "
            + "offer. The reason is structural: E5 is defined by independent scope, tolerance for ambiguity, and "
            + "cross-team influence, and the only evidence of those is the stories you tell. Clean code cannot "
            + "substitute for missing scope evidence."
        },
        {
          q: "You are interviewing for a product-flavoured role. Which design round should you prepare for?",
          options: [
            "Product Architecture, where infrastructure-flavoured roles more commonly get System Design",
            "Neither — product-flavoured roles skip the design round entirely",
            "System Design, because every loop uses the same design round regardless of role",
            "Both, run back to back on the same day"
          ],
          answer: 0,
          explain: "Product-flavoured roles commonly get a Product Architecture round while infrastructure-flavoured "
            + "roles get System Design. The two reward different openings — one starts from users, surfaces, and data "
            + "models, the other from load, storage, and failure. Ask your recruiter which one your loop contains; it is "
            + "a normal question and the answer redirects weeks of preparation."
        },
        {
          q: "Which set is commonly reported as the named behavioral competency framework for this loop?",
          options: [
            "Impact, direction, people, execution, craft",
            "Resolving conflicts, driving results, embracing ambiguity, growing continuously, communicating effectively",
            "Coding, design, product sense, communication, culture fit",
            "Ownership, bias for action, frugality, customer obsession, dive deep"
          ],
          answer: 1,
          explain: "The five commonly reported competencies are resolving conflicts, driving results, embracing "
            + "ambiguity, growing continuously, and communicating effectively. One of the distractors is another "
            + "employer's principle language, and reaching for it here signals you prepared for a different loop. Name "
            + "the competency a story serves before you tell it."
        },
        {
          q: "The M1 engineering-manager loop is commonly reported to contain which set of rounds?",
          options: [
            "Behavioral rounds only — managers are not assessed technically",
            "Four coding rounds plus a single behavioral round",
            "People management, behavioral, project retrospective, system design or product architecture, and AI-enabled coding",
            "A written exercise plus two design rounds"
          ],
          answer: 2,
          explain: "The manager loop keeps a technical spine — a design round plus an AI-enabled coding round — and adds "
            + "people management and a project retrospective. Candidates who prepare only people stories get caught by "
            + "the technical half; candidates who prepare only technically get caught by the retrospective, which wants "
            + "an honest post-mortem rather than a success story. Prepare both halves."
        },
        {
          q: "Coding rounds are commonly reported to run in a shared browser editor with no compiler and no test runner. What should that change about your preparation?",
          options: [
            "Nothing — you can paste a solution from your local editor during the round",
            "Memorise standard-library internals in case the editor rejects your code",
            "Work only in pseudo-code, since syntax cannot be checked without a compiler",
            "Write correct, complete code from memory, then dry-run a small input by hand out loud"
          ],
          answer: 3,
          explain: "With nothing executing your code, the interviewer's only evidence that it works is your own trace "
            + "through it. Practise typing full solutions without autocomplete and then walking a small input through "
            + "them line by line. Syntax still counts, because sloppy syntax reads as unfamiliarity with the language "
            + "you claimed on your resume."
        }
      ]
    },

    "loops-amazon": {
      title: "Amazon loop checkpoint",
      sub: "Principles in every round, the Bar Raiser, and why depth beats breadth.",
      questions: [
        {
          q: "How are Leadership Principles commonly reported to appear across an Amazon loop?",
          options: [
            "Embedded in every round, commonly as roughly 20-30 minutes of behavioral questions before the technical portion",
            "Only in the online assessment",
            "Only in the Bar Raiser round",
            "In a written self-assessment candidates complete after the loop"
          ],
          answer: 0,
          explain: "Candidates consistently report principle-driven questions opening essentially every round, taking "
            + "roughly the first 20-30 minutes before the technical portion begins. Across a full loop that adds up to "
            + "far more behavioral assessment than any single round suggests. Budget your preparation against that "
            + "total, not against one round."
        },
        {
          q: "Who runs the Bar Raiser round, and what shape does it commonly take?",
          options: [
            "The hiring manager, running a short culture chat at the end of the day",
            "An interviewer from outside the hiring team, running close to an hour almost entirely on Leadership Principles",
            "A recruiter scoring communication only",
            "A panel of three engineers drawn from the hiring team"
          ],
          answer: 1,
          explain: "The Bar Raiser sits outside the hiring team, and that is the entire point — they protect the "
            + "company's bar rather than the team's immediate need to fill a seat. The round commonly runs close to a "
            + "full hour and is almost entirely principle-driven. Because it is independent of the team, it is not a "
            + "formality you can coast through on the strength of your technical rounds."
        },
        {
          q: "The Bar Raiser commonly stretches a single story across 15-20 minutes of follow-ups. What does that imply for your preparation?",
          options: [
            "Avoid metrics, because numbers invite follow-ups",
            "Prepare one short story per principle so you can cover all of them",
            "Depth per story matters more than breadth — one story that survives twenty minutes of probing beats five shallow ones",
            "Reuse a single story verbatim in every round of the loop"
          ],
          answer: 2,
          explain: "A story that absorbs twenty minutes of 'and then what did you do' needs real material underneath it: "
            + "your specific actions, the options you rejected, the numbers, and what you would change. Shallow stories "
            + "collapse around the third follow-up, and the collapse itself is the signal being recorded. Build fewer "
            + "stories and take each one deeper."
        },
        {
          q: "How many stories do candidates commonly report carrying into an Amazon loop?",
          options: [
            "One per round, so four or five in total",
            "Thirty or more, so that no story is ever repeated",
            "One per principle, memorised word for word",
            "Two or more detailed stories per principle, landing at roughly ten reusable stories overall"
          ],
          answer: 3,
          explain: "The commonly reported shape is two or more detailed stories per principle, which collapses to "
            + "roughly ten reusable stories because a good story maps to several principles at once. Ten is few enough "
            + "to know at drill depth and many enough to survive a full day without repeating yourself. Index them by "
            + "principle rather than by project, or you will hunt for them under pressure."
        },
        {
          q: "What is commonly reported about the online assessment?",
          options: [
            "It includes a work-simulation and work-style section scored against the Leadership Principles",
            "It replaces the Bar Raiser round for entry-level candidates",
            "It is a written exercise reviewed by the hiring manager",
            "It is purely algorithmic, with no behavioral component"
          ],
          answer: 0,
          explain: "The assessment commonly pairs coding work with a work-simulation and work-style section that is "
            + "scored against the Leadership Principles. Candidates who click through that part quickly because it is "
            + "'not the real interview' are in fact answering a scored instrument. Answer it the way you would answer "
            + "the Bar Raiser: consistently, and in line with the principles you will later claim out loud."
        },
        {
          q: "The Bar Raiser typically drills three or four principles exhaustively rather than touching all of them. Why prepare coverage across all of them anyway?",
          options: [
            "Because the Bar Raiser scores breadth explicitly alongside depth",
            "You cannot predict which three or four they will pick, and every other round carries its own 20-30 minutes of principle-driven questions",
            "Because the recruiter grades your coverage grid before the loop is scheduled",
            "Coverage is unnecessary — guess the three most likely principles and prepare only those"
          ],
          answer: 1,
          explain: "Depth is what survives the Bar Raiser, but you have no way to know in advance which principles that "
            + "interviewer will choose to drill. Meanwhile the rest of the loop samples widely, so a gap surfaces "
            + "somewhere even if the Bar Raiser never touches it. Prepare broad coverage first, then take your three or "
            + "four strongest stories to drill depth."
        },
        {
          q: "What is commonly reported to be added to Amazon manager loops?",
          options: [
            "A second Bar Raiser drawn from the hiring team",
            "A live coding round with no behavioral portion",
            "A written exercise",
            "A take-home design document submitted before the loop begins"
          ],
          answer: 2,
          explain: "Manager loops commonly add a written exercise, and it is assessed for structure and judgement as "
            + "much as for content. It rewards the same habits as a good spoken story: a concrete situation, the "
            + "decision you made, the trade-off you accepted, and the measured outcome. Practise writing one under time "
            + "pressure rather than meeting the format for the first time on the day."
        }
      ]
    }
  });

  /* =====================================================================
     MODULE 1 — META PLAYBOOKS
     ===================================================================== */
  var MOD_META = {
    id: "meta",
    name: "Meta Playbooks",
    icon: "blocks",
    lessons: [
      /* ------------------------------------------------ E3 ------------- */
      {
        id: "meta-e3",
        title: "Meta E3 — coding fluency and coachability",
        summary: "The entry-level loop is coding-weighted, but the behavioral round is still run by the person who writes the recommendation.",
        minutes: 8,
        tags: ["meta", "e3", "loop"],
        blocks: [
          { t: "p", html: "Hold this picture for the whole E3 loop: the day is asking two questions in different costumes. <strong>Can you write correct code while someone watches?</strong> And <strong>are you someone this team can grow?</strong> Every round is one of those two, and the behavioral round is the only place the second one gets answered out loud." },
          { t: "p", html: "Scope expectations at E3 are genuinely low. Nobody expects you to have led a migration or influenced a partner org. What is <em>not</em> low is the expectation of <strong>specificity</strong> — a small story told with your own verbs, a real number, and a decision you made beats a large story told in the passive voice." },
          { t: "stat", items: [
            { v: "5", k: "named competencies" },
            { v: "~2", k: "stories per competency" },
            { v: "~10", k: "stories to prepare" }
          ] },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "~30 min", "Call, no code", "Level targeting, timeline, and whether your background matches open headcount. Nothing here is graded, but the level you get slotted into is decided in this conversation."],
              ["Technical screen", "~45 min", "Shared browser editor, commonly reported to have no compiler and no test runner", "Two problems is the commonly reported shape. Data-structure fluency, correct syntax from memory, and whether you narrate while you type."],
              ["Coding round (x2 in the loop)", "~45 min each", "Same editor, same no-run constraint", "The same bar as the screen with less patience. Two problems per round is again the common pattern, plus how you respond when a hint is offered."],
              ["Behavioral round", "~45 min", "Conversation, commonly with the loop lead", "The five named competencies, at roughly two stories each. Coachability carries unusual weight at this level."]
            ]
          },
          { t: "p", html: "E3 loops are commonly reported as coding-weighted, with the dedicated design round either dropped or run as a lighter discussion rather than a scored deep-dive. Treat that as likely, not guaranteed, and confirm it rather than assuming." },
          { t: "note", variant: "tip", html: "The no-compiler detail is the one candidates underestimate. If your practice habit is <em>type, run, fix</em>, you have been outsourcing correctness to a tool that will not be in the room. Practise writing a full solution and then hand-tracing one small input through it out loud — that trace is the only proof the interviewer gets. Codex is the Atlas academy for that drilling." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Candidates consistently report five named behavioral competencies: <strong>resolving conflicts</strong>, <strong>driving results</strong>, <strong>embracing ambiguity</strong>, <strong>growing continuously</strong>, and <strong>communicating effectively</strong>. Roughly two stories each is the widely-reported budget, which is where the number ten comes from." },
          { t: "table",
            headers: ["Competency", "What it actually means", "E3 evidence that lands"],
            rows: [
              ["Resolving conflicts", "You disagreed with someone who had a stake in the outcome, and the working relationship survived it.", "A code-review disagreement or an ownership clash you took directly to the person instead of escalating or silently complying."],
              ["Driving results", "You moved a concrete thing across the line and can say what changed.", "One feature or one bug-fix stream you finished, with the before and after number attached."],
              ["Embracing ambiguity", "You acted when the ticket did not tell you what to do.", "You asked the two questions that mattered, wrote your assumption down, and shipped instead of waiting to be unblocked."],
              ["Growing continuously", "You take feedback and visibly change behaviour.", "One piece of critical feedback that stung, what you changed the following week, and how you know it stuck."],
              ["Communicating effectively", "Someone else acted correctly on information you gave them.", "The update, doc, or diagram that unblocked a reviewer or a partner without a follow-up meeting."]
            ]
          },
          { t: "note", variant: "tip", html: "Ask your recruiter what the loop contains and which competencies the behavioral round covers. This is a normal, welcomed question — see <a href='#/offer/execution/recruiter-scope'>what your recruiter can actually tell you</a> for how to phrase it so you get a real answer." },

          { t: "h", text: "Question types most commonly reported" },
          { t: "p", html: "These are recurring <em>shapes</em>, not wordings. Interviewers improvise the phrasing; the shape is what you can prepare for. Practise mapping a live question onto one of these in the first five seconds — <a href='#/beh/foundation/decode'>naming the signal behind the question</a> is the drill." },
          { t: "ul", items: [
            "<strong>Feedback-and-change</strong> — feedback you did not want to hear, and what measurably changed afterwards.",
            "<strong>Peer disagreement</strong> — a technical disagreement with someone at your level, and how it resolved.",
            "<strong>Finish-something-hard</strong> — a thing that was harder than expected and shipped anyway.",
            "<strong>Unclear requirements</strong> — a task where you had to decide what it meant before you could start.",
            "<strong>Explain-it-simply</strong> — a technical idea you had to make land for a non-engineer.",
            "<strong>Motivation</strong> — why this team, why now, and what you want to be doing in two years."
          ] },
          { t: "p", html: "Notice what is absent at E3: nothing on this list requires organisational scope. Reaching for a borrowed scope story here backfires, because the follow-ups will find the parts you did not own." },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>The chat is the highest-stakes round.</strong> The behavioral interviewer is commonly the loop lead — the person who aggregates every interviewer's feedback and makes the hiring recommendation. The friendliest 45 minutes of the day carries the most weight.",
            "<strong>Small scope is fine, vague scope is not.</strong> Candidates trade specificity for size and lose both. One shipped fix with a number beats a team epic told in the passive voice.",
            "<strong>Coachability is scored, not assumed.</strong> Accepting a hint gracefully in a coding round and having a real feedback story in the behavioral round are the same signal, sampled twice."
          ] },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Build the grid before the stories.</strong> Five competencies, two slots each. Fill it from the projects you actually have — see <a href='#/story/catalog/coverage-matrix'>the coverage matrix</a> to find your gaps before you start writing.",
            "<strong>Write ten stories in SALT and say them out loud.</strong> Written stories collapse when spoken. <a href='#/beh/delivery/deliver-salt'>Delivering SALT under pressure</a> is the format drill.",
            "<strong>Kill every 'we'.</strong> At E3 this is the single most common point loss. <a href='#/beh/delivery/pitfalls'>The pitfalls that cost the most points</a> covers the rest.",
            "<strong>Practise coding without a compiler</strong> until a full solution from memory feels normal. Blueprint and Codex are the Atlas academies for the technical half; this track only covers how the loop is scored.",
            "<strong>Confirm the loop shape with your recruiter</strong> a week out, including whether a design round is in it. If your target level is ambiguous, read <a href='#/offer/anatomy/level-bands'>how level bands work</a> before that call."
          ] },
          { t: "cue", html: "Recognise the coachability probe: <em>hardest feedback</em>, <em>a time you were wrong</em>, <em>something you would do differently</em>, or an interviewer offering a hint you did not ask for. All four are the same question. The answer that scores names the change you made and the evidence it held." },
          { t: "note", variant: "key", html: "<strong>At E3 the behavioral round is not the soft round — it is the round run by the person writing your recommendation.</strong> Ten specific stories built from small, real work, each with your own verbs and one number, outscore borrowed scope every time." }
        ]
      },

      /* ------------------------------------------------ E4 ------------- */
      {
        id: "meta-e4",
        title: "Meta E4 — owning a feature end to end",
        summary: "The design round arrives, and your stories have to grow from tasks into feature-sized arcs you owned.",
        minutes: 9,
        tags: ["meta", "e4", "loop"],
        blocks: [
          { t: "p", html: "The mental model shifts from <em>can you code</em> to <strong>can you own a feature from ambiguous request to shipped and measured</strong>. That is the whole E4 bar, and it changes the size of the unit your stories describe: not a ticket, not an org-wide programme, but one coherent thing with your name on it." },
          { t: "p", html: "The loop also grows a design round, and which design round you get depends on the flavour of the role rather than the level. That single fact redirects weeks of preparation, and most candidates never ask." },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Technical screen", "~45 min", "Shared browser editor, commonly with no compiler or test runner", "Two problems is the common shape. Clean first-pass code and complexity stated without being asked."],
              ["Coding round (x2 in the loop)", "~45 min each", "Same editor and constraints", "Two problems per round is again common. At E4 the follow-up matters: can you extend your own solution when the requirement changes mid-round."],
              ["System Design <em>or</em> Product Architecture", "~45 min", "Whiteboard or shared canvas, no code", "Which one you get commonly tracks the flavour of the role — infrastructure-flavoured roles get System Design, product-flavoured roles get Product Architecture."],
              ["Behavioral round", "~45 min", "Conversation, commonly with the loop lead", "The five competencies at roughly two stories each, now judged on whether you owned the arc or merely worked inside it."]
            ]
          },
          { t: "note", variant: "warn", html: "Find out which design round you are getting. Ask plainly: <em>is the design round system design or product architecture for this role?</em> A product architecture round rewards opening from users, surfaces, and entities; a system design round rewards opening from load, storage, and failure. Prepare for the wrong one and you will spend your first ten minutes in the wrong language. Blueprint is the Atlas academy for both." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "The same five competencies — resolving conflicts, driving results, embracing ambiguity, growing continuously, communicating effectively — with roughly two stories each. What changes between levels is not the list but the <strong>radius of evidence</strong> each competency demands." },
          { t: "table",
            headers: ["Competency", "What it actually means", "E4 evidence that lands"],
            rows: [
              ["Resolving conflicts", "You held a position against someone whose agreement you needed.", "A disagreement with a partner engineer, a designer, or a reviewer where you changed the plan rather than the relationship."],
              ["Driving results", "You owned a feature end to end and can defend the number.", "A feature you scoped, built, shipped, and measured — including the part where you cut something to hit the date."],
              ["Embracing ambiguity", "You turned a vague request into a plan other people could execute against.", "You wrote the short doc that turned 'make onboarding better' into three concrete workstreams with an owner each."],
              ["Growing continuously", "You sought feedback rather than waiting for it.", "You asked for a design review you did not have to ask for, and changed the approach because of what came back."],
              ["Communicating effectively", "You kept people aligned across a multi-week arc without meetings.", "The status update or design doc that stopped a partner team from building the wrong thing."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>End-to-end ownership</strong> — walk me through something you owned from start to finish.",
            "<strong>Scope cut under deadline</strong> — a date you were going to miss, and what you dropped.",
            "<strong>Cross-functional friction</strong> — a disagreement with product, design, or a partner engineer.",
            "<strong>Vague mandate</strong> — a request that arrived without requirements, and how you gave it shape.",
            "<strong>Technical bet</strong> — a decision that could have gone either way, and how you chose.",
            "<strong>Handled-badly</strong> — a project you would run differently now, told without self-flagellation."
          ] },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>Task-sized stories cannot clear the E4 bar.</strong> A well-told two-week story is still a two-week story. The interviewer is looking for an arc with a start you shaped and an end you measured — see <a href='#/story/catalog/scope-signal'>the scope signal</a> for how to resize what you already have.",
            "<strong>The design round flavour is role-dependent, and you have to ask.</strong> Nobody volunteers it, and candidates assume it is the same for everyone.",
            "<strong>The behavioral round is still run by the loop lead.</strong> It sits alongside the technical rounds in the packet rather than underneath them, which is why a flat behavioral round can pull a good technical loop down."
          ] },
          { t: "compare",
            bad: { title: "E3-shaped answer at an E4 bar", items: ["'I was assigned the API endpoint and I finished it early.'", "Scope was handed to you, whole", "No decision to defend", "Success is 'it shipped'", "Nobody outside your team appears in the story"] },
            good: { title: "E4-shaped answer", items: ["'The request was vague, so I scoped it into three pieces and owned the delivery of all three.'", "You shaped the scope before you built it", "One trade-off you chose and can still defend", "Success is a measured number against a baseline", "A partner team, a designer, or a reviewer had to be brought along"] }
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Resize your existing material first.</strong> Most E4 candidates have the arc and tell the ticket. Zoom out to the request that started it and the number that ended it — <a href='#/story/catalog/scope-signal'>the scope signal</a> is the resizing drill.",
            "<strong>Ask which design round you are getting</strong> before you build a study plan. <a href='#/offer/execution/recruiter-scope'>What your recruiter can tell you</a> covers how to ask without sounding underprepared.",
            "<strong>Fill the grid to ten stories</strong>, then check that at least three involve someone outside your immediate team. <a href='#/story/catalog/coverage-matrix'>The coverage matrix</a> exposes the gap fast.",
            "<strong>Drill the three questions every round returns to</strong> — the ones about impact, conflict, and failure. <a href='#/beh/delivery/big-three'>The big three</a> are worth more rehearsal than everything else combined.",
            "<strong>Do one timed mock per week</strong> with someone who will interrupt you. <a href='#/beh/advanced/practicing'>How to practise so it transfers</a> beats re-reading your notes.",
            "<strong>If you are targeting E5 instead</strong>, read <a href='#/loops/meta/meta-e5'>the E5 playbook</a> now, not later — the story-selection work is different and starts earlier."
          ] },
          { t: "cue", html: "Recognise the ownership probe: <em>walk me through</em>, <em>end to end</em>, <em>what was your role</em>, <em>who decided that</em>. All four are asking where the boundary of your ownership was. Answer by naming the boundary explicitly — what you owned, what you influenced, what you inherited." },
          { t: "note", variant: "key", html: "<strong>E4 is judged on arcs, not tasks.</strong> Take three stories you already have and re-cut each one to start at the ambiguous request and end at a measured number — and find out this week whether your design round is System Design or Product Architecture." }
        ]
      },

      /* ------------------------------------------------ E5 ------------- */
      {
        id: "meta-e5",
        title: "Meta E5 — where the behavioral round decides the level",
        summary: "The step where independent scope, ambiguity, and cross-team influence dominate — and where a flat behavioral round costs you a level.",
        minutes: 11,
        tags: ["meta", "e5", "loop", "down-level"],
        blocks: [
          { t: "p", html: "E5 is the step where the question changes from <em>can you deliver what you were given</em> to <strong>can you decide what should be delivered, and then get other teams to go along with it</strong>. The coding rounds barely move. The behavioral round changes completely, because independent scope and cross-team influence have no other place to show up." },
          { t: "p", html: "State the consequence plainly, because it is the single most actionable fact in this module: <strong>candidates consistently report that behavioral performance alone can down-level an E5 candidate to E4.</strong> Not a failed loop — an offer one level below the one you interviewed for, with the compensation band that goes with it. Strong coding and a clean design round do not compensate, because they are not evidence of the thing E5 is defined by." },
          { t: "stat", items: [
            { v: "E5 → E4", k: "down-level on behavioral alone" },
            { v: "~10", k: "stories, half with cross-team reach" },
            { v: "1", k: "interviewer who aggregates the loop" }
          ] },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Technical screen", "~45 min", "Shared browser editor, commonly with no compiler or test runner", "Two problems is the common shape. At E5 the bar is fluency rather than brilliance — correct, fast, and narrated."],
              ["Coding round (x2 in the loop)", "~45 min each", "Same editor and constraints", "Two problems per round is again common. Expect a mid-round requirement change to see whether your first design survives it."],
              ["System Design <em>or</em> Product Architecture", "~45 min", "Whiteboard or shared canvas", "Commonly tracks the role flavour. At E5 the differentiator is the trade-off you name unprompted, not the boxes you draw."],
              ["Behavioral round", "~45 min", "Conversation, commonly with the loop lead", "The five competencies at roughly two stories each, now scored on independent scope, tolerance for ambiguity, and influence without authority. This is where the level is set."]
            ]
          },
          { t: "p", html: "The loop shape looks almost identical to E4. That similarity is the trap: candidates prepare the E4 loop harder instead of preparing the E5 <em>bar</em>, and then cannot explain afterwards why the offer came back a level low." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Same five competencies — resolving conflicts, driving results, embracing ambiguity, growing continuously, communicating effectively — roughly two stories each. At E5, three of the five quietly become scope questions in disguise." },
          { t: "table",
            headers: ["Competency", "What it actually means at E5", "E5 evidence that lands"],
            rows: [
              ["Resolving conflicts", "You resolved a disagreement with someone you had no authority over, and shipped anyway.", "A partner team wanted a different interface. You changed their mind with data, or you accepted their constraint and said so out loud, and the project still landed."],
              ["Driving results", "You delivered something whose scope you set yourself.", "A multi-quarter workstream where you chose the sequencing, defended the cut, and can name the metric it moved."],
              ["Embracing ambiguity", "You created clarity where none existed, for other people as well as yourself.", "A problem statement with no owner that you turned into a plan, a doc, and someone else's roadmap item."],
              ["Growing continuously", "You changed how you operate, not just what you know.", "Feedback about influence, communication, or judgement — and the operating change you made in response."],
              ["Communicating effectively", "You moved a decision across teams in writing.", "The doc that got three teams to agree on one approach, or the escalation you wrote that was calm enough to work."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Influence without authority</strong> — you needed a team you do not manage to change what they were doing.",
            "<strong>Self-set scope</strong> — something you decided to do that nobody asked you for.",
            "<strong>Ambiguity with stakes</strong> — a decision made on incomplete information, and what it cost.",
            "<strong>Disagreement upward</strong> — you thought a senior decision was wrong, and what you did about it.",
            "<strong>Prioritisation under conflict</strong> — two teams needed opposite things from you.",
            "<strong>Failure you owned</strong> — something that went badly where you were the accountable person.",
            "<strong>Mentorship and multiplication</strong> — you made other engineers better, and how you know."
          ] },
          { t: "p", html: "Every one of those is answerable at either level. The difference is entirely in the evidence you bring — see <a href='#/story/catalog/ownership-ambiguity'>ownership and ambiguity stories</a> for how the same project can be told at two different bars." },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>The down-level is real and it is behavioral.</strong> Candidates report clearing every technical round and receiving an E4 offer, with the feedback pointing at scope and influence evidence rather than at code.",
            "<strong>The stories that got you promoted internally are not the stories that clear E5 externally.</strong> Internally your scope is known; in a loop it has to be reconstructed from a five-minute answer, which means you have to say it, not imply it.",
            "<strong>The loop lead is aggregating.</strong> A weak behavioral round does not just score badly on its own — it colours how the rest of the packet is read by the person writing the recommendation."
          ] },
          { t: "compare",
            bad: { title: "The E4 story that costs you the level", items: ["'My manager asked me to lead the migration.'", "Scope arrived from above", "One team, one codebase", "'We agreed on the approach' — no friction visible", "Result is delivery: it shipped on time"] },
            good: { title: "The same project told at E5", items: ["'I noticed the migration was going to stall, wrote the case, and got it funded.'", "You created the scope, then got it accepted", "Two or three teams had to move for you", "You name the disagreement and how it resolved", "Result is impact plus the cost you chose to pay"] }
          },
          { t: "table",
            headers: ["Level", "What the behavioral round must prove", "The sentence that fails it"],
            rows: [
              ["E4", "You owned a feature arc end to end and measured it.", "'I completed the tickets I was assigned.'"],
              ["E5", "You set your own scope, absorbed ambiguity, and moved teams you do not manage.", "'My manager decided the priorities and I executed them well.'"],
              ["E6", "You changed technical direction across multiple teams and can defend what you chose not to do.", "'I led the biggest project on my team.'"]
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Audit for scope evidence first, before writing anything.</strong> For each of your ten stories, answer two questions: who set the scope, and how many teams had to move. If more than half say 'my manager' and 'one', you have an E4 story set and a level problem — <a href='#/story/catalog/scope-signal'>the scope signal</a> is the diagnostic.",
            "<strong>Re-cut three stories to start earlier.</strong> Most E5 candidates begin the story at the moment work started, which hides the part where they decided what the work should be. Start at the decision instead.",
            "<strong>Build two genuine influence-without-authority stories.</strong> These are the hardest to fake and the most heavily probed. <a href='#/story/catalog/ownership-ambiguity'>Ownership and ambiguity</a> plus <a href='#/story/catalog/conflict-growth'>conflict and growth</a> cover the two shapes.",
            "<strong>Rehearse against interruption.</strong> The loop lead will cut in. If your story only works uninterrupted, it does not work — <a href='#/story/playbooks/mock-drills'>mock drills</a> and <a href='#/beh/advanced/practicing'>practising so it transfers</a> are the tools.",
            "<strong>Learn what the round is actually scoring</strong> so you can aim at it rather than at a vibe: <a href='#/beh/foundation/how-evaluated'>how the round is scored</a> and <a href='#/story/playbooks/big-tech'>the big-tech playbook</a>.",
            "<strong>Decide your down-level position before the loop, not after.</strong> If an E4 offer arrives, you want a rehearsed answer rather than a shocked one. <a href='#/offer/anatomy/level-bands'>Level bands</a> and <a href='#/offer/anatomy/leverage'>where your leverage comes from</a> are the prep; <a href='#/offer/execution/counter-scripts'>counter scripts</a> are the words."
          ] },
          { t: "cue", html: "Recognise the scope probe: <em>who decided that</em>, <em>how did you get them to agree</em>, <em>what would have happened if you had done nothing</em>, <em>what did you choose not to do</em>. These are not curiosity — they are the level being set. Answer each one with a decision you made, not a process the team followed." },
          { t: "note", variant: "key", html: "<strong>At E5 the behavioral round is a levelling instrument, and it can cost you a level on its own.</strong> Before you rehearse delivery, audit your ten stories for two things: who set the scope, and how many teams had to move. Fix that inventory and the round takes care of itself." }
        ]
      },

      /* ------------------------------------------------ E6 ------------- */
      {
        id: "meta-e6",
        title: "Meta E6 — multi-team impact and technical direction",
        summary: "The same five competencies, judged on radius: whose work changed because of your judgement, and what you chose not to do.",
        minutes: 10,
        tags: ["meta", "e6", "loop"],
        blocks: [
          { t: "p", html: "At E6 the loop stops asking what you built. It asks <strong>what changed direction because of you</strong>. Building is assumed; the evidence under examination is judgement applied across teams you do not own, over a horizon longer than a quarter." },
          { t: "p", html: "The practical consequence is uncomfortable: your best story — the hard technical thing you personally built — is probably an E5 story. At E6, that story is context. The story is what you decided, who you convinced, and what you deliberately killed to make room." },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Technical screen", "~45 min", "Shared browser editor, commonly with no compiler or test runner", "Two problems is still the common shape. At E6 this round is a gate, not a differentiator — being rusty is the only way to fail it."],
              ["Coding round (x2 in the loop)", "~45 min each", "Same editor and constraints", "Fluency under observation. Nobody is promoted for elegance here, and plenty of strong candidates are down-levelled for hesitation."],
              ["System Design <em>or</em> Product Architecture", "~45 min", "Whiteboard or shared canvas", "Commonly tracks the role flavour. The E6 signal is which constraints you refuse to accept and which future you design for."],
              ["Behavioral round", "~45 min", "Conversation, commonly with the loop lead", "The five competencies, judged on radius of influence, technical direction, and the quality of what you chose not to do."]
            ]
          },
          { t: "p", html: "The loop shape is commonly reported as broadly similar to E5. What moves is the bar inside each round — which is why 'I prepared the same way and interviewed at the higher level' is the most common story behind an E6 down-level to E5." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Still the five: resolving conflicts, driving results, embracing ambiguity, growing continuously, communicating effectively. At E6 every one of them is asking about people who do not report to you." },
          { t: "table",
            headers: ["Competency", "What it actually means at E6", "E6 evidence that lands"],
            rows: [
              ["Resolving conflicts", "You resolved a disagreement between teams or between senior people, not just your own.", "Two orgs wanted incompatible architectures. You brokered the decision and both sides could live with the outcome."],
              ["Driving results", "You delivered through other teams over multiple quarters.", "A programme where your contribution was direction, sequencing, and unblocking rather than code — with the business number attached."],
              ["Embracing ambiguity", "You picked the problem, not just the solution.", "You identified the thing nobody was working on that mattered most, and made it someone's roadmap — including the part where you were wrong once and corrected."],
              ["Growing continuously", "You changed your own model of the domain in public.", "A strongly-held technical position you reversed on evidence, and how you brought the people who had followed you along."],
              ["Communicating effectively", "You aligned an organisation in writing.", "The document that became the shared vocabulary — the thing other people quoted back at you six months later."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Technical direction</strong> — a direction you set that outlived the project.",
            "<strong>Multi-team delivery</strong> — something delivered through teams you did not manage.",
            "<strong>Killed the wrong bet</strong> — work you stopped, and how you handled the people invested in it.",
            "<strong>Senior disagreement</strong> — you were opposed by someone more senior and had to resolve it without escalating badly.",
            "<strong>Long-horizon judgement</strong> — a call whose consequences you only saw a year later.",
            "<strong>Multiplication</strong> — engineers who are measurably better because of how you operate.",
            "<strong>Organisational failure</strong> — something that failed for reasons above the code, where you were accountable."
          ] },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>'I built the hardest thing' caps you at E5.</strong> Technical depth is necessary and not sufficient. The E6 signal is whose work changed because of your judgement.",
            "<strong>You are scored on what you did not do.</strong> Candidates rehearse everything they shipped and have nothing to say about what they killed, deferred, or refused — which is most of what a staff-level engineer actually decides.",
            "<strong>The behavioral round becomes a judgement interview.</strong> Expect the loop lead to argue with your reasoning rather than collect your stories. That pushback is the assessment, not hostility — see <a href='#/beh/advanced/special-types'>the harder question types</a>."
          ] },
          { t: "compare",
            bad: { title: "E5 story wearing an E6 badge", items: ["'I designed and built the new pipeline.'", "You are the doer at the centre", "One team executed it", "The outcome is a system that exists", "Everything you mention, you shipped"] },
            good: { title: "E6 story", items: ["'I argued we should not build a pipeline at all, and redirected two teams.'", "You are the person who changed the direction", "Several teams moved, some unwillingly", "The outcome is a decision that held up, with its cost", "You can name what you killed and who was unhappy"] }
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Inventory decisions, not projects.</strong> List the ten decisions of the last three years where the outcome would have been different without you. Those are your E6 stories; your project list is not.",
            "<strong>For each one, prepare the counterfactual.</strong> What would have happened otherwise, and what did you give up. E6 rounds probe the road not taken harder than the road taken.",
            "<strong>Build one story about being wrong at scale</strong> — a direction you set and reversed. Told well it is the strongest E6 signal available; avoided, it reads as someone who has never been accountable. <a href='#/story/catalog/conflict-growth'>Conflict and growth stories</a> covers the shape.",
            "<strong>Compress ruthlessly.</strong> Multi-quarter stories run long and get cut off, and a story cut off before the result scores as no story. <a href='#/story/catalog/story-anatomy'>Story anatomy</a> is the compression tool.",
            "<strong>Rehearse being argued with.</strong> Get a mock partner to disagree with your central decision and hold your position without becoming defensive — <a href='#/story/playbooks/mock-drills'>mock drills</a>.",
            "<strong>Read the level below yours.</strong> <a href='#/loops/meta/meta-e5'>The E5 playbook</a> defines the floor you must clearly clear, and the compare tables there are the fastest way to hear the difference."
          ] },
          { t: "cue", html: "Recognise the direction probe: <em>what did you choose not to do</em>, <em>who disagreed and what happened to them</em>, <em>how would this have gone without you</em>, <em>what do you believe now that you did not believe then</em>. Each one is asking for judgement under uncertainty. Answer with a decision, its cost, and the evidence that settled it." },
          { t: "note", variant: "key", html: "<strong>E6 is scored on radius and on refusals.</strong> Bring ten decisions rather than ten projects, and for each one be ready with the counterfactual, the people who disagreed, and what you deliberately did not do." }
        ]
      },

      /* ------------------------------------------------ M1 ------------- */
      {
        id: "meta-m1",
        title: "Meta M1 — the manager loop",
        summary: "People, delivery systems, and a technical spine that surprises candidates who prepared only management stories.",
        minutes: 10,
        tags: ["meta", "m1", "manager", "loop"],
        blocks: [
          { t: "p", html: "The M1 loop asks a different question from every loop before it: <strong>can you build a system made of people that reliably ships?</strong> Not can you ship — can you construct the conditions in which other people ship, and then be honest about it when they do not." },
          { t: "p", html: "The trap is symmetrical and catches candidates from both directions. Engineers moving into management prepare people stories and get caught by the technical half. Established managers prepare delivery narratives and get caught by the retrospective round, which does not want a success story." },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["People management", "~45 min", "Conversation", "Hiring, growing, and managing out. Expect specific people and specific conversations, including one that went badly."],
              ["Behavioral", "~45 min", "Conversation, commonly with the loop lead", "The same five named competencies, evidenced through how you operate as a manager rather than as a builder."],
              ["Project retrospective", "~45 min", "Structured walkthrough of one project you led", "Honest post-mortem quality: what you got wrong, when you knew, what you changed. Not a success story."],
              ["System design <em>or</em> product architecture", "~45 min", "Whiteboard or shared canvas", "Commonly tracks the flavour of the org. You are scored on whether you can still hold a technical position and choose between trade-offs."],
              ["AI-enabled coding", "~45 min", "Hands-on with AI tooling in the loop", "Whether you can direct and critique AI-assisted work — reviewing, correcting, and knowing when to reject what a tool produced."]
            ]
          },
          { t: "note", variant: "tip", html: "Take the AI-enabled coding round seriously and prepare for it as a judgement round rather than a typing round. What is being sampled is your review reflex: whether you notice the plausible-looking wrong answer, and whether you can say why you rejected it. <a href='#/beh/advanced/ai-questions'>Questions about how you work with AI</a> covers the framing; Codex is the Atlas academy for the hands-on habit." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "The same five competencies still apply — resolving conflicts, driving results, embracing ambiguity, growing continuously, communicating effectively — but at M1 each one is answered with a story about someone else's outcome." },
          { t: "table",
            headers: ["Competency", "What it actually means at M1", "M1 evidence that lands"],
            rows: [
              ["Resolving conflicts", "You handled conflict between people who report to you, and between your team and another.", "Two engineers who could not work together, and what you actually did — including the part where the first attempt did not work."],
              ["Driving results", "Your team delivered predictably, and you can explain the mechanism.", "The delivery system you changed — planning, on-call, review, scope discipline — and the before and after in shipped outcomes."],
              ["Embracing ambiguity", "You gave your team direction when you did not have it yourself.", "A reorg, a cancelled project, or a shifting mandate where you kept the team productive without pretending to certainty."],
              ["Growing continuously", "You changed your management approach on feedback, including unflattering feedback.", "Survey or skip-level feedback that stung, the change you made, and what your team noticed afterwards."],
              ["Communicating effectively", "You translated in both directions without distorting.", "How you delivered a decision you disagreed with, and how you carried your team's pushback upward without theatre."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Underperformance</strong> — a struggling report, what you tried, and how it ended.",
            "<strong>Growing someone</strong> — a person who levelled up under you, and your specific contribution to that.",
            "<strong>Retention and attrition</strong> — someone who left, or nearly left, and what you learned.",
            "<strong>Missed delivery</strong> — a date your team missed, and what you changed in the system afterwards.",
            "<strong>Disagreeing with your own leadership</strong> — a decision you pushed back on, then had to deliver.",
            "<strong>Hiring judgement</strong> — a hire that did not work out, and what your process missed.",
            "<strong>Technical involvement</strong> — how deep you stay, and how you decide when to overrule an engineer."
          ] },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>The manager loop is not free of technical rounds.</strong> A design round plus an AI-enabled coding round is the commonly reported shape, and candidates who assumed management exempted them arrive unprepared.",
            "<strong>The retrospective round wants the failure.</strong> Candidates walk in with their best project and get progressively more uncomfortable follow-ups because the round is built to find the parts that went wrong. Bring a project with real scar tissue and narrate it deliberately.",
            "<strong>People stories need names and specifics.</strong> 'I coach my reports' scores nothing. One engineer, one situation, one conversation you can reconstruct — see <a href='#/story/playbooks/manager-track'>the manager-track playbook</a>."
          ] },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Write a people portfolio before anything else.</strong> Three to five named individuals — one you grew, one you managed out or nearly did, one who disagreed with you, one you hired well, one you hired badly. That portfolio answers most of the people round. <a href='#/story/playbooks/manager-track'>Manager-track stories</a> is the template.",
            "<strong>Pick the retrospective project for its scars, not its success.</strong> Rehearse the timeline: what you believed, when the evidence arrived, how long you took to act, and what you changed in the system afterwards.",
            "<strong>Rebuild the technical half deliberately.</strong> One design round and one AI-enabled coding round is the commonly reported shape. Blueprint and Codex are the Atlas academies; do not walk in cold because your title says manager.",
            "<strong>Map your stories onto the five competencies anyway.</strong> The behavioral round is still scored against the same framework — <a href='#/story/catalog/coverage-matrix'>the coverage matrix</a> keeps you from filling all ten slots with delivery stories.",
            "<strong>Prepare the honest version of why you are moving.</strong> Whether you are moving into management or between companies, the motivation question is scored. <a href='#/beh/foundation/why-it-matters'>Why this round matters</a> frames it.",
            "<strong>Know the IC ladder next to yours.</strong> Manager offers are sometimes reshaped into IC offers and back. <a href='#/loops/meta/meta-e6'>The E6 playbook</a> and <a href='#/offer/anatomy/level-bands'>level bands</a> are what you need before that conversation, not during it."
          ] },
          { t: "cue", html: "Recognise the systems probe: <em>what did you change so it would not happen again</em>, <em>how do you know your team trusts you</em>, <em>what did you do the second time when the first attempt failed</em>. Each one is asking for a mechanism you installed, not an intention you held. Answer with the change and the evidence it worked." },
          { t: "note", variant: "key", html: "<strong>M1 is a people-systems interview with a technical spine.</strong> Bring a named people portfolio, pick your retrospective project for its scars rather than its success, and do not walk into the design and AI-enabled coding rounds cold." },
          { t: "quiz", id: "loops-meta" }
        ]
      }
    ]
  };

  /* =====================================================================
     MODULE 2 — AMAZON PLAYBOOKS
     ===================================================================== */
  var MOD_AMAZON = {
    id: "amazon",
    name: "Amazon Playbooks",
    icon: "map",
    lessons: [
      /* ------------------------------------------------ L4 ------------- */
      {
        id: "amazon-l4",
        title: "Amazon L4 — Leadership Principles from the first round",
        summary: "Not one behavioral round but a principle interview with technical segments inside it, starting with the online assessment.",
        minutes: 9,
        tags: ["amazon", "l4", "loop", "leadership-principles"],
        blocks: [
          { t: "p", html: "Change the picture you are holding. Most companies run one behavioral round; here, candidates consistently report that <strong>the Leadership Principles are embedded in every round</strong>, commonly as roughly <strong>20-30 minutes of behavioral questions before the technical portion</strong> of each one. The loop is a principle interview with technical segments inside it, not the reverse." },
          { t: "p", html: "Do the arithmetic, because it is the whole reason people underprepare. Four or five rounds, each opening with twenty to thirty minutes of principle-driven questions, plus a Bar Raiser round running close to an hour almost entirely on principles. That is more behavioral interviewing in one day than most candidates have done in their careers." },
          { t: "stat", items: [
            { v: "20-30 min", k: "behavioral before the technical part of each round" },
            { v: "2+", k: "detailed stories per principle" },
            { v: "~10", k: "reusable stories in total" }
          ] },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Online assessment", "Commonly 1-2 hours, untimed sections vary", "Browser-based: coding work sample plus a work-simulation and work-style section", "The coding portion, and separately your responses in the work-simulation section — which is commonly reported to be scored against the Leadership Principles."],
              ["Recruiter conversation", "~30 min", "Call, no code", "Level targeting and logistics. The level discussed here shapes which evidence you need for the rest of the loop."],
              ["Technical phone screen", "~45-60 min", "Shared editor", "Commonly two to three principle questions first, then the coding portion. Both halves are written up."],
              ["Loop interviews (commonly 4-5)", "~45-60 min each", "Video or onsite; coding, design, or discussion depending on the round", "Each round commonly opens with roughly 20-30 minutes of principle questions before its technical portion. Different interviewers are assigned different principles."],
              ["Bar Raiser", "~1 hour", "Conversation, interviewer from outside the hiring team", "Almost entirely Leadership Principles, with single stories stretched across long chains of follow-ups."]
            ]
          },
          { t: "note", variant: "warn", html: "Do not click through the work-simulation and work-style section of the online assessment. Candidates commonly report it being scored against the Leadership Principles, which makes it the first behavioral round rather than a warm-up questionnaire. Answer it the way you intend to answer the Bar Raiser — the version of you in that form should be the same person who shows up on loop day." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "The rubric is the published set of Leadership Principles, and the loop is explicitly organised around them: interviewers are assigned principles, and their write-ups are structured by principle. That has a practical consequence most candidates miss — <strong>your stories should be indexed by principle, not by project</strong>, because that is the shape the question arrives in." },
          { t: "table",
            headers: ["Principle commonly drilled at L4", "What it actually means in practice", "L4 evidence that lands"],
            rows: [
              ["Customer obsession", "You started from the user's problem rather than the ticket's wording.", "A time you pushed back on a requirement because it would not actually help the person using the thing."],
              ["Ownership", "You treated the outcome as yours past the boundary of your assignment.", "A bug that was not yours, in a component you did not own, that you chased down because it was breaking your users."],
              ["Dive deep", "You went to the data or the code rather than accepting the summary.", "An investigation where the obvious explanation was wrong and you found the real one — with the specific evidence."],
              ["Deliver results", "You finished under real constraints and can quantify what changed.", "One project delivered against a date, with the before and after number and the thing you cut to get there."],
              ["Bias for action", "You moved without full information, and managed the risk of moving.", "A reversible decision you made quickly instead of waiting for a meeting, plus how you contained the downside."],
              ["Learn and be curious", "You picked something up because you needed it, and can show the depth.", "A technology or domain you learned inside a project, and the non-obvious thing you now know about it."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Went past your assignment</strong> — something outside your remit that you took on.",
            "<strong>Root-caused something hard</strong> — a problem whose obvious explanation was wrong.",
            "<strong>Moved without permission</strong> — a decision you made rather than escalating.",
            "<strong>Missed a deadline</strong> — what happened, and what you did about it.",
            "<strong>Disagreed with a peer or your manager</strong> — and what you did once the decision went the other way.",
            "<strong>Learned fast under pressure</strong> — a skill you needed and did not have.",
            "<strong>Prioritised badly</strong> — a call you got wrong, and how you noticed."
          ] },
          { t: "p", html: "Notice the pattern: nearly every shape has a failure variant. Principle-based loops probe failure much harder than most candidates expect, so build the failure half of your inventory deliberately — <a href='#/story/playbooks/principle-based'>principle-based playbooks</a> covers the mapping." },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>The behavioral load is front-loaded into every round.</strong> Candidates plan for one behavioral conversation and face principle questions five times in a day, from interviewers who compare notes afterwards.",
            "<strong>Consistency across rounds is itself a signal.</strong> Because different interviewers cover different principles and then aggregate, a story that grows a new hero each time it is told is a visible problem.",
            "<strong>The follow-ups go deeper than the question.</strong> Even outside the Bar Raiser round, expect three or four layers of 'and then what did you do' on a single story. Read <a href='#/loops/amazon/amazon-l5'>the L5 playbook</a> for what that drilling actually looks like."
          ] },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Index by principle before you write anything.</strong> One row per principle, at least two story slots each, aiming at roughly ten reusable stories because good stories cover several principles at once. <a href='#/story/catalog/coverage-matrix'>The coverage matrix</a> is the grid.",
            "<strong>Mine your own history properly.</strong> At L4 the constraint is usually raw material, not delivery. <a href='#/story/catalog/journaling'>Journaling for stories</a> surfaces work you have already forgotten.",
            "<strong>Attach a number to every story.</strong> Deliver results and dive deep both die without one, and 'it got faster' invites a follow-up you cannot answer.",
            "<strong>Build the failure half.</strong> For every success story, prepare the matching failure: a missed date, a wrong call, a bug you shipped. <a href='#/story/catalog/conflict-growth'>Conflict and growth stories</a> is the shape.",
            "<strong>Treat the online assessment as round one.</strong> Sit it when you are rested, and answer the work-style section as the same person you plan to be in the loop.",
            "<strong>Then take three stories to drill depth</strong> using <a href='#/loops/amazon/amazon-l5'>the L5 playbook</a>, because the Bar Raiser round is in an L4 loop too."
          ] },
          { t: "cue", html: "Recognise the principle probe by its opening: <em>tell me about a time you</em> followed by an action verb — took on, disagreed, moved, learned, missed. The verb names the principle being sampled. Say the principle to yourself, pick the story indexed under it, and lead with your own first-person action." },
          { t: "note", variant: "key", html: "<strong>This is not a loop with a behavioral round; it is a behavioral loop with technical segments.</strong> Index roughly ten stories by principle rather than by project, attach a number to each, and treat the work-style section of the online assessment as the first scored round." }
        ]
      },

      /* ------------------------------------------------ L5 ------------- */
      {
        id: "amazon-l5",
        title: "Amazon L5 — the Bar Raiser and depth over breadth",
        summary: "One interviewer from outside the team, close to an hour of principles, and a single story stretched across twenty minutes of follow-ups.",
        minutes: 11,
        tags: ["amazon", "l5", "bar-raiser", "loop"],
        blocks: [
          { t: "p", html: "The organising fact of an L5 loop is the <strong>Bar Raiser</strong>: an interviewer from <em>outside the hiring team</em> who runs close to an hour almost entirely on Leadership Principles. They are not protecting the team's need to fill a seat — they are protecting the company's bar, which is why the round behaves differently from every other conversation of the day." },
          { t: "p", html: "The mechanism to prepare for is depth. Candidates consistently report the Bar Raiser <strong>stretching a single story across 15-20 minutes of follow-ups</strong>, and typically <strong>drilling three or four principles exhaustively</strong> rather than touching all of them. The consequence is blunt and it should reshape your entire preparation: <strong>depth per story matters more than breadth.</strong> One story that survives twenty minutes of 'and then what did you do' is worth five stories that each survive four." },
          { t: "stat", items: [
            { v: "~1 hour", k: "Bar Raiser, almost entirely principles" },
            { v: "15-20 min", k: "follow-ups on a single story" },
            { v: "3-4", k: "principles drilled exhaustively" }
          ] },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Online assessment (when included)", "Commonly 1-2 hours", "Browser-based: coding work sample plus work-simulation and work-style sections", "Coding, plus a work-style section commonly reported to be scored against the Leadership Principles."],
              ["Technical phone screen", "~45-60 min", "Shared editor", "Commonly two to three principle questions, then coding. At L5 the principle answers are already expected to carry scope evidence."],
              ["Loop interviews (commonly 4-5)", "~45-60 min each", "Coding, design, and discussion rounds", "Each commonly opens with roughly 20-30 minutes of principle questions. Interviewers are assigned different principles and compare write-ups afterwards."],
              ["Bar Raiser", "~1 hour", "Conversation, interviewer from outside the hiring team", "Three or four principles drilled exhaustively, with single stories stretched across 15-20 minutes of follow-ups. Depth, consistency, and whether the detail holds up."]
            ]
          },
          { t: "p", html: "One structural note that changes how you should treat the round: because the Bar Raiser sits outside the hiring team, a strong technical loop does not automatically carry you through it. Treat it as an independent gate rather than a final formality." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Same published Leadership Principles, but at L5 three of them do most of the levelling work, because they are the ones that require scope you cannot borrow." },
          { t: "table",
            headers: ["Principle carrying L5 weight", "What it actually means at L5", "L5 evidence that lands"],
            rows: [
              ["Ownership", "You owned an outcome whose boundary you drew yourself, past your team's edge.", "A problem nobody had assigned to anyone, that you scoped, staffed, and delivered — including what you stopped doing to make room."],
              ["Have backbone, disagree and commit", "You held a position against real pressure, then executed the decision that was made — either way.", "A disagreement with a manager or partner team where you can describe both the argument and how you behaved after losing or winning it."],
              ["Deliver results", "You delivered through constraints you did not control.", "A multi-quarter outcome with the metric, the baseline, and the trade-off you accepted to hit it."],
              ["Dive deep", "Your depth changed the decision, not just your understanding.", "An investigation whose findings redirected a plan — with the specific numbers you found and who you had to convince."],
              ["Invent and simplify", "You removed complexity rather than adding capability.", "A system, process, or interface you made smaller, and what you gave up by simplifying it."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Owned past your boundary</strong> — an outcome you took responsibility for that nobody assigned you.",
            "<strong>Disagreed and then committed</strong> — you lost the argument and had to deliver the decision anyway.",
            "<strong>Depth that changed a decision</strong> — an investigation whose findings redirected a plan.",
            "<strong>Highest-judgement call</strong> — a decision with incomplete information and real consequences.",
            "<strong>Simplified something</strong> — complexity you removed, and what removing it cost.",
            "<strong>Failed at scale</strong> — something you were accountable for that went wrong.",
            "<strong>Made a hard trade-off</strong> — two things that mattered and you could only have one."
          ] },
          { t: "p", html: "Every one of those will be followed by the same four probes, in some order: what exactly did <em>you</em> do, what else did you consider, how did you measure it, and what would you change. Prepare those four answers for each story and the follow-up chain stops being frightening." },
          { t: "widget", id: "loopsDepthDrill" },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>Preparation instinct is exactly backwards.</strong> Candidates build one story per principle for breadth and are dismantled by a Bar Raiser who wants one story explored for twenty minutes. Fewer stories, taken much deeper, is the correct allocation of your prep time.",
            "<strong>The follow-ups are the interview.</strong> Your prepared answer is the first two minutes. Everything scored happens after it, in the detail you did not plan to give.",
            "<strong>An outsider can block the loop.</strong> The Bar Raiser is independent of the hiring team, so 'the team liked me' is not a safety net. Read <a href='#/beh/foundation/how-evaluated'>how the round is scored</a> for why an independent scorer changes your incentives."
          ] },
          { t: "compare",
            bad: { title: "Breadth strategy (fails the drill)", items: ["One story per principle, sixteen shallow stories", "Each rehearsed to about ninety seconds", "Metrics vague or missing", "No memory of the alternatives you rejected", "Third follow-up produces improvisation, and it shows"] },
            good: { title: "Depth strategy", items: ["Roughly ten stories, three or four drilled to twenty minutes", "Each with your specific actions in first person", "Before and after numbers with the measurement window", "The rejected option and why you rejected it", "Follow-ups reveal more detail instead of exposing the floor"] }
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Get to roughly ten stories, then stop adding.</strong> Two or more per principle, deduplicated because strong stories cover several principles. <a href='#/story/catalog/coverage-matrix'>The coverage matrix</a> tells you when coverage is done.",
            "<strong>Pick your three deepest and take them to twenty minutes.</strong> For each: a minute-by-minute timeline, every number with its baseline, the two options you rejected, the person who disagreed, and what you would change. This is the single highest-return hour of preparation for this loop.",
            "<strong>Drill the four probes explicitly</strong> — your specific contribution, the rejected trade-off, how you measured it, what you would change. The widget above is exactly that rehearsal, and <a href='#/beh/delivery/deliver-salt'>delivering SALT</a> is the format underneath it.",
            "<strong>Get a partner to interrogate one story for twenty minutes.</strong> It is uncomfortable and it is the only way to find where your detail runs out. <a href='#/story/playbooks/mock-drills'>Mock drills</a> has the script.",
            "<strong>Check consistency across the loop.</strong> Different interviewers cover different principles and then compare. Say the same numbers and name the same people every time — <a href='#/beh/delivery/pitfalls'>the pitfalls</a> covers how drift happens.",
            "<strong>Establish the L4 foundation first if you are new to this loop</strong> — <a href='#/loops/amazon/amazon-l4'>the L4 playbook</a> covers principle indexing and the online assessment, which apply unchanged at L5."
          ] },
          { t: "cue", html: "Recognise the drill: the same story getting a third and fourth follow-up, questions narrowing from the project to your specific actions, and the interviewer asking for numbers you did not volunteer. That is not scepticism about your honesty — it is the depth probe. Keep going one layer deeper each time rather than restating the summary." },
          { t: "note", variant: "key", html: "<strong>Depth beats breadth, and the Bar Raiser is the reason.</strong> Take three or four stories to a depth that survives twenty minutes of 'and then what did you do' — that inventory outperforms sixteen shallow stories in every round of the loop, not just this one." }
        ]
      },

      /* ------------------------------------------------ L6 ------------- */
      {
        id: "amazon-l6",
        title: "Amazon L6 — org-scale scope and the invention bar",
        summary: "The principles stay the same and the evidence bar moves to organisational outcomes, hiring, and problems you chose yourself.",
        minutes: 10,
        tags: ["amazon", "l6", "loop"],
        blocks: [
          { t: "p", html: "At L6 the principles do not change and the <strong>unit of evidence</strong> does. Ownership stops meaning your project and starts meaning your area. Deliver results stops meaning a launch and starts meaning a portfolio. Invent and simplify stops meaning a clever design and starts meaning a decision that removed work for other teams." },
          { t: "p", html: "The Bar Raiser round does not soften with seniority — if anything the drilling goes deeper, because there is more surface to probe. A story that took twenty minutes to exhaust at L5 will be expected to hold up under questions about the people, the money, and the alternatives you never pursued." },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter and hiring manager conversations", "~30-45 min each", "Calls, no code", "Scope calibration. At L6 the recruiter conversation is partly a levelling conversation, so bring your scope evidence to it."],
              ["Loop interviews (commonly 4-5)", "~45-60 min each", "Design, discussion, and coding rounds", "Each commonly opens with roughly 20-30 minutes of principle questions. Expect principles about hiring, developing people, and setting standards to appear alongside delivery."],
              ["Bar Raiser", "~1 hour", "Conversation, interviewer from outside the hiring team", "Three or four principles drilled exhaustively. At L6 expect the drill to reach into org design, staffing, and the bets you declined."],
              ["Design round", "~45-60 min", "Whiteboard or shared canvas", "Judgement over recall: which constraints you refuse, what you would build in stages, and what you would not build at all."]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Same published principles. What shifts is that the people-facing and standards-facing principles start carrying real weight, because at L6 you are expected to have changed how other people work." },
          { t: "table",
            headers: ["Principle carrying L6 weight", "What it actually means at L6", "L6 evidence that lands"],
            rows: [
              ["Ownership", "You own an area, including the parts nobody has assigned to anyone.", "A gap across teams that you identified, made someone's responsibility, and stayed accountable for."],
              ["Think big", "You changed what the organisation believed was possible or worth doing.", "A direction you argued for that was initially rejected, and how you built the evidence that changed the answer."],
              ["Invent and simplify", "You removed categories of work, not instances of it.", "A platform, standard, or decision that deleted recurring effort for several teams — with the cost you accepted."],
              ["Hire and develop the best", "You raised the bar of the people around you, deliberately.", "Specific engineers who grew under you, a hiring standard you tightened, and a hire you got wrong plus what you changed."],
              ["Insist on the highest standards", "You held a line that was unpopular and expensive.", "A quality or operational standard you enforced when the schedule argued against it, and what it cost you at the time."],
              ["Deliver results", "You delivered a portfolio through people you do not manage.", "Multi-quarter outcomes with business numbers, the sequencing you chose, and the work you explicitly deprioritised."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Chose the problem</strong> — something you decided the organisation should work on.",
            "<strong>Unpopular standard</strong> — a line you held that cost time or goodwill.",
            "<strong>Org-level failure</strong> — something that failed for structural reasons, where you were accountable.",
            "<strong>Raised the bar on people</strong> — a hiring or development decision that changed a team's ceiling.",
            "<strong>Declined a bet</strong> — an attractive project you argued against.",
            "<strong>Influenced without authority at scale</strong> — several teams changed course because of you.",
            "<strong>Simplified across teams</strong> — complexity you deleted for people who did not report to you."
          ] },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>The best technical story is often the wrong story.</strong> Deep technical work reads as L5 evidence. What separates L6 is the decision, the people, and the alternatives declined — the technical difficulty is context.",
            "<strong>People principles are drilled hard, even for individual contributors.</strong> Candidates who are not managers assume hiring and developing others is not their rubric, then find twenty minutes of follow-ups waiting on exactly that.",
            "<strong>The drill reaches the counterfactual.</strong> Expect to be asked what would have happened if you had done nothing, and what you gave up. Prepare that answer for every story rather than improvising it — <a href='#/beh/advanced/special-types'>the harder question types</a> covers the pattern."
          ] },
          { t: "compare",
            bad: { title: "L5 evidence at an L6 bar", items: ["'I led the largest project in my org.'", "The scope was assigned, even if it was big", "One team executed, you coordinated", "Result is the launch", "People appear as resources, not as outcomes"] },
            good: { title: "L6 evidence", items: ["'I argued the org was solving the wrong problem, and changed what three teams worked on.'", "You chose the problem before anyone funded it", "Teams you do not manage changed direction", "Result is a business number plus what you stopped", "Specific people are visibly better because of you"] }
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Inventory by decision and by person, not by project.</strong> Ten decisions where the org would have gone differently without you, and five people whose trajectory you changed. That is the L6 raw material.",
            "<strong>Attach business numbers, not engineering numbers.</strong> Latency and coverage are L5 currency. Cost, revenue, headcount freed, incidents avoided, and time-to-market are the L6 versions.",
            "<strong>Prepare the counterfactual and the refusal for every story.</strong> What would have happened otherwise, and what you declined to do. These two answers are where L6 loops are won.",
            "<strong>Take four stories to Bar Raiser depth.</strong> Same drill as L5, deeper material — <a href='#/loops/amazon/amazon-l5'>the L5 playbook</a> has the mechanics and the depth widget.",
            "<strong>Build two people stories even if you are an IC.</strong> One engineer you grew and one hiring judgement, including one you got wrong. <a href='#/story/playbooks/manager-track'>Manager-track stories</a> is the right template even without the title.",
            "<strong>Calibrate the level before the loop, not after the offer.</strong> <a href='#/offer/anatomy/level-bands'>Level bands</a> and <a href='#/offer/execution/recruiter-scope'>what your recruiter can tell you</a> are how you avoid interviewing at the wrong bar for a full day."
          ] },
          { t: "cue", html: "Recognise the org-scope probe: <em>who else changed what they were doing</em>, <em>what did you decide not to pursue</em>, <em>who grew because of that</em>, <em>what would have happened without you</em>. Answer with a decision, the people it moved, and the number it changed — in that order." },
          { t: "note", variant: "key", html: "<strong>L6 evidence is decisions, people, and refusals.</strong> Bring business numbers rather than engineering ones, prepare the counterfactual for every story, and build people-development stories even if nobody reports to you." }
        ]
      },

      /* ------------------------------------------------ MANAGER --------- */
      {
        id: "amazon-manager",
        title: "Amazon manager loops — the written exercise",
        summary: "Everything from the L5 and L6 loops, plus a written exercise that is scored for structure and judgement as much as content.",
        minutes: 10,
        tags: ["amazon", "manager", "written-exercise", "loop"],
        blocks: [
          { t: "p", html: "Manager loops carry the whole principle machinery — principles in every round, a Bar Raiser from outside the team, long follow-up chains — and then add one thing that catches almost everyone: <strong>a written exercise</strong>. Candidates commonly report it, and commonly report meeting the format for the first time on the day." },
          { t: "p", html: "The mental model that helps: writing is being used the way the Bar Raiser uses follow-ups. Speech lets you gesture at structure; a document either has it or does not. What is being sampled is whether your thinking holds its shape when nobody is nodding along." },

          { t: "h", text: "The loop, round by round" },
          { t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter and hiring manager conversations", "~30-45 min each", "Calls", "Scope of teams you have run, delivery track record, and level calibration."],
              ["Written exercise", "Commonly a fixed window, submitted in writing", "Prompt answered in prose, no code", "Structure, judgement, and clarity: whether a reader who was not there can follow the decision and its trade-off."],
              ["Loop interviews (commonly 4-5)", "~45-60 min each", "People, delivery, and technical rounds", "Each commonly opens with roughly 20-30 minutes of principle questions. Hiring, developing others, and standards carry heavy weight here."],
              ["Bar Raiser", "~1 hour", "Conversation, interviewer from outside the hiring team", "Three or four principles drilled exhaustively, commonly including at least one people-facing principle taken to real depth."]
            ]
          },
          { t: "note", variant: "tip", html: "Practise the written exercise as a timed exercise, not as an essay. Pick a decision you have actually made, set a timer, and write it as: the situation in three sentences, the options, the one you chose, the trade-off you accepted, the measured result, and what you would change. Then reread it for the sentence a stranger would not be able to follow — that sentence is what the exercise is scored on." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Same published Leadership Principles, answered through other people's outcomes. Every principle has a manager reading, and the manager reading is the one being scored." },
          { t: "table",
            headers: ["Principle carrying manager weight", "What it actually means for a manager", "Manager evidence that lands"],
            rows: [
              ["Hire and develop the best", "You have raised a bar with real names attached, and got it wrong at least once.", "An engineer who levelled up under you with your specific contribution named, plus a hire that did not work and what you changed in your process."],
              ["Earn trust", "You handled a situation where being honest was expensive.", "How you delivered bad news to your team or your leadership without softening it into uselessness."],
              ["Ownership", "You owned outcomes your team missed, publicly.", "A missed commitment where you took the accountability and changed the delivery system rather than the narrative."],
              ["Have backbone, disagree and commit", "You pushed back upward, then delivered the decision you lost.", "A disagreement with leadership, and what you said to your team afterwards — which is the part that is really being probed."],
              ["Deliver results", "Your team delivers predictably and you can describe the mechanism.", "The change you made to planning, on-call, review, or scope discipline, with the before and after."],
              ["Insist on the highest standards", "You held a quality line against schedule pressure.", "A launch you delayed or a standard you enforced, what it cost, and how you carried the team through it."]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          { t: "ul", items: [
            "<strong>Underperformance handled</strong> — a struggling report and how the situation resolved.",
            "<strong>A hire that failed</strong> — what your process missed and what you changed.",
            "<strong>Bad news delivered</strong> — a message you had to give that nobody wanted.",
            "<strong>Missed commitment</strong> — a date your team missed and the systemic change afterwards.",
            "<strong>Disagreed with leadership</strong> — the pushback, then how you carried the decision to your team.",
            "<strong>Standard held under pressure</strong> — quality defended against a schedule.",
            "<strong>Grew someone specific</strong> — a trajectory you changed, with your contribution named."
          ] },

          { t: "h", text: "What candidates find surprising" },
          { t: "ul", items: [
            "<strong>The written exercise is scored like an interview round.</strong> Candidates treat it as an administrative step and submit something unstructured, which reads as unstructured thinking rather than as a busy week.",
            "<strong>People principles get the deepest drilling.</strong> Expect twenty minutes on one report, one conversation, one decision — including what you said, what they said, and what happened next.",
            "<strong>The 'disagree and commit' question is really two questions.</strong> The interesting half is not the disagreement; it is what you told your team once the decision went against you. Prepare that half explicitly — <a href='#/story/playbooks/principle-based'>principle-based playbooks</a> covers the two-part shape."
          ] },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          { t: "ol", items: [
            "<strong>Write the exercise before you are asked to.</strong> Do two timed practice runs on decisions you have actually made. Format discipline is what is being scored, and it is fully learnable in an afternoon.",
            "<strong>Build the named people portfolio.</strong> One you grew, one you managed out or nearly did, one you hired well, one you hired badly, one who disagreed with you. <a href='#/story/playbooks/manager-track'>Manager-track stories</a> is the template.",
            "<strong>Prepare the second half of every disagreement story</strong> — what you said to your team after losing the argument. <a href='#/story/catalog/conflict-growth'>Conflict and growth</a> is where that shape lives.",
            "<strong>Take four stories to Bar Raiser depth</strong>, at least two of them people stories. The mechanics are in <a href='#/loops/amazon/amazon-l5'>the L5 playbook</a>, and the depth widget there is the drill.",
            "<strong>Bring delivery-system evidence, not delivery anecdotes.</strong> What you changed in how the team works, and the before and after. This is the difference between a manager who shipped and a manager who built a shipping system.",
            "<strong>Decide your level position early.</strong> Manager loops are often calibrated during the loop itself. <a href='#/offer/anatomy/level-bands'>Level bands</a>, <a href='#/offer/anatomy/leverage'>leverage</a>, and <a href='#/offer/execution/counter-scripts'>counter scripts</a> are the preparation; <a href='#/offer/close/accept-decline'>accepting or declining</a> is the endgame."
          ] },
          { t: "cue", html: "Recognise the manager depth probe: <em>what did you actually say</em>, <em>what did they say back</em>, <em>how long did you wait before acting</em>, <em>what did you change so it would not happen again</em>. Reconstruct the conversation rather than summarising the policy — that reconstruction is the evidence." },
          { t: "note", variant: "key", html: "<strong>Manager loops add a written exercise, and it is scored for structure and judgement.</strong> Practise it timed, bring a named people portfolio, and prepare the second half of every disagreement story — the part where you carried a decision you lost to the team that had to execute it." },
          { t: "quiz", id: "loops-amazon" }
        ]
      }
    ]
  };

  /* =====================================================================
     TRACK REGISTRATION — order-independent get-or-create
     ===================================================================== */
  var MY_MODULES = [MOD_META, MOD_AMAZON];

  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.loops || (window.TRACKS.loops = { id: "loops", modules: [] });
  T.id = "loops";
  T.name = "Company & Level Playbooks";
  T.short = "LOOPS";
  T.tagline = "Walk in knowing the loop";
  T.color = "#818cf8";
  T.blurb = "Every employer scores the human side against its own named rubric, in its own round order, with its own idea of what a senior story sounds like. This track turns each major loop into a reference page you can read the night before: the rounds and what each one is actually scored on, the competency framework behind the scoring, the question shapes that recur, the two or three things that reliably catch candidates out, and a prep order that changes with the level you are targeting.";
  T.modules = T.modules || [];
  T.modules.unshift.apply(T.modules, MY_MODULES);
})();
