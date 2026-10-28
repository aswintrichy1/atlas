/* =====================================================================
   COMPASS · Company & Level Playbooks — Google + more loops
   Adds modules `google` and `others` to window.TRACKS.loops.
   Track metadata (name / short / color / blurb) and the meta + amazon
   modules are owned by a sibling file. This file only ever PUSHES.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================= */
  var Widgets = {};

  /* Minimal DOM builder. ES5-safe: kids come in through `arguments`. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var k;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (attrs[k] == null) continue;
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  /* Every stage of a big-company pipeline, and how it fails you.
     Stall text is keyed by level so the readout changes on both controls. */
  var GATE_STAGES = [
    {
      id: "screen",
      label: "Screen",
      frame: "A short conversation decides whether the rest of the pipeline ever runs.",
      who: "A recruiter, sometimes with one interviewer who will never see the rest of your loop.",
      sees: "Two or three lines of your history, a short conversation, occasionally one exercise.",
      derisk: "Rewrite your top three resume lines so each names a decision you made and a number it moved.",
      stall: {
        mid: "You describe what the team shipped, so nothing in the notes is attributable to you.",
        senior: "Your scope reads mid-level out loud even though the title says senior, and the loop gets booked one level down.",
        staff: "Everything you name is inside one team, so the screener hears a strong senior engineer and books that loop."
      }
    },
    {
      id: "loop",
      label: "Onsite loop",
      frame: "Several strangers score you independently, each seeing only their own slice.",
      who: "The interviewers you actually meet — commonly scoring alone, not as a panel in the room.",
      sees: "Only what happens in their own session. They usually cannot read each other's notes while the loop runs.",
      derisk: "Plan story coverage in advance so no two rounds get the same example.",
      stall: {
        mid: "One weak round sinks the set, because with few rounds each one carries a lot of weight.",
        senior: "You reuse the same two stories across rounds and the repetition shows when the notes are compared.",
        staff: "Every example is well told and bounded to one team, so nothing in the set is staff-shaped."
      }
    },
    {
      id: "packet",
      label: "Write-up & packet",
      frame: "Your loop stops being you and becomes text. This is the quietest gate and the most decisive.",
      who: "Nobody decides here — but this is where the evidence is fixed and it cannot be amended later.",
      sees: "Whatever each interviewer types afterwards, from memory plus whatever they scribbled.",
      derisk: "Say the quotable sentence early and again at the end, so it survives into the notes.",
      stall: {
        mid: "The interviewer liked you and wrote three vague lines. 'Seemed solid' survives no review.",
        senior: "Your best evidence arrived in the final two minutes and never made it into the write-up.",
        staff: "The scope lived in your head, not in your sentences, so the notes record a project instead of a mandate."
      }
    },
    {
      id: "committee",
      label: "Committee review",
      frame: "People who never met you read the packet and decide. You are your notes.",
      who: "A review body of people outside your loop, reading write-ups and scores.",
      sees: "The packet only — notes, scores, and usually a recruiter summary. Not you.",
      derisk: "End every story with a stated, checkable outcome rather than a feeling.",
      stall: {
        mid: "A thin packet. Nothing is wrong; nothing is memorable; no reviewer has a line to quote.",
        senior: "Split signal with no tiebreaker — one flat round drags an otherwise good packet to no decision.",
        staff: "Reviewers read strong senior evidence and recommend a level down rather than a rejection."
      }
    },
    {
      id: "matching",
      label: "Team matching",
      frame: "Approved is not hired. Somebody with headcount has to want you specifically.",
      who: "Hiring managers with open roles right now, choosing from a pool of approved candidates.",
      sees: "Your packet plus a conversation about domain, location, and what you want to work on.",
      derisk: "Prepare two or three domains you can credibly work in, and name them unprompted.",
      stall: {
        mid: "Approved but narrow — you fit one stack, and that team just filled its role.",
        senior: "Rigid preferences: one product area, one location, one manager profile, no second option.",
        staff: "Fewer roles exist at your level, and the ones open want a charter you have not shown evidence for."
      }
    },
    {
      id: "offer",
      label: "Offer",
      frame: "The last gate is arithmetic, and it is the one where candidates give away the most.",
      who: "A recruiter working inside a band, with approvals above them for anything unusual.",
      sees: "Your assigned level, packet strength, internal bands, and whatever competing timeline you have.",
      derisk: "Learn the band and the level definition before the number is ever said out loud.",
      stall: {
        mid: "Accepting the first number because it already sounds like a lot.",
        senior: "Negotiating cash when the lever that actually mattered was the level attached to the packet.",
        staff: "No competing timeline, so nothing forces anyone to revisit an initial, conservative offer."
      }
    }
  ];

  var GATE_LEVELS = [
    { id: "mid", label: "Mid" },
    { id: "senior", label: "Senior" },
    { id: "staff", label: "Staff" }
  ];

  Widgets.loopsGateMap = function (mount) {
    if (!mount) return;
    mount.classList.add("widget");

    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "map"),
      h("h3", {}, "Where a strong loop can still stall")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Pick a stage and a level. A loop is a pipeline of gates, and only one of them has you in the room."));

    var state = { stage: "screen", level: "senior" };

    function stageAt(id) {
      for (var i = 0; i < GATE_STAGES.length; i++) if (GATE_STAGES[i].id === id) return GATE_STAGES[i];
      return GATE_STAGES[0];
    }
    function levelLabel(id) {
      for (var i = 0; i < GATE_LEVELS.length; i++) if (GATE_LEVELS[i].id === id) return GATE_LEVELS[i].label;
      return GATE_LEVELS[0].label;
    }

    var controls = h("div", { class: "widget-controls" });
    var stageSeg = h("div", { class: "w-seg" });
    var stageBtns = [];
    var levelSeg = h("div", { class: "w-seg" });
    var levelBtns = [];

    function makePicker(list, seg, store, key) {
      for (var i = 0; i < list.length; i++) {
        (function (item) {
          var b = h("button", {
            class: "w-seg-btn", type: "button",
            onclick: function () { state[key] = item.id; render(); }
          }, item.label);
          seg.appendChild(b);
          store.push({ id: item.id, el: b });
        })(list[i]);
      }
    }
    makePicker(GATE_STAGES, stageSeg, stageBtns, "stage");
    makePicker(GATE_LEVELS, levelSeg, levelBtns, "level");

    controls.appendChild(h("span", { class: "w-field" }, "stage"));
    controls.appendChild(stageSeg);
    controls.appendChild(h("span", { class: "w-field" }, "level"));
    controls.appendChild(levelSeg);
    mount.appendChild(controls);

    var stage = h("div", { class: "w-stage" });
    var pipeline = h("div", {
      style: "font-family: var(--font-mono); font-size: 0.74rem; line-height: 2; color: var(--text-dim);"
    });
    var frame = h("div", { style: "margin-top: 10px; font-size: 0.94rem; line-height: 1.65;" });
    stage.appendChild(pipeline);
    stage.appendChild(frame);
    mount.appendChild(stage);

    var readout = h("div", { class: "w-readout" });
    function roCell() {
      return h("div", { class: "ro", style: "flex: 1 1 240px; line-height: 1.65;" });
    }
    var roWho = roCell(), roSees = roCell(), roStall = roCell(), roFix = roCell();
    readout.appendChild(roWho);
    readout.appendChild(roSees);
    readout.appendChild(roStall);
    readout.appendChild(roFix);
    mount.appendChild(readout);

    function setActive(store, id) {
      for (var i = 0; i < store.length; i++) {
        if (store[i].id === id) store[i].el.classList.add("active");
        else store[i].el.classList.remove("active");
      }
    }

    function render() {
      var s = stageAt(state.stage);
      var lvl = levelLabel(state.level);
      var stallText = (s.stall && s.stall[state.level]) || s.stall.senior;

      setActive(stageBtns, state.stage);
      setActive(levelBtns, state.level);

      var strip = [];
      for (var i = 0; i < GATE_STAGES.length; i++) {
        var name = GATE_STAGES[i].label.toLowerCase();
        strip.push(GATE_STAGES[i].id === state.stage ? "<b>[ " + name + " ]</b>" : name);
      }
      pipeline.innerHTML = strip.join(" &rarr; ");
      frame.innerHTML = "<strong>" + s.label + " &middot; " + lvl + " lens.</strong> " + s.frame;

      roWho.innerHTML = "who decides<br><b>" + s.label + "</b><br>" + s.who;
      roSees.innerHTML = "what they see<br><b>evidence</b><br>" + s.sees;
      roStall.innerHTML = "why you stall here<br><b>" + lvl + "</b><br>" + stallText;
      roFix.innerHTML = "de-risk it earlier<br><b>one move</b><br>" + s.derisk;
    }

    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES OWNED BY THIS FILE
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "loops-google": {
      title: "Google playbook checkpoint",
      sub: "Levels, committee review, and what a loop can and cannot decide.",
      questions: [
        {
          q: "A candidate has a strong onsite and then waits weeks with no news. Given how the process is commonly reported to work, what is the most likely explanation?",
          options: [
            "The interviewers are re-convening to re-score the loop together.",
            "The decision has moved past the people who met you — write-ups go to a review body, and team matching can run after that.",
            "Silence after a loop reliably means a rejection is being written up.",
            "The recruiter has to repeat the technical screen before an offer can be made."
          ],
          answer: 1,
          explain: "Candidates consistently report that the interviewers who meet you do not make the final call. Your loop becomes a packet of write-ups that a review body reads, and a matching step can add weeks after that. Neither stage is visible to you, which is exactly why post-loop silence carries so little information."
        },
        {
          q: "You are an individual contributor with no direct reports. Which answer best demonstrates the leadership dimension the loop is commonly described as looking for?",
          options: [
            "You explain that you consistently defer to whoever is most senior in the room.",
            "You state the headcount of the largest team you have worked alongside.",
            "You noticed a cross-team decision had been stalled for three weeks, convened the two owners, drove it to a call, and handed it back.",
            "You describe the four languages and three frameworks you are strongest in."
          ],
          answer: 2,
          explain: "The dimension is commonly described as emergent leadership: stepping up when something is unowned, then stepping back once it is owned. Headcount you did not manage is not evidence, deference is the opposite of the signal, and a technology list belongs to a different dimension entirely. Notice that the strong answer contains a decision, a duration, and an ending."
        },
        {
          q: "Why does being quotable matter more in a loop with committee review than in a loop where your interviewers decide together in the room?",
          options: [
            "Reviewers score candidates on vocabulary and grammar.",
            "Longer answers produce longer write-ups, and longer write-ups score higher.",
            "Quotes from the loop are reproduced in the offer letter.",
            "The reviewers never met you, so a concrete sentence with a result survives into the write-up while a general good impression does not."
          ],
          answer: 3,
          explain: "Your interviewer writes notes from memory, for people who were not there. 'Seemed strong' and 'cut deploy time from forty minutes to six' both take one line, but only one gives a reviewer something to argue from. Being likeable in the room is cheap; being easy to write down accurately is what actually travels."
        },
        {
          q: "In a behavioural round, what most reliably separates L5 evidence from L4 evidence?",
          options: [
            "L5 stories start from a problem that was ambiguous until you scoped it; L4 stories start from a defined task you executed well.",
            "The number of years since you started working.",
            "L5 stories must span at least three programming languages.",
            "L5 candidates should describe work they did alone, without teammates."
          ],
          answer: 0,
          explain: "Level is read off the shape of the problem you were handed, not off tenure or technology count. If someone else decided what the work was and you did it well, that reads as solid mid-level. If the work was undefined and your judgement is what defined it, that reads senior — and it reads senior even when the resulting change was small."
        },
        {
          q: "An engineering-manager candidate is told the loop includes a coding or code-review round. What is the most sensible read?",
          options: [
            "It is a formality that a recruiter can remove on request.",
            "Technical credibility is still being scored — you are expected to reason about code, not to out-perform a senior individual contributor.",
            "The company intends to hire the candidate as an individual contributor instead.",
            "It replaces the people-management portion of the loop."
          ],
          answer: 1,
          explain: "Manager loops are commonly reported to keep a technical round precisely because the job requires judging decisions you did not make. What is being tested is whether you can read code, ask the right question about it, and say what you would change — not raw speed. Treating it as a formality is the reliable way to produce the weakest write-up in your packet."
        },
        {
          q: "You clear committee review but stall for weeks in team matching. Which action most plausibly helps?",
          options: [
            "Wait quietly, since candidates have no influence over matching.",
            "Ask to re-take the round you thought went worst.",
            "Widen the set of domains and team profiles you can credibly work in, and tell the recruiter specifically which ones.",
            "Decline every conversation until your first-choice team opens a role."
          ],
          answer: 2,
          explain: "Matching is a supply-and-demand step: approved candidates meet managers who have headcount right now. Re-taking a round is not on offer at that point, and hard-declining everything shrinks the pool you are matching against. Naming two or three domains you can genuinely work in is the one lever you still hold."
        }
      ]
    },

    "loops-others": {
      title: "More loops checkpoint",
      sub: "Applied coding, values rounds, and preparing when the reporting is thin.",
      questions: [
        {
          q: "Public reporting about a particular company's loop is thin and contradictory. What is the best preparation response?",
          options: [
            "Assume the loop mirrors the largest company you have interviewed with.",
            "Skip behavioural preparation, since you cannot know what will be asked.",
            "Prepare only for a coding round, which every loop contains.",
            "Ask the recruiter for the actual agenda, and spend your preparation on evidence that transfers across any round shape."
          ],
          answer: 3,
          explain: "Loop trivia is the part of interview folklore that goes stale fastest, and your recruiter is the only source who knows this quarter's agenda. Everything you would build for a well-documented loop — scoped stories, audible reasoning, a result you can state — works regardless of round order. Guessing the format is the low-value half of preparation; building the evidence is the durable half."
        },
        {
          q: "A loop is described as emphasising applied or practical coding rather than pure algorithm puzzles. What should change about your preparation?",
          options: [
            "Practise finishing something that actually runs in a real editor, and narrate trade-offs while the requirements are still incomplete.",
            "Memorise more algorithm templates, since applied problems are just harder puzzles.",
            "Stop practising code entirely and spend the time on behavioural stories.",
            "Prepare one long monologue about your favourite project to fill the time."
          ],
          answer: 0,
          explain: "Applied rounds are commonly reported to reward working software and visible judgement over an optimal asymptotic answer. That means getting something running, choosing what to cut, and saying why out loud — a different muscle from pattern recall. Keep the pattern work as a floor, but spend your marginal hour in a real editor on a deliberately underspecified task."
        },
        {
          q: "In a values-based round, which response is most likely to earn credit?",
          options: [
            "Restating the company's published values in your own words and agreeing with them.",
            "Describing a concrete decision where you gave something up to hold to the value, and naming what it cost.",
            "Explaining that values rounds are subjective and asking to be assessed technically instead.",
            "Listing volunteer work that is unrelated to how you operate at work."
          ],
          answer: 1,
          explain: "A values round is checking whether a stated value survives contact with a trade-off, not whether you can recite it. The credit lives in the cost: what you declined, delayed, or absorbed to hold the line. Agreement is free and therefore carries no information, which is why fluent restatement tends to read as evasion."
        },
        {
          q: "A senior loop is described as mixing system design with behavioural depth. What does that most often mean in practice?",
          options: [
            "The behavioural round is a warm-up and the design round decides everything.",
            "A strong design round can substitute for weak behavioural evidence.",
            "Your behavioural answers have to carry the same scope as your design answers — a senior design paired with a mid-level story is a contradiction the panel notices.",
            "Design questions get replaced by behavioural ones if you do well early."
          ],
          answer: 2,
          explain: "Panels read the whole loop for a consistent level, and mismatch is one of the most common reasons a strong candidate lands lower than expected. If you design across services but every story is about a task somebody handed you, the cheaper explanation is that the design answer was rehearsed. Choose stories whose scope matches the systems you claim to reason about."
        },
        {
          q: "Which answer best demonstrates comfort with ambiguity?",
          options: [
            "'I waited for the requirements document to be finalised before starting.'",
            "'I built every option so that no decision had to be made.'",
            "'It was ambiguous, so the outcome was outside my control.'",
            "'I assumed the write path was the bottleneck because reads were already cached, built the smallest version that would prove it, and said what would have changed my mind.'"
          ],
          answer: 3,
          explain: "The ambiguity signal is about making a defensible call on incomplete information while staying honest about the uncertainty. The strong answer names the assumption, the reason for it, the cheapest test, and the falsifier. Waiting, building everything, and disowning the outcome are the three standard ways candidates fail this prompt."
        },
        {
          q: "You have a loop scheduled at a company this module does not cover. What is the intended way to use these playbooks?",
          options: [
            "Get the real agenda, map each round to the lesson that teaches that round type, and rehearse against those — round types repeat even when the company does not.",
            "Read every lesson end to end the night before, for maximum coverage.",
            "Read only the company whose name is closest and assume the rest transfers exactly.",
            "Skip the playbooks and rely on general behavioural preparation alone."
          ],
          answer: 0,
          explain: "There are only a handful of round types in circulation — screen, applied or algorithmic coding, design, values or culture, hiring-manager conversation — recombined under different names. Once you have the agenda, each round maps onto a lesson that teaches its scoring logic. Cramming everything the night before is the reliable way to arrive with broad familiarity and no rehearsed evidence."
        }
      ]
    }
  });

  /* =================================================================
     MODULE 1 · GOOGLE PLAYBOOKS
     ================================================================= */
  var MODULE_GOOGLE = {
    id: "google",
    name: "Google Playbooks",
    icon: "grid",
    lessons: [
      /* ------------------------------------------------ L4 ------------------------------------------------ */
      {
        id: "google-l4",
        title: "Google L4 — proving you can own a component",
        summary: "The mid-level loop, the four dimensions it is commonly described as scoring, and the scope evidence that carries you through it.",
        minutes: 9,
        tags: ["google", "mid-level", "loop"],
        blocks: [
          { t: "p", html: "Hold one picture for this entire module: <strong>a Google loop is an evidence-collection exercise, not a verdict</strong>. The people sitting with you are widely reported not to be the people who decide. They interview, they write, and the writing travels without you. Almost everything strange about preparing for this company follows from that one fact." },
          { t: "p", html: "At L4 — commonly mapped to a mid-level software engineer — the loop is trying to answer a narrow, answerable question: <em>can we hand you a defined piece of work and stop thinking about it?</em> It is not asking whether you can invent the roadmap. That bar arrives at <a href=\"#/loops/google/google-l5\">L5</a>." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Round counts, order, and tooling vary by office, by organisation, and by year, and candidates report all three changing. Read the table as the <em>modal shape</em> people describe, not as a schedule you can bank on. Your recruiter knows the real agenda for your loop — ask for it in writing, because they will usually tell you." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Commonly ~30 min", "Call, no code", "Level calibration, motivation, logistics — and whether your scope survives one sentence"],
              ["Technical screen", "Commonly ~45 min", "Video call plus a shared editor, commonly without autocomplete or execution", "One or two coding problems, and whether you narrate while solving"],
              ["Coding rounds (commonly two)", "Commonly ~45 min each", "Shared editor, interviewer watching you type", "Data structures and correctness under time; typically one or two problems per round, plus a follow-up constraint"],
              ["Behavioural / culture round", "Commonly ~45 min", "Conversation, no code", "Collaboration, ownership, humility — often several shorter prompts rather than two deep dives"],
              ["Component design round (inconsistently reported at L4)", "Commonly ~45 min", "Conversation with a shared drawing surface", "When it appears it is scoped to one component, not a whole system"]
            ]
          },
          { t: "note", variant: "tip", html: "Treat every number above as an approximation candidates converge on, not a published fact. The one detail worth confirming directly is how many coding rounds you have, because that changes how much of your preparation should go to the behavioural side." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Google describes itself as hiring against four broad attributes: <strong>general cognitive ability</strong>, <strong>role-related knowledge and experience</strong>, <strong>leadership</strong>, and <strong>culture fit</strong>. These are dimensions, not a checklist an interviewer ticks in front of you, and how heavily each one weighs is commonly reported to shift by round and by interviewer. What is stable is what each one <em>looks like</em> in the room." },
          {
            t: "table",
            headers: ["Dimension", "What it looks like in an L4 round", "How candidates lose it"],
            rows: [
              ["General cognitive ability", "You take an unfamiliar problem, decompose it out loud, and change approach when a constraint is added", "Silence while thinking, then a finished answer — the reasoning never became visible, so it cannot be written up"],
              ["Role-related knowledge", "You reach for the right data structure without ceremony, and can say why the obvious alternative is worse <em>here</em>", "Reciting a memorised optimal solution with no account of how you arrived at it"],
              ["Leadership", "You stepped up on something nobody owned and stepped back once it was owned — no reports required", "Waiting to be told; describing team outcomes with no first-person decision inside them"],
              ["Culture fit", "You are specific about what you got wrong and what changed as a result, and you make the interviewer's job easy", "Polished blamelessness — every story ends well and nobody ever disagreed with you"]
            ]
          },
          { t: "p", html: "The trade-off is real and worth naming: optimising hard for one dimension costs you another. Candidates who chase cognitive-ability signal talk constantly and stop listening, which reads badly on culture fit. Candidates who chase likeability agree with every hint and lose the knowledge signal. Aim for <em>audible reasoning plus one genuine disagreement handled well</em> — see <a href=\"#/beh/foundation/how-evaluated\">how the round is scored</a>." },

          { t: "h", text: "Question types most commonly reported" },
          { t: "p", html: "What follows are shapes, not questions. Nobody here has or wants a list of live prompts, and a candidate who is visibly reciting a prepared answer to a known question reads worse than one who thinks." },
          {
            t: "ul", items: [
              "<strong>Coding under observation.</strong> Array, string, hash-map, tree, and graph shapes, with one follow-up that invalidates your first approach. The follow-up is the actual test.",
              "<strong>Ownership-framed behavioural prompts</strong> — a deadline you missed, a bug you shipped, a disagreement you lost. Work through <a href=\"#/beh/foundation/decode\">naming what a question is really asking</a> before you write answers.",
              "<strong>Rapid collaboration prompts</strong> — a teammate who blocked you, feedback you found hard to take. Shorter and faster than a full story; <a href=\"#/beh/delivery/big-three\">the big three</a> covers the underlying shapes.",
              "<strong>Motivation probes</strong> — why this team, why now. Cheap to prepare and disproportionately visible in a write-up, because they are easy to quote."
            ]
          },
          { t: "note", variant: "warn", html: "Do not hunt for verbatim question lists. They go stale, interviewers are asked to vary their prompts, and preparing answers rather than evidence makes you brittle the moment the wording shifts. Prepare stories you can re-cut on demand — start at <a href=\"#/beh/foundation/select\">selecting the right story</a>." },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>The behavioural round is scored, not a breather.</strong> People coast through it because there is no code on the screen, then discover it produced the thinnest write-up in their packet.",
              "<strong>Nobody in the room can rescue you.</strong> Because interviewers commonly score independently and cannot see each other's notes during the loop, there is no mechanism by which a great coding round repairs a weak conversation. 'The rest went well' is not something anyone present can say on your behalf.",
              "<strong>Speed is not the L4 signal.</strong> Finishing fast in silence scores worse than finishing slower with your reasoning audible, because the audible version is the only part that gets written down."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Fix your scope sentence first.</strong> One sentence per project: the decision you made, the constraint you made it under, the number it moved. If you cannot say it in one breath, the screen will down-level you before anyone technical sees you. Work through <a href=\"#/story/catalog/scope-signal\">the scope signal</a>.",
              "<strong>Build five stories, not fifteen.</strong> At L4 the coverage you need is narrow: you shipped something, you broke something, you disagreed with someone, you learned something the hard way, you helped someone. Check for holes with <a href=\"#/story/catalog/coverage-matrix\">the coverage matrix</a> and give each story a spine using <a href=\"#/story/catalog/story-anatomy\">story anatomy</a>.",
              "<strong>Practise coding out loud, not just coding.</strong> The Codex academy covers the pattern work itself. What is specific to <em>this</em> loop is doing it while narrating, in a plain editor, with no autocomplete. Two hours of that beats ten hours of silent practice.",
              "<strong>Rehearse the follow-up, not the solution.</strong> After you solve a practice problem, add a constraint that breaks your answer — the input no longer fits in memory, duplicates are now allowed, the array arrives as a stream — and re-solve out loud. That is the part of the round that separates candidates.",
              "<strong>Run two timed mocks with a stranger.</strong> Friends are too generous and you already know their reactions. <a href=\"#/story/playbooks/mock-drills\">Mock drills</a> covers how to run one that produces usable feedback."
            ]
          },
          { t: "cue", html: "<strong>Say the result before the retrospective.</strong> 'We cut checkout p95 from 1.9 seconds to 700 milliseconds — here is how' hands your interviewer a sentence they can type. 'Let me give you some background first' hands them four minutes of context and nothing to write down." },
          { t: "note", variant: "key", html: "<strong>At L4 you are proving reliability, not vision.</strong> One defined piece of work, owned end to end, reasoning audible, result stated as a number. Every sentence should be easy for a stranger to write down accurately — because a stranger is who reads it." }
        ]
      },

      /* ------------------------------------------------ L5 ------------------------------------------------ */
      {
        id: "google-l5",
        title: "Google L5 — where ambiguity becomes the test",
        summary: "The senior loop adds design and moves the bar from 'executed well' to 'chose well when nobody had decided yet'.",
        minutes: 10,
        tags: ["google", "senior", "loop"],
        blocks: [
          { t: "p", html: "The mental model shift from L4 to L5 is small to describe and hard to fake: <strong>at L4 you are given the problem; at L5 you are given the mess</strong>. The loop stops asking whether you can execute and starts asking whether your judgement is worth deferring to when the correct answer is genuinely unknown." },
          { t: "p", html: "This is why so many strong engineers get a down-level surprise. Their execution stories are excellent and every one of them starts with somebody else deciding what to build. The evidence is real; it is just evidence for the level below." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Same caveat as the previous lesson, and it matters more here: the senior loop is commonly reported to swap rounds in and out depending on the organisation you are matching against. Confirm the agenda with your recruiter rather than preparing for the table." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Commonly ~30 min", "Call, no code", "Whether your scope reads senior out loud, before anyone books a loop against it"],
              ["Technical screen", "Commonly ~45 min", "Video call plus a shared editor", "Coding fluency; commonly one or two problems, with less patience for a slow start than at L4"],
              ["Coding rounds (commonly two)", "Commonly ~45 min each", "Shared editor, interviewer observing", "Correctness plus the quality of the trade-off you narrate when the constraint changes"],
              ["System design round (commonly one at this level)", "Commonly ~45 min", "Conversation with a shared drawing surface", "Requirements you extract yourself, an explicit trade-off, and what you would measure afterwards"],
              ["Behavioural / culture round", "Commonly ~45 min", "Conversation, no code", "Ambiguity ownership, influence across teams, and how you handle being wrong in public"]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Same four dimensions as L4 — cognitive ability, role-related knowledge, leadership, culture fit — read against a wider blast radius. Nothing in the framework changes; what changes is the size of the thing your evidence has to move." },
          {
            t: "table",
            headers: ["Dimension", "L4 reading", "L5 reading"],
            rows: [
              ["General cognitive ability", "Decomposes a stated problem", "Notices the problem is stated wrong, and says so before solving it"],
              ["Role-related knowledge", "Picks the right tool for the task", "Picks the right tool <em>and</em> can say what it will cost the team in eighteen months"],
              ["Leadership", "Unblocks their own work and helps nearby", "Moves people who do not report to them and were not obliged to agree"],
              ["Culture fit", "Handles feedback well", "Changes a decision publicly when the evidence turns, without theatrics"]
            ]
          },
          { t: "p", html: "The trade-off nobody warns you about: at L5 the same story can prove influence and prove poor judgement, depending on which half you emphasise. Driving a rewrite through three teams is leadership if you can name what it cost and why it was still right, and recklessness if you cannot. Rehearse the cost sentence — <a href=\"#/beh/delivery/deliver-salt\">the four-beat structure</a> gives you a place to put it." },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Design with deliberately missing requirements.</strong> The interviewer withholds constraints to see whether you ask. The Blueprint academy covers the design content itself; what this round adds is scoring you on the asking.",
              "<strong>Ambiguity prompts</strong> — a project with no clear owner, a decision made on incomplete data, a direction you had to set with two credible options. <a href=\"#/story/catalog/ownership-ambiguity\">Ownership under ambiguity</a> is the story shape to build.",
              "<strong>Influence prompts</strong> — someone senior disagreed, another team's roadmap blocked you, you had to kill something people liked.",
              "<strong>Coding with a twist</strong> — commonly a familiar shape plus a constraint that makes the textbook answer wrong, so the reasoning is forced into the open."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>The design round is not scored on the diagram.</strong> Candidates optimise the picture and under-invest in the sentence that names what they traded away. A clean architecture with no stated cost commonly reads as inexperience, not clarity.",
              "<strong>The behavioural round is where the level is confirmed or dropped.</strong> Design and coding establish that you are competent; the conversation is where a reviewer decides whether the competence operated at senior scope.",
              "<strong>'Cross-team' is claimed constantly and evidenced rarely.</strong> If your story contains no person who could have said no, it is not a cross-team story — it is a large task. <a href=\"#/beh/delivery/pitfalls\">Common delivery pitfalls</a> covers how this collapses under a follow-up question."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Audit your stories for who decided.</strong> Go through your bank and mark, for each, who chose the goal. Everything where the answer is 'my manager' is L4 evidence. You need at least three where the answer is 'me, and here is how I knew'.",
              "<strong>Attach a cost to every win.</strong> For each senior story, write the sentence 'this cost us ___, and I chose that because ___'. Interviewers probe for it; having it ready is the difference between a confident answer and a defensive one.",
              "<strong>Prepare one story where you were wrong at scale</strong> — a direction you set that did not work, and what you did on discovering it. Senior candidates who cannot produce this read as either untested or unreflective.",
              "<strong>Do design practice out loud with a timer.</strong> Blueprint has the content; this loop adds the constraint that you have well under an hour and must extract the requirements yourself. Practise the first five minutes over and over — that is where the round is usually won or lost.",
              "<strong>Calibrate against the level bar directly.</strong> <a href=\"#/story/playbooks/big-tech\">The big-tech playbook</a> lays out what senior scope has to look like across companies, which is a faster read than guessing from job descriptions."
            ]
          },
          { t: "cue", html: "<strong>Open ambiguity stories with the fork, not the finish.</strong> 'There were two defensible options and no data to separate them, so I ran the cheapest experiment that would kill one of them' establishes senior scope in a single sentence — before you have described a single technical detail." },
          { t: "note", variant: "key", html: "<strong>L5 is bought with judgement under uncertainty, not with output.</strong> Every story should contain a fork you chose at, a cost you accepted, and someone who could have said no. If <a href=\"#/loops/google/google-l6\">L6</a> is your target instead, the same structure holds — the fork just has to affect teams that were never yours." }
        ]
      },

      /* ------------------------------------------------ L6 ------------------------------------------------ */
      {
        id: "google-l6",
        title: "Google L6 — evidence that crosses team boundaries",
        summary: "Staff loops are scored on leverage: what changed for people who do not report to you and did not have to agree.",
        minutes: 10,
        tags: ["google", "staff", "loop"],
        blocks: [
          { t: "p", html: "At L6 the unit of evidence changes from a project to a <strong>direction</strong>. The loop is asking what is true across several teams now that was not true before you, and whether the change survived your attention moving elsewhere. Output is assumed at this level. Leverage is the thing being measured." },
          { t: "p", html: "Be warned that this is the level where public reporting is thinnest and most contradictory, because staff loops are commonly assembled around the specific organisation you are matching into. Everything below is the shape people converge on, held more loosely than the two lessons before it." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "The reported variation is widest here. Some candidates describe two design rounds; others describe one design round plus a technical-leadership conversation; others describe a domain deep-dive specific to the organisation. Get the agenda from your recruiter — at this level it is genuinely unguessable." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Commonly ~30 min", "Call, no code", "Whether the scope on paper is org-level or one very large team, which decides the loop you get booked into"],
              ["Coding round(s)", "Commonly ~45 min each", "Shared editor", "Still present and still scored; fluency is expected rather than impressive, and a weak round is hard to explain away"],
              ["Design round(s) — one or two, reported inconsistently", "Commonly ~45 min each", "Conversation with a shared drawing surface", "Systems that span teams, migration and deprecation paths, and what you would do about the parts you cannot control"],
              ["Technical leadership / cross-functional conversation", "Commonly ~45 min", "Conversation, no code", "Influence without authority, alignment across competing roadmaps, and how you handle a peer who outranks you politically"],
              ["Behavioural / culture round", "Commonly ~45 min", "Conversation, no code", "Judgement over long horizons, and whether the changes you drove outlived your involvement"]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "The four dimensions again, and at this level the leadership dimension quietly absorbs the others. A brilliant technical answer that only ever landed inside your own team is read as strong senior evidence, and reviewers say so in writing." },
          {
            t: "table",
            headers: ["Dimension", "What L6 evidence looks like", "The near-miss that gets you L5"],
            rows: [
              ["General cognitive ability", "You reframe the question the organisation is asking, not just the one in the room", "You answer the stated question superbly and never question it"],
              ["Role-related knowledge", "You can name the second-order cost of a platform decision three teams downstream", "Deep expertise that stops at your own service boundary"],
              ["Leadership", "Teams that did not report to you changed what they build, and it stuck after you moved on", "You led a large project extremely well, with the mandate handed to you"],
              ["Culture fit", "You made an unpopular call, absorbed the disagreement, and kept the relationships", "You avoided the unpopular call and framed the avoidance as consensus-building"]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Multi-team design and migration</strong> — commonly a system you cannot rewrite, owned partly by people you do not control.",
              "<strong>Influence-without-authority prompts</strong> — you needed three teams to adopt something and had no ability to make them. <a href=\"#/story/catalog/conflict-growth\">Conflict and growth stories</a> is where to build these.",
              "<strong>Long-horizon judgement</strong> — a bet you made whose result took multiple quarters to show. Vague endings hurt more at this level than anywhere else.",
              "<strong>Organisational trade-off prompts</strong> — you had to slow one team down to unblock two others. Also see <a href=\"#/beh/advanced/special-types\">special question types</a> for the unusual framings that show up in senior loops."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>The loop shape is the least consistent thing about this level.</strong> Two L6 candidates in the same quarter routinely describe different round mixes. Preparing for a specific agenda you found second-hand is a worse use of time than preparing evidence that works in any of them.",
              "<strong>A down-level is a normal outcome, not an insult.</strong> Committee review reads a packet full of excellent senior evidence and recommends the level that packet actually supports. It is not a judgement about your ceiling; it is a statement about what your stories proved. If that happens, <a href=\"#/offer/anatomy/level-bands\">level bands</a> explains what is and is not negotiable afterwards.",
              "<strong>The coding round still counts.</strong> Candidates who have not written production code in two years assume seniority excuses a rusty round. Reviewers see a low score with no context and weigh it, because they were not there to see the rest of you."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Find your three org-level artefacts.</strong> A standard others adopted, a platform others build on, a deprecation others completed. If you have none, you have a scope problem rather than a storytelling problem, and no amount of rehearsal fixes it before the loop.",
              "<strong>Name the people who could have said no.</strong> For each story, write down who had veto power and why they eventually did not use it. That sentence is the single most reliable proof of influence without authority.",
              "<strong>Prove durability.</strong> Add an ending to each story describing the state twelve months later. Reviewers reading a packet cannot tell a lasting change from a heroic quarter unless you say which one it was.",
              "<strong>Re-warm your coding.</strong> A handful of hours of Codex-style pattern practice is enough to keep a rusty round from becoming the one weak line in an otherwise strong packet.",
              "<strong>Rehearse against a principles frame.</strong> Even where the loop is not principle-driven, <a href=\"#/story/playbooks/principle-based\">principle-based playbooks</a> forces your stories to state a value and its cost, which is exactly the muscle the leadership dimension is testing.",
              "<strong>Know why you want the level.</strong> <a href=\"#/beh/foundation/why-it-matters\">Why the behavioural round matters</a> is worth re-reading here, because staff loops probe motivation harder than any other level."
            ]
          },
          { t: "cue", html: "<strong>End staff stories in the present tense.</strong> 'Four teams still build against that interface, and I have not touched it in a year' is a durability claim a reviewer can quote. 'It was a big success' is a sentence nobody can do anything with." },
          { t: "note", variant: "key", html: "<strong>L6 is bought with change that outlived you.</strong> Org-level artefact, named people who could have refused, a stated cost, and a twelve-month-later ending. If your loop is for a management role instead, <a href=\"#/loops/google/google-manager\">the manager playbook</a> covers the extra gates that come with it." }
        ]
      },

      /* --------------------------------------------- MANAGER --------------------------------------------- */
      {
        id: "google-manager",
        title: "Google engineering manager — the loop is not the last gate",
        summary: "Manager loops add a hiring assessment and a coding-or-code-review round, then hand you to committee review and team matching.",
        minutes: 11,
        tags: ["google", "manager", "loop", "committee"],
        blocks: [
          { t: "p", html: "Manager candidates consistently report a loop with three features worth planning around: <strong>a hiring assessment</strong>, <strong>a coding or code-review round</strong>, and <strong>post-loop hiring-committee review followed by team matching</strong>. The first two shape how you prepare. The third changes what preparation is even for." },
          { t: "p", html: "Say the consequence out loud, because it is the single most useful thing in this module: <strong>the loop is not the last gate</strong>. A strong loop can still stall in committee review or in matching. That means two things you control — how writable your answers are, and how flexible your matching preferences are — matter roughly as much as how well the conversations go." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Manager loops are assembled more variably than IC loops, and candidates report meaningful differences between organisations. What recurs across accounts is the mix below rather than a fixed sequence." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Commonly ~30 min", "Call", "Scope of orgs you have run, and whether you are being considered as a manager or as a senior individual contributor"],
              ["Hiring assessment", "Commonly ~45 min", "Conversation, no code", "How you hire, calibrate, and say no — sourcing, bar-setting, and what you do about a bad hire you made"],
              ["Coding or code review", "Commonly ~45 min", "Shared editor, or an existing diff to critique", "Technical credibility: whether you can read code, ask the sharp question, and say what you would change"],
              ["People management round(s)", "Commonly ~45 min each", "Conversation, no code", "Performance conversations, underperformance, growth, attrition, and the calls you made that people disliked"],
              ["Project / org leadership round", "Commonly ~45 min", "Conversation, sometimes with a drawing surface", "Delivery under constraint, prioritisation, and how you handled a commitment you could not meet"],
              ["Cross-functional round", "Commonly ~45 min", "Conversation, no code", "Working with product, design, and peer managers whose incentives differ from yours"]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "The same four dimensions are commonly described as applying here — cognitive ability, role-related knowledge, leadership, culture fit — with role-related knowledge quietly meaning two things at once: management craft <em>and</em> enough technical depth to judge decisions you did not make. That dual meaning is exactly why the coding round survives." },
          {
            t: "table",
            headers: ["Dimension", "What it means for a manager", "The way candidates lose it"],
            rows: [
              ["General cognitive ability", "You can reason about an unfamiliar org problem live, not just recall how you solved yours", "Answering every prompt with the same reorganisation story"],
              ["Role-related knowledge (management)", "Concrete mechanisms: how you run calibration, how you handle a regretted hire, how you set a bar", "Philosophy without mechanism — 'I believe in psychological safety' with no example of it costing you something"],
              ["Role-related knowledge (technical)", "You can review a diff, name the risk in it, and ask the question that surfaces the real issue", "Deflecting with 'my staff engineer would handle that', which reads as an inability to judge technical work"],
              ["Leadership", "Decisions people disliked, made anyway, with the relationship intact afterwards", "Consensus stories where nobody was unhappy, which reviewers read as avoidance"],
              ["Culture fit", "You are specific about a management failure and what changed in your practice", "A single sanitised failure that resolves in your favour by the end of the sentence"]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Hiring mechanics</strong> — how you calibrate a bar, what you do when a panel splits, a hire you regretted and what you changed afterwards.",
              "<strong>Underperformance</strong> — the most commonly reported manager prompt shape, and the one where vague answers are most obvious. It wants a timeline, a conversation you actually had, and an outcome.",
              "<strong>Code review under conversation</strong> — sometimes reading an existing change rather than writing one, scored on the questions you ask about it.",
              "<strong>Peer conflict</strong> — another manager whose roadmap collided with yours, resolved without escalation or with escalation you can justify. <a href=\"#/story/playbooks/manager-track\">The manager-track playbook</a> covers how to build this set properly."
            ]
          },

          { t: "h", text: "After the loop: two more gates" },
          { t: "p", html: "Once the loop ends, your interviewers write up their sessions and your candidacy becomes a packet. A hiring committee of people who never met you reads that packet and decides; then, commonly, team matching puts you in front of managers with actual open headcount. Both gates operate on evidence you can no longer add to, which is why the practical instruction is unglamorous: <strong>be quotable, not merely likeable</strong>. Your interviewers are writing for strangers, so hand them concrete sentences with results attached — <a href=\"#/beh/foundation/how-evaluated\">how the round is scored</a> unpacks what those look like." },
          { t: "widget", id: "loopsGateMap" },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>A great loop can end in nothing.</strong> Approved-but-unmatched is a real outcome, and it is not a hidden rejection. It usually means your preferences and the open roles did not intersect at the moment you cleared review.",
              "<strong>The coding round is scored, not symbolic.</strong> Managers who treat it as a courtesy produce the weakest line in an otherwise strong packet, and a reviewer with no context weighs it as written.",
              "<strong>Charm does not survive the write-up.</strong> The warmest conversation in your loop can produce the vaguest notes, because nothing in it was concrete enough to record. That inversion catches experienced managers more often than anyone else."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Write the packet you want.</strong> For each of your six or seven core stories, write the one line you would want an interviewer to type. If that line has no number, no decision, and no named consequence, rewrite the story until it does.",
              "<strong>Build the management coverage grid.</strong> Hiring, firing, growing, disagreeing, missing a commitment, reorganising, and losing someone you wanted to keep. <a href=\"#/story/catalog/coverage-matrix\">The coverage matrix</a> works unchanged for manager sets.",
              "<strong>Spend three hours on code review, not on algorithms.</strong> Pull real diffs, practise saying what is risky and what question you would ask. That maps to the round far better than pattern grinding, though a little Codex-style practice is worth doing if you have not typed code in a year.",
              "<strong>Decide your matching flexibility before you need it.</strong> Write down two or three domains and team profiles you can credibly lead, and give them to your recruiter unprompted. Also read <a href=\"#/offer/execution/recruiter-scope\">what a recruiter can and cannot do</a>, because matching is exactly where that boundary matters.",
              "<strong>Prepare for the gap.</strong> Weeks of silence after a strong loop is normal in a committee-plus-matching process. Keep other timelines alive — <a href=\"#/offer/anatomy/leverage\">where leverage comes from</a> explains why that is a negotiating asset and not just a hedge."
            ]
          },
          { t: "cue", html: "<strong>Give every management story a countable spine.</strong> 'Attrition on the team went from four in a year to one, and here is the specific thing I changed' is quotable. 'I focused on building trust' is not — and a reviewer who never met you cannot tell the difference between that sentence and nothing." },
          { t: "note", variant: "key", html: "<strong>Optimise for the packet, not the room.</strong> A manager loop is judged twice more after you leave it, by people reading text. Be concrete enough to be written down accurately, and flexible enough to be matched. Next, <a href=\"#/loops/others/microsoft-senior\">the closing lesson of the next module</a> shows how to apply this whole playbook to a loop nobody has documented." },
          { t: "quiz", id: "loops-google" }
        ]
      }
    ]
  };

  /* =================================================================
     MODULE 2 · MORE LOOPS
     ================================================================= */
  var MODULE_OTHERS = {
    id: "others",
    name: "More Loops",
    icon: "globe",
    lessons: [
      /* --------------------------------------------- OPENAI L4 --------------------------------------------- */
      {
        id: "openai-l4",
        title: "OpenAI mid-level — applied coding and unfinished problems",
        summary: "A loop commonly reported to favour working software over puzzle solutions, with ambiguity as a first-class signal.",
        minutes: 8,
        tags: ["openai", "mid-level", "applied-coding"],
        blocks: [
          { t: "p", html: "Start with an honesty note that applies to this whole module: <strong>the reporting here is thinner than for Google</strong>, and it changes fast at a company growing this quickly. So this lesson teaches the loop's <em>shape</em> and the preparation that transfers, and marks clearly where the detail runs out rather than filling the gap with invention." },
          { t: "p", html: "The shape candidates commonly describe is a practical one: coding that looks like work rather than like a puzzle, at least one conversation about mission and how you operate, and a hiring-manager discussion. The mental model to hold is <strong>'show me you would be useful on Monday'</strong>." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Round counts and durations for this loop are <em>not</em> reliably reported, so the table below deliberately does not invent them. Read the rows as round <em>types</em> that recur in candidate accounts, in a plausible order. Your recruiter has the real agenda — asking for it is worth more than any second-hand schedule." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Not reliably reported", "Call", "Motivation and fit for the specific team, plus a rough level read"],
              ["Applied / practical coding", "Not reliably reported", "Commonly described as a real editor rather than a bare whiteboard-style pad", "Whether you get something working, and whether your trade-offs are audible while requirements are still incomplete"],
              ["Technical deep dive on your own work", "Not reliably reported", "Conversation", "Depth on something you actually built — commonly reported to go further than candidates expect"],
              ["Values / mission conversation", "Not reliably reported", "Conversation", "Why this problem, how you behave under disagreement, and how you handle work whose consequences are contested"],
              ["Hiring-manager conversation", "Not reliably reported", "Conversation", "Scope fit for the team and how you operate without a defined process"]
            ]
          },
          { t: "note", variant: "warn", html: "Every cell above that says <em>not reliably reported</em> means exactly that. Do not let anyone — including this page — tell you a round count or a duration for this loop with confidence. Ask, and prepare so that the answer does not change your plan much." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "There is no publicly known named competency framework for this loop that is safe to assert, so treat what follows as the <em>signals candidates consistently describe being probed on</em>, not as a rubric with official names. That distinction matters: quoting a made-up framework name in an interview is a fast way to sound like you read a forum instead of thinking." },
          {
            t: "table",
            headers: ["Signal", "What it looks like in the room", "How it goes wrong"],
            rows: [
              ["Applied competence", "Something runs by the end. You chose what to cut and said why", "A beautiful abstraction with nothing working, or optimal complexity for a problem nobody had"],
              ["Working with ambiguity", "You state an assumption, act on it, and name what would change your mind", "Asking clarifying questions indefinitely, which reads as an inability to commit"],
              ["Velocity with judgement", "Fast, and able to say which corners you cut deliberately", "Fast and silent, so nobody can tell whether the corners were chosen or missed"],
              ["Seriousness about consequences", "You can discuss the downside of what you build without either dismissing it or catastrophising", "Treating a values conversation as a formality to agree your way through"]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Build-or-extend tasks</strong> — implement something small but real, then extend it when the requirement changes mid-round.",
              "<strong>Debug-an-existing-thing tasks</strong> — read unfamiliar code and make it work, which is scored on how you localise the problem, not how fast you type.",
              "<strong>Deep dive on your own project</strong> — expect follow-ups past the boundary of what you personally built, and expect 'I do not know, but here is how I would find out' to score better than a guess.",
              "<strong>Judgement prompts about the work itself</strong> — how you would think about a capability whose misuse is plausible. <a href=\"#/beh/advanced/ai-questions\">Questions about AI at work</a> covers the adjacent shapes now appearing in many loops."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>Practical does not mean easy.</strong> Candidates who prepared exclusively with algorithm drills report being caught out by a task that needed file handling, an API shape, and a decision about what to skip.",
              "<strong>Silence is more expensive here than usual.</strong> When the requirements are deliberately incomplete, an interviewer with no narration cannot distinguish careful thought from being stuck.",
              "<strong>What we do not reliably know about this loop.</strong> Round counts, durations, whether the format is consistent across teams, whether there is a named rubric, and how much any of this has changed in the last year. Treat confident second-hand claims on those points as unreliable, including any you have already read."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Practise in the tools you would actually use.</strong> A real editor, a real file tree, a real run command. If the round is applied, rehearsing in a plain text box trains the wrong reflexes.",
              "<strong>Do three underspecified builds.</strong> Give yourself a one-line brief, set a timer, and force yourself to state assumptions out loud as you go. The habit of narrating an assumption is the transferable skill here.",
              "<strong>Prepare one project you can be interrogated on for thirty minutes.</strong> Know the numbers, the alternative you rejected, and the part that is still bad. Depth beats breadth in this round every time.",
              "<strong>Build two ambiguity stories properly.</strong> <a href=\"#/story/catalog/ownership-ambiguity\">Ownership under ambiguity</a> is the exact shape this loop probes, and the exact shape most candidates have never written down.",
              "<strong>Have a real answer about consequences.</strong> Not a position paper — a short, specific view about a trade-off you have actually faced in your own work. Use <a href=\"#/beh/delivery/deliver-salt\">the four-beat structure</a> to keep it to ninety seconds."
            ]
          },
          { t: "cue", html: "<strong>Narrate the cut, not just the code.</strong> 'I am skipping input validation for now and hard-coding the config, because the thing worth proving in twenty minutes is the retry path' converts silence into scoreable judgement — and it works in any applied round anywhere." },
          { t: "note", variant: "key", html: "<strong>Get something working and keep your reasoning audible.</strong> Applied loops reward finished-and-explained over elegant-and-silent. Where the reporting is thin, prepare the transferable version and ask your recruiter for the rest. <a href=\"#/loops/others/openai-l5\">The senior version of this loop</a> raises the ambiguity bar rather than the coding bar." }
        ]
      },

      /* --------------------------------------------- OPENAI L5 --------------------------------------------- */
      {
        id: "openai-l5",
        title: "OpenAI senior — owning ambiguity when the target moves",
        summary: "The same applied emphasis, with the bar moved from 'you handled an unclear task' to 'you set direction while it was still unclear'.",
        minutes: 9,
        tags: ["openai", "senior", "ambiguity"],
        blocks: [
          { t: "p", html: "Same honesty caveat as the previous lesson, and it applies with more force at senior level: <strong>the reliable public detail about this loop is thin</strong>. What is consistently described is an emphasis on applied work and on ambiguity. What is <em>not</em> reliably known is how a senior loop is assembled, how many rounds it runs, or whether there is a named rubric behind it." },
          { t: "p", html: "The mental model that actually helps: at senior level in a fast-moving research-adjacent company, the target moves while you are building. The loop is asking whether your judgement holds up when the thing you were building for stops being the thing that matters." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Round types only — the same reasoning as before, and the same instruction: ask your recruiter for the actual agenda rather than trusting any schedule you find second-hand, including this one." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Not reliably reported", "Call", "Senior scope read, and which team you would be matched against"],
              ["Applied coding", "Not reliably reported", "Commonly a real editor", "Working software plus explicit trade-offs; expected to be faster and more decisive than at mid level"],
              ["System or product design", "Not reliably reported", "Conversation, drawing surface", "Design under moving requirements, and what you would build first if half the plan is likely wrong"],
              ["Deep dive on prior work", "Not reliably reported", "Conversation", "Whether you set the direction or executed one, and whether you can say what it cost"],
              ["Values / mission conversation", "Not reliably reported", "Conversation", "How you behave when the right answer is contested and the deadline is real"],
              ["Hiring-manager conversation", "Not reliably reported", "Conversation", "Scope fit, autonomy, and how you work when there is no process to lean on"]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Again: no named framework worth asserting. The senior-versus-mid difference in the signals candidates describe is consistent enough to be useful, though — the same signals, read against a larger surface." },
          {
            t: "table",
            headers: ["Signal", "Mid-level reading", "Senior reading"],
            rows: [
              ["Applied competence", "Builds the thing that was described", "Builds the smallest thing that resolves the actual uncertainty"],
              ["Working with ambiguity", "Handles an unclear task without stalling", "Sets a direction while it is still unclear, and states the falsifier"],
              ["Velocity with judgement", "Fast, with corners deliberately cut", "Fast, and can say which speed was worth the debt and which was not"],
              ["Influence", "Communicates clearly within the team", "Changes what other people build, without a mandate to do so"]
            ]
          },
          { t: "p", html: "The trade-off to name in the room: speed and reversibility trade against each other, and senior candidates are expected to say which they picked. Shipping fast on a decision that is cheap to undo is judgement; shipping fast on a schema everyone will depend on is a bill someone else pays. <a href=\"#/story/catalog/scope-signal\">The scope signal</a> covers how to make that distinction audible." },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Applied builds with a mid-round requirement change</strong> — scored on whether your first structure survives the change or has to be thrown away.",
              "<strong>Design with unstable requirements</strong> — the round wants to hear what you would build first and what you deliberately left unresolved.",
              "<strong>Direction-setting stories</strong> — a bet you made before the evidence arrived, and what you did when partial evidence contradicted it.",
              "<strong>Working-style prompts</strong> — how you operate with little process, which is a genuine fit question rather than a trick. Both <a href=\"#/story/playbooks/startup-vs-scale\">startup versus scale-up playbooks</a> and honest self-assessment help more than a rehearsed answer here."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>Seniority is not demonstrated by slowing down.</strong> Candidates who bring a big-company design cadence — thirty minutes of requirement gathering before anything exists — commonly report it landing badly in an applied round.",
              "<strong>The values conversation has technical content.</strong> It is frequently described as a real discussion about trade-offs in the work, not a culture-fit chat, and preparing platitudes for it is the standard mistake.",
              "<strong>What we do not reliably know about this loop.</strong> Whether the senior loop differs structurally from the mid-level one, how levels map to titles, how much variation exists between teams, and how recently any of it changed. Nobody outside can tell you this reliably. Your recruiter can."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Practise deciding early with a stated falsifier.</strong> Set a two-minute cap on clarifying questions in practice sessions, then commit to an assumption out loud and name what would overturn it. This is the highest-leverage habit for this loop.",
              "<strong>Rehearse a mid-round pivot.</strong> Have a partner change the requirement fifteen minutes into a practice build. What is being scored is whether your first structure bent or broke.",
              "<strong>Bring one bet you got wrong.</strong> Senior direction-setting stories that all worked out read as selected rather than honest, and interviewers probe accordingly.",
              "<strong>Do not import a heavyweight design ritual.</strong> Keep the structure from the Blueprint academy, but compress the opening — extract the constraints that change your first decision and start.",
              "<strong>Rehearse out loud, on a timer, more than you read.</strong> <a href=\"#/beh/advanced/practicing\">How to practise properly</a> covers why silent preparation for a narration-scored loop is close to useless.",
              "<strong>Calibrate scope against a documented ladder.</strong> Comparing your evidence with <a href=\"#/loops/google/google-l5\">a well-documented senior loop</a> is a practical proxy when the target company's own bar is not public."
            ]
          },
          { t: "cue", html: "<strong>Commit, then bound the commitment.</strong> 'I am going to assume single-region for now — if traffic is genuinely global, the queue choice changes and nothing else does' shows a decision <em>and</em> the shape of its blast radius, which is precisely the senior ambiguity signal." },
          { t: "note", variant: "key", html: "<strong>Senior here means deciding early and being explicit about what would change your mind.</strong> Prepare the applied fluency, prepare one bet that failed, and get the agenda from your recruiter rather than from folklore — including this page." }
        ]
      },

      /* --------------------------------------------- AIRBNB G8 --------------------------------------------- */
      {
        id: "airbnb-g8",
        title: "Airbnb G8 — the values round is a real round",
        summary: "A loop where a values-based conversation is commonly reported as a scored round in its own right, not a warm-up.",
        minutes: 9,
        tags: ["airbnb", "senior", "values"],
        blocks: [
          { t: "p", html: "The distinctive, consistently reported feature of this loop is that <strong>a values-based round is a real, scored round</strong> rather than the friendly ten minutes at the end. Candidates who treat it as small talk report it becoming the weakest part of their loop, which is an expensive way to learn that a conversation was an interview." },
          { t: "p", html: "Levels here are commonly described using a G-band ladder, with G8 broadly corresponding to senior scope. Treat that mapping as approximate — internal ladders are re-cut periodically and your recruiter is the only reliable source for the level you are being interviewed at." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Round types only. Counts and durations for this loop are not reliably reported and are not invented below." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Not reliably reported", "Call", "Level read against the G-band, motivation, and logistics"],
              ["Technical screen", "Not reliably reported", "Video call plus a shared editor", "Coding fluency and clarity while explaining"],
              ["Coding round(s)", "Not reliably reported", "Shared editor", "Correctness and readability; candidates commonly describe practical problems over exotic algorithms"],
              ["System or product design", "Not reliably reported", "Conversation, drawing surface", "Design reasoning with the user-facing consequence made explicit"],
              ["Values-based round", "Not reliably reported", "Conversation, no code", "Whether your stated values show up in decisions that cost you something"],
              ["Cross-functional / collaboration conversation", "Not reliably reported", "Conversation", "Working with product, design, and data partners whose priorities differ from yours"]
            ]
          },
          { t: "note", variant: "warn", html: "The values round is the reliably reported part. The rest of the sequence varies between accounts, so plan your preparation around round <em>types</em> and confirm the agenda before you build a schedule around it." },

          { t: "h", text: "The rubric" },
          { t: "p", html: "Rather than assert a named framework, work from what a values round is structurally doing. It is testing whether a stated value predicts your behaviour under cost — which is the same logic as any principle-driven loop, and <a href=\"#/story/playbooks/principle-based\">principle-based playbooks</a> is the general treatment worth reading alongside this." },
          {
            t: "table",
            headers: ["Tier", "What the answer sounds like", "Why it scores where it does"],
            rows: [
              ["Naive", "You restate the value fluently and say you agree with it", "Agreement is free, so it carries no information about you"],
              ["Naive", "You tell a story where the value happened to align with the easy choice", "Nothing was tested; the value did not have to hold against anything"],
              ["Solid", "You describe a decision where the value cost you time, scope, or a win", "The cost is the evidence — it proves the value binds when it is inconvenient"],
              ["Standout", "Same, plus what you would do differently, and where you think the value has genuine limits", "Shows you hold the value as judgement rather than as a slogan, which is what senior looks like"]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Values prompts framed as ordinary behavioural questions</strong> — a time you helped someone at your own expense, a shortcut you refused, a decision you made for a user against a metric.",
              "<strong>Cross-functional friction</strong> — a designer or product partner who wanted something you thought was wrong, and how it resolved.",
              "<strong>Practical coding</strong> — commonly described as closer to everyday engineering than to competitive puzzles, though this varies by round.",
              "<strong>Design with the user in the room</strong> — you are expected to name the human consequence of a technical choice, not only its latency profile."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>The values round has follow-ups.</strong> People prepare a warm anecdote and are unprepared for 'what did that cost?' and 'who disagreed?'. Both are standard, and both are where the round is actually scored.",
              "<strong>Cross-functional evidence is expected, not bonus.</strong> Stories where every participant is an engineer read as narrow in this loop in a way they might not elsewhere.",
              "<strong>What we do not reliably know about this loop.</strong> The number of rounds, their durations, the exact G-band boundaries, and whether the values round is scored on the same scale as the technical ones. Do not build a plan that depends on any of those."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Write three cost-bearing values stories.</strong> For each, name the value, the thing you gave up, and who was unhappy about it. A values story with no cost in it will not survive the first follow-up.",
              "<strong>Give each one a spine.</strong> <a href=\"#/story/catalog/story-anatomy\">Story anatomy</a> keeps them from sprawling — a values round rewards ninety seconds with a decision in it over four minutes of atmosphere.",
              "<strong>Audit your set for non-engineers.</strong> If no designer, product manager, data scientist, or support person appears in any story, build one where they do and where you were the one who changed position.",
              "<strong>Keep the coding practical.</strong> Codex-style pattern work is the floor; add practice on problems that look like real product code, with edge cases and readable naming.",
              "<strong>Avoid the standard failure modes.</strong> <a href=\"#/beh/delivery/pitfalls\">Common delivery pitfalls</a> covers the ones that hurt most here: the story with no conflict, the hero narrative, and the answer that never lands on a decision."
            ]
          },
          { t: "cue", html: "<strong>Lead a values answer with what you gave up.</strong> 'We pushed the launch by a week because the migration would have silently dropped a small number of bookings' opens with the cost — which is the only part of a values story that proves anything." },
          { t: "note", variant: "key", html: "<strong>A values round scores costs, not agreement.</strong> Bring three decisions where holding the line was expensive, and at least one story where the other person was not an engineer. <a href=\"#/loops/others/airbnb-g9\">The next level up</a> keeps this bar and adds leverage across teams." }
        ]
      },

      /* --------------------------------------------- AIRBNB G9 --------------------------------------------- */
      {
        id: "airbnb-g9",
        title: "Airbnb G9 — cross-functional leverage at senior scope",
        summary: "The same values emphasis, read against evidence that you moved outcomes across functions rather than inside one team.",
        minutes: 9,
        tags: ["airbnb", "staff", "cross-functional"],
        blocks: [
          { t: "p", html: "G9 is commonly described as the band above G8, in the senior-to-staff region of the ladder. As with every level mapping in this module, treat that as approximate and confirm it with your recruiter — the useful part is not the label but the <strong>scope of evidence</strong> the label implies." },
          { t: "p", html: "The mental model: at G8 you are proving you make good decisions with your values intact. At G9 you are proving that <strong>other functions changed what they did because of you</strong> — and that you did it without the authority to require it." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Round types again, with the same honesty about what is not known. The variation between accounts is wider at this level, which is a general pattern across companies rather than anything specific here." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Not reliably reported", "Call", "Whether your scope reads as one large team or as genuinely cross-functional"],
              ["Coding round(s)", "Not reliably reported", "Shared editor", "Still present and still scored; fluency expected rather than remarkable"],
              ["System or product design", "Not reliably reported", "Conversation, drawing surface", "Systems spanning teams, with the product consequence of each trade-off named"],
              ["Values-based round", "Not reliably reported", "Conversation, no code", "Values holding under organisational cost, not only personal cost"],
              ["Cross-functional leadership conversation", "Not reliably reported", "Conversation", "Influence across product, design, and data, with people who could have declined"],
              ["Hiring-manager conversation", "Not reliably reported", "Conversation", "Scope fit and what you would take on in the first two quarters"]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "No named framework asserted. What differentiates the levels in candidate accounts is consistent enough to calibrate against, and it is the same axis every senior ladder uses: whose behaviour changed." },
          {
            t: "table",
            headers: ["Dimension", "G8-shaped evidence", "G9-shaped evidence"],
            rows: [
              ["Technical scope", "You owned a significant service or surface end to end", "You changed how several teams build, and the change outlasted your involvement"],
              ["Values under pressure", "You paid a personal or team cost to hold the line", "You held it when the cost landed on the roadmap and someone senior was unhappy"],
              ["Cross-functional influence", "You collaborated well with product and design", "Product or design changed direction because of an argument you made, and you can name it"],
              ["Judgement", "You made a good call with the data available", "You made a call knowing it would be unpopular, and stated in advance what would prove you wrong"]
            ]
          },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Influence-without-authority prompts</strong> — a partner function you needed and could not compel.",
              "<strong>Values under organisational cost</strong> — the same values shapes as G8, but where the price was paid by a roadmap rather than by your weekend.",
              "<strong>Disagreement with someone more senior</strong> — <a href=\"#/story/catalog/conflict-growth\">conflict and growth</a> is the right place to build this set, because the naive version of this story sinks people.",
              "<strong>Design that spans functions</strong> — where the interesting constraint is organisational rather than technical."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>The values round gets harder, not softer, with seniority.</strong> The prompts stay simple, but the follow-ups push on cost and on who paid it, and 'I did the right thing' with no price attached lands badly at this level.",
              "<strong>Technical brilliance inside one team reads as the level below.</strong> This is the most common near-miss for senior candidates everywhere, and it is entirely fixable by picking different stories — <a href=\"#/beh/foundation/select\">story selection</a> is where to start.",
              "<strong>What we do not reliably know about this loop.</strong> The precise band boundaries, how many rounds run at this level, and whether the loop composition differs from the level below. Ask; do not infer."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Find the three stories where another function changed course.</strong> Not 'we collaborated well' — an actual change of direction you can attribute to a specific argument you made.",
              "<strong>Attach an organisational cost to each values story.</strong> At this level the cost has to have landed on something bigger than you: a slipped commitment, a cut feature, a team that had to redo work.",
              "<strong>Prepare the disagreement-with-a-senior-person story carefully.</strong> It needs a real disagreement, a real resolution, and a relationship that survived. All three, or it reads as either a grudge or a fabrication.",
              "<strong>Keep a running log rather than reconstructing later.</strong> <a href=\"#/story/catalog/journaling\">Journaling for stories</a> is the difference between remembering that something went well and remembering the number attached to it.",
              "<strong>Calibrate the bar across companies.</strong> <a href=\"#/story/playbooks/big-tech\">The big-tech playbook</a> is a useful cross-check, because senior scope is defined similarly enough across companies to be worth borrowing."
            ]
          },
          { t: "cue", html: "<strong>Name the person who could have refused.</strong> 'The design lead had already committed to the other approach publicly, and changed it after I showed the drop-off data' is cross-functional influence. 'We aligned as a group' is a sentence with nobody in it." },
          { t: "note", variant: "key", html: "<strong>G9 evidence lives outside engineering.</strong> Three stories where another function changed course, values that cost the roadmap rather than your evening, and one disagreement with a senior person that ended with the relationship intact." }
        ]
      },

      /* ----------------------------------------- MICROSOFT SENIOR ----------------------------------------- */
      {
        id: "microsoft-senior",
        title: "Microsoft senior — design depth plus behavioural depth",
        summary: "A loop commonly reported to weight system design and behavioural evidence at the same senior scope — and the closing lesson for the whole playbook module.",
        minutes: 11,
        tags: ["microsoft", "senior", "design", "wrap-up"],
        blocks: [
          { t: "p", html: "The pattern candidates most consistently describe for a senior loop here is a <strong>balanced one</strong>: real system design depth, real coding, and a behavioural component that is expected to operate at the same scope as the design round. The failure mode this produces is specific and common — a candidate designs like a senior engineer and then tells mid-level stories, and the panel notices the mismatch." },
          { t: "p", html: "Senior is commonly reported to sit in the low-60s region of an internal numeric ladder. Treat any specific number you read as approximate, including that one; the level you are actually being interviewed at is a recruiter question, not a forum question." },

          { t: "h", text: "The loop, round by round" },
          { t: "p", html: "Round types, not a schedule. Loop composition here is commonly reported to vary substantially between organisations within the company, which makes second-hand agendas even less reliable than usual." },
          {
            t: "table",
            headers: ["Round", "Length", "Format & tooling", "What it's scored on"],
            rows: [
              ["Recruiter conversation", "Not reliably reported", "Call", "Level calibration and which organisation you are being routed to"],
              ["Technical screen", "Not reliably reported", "Video call plus a shared editor", "Coding fluency and communication"],
              ["Coding round(s)", "Not reliably reported", "Shared editor", "Correctness, edge cases, and the quality of your questions before you start typing"],
              ["System design", "Not reliably reported", "Conversation, drawing surface", "Depth over breadth — commonly described as pushing hard on one or two areas rather than surveying the whole diagram"],
              ["Behavioural / leadership conversation", "Not reliably reported", "Conversation, no code", "Senior-scope ownership, influence, and disagreement handled well"],
              ["Final conversation with a senior decision-maker", "Not reliably reported", "Conversation", "A whole-loop read. Many candidates describe a late round with someone able to weigh the full picture; the internal name for that role varies and is not worth memorising"]
            ]
          },

          { t: "h", text: "The rubric" },
          { t: "p", html: "No named framework asserted here either. What is stable across accounts is the <em>consistency</em> requirement: your design answers and your stories are read together, and a gap between them is treated as evidence about the weaker one." },
          {
            t: "table",
            headers: ["What the panel compares", "Consistent senior signal", "The mismatch that costs you the level"],
            rows: [
              ["Design scope vs story scope", "You design across services and your stories involve decisions across services", "Multi-service design paired with stories about tasks you were assigned"],
              ["Depth under pressure", "You go three questions deep on your own choices without becoming defensive", "Breadth that evaporates on the second follow-up"],
              ["Disagreement", "A real disagreement, resolved, relationship intact", "No disagreement anywhere in the loop, which reads as either avoidance or selection"],
              ["Ownership", "You name what you personally decided, including the wrong calls", "Consistent use of 'we' with no attributable decision inside it"]
            ]
          },
          { t: "p", html: "The trade-off worth naming out loud in the design round: depth costs coverage. If you spend twenty minutes on the storage layer you will not tour the whole system, and that is usually the right choice here — but say you are making it, so a shallow tour is never mistaken for the alternative. <a href=\"#/beh/foundation/how-evaluated\">How the round is scored</a> covers why the stated choice earns credit that the silent one does not." },

          { t: "h", text: "Question types most commonly reported" },
          {
            t: "ul", items: [
              "<strong>Design with an aggressive deep dive</strong> — expect to be taken into one component and questioned past the point where most preparation stops.",
              "<strong>Standard senior behavioural shapes</strong> — ambiguity, influence, failure, disagreement, and a decision you would now make differently.",
              "<strong>Coding with edge-case emphasis</strong> — commonly described as caring more about the cases you spot unprompted than about exotic optimality.",
              "<strong>Motivation and fit</strong> — why this organisation and this product area specifically, which is asked more directly here than in some other loops."
            ]
          },

          { t: "h", text: "What candidates find surprising" },
          {
            t: "ul", items: [
              "<strong>Depth beats coverage, and candidates optimise for the wrong one.</strong> People rehearse the twelve-box diagram and get taken into one box for twenty minutes. Practise being interrogated on a single component.",
              "<strong>The behavioural round is level-defining.</strong> Mid-level stories after a senior design round are one of the most commonly reported causes of a down-level, precisely because the panel reads the loop as one document.",
              "<strong>What we do not reliably know about this loop.</strong> Round counts, durations, how loop composition varies between organisations, and the exact level mapping. As everywhere in this module, that is a recruiter question."
            ]
          },

          { t: "h", text: "Prep strategy that actually works for this loop" },
          {
            t: "ol", items: [
              "<strong>Rehearse depth, not tours.</strong> Take one design you know well and have someone question a single component for fifteen minutes. Blueprint has the design content; what this loop adds is the ability to keep going after your prepared material runs out.",
              "<strong>Level-match your stories to your designs.</strong> List the systems you would claim to design, then check that each has a matching story where you made the decision. Any design without a matching story is a mismatch waiting to be found.",
              "<strong>Build the disagreement story properly.</strong> A real one, with a resolution and a surviving relationship. Loops that contain no disagreement anywhere are read as selected rather than smooth.",
              "<strong>Check your coverage before you rehearse.</strong> <a href=\"#/story/catalog/coverage-matrix\">The coverage matrix</a> takes twenty minutes and finds the hole you would otherwise discover in the room.",
              "<strong>Run mocks that push past comfort.</strong> <a href=\"#/story/playbooks/mock-drills\">Mock drills</a> covers how to brief a partner to keep asking 'why?' until you actually run out — which is the specific pressure this loop applies."
            ]
          },

          { t: "h", text: "How to use this whole module" },
          { t: "p", html: "These playbooks are not meant to be read end to end the night before a loop. They are a reference, and the reference has three moves in it." },
          {
            t: "ol", items: [
              "<strong>Find your loop, or the nearest shape to it.</strong> If your company is not here, pick the lesson whose round mix looks closest. Round types recur across the industry even when company names do not — a values round is a values round, an applied coding round is an applied coding round.",
              "<strong>Get the real agenda and map each round to a lesson.</strong> Ask your recruiter for the round list, then map each one onto the lesson that explains what that round type is scoring. A design round maps to the design paragraphs in <a href=\"#/loops/google/google-l5\">the senior Google lesson</a> or this one; an applied round maps to <a href=\"#/loops/others/openai-l4\">the applied coding lesson</a>; a values round maps to <a href=\"#/loops/others/airbnb-g8\">the values lesson</a>.",
              "<strong>Then rehearse — out loud, timed, against those specific rounds.</strong> Reading these pages again is the comfortable option and does almost nothing. <a href=\"#/beh/advanced/practicing\">How to practise properly</a> is the last content you need before the loop itself."
            ]
          },
          { t: "p", html: "And keep the shape of the pipeline in view after the loop ends. Where committee review and team matching exist, the loop is one gate among several, and the same evidence that scores well in the room is what survives into the packet. When an offer does arrive, <a href=\"#/offer/anatomy/components\">the anatomy of an offer</a>, <a href=\"#/offer/execution/counter-scripts\">counter scripts</a>, <a href=\"#/offer/execution/mistakes\">the standard negotiation mistakes</a>, and <a href=\"#/offer/close/accept-decline\">accepting or declining cleanly</a> pick the story up from there." },
          { t: "cue", html: "<strong>Before any loop, answer three questions in writing.</strong> What are my rounds? What is each one scoring? Which of my stories am I spending on each? A candidate who can answer those has done more useful preparation than one who has read every playbook here twice." },
          { t: "note", variant: "key", html: "<strong>Loops differ; round types repeat.</strong> Get the agenda, map each round to what it scores, match your story scope to the level you are claiming, and rehearse out loud. Everywhere the reporting is thin — which is most places — prepare the transferable version and ask your recruiter for the rest." },
          { t: "quiz", id: "loops-others" }
        ]
      }
    ]
  };

  /* =================================================================
     TRACK REGISTRATION — order-independent, push only.
     The sibling file owns name / short / color / blurb and the
     meta + amazon modules. Never plain-assign window.TRACKS.loops.
     ================================================================= */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.loops || (window.TRACKS.loops = { id: "loops", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MODULE_GOOGLE, MODULE_OTHERS);
})();
