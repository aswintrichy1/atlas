/* =====================================================================
   CODEX · AI-Enabled Coding — core modules
   window.TRACKS.aiec  ·  modules: overview, fundamentals

   The interview round where you build a small real feature with an AI
   pair programmer in the room. What is scored is judgment and control,
   not recall. Through-line: judgment is the deliverable.

   Self-contained: registers its own widgets and quizzes. Sibling files
   add further modules to the same track, so every shared namespace is
   MERGED, never reassigned.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     DOM helper (local to this file — ES5 safe, no dependencies)
     ================================================================= */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var k, i, kid;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (attrs[k] == null) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function clear(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
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

  /* one readout cell: label + big value */
  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  /* =================================================================
     WIDGET 1 — aiecGranularity  ·  Prompt granularity lab
     -----------------------------------------------------------------
     Four ask sizes. Every per-ask figure is monotonic in the ask size
     (lines up, review cost up, round-trips up, number of asks down),
     but the TOTAL cost of shipping one fixed ~600-line feature is
     U-shaped: both ends are expensive and the middle two win.
     Fully deterministic — no randomness, no timers.
     ================================================================= */
  var FEATURE_LINES = 600;   /* the fixed feature we price every strategy against */
  var MIN_PER_ASK = 0.7;     /* writing the prompt + waiting for it, in minutes */

  var SCOPES = [
    {
      label: "one line",
      chunk: 2,
      reviewMin: 12,
      reworkMin: 4,
      trips: 0,
      verdict: "reviewable — but you are now slower than just typing it"
    },
    {
      label: "one function",
      chunk: 18,
      reviewMin: 21,
      reworkMin: 9,
      trips: 1,
      verdict: "sweet spot — one diff you can read, one assertion that proves it"
    },
    {
      label: "one file",
      chunk: 120,
      reviewMin: 42,
      reworkMin: 30,
      trips: 3,
      verdict: "still reviewable if you actually read it — good for scaffolding"
    },
    {
      label: "whole feature",
      chunk: FEATURE_LINES,
      reviewMin: 78,
      reworkMin: 95,
      trips: 7,
      verdict: "unreviewable — you own bugs you never read"
    }
  ];

  function costOf(s) {
    var asks = Math.ceil(FEATURE_LINES / s.chunk);
    var turnMin = Math.round(asks * MIN_PER_ASK);
    return {
      asks: asks,
      turnMin: turnMin,
      total: turnMin + s.reviewMin + s.reworkMin
    };
  }

  var Widgets = {};

  Widgets.aiecGranularity = function (mount) {
    shell(mount, "trade-off lab", "Prompt granularity lab",
      "Pick the size of one ask. Every per-ask number rises with the ask size — but the total cost of shipping one fixed feature is U-shaped, and the cheapest strategies are the two in the middle.");

    var stage = h("div", { class: "w-stage" });
    var segWrap = h("div", { class: "w-seg" });
    var chart = h("div", { style: "margin-top:18px" });
    var readout = h("div", { class: "w-readout" });
    var picked = 1; /* start on the sweet spot so the readout is never empty */

    /* precompute so the bar chart scale is stable across clicks */
    var costs = [];
    var maxTotal = 1;
    var cheapest = 0;
    var i;
    for (i = 0; i < SCOPES.length; i++) {
      costs.push(costOf(SCOPES[i]));
      if (costs[i].total > maxTotal) maxTotal = costs[i].total;
      if (costs[i].total < costs[cheapest].total) cheapest = i;
    }

    function paintChart() {
      clear(chart);
      chart.appendChild(h("div", {
        class: "widget-desc",
        style: "margin:0 0 8px"
      }, "total minutes to ship one ~" + FEATURE_LINES + "-line feature at each ask size"));

      for (var j = 0; j < SCOPES.length; j++) {
        var c = costs[j];
        var on = j === picked;
        var pct = Math.max(6, Math.round((c.total / maxTotal) * 100));
        var row = h("div", {
          style: "display:flex;align-items:center;gap:10px;margin:6px 0;font-size:0.78rem;" +
                 (on ? "" : "opacity:0.55")
        });
        row.appendChild(h("span", {
          style: "flex:0 0 96px;font-weight:600;" + (on ? "color:var(--accent-ink)" : "")
        }, SCOPES[j].label));
        var track = h("div", {
          style: "flex:1;height:12px;border-radius:6px;background:var(--surface-solid);overflow:hidden"
        });
        track.appendChild(h("div", {
          style: "height:100%;width:" + pct + "%;border-radius:6px;background:" +
                 (on ? "var(--accent)" : "var(--text-dim)")
        }));
        row.appendChild(track);
        row.appendChild(h("span", {
          style: "flex:0 0 92px;text-align:right;font-family:var(--font-mono)"
        }, c.total + " min" + (j === cheapest ? "  ★" : "")));
        chart.appendChild(row);
      }
    }

    function paintReadout() {
      var s = SCOPES[picked];
      var c = costs[picked];
      clear(readout);
      readout.appendChild(ro("lines generated per ask", s.chunk));
      readout.appendChild(ro("review cost", s.reviewMin + " min"));
      readout.appendChild(ro("round-trips to correct", s.trips));
      readout.appendChild(ro("asks to ship the feature", c.asks));
      readout.appendChild(ro("total cost", c.total + " min"));
      readout.appendChild(h("span", { class: "ro", style: "flex:1 1 100%" },
        "verdict ", h("b", {}, s.verdict)));
    }

    function pick(idx) {
      picked = idx;
      var btns = segWrap.querySelectorAll(".w-seg-btn");
      for (var j = 0; j < btns.length; j++) {
        if (j === idx) btns[j].classList.add("active");
        else btns[j].classList.remove("active");
      }
      paintChart();
      paintReadout();
    }

    (function buildSeg() {
      for (var j = 0; j < SCOPES.length; j++) {
        (function (idx) {
          segWrap.appendChild(h("button", {
            class: "w-seg-btn" + (idx === picked ? " active" : ""),
            type: "button",
            onclick: function () { pick(idx); }
          }, SCOPES[idx].label));
        })(j);
      }
    })();

    stage.appendChild(segWrap);
    stage.appendChild(chart);
    stage.appendChild(readout);
    mount.appendChild(stage);

    paintChart();
    paintReadout();
  };

  /* =================================================================
     WIDGET 2 — aiecVerifyDrill  ·  Spot the subtle bug
     -----------------------------------------------------------------
     Three snippets of plausible generated code, each with one real
     defect and two plausible non-defects. Deterministic, no timers.
     ================================================================= */
  var SNIPPETS = [
    {
      caption: "Asked for: “longest run of items whose sum stays within limit”",
      code:
        "function longestWithin(nums, limit) {\n" +
        "  var lo = 0, sum = 0, best = 0;\n" +
        "  for (var hi = 0; hi < nums.length; hi++) {\n" +
        "    sum += nums[hi];\n" +
        "    while (sum > limit) { sum -= nums[lo]; lo++; }\n" +
        "    best = Math.max(best, hi - lo);\n" +
        "  }\n" +
        "  return best;\n" +
        "}",
      options: [
        "The inner while can run past the end of the array",
        "sum is never reset, so it grows without bound",
        "The window length is hi - lo, one short of the real length"
      ],
      answer: 2,
      why: "An inclusive window [lo, hi] holds hi - lo + 1 items, so every answer is one too small — and it still looks plausible on most inputs. The fix is one character; catching it needs an assertion on an input whose whole array fits inside the limit.",
      wrong: [
        "sum is maintained correctly: it gains the entering item and loses the leaving ones, which is the whole point of the shrink loop.",
        "The inner loop cannot run off the end: it stops as soon as sum fits, and in the worst case it removes every item that was added, at which point sum is back to 0."
      ]
    },
    {
      caption: "Asked for: “return the top n scores, highest first”",
      code:
        "function topScores(scores, n) {\n" +
        "  scores.sort(function (a, b) { return b - a; });\n" +
        "  return scores.slice(0, n);\n" +
        "}",
      options: [
        "sort reorders the caller's array — the input is destroyed",
        "b - a sorts ascending, so it returns the lowest scores",
        "slice(0, n) drops an element when n equals the length"
      ],
      answer: 0,
      why: "Array sort works in place, so this quietly reorders whatever the caller passed in. The returned value is right, which is exactly why it survives review — the damage shows up later, in unrelated code that depended on the original order.",
      wrong: [
        "b - a is correct for descending order: it is positive when b is larger, which sorts b earlier.",
        "slice(0, n) with n equal to the length returns the whole array; slice clamps rather than dropping."
      ]
    },
    {
      caption: "Asked for: “urgent tasks first, then earliest due date”",
      code:
        "tasks.sort(function (a, b) {\n" +
        "  if (a.urgent) return -1;\n" +
        "  if (b.urgent) return 1;\n" +
        "  return a.due - b.due;\n" +
        "});",
      options: [
        "a.due - b.due returns 0 for equal dates, which sort treats as an error",
        "When both tasks are urgent, the comparator claims each is smaller than the other",
        "Non-urgent tasks never reach the due-date comparison"
      ],
      answer: 1,
      why: "If a and b are both urgent, compare(a, b) returns -1 and compare(b, a) also returns -1 — the comparator contradicts itself, so the resulting order is undefined and engine-dependent. Urgent tasks are not sorted by due date at all, and the bug hides completely whenever at most one task is urgent.",
      wrong: [
        "Returning 0 for equal keys is exactly what a comparator should do — it means “no preference”.",
        "Non-urgent pairs fall through both guards and do reach a.due - b.due; that branch is fine."
      ]
    }
  ];

  Widgets.aiecVerifyDrill = function (mount) {
    shell(mount, "review drill", "Spot the subtle bug",
      "Three snippets a model will happily hand you. Each runs, each looks reasonable, each has exactly one real defect. Name it before you read the answer.");

    var stage = h("div", { class: "w-stage" });
    var caption = h("p", { class: "widget-desc", style: "margin:0 0 10px" });
    var pre = h("pre", { style: "margin:0;overflow-x:auto;font-size:0.8rem" });
    var opts = h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-top:14px" });
    var nav = h("div", { style: "display:flex;gap:10px;margin-top:14px" });
    var readout = h("div", { class: "w-readout" });

    var idx = 0;
    var answered = [false, false, false];
    var correct = [false, false, false];

    function score() {
      var got = 0, seen = 0, j;
      for (j = 0; j < answered.length; j++) {
        if (answered[j]) seen++;
        if (correct[j]) got++;
      }
      return { got: got, seen: seen };
    }

    function paintReadout(pickedIdx) {
      var s = SNIPPETS[idx];
      var sc = score();
      clear(readout);
      readout.appendChild(ro("snippet", (idx + 1) + " / " + SNIPPETS.length));
      readout.appendChild(ro("identified", sc.got + " / " + sc.seen + " attempted"));

      if (pickedIdx == null) {
        readout.appendChild(h("span", { class: "ro", style: "flex:1 1 100%" },
          "status ", h("b", {}, "pick the defect — one of the three is real")));
        return;
      }

      var right = pickedIdx === s.answer;
      readout.appendChild(h("span", { class: "ro", style: "flex:1 1 100%" },
        "verdict ", h("b", {}, right ? "correct" : "not this one")));
      readout.appendChild(h("span", { class: "ro", style: "flex:1 1 100%" },
        h("b", {}, right ? s.why : s.wrong[pickedIdx < s.answer ? pickedIdx : pickedIdx - 1])));
      if (!right) {
        readout.appendChild(h("span", { class: "ro", style: "flex:1 1 100%" },
          "the real defect ", h("b", {}, s.options[s.answer])));
        readout.appendChild(h("span", { class: "ro", style: "flex:1 1 100%" },
          h("b", {}, s.why)));
      }
    }

    function paintSnippet() {
      var s = SNIPPETS[idx];
      clear(caption);
      caption.appendChild(document.createTextNode(s.caption));
      clear(pre);
      pre.appendChild(document.createTextNode(s.code));
      clear(opts);
      for (var j = 0; j < s.options.length; j++) {
        (function (oi) {
          opts.appendChild(h("button", {
            class: "w-btn ghost",
            type: "button",
            style: "text-align:left",
            onclick: function () {
              answered[idx] = true;
              correct[idx] = oi === SNIPPETS[idx].answer;
              paintReadout(oi);
            }
          }, s.options[oi]));
        })(j);
      }
      paintReadout(null);
    }

    nav.appendChild(h("button", {
      class: "w-btn primary",
      type: "button",
      onclick: function () {
        idx = (idx + 1) % SNIPPETS.length;
        paintSnippet();
      }
    }, "Next snippet"));
    nav.appendChild(h("button", {
      class: "w-btn ghost",
      type: "button",
      onclick: function () {
        var j;
        for (j = 0; j < answered.length; j++) { answered[j] = false; correct[j] = false; }
        idx = 0;
        paintSnippet();
      }
    }, "Reset"));

    stage.appendChild(caption);
    stage.appendChild(pre);
    stage.appendChild(opts);
    stage.appendChild(nav);
    stage.appendChild(readout);
    mount.appendChild(stage);

    paintSnippet();
  };

  /* merge — never reassign: sibling files own other widgets */
  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES owned by this file
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "aiec-overview": {
      title: "The format checkpoint",
      sub: "What the round is, what it scores, and which variant you are walking into.",
      questions: [
        {
          q: "Which description best matches an AI-enabled coding round?",
          options: [
            "Implementing a machine-learning model from scratch",
            "Reviewing a pull request the interviewer wrote in advance",
            "Reciting algorithm templates faster than a model can generate them",
            "Building a small real feature while pair-programming with an AI assistant"
          ],
          answer: 3,
          explain: "The round hands you a small, usually under-specified feature and an assistant, then watches the decisions you make. It is not machine-learning work, and it is not the classic recall exercise with a tool bolted on. Recall and typing speed are the two things it deliberately stops rewarding."
        },
        {
          q: "Compared with a classic algorithms round, where does the bottleneck move?",
          options: [
            "To deciding what to build and confirming that it works",
            "To memorised templates, because the model expects exact algorithm names",
            "To typing speed, because you now type prompts as well as code",
            "To complexity analysis, which the assistant cannot do"
          ],
          answer: 0,
          explain: "In a classic round the limit is production — you know what to write and the clock is spent writing it. Here production is nearly free, so the cost shifts to the two ends of the work: choosing the slice and proving the result is right. Every habit worth practising for this format sits at one of those two ends."
        },
        {
          q: "Your feature works at the end of the session and you are still scored down. What is the most likely cause?",
          options: [
            "Problem-solving — your overall approach was unreasonable",
            "Verification — you accepted output as correct instead of confirming it",
            "Typing speed — the model produced code faster than you read it",
            "Algorithm knowledge — you never named the underlying pattern"
          ],
          answer: 1,
          explain: "Two of the four dimensions are about how the code got there, not whether it runs, so working code is not a passing score. Verification is where working-but-unproven sessions lose: “it ran once” is not evidence, and interviewers specifically watch for whether you tested the boundary and the invariant. A feature that works for reasons you cannot demonstrate reads as luck."
        },
        {
          q: "On the “control over the AI” dimension, which behaviour is the clearest strong signal?",
          options: [
            "Accepting the architecture proposed in the model's first reply and building on it",
            "Writing one very detailed prompt and letting it generate the whole feature",
            "Stating your own plan, then asking for one slice at a time and rejecting output that does not fit",
            "Avoiding the assistant entirely and hand-writing everything"
          ],
          answer: 2,
          explain: "Control means your strategy survives contact with the model's suggestions. Accepting its first framing is the textbook weak signal, and one giant prompt produces a diff you cannot review — both are riding, not driving. Refusing to use the tool at all is a different failure: it shows you cannot get leverage from it."
        },
        {
          q: "In the structured variant of this round, what should you expect?",
          options: [
            "Your own editor with your usual AI tooling",
            "A take-home you complete on your own schedule",
            "No AI assistance at all for the first half of the session",
            "An in-browser sandbox, a fixed problem, and often a deliberately weakened model"
          ],
          answer: 3,
          explain: "The structured variant runs in the interviewer's environment on a fixed problem, and the provided model is commonly weaker than what you use daily. That is not an accident — a weaker collaborator makes your control and verification habits visible. Practise expecting worse output than usual and compensating with smaller asks."
        },
        {
          q: "Why is it worth asking the recruiter which variant you will get?",
          options: [
            "Because the sandbox rewards small asks and hand-rolled checks, while the open-ended variant rewards your own tooling and test setup",
            "Because only the open-ended variant permits any AI use",
            "Because the two variants are scored against completely different rubrics",
            "Because the recruiter will usually give you the problem statement in advance"
          ],
          answer: 0,
          explain: "The rubric is the same in both, but the preparation is not. A locked-down sandbox with no test runner needs practice writing inline assertions and shrinking your asks; an open-ended session rewards a fast test loop and a familiar editor. Asking is a normal logistics question and costs you nothing."
        },
        {
          q: "Why have employers started adding this round?",
          options: [
            "Because AI assistants have made classic algorithm screens harder to pass",
            "Because it resembles how the work is actually done now, and a classic screen separates candidates less well than it used to",
            "Because it is cheaper to grade automatically",
            "Because most teams now need machine-learning fundamentals"
          ],
          answer: 1,
          explain: "Assistants are part of the normal working loop, so a round with no assistant tests a version of the job that has largely gone away. At the same time, a screen a model can pass tells you less about the person sitting in front of it. This format also surfaces a failure mode teams care about: handing a model too much and being unable to explain the result."
        }
      ]
    },

    "aiec-fundamentals": {
      title: "Judgment is the deliverable — checkpoint",
      sub: "Orientation, planning, ask granularity, verification, and narration under a clock.",
      questions: [
        {
          q: "You are dropped into an unfamiliar repo with a 60-minute clock. What should you do first?",
          options: [
            "Prompt for the whole feature immediately, since the clock is the binding constraint",
            "Read every file top to bottom before writing anything",
            "Find the entry point, the data model, the test layout and the run command",
            "Ask the model to restructure the project into a layout you recognise"
          ],
          answer: 2,
          explain: "Every prompt you write before you know the data model is a guess, and guesses cost more than the orientation they skipped. Four targeted questions — entry point, data model, tests, run command — take a few minutes and make the rest of your asks specific. Reading everything is the opposite failure: thorough, unbounded, and it never finishes."
        },
        {
          q: "The model gives you a confident summary of how a request flows through the repo. What is the right next move?",
          options: [
            "Accept it — summarising existing code is something models are reliably good at",
            "Ask for the summary again and compare the two answers",
            "Discard it, because model summaries of unfamiliar code are never useful",
            "Open one file it named and check a claim you can falsify in seconds"
          ],
          answer: 3,
          explain: "Models describe the repo they expect rather than the one you have, and the plausible-sounding parts are the dangerous ones. One cheap falsification — open a named file, confirm a named function exists — tells you whether to trust the rest. Re-asking only buys you a second correlated guess, and discarding the summary throws away a real speed-up."
        },
        {
          q: "Prompting at the “whole feature” scope typically costs you what?",
          options: [
            "A diff too large to review, which means you own defects you never read",
            "Only wall-clock time, because generating that much takes longer",
            "Nothing, as long as the feature works when you run it",
            "Access to the model's stronger reasoning, which needs short inputs"
          ],
          answer: 0,
          explain: "The cost of a coarse ask is not generation time, it is review debt: you accept hundreds of lines you did not read and cannot defend. Interviewers probe exactly there, and the defects that survive are the subtle ones a skim never catches. Middle-sized asks win because the diff still fits in your head."
        },
        {
          q: "Which of these should you usually hand-write rather than prompt?",
          options: [
            "Repetitive boilerplate such as fixtures and config objects",
            "The load-bearing logic you will be asked to defend",
            "A mechanical rename or reshape across one file",
            "The call shape for an API you have not used before"
          ],
          answer: 1,
          explain: "Delegate work whose correct answer is fully determined by the input — boilerplate and mechanical transforms — because reviewing it is just reading a diff. Unfamiliar API shapes are worth prompting too, as long as you verify them, since that is faster than hunting through docs. Hand-write the logic you will have to justify: you cannot defend reasoning you never did."
        },
        {
          q: "The model returns roughly 200 lines that are wrong in a way you do not understand. Best response?",
          options: [
            "Debug it line by line — you need to know why it failed",
            "Ask it to fix its own output using the same prompt",
            "Revert, narrow the ask to one slice, and add the constraint it violated",
            "Keep it and write tests around the parts that look correct"
          ],
          answer: 2,
          explain: "Debugging code you did not write and did not want is the most expensive way to spend interview minutes, and re-prompting identically tends to reproduce the same misunderstanding. Reverting costs you nothing you valued, and the narrowed re-ask plus an explicit constraint usually lands first try. Saying this out loud also scores: it shows cost judgment rather than attachment to sunk work."
        },
        {
          q: "You are in a restrictive sandbox with no test runner and no way to install one. How do you verify?",
          options: [
            "You cannot; explain to the interviewer that verification is not possible here",
            "Read the code carefully instead, since assertions need a framework",
            "Ask the model to confirm that its code is correct",
            "Write a few inline assertions and a small entry point that prints expected against actual"
          ],
          answer: 3,
          explain: "A dozen lines of hand-rolled equality checks plus one entry point gives you real evidence, and no framework is required. Asking the model to grade itself is not verification — it is the same source of error twice. Careful reading is worth doing, but it is the check that subtle defects like off-by-ones and quiet mutations survive."
        },
        {
          q: "Why does “types are the cheapest tests you will ever write” matter in this format?",
          options: [
            "Because precise types make a whole class of wrong generations fail immediately instead of silently",
            "Because typed code is generated faster",
            "Because interviewers score type annotations directly",
            "Because good types remove the need for boundary tests"
          ],
          answer: 0,
          explain: "A loose signature can be satisfied by almost anything, so wrong output still type-checks and you find out at runtime or never. Tightening the shape — a discriminated union instead of a bare string, cents instead of a number — turns several likely misunderstandings into instant errors. It is not a substitute for boundary tests; it is the cheap filter that runs before them."
        },
        {
          q: "The model is generating and you have several seconds of silence. What is the best use of it?",
          options: [
            "Wait quietly so you can read the output the moment it lands",
            "Say what you will check next and write the assertion you are about to run",
            "Start a second prompt in parallel to save time",
            "Ask the interviewer whether your approach is the one they wanted"
          ],
          answer: 1,
          explain: "Silence during generation is unscored time, and it is the easiest airtime you will ever get because you are not doing anything else with it. Stating your next check and writing the assertion ahead of the output means you review with a hypothesis instead of skimming. Running a second prompt in parallel just creates two diffs you have not read."
        }
      ]
    }
  });

  /* =================================================================
     MODULES owned by this file
     ================================================================= */
  var MY_MODULES = [

    /* =============================================================
       MODULE 1 — The Format
       ============================================================= */
    {
      id: "overview",
      name: "The Format",
      icon: "compass",
      lessons: [

        /* ---------- 1 · format ---------- */
        {
          id: "format",
          title: "What an AI-enabled coding round actually is",
          summary: "A small real feature, an AI assistant already open, and a rubric that scores judgment instead of recall.",
          minutes: 8,
          tags: ["format", "expectations"],
          blocks: [
            { t: "p", html: "An <strong>AI-enabled coding round</strong> sits you in front of a small, real piece of software with an AI assistant already open. You are not asked to reproduce an algorithm. You are asked to make something work, alongside a collaborator that types faster than you and is wrong often enough to matter. The round is a test of <strong>judgment and control</strong>: what you chose to build, what you refused to accept, and how you proved the result." },
            { t: "p", html: "Two things it is not. It is <em>not</em> machine-learning coding — nobody is asking you to train anything. And it is <em>not</em> the classic “write a correct algorithm from memory” exercise with a tool bolted on the side. If you walk in planning to out-type the model, you have already misread the round." },
            { t: "note", variant: "tip", html: "<strong>This track builds on the other three, it does not replace them.</strong> The algorithmic judgement still has to be there — you cannot direct a model toward <a href='#/cpat/graphs/dijkstra'>the right shortest-path algorithm</a> if you could not have named it yourself. What changes is where that judgement shows up: in <a href='#/patterns/mastery/choose-pattern'>recognising the family</a> and in catching the plausible-looking code that gets the family wrong, rather than in typing the implementation." },

            { t: "h", text: "What changes when the model is in the room" },
            { t: "table",
              headers: ["What used to carry you", "What it is worth now", "Why"],
              rows: [
                ["Recall of algorithm templates", "Close to nothing", "The assistant produces a passable template in seconds, so knowing it first buys you no time"],
                ["Typing speed", "Close to nothing", "Generation outruns any human, and the clock is no longer spent typing"],
                ["Reading code quickly", "Much more", "You now review more lines per minute than you write, and you own every line you accept"],
                ["Deciding what to build", "The main event", "The brief is usually under-specified on purpose — choosing the slice <em>is</em> the work"],
                ["Confirming it works", "The main event", "Output that looks right is the default failure mode of this format"]
              ]
            },
            { t: "p", html: "In a classic round the bottleneck is <strong>production</strong>: you know what to write and the limit is how fast you can write it correctly. Here production is nearly free, so the bottleneck moves to the two ends — <strong>deciding what to build</strong> and <strong>confirming that it works</strong>. Everything else in this track is about those two ends." },

            { t: "stat", items: [
              { v: "45–90 min", k: "typical session length" },
              { v: "1 feature", k: "not one puzzle" },
              { v: "most", k: "of your time reading, not typing" }
            ] },

            { t: "h", text: "Why employers added it" },
            { t: "ul", items: [
              "<strong>The job changed.</strong> Most professional code is now written with an assistant in the loop, so a round with no assistant tests a version of the job that has largely gone away.",
              "<strong>The old screen stopped separating people.</strong> When a model can pass a standard algorithms screen, a passing score says less about the candidate than it used to.",
              "<strong>It is closer to a work sample.</strong> Ship a small feature in a real repo and the interviewer sees the behaviour they will actually be managing.",
              "<strong>It surfaces an expensive failure mode.</strong> Plenty of otherwise strong candidates hand a model too much and cannot explain the result. On a real team that is costly, and this format finds it in an hour."
            ] },
            { t: "note", variant: "tip", html: "The most useful reframe: you are not being interviewed as a coder holding a tool. You are being interviewed as the <strong>tech lead of one very fast, very confident, slightly unreliable junior</strong> — for an hour, with the entire review burden on you." },

            { t: "h", text: "The shape of a session" },
            { t: "ol", items: [
              "<strong>Read the brief.</strong> What is actually asked, and what has been left unspecified on purpose.",
              "<strong>Orient in the code.</strong> Entry point, data model, tests, run command — before any prompt.",
              "<strong>State a plan out loud.</strong> Two or three slices you can verify independently.",
              "<strong>Delegate one slice.</strong> Sized so you can read the whole diff without losing the thread.",
              "<strong>Verify it.</strong> Run something, assert something, then move.",
              "<strong>Integrate and repeat.</strong> The code runs at every checkpoint, never only at the end.",
              "<strong>Narrate throughout.</strong> Reasoning you do not say out loud does not get scored."
            ] },
            { t: "p", html: "The cost is real and it feels wrong in the moment. Orientation and planning eat the first five to ten minutes of a fixed clock, and during those minutes you produce no visible code while somebody watches. What you buy is the ability to <em>review</em> and <em>defend</em> everything that lands afterwards. Candidates who spend that time typing instead usually arrive at minute forty with more code and less understanding, which scores worse rather than better." },

            { t: "cue", html: "<b>Say this at minute one:</b> “Before I prompt anything, give me two minutes to find the entry point, the data model, and how the tests run — then I will talk you through a plan with slices I can verify separately.” It costs nothing, it sets the pace, and it signals that the assistant is a tool you are about to use rather than a thing about to happen to you." },
            { t: "note", variant: "key", html: "<strong>Judgment is the deliverable.</strong> Producing code is cheap now; deciding what deserves to exist is not. This round scores what you decided to build, what you declined to accept, and how you proved it works — not how much code appeared on the screen." }
          ]
        },

        /* ---------- 2 · evaluation ---------- */
        {
          id: "evaluation",
          title: "The four things being scored",
          summary: "Approach, control over the AI, verification habits, and communication — with the weak and strong signal for each.",
          minutes: 9,
          tags: ["rubric", "signals"],
          blocks: [
            { t: "p", html: "Four dimensions, scored more or less independently. That independence is the part candidates miss: you can finish the feature, watch it work, and still fail the round — because two of the four are about <em>how</em> the code got there, not whether it runs." },
            { t: "p", html: "The four are <strong>problem-solving and approach</strong>, <strong>control over the AI</strong>, <strong>verification habits</strong>, and <strong>communication</strong>. Read the table below as the thing an interviewer is actually holding while they watch you." },

            { t: "h", text: "The rubric, concretely" },
            { t: "table",
              headers: ["Dimension", "Weak signal", "Strong signal"],
              rows: [
                ["Problem-solving &amp; approach", "Starts prompting before the problem is bounded; no plan stated; scope drifts wherever the model points", "Bounds the problem out loud, names the slices, orders them deliberately, and revises the plan when a slice turns out wrong"],
                ["Control over the AI", "Adopts the framing in the model's first reply; asks for the whole feature at once; cannot say which lines it generated", "Leads with their own strategy, asks for one reviewable slice at a time, rejects output that does not fit, hand-writes the load-bearing parts"],
                ["Verification habits", "Reads the output, says “looks right”, moves on; runs nothing until the end; treats “it compiles” as evidence", "Runs or asserts something after every slice; tests the boundary and the invariant; hunts specifically for the subtle defect"],
                ["Communication", "Silent while generating; narrates keystrokes instead of decisions; hides confusion until it is resolved", "States intent before prompting, uses generation time to say what comes next, says plainly when output is wrong and what will change"]
              ]
            },

            { t: "h2", text: "1 · Problem-solving and approach" },
            { t: "p", html: "Same skill as always, applied to a smaller and messier problem. The brief is under-specified on purpose, so the first decision is what “done” means. Pick a slice that is genuinely useful and genuinely verifiable, say why you picked it, and say what you are consciously leaving out. Ambiguity you resolve out loud reads as judgment; ambiguity you silently guess at reads as luck." },

            { t: "h2", text: "2 · Control over the AI" },
            { t: "p", html: "This is the dimension the round exists to measure, and it comes down to one question: <strong>do you direct the model, or does it direct you?</strong> Its first reply always contains a proposed architecture. That is a suggestion from something with no knowledge of your constraints, and treating it as a specification is the single most common weak signal in this format." },
            { t: "compare",
              bad: { title: "Riding", items: [
                "Builds on whatever structure the first reply invented",
                "Asks for the whole feature, then patches whatever comes back",
                "Cannot point at the load-bearing logic and explain why it is correct",
                "Keeps generated code because it is already there",
                "Scope follows the model's suggestions rather than the brief"
              ] },
              good: { title: "Driving", items: [
                "States a plan first, then asks for slices of that plan",
                "Sizes each ask so the whole diff can be read",
                "Hand-writes the parts they will have to defend",
                "Reverts freely — generated code is cheap and carries no sunk cost",
                "Says “not that — here is the shape I want” and re-asks with a constraint"
              ] }
            },

            { t: "h2", text: "3 · Verification habits" },
            { t: "p", html: "Generated code is a hypothesis. Verification is how you stop believing it and start knowing. Interviewers watch for whether anything gets run or asserted between slices, whether you test the boundary rather than only the happy path, and whether you look for the specific defect this kind of code tends to have. “I ran it once and it printed the right number” is a weak signal precisely because it is so easy to produce." },

            { t: "h2", text: "4 · Communication" },
            { t: "p", html: "Most of your reasoning in this format is invisible: it happens while you read a diff or decide to revert. If you do not narrate, the interviewer cannot score it, and an unscored dimension defaults to a low mark. Narration is also the cheapest of the four to improve — it needs no extra skill, only the habit of saying the decision instead of only making it." },
            { t: "note", variant: "trap", html: "<strong>The trap that fails strong engineers.</strong> A working feature with no evidence you know why it works. The interviewer's next question is “how do you know that is right?”, and “because it ran” is not an answer. Produce the evidence as you go, not in the last five minutes." },

            { t: "h", text: "How this scores at each level" },
            { t: "table",
              headers: ["Level", "Approach &amp; control", "Verification", "Communication"],
              rows: [
                ["Mid", "Follows a sensible plan; mostly directs the model but accepts its framing when unsure", "Runs the code; checks the happy path; tests when prompted to", "Explains what the code does when asked; goes quiet while generating"],
                ["Senior", "Bounds the problem, sequences slices, revises deliberately, hand-writes what matters", "Boundary and invariant covered as a matter of habit; finds at least one subtle defect", "States intent before each prompt; narrates the trade-off; says why output is being discarded"],
                ["Staff", "Frames the problem the interviewer did not fully specify, and defends the scope they cut", "Names the failure mode ahead of time and writes the assertion that would catch it", "Manages attention — flags what matters, compresses the routine, leaves a clear account of what is proven and what is assumed"]
              ]
            },
            { t: "cue", html: "<b>Sentences that earn credit out loud:</b> “Here is my plan, and here is the slice I am delegating first.” · “I am hand-writing this part because it is the bit I will have to defend.” · “That output is wrong in a way I do not want to debug — reverting and narrowing the ask.” · “Before I move on: empty input, and the boundary where the window is exactly full.”" },
            { t: "note", variant: "key", html: "<strong>Four dimensions, and working code only covers one of them.</strong> Control and verification are where sessions are actually won and lost — so make both audible. If you did not say it out loud, it did not happen." }
          ]
        },

        /* ---------- 3 · structured-vs-open ---------- */
        {
          id: "structured-vs-open",
          title: "Structured vs open-ended, and how prep differs",
          summary: "A locked-down sandbox with a weakened model, or your own editor and a real feature — same rubric, different preparation.",
          minutes: 9,
          tags: ["format", "preparation"],
          blocks: [
            { t: "p", html: "The round comes in two shapes. Same rubric, very different failure modes — and the preparation that helps in one is close to wasted in the other. Find out which one you are getting before you practise for it." },

            { t: "h", text: "Structured: their sandbox, their model" },
            { t: "p", html: "An in-browser environment, a fixed problem, and a provided assistant. Everything is instrumented, so the session is comparable across candidates — which is exactly why the environment is deliberately narrow." },
            { t: "ul", items: [
              "<strong>No tooling of your own.</strong> No editor config, no shortcuts, no extensions, and commonly no package installs.",
              "<strong>A fixed problem.</strong> Small, self-contained, and chosen so that a competent session finishes it.",
              "<strong>Often a weakened model.</strong> Smaller or older than what you use daily, sometimes with a shorter context window and no memory of earlier turns.",
              "<strong>Possibly no test runner.</strong> You may have nothing but a run button and whatever assertions you write yourself."
            ] },
            { t: "note", variant: "warn", html: "<strong>Expect the assistant to be worse than yours.</strong> A weaker collaborator is not a glitch — it is what makes your control and verification habits visible. Plan to compensate: smaller asks, more explicit constraints, and something checked after every step." },

            { t: "h", text: "Open-ended: your setup, a real feature" },
            { t: "p", html: "Your own editor and your own AI tooling, a repo you may or may not have seen before, and an instruction to ship something that works. This is much closer to a paid work sample, and the scope is correspondingly larger." },
            { t: "ul", items: [
              "<strong>Your stack.</strong> The editor, the assistant and the shortcuts you use every day — so fluency with your own tools is now part of the score.",
              "<strong>A real repo.</strong> Existing structure and conventions you are expected to respect rather than replace.",
              "<strong>Looser scope.</strong> “Add search”, “make this endpoint paginate” — the definition of done is partly yours to set and defend.",
              "<strong>A real test loop.</strong> You can install, run and iterate, which means there is no excuse for unverified code."
            ] },

            { t: "table",
              headers: ["Axis", "Structured sandbox", "Open-ended session"],
              rows: [
                ["Tooling", "Theirs, minimal, no installs", "Yours, whatever you normally run"],
                ["Problem", "Fixed and small", "Looser, scoped partly by you"],
                ["Assistant quality", "Commonly weaker than your daily model", "Whatever you bring"],
                ["Verification route", "Hand-rolled assertions, maybe no runner", "Real tests, real test command"],
                ["Dominant risk", "Fighting the environment and the model's limits", "Scope creep and an unreviewable diff"],
                ["Practise this", "Small asks, inline assert harnesses, reading unfamiliar code cold", "Fast test loop, orientation in a strange repo, defending scope cuts"]
              ]
            },

            { t: "h", text: "Ask which one you are getting" },
            { t: "p", html: "This is ordinary logistics, not a special favour, and recruiters answer it routinely — they would rather you arrive prepared than lose a candidate to a surprise environment. Send one short message and practise in the setup you will actually face." },
            { t: "code", lang: "text", code:
              "Quick logistics question about the AI-enabled coding round:\n" +
              "will I be working in your in-browser environment with an\n" +
              "assistant you provide, or in my own editor with my own tooling?\n" +
              "I would like to practise in the same setup.\n\n" +
              "If it is your environment: is there a test runner available,\n" +
              "and can I install packages?"
            },
            { t: "p", html: "The follow-up matters as much as the first question. “Is there a test runner?” tells you whether to spend an evening practising a hand-rolled assert harness, and “can I install packages?” tells you whether your usual first move is available at all." },

            { t: "compare",
              bad: { title: "Prepping the same way for both", items: [
                "Practising only in your own editor, then losing ten minutes to an unfamiliar sandbox",
                "Relying on a test framework that will not exist",
                "Rehearsing large asks that a weakened model cannot handle",
                "Assuming the assistant remembers what you said four turns ago"
              ] },
              good: { title: "Prepping for the format you will get", items: [
                "Doing at least one practice run in a bare browser editor with no shortcuts",
                "Writing a six-line assert harness from memory, twice",
                "Rehearsing asks at the one-function scale with explicit constraints",
                "Restating context in each prompt, so nothing depends on the model's memory"
              ] }
            },
            { t: "note", variant: "trap", html: "<strong>The most common structured-format mistake</strong> is bringing open-ended habits into the sandbox: one large ask, an assumption that context carries across turns, and a plan to “run the tests” that never existed. Shrink the ask, restate the constraints every time, and build your own way to check the answer." },

            { t: "note", variant: "key", html: "<strong>Same rubric, different terrain.</strong> Structured means a weaker model and no tooling, so compensate with smaller asks and hand-rolled checks. Open-ended means your stack and a looser scope, so compensate with a fast test loop and a scope you can defend. One message to the recruiter tells you which one to rehearse." },

            { t: "quiz", id: "aiec-overview" }
          ]
        }
      ]
    },

    /* =============================================================
       MODULE 2 — Judgment Is The Deliverable
       ============================================================= */
    {
      id: "fundamentals",
      name: "Judgment Is The Deliverable",
      icon: "bolt",
      lessons: [

        /* ---------- 4 · orientation ---------- */
        {
          id: "orientation",
          title: "Orient before you type",
          summary: "Four questions that make every later prompt specific — and how to use the model to orient without trusting what it tells you.",
          minutes: 9,
          tags: ["orientation", "codebase"],
          blocks: [
            { t: "p", html: "You are being dropped into somebody else's codebase with a clock running. The instinct is to start producing immediately. Resist it: every prompt you write before you know the data model is a <strong>guess dressed as progress</strong>, and guesses are more expensive than the orientation that would have prevented them." },
            { t: "p", html: "Orientation is not reading the repo. It is answering four specific questions, fast, and then stopping." },

            { t: "h", text: "The four-question sweep" },
            { t: "ol", items: [
              "<strong>Where does execution start?</strong> The entry point, the route table, the main handler — whatever the runtime hits first. This anchors everything else.",
              "<strong>What is the data model?</strong> The two or three types that flow through the system. Most subtly wrong generated code is wrong about a shape, so this is the highest-value question on the list.",
              "<strong>Where do tests live, and what do they look like?</strong> Existing tests are a free specification and a free style guide for the ones you are about to write.",
              "<strong>How do I run it?</strong> The build, the dev command, the test command. Run the suite <em>before</em> you touch anything, so you know whether a later red is yours."
            ] },
            { t: "code", lang: "bash", code:
              "# Sixty seconds of orientation beats ten minutes of guessing.\n" +
              "ls                              # top level: where does source actually live?\n" +
              "cat package.json                # scripts.test, scripts.dev — how do I run this?\n" +
              "ls src                          # entry point, routing, the obvious seams\n" +
              "find src -name '*.test.*' | head   # do tests exist, and in what style?\n" +
              "npm test                        # does it pass BEFORE I change anything?"
            },
            { t: "p", html: "That last line is the one people skip and regret. If the suite is already red, you need to know now — otherwise you will spend fifteen minutes debugging a failure you did not cause, on the assumption that the model broke something." },

            { t: "h", text: "Use the model to orient — then check it" },
            { t: "p", html: "Reading unfamiliar code is exactly the task assistants are genuinely good at, and refusing to use one here is just slower. Ask for the flow, not for an opinion." },
            { t: "code", lang: "text", code:
              "Explain how a request to /orders/:id flows through this repo.\n" +
              "List the files it touches in order, with the function in each.\n\n" +
              "What is the shape of the object that comes back from the data\n" +
              "layer? Quote the type or the literal, do not paraphrase it.\n\n" +
              "What does this code NOT handle that I should know about?"
            },
            { t: "h2", text: "Sanity-checking the summary" },
            { t: "p", html: "The failure mode is specific and worth naming: <strong>the model describes the repo it expects, not the repo you have</strong>. It will confidently name a conventional file that does not exist here, or describe a layer this project skipped. The summary is a lead, not a fact." },
            { t: "ul", items: [
              "<strong>Ask for locations, then open one.</strong> A summary that names files and functions is falsifiable in ten seconds. A summary of “the general architecture” is not.",
              "<strong>Check one claim you can break cheaply.</strong> Does that function exist? Does that field exist on that type? One hit or miss calibrates the whole answer.",
              "<strong>Ask what it does not handle.</strong> The gaps are usually more informative than the description, and hallucinated gaps are easier to spot than hallucinated structure.",
              "<strong>Trust quotes over paraphrase.</strong> Ask it to quote the type definition. Paraphrase is where invented fields appear."
            ] },
            { t: "note", variant: "warn", html: "A confident summary naming files that do not exist is the clearest sign you are about to build on sand. When one claim misses, stop treating the rest as information and go read the code yourself." },

            { t: "h", text: "Do not let anyone rush you past this" },
            { t: "p", html: "Sometimes the pressure is explicit — an interviewer asking whether you want to start coding — and sometimes it is just the silence of a watched clock. Either way, the answer is the same, and saying it out loud converts what looks like hesitation into visible method." },
            { t: "code", lang: "text", code:
              "\"I want two more minutes on the data model before I prompt\n" +
              " anything. Every ask I make after this depends on getting the\n" +
              " shape right, and guessing it costs more than checking it.\"\n\n" +
              "\"Happy to start now if you would rather see code — but flagging\n" +
              " that I would be guessing at the schema, so expect a revision.\""
            },
            { t: "p", html: "Both sentences protect you. The first buys the time. The second hands the decision back with the cost attached, which is a senior move: you are not refusing, you are pricing the choice for the person who owns the clock." },

            { t: "cue", html: "<b>Signs you are under-oriented and should stop prompting:</b> you are guessing at filenames · you are asking for code that touches a type whose shape you have not confirmed · you cannot say what command proves your change works · you have not run the existing tests once. Any one of these means go back to the four questions." },
            { t: "note", variant: "key", html: "<strong>Entry point, data model, tests, run command.</strong> Four answers, a few minutes, and every prompt afterwards is specific instead of speculative. Use the assistant to get there faster, then falsify one claim before you build on any of it." }
          ]
        },

        /* ---------- 5 · planning ---------- */
        {
          id: "planning",
          title: "Plan out loud, then delegate",
          summary: "Decompose into independently verifiable slices, say the plan before you prompt, and lead with your strategy instead of the model's framing.",
          minutes: 8,
          tags: ["planning", "decomposition"],
          blocks: [
            { t: "p", html: "A plan in this format is not a description of the feature. It is a <strong>list of steps you can verify one at a time</strong>. If a step has no cheap check attached, it is not a step — it is a hope, and it will be the thing that quietly breaks." },

            { t: "h", text: "Decompose into verifiable slices" },
            { t: "p", html: "Cut the work so that each piece changes one behaviour, can be proven by one assertion, and leaves the code running when it lands. Three slices you can check beat one slice that does everything, even when the total work is identical — because you find out where you went wrong while the mistake is still small." },
            { t: "ul", items: [
              "<strong>One behaviour.</strong> If you cannot name the slice in a short sentence, it is two slices.",
              "<strong>One assertion.</strong> Write down the check before you delegate the work. If you cannot state the check, you do not yet know what you are asking for.",
              "<strong>Runs when it lands.</strong> Never end a slice with the project in a broken state you plan to fix later.",
              "<strong>Cheap to revert.</strong> Small enough that throwing it away costs a minute, which is what keeps you honest about bad output."
            ] },
            { t: "compare",
              bad: { title: "A plan as a wish", items: [
                "“Add search, then wire up the UI, then handle edge cases”",
                "No check attached to any step",
                "Steps that only make sense once all three are done",
                "“Edge cases” as a step, which means they will not happen"
              ] },
              good: { title: "A plan as a checklist of checks", items: [
                "“1. matchTitles(items, q) — assert it finds one, misses one, and is case-insensitive”",
                "“2. wire it to the existing handler — assert the endpoint returns the same shape as before”",
                "“3. empty query returns everything — one assertion”",
                "Each step provable in under a minute, and the code runs after each"
              ] }
            },

            { t: "h", text: "Say it before you prompt" },
            { t: "p", html: "State the plan out loud, in about twenty seconds, before the first ask. This does two jobs at once. It gets your reasoning scored, since nobody can grade the plan you kept in your head. And it forces you to notice the decision you have not made yet — the missing decision usually shows up as a sentence you cannot finish." },
            { t: "code", lang: "text", code:
              "The twenty-second plan, out loud:\n\n" +
              "  \"Three slices. First the matcher as a pure function, because I\n" +
              "   can test it without touching the server. Second, wire it into\n" +
              "   the existing handler and confirm the response shape does not\n" +
              "   change. Third, the empty-query case, which I think should\n" +
              "   return everything — tell me if you would rather it returned\n" +
              "   nothing. I am hand-writing the matcher and delegating the\n" +
              "   wiring.\""
            },
            { t: "p", html: "Notice the last two sentences. Surfacing the one genuinely ambiguous decision invites correction while it is still free, and stating the delegation boundary up front is the control signal the rubric is looking for." },

            { t: "h", text: "Lead with your strategy, not its framing" },
            { t: "p", html: "The model's first reply always contains a proposal: a structure, a set of names, an approach. It was produced with no knowledge of your constraints, your repo's conventions, or your plan — and it is enormously anchoring. Read it as one option, and say plainly when you are not taking it." },
            { t: "table",
              headers: ["The model's first move", "What it is optimising for", "Your counter"],
              rows: [
                ["Proposes a new abstraction or class hierarchy", "Looking thorough and general", "“Not yet — one function in the existing file, no new files.”"],
                ["Rewrites nearby code it was not asked about", "Local tidiness in isolation", "“Leave the existing exports and the router untouched.”"],
                ["Adds a dependency to solve it cleanly", "The idiomatic answer in general", "“No new dependencies. Use what is already imported here.”"],
                ["Handles cases you did not ask for", "Apparent completeness", "“Drop the extra branches. I want the one behaviour, so I can test it.”"],
                ["Silently changes a type or a return shape", "Making its own code compile", "“The signature is fixed. Fit inside it or tell me why you cannot.”"]
              ]
            },

            { t: "h", text: "Revising deliberately vs drifting" },
            { t: "p", html: "Plans should change — a slice that turns out wrong is information, not failure. The distinction that matters is <strong>revising</strong> versus <strong>drifting</strong>. Revising is announced, keeps a target, and throws away what no longer fits. Drifting is what happens when each prompt responds to the last output rather than to the plan, and you end up somewhere nobody chose." },
            { t: "ul", items: [
              "<strong>Tell:</strong> you cannot say which slice you are on. Recovery — stop, restate the plan, name the current slice.",
              "<strong>Tell:</strong> your last three prompts were all fixes to the previous output. Recovery — revert to the last working state and re-ask smaller.",
              "<strong>Tell:</strong> the diff touches files that were not in the plan. Recovery — revert those files specifically; scope creep travels through them.",
              "<strong>Tell:</strong> you are keeping code because it exists, not because you chose it. Recovery — delete it and re-ask; it took the model seconds to produce."
            ] },
            { t: "note", variant: "trap", html: "<strong>Sunk cost in code you never wrote.</strong> Generated code feels expensive because it is on the screen, but it cost seconds. Attachment to it is the mechanism by which a good plan quietly turns into whatever the model happened to produce." },

            { t: "cue", html: "<b>Say this when you revise:</b> “That slice was the wrong cut — the matcher needs the normalised text, which lives one layer up. I am reverting it and re-slicing: normalise first, match second. Same target, better order.” Announced revision reads as control. The same change made silently reads as drift." },
            { t: "note", variant: "key", html: "<strong>A plan is a list of checks, not a list of intentions.</strong> Say it out loud before the first prompt, delegate one slice at a time, and treat the model's first reply as a suggestion you are free to reject. When the plan is wrong, revise it out loud — silence turns revision into drift." }
          ]
        },

        /* ---------- 6 · driving ---------- */
        {
          id: "driving",
          title: "Prompting at the right granularity",
          summary: "The size of your ask decides whether you can review the result — too coarse and you own bugs you never read, too fine and you are slower than typing.",
          minutes: 11,
          tags: ["prompting", "granularity", "control"],
          blocks: [
            { t: "p", html: "There is a dial on every ask you make, and it runs from “one line” to “the whole feature”. It is the most consequential control in this format, and both ends of it lose. This lesson is about finding the middle and staying there." },

            { t: "h", text: "The two ways to lose" },
            { t: "p", html: "<strong>Too coarse.</strong> Ask for the whole feature and you get it — hundreds of lines, quickly, and mostly plausible. Then the bill arrives. You cannot hold that much unfamiliar code in your head, so you skim; skimming catches typos and misses exactly the subtle defects generated code actually has. <strong>You own every one of them</strong>, and the interviewer's next question will be about a line you never read." },
            { t: "p", html: "<strong>Too fine.</strong> Ask line by line and every defect is caught instantly, because you effectively wrote the code. But you have added a round trip to every line of a task you could have typed directly, and you are now paying prompt-writing overhead for work that needed none. Perfect review of a job that finished too late is still a failed session." },

            { t: "widget", id: "aiecGranularity" },
            { t: "p", html: "The individual numbers all move one way — bigger asks mean more lines, more review, more round-trips to get right. The <em>total</em> is U-shaped, and that is the whole point: the cheapest strategies are the two in the middle, where the diff is still small enough to read but large enough to be worth delegating." },

            { t: "h", text: "Prompt it, or write it yourself?" },
            { t: "table",
              headers: ["Kind of code", "Default", "Reasoning"],
              rows: [
                ["Boilerplate — fixtures, config objects, repetitive cases", "Prompt", "High volume, mechanical, and wrong in obvious ways rather than subtle ones"],
                ["Mechanical transforms — rename, reshape, extract, convert a loop", "Prompt", "The correct output is fully determined by the input, so review is just reading a diff"],
                ["Unfamiliar API shape — argument order, option names, return type", "Prompt, then verify", "Faster than hunting through docs — but this is precisely where models invent plausible signatures"],
                ["Load-bearing logic — the algorithm, the state machine, the money path", "Hand-write", "You will be asked why it is correct, and you cannot defend reasoning you never did"],
                ["Anything where a subtle error is silent and costly", "Hand-write, then review twice", "The failure does not announce itself, so the only defence is having thought it through"],
                ["Tests for the load-bearing logic", "Hand-write the assertions", "Asked for “tests”, a model tends to assert what the code does rather than what it should do"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>The rule of thumb, in one line:</strong> prompt for what is tedious, mechanical, or unfamiliar; hand-write anything you will be asked to defend. If you cannot decide, ask which one you would rather explain from scratch in four minutes." },

            { t: "h", text: "Keep the code running at all times" },
            { t: "p", html: "The most reliable way to lose this round is to accumulate a large broken state. Once three slices are half-landed and nothing runs, you have no idea which change caused which failure, and the model cannot help because you cannot describe the problem. Every recovery from that position costs more than the work that got you there." },
            { t: "ul", items: [
              "<strong>Run after every slice</strong>, even a trivial one. A green baseline is what makes the next red informative.",
              "<strong>One failing thing at a time.</strong> If two things are broken, fix or revert one before touching the other.",
              "<strong>Checkpoint before a risky ask</strong> — a commit, a copy, whatever the environment allows — so reverting is a decision rather than a reconstruction.",
              "<strong>Integrate immediately.</strong> Never let generated code sit unwired “until the rest is done”; unwired code is unverified code."
            ] },

            { t: "h", text: "Recovering from bad output" },
            { t: "p", html: "Sooner or later a slice comes back wrong in a way you do not understand. The move is not to debug it. Debugging code you did not write, did not want, and could regenerate in seconds is the worst available use of interview minutes." },
            { t: "ol", items: [
              "<strong>Revert.</strong> Back to the last state that ran. Do not keep “the good parts” — you have not verified which parts those are.",
              "<strong>Narrow the ask.</strong> Cut the scope to the smallest piece that still has value on its own: one function instead of one file.",
              "<strong>Add the constraint it violated.</strong> Whatever it did that you did not want, say explicitly not to do — models comply with prohibitions much better than they infer them. This is how a prompt should grow: not longer in general, but specifically fenced against mistakes you have actually observed.",
              "<strong>Re-ask once.</strong> If the narrowed ask fails too, that is your signal to write it by hand and move on."
            ] },
            { t: "code", lang: "text", code:
              "Too coarse:\n" +
              "  \"Add search to this app.\"\n\n" +
              "Narrowed, with the constraints the last attempt violated:\n" +
              "  \"In src/search.js only, add one exported function\n" +
              "   searchTitles(items, query) that returns the items whose title\n" +
              "   contains query, case-insensitive. Return a new array.\n" +
              "   Do not modify the router. Do not add dependencies.\n" +
              "   Do not change any existing export.\""
            },
            { t: "h", text: "Driving a weakened model" },
            { t: "p", html: "In a structured sandbox the provided assistant is commonly weaker than the one you use daily — smaller, older, shorter memory. Everything above still applies, just with the dial turned further down. Do not read the weaker output as bad luck; read it as the environment asking whether your habits survive without a strong model to cover for them." },
            { t: "ul", items: [
              "<strong>Halve the ask.</strong> The scope a strong model handles in one turn is often two or three turns here.",
              "<strong>Restate context every time.</strong> Assume nothing carries over. Include the signature, the constraint and the file in each prompt.",
              "<strong>Constrain explicitly.</strong> Weaker models default harder to generic patterns, so “no new files, no new dependencies, keep this signature” earns its keep.",
              "<strong>Verify more, not less.</strong> The subtle-defect rate goes up, so check after every slice rather than every few."
            ] },
            { t: "compare",
              bad: { title: "Driving the sandbox model like your daily tool", items: [
                "One large ask, then confusion when it comes back incoherent",
                "Relying on context from four turns ago",
                "Assuming it knows the repo's conventions",
                "Reading the weak output as a reason to give up on the assistant"
              ] },
              good: { title: "Driving it like a fast junior on a bad day", items: [
                "One function per ask, with the signature written out",
                "Full context restated in every prompt",
                "Conventions stated as explicit constraints",
                "Still delegating the tedious parts, because it is still faster at those"
              ] }
            },

            { t: "cue", html: "<b>Say this while you size an ask:</b> “I am asking for just the matcher, not the wiring — I want a diff I can read in one go.” · “That came back too big to review, so I am reverting and asking for the parser only.” · “I am writing this part myself; it is the piece I will have to justify.”" },
            { t: "note", variant: "key", html: "<strong>Size every ask so you can read the whole diff.</strong> One function is usually right, one file is the outer limit, the whole feature is never right. Keep the code running at all times, and when output goes wrong, revert and narrow rather than debug — you never paid for it in the first place." }
          ]
        },

        /* ---------- 7 · verification ---------- */
        {
          id: "verification",
          title: "Verification is the skill",
          summary: "Generated code is a hypothesis: test-first loops, assertions with no runner, types as a filter, and the defects models actually produce.",
          minutes: 10,
          tags: ["verification", "testing", "types"],
          blocks: [
            { t: "p", html: "Treat every piece of generated code as a <strong>hypothesis</strong>. It is plausible, it was produced with confidence, and none of that is evidence. Verification is the step where you stop believing it and start knowing — and in this format it is the dimension that most cleanly separates candidates, because it is the one people skip when the clock is loud." },

            { t: "h", text: "Test-first, when you have a runner" },
            { t: "p", html: "In an open-ended session with a real test command, write the assertion <em>before</em> the prompt. The test is the specification you will hold the output to, and writing it first means you cannot be talked into accepting something else. It also removes the temptation to write a test that merely describes whatever came back." },
            { t: "code", lang: "javascript", code:
              "// Write this BEFORE the prompt. It is the spec, not a formality.\n" +
              "test('windowSum returns the max sum of any k consecutive items', () => {\n" +
              "  expect(windowSum([2, 1, 5, 1, 3], 3)).toBe(9);   // 5 + 1 + 3\n" +
              "  expect(windowSum([2, 1, 5, 1, 3], 5)).toBe(12);  // k === length\n" +
              "  expect(windowSum([], 3)).toBe(0);                // boundary: empty\n" +
              "});"
            },
            { t: "h", text: "What makes a good test here" },
            { t: "ul", items: [
              "<strong>Fast.</strong> If it does not run in a second you will stop running it, and a test you skip is worth nothing.",
              "<strong>Names the behaviour.</strong> The test name should be the sentence you would say out loud to defend the code.",
              "<strong>Fails for exactly one reason.</strong> A test that can go red for four reasons tells you nothing when it does.",
              "<strong>Independent of the implementation.</strong> Assert on the contract, not on the helper the model happened to invent — otherwise the test breaks every time you re-ask."
            ] },
            { t: "table",
              headers: ["Test smell", "Why it hurts in this format", "Fix"],
              rows: [
                ["One test asserting twelve things", "Goes red without telling you which behaviour broke, right when you need a fast signal", "One behaviour per test, named for that behaviour"],
                ["Asserting on internals the model invented", "Every re-ask breaks the test, so you start editing tests to match the code", "Assert only on the public contract you chose"],
                ["Snapshotting the whole output", "Passes on anything stable, including stably wrong", "Assert the specific values that make it correct"],
                ["Only the happy path", "This is precisely where generated code is fine, so the test proves nothing", "Add the boundary and the empty case first"]
              ]
            },

            { t: "widget", id: "aiecVerifyDrill" },

            { t: "h", text: "Verifying inside a restrictive sandbox" },
            { t: "p", html: "No runner, no installs, maybe nothing but a run button. You can still verify — a framework was never the point, and saying “I cannot test here” is a weak signal you can avoid with a dozen lines." },
            { t: "ol", items: [
              "<strong>Write a tiny equality helper.</strong> Compare serialised values, count failures, collect the results.",
              "<strong>Add one entry point that runs the checks</strong> and shows expected against actual, however the sandbox lets you display output.",
              "<strong>Assert the boundary and the invariant</strong> — those are where the defects live, not in the middle of the range.",
              "<strong>Hand-trace one case out loud.</strong> When there is genuinely no way to execute anything, walk the loop with real numbers while the interviewer watches. That is still verification, and it still scores."
            ] },
            { t: "code", lang: "javascript", code:
              "// No runner, no install, no imports — this is enough to verify.\n" +
              "var results = [], failures = 0;\n" +
              "function eq(label, actual, expected) {\n" +
              "  var a = JSON.stringify(actual), e = JSON.stringify(expected);\n" +
              "  if (a === e) results.push('ok   ' + label);\n" +
              "  else { failures++; results.push('FAIL ' + label + ': got ' + a + ', want ' + e); }\n" +
              "}\n" +
              "\n" +
              "eq('empty input',        windowSum([], 3),              0);\n" +
              "eq('k larger than n',    windowSum([1, 2], 5),          3);\n" +
              "eq('k equals n',         windowSum([2, 1, 5, 1, 3], 5), 12);\n" +
              "eq('happy path',         windowSum([2, 1, 5, 1, 3], 3), 9);\n" +
              "\n" +
              "results.push(failures + ' failure(s)');\n" +
              "results.join('\\n');   // show this however the sandbox allows"
            },
            { t: "p", html: "The second case is worth noticing: “k larger than the input” is a <em>decision</em>, not a fact. Say which behaviour you chose and why — returning the total, returning zero, or throwing are all defensible, and choosing out loud is the signal. An assertion that encodes an unstated decision is how two people end up disagreeing about a passing test." },

            { t: "h", text: "Types are the cheapest tests you will ever write" },
            { t: "p", html: "Every generated line has to satisfy the types you wrote. A loose signature can be satisfied by almost anything, so wrong output compiles and you find out later. Tighten the shape and a whole class of misunderstandings becomes <strong>impossible to express</strong> — the check runs before you even read the diff." },
            { t: "code", lang: "text", code:
              "Loose — the model can satisfy this with almost anything:\n\n" +
              "  function applyDiscount(order, discount)\n\n" +
              "Precise — most wrong generations now fail to type-check:\n\n" +
              "  applyDiscount(\n" +
              "    order:    { lines: Array<{ sku: string; qty: number; cents: number }> },\n" +
              "    discount: { kind: 'percent'; bps: number }\n" +
              "            | { kind: 'flat';    cents: number }\n" +
              "  ): { totalCents: number; appliedCents: number }"
            },
            { t: "p", html: "The union is doing the real work. A bare <code class='tok'>number</code> for the discount invites the classic silent defect — percent handled as if it were an amount — and no test you forgot to write will catch it. Naming the money unit in the field does the same job for the other classic: dollars quietly mixed with cents. The trade-off is worth saying out loud, though: precise types cost you upfront and they fight you while the shape is still moving, so tighten the boundaries and the money paths early and leave the interior loose until the design settles." },

            { t: "h", text: "What to test, and when" },
            { t: "ul", items: [
              "<strong>The boundary.</strong> Empty, one element, exactly full, one past the end. Generated loops are fine in the middle and wrong at the edges.",
              "<strong>The invariant.</strong> The one sentence that must stay true — “the total never exceeds the subtotal”, “the input is never modified”. Assert it directly.",
              "<strong>The thing this kind of code usually gets wrong.</strong> Name it before you read the diff, then look specifically for it. Reviewing with a hypothesis finds defects that skimming never will."
            ] },
            { t: "table",
              headers: ["What you just generated", "The subtle defect to expect", "The one assertion that catches it"],
              rows: [
                ["A sliding window or any two-index scan", "Off-by-one on the window length or the final iteration", "An input where the answer spans the whole array, plus one of length exactly <code class='tok'>k - 1</code>"],
                ["A helper taking an array or object", "It mutates the argument instead of copying", "Snapshot the input, call the helper, assert the input is unchanged"],
                ["A comparator or sort key", "Ties handled inconsistently, so the order is not well defined", "Input with duplicate keys, plus a check that <code class='tok'>compare(a,b)</code> and <code class='tok'>compare(b,a)</code> have opposite signs or are both zero"],
                ["Anything with money, dates or units", "Silent unit mix — cents against dollars, seconds against milliseconds", "One value whose magnitude would be wrong by exactly 100× or 1000×"],
                ["An early return or guard clause", "The guard swallows a case that should have been handled", "Feed it the value the guard is about and assert the handled behaviour, not just “no crash”"]
              ]
            },

            { t: "cue", html: "<b>Say this before you accept a diff:</b> “Before I move on — empty input, and the case where the window is exactly full.” · “I am checking specifically whether this copies or mutates the argument.” · “That test would pass on stably wrong output, so I am asserting the actual value instead.”" },
            { t: "note", variant: "key", html: "<strong>Generated code is a hypothesis until something proves it.</strong> Write the assertion before the prompt, test the boundary and the invariant rather than the happy path, tighten types so wrong output cannot compile, and review with a named suspicion instead of a skim. No runner is not an excuse — twelve lines of assertions is verification." }
          ]
        },

        /* ---------- 8 · communication ---------- */
        {
          id: "communication",
          title: "Narrate the work",
          summary: "Make invisible reasoning audible, use generation time instead of sitting silent, and say plainly when output is being thrown away.",
          minutes: 9,
          tags: ["communication", "narration"],
          blocks: [
            { t: "p", html: "Most of your work in this format is invisible. Deciding to revert, spotting a mutation in a diff, choosing to hand-write one function — all of it happens behind your eyes. The interviewer scores what they can observe, so <strong>reasoning you do not say out loud does not exist</strong>, and an unobserved dimension gets a low mark by default." },

            { t: "h", text: "Narrate decisions, not keystrokes" },
            { t: "p", html: "The mistake is narrating mechanics — “now I am opening the file, now I am typing the function name”. That is noise; the interviewer can see it. Narrate the things they cannot see: what you are about to ask for and why, what you decided not to do, what you are looking for in the output, and what would make you change course." },
            { t: "compare",
              bad: { title: "Keystroke narration", items: [
                "“Opening the search file now.”",
                "“Typing the function signature.”",
                "“Waiting for it to finish generating.”",
                "Then long silence during every actual decision"
              ] },
              good: { title: "Decision narration", items: [
                "“Asking for the matcher only — I want a diff I can read in one pass.”",
                "“Hand-writing this part, because it is what I will have to defend.”",
                "“While that generates: the thing I will check is whether it copies the input.”",
                "“That is wrong in a way I do not want to debug — reverting and narrowing.”"
              ] }
            },

            { t: "h", text: "Use the wait time" },
            { t: "p", html: "Every ask buys you a few seconds to half a minute where the model is working and you are not. Most candidates spend that watching a cursor. It is the easiest airtime in the whole interview: you are not doing anything else with it, and speaking then costs you nothing at all." },
            { t: "ul", items: [
              "<strong>State the next step.</strong> “If this comes back clean, the next slice is wiring it to the handler.” Now your plan is visible even if you never get there.",
              "<strong>Write the assertion you are about to check.</strong> Best possible use of the gap — you arrive at the diff with a hypothesis instead of skimming it.",
              "<strong>Read the code you will touch next.</strong> Open the handler now, so the following ask is specific rather than speculative."
            ] },
            { t: "table",
              headers: ["Dead-air moment", "Say this", "What it signals"],
              rows: [
                ["The model is generating", "“While that runs — what I am going to check is whether an empty list returns zero rather than throwing.”", "You have a verification plan, not a hope"],
                ["Output landed, you are reading it", "“Reading the diff. I am looking at the loop bound, and whether it copies the input.”", "You review with a suspicion instead of skimming"],
                ["Output is wrong", "“This is wrong in a way I do not want to debug. Reverting, and asking for just the parser.”", "Cost judgment rather than attachment to sunk work"],
                ["You are stuck on a decision", "“Two options. I am taking the one I can test in thirty seconds — say if you would rather see the other.”", "Progress under uncertainty, with input invited"]
              ]
            },

            { t: "h", text: "When it goes sideways" },
            { t: "p", html: "Things will go wrong, and how you say so is scored more heavily than the fact that it happened. The sentence that lands is the one that names the problem, prices it, and states the next action. What loses marks is silence while you fight something, or worse, quietly keeping output you know is bad because throwing it away feels like losing progress." },
            { t: "code", lang: "text", code:
              "\"That output is wrong in a way I do not want to debug —\n" +
              " reverting to the last green state and narrowing the ask.\"\n\n" +
              "\"Second attempt at the same slice failed, so I am writing this\n" +
              " one by hand. It is about fifteen lines and I will be quicker\n" +
              " than another round trip.\"\n\n" +
              "\"I am going to leave pagination out and say so explicitly,\n" +
              " rather than half-build it. Search works and is tested; that is\n" +
              " the better place to stop.\""
            },
            { t: "note", variant: "tip", html: "These read as senior rather than as failure because each one contains a <em>cost judgment</em>. “Reverting” alone sounds like a setback. “Reverting because debugging this costs more than regenerating it” is an engineering decision, and that is the thing being scored." },

            { t: "h", text: "Speed against clarity" },
            { t: "p", html: "Narration is not free. Explaining everything makes you slower and buries the decisions that mattered under commentary nobody needed. Aim for a running account of decisions with the mechanics left out — and when you genuinely need to concentrate, say so instead of going mysteriously quiet." },
            { t: "ul", items: [
              "<strong>Always narrate:</strong> what you are about to delegate and why, what you will check, and anything you throw away.",
              "<strong>Compress:</strong> the mechanical parts. “Adding the fixtures” is enough; nobody needs a line-by-line reading.",
              "<strong>Skip:</strong> keystrokes, filenames, and anything visible on the screen already.",
              "<strong>Flag deliberate silence:</strong> “Give me twenty seconds to read this properly.” Announced silence is concentration; unannounced silence is a gap in the transcript."
            ] },

            { t: "h", text: "How this scores at each level" },
            { t: "table",
              headers: ["Level", "What communication looks like"],
              rows: [
                ["Mid", "Explains what the code does when asked; goes quiet while generating; reports problems after having solved them"],
                ["Senior", "States intent before each prompt, narrates the verification, names trade-offs as they happen, and says plainly when output is being discarded and why"],
                ["Staff", "Manages the interviewer's attention — flags the decisions that matter, compresses the routine parts, checks in on scope before it drifts, and closes with a clear account of what is proven and what is still assumed"]
              ]
            },
            { t: "cue", html: "<b>Close the session with this shape:</b> “Search works and is tested for empty input, the exact-length boundary, and case-insensitivity. The matcher I wrote by hand; the fixtures were generated and I read them. Pagination I deliberately left out. If I had ten more minutes I would add the test for duplicate titles, which is the case I am least sure about.” Proven, assumed, cut, and next — in four sentences." },
            { t: "note", variant: "key", html: "<strong>Say the decision, not the keystroke.</strong> Narrate what you are delegating, what you are checking, and what you are throwing away — and spend generation time talking instead of watching. Then close by separating what is proven from what is assumed, which is the last thing the interviewer writes down." },

            { t: "quiz", id: "aiec-fundamentals" }
          ]
        }
      ]
    }
  ];

  /* =================================================================
     TRACK registration — order-independent get-or-create.
     Sibling files add further modules to this same track, so never
     plain-assign window.TRACKS.aiec.
     ================================================================= */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.aiec || (window.TRACKS.aiec = { id: "aiec", modules: [] });
  T.id = "aiec";
  T.name = "AI-Enabled Coding";
  T.short = "AIEC";
  T.tagline = "Drive the model, don't ride it";
  T.color = "#22d3ee";
  T.blurb = "A fast-growing interview round asks you to build a small real feature with an AI assistant already open — and scores judgment rather than recall. Typing speed and memorised templates stop mattering; what gets graded is whether you direct the model or it directs you, and whether you can prove the result works. This track covers the format itself, the four dimensions being scored, the difference between a locked-down sandbox and an open-ended work sample, and the working habits — orient, plan, prompt at the right size, verify, narrate — that separate the candidates who drive from the ones who get taken for a ride.";
  T.modules = T.modules || [];
  T.modules.unshift.apply(T.modules, MY_MODULES);
})();
