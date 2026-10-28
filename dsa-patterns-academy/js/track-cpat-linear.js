/* =====================================================================
   CODEX · Advanced Coding Patterns — modules 1 & 2
   window.TRACKS.cpat  ·  modules: craft, arrays
   Registers its own widgets (cpatBudget, cpatSieveLab) and quizzes
   (cpat-craft, cpat-arrays). A sibling file appends further modules to
   the same track, so registration here is order-independent.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================= */
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
      el.appendChild(
        typeof kid === "string" || typeof kid === "number"
          ? document.createTextNode(String(kid))
          : kid
      );
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

  function segGroup(labels, startIndex, onPick) {
    var wrap = h("div", { class: "w-seg" });
    var buttons = [];
    labels.forEach(function (label, i) {
      var b = h("button", { class: "w-seg-btn" + (i === startIndex ? " active" : "") }, label);
      b.addEventListener("click", function () {
        buttons.forEach(function (other) { other.classList.remove("active"); });
        b.classList.add("active");
        onPick(i);
      });
      buttons.push(b);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function chip(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function commas(x) {
    return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* ---------------- cpatBudget — spend the interview ---------------- */
  Widgets.cpatBudget = function (mount) {
    shell(mount, "planner", "Spend the interview",
      "Pick a length and a difficulty. The readout re-cuts the six phases of the phase plan into minutes and names the phase that difficulty rewards most.");

    var LENGTHS = [30, 40, 60];
    var DIFFS = ["easy", "medium", "hard"];
    var lenIdx = 1;
    var diffIdx = 1;

    var readout = h("div", { class: "w-readout" });

    /* fractions of a 40-minute round; code absorbs the rounding remainder
       so the phases always add back up to the length you picked */
    var SHARE = [
      ["clarify", 0.075],
      ["example", 0.075],
      ["brute force", 0.075],
      ["improve", 0.125],
      ["test & analyse", 0.200],
      ["buffer", 0.075]
    ];

    function plan(total, diff) {
      var out = {};
      var used = 0;
      SHARE.forEach(function (row) {
        var m = Math.max(1, Math.round(row[1] * total));
        out[row[0]] = m;
        used += m;
      });
      out.code = Math.max(1, total - used);
      if (diff === "easy") {
        var down = Math.min(2, out.improve - 1);
        out.improve -= down;
        out["test & analyse"] += down;
      } else if (diff === "hard") {
        var up = Math.min(3, out.code - 1);
        out.code -= up;
        out.improve += up;
      }
      return out;
    }

    var NOTES = {
      easy: "Easy rewards test & analyse most: the algorithm is not the hard part, so clean code and a real edge-case pass are where you separate yourself.",
      medium: "Medium rewards improve most: the distance between your brute force and the intended solution is precisely what is being measured.",
      hard: "Hard rewards brute force most: a correct baseline plus its bound, stated early, banks credit even if you never reach the optimal solution."
    };

    var ORDER = ["clarify", "example", "brute force", "improve", "code", "test & analyse", "buffer"];

    function render() {
      var total = LENGTHS[lenIdx];
      var diff = DIFFS[diffIdx];
      var p = plan(total, diff);
      clearNode(readout);
      readout.appendChild(chip("round", total + " min"));
      readout.appendChild(chip("difficulty", diff));
      ORDER.forEach(function (key) {
        readout.appendChild(chip(key, p[key] + " min"));
      });
      var beforeCode = p.clarify + p.example + p["brute force"] + p.improve;
      readout.appendChild(chip("before you type", beforeCode + " min"));
      readout.appendChild(h("div", { class: "widget-desc" }, NOTES[diff]));
    }

    var stage = h("div", { class: "w-stage" });
    stage.appendChild(h("p", { class: "widget-desc" }, "Round length"));
    stage.appendChild(segGroup(["30 min", "40 min", "60 min"], lenIdx, function (i) {
      lenIdx = i;
      render();
    }));
    stage.appendChild(h("p", { class: "widget-desc" }, "Problem difficulty"));
    stage.appendChild(segGroup(["easy", "medium", "hard"], diffIdx, function (i) {
      diffIdx = i;
      render();
    }));
    stage.appendChild(readout);
    mount.appendChild(stage);
    render();
  };

  /* -------------- cpatSieveLab — sieve versus trial division -------------- */
  Widgets.cpatSieveLab = function (mount) {
    shell(mount, "number lab", "Sieve versus trial division",
      "Type an upper bound. A real sieve runs (capped so it can never hang) and the two operation estimates are put side by side.");

    var CAP = 200000;
    var current = 1000;

    var readout = h("div", { class: "w-readout" });

    function countPrimesBelow(n) {
      if (n < 3) return 0;
      var limit = n - 1;
      var mark = new Array(limit + 1);
      var i, j;
      for (i = 0; i <= limit; i++) mark[i] = true;
      mark[0] = false;
      mark[1] = false;
      for (i = 2; i * i <= limit; i++) {
        if (!mark[i]) continue;
        for (j = i * i; j <= limit; j += i) mark[j] = false;
      }
      var count = 0;
      for (i = 2; i <= limit; i++) if (mark[i]) count++;
      return count;
    }

    function render(rawText) {
      clearNode(readout);
      var status;
      var parsed = parseInt(rawText, 10);
      if (rawText != null && (isNaN(parsed) || String(rawText).trim() === "")) {
        status = "Could not read \"" + String(rawText).slice(0, 12) + "\" as a whole number - showing the last valid bound, " + commas(current) + ".";
      } else {
        if (parsed != null && !isNaN(parsed)) {
          if (parsed < 2) {
            current = 2;
            status = "Bounds below 2 hold no primes, so the input was raised to 2.";
          } else if (parsed > CAP) {
            current = CAP;
            status = "Input clamped to the safe maximum of " + commas(CAP) + " so the sieve can never block the page.";
          } else {
            current = parsed;
            status = "Sieve run in full for n = " + commas(current) + ".";
          }
        } else {
          status = "Starting bound: n = " + commas(current) + ".";
        }
      }

      var n = current;
      var primes = countPrimesBelow(n);
      var lnln = Math.log(Math.log(Math.max(n, 16)));
      var sieveOps = n * Math.max(lnln, 0.5);
      var trialOps = (2 / 3) * Math.pow(n, 1.5);
      var ratio = sieveOps > 0 ? trialOps / sieveOps : 0;
      var density = n > 0 ? (100 * primes) / n : 0;

      readout.appendChild(chip("bound n", commas(n)));
      readout.appendChild(chip("primes below n", commas(primes)));
      readout.appendChild(chip("density", density.toFixed(1) + "%"));
      readout.appendChild(chip("sieve ops ~ n ln ln n", commas(sieveOps)));
      readout.appendChild(chip("trial division ops ~ (2/3) n^1.5", commas(trialOps)));
      readout.appendChild(chip("trial / sieve", ratio.toFixed(1) + "x"));
      readout.appendChild(h("div", { class: "widget-desc" }, status));
    }

    var field = h("input", {
      class: "w-field",
      type: "number",
      min: "2",
      max: String(CAP),
      step: "1",
      value: String(current)
    });
    field.value = String(current);
    field.addEventListener("input", function () { render(field.value); });
    field.addEventListener("change", function () { render(field.value); });

    function preset(v) {
      return h("button", {
        class: "w-btn ghost",
        onclick: function () { field.value = String(v); render(String(v)); }
      }, commas(v));
    }

    var stage = h("div", { class: "w-stage" });
    stage.appendChild(h("p", { class: "widget-desc" }, "Upper bound n (2 to " + commas(CAP) + ")"));
    stage.appendChild(field);
    stage.appendChild(h("div", { class: "w-seg" }, preset(100), preset(1000), preset(50000), preset(CAP)));
    stage.appendChild(readout);
    mount.appendChild(stage);
    render(null);
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES OWNED BY THIS FILE
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "cpat-craft": {
      title: "Delivery craft checkpoint",
      sub: "Time budgets, reading complexity off the constraints, narrating, and testing your own work.",
      questions: [
        {
          q: "In a 40-minute coding round, roughly how much of the clock should be spent before you write any implementation code?",
          options: [
            "About 30 seconds - restate the problem and start typing",
            "About 5 minutes, all of it on clarifying questions",
            "About 14 minutes: clarify, hand-work an example, state a brute force, then improve it",
            "About 25 minutes, so the approach is fully proved before coding"
          ],
          answer: 2,
          explain: "The framework spends roughly three minutes clarifying, three on a hand-worked example, three stating a brute force, and five improving it. That is about fourteen minutes of a forty-minute round, leaving fifteen to code and eight to test and analyse. Half a minute is not enough to know what you are solving, and twenty-five minutes leaves no time to produce working code."
        },
        {
          q: "Why state a brute-force approach out loud even when you can already see the optimal solution?",
          options: [
            "It fills time while you think of something better",
            "Interviewers require the slowest correct solution to be written first",
            "It puts a correct baseline and a concrete complexity on the table, which anchors the improvement and banks partial credit",
            "It proves you have not memorised the problem beforehand"
          ],
          answer: 2,
          explain: "The brute force costs about three minutes and buys two things. It guarantees you have something correct to fall back on if the clever idea collapses, and it gives you a bound to improve against, so your next sentence can be a measurable claim rather than a hunch. Jumping straight to the optimal solution also robs the interviewer of the reasoning they are there to grade."
        },
        {
          q: "The constraints say n can be as large as 100000 and the time limit is ordinary. What target complexity should you aim for?",
          options: [
            "O(n^2), because 100000 squared is still small",
            "O(n^3), since the constant factor is what really matters",
            "O(2^n) with memoisation",
            "O(n log n) or better"
          ],
          answer: 3,
          explain: "At n = 100000, an O(n^2) algorithm performs on the order of 10^10 basic operations, which is far past any ordinary time limit. O(n log n) is about 1.7 million operations at that size, which is comfortable. That is why an input bound near 10^5 is a strong hint to sort, to use a heap, or to find a single linear pass."
        },
        {
          q: "A problem caps n at 20 and asks for the best subset of the input. What does that constraint suggest?",
          options: [
            "Exponential search over subsets, usually with memoisation or a bitmask, is affordable",
            "A single linear scan is guaranteed to be enough",
            "You must find a polynomial algorithm or the solution will be rejected",
            "The answer is always a closed-form arithmetic formula"
          ],
          answer: 0,
          explain: "A bound as small as 20 is a deliberate signal: 2^20 is about a million states, which is trivial to enumerate. Interviewers pick that number precisely because it rules out the need for a polynomial algorithm and points at subset enumeration or bitmask dynamic programming. Read the tiny bound as an invitation rather than as an oversight."
        },
        {
          q: "The interviewer asks 'can you do better?'. Which response sits at the Standout tier?",
          options: [
            "Guess a different data structure and start rewriting the code immediately",
            "Name the current bottleneck, say exactly what work is being repeated, and propose the structure or ordering that removes it",
            "Say you believe the current solution is already optimal and wait",
            "Ask the interviewer to reveal the intended solution so you do not waste time"
          ],
          answer: 1,
          explain: "The question is almost always an invitation to diagnose, not a demand to guess. Naming the bottleneck and the repeated work shows you can find an improvement by method rather than by recall, and proposing the structure that removes it makes the next step concrete. Rewriting on a hunch discards a working solution for an unproved one."
        },
        {
          q: "You are halfway through coding when you realise the approach cannot work. What is the strongest move?",
          options: [
            "Keep coding and hope the test cases happen to pass",
            "Silently delete everything and start over from a blank screen",
            "Say out loud what broke, what it costs to fix versus restart, and which option you are taking",
            "Ask for a different question because this one is unfair"
          ],
          answer: 2,
          explain: "Noticing that your own approach is wrong is a positive signal, and saying so converts a failure into evidence of judgement. Stating the cost of each option shows you are making a decision rather than panicking, and it gives the interviewer a natural moment to steer you. Silence is the only genuinely damaging response, because it looks identical to being stuck."
        },
        {
          q: "You wrote a function that returns the maximum sum of any non-empty contiguous subarray. Which single test is most likely to expose a real bug?",
          options: [
            "Ten random positive numbers",
            "An array of exactly one hundred elements",
            "An array that is already sorted in ascending order",
            "An array in which every value is negative"
          ],
          answer: 3,
          explain: "The common bug is initialising the running best to zero, which quietly makes the function return 0 for an all-negative array instead of the least negative element. Positive and sorted inputs never touch that branch, and the length of the array is irrelevant to the defect. Reaching for the input that breaks your initialisation is what an edge-case checklist is for."
        }
      ]
    },

    "cpat-arrays": {
      title: "Array and math patterns checkpoint",
      sub: "Cyclic sort, greedy justification, divide and conquer, and the arithmetic toolkit.",
      questions: [
        {
          q: "Cyclic sort is applicable when the input has which property?",
          options: [
            "The array holds n values drawn from a known contiguous range such as 1..n, so every value has one correct index",
            "The array is already sorted, so only a verification pass is needed",
            "The array holds arbitrary 64-bit integers with no known bound",
            "The array holds strings that all have the same length"
          ],
          answer: 0,
          explain: "The whole trick is that the value itself tells you where it belongs, which only works when values and indices come from the same small contiguous range. Given values in 1..n, the value v belongs at index v-1, so a mismatch at an index is direct evidence of a missing or duplicated number. Without that range guarantee the index arithmetic has nowhere to point."
        },
        {
          q: "What are the time and extra-space costs of cyclic sort on an array of n values drawn from 1..n?",
          options: [
            "O(n log n) time and O(1) extra space",
            "O(n) time and O(1) extra space",
            "O(n) time and O(n) extra space",
            "O(n^2) time and O(1) extra space"
          ],
          answer: 1,
          explain: "Every swap puts at least one value at its permanent index, so there can be at most n-1 swaps across the whole run, and the scan pointer advances whenever no swap happens. That bounds the total work at O(n) even though the loop is a while rather than a for. The swaps happen in place, so the only extra memory is a couple of scalars."
        },
        {
          q: "With coin denominations 1, 3 and 4 and a target of 6, what does the greedy largest-coin-first strategy produce?",
          options: [
            "Two coins, which is also the optimum",
            "Two coins, while the optimum is three coins",
            "Three coins (4 + 1 + 1), while the optimum is two coins (3 + 3)",
            "It fails to reach 6 at all"
          ],
          answer: 2,
          explain: "Greedy takes the 4 first, leaving 2, which it can only make from two 1-coins, for three coins total. Taking 3 twice reaches 6 in two coins, so the greedy answer is strictly worse. This is the standard demonstration that a greedy choice needs a proof rather than a plausible ordering."
        },
        {
          q: "To select the maximum number of mutually non-overlapping intervals, which greedy choice is provably correct?",
          options: [
            "Always take the shortest remaining interval",
            "Always take the interval that starts earliest",
            "Always take the interval that overlaps the fewest others",
            "Always take the interval that finishes earliest among those still compatible"
          ],
          answer: 3,
          explain: "Choosing the earliest finish time leaves the largest possible remaining window for everything that follows, and an exchange argument shows any optimal solution can be rewritten to start with that choice without getting smaller. Earliest start can be beaten by one very long interval that blocks several short ones. Shortest-first and fewest-overlaps sound reasonable but both have counterexamples."
        },
        {
          q: "What are the average and worst-case time complexities of quickselect for the k-th smallest element?",
          options: [
            "O(n) average and O(n^2) worst case",
            "O(n log n) average and O(n log n) worst case",
            "O(n) average and O(n) worst case",
            "O(log n) average and O(n) worst case"
          ],
          answer: 0,
          explain: "Quickselect recurses into only one side of the partition, so with balanced splits the work forms a geometric series n + n/2 + n/4 and sums to O(n). Consistently terrible pivots shrink the range by one element at a time, which stacks up to O(n^2). Random or median-of-medians pivot selection is what keeps the bad case out of practice, and stating both bounds is what earns the credit."
        },
        {
          q: "Counting the inversions in an array in O(n log n) reuses the mechanics of which algorithm?",
          options: [
            "Quicksort's partition step",
            "Merge sort's merge step",
            "Heapsort's sift-down operation",
            "Counting sort's tally pass"
          ],
          answer: 1,
          explain: "When merging two sorted halves, taking an element from the right half means every element still unconsumed in the left half is greater than it, so you can add that many inversions in one stroke. The counting rides along on a sort you were already doing, so the bound stays at O(n log n). No other sort exposes that cross-half comparison so cheaply."
        },
        {
          q: "What is the time complexity of the sieve of Eratosthenes for finding all primes up to n?",
          options: [
            "O(n)",
            "O(n log n)",
            "O(n log log n)",
            "O(n sqrt(n))"
          ],
          answer: 2,
          explain: "Each prime p strikes out roughly n/p multiples, and the sum of 1/p over the primes up to n grows like log log n, giving O(n log log n) total marking work. That is only marginally worse than linear, which is why the sieve is dramatically faster than testing each number by trial division. It costs O(n) space for the marking array, which is what caps the usable range."
        }
      ]
    }
  });

  /* =================================================================
     MODULES OWNED BY THIS FILE
     ================================================================= */
  var MY_MODULES = [

    /* ============================ MODULE 1 ============================ */
    {
      id: "craft",
      name: "Delivery Craft",
      icon: "compass",
      lessons: [

        {
          id: "phase-plan",
          title: "A framework for the coding round",
          summary: "Six phases with explicit minute budgets for a 40-minute interview, and what each one is actually protecting you from.",
          minutes: 9,
          tags: ["framework", "interview", "time-budget"],
          blocks: [
            { t: "p", html: "A coding interview is not a test of whether you can produce an algorithm. It is a test of whether you can produce an algorithm <em>on a clock, out loud, with someone watching</em>. Those are different skills, and the second one is trainable. This lesson gives you a fixed six-phase route through the round so that you never have to decide what to do next while the clock runs." },
            { t: "p", html: "Hold this picture: the round is a budget, not a race. Every minute you spend has to buy something the interviewer can see. The framework below allocates the budget in advance so your attention goes to the problem instead of to the meta-question of how you are doing." },
            { t: "note", variant: "tip", html: "<strong>What this track assumes.</strong> That you can already recognise the common families — <a href='#/patterns/arrays/sliding-window'>sliding window</a>, <a href='#/patterns/search/binary-search'>binary search on the answer</a>, <a href='#/patterns/recursion-dp/backtracking'>backtracking</a> and the rest of the <a href='#/patterns/mastery/choose-pattern'>sixteen</a>. If naming the pattern from a cold problem statement is still slow, work that track first; this one starts where it ends and goes after the material it left out." },
            {
              t: "stat", items: [
                { v: "40 min", k: "typical coding round" },
                { v: "~14 min", k: "before you type code" },
                { v: "~15 min", k: "writing the code" },
                { v: "~8 min", k: "test and analyse" }
              ]
            },
            { t: "h", text: "The six phases" },
            {
              t: "ol", items: [
                "<strong>Clarify and restate (~3 min).</strong> Say the problem back in your own words, then ask about the things that change the answer: input size, value ranges, duplicates, empty input, whether the input can be modified, and what should happen when there is no valid answer. This phase exists to stop you solving a problem nobody asked for.",
                "<strong>Work a small example by hand (~3 min).</strong> Pick five or six elements and produce the expected output manually. This phase exists because hidden rules surface here and nowhere else, and because the example becomes your test case later.",
                "<strong>State a brute force and its complexity (~3 min).</strong> Out loud: what the obvious approach is and what it costs. This phase exists to guarantee you have something correct in hand and to give your next idea something to be measured against.",
                "<strong>Improve it and justify the improvement (~5 min).</strong> Name the bottleneck, name the repeated work, name the structure that removes it, and state the new bound. This phase exists because it is the part of the round that most strongly separates candidates.",
                "<strong>Code it (~15 min).</strong> Implement the plan you just agreed on, narrating decisions rather than syntax. This phase exists last-but-one on purpose: you are transcribing a decided solution, not discovering one.",
                "<strong>Test and analyse (~8 min).</strong> Trace your hand-worked example through the code you wrote, walk the edge-case checklist, then state final time and space complexity. This phase exists so that <em>you</em> find the bug rather than the interviewer."
              ]
            },
            { t: "widget", id: "cpatBudget" },
            { t: "p", html: "Those numbers add to thirty-seven, which is deliberate. The remaining three minutes are slack: an unexpected clarification, a compile error, a moment where you need to think. A plan with no slack fails the first time reality shows up." },
            { t: "h", text: "What going straight to code costs you" },
            {
              t: "compare",
              bad: {
                title: "Straight to code",
                items: [
                  "You discover the real requirements at minute 20, mid-function",
                  "There is no agreed plan, so the interviewer cannot help you without giving the answer away",
                  "A wrong approach costs the whole round, not three minutes",
                  "Your only artefact is unfinished code, which is worth close to nothing"
                ]
              },
              good: {
                title: "Framework first",
                items: [
                  "Requirements are pinned before a line is written",
                  "The interviewer has agreed to the plan, so hints arrive early and cheaply",
                  "A wrong approach is discarded during the three-minute brute-force phase",
                  "Even an unfinished round leaves a stated approach and a stated bound on the board"
                ]
              }
            },
            { t: "note", variant: "trap", html: "The most expensive mistake in the round is silence. An interviewer cannot distinguish between thinking hard and being completely stuck, so they assume the worse of the two. If you need twenty seconds of quiet, buy them explicitly: <em>\"Let me think about the ordering for a moment.\"</em>" },
            { t: "h", text: "The sentence that opens each phase" },
            {
              t: "table",
              headers: ["Phase", "Open it with", "What it signals"],
              rows: [
                ["Clarify", "\"Let me restate it, then ask three things.\"", "You will not build on assumptions"],
                ["Example", "\"Let me run a small case by hand first.\"", "You verify before you commit"],
                ["Brute force", "\"The obvious approach is X, and that is O(...).\"", "You always have a correct baseline"],
                ["Improve", "\"The bottleneck is Y, because we recompute Z.\"", "You optimise by diagnosis, not by recall"],
                ["Code", "\"I will write the helper first, then the main loop.\"", "You have a structure in mind"],
                ["Test", "\"Let me trace my example, then the edges.\"", "You find your own bugs"]
              ]
            },
            { t: "note", variant: "tip", html: "Rehearse this on problems that are too easy for you. Under pressure you fall back to habit, not to intention, so the habit has to be built when the stakes are zero. Three easy problems run strictly by the clock are worth more than thirty solved comfortably." },
            { t: "p", html: "Two phases have enough depth to deserve lessons of their own. The improve step is a method rather than an instinct, and it is laid out in <a href=\"#/cpat/craft/complexity-ladder\">the optimisation ladder</a>. The final phase is laid out in <a href=\"#/cpat/craft/testing-and-edges\">testing and edges</a>. How you talk through all six is covered in <a href=\"#/cpat/craft/communicating-code\">communicating while you code</a>." },
            { t: "note", variant: "key", html: "<strong>Decide the route before the round, so that during the round you only have to decide the problem.</strong> Six phases, roughly fourteen minutes before you type, and a stated bound at both ends of the improve step. That structure is visible to the interviewer even when the solution is not finished." }
          ]
        },

        {
          id: "complexity-ladder",
          title: "The optimisation ladder",
          summary: "Turn 'make it faster' into a repeatable method: baseline, find the repeated work, remove it, check the new bound.",
          minutes: 10,
          tags: ["complexity", "optimisation", "constraints"],
          blocks: [
            { t: "p", html: "Most candidates optimise by recall: they cycle through remembered tools until one fits. That works only on problems you have seen. The alternative is to optimise by <em>method</em>, and the method has four rungs you can climb on any problem, including one that is new to you." },
            {
              t: "ol", items: [
                "<strong>Get a correct brute force and name its bound.</strong> You cannot improve something you have not measured.",
                "<strong>Find the repeated work.</strong> Ask what the inner loop recomputes that an outer step already knew. This is the whole game, and it is a question with an answer rather than a hunch.",
                "<strong>Remove it with a structure or an ordering.</strong> Carry the value forward, remember it in a map, keep the data sorted, or keep a heap of what matters. Those four cover most of what interviews ask for.",
                "<strong>Check the new bound.</strong> State it, and confirm it actually clears the constraint you read in step one of the round. An improvement that still fails the input size is not an improvement."
              ]
            },
            { t: "h", text: "Reading the target off the constraints" },
            { t: "p", html: "The constraints are not decoration. Interviewers pick input bounds to point at a complexity class, so a stated bound is a strong hint about what the intended solution looks like. Work from a rough budget of a few hundred million simple operations for a typical time limit, then read the table backwards from <code class='tok'>n</code>." },
            {
              t: "table",
              headers: ["Input bound", "Plausible target", "What it is hinting at"],
              rows: [
                ["n ≤ 10", "O(n!)", "Enumerate permutations; the ordering itself is the answer"],
                ["n ≤ 20", "O(2ⁿ)", "Subsets, bitmask state, exponential search with memoisation"],
                ["n ≤ 100", "O(n³)", "All-pairs work, interval or partition DP over a small table"],
                ["n ≤ 1,000", "O(n²)", "A nested pass is fine; about 10⁶ operations"],
                ["n ≤ 100,000", "O(n log n)", "Sort it, heap it, or binary-search the answer"],
                ["n ≤ 1,000,000", "O(n)", "One pass, with a map or a running value carried along"],
                ["n up to 10⁹", "O(log n) or O(1)", "There is no array to scan; the answer is arithmetic or binary search"]
              ]
            },
            { t: "note", variant: "trap", html: "The table is a heuristic for choosing what to attempt, not a theorem. A tight O(n²) loop over primitives can beat a pointer-chasing O(n log n) structure at n = 2,000, and a bound of 10⁵ occasionally admits O(n sqrt(n)). Use it to pick a first target, then verify against the actual constraint rather than treating the row as a rule." },
            { t: "h", text: "Removing the repeated work" },
            { t: "p", html: "Here is the ladder on one concrete problem: given an array, find the largest value of <code class='tok'>a[j] - a[i]</code> where <code class='tok'>i &lt; j</code>. The brute force checks every pair. The question that unlocks it is not \"which pattern is this?\" but \"what does the inner loop already know?\" — and the answer is that for a fixed <code class='tok'>j</code>, the only thing that matters about the prefix is its minimum, which the outer loop has been recomputing from scratch every time." },
            { t: "code", lang: "python", code:
              "# Rung 1 - correct baseline. O(n^2) time, O(1) space.\n" +
              "def best_gap_brute(a):\n" +
              "    best = 0\n" +
              "    for i in range(len(a)):\n" +
              "        for j in range(i + 1, len(a)):\n" +
              "            best = max(best, a[j] - a[i])\n" +
              "    return best\n\n" +
              "# Rung 2 - the repeated work: for each j we rescan the prefix\n" +
              "#          a[0..j-1] purely to find its minimum.\n" +
              "# Rung 3 - carry the minimum forward instead of recomputing it.\n" +
              "# Rung 4 - new bound: O(n) time, O(1) space.\n" +
              "def best_gap(a):\n" +
              "    if not a:\n" +
              "        return 0\n" +
              "    best = 0\n" +
              "    lo = a[0]\n" +
              "    for x in a:\n" +
              "        best = max(best, x - lo)   # sell here\n" +
              "        lo = min(lo, x)            # or buy here for later\n" +
              "    return best"
            },
            { t: "p", html: "Nothing clever happened. A quantity that the inner loop kept rebuilding was promoted to a variable carried by the outer loop, and a quadratic algorithm became linear. That is the shape of a large fraction of all interview optimisations." },
            { t: "h", text: "The four moves that remove repeated work" },
            {
              t: "table",
              headers: ["The repeated work looks like", "The move", "Typical effect"],
              rows: [
                ["Rescanning a prefix or suffix for a running value", "Carry it in a variable", "O(n²) → O(n)"],
                ["Re-searching earlier elements for a match", "Remember them in a hash map", "O(n²) → O(n) average"],
                ["Re-comparing every pair to establish order", "Sort once, then sweep", "O(n²) → O(n log n)"],
                ["Repeatedly needing the largest or smallest of a changing set", "Keep a heap", "O(n²) → O(n log n)"],
                ["Re-solving identical subproblems", "Memoise the recursion", "Exponential → polynomial"]
              ]
            },
            { t: "h", text: "Check the new bound honestly" },
            { t: "p", html: "State the after-bound in the same breath as the before-bound: <em>\"that takes us from O(n²) time and O(1) space to O(n) time and O(n) space.\"</em> Two things make this a senior habit. First, it forces you to notice when the improvement bought speed with memory, which is a trade rather than a win. Second, it catches the case where you moved the bottleneck instead of removing it." },
            { t: "note", variant: "tip", html: "Say the space cost every single time, not just the time cost. Candidates who only ever quote time bounds get caught by the follow-up <em>\"and can you do it in constant space?\"</em>, which is much easier to answer if you already know where your memory is going." },
            { t: "p", html: "The ladder is the fourth phase of the round described in <a href=\"#/cpat/craft/phase-plan\">the phase plan</a>, and the five minutes budgeted for it are enough only because the method is fixed in advance. Two patterns in the next module are pure applications of it: <a href=\"#/cpat/arrays/cyclic-sort\">cyclic sort</a> removes a hash map by using the index itself, and <a href=\"#/cpat/arrays/divide-conquer\">divide and conquer</a> removes repeated comparisons by reusing a sort you were doing anyway." },
            { t: "note", variant: "key", html: "<strong>\"Can you do better?\" is a question about repeated work, not about vocabulary.</strong> Find what the inner loop recomputes, promote it to a carried value, a map, an ordering, or a heap, and then state both bounds. That sequence works on problems you have never seen." }
          ]
        },

        {
          id: "communicating-code",
          title: "Narrating while you code",
          summary: "Thinking out loud without reading your syntax aloud, naming things the interviewer can follow, taking a hint, and recovering when you are wrong.",
          minutes: 9,
          tags: ["communication", "interview", "narration"],
          blocks: [
            { t: "p", html: "The interviewer is building a model of how you think, and the only input they have is what you say and what you type. Everything you work out silently is invisible, which means it did not happen as far as the score is concerned. Narration is not a personality trait; it is a mechanical skill with a small number of rules." },
            { t: "h", text: "Narrate decisions, not syntax" },
            { t: "p", html: "The failure mode is reading your own code aloud. It fills the silence but carries zero information, because the interviewer can already see the characters appearing. Useful narration says what you are about to do and why, and then goes quiet while you type it." },
            {
              t: "compare",
              bad: {
                title: "Narrating syntax",
                items: [
                  "\"for i in range, colon, new line, indent...\"",
                  "\"now I set result equal to an empty list\"",
                  "\"and then I return result\"",
                  "Adds nothing the screen does not already show"
                ]
              },
              good: {
                title: "Narrating decisions",
                items: [
                  "\"I will do one pass and keep the best window seen so far.\"",
                  "\"A map from value to index, so the lookup is constant time.\"",
                  "\"Empty input returns zero here; I will confirm that at the end.\"",
                  "Explains the choice before the code appears"
                ]
              }
            },
            { t: "h", text: "Name things so the interviewer can follow" },
            {
              t: "ul", items: [
                "Name a variable after <strong>what it holds</strong>, not what type it is: <code class='tok'>last_seen</code> beats <code class='tok'>d</code>, <code class='tok'>window_start</code> beats <code class='tok'>i</code>.",
                "Loop counters can stay short when they index something obvious, but a pointer with a role deserves the role in its name.",
                "Extract a helper the moment a block needs a comment to explain it. The helper's name replaces the comment and the code gets shorter.",
                "Keep one naming convention for the whole solution. Switching halfway makes a reviewer wonder whether the two halves came from different sources.",
                "Say the name out loud once when you introduce it: <em>\"best is the answer so far.\"</em> After that the interviewer can read your code without translating."
              ]
            },
            { t: "code", lang: "python", code:
              "# Hard to follow: the reader has to hold four meanings in their head\n" +
              "def f(a, k):\n" +
              "    r, s, d = 0, 0, {}\n" +
              "    for i, x in enumerate(a):\n" +
              "        d[x] = d.get(x, 0) + 1\n" +
              "        while len(d) > k:\n" +
              "            d[a[s]] -= 1\n" +
              "            if d[a[s]] == 0:\n" +
              "                del d[a[s]]\n" +
              "            s += 1\n" +
              "        r = max(r, i - s + 1)\n" +
              "    return r\n\n" +
              "# Same algorithm, readable at interview speed\n" +
              "def longest_with_at_most_k_distinct(values, k):\n" +
              "    counts = {}\n" +
              "    start = 0\n" +
              "    best = 0\n" +
              "    for end, value in enumerate(values):\n" +
              "        counts[value] = counts.get(value, 0) + 1\n" +
              "        while len(counts) > k:              # too many distinct: shrink\n" +
              "            leaving = values[start]\n" +
              "            counts[leaving] -= 1\n" +
              "            if counts[leaving] == 0:\n" +
              "                del counts[leaving]\n" +
              "            start += 1\n" +
              "        best = max(best, end - start + 1)\n" +
              "    return best"
            },
            { t: "note", variant: "tip", html: "Write the function signature and the return statement before the body. It forces you to say what the function produces, gives the interviewer something to correct cheaply, and means an interrupted round still ends with a readable shape on the screen." },
            { t: "h", text: "Taking a hint without losing the room" },
            { t: "p", html: "A hint is not a penalty. It is the interviewer spending their own time to keep the round productive, and how you receive it is itself being scored. The move is to absorb it, restate it in your own words, and then say what it changes." },
            {
              t: "ul", items: [
                "<strong>Stop typing.</strong> Continuing to code while being given a hint reads as not listening.",
                "<strong>Restate it.</strong> <em>\"So you are suggesting the values are bounded, which means I do not need a hash set at all.\"</em> That confirms you understood the actual hint rather than a nearby one.",
                "<strong>Say what it changes.</strong> Name the line or the phase that is now different, then continue.",
                "<strong>Do not over-apologise.</strong> One acknowledgement is enough; three turns a small correction into the theme of the interview."
              ]
            },
            { t: "h", text: "Naive / Solid / Standout: answering \"can you do better?\"" },
            {
              t: "table",
              headers: ["Tier", "What the candidate says", "What it signals"],
              rows: [
                ["<strong>Naive</strong>", "\"Maybe a different data structure would help?\" and starts rewriting", "Guessing; no diagnosis, and a working solution is now at risk"],
                ["<strong>Naive</strong>", "\"I think this is already optimal.\" (silence)", "Closes the conversation the interviewer just opened"],
                ["<strong>Solid</strong>", "\"It is O(n²) because of the inner scan. A hash map would make the lookup constant, so O(n).\"", "Correct diagnosis and a correct remedy"],
                ["<strong>Standout</strong>", "\"It is O(n²) because for each j we rescan the prefix for its minimum, and that value is already known. Carrying it gives O(n) time and O(1) space, and with n up to 10⁵ that clears the constraint.\"", "Names the repeated work, states both bounds, and ties the result back to the input size"]
              ]
            },
            { t: "note", variant: "trap", html: "\"Can you do better?\" is sometimes a test of whether you will abandon a correct solution under mild pressure. If you genuinely believe the bound is tight, say why it is tight — <em>\"every element has to be read at least once, so O(n) is a floor here\"</em> — rather than either caving or going quiet." },
            { t: "h", text: "Recovering out loud when you are wrong" },
            {
              t: "ol", items: [
                "<strong>Name what broke.</strong> \"This fails when the array has duplicates, because the map overwrites the earlier index.\"",
                "<strong>Price the options.</strong> \"I can either store a list of indices per key, which is two lines, or restart with a sort, which is most of the remaining time.\"",
                "<strong>Choose, and say why.</strong> \"I will take the two-line fix, since it keeps the linear bound.\"",
                "<strong>Continue immediately.</strong> Do not relitigate the mistake; the interviewer has already recorded the recovery, which was the interesting part."
              ]
            },
            { t: "p", html: "Notice that all four steps take about fifteen seconds, which is why the round in <a href=\"#/cpat/craft/phase-plan\">the phase plan</a> carries three minutes of slack. Finding your own bug during the final phase described in <a href=\"#/cpat/craft/testing-and-edges\">testing and edges</a> is a much better outcome than having it found for you." },
            { t: "note", variant: "key", html: "<strong>Say the decision before you type it, and say the diagnosis before you fix it.</strong> Narration that explains choices makes a partly finished solution legible; narration that reads out syntax makes a finished one look thoughtless." }
          ]
        },

        {
          id: "testing-and-edges",
          title: "Testing your own code before you are asked",
          summary: "The edge-case checklist, tracing a small case by hand, and the difference between checking your code and checking your algorithm.",
          minutes: 9,
          tags: ["testing", "edge-cases", "verification"],
          blocks: [
            { t: "p", html: "The last eight minutes of the round are worth more than they look. A candidate who finishes coding and stops has produced an unverified claim. A candidate who finishes coding and then finds their own off-by-one has demonstrated the thing the job actually consists of. Treat the final phase as a scored deliverable, not as leftover time." },
            { t: "h", text: "The edge-case checklist" },
            { t: "p", html: "Walk the same list every time, out loud, and skip the rows that genuinely cannot apply. Reciting a fixed checklist takes about ninety seconds and reliably surfaces the defects that graders are watching for." },
            {
              t: "table",
              headers: ["Case", "What it usually breaks", "Say it like this"],
              rows: [
                ["Empty input", "An unguarded <code class='tok'>a[0]</code>, or a loop whose result is undefined", "\"Empty returns 0 here - is that the contract?\""],
                ["Single element", "Two-pointer and window logic that assumes a second index exists", "\"One element: the loop body never runs, and that is correct.\""],
                ["Duplicates", "Maps keyed by value, and any set-based counting", "\"Duplicates collapse in the map; I need a count, not a flag.\""],
                ["All elements equal", "Comparisons written with strict <code class='tok'>&lt;</code> where <code class='tok'>≤</code> was meant", "\"All-equal keeps the window open the whole way; still linear.\""],
                ["Negative numbers", "Accumulators initialised to zero, and abs/sign assumptions", "\"All-negative would return 0 from my initialisation, so I seed with the first element.\""],
                ["Overflow boundaries", "Sums and products in fixed-width integer languages", "\"n times max value is about 10¹⁴, so this needs a 64-bit accumulator.\""],
                ["Already sorted", "Pivot choice, and any 'it will be random' assumption", "\"Sorted input is the quicksort worst case; a random pivot avoids it.\""],
                ["Reverse sorted", "Monotonic structures and early-exit conditions", "\"Reverse order pushes everything onto the stack before any pop.\""]
              ]
            },
            { t: "code", lang: "python", code:
              "# Write the checks as assertions, not as printed output.\n" +
              "# They are readable, they fail loudly, and they leave the\n" +
              "# expected behaviour on the screen for the interviewer.\n" +
              "def check(fn):\n" +
              "    assert fn([]) == 0                 # empty\n" +
              "    assert fn([5]) == 0                # single element\n" +
              "    assert fn([4, 4, 4, 4]) == 0       # all equal\n" +
              "    assert fn([-8, -3, -9, -1]) == 7   # all negative  <-- verify this one\n" +
              "    assert fn([1, 2, 3, 4]) == 3       # already sorted\n" +
              "    assert fn([4, 3, 2, 1]) == 0       # reverse sorted\n" +
              "    assert fn([7, 1, 9, 2, 8]) == 8    # the hand-worked example\n" +
              "    return \"all cases pass\"\n\n" +
              "# check(best_gap) from the optimisation-ladder lesson"
            },
            { t: "p", html: "Verify the interesting line yourself: for <code class='tok'>[-8, -3, -9, -1]</code> the smallest value seen before the last element is <code class='tok'>-9</code>, but <code class='tok'>-9</code> appears at index 2 and <code class='tok'>-1</code> at index 3, so the best gap is <code class='tok'>-1 - (-9) = 8</code>. Which means the assertion above is wrong, and writing your expected values out by hand is exactly how you catch that." },
            { t: "note", variant: "trap", html: "That was deliberate, and it is the single most common self-testing failure: writing the assertion from what you believe the code does rather than from what the problem says the answer is. Derive expected outputs from the problem statement, never from a mental trace of your own implementation, or the test will agree with your bug." },
            { t: "h", text: "Trace a small case by hand" },
            {
              t: "ol", items: [
                "Use the example you built in phase two of the round, not a new one. It already encodes the rules you clarified.",
                "Write the loop variables as columns and fill one row per iteration. Four or five rows is enough.",
                "Say each row aloud in terms of meaning, not values: <em>\"window is now positions one to three, three distinct, still valid.\"</em>",
                "Compare the final row to the answer you computed by hand earlier. If they differ, you have located the defect to within one iteration."
              ]
            },
            { t: "h", text: "Checking your code versus checking your algorithm" },
            { t: "p", html: "These are two different activities and candidates routinely do only the first. Checking your <em>code</em> asks whether the implementation matches the plan: indices, boundaries, initialisation, the direction of a comparison. Checking your <em>algorithm</em> asks whether the plan is right at all: whether the greedy choice is actually optimal, whether the recurrence covers every case, whether the invariant survives an input you had not pictured." },
            {
              t: "compare",
              bad: {
                title: "Checking the code only",
                items: [
                  "Traces one happy-path example and declares victory",
                  "Finds typos and off-by-ones",
                  "Cannot detect a wrong approach, because the trace follows the same wrong plan",
                  "Passes right up until the interviewer names an input you never considered"
                ]
              },
              good: {
                title: "Checking the algorithm too",
                items: [
                  "Asks what input would make the approach itself wrong",
                  "Tests the assumption, not the implementation: is the ordering really monotonic?",
                  "Catches a broken greedy choice or a missing base case",
                  "Produces the sentence \"this holds because ...\", which is the actual deliverable"
                ]
              }
            },
            { t: "p", html: "The clearest place to see the distinction is greedy reasoning, where perfectly correct code can implement a strategy that is simply not optimal - the counterexample in <a href=\"#/cpat/arrays/greedy\">greedy algorithms</a> is three lines long and no amount of tracing would have found it. Reading the target complexity off the constraints, covered in <a href=\"#/cpat/craft/complexity-ladder\">the optimisation ladder</a>, is the other half of algorithm-level checking: if your bound does not clear the stated input size, the algorithm is wrong regardless of whether the code is." },
            { t: "note", variant: "tip", html: "Close the round by saying the final bounds unprompted: <em>\"O(n log n) time from the sort, O(n) space for the map, and it handles empty input and duplicates.\"</em> That one sentence is often the last thing written on the feedback form." },
            { t: "note", variant: "key", html: "<strong>Find your own bug, and derive expected outputs from the problem rather than from your code.</strong> Then check the algorithm separately from the implementation: a clean trace of a wrong plan proves nothing at all." },
            { t: "quiz", id: "cpat-craft" }
          ]
        }
      ]
    },

    /* ============================ MODULE 2 ============================ */
    {
      id: "arrays",
      name: "Missing Array & Math Patterns",
      icon: "blocks",
      lessons: [

        {
          id: "cyclic-sort",
          title: "Cyclic sort and index-as-hash",
          summary: "When values come from 1..n, the array is its own hash table: find missing and duplicate numbers in O(n) time and O(1) extra space.",
          minutes: 9,
          tags: ["array", "cyclic-sort", "in-place"],
          blocks: [
            { t: "p", html: "Hold this picture: an array whose values are drawn from <code class='tok'>1..n</code> is a set of numbered seats and a set of numbered ticket-holders. Sorting it is not a comparison problem at all, because every value already knows exactly where it belongs. The value <code class='tok'>v</code> belongs at index <code class='tok'>v - 1</code>, and once everyone is seated, any wrong seat is a direct readout of what is missing or duplicated." },
            { t: "h", text: "Recognition triggers" },
            {
              t: "ul", items: [
                "The problem says the values are a <strong>permutation of 1 to n</strong>, or lie in <strong>0 to n</strong>, or are <strong>n + 1 numbers in the range 1 to n</strong>.",
                "It asks for the <strong>missing number</strong>, <strong>all missing numbers</strong>, the <strong>duplicate</strong>, or the <strong>first positive integer that is absent</strong>.",
                "It demands <strong>O(1) extra space</strong>, which rules out the hash set that would otherwise be the obvious answer.",
                "It says the array <strong>may be modified in place</strong>. That permission is rarely given by accident."
              ]
            },
            { t: "h", text: "The mechanism" },
            { t: "p", html: "Walk the array with a single index. At each position, look at the value there and work out its home index. If the home index does not already hold that value, swap it there and <em>do not advance</em> — you now have a new, unexamined value in your hand. If it does, the position is settled and you move on." },
            { t: "code", lang: "python", code:
              "def cyclic_sort(nums):\n" +
              "    \"\"\"Place every value v in 1..n at index v - 1, in place.\"\"\"\n" +
              "    n = len(nums)\n" +
              "    i = 0\n" +
              "    while i < n:\n" +
              "        v = nums[i]\n" +
              "        home = v - 1                       # where v belongs\n" +
              "        if 1 <= v <= n and nums[home] != v:\n" +
              "            nums[home], nums[i] = nums[i], nums[home]\n" +
              "            # do NOT advance i: a new value landed in this slot\n" +
              "        else:\n" +
              "            i += 1                         # settled, or out of range\n" +
              "    return nums\n\n" +
              "def find_missing_and_duplicate(nums):\n" +
              "    \"\"\"nums holds 1..n with one value duplicated and one missing.\"\"\"\n" +
              "    cyclic_sort(nums)\n" +
              "    for i, v in enumerate(nums):\n" +
              "        if v != i + 1:\n" +
              "            return {\"missing\": i + 1, \"duplicate\": v}\n" +
              "    return {\"missing\": None, \"duplicate\": None}"
            },
            { t: "p", html: "The guard <code class='tok'>nums[home] != v</code> is doing two jobs. It stops the obvious case where a value is already home, and it stops an infinite swap loop when the same value appears twice: the second copy finds its home already occupied by an identical value and the index simply advances." },
            { t: "h", text: "Why this is linear" },
            { t: "p", html: "The loop is a <code class='tok'>while</code> without a guaranteed advance, which looks alarming, but every swap puts at least one value permanently at its correct index and no value ever leaves a correct index afterwards. There can therefore be at most <code class='tok'>n - 1</code> swaps in the entire run, and every non-swap iteration advances <code class='tok'>i</code> by one. Total work is <strong>O(n)</strong>, and since all the movement happens in the original array, the extra space is <strong>O(1)</strong>." },
            {
              t: "table",
              headers: ["Approach", "Time", "Extra space", "Requires"],
              rows: [
                ["Sort, then scan for a gap", "O(n log n)", "O(1) to O(n)", "Nothing; works on any values"],
                ["Hash set of seen values", "O(n) average", "O(n)", "Nothing; simplest to write"],
                ["Sum formula n(n+1)/2 minus actual", "O(n)", "O(1)", "Exactly one missing value, no duplicates, no overflow"],
                ["<strong>Cyclic sort</strong>", "<strong>O(n)</strong>", "<strong>O(1)</strong>", "Values confined to a known contiguous range, array writable"]
              ]
            },
            { t: "p", html: "The sum-formula row is the trap answer for \"find the missing number\": it is genuinely O(1) space, but it collapses the moment there are two missing values, and in a fixed-width integer language it overflows for large <code class='tok'>n</code>. Cyclic sort keeps the constant space and survives both." },
            { t: "h", text: "The classic mistake" },
            { t: "note", variant: "trap", html: "Advancing the index after a swap. If you write <code class='tok'>if ...: swap(); i += 1</code> the value you just swapped <em>into</em> position <code class='tok'>i</code> is never examined, and the array ends up almost sorted with a scatter of stragglers. The rule is: swap and stay, or advance without swapping — never both. The second most common mistake is comparing indices (<code class='tok'>i != home</code>) instead of values, which loops forever on duplicates." },
            { t: "note", variant: "warn", html: "Mind the offset. For values in <code class='tok'>1..n</code> the home index is <code class='tok'>v - 1</code>; for values in <code class='tok'>0..n-1</code> it is <code class='tok'>v</code>. Write the mapping down before you write the loop and say it out loud, because an off-by-one here produces a silent wrong answer rather than a crash." },
            { t: "cue", html: "<b>Spotting it in a prompt.</b> Reach for cyclic sort the moment a problem pins values to a contiguous range the same size as the array — <em>\"an array containing n distinct numbers in the range 0 to n\"</em>, <em>\"n + 1 integers where each is between 1 and n\"</em> — and then asks for what is missing, what is repeated, or the smallest absent positive, especially with an <em>O(1) extra space</em> requirement. If the values are unbounded, this pattern has nowhere to point and you want a hash set instead. See <a href=\"#/cpat/craft/complexity-ladder\">the optimisation ladder</a> for why the space constraint is the tell." },
            { t: "note", variant: "key", html: "<strong>When values and indices come from the same range, the array is already a hash table.</strong> Swap each value to its home index, stay put after a swap, and every index that still disagrees with its value is an answer. O(n) time, O(1) extra space, no auxiliary structure at all." }
          ]
        },

        {
          id: "greedy",
          title: "Greedy algorithms and the exchange argument",
          summary: "A greedy choice needs a proof, not a hunch: the exchange argument, interval scheduling, the coin-change counterexample, and a 60-second hypothesis test.",
          minutes: 10,
          tags: ["greedy", "proof", "intervals"],
          blocks: [
            { t: "p", html: "A greedy algorithm commits to the locally best-looking option at every step and never reconsiders. When it works it is the cheapest possible solution — usually a sort plus a single sweep — and when it fails it fails <em>silently</em>, returning a plausible answer that is simply not optimal. That asymmetry is why greedy is the one family where you owe the interviewer an argument, not just an implementation." },
            { t: "h", text: "Recognition triggers" },
            {
              t: "ul", items: [
                "The problem asks for the <strong>maximum number of things you can take</strong> or the <strong>minimum number of steps or resources</strong>, and choices do not interact except through what they consume.",
                "There is an obvious <strong>ordering</strong> — by finish time, by size, by ratio, by deadline — that makes one option look strictly better than another.",
                "The answer is a <strong>single number or a single schedule</strong> rather than an enumeration of possibilities.",
                "A dynamic-programming formulation exists but the constraints are far too large for it, which hints that the problem has more structure than DP needs."
              ]
            },
            { t: "h", text: "The exchange argument is the justification" },
            { t: "p", html: "The standard proof has one move. Take any optimal solution. Show that if it does not already start with your greedy choice, you can swap your greedy choice in for whatever it did choose <em>without making the solution worse</em>. If that exchange always works, then some optimal solution starts with your greedy choice, and the same argument applies to what remains. The greedy answer is therefore optimal." },
            { t: "p", html: "You do not need to write this out formally in an interview. You need one sentence in the shape <em>\"if an optimal solution used something other than the earliest-finishing interval, I could replace it with the earliest-finishing one and nothing later would break, so I lose nothing by taking it first.\"</em> That sentence is the difference between a guess and an algorithm." },
            { t: "h", text: "Interval scheduling by earliest finish time" },
            { t: "p", html: "The canonical example: given a set of intervals, take as many as possible with no two overlapping. Sorting by <em>finish</em> time and greedily taking every interval compatible with the last one kept is optimal, because finishing earliest leaves the largest possible remainder of the timeline for everything that follows — which is exactly the exchange argument above." },
            { t: "code", lang: "python", code:
              "def max_non_overlapping(intervals):\n" +
              "    \"\"\"Largest set of mutually non-overlapping intervals.\n" +
              "       Intervals are [start, end) pairs.\"\"\"\n" +
              "    intervals.sort(key=lambda iv: iv[1])    # by FINISH time\n" +
              "    kept = []\n" +
              "    last_end = float(\"-inf\")\n" +
              "    for start, end in intervals:\n" +
              "        if start >= last_end:              # compatible with what we kept\n" +
              "            kept.append((start, end))\n" +
              "            last_end = end\n" +
              "    return kept\n\n" +
              "# max_non_overlapping([[1, 4], [2, 3], [3, 5], [5, 7]])\n" +
              "#   sorted by end -> [2,3], [1,4], [3,5], [5,7]\n" +
              "#   keeps         -> [2,3], [3,5], [5,7]   (three intervals)"
            },
            { t: "p", html: "Cost is <strong>O(n log n)</strong>, entirely from the sort; the sweep itself is O(n) and the extra space is O(n) for the output, or O(1) if you only need the count. Sorting by <em>start</em> time instead is the classic wrong turn: a single very long interval that starts first blocks several short ones that would all have fitted." },
            { t: "h", text: "Where greedy fails" },
            { t: "p", html: "Making change with the fewest coins is greedy-shaped and intuitively obvious, and on the coin systems most people grew up with it happens to be correct. Change the denominations slightly and it breaks." },
            { t: "code", lang: "text", code:
              "coins  = [1, 3, 4]        target = 6\n\n" +
              "greedy, largest first:\n" +
              "    take 4  -> remaining 2\n" +
              "    take 1  -> remaining 1\n" +
              "    take 1  -> remaining 0        3 coins\n\n" +
              "optimal:\n" +
              "    take 3  -> remaining 3\n" +
              "    take 3  -> remaining 0        2 coins\n\n" +
              "The greedy choice of 4 is locally best and globally wrong:\n" +
              "it strands a remainder that the denominations cannot cover well."
            },
            { t: "note", variant: "trap", html: "Nothing about the greedy coin solution looks wrong. It terminates, it returns a valid set of coins, it is fast, and it is right on most inputs you would casually try. Greedy failures are always this quiet, which is why <em>\"it seems to work on my examples\"</em> is not evidence and an exchange argument is." },
            { t: "h", text: "Testing a greedy hypothesis in about a minute" },
            {
              t: "ol", items: [
                "<strong>State the rule precisely.</strong> \"Always take the interval that finishes earliest among the compatible ones.\" A vague rule cannot be tested or disproved.",
                "<strong>Try the extreme shapes.</strong> One huge option against many small ones; two options that tie; an option that is best now and blocks everything after it. Most counterexamples live in one of those three.",
                "<strong>Attempt the exchange in one sentence.</strong> If you cannot say why swapping your choice into an optimal solution is harmless, that is a strong signal the rule is wrong.",
                "<strong>Fall back deliberately.</strong> If greedy will not justify itself, say so out loud and reach for dynamic programming, which considers the choices greedy discards. Saying <em>\"greedy is tempting here but I cannot defend the exchange, so I will do DP\"</em> scores better than an undefended greedy."
              ]
            },
            {
              t: "table",
              headers: ["Problem shape", "Greedy verdict", "Why"],
              rows: [
                ["Maximum non-overlapping intervals", "Correct", "Earliest finish maximises the remaining timeline"],
                ["Minimum coins, arbitrary denominations", "Wrong", "A large coin can strand an awkward remainder"],
                ["Minimum coins, canonical systems", "Correct", "A property of those specific denominations, not of greedy"],
                ["Fractional knapsack (items divisible)", "Correct", "Best value-per-unit first; the exchange always works"],
                ["0/1 knapsack (items indivisible)", "Wrong", "You cannot top up with a fraction, so ratios mislead"]
              ]
            },
            { t: "cue", html: "<b>Spotting it in a prompt.</b> Reach for greedy when the problem asks for the <em>most you can take</em> or the <em>fewest you need</em>, when sorting by one field makes a clear best-first ordering appear, and when the choices only interact through a resource they consume. Do not reach for it when items are indivisible and their values do not follow their costs, or when a choice can be undone later — those belong to dynamic programming. And never present a greedy solution without the exchange sentence; see <a href=\"#/cpat/craft/testing-and-edges\">testing and edges</a> for why tracing your code cannot catch this class of error." },
            { t: "note", variant: "key", html: "<strong>Greedy is a claim about optimality, so it needs an argument.</strong> Sort by the field that makes the exchange argument work, take every compatible option, and be ready to say in one sentence why swapping your choice into an optimal solution never makes it worse. If you cannot say that sentence, you do not have a greedy algorithm — you have a guess." }
          ]
        },

        {
          id: "divide-conquer",
          title: "Divide and conquer beyond binary search",
          summary: "Reusing merge sort's merge to count inversions, quickselect for the k-th element, and master-theorem intuition without the formalism.",
          minutes: 10,
          tags: ["divide-conquer", "merge-sort", "quickselect"],
          blocks: [
            { t: "p", html: "Divide and conquer splits a problem into independent pieces, solves each recursively, and — this is the part that matters — does real work in the <em>combine</em> step. Binary search is the degenerate case where the combine costs nothing and one side is thrown away. The interesting problems are the ones where the merge itself computes something you could not get any other way." },
            { t: "h", text: "Recognition triggers" },
            {
              t: "ul", items: [
                "The answer for the whole array can be assembled from answers for the two halves <strong>plus something about pairs that straddle the middle</strong>.",
                "You need a <strong>rank-based result</strong> — the k-th smallest, the median — but sorting everything is more than the question asks for.",
                "The problem counts <strong>pairs with an order relationship</strong> (inversions, significant pairs, reverse pairs), which is quadratic by brute force.",
                "The input is large enough that O(n²) is out but the problem has no obvious single-pass structure."
              ]
            },
            { t: "h", text: "Merge sort's merge, reused: counting inversions" },
            { t: "p", html: "An <em>inversion</em> is a pair <code class='tok'>i &lt; j</code> with <code class='tok'>a[i] &gt; a[j]</code> — a measure of how far from sorted the array is. Counting them pairwise is O(n²). The insight is that during a merge of two already-sorted halves, whenever you take an element from the right half, every element still unconsumed in the left half is greater than it, and those are all inversions. You count them in one addition instead of one at a time." },
            { t: "code", lang: "python", code:
              "def sort_and_count(a):\n" +
              "    if len(a) <= 1:\n" +
              "        return a, 0\n" +
              "    mid = len(a) // 2\n" +
              "    left, cl = sort_and_count(a[:mid])\n" +
              "    right, cr = sort_and_count(a[mid:])\n" +
              "    merged, cm = merge_and_count(left, right)\n" +
              "    return merged, cl + cr + cm\n\n" +
              "def merge_and_count(left, right):\n" +
              "    out = []\n" +
              "    inversions = 0\n" +
              "    i = j = 0\n" +
              "    while i < len(left) and j < len(right):\n" +
              "        if left[i] <= right[j]:\n" +
              "            out.append(left[i]); i += 1\n" +
              "        else:\n" +
              "            out.append(right[j]); j += 1\n" +
              "            inversions += len(left) - i   # left[i:] all beat right[j]\n" +
              "    out.extend(left[i:])\n" +
              "    out.extend(right[j:])\n" +
              "    return out, inversions"
            },
            { t: "p", html: "The recursion is exactly merge sort's, so the bound is exactly merge sort's: <strong>O(n log n)</strong> time and <strong>O(n)</strong> auxiliary space. The counting is free — it rides along on work you were doing anyway. That is the general trick worth taking away: if a quantity can be accumulated during a merge, a sort you were already paying for computes it at no extra asymptotic cost." },
            { t: "h", text: "Quickselect: the k-th element without a full sort" },
            { t: "p", html: "Quicksort partitions around a pivot and then recurses into <em>both</em> sides. If all you want is the element that would land at index <code class='tok'>k</code>, you only need to recurse into the side that contains <code class='tok'>k</code> — the other half is irrelevant. Discarding half the work at every level is what turns O(n log n) into linear on average." },
            { t: "code", lang: "python", code:
              "import random\n\n" +
              "def quickselect(a, k):\n" +
              "    \"\"\"The k-th smallest element, k zero-based. Rearranges a.\"\"\"\n" +
              "    lo, hi = 0, len(a) - 1\n" +
              "    while True:\n" +
              "        if lo == hi:\n" +
              "            return a[lo]\n" +
              "        p = partition(a, lo, hi, random.randint(lo, hi))\n" +
              "        if k == p:\n" +
              "            return a[k]\n" +
              "        if k < p:\n" +
              "            hi = p - 1          # answer is left of the pivot\n" +
              "        else:\n" +
              "            lo = p + 1          # answer is right of the pivot\n\n" +
              "def partition(a, lo, hi, pivot_index):\n" +
              "    a[pivot_index], a[hi] = a[hi], a[pivot_index]   # park pivot at the end\n" +
              "    pivot = a[hi]\n" +
              "    write = lo\n" +
              "    for read in range(lo, hi):\n" +
              "        if a[read] < pivot:\n" +
              "            a[read], a[write] = a[write], a[read]\n" +
              "            write += 1\n" +
              "    a[write], a[hi] = a[hi], a[write]               # pivot to its final place\n" +
              "    return write"
            },
            { t: "p", html: "With balanced splits the work is <code class='tok'>n + n/2 + n/4 + ...</code>, a geometric series that sums to <code class='tok'>2n</code>, so the average is <strong>O(n)</strong>. With pivots that consistently peel off a single element, the range shrinks by one per level and the total is <strong>O(n²)</strong>. Both bounds are real, and stating both is the point — a random pivot makes the bad case vanishingly unlikely, and the median-of-medians pivot rule makes it impossible at the cost of a large constant factor." },
            {
              t: "table",
              headers: ["Task", "Average time", "Worst time", "Extra space"],
              rows: [
                ["Merge sort", "O(n log n)", "O(n log n)", "O(n)"],
                ["Counting inversions via merge", "O(n log n)", "O(n log n)", "O(n)"],
                ["Quickselect, random pivot", "O(n)", "O(n²)", "O(1) iterative"],
                ["Quickselect, median-of-medians pivot", "O(n)", "O(n)", "O(log n) recursion"],
                ["Sort, then index k", "O(n log n)", "O(n log n)", "O(n) or O(log n)"]
              ]
            },
            { t: "note", variant: "trap", html: "Do not claim quickselect is O(n) full stop. An interviewer who hears an unqualified linear claim will ask for the worst case, and \"average O(n), worst O(n²) unless I pick pivots by median-of-medians\" is the answer that ends the exchange in your favour. The same discipline applies to quicksort." },
            { t: "h", text: "Master theorem, without the formalism" },
            { t: "p", html: "For a recurrence of the shape <code class='tok'>T(n) = a · T(n/b) + f(n)</code>, the only question is a race between the recursion and the combine step. Compare <code class='tok'>f(n)</code> to <code class='tok'>n^(log_b a)</code>, which is how much work the leaves of the recursion tree do in total. Whichever side is bigger wins; if they tie, you pay an extra logarithmic factor." },
            {
              t: "table",
              headers: ["Recurrence", "Leaves vs combine", "Result"],
              rows: [
                ["T(n) = 2T(n/2) + O(n)", "leaves = n^(log₂ 2) = n, combine = n: a tie", "O(n log n) - merge sort"],
                ["T(n) = T(n/2) + O(1)", "leaves = n^(log₂ 1) = 1, combine = 1: a tie", "O(log n) - binary search"],
                ["T(n) = T(n/2) + O(n)", "leaves = 1, combine = n dominates", "O(n) - quickselect with balanced splits"],
                ["T(n) = 2T(n/2) + O(1)", "leaves = n dominates combine = 1", "O(n) - a full traversal of a balanced tree"],
                ["T(n) = 2T(n/2) + O(n²)", "combine = n² dominates leaves = n", "O(n²) - the top level is the whole cost"]
              ]
            },
            { t: "p", html: "You will not be asked to prove the theorem. You will be asked <em>\"and what does that come out to?\"</em> immediately after describing a recursive split, and the race above answers it in about five seconds. Notice how many of these bottom out at O(n): whenever the top level of the recursion already costs linear time and the recursion halves, the top level <em>is</em> the answer." },
            { t: "cue", html: "<b>Spotting it in a prompt.</b> Reach for divide and conquer when the whole-array answer needs the two half-answers <em>plus</em> a cross-boundary computation — counting pairs across the middle, merging ranked results, finding a maximum spanning subarray across a split. Reach for quickselect specifically when the words are <em>\"k-th smallest\"</em>, <em>\"k-th largest\"</em> or <em>\"median\"</em> and a full sort would be doing more than the question asked. If the halves are not independent, or the combine step is itself quadratic, the split buys you nothing; check the bound with <a href=\"#/cpat/craft/complexity-ladder\">the optimisation ladder</a> before committing." },
            { t: "note", variant: "key", html: "<strong>The combine step is where divide and conquer earns its keep.</strong> A merge that also counts gets inversions for free at O(n log n); recursing into only the half that can contain rank k gets the k-th element in O(n) average and O(n²) worst. Always quote both quickselect bounds." }
          ]
        },

        {
          id: "math-number-theory",
          title: "The arithmetic toolkit",
          summary: "Euclidean gcd, the sieve of Eratosthenes, modular arithmetic with fast exponentiation, and the overflow that silently ruins all three.",
          minutes: 12,
          tags: ["math", "number-theory", "modular", "overflow"],
          blocks: [
            { t: "p", html: "Some problems have no data structure in them at all. The input is a pair of integers, or a bound of 10⁹, or a demand that the answer be reported modulo a large prime — and the entire solution is arithmetic. This is a small toolkit, but it is the one candidates most often lack, and every item in it appears in interviews as a subroutine rather than as the whole question." },
            { t: "h", text: "Recognition triggers" },
            {
              t: "ul", items: [
                "The constraint is an <strong>enormous single number</strong> (up to 10⁹ or beyond) rather than a large collection, so there is nothing to iterate over.",
                "The problem mentions <strong>divisibility, factors, primes, gcd or lcm</strong>, or asks about repeating cycles and periods.",
                "The answer must be reported <strong>modulo 10⁹ + 7</strong>, which is a standing signal that intermediate values would otherwise be astronomically large.",
                "You need <strong>many primality queries</strong> over a bounded range, which is a sieve rather than repeated testing.",
                "A quantity is built by repeated multiplication, which raises the question of where it <strong>overflows</strong>."
              ]
            },
            { t: "h", text: "Greatest common divisor by the Euclidean algorithm" },
            { t: "p", html: "The Euclidean algorithm rests on one fact: any number that divides both <code class='tok'>a</code> and <code class='tok'>b</code> also divides <code class='tok'>a mod b</code>. So replacing the pair <code class='tok'>(a, b)</code> with <code class='tok'>(b, a mod b)</code> preserves the answer while shrinking the numbers, and you repeat until the second is zero." },
            { t: "code", lang: "python", code:
              "def gcd(a, b):\n" +
              "    while b:\n" +
              "        a, b = b, a % b\n" +
              "    return a\n\n" +
              "def lcm(a, b):\n" +
              "    # divide FIRST: a * b can overflow in fixed-width languages\n" +
              "    return a // gcd(a, b) * b\n\n" +
              "# gcd(1071, 462) -> (462, 147) -> (147, 21) -> (21, 0) -> 21\n" +
              "# three modulo steps for numbers in the thousands"
            },
            { t: "p", html: "The cost is <strong>O(log min(a, b))</strong> modulo operations. The reason is that two consecutive steps at least halve the larger value, so the number of steps is logarithmic rather than linear in the magnitude. That is why gcd of two numbers near 10¹⁸ finishes in a few dozen operations, and why the algorithm is a safe subroutine inside a loop." },
            { t: "note", variant: "tip", html: "The identity <code class='tok'>lcm(a, b) × gcd(a, b) = a × b</code> is worth remembering, but implement it as <code class='tok'>a / gcd × b</code> rather than <code class='tok'>a × b / gcd</code>. The two are mathematically identical and computationally very different: the second builds the full product first, which is exactly where overflow lives." },
            { t: "h", text: "The sieve of Eratosthenes" },
            { t: "p", html: "To find every prime up to <code class='tok'>n</code>, do not test each number individually. Assume everything is prime, then walk upward and, for each number still marked prime, strike out its multiples. Start striking at <code class='tok'>p × p</code>, because every smaller multiple of <code class='tok'>p</code> has a smaller prime factor and was already struck out." },
            { t: "code", lang: "python", code:
              "def sieve(n):\n" +
              "    \"\"\"All primes <= n.\"\"\"\n" +
              "    if n < 2:\n" +
              "        return []\n" +
              "    is_prime = [True] * (n + 1)\n" +
              "    is_prime[0] = is_prime[1] = False\n" +
              "    p = 2\n" +
              "    while p * p <= n:\n" +
              "        if is_prime[p]:\n" +
              "            for multiple in range(p * p, n + 1, p):\n" +
              "                is_prime[multiple] = False\n" +
              "        p += 1\n" +
              "    return [i for i in range(2, n + 1) if is_prime[i]]"
            },
            { t: "widget", id: "cpatSieveLab" },
            { t: "p", html: "Each prime <code class='tok'>p</code> strikes out roughly <code class='tok'>n / p</code> entries, and the sum of <code class='tok'>1/p</code> over primes up to <code class='tok'>n</code> grows like <code class='tok'>log log n</code>. The total is therefore <strong>O(n log log n)</strong> time and <strong>O(n)</strong> space — near-linear, and the space is what actually caps how far you can push it. Testing every number by trial division up to its square root costs roughly <code class='tok'>(2/3) · n^1.5</code> operations instead, which the lab above puts side by side." },
            { t: "h", text: "Modular arithmetic" },
            { t: "p", html: "When a problem says \"report the answer modulo 10⁹ + 7\", it is telling you the true answer is far too large to hold. The fix is to reduce as you go rather than at the end, which is safe because addition and multiplication commute with taking the remainder." },
            {
              t: "table",
              headers: ["Operation", "Do this", "Because"],
              rows: [
                ["(a + b) mod m", "((a mod m) + (b mod m)) mod m", "Reduce at every step; values never grow"],
                ["(a - b) mod m", "((a mod m) - (b mod m) + m) mod m", "Many languages return a negative remainder; the + m fixes it"],
                ["(a × b) mod m", "((a mod m) × (b mod m)) mod m", "Reduce <em>before</em> multiplying, or the product overflows"],
                ["a^e mod m", "Square-and-multiply, O(log e) multiplications", "Building a^e first is impossible for any real e"],
                ["(a / b) mod m", "a × b^-1 mod m, where b^-1 is the modular inverse", "Division is not defined directly; the inverse exists only when gcd(b, m) = 1"]
              ]
            },
            { t: "p", html: "Fast exponentiation is the one to be able to write from memory. Read the exponent in binary: square the base at every bit position, and multiply the running result whenever that bit is set. That is <strong>O(log e)</strong> multiplications instead of <code class='tok'>e</code> of them." },
            { t: "code", lang: "python", code:
              "def power_mod(base, exponent, mod):\n" +
              "    \"\"\"base ** exponent % mod in O(log exponent) multiplications.\"\"\"\n" +
              "    result = 1\n" +
              "    base %= mod\n" +
              "    while exponent > 0:\n" +
              "        if exponent & 1:                  # this binary digit is set\n" +
              "            result = result * base % mod\n" +
              "        base = base * base % mod          # square for the next digit\n" +
              "        exponent >>= 1\n" +
              "    return result\n\n" +
              "# When mod is prime, Fermat gives the modular inverse for free:\n" +
              "def inverse_mod(b, prime_mod):\n" +
              "    return power_mod(b, prime_mod - 2, prime_mod)"
            },
            { t: "h", text: "Overflow awareness" },
            { t: "p", html: "A 32-bit signed integer stops at about 2.1 × 10⁹; a 64-bit signed integer stops at about 9.2 × 10¹⁸. Those two numbers are worth memorising, because the arithmetic that crosses them is unremarkable to look at. Summing 10⁵ values that each reach 10⁹ gives 10¹⁴: comfortable in 64 bits, catastrophic in 32. Multiplying two values near 10¹⁰ gives 10²⁰, which overflows even 64 bits, which is precisely why you reduce modulo <code class='tok'>m</code> <em>before</em> the multiply and not after." },
            { t: "note", variant: "trap", html: "Python integers grow without bound, so every overflow bug in this lesson is invisible when you prototype in Python and fatal when the same logic is written in Java, C++ or Go. If you are coding in Python, say the bound out loud anyway — <em>\"in a fixed-width language this accumulator would need 64 bits\"</em> — because the interviewer is grading the reasoning, not the interpreter." },
            { t: "cue", html: "<b>Spotting it in a prompt.</b> Reach for the arithmetic toolkit when the input is a <em>magnitude</em> rather than a collection, when the words are <em>divisible, prime, factor, gcd, lcm, cycle length</em>, or when the answer must be given <em>modulo a large prime</em>. Use a sieve when you need primality over a whole bounded range and trial division when you need it for one number. Use fast exponentiation any time an exponent appears at all. As <a href=\"#/cpat/craft/complexity-ladder\">the optimisation ladder</a> puts it: a bound near 10⁹ means there is no array to scan, so the answer is arithmetic or binary search." },
            { t: "note", variant: "key", html: "<strong>Four tools cover almost all of it: Euclidean gcd at O(log min(a, b)), the sieve at O(n log log n), square-and-multiply at O(log e), and the habit of reducing modulo m before every multiplication.</strong> The fourth is the one that turns a correct algorithm into a correct program." },
            { t: "quiz", id: "cpat-arrays" }
          ]
        }
      ]
    }
  ];

  /* =================================================================
     TRACK REGISTRATION — order-independent (a sibling file appends more)
     ================================================================= */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.cpat || (window.TRACKS.cpat = { id: "cpat", modules: [] });
  T.id = "cpat";
  T.name = "Advanced Coding Patterns";
  T.short = "ADV";
  T.tagline = "Deliver it, don't just solve it";
  T.color = "#fbbf24";
  T.blurb = "The gap between knowing an algorithm and landing it in a forty-minute round. Half of this track is craft: a phase-by-phase phase plan with real minute budgets, a repeatable method for optimising anything, how to narrate without reading your syntax aloud, and how to test your own code before you are asked. The other half is the pattern families the other tracks leave out - cyclic sort and index-as-hash, greedy with an actual proof, divide and conquer past binary search, and the arithmetic toolkit that shows up whenever the constraint is a magnitude rather than a collection.";
  T.modules = T.modules || [];
  T.modules.unshift.apply(T.modules, MY_MODULES);
})();
