/* =====================================================================
   SYNAPSE · ML System Design
   window.TRACKS.mlsd — modules: framework / concepts / serving

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
     1. mlsdBudget — "Spend the 45 minutes"
     Deterministic: output is a pure function of (length, flavour).
  ================================================================== */
  var BUDGET_PHASES = [
    "Requirements & scope",
    "Framing the objective",
    "High-level design",
    "Data & features",
    "Training & evaluation",
    "Deep dives"
  ];
  /* canonical 45-minute split, and the tilt each problem flavour deserves */
  var BUDGET_CANON = [5, 3, 10, 10, 7, 10];
  var BUDGET_FLAVOURS = {
    rec: {
      weights: [4, 3, 9, 13, 7, 9],
      note: "Recommendation prompts pay you most in data & features: candidate sources and interaction signals are the whole design."
    },
    trust: {
      weights: [6, 6, 8, 9, 10, 6],
      note: "Trust & safety prompts pay you most in framing and evaluation: cost asymmetry and a precision floor decide everything downstream."
    },
    search: {
      weights: [5, 3, 12, 10, 6, 9],
      note: "Search prompts pay you most in high-level design: the two-stage retrieval-then-ranking split is the shape they are listening for."
    }
  };

  /* Scale a 45-minute weight vector to any total. The last phase (deep dives)
     absorbs the rounding residue, which is also how it works in a real round. */
  function scaleBudget(weights, total) {
    var out = [], used = 0, i, m;
    for (i = 0; i < weights.length - 1; i++) {
      m = Math.max(1, Math.round(weights[i] * total / 45));
      out.push(m);
      used += m;
    }
    out.push(Math.max(2, total - used));
    return out;
  }

  function deltaLabel(n) {
    if (n > 0) return "+" + n;
    if (n < 0) return String(n);
    return "even";
  }

  Widgets.mlsdBudget = function (mount) {
    shell(mount, "planner", "Spend the 45 minutes",
      "Pick a round length and a problem flavour. The plan re-splits, and the delta column shows how this flavour tilts away from the canonical schedule.");

    var total = 45;
    var flavour = "rec";

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var mins = scaleBudget((BUDGET_FLAVOURS[flavour] || BUDGET_FLAVOURS.rec).weights, total);
      var canon = scaleBudget(BUDGET_CANON, total);
      var note = (BUDGET_FLAVOURS[flavour] || BUDGET_FLAVOURS.rec).note;
      var max = 1, i;
      for (i = 0; i < mins.length; i++) if (mins[i] > max) max = mins[i];

      clear(stage);
      for (i = 0; i < BUDGET_PHASES.length; i++) {
        var d = mins[i] - canon[i];
        var bar = h("i", {
          style: "display:block;height:10px;border-radius:6px;background:" +
            (d > 0 ? "var(--accent)" : d < 0 ? "var(--text-dim)" : "var(--accent-2)") +
            ";width:" + Math.round((mins[i] / max) * 100) + "%"
        });
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:minmax(120px,1.4fr) minmax(60px,2fr) 58px 56px;" +
            "gap:12px;align-items:center;padding:7px 0"
        },
          h("span", { style: "font-size:0.84rem" }, BUDGET_PHASES[i]),
          h("span", { style: "display:block;background:var(--surface-solid);border-radius:6px;overflow:hidden" }, bar),
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem" }, mins[i] + " min"),
          h("span", {
            style: "font-family:var(--font-mono);font-size:0.72rem;color:" +
              (d === 0 ? "var(--text-dim)" : "var(--accent-ink)")
          }, deltaLabel(d))
        ));
      }

      clear(readout);
      for (i = 0; i < BUDGET_PHASES.length; i++) {
        readout.appendChild(ro(BUDGET_PHASES[i].toLowerCase(), mins[i] + "m"));
      }
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, note));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[30, "30 min"], [45, "45 min"], [60, "60 min"]], 1, function (v) { total = v; paint(); }),
      segment([["rec", "Recommendation"], ["trust", "Trust & safety"], ["search", "Search"]], 0, function (v) { flavour = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. mlsdFeatureLab — "What each signal source buys"
     Deterministic and monotonic: adding a source never lowers lift.
     The numbers are an illustrative model, not measurements.
  ================================================================== */
  var FEATURE_SOURCES = [
    { id: "user", label: "User profile", lift: 8, ms: 2, cold: 2,
      why: "Locale, device class, signup surface, declared interests — whatever exists the instant an account is created." },
    { id: "item", label: "Item / content", lift: 10, ms: 2, cold: 2,
      why: "Title, category, language, creator, embedding of the content itself. Available the moment an item is published." },
    { id: "history", label: "Interaction history", lift: 26, ms: 6, cold: -4,
      why: "What this user clicked, watched, skipped, saved and reported. The largest single source of lift and the emptiest column for a new account." },
    { id: "context", label: "Context", lift: 6, ms: 1, cold: 2,
      why: "Time of day, day of week, device, network, entry surface. Cheap, always present, never sufficient alone." },
    { id: "cross", label: "Cross features", lift: 14, ms: 5, cold: -2,
      why: "This user against this item: affinity for the creator, the category, the language, the price band." }
  ];

  function featureState(on) {
    var lift = 0, ms = 1, cold = 5, n = 0, i, s, l;
    for (i = 0; i < FEATURE_SOURCES.length; i++) {
      s = FEATURE_SOURCES[i];
      if (!on[s.id]) continue;
      n++;
      l = s.lift;
      /* cross features need an interaction log to be defined over; without one
         they collapse toward item popularity and buy far less */
      if (s.id === "cross" && !on.history) l = 4;
      lift += l;
      ms += s.ms;
      cold += s.cold;
    }
    if (cold < 0) cold = 0;
    if (cold > 10) cold = 10;
    return { lift: lift, ms: ms, cold: cold, n: n };
  }

  function coldWord(score) {
    if (score <= 2) return "fragile";
    if (score <= 4) return "weak";
    if (score <= 6) return "mixed";
    if (score <= 8) return "solid";
    return "strong";
  }

  function featureVerdict(on, st) {
    if (st.n === 0) {
      return "Nothing selected, so you are shipping the popularity baseline: every user sees the same ranking and the system is a leaderboard with a login page.";
    }
    if (!on.history && !on.cross) {
      return "Cold-start-safe by construction — every one of these exists on a user's very first request — but the largest source of lift is still on the table. This is the right shape for a fallback path, not for the main model.";
    }
    if (on.cross && !on.history) {
      return "Cross features without an interaction log are mostly inert: there is no history to define user-by-item affinity over, so they collapse toward the item's popularity and buy a fraction of their usual lift.";
    }
    if (st.cold <= 3) {
      return "The best offline number available here and the worst first session. Interaction history is carrying the model, so a brand-new account gets a near-random experience unless you route it to an item-and-context fallback.";
    }
    return "A balanced configuration: history for depth, user, item and context so the first session is not a cold wall. This is the shape most production rankers converge on.";
  }

  Widgets.mlsdFeatureLab = function (mount) {
    shell(mount, "feature lab", "What each signal source buys",
      "Toggle the five sources of signal. Lift is modelled relative to a popularity-only baseline; cold-start is a 0-10 rating of how the system behaves on a user's first session. Illustrative numbers, real trade-off.");

    var on = { user: true, item: true, history: false, context: true, cross: false };
    var btns = {};
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var st = featureState(on), i, s;

      for (i = 0; i < FEATURE_SOURCES.length; i++) {
        s = FEATURE_SOURCES[i];
        btns[s.id].className = "w-btn " + (on[s.id] ? "primary" : "ghost");
      }

      clear(stage);
      for (i = 0; i < FEATURE_SOURCES.length; i++) {
        s = FEATURE_SOURCES[i];
        var active = !!on[s.id];
        stage.appendChild(h("div", {
          style: "display:flex;gap:12px;align-items:flex-start;padding:8px 0 8px 10px;border-left:3px " +
            (active ? "solid var(--accent)" : "dashed var(--glass-border)")
        },
          h("span", {
            style: "font-family:var(--font-mono);font-size:0.72rem;min-width:74px;color:" +
              (active ? "var(--accent-ink)" : "var(--text-dim)")
          }, active ? "+" + (s.id === "cross" && !on.history ? 4 : s.lift) + "%" : "off"),
          h("span", { style: "font-size:0.84rem;line-height:1.5;color:" + (active ? "var(--text)" : "var(--text-dim)") },
            h("b", {}, s.label + " — "),
            s.why)
        ));
      }

      clear(readout);
      readout.appendChild(ro("offline lift", "+" + st.lift + "%"));
      readout.appendChild(ro("serving cost", "~" + st.ms + " ms"));
      readout.appendChild(ro("cold start", st.cold + "/10 " + coldWord(st.cold)));
      readout.appendChild(ro("sources", st.n + "/5"));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, featureVerdict(on, st)));
    }

    var controls = h("div", { class: "widget-controls" });
    for (var i = 0; i < FEATURE_SOURCES.length; i++) {
      (function (s) {
        var b = h("button", { type: "button", class: "w-btn ghost" }, s.label);
        b.addEventListener("click", function () { on[s.id] = !on[s.id]; paint(); });
        btns[s.id] = b;
        controls.appendChild(b);
      })(FEATURE_SOURCES[i]);
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     3. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "mlsd-framework": {
      title: "Framework checkpoint",
      sub: "Scoping, objectives, the offline/online sketch, and what each level is graded on.",
      questions: [
        {
          q: "You are twelve minutes into a 45-minute round and you still have not said what the model predicts. What has gone wrong?",
          options: [
            "Nothing — architecture first is the conventional order",
            "45 minutes is simply too short for an ML design problem",
            "You should skip the objective and go straight to a deep dive",
            "You are still scoping; the prediction target should have been pinned by roughly minute eight"
          ],
          answer: 3,
          explain: "Requirements and objective framing together are about eight minutes of a 45-minute round. Everything after them — architecture, features, evaluation — is downstream of what you are predicting, so time spent drawing boxes before the target is fixed is usually time you have to spend again. If you notice you are late, say the target out loud in one sentence and move on rather than restarting."
        },
        {
          q: "A moderation prompt asks you to 'remove harmful posts'. Which objective is the strongest one to state?",
          options: [
            "Minimize views of harmful content subject to that same precision floor",
            "Remove as many harmful posts as possible",
            "Maximize harmful posts removed subject to a precision floor",
            "Maximize classification accuracy on the moderation dataset"
          ],
          answer: 0,
          explain: "Harm is caused by exposure, not by the existence of a post. Counting removals scores a post taken down after a million views as a success, while counting views makes speed and reach part of the objective. The precision floor stays in either version because it is what bounds the cost to innocent users."
        },
        {
          q: "Why is 'maximize accuracy' a weak objective for a moderation model where 99.9% of posts are fine?",
          options: [
            "Accuracy is mathematically undefined when classes are imbalanced",
            "A model that approves every post already scores 99.9%, so the metric cannot see the work you care about",
            "Accuracy requires calibrated probabilities, which classifiers do not produce",
            "Accuracy applies only to regression problems"
          ],
          answer: 1,
          explain: "Accuracy is dominated by the majority class. With a 0.1% positive rate, the do-nothing model scores 99.9% and every real improvement moves the number in the third decimal place. You need metrics that look only at the positive class — precision and recall — which is why the objective is phrased against them."
        },
        {
          q: "Which arrow is most often missing from a candidate's ML architecture sketch?",
          options: [
            "Client to load balancer",
            "Feature store to the ranking service",
            "Serving logs flowing back into the offline training data",
            "Model registry to the serving layer"
          ],
          answer: 2,
          explain: "Candidates draw the offline path and the online path as two separate diagrams and forget that the online path produces the data the offline path trains on. Without that arrow there is no explanation of where next month's labels come from, and no place to hang the feedback-loop and drift discussions the interviewer wants to have."
        },
        {
          q: "Asked 'why that model?', you answer: 'gradient-boosted trees — they usually win on tabular data.' What is the weak signal here?",
          options: [
            "Gradient-boosted trees are a poor default on tabular data",
            "Model choice is not one of the dimensions you are assessed on",
            "You should always propose a deep model in an ML design round",
            "You named a model without tying it to the constraint that makes it the right one here"
          ],
          answer: 3,
          explain: "The claim about tabular data is fine; the answer is weak because it is generic. A strong version names the constraint — a few hundred dense features, a tight CPU latency budget, no team to maintain a training cluster — and shows the model falling out of it. Interviewers grade the reasoning, not the name."
        },
        {
          q: "What most separates a staff-level answer from a strong senior one in this round?",
          options: [
            "Framing the problem so a cheaper system suffices, and naming explicitly what you would not build",
            "Drawing the architecture faster",
            "Deeper knowledge of one specific model architecture",
            "Quoting more precise latency numbers"
          ],
          answer: 0,
          explain: "Senior is judged on designing the system well. Staff is judged on choosing which system deserves to exist, sequencing it so value lands before the expensive parts, and being willing to say that a heuristic or a bought service is the right answer for phase one. Scope discipline reads as seniority far more reliably than architectural depth does."
        },
        {
          q: "Your round is 30 minutes instead of 45. Which part of the plan should shrink the least, proportionally?",
          options: [
            "The high-level diagram",
            "Requirements and the ML objective",
            "The deep dive",
            "The data and features discussion"
          ],
          answer: 1,
          explain: "Scoping and objective framing are close to fixed cost: they are short already, and getting them wrong invalidates everything built on top. The deep dive is the elastic phase — you can do one instead of two — so it should absorb most of the cut, which is exactly what the budget planner does when you shorten the round."
        }
      ]
    },

    "mlsd-concepts": {
      title: "Modelling foundations checkpoint",
      sub: "Representations, features, splits, generalization, and the metrics that decide whether any of it worked.",
      questions: [
        {
          q: "Why is a two-tower model used for retrieval rather than for final ranking?",
          options: [
            "It is strictly more accurate than a model with cross features",
            "It cannot be trained on interaction data, only on content",
            "Its item side can be precomputed and indexed, because query and item only meet at a final dot product",
            "It requires a graph, which ranking models do not have"
          ],
          answer: 2,
          explain: "The architectural constraint that makes a two-tower model useful is the same one that limits it. Because the towers never see each other until the similarity score, every item vector can be computed offline and loaded into a nearest-neighbour index — which is what makes retrieval over millions of items possible. It also means the model cannot represent fine-grained query-item interactions, which is precisely what the ranker is for."
        },
        {
          q: "You tune an approximate nearest-neighbour index to answer faster. What are you giving up?",
          options: [
            "Nothing — approximate search returns the same results, only faster",
            "The ability to use dot-product similarity",
            "Calibration of the ranker's predicted probabilities",
            "Recall — some true nearest neighbours stop being returned"
          ],
          answer: 3,
          explain: "Every approximate index exposes a knob that trades search effort for completeness: how many partitions to probe, how far to walk the graph, how coarsely to quantize. Turning it down visits less of the space, so some genuine neighbours are missed. The right way to reason about it is to measure recall against exact search on a sample and pick the cheapest setting that keeps recall above what the ranker needs."
        },
        {
          q: "Which family of features typically gives the largest offline lift and the worst behaviour on a user's first session?",
          options: [
            "Interaction-history features",
            "Context features such as time of day and device",
            "Item content features",
            "Static user attributes captured at signup"
          ],
          answer: 0,
          explain: "What a user has actually clicked, watched or skipped is the most predictive thing you have about what they will do next, which is why history features dominate offline metrics. It is also empty for a brand-new account, so a model leaning on it degrades to noise exactly when first impressions matter. The standard answer is a fallback path built from item, context and profile features."
        },
        {
          q: "You are predicting whether a transaction is fraudulent and add the feature 'number of times this account has been manually reviewed'. Why is that dangerous?",
          options: [
            "Count features must be log-transformed before a tree model can use them",
            "Manual review is triggered by suspicion of fraud, so the feature partly encodes the label and will not exist in that form at decision time",
            "The feature is too sparse to carry usable signal",
            "The feature updates too slowly to be predictive"
          ],
          answer: 1,
          explain: "This is target leakage: the feature is a consequence of the thing you are predicting rather than a cause of it. Offline it looks superb, because reviews cluster on fraudulent accounts. In production the review has not happened yet when you must score the transaction, so the feature is absent or zero and the model collapses. The check is to compare the timestamp of every feature against the timestamp of the decision."
        },
        {
          q: "What concrete failure does a feature store exist to prevent?",
          options: [
            "Models growing too large to fit in serving memory",
            "Overfitting to the training set",
            "The training job and the serving path computing the same named feature differently",
            "Training jobs running too slowly"
          ],
          answer: 2,
          explain: "Training/serving skew happens when one definition of a feature is written twice — once in a batch job, once in a request-path service — and the two drift apart in windowing, default values, or time zone handling. The model then sees a different distribution live than it learned from, and the offline metric never showed it. A feature store's real product is a single definition with two consistent read paths."
        },
        {
          q: "Your data is a year of user sessions and you split it randomly into train and test. What is the main problem?",
          options: [
            "The test set ends up too small to be significant",
            "Random splits require label stratification to be valid",
            "Recall cannot be computed on a randomly split dataset",
            "Future sessions and the same users land on both sides, so the score flatters a system that will only ever see the future and new users"
          ],
          answer: 3,
          explain: "A random split breaks two assumptions at once. It puts later events in training and earlier events in test, so the model is scored on predicting a past it has already seen; and it puts the same user on both sides, so memorizing that user counts as generalization. Time-ordered data wants a temporal split, and user-grouped data wants a grouped split — often both."
        },
        {
          q: "Training error is very low and validation error is much higher. Which lever matches that diagnosis?",
          options: [
            "Constrain the model — regularization, a smaller model, early stopping — or get more data",
            "Add capacity: more layers, more trees, more parameters",
            "Derive more features from the same rows",
            "Lower the decision threshold"
          ],
          answer: 0,
          explain: "A large train/validation gap is the signature of overfitting: the model has enough capacity to memorize the sample rather than the pattern. The levers that help all shrink the effective hypothesis space or grow the sample — weight decay, dropout, early stopping, a smaller model, more or augmented data. Adding capacity or features widens the gap, and changing the threshold moves the operating point without touching generalization."
        },
        {
          q: "A spam filter on a stream that is 0.1% spam reports ROC-AUC of 0.98, but reviewers say most of what it flags is fine. How are both true?",
          options: [
            "ROC-AUC must have been computed against the wrong column",
            "False-positive rate is measured against an enormous negative class, so thousands of false positives barely move it while precision collapses",
            "The model is underfitting, which always presents as low precision",
            "ROC-AUC and precision measure the same quantity, so one number is simply wrong"
          ],
          answer: 1,
          explain: "ROC curves plot true-positive rate against false-positive rate, and false-positive rate divides by the total number of negatives. When negatives outnumber positives a thousand to one, ten thousand false positives is a false-positive rate of about one percent — invisible on the ROC curve — while precision, which divides by the number of items you flagged, is destroyed. Precision-recall curves have no such blind spot because neither axis involves the true-negative count."
        },
        {
          q: "An experiment on a two-sided marketplace shows a large lift in the treatment arm. Why might the lift not survive a full rollout?",
          options: [
            "Treatment effects always regress to the mean after launch",
            "Guardrail metrics invalidate any measured lift",
            "Treatment may have won by taking shared supply away from control, which nobody can do once everyone is in treatment",
            "The sample was necessarily too small to detect the effect"
          ],
          answer: 2,
          explain: "Standard A/B analysis assumes one user's assignment does not affect another user's outcome. On a marketplace, in a feed with shared inventory, or anywhere arms compete for the same finite resource, that assumption fails and the measured gap includes what treatment took from control. Cluster, geo or switchback randomization restores the assumption at the cost of statistical power."
        }
      ]
    },

    "mlsd-serving": {
      title: "Serving & operations checkpoint",
      sub: "Two-stage retrieval, inference architecture, drift, and keeping the feedback loop honest.",
      questions: [
        {
          q: "Why not run the ranking model across the whole corpus and skip candidate generation?",
          options: [
            "Ranking models can only score one item per call",
            "Candidate generation is more accurate than ranking",
            "The corpus is not indexed, so it cannot be scanned at all",
            "A model rich enough to rank precisely is far too expensive to run across millions of items inside a request budget"
          ],
          answer: 3,
          explain: "Precision at the top of a list comes from cross features and heavy models, and their per-item cost is orders of magnitude above a dot product. Multiply that by corpus size and you blow the latency budget by a wide margin. The two-stage split exists so the expensive model only ever sees a few hundred items that a cheap high-recall stage has already narrowed down."
        },
        {
          q: "How should you choose the candidate-set size K?",
          options: [
            "Raise K until retrieval recall stops improving materially, then check that K times the ranker's per-item cost still fits the latency budget",
            "Set K to the number of results the user will actually see",
            "Set K as large as the index can return, since more candidates never hurt",
            "Set K to match the training batch size"
          ],
          answer: 0,
          explain: "K is a recall-versus-cost dial with a measurable answer. Retrieval recall — the share of items the ranker would have put on the first page that made it into the candidate set — climbs steeply then flattens, and the flattening point is your K. Then you sanity-check it against the budget, because the ranker's cost is linear in K."
        },
        {
          q: "When is precomputing predictions in a batch job the right architecture?",
          options: [
            "Whenever the model is a neural network",
            "When the set of inputs is small enough to enumerate and the answer can be a few hours stale",
            "When features arrive as a stream and must be reflected within seconds",
            "Whenever latency matters at all"
          ],
          answer: 1,
          explain: "Precomputation converts an inference problem into a lookup problem, which is unbeatable on latency and cost — but only if you can enumerate the inputs ahead of time and tolerate the staleness between runs. Daily emails and homepage shelves fit. Anything keyed on request-time context, or anything that must react within seconds, does not."
        },
        {
          q: "Dynamic batching raises throughput on an accelerator. What does it cost?",
          options: [
            "Model accuracy, because batched inputs interfere with each other",
            "Feature freshness, because batches are computed offline",
            "Per-request latency, because a request waits for the batch to fill or the window to expire",
            "Nothing, which is why it should always be enabled"
          ],
          answer: 2,
          explain: "Batching amortizes fixed per-call overhead across many requests, so throughput per unit of hardware goes up. The price is paid by the individual request, which sits in a queue until the batch is full or a timeout fires. Tune the maximum wait against your tail-latency target: a few milliseconds is often free, tens of milliseconds usually is not."
        },
        {
          q: "Why is monitoring an ML system harder than monitoring an ordinary service?",
          options: [
            "ML systems have inherently higher error rates",
            "Latency and error-rate metrics do not apply to models",
            "Model predictions cannot be logged",
            "Ground truth arrives late or never, so the quality metric lags the failure by days or weeks"
          ],
          answer: 3,
          explain: "A service tells you it is broken within seconds because a request either succeeded or it did not. A model that has quietly become wrong keeps returning well-formed responses with normal latency, and you only learn the truth when labels arrive — after the chargeback, the appeal, or the churn window. That is why you alert on leading indicators such as feature and score distributions rather than waiting for accuracy to move."
        },
        {
          q: "Your ranker is trained on clicks collected from its own past results. What breaks, and what is the cheapest fix?",
          options: [
            "The log only contains items the model already chose to show, so you need a slice of exploration traffic and the logged probability of each impression",
            "The log becomes too large, so you need to downsample it",
            "Clicks are noisy, so you need to smooth them with a moving average",
            "Nothing breaks — training on your own serving logs is the standard, correct setup"
          ],
          answer: 0,
          explain: "Logged clicks tell you nothing about items you never displayed, so each generation of the model can only confirm the previous one's beliefs and the catalogue it draws from narrows. Randomizing a small slice of traffic puts unbiased observations into the log, and recording the probability with which each item was shown lets you reweight the rest. Both must happen at decision time — a propensity cannot be reconstructed afterwards."
        }
      ]
    }
  });

  /* ==================================================================
     4. Module: The Interview Framework
  ================================================================== */
  var MOD_FRAMEWORK = {
    id: "framework",
    name: "The Interview Framework",
    icon: "compass",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "what-is-mlsd",
        title: "What an ML design interview actually tests",
        summary: "The round looks like a systems design interview and is graded like a different exam. Start here, even if you have never trained a model.",
        minutes: 7,
        tags: ["intro", "mental-model"],
        blocks: [
          { t: "p", html: "An <strong>ML system design</strong> interview hands you a product — a feed, a search box, a fraud check, a moderation queue — and asks you to design the machine-learning system behind it. You get 45 minutes, a whiteboard, and an interviewer who will interrupt." },
          { t: "p", html: "It rhymes with a classic distributed-systems round, and that similarity is a trap. In a classic round the hard part is <em>capacity</em>: pick a datastore, size a cache, shard a key, survive a region failure. Here the infrastructure is mostly boring. The hard part is choosing an <strong>objective you can actually measure</strong> and then defending a modelling choice against the constraints you were given." },
          {
            t: "table",
            headers: ["", "Classic systems design", "ML system design"],
            rows: [
              ["The hard question", "Will it hold the load?", "Are we optimizing the right thing?"],
              ["Correctness means", "The write is durable and visible", "The prediction is useful, and we can prove it"],
              ["Main risk", "A component falls over", "The system works perfectly and helps nobody"],
              ["Failure is", "Loud — errors, timeouts, pages", "Silent — good latency, wrong answers"],
              ["Deliverable", "An architecture diagram", "A diagram plus an objective and a metric"]
            ]
          },
          { t: "note", variant: "tip", html: "You still need the systems skills. Load balancers, caches, queues and replication all show up here — you are just not graded on them first. If those words are unfamiliar, the Blueprint app covers them properly; this track assumes them and spends its time elsewhere." },
          { t: "h", text: "The three questions every answer has to close" },
          {
            t: "ol", items: [
              "<strong>What are you predicting?</strong> One sentence, one row of data at a time: given <em>this</em>, output <em>that</em>. If you cannot say it in one sentence, you do not have a problem yet.",
              "<strong>What do you learn from?</strong> Where the labels come from, who or what produced them, and how long they take to arrive.",
              "<strong>How do you know it worked?</strong> An offline metric you can compute before launch, and a business metric that decides whether the launch was worth it."
            ]
          },
          { t: "p", html: "Almost every weak answer is weak because one of those three is missing. Almost every strong answer states all three inside the first ten minutes and then spends the rest of the time defending them." },
          { t: "h", text: "Six words, so nothing later is jargon" },
          {
            t: "table",
            headers: ["Word", "What it means here"],
            rows: [
              ["Label", "The answer you wish you had — did the user click, was the post harmful, was the charge fraud."],
              ["Feature", "A number or category the model is allowed to look at when it makes a prediction."],
              ["Model", "A function fitted to past examples that maps features to a prediction."],
              ["Training", "Fitting that function offline, on a batch of historical examples."],
              ["Inference", "Running the fitted function on one live request. Also called serving or scoring."],
              ["Offline / online", "Offline is anything that happens on stored data, on a schedule. Online is anything on the request path, under a latency budget."]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Do not confuse this round with two neighbouring ones.</strong> It is not an ML coding round — nobody wants gradient descent implemented on the whiteboard. It is not an interview about using an AI coding assistant either. It is a design conversation about a system that happens to contain a model." },
          { t: "h", text: "Why the objective is the whole game" },
          { t: "p", html: "Take a moderation system. \"Remove harmful posts\" sounds like an objective and is not one: it says nothing about how much collateral damage is acceptable, so a model that deletes half the site technically satisfies it. \"Maximize accuracy\" sounds rigorous and is worse — when 99.9% of posts are fine, the model that approves everything scores 99.9% and you have built nothing." },
          {
            t: "compare",
            bad: { title: "Objective you cannot defend", items: ["\"Remove harmful posts\"", "No bound on wrongful removals", "No notion of which errors are expensive", "Every model looks like an improvement"] },
            good: { title: "Objective you can defend", items: ["\"Minimize views of harmful content, subject to a precision floor\"", "The floor bounds the cost to innocent users", "Views, not removals — exposure is the harm", "Two numbers, both measurable, both arguable"] }
          },
          { t: "p", html: "That ladder — from a vague wish to a bounded, measurable objective — is the single highest-scoring move in the round. <a href='#/mlsd/framework/problem-framing'>Framing the problem</a> is entirely about climbing it, with worked examples." },
          { t: "h", text: "The arc of this track" },
          {
            t: "ul", items: [
              "<strong>This module</strong> gives you the phase plan: a <a href='#/mlsd/framework/phase-plan'>six-phase plan with time budgets</a>, how to <a href='#/mlsd/framework/problem-framing'>frame the objective</a>, how to <a href='#/mlsd/framework/high-level-design'>sketch the system</a>, and what the <a href='#/mlsd/framework/assessment'>scoring dimensions</a> and <a href='#/mlsd/framework/level-expectations'>level bars</a> actually are.",
              "<strong>Modelling foundations</strong> supplies the vocabulary you will be asked to defend: representations, features and their failure modes, splits, generalization, and the <a href='#/mlsd/concepts/evaluation'>metric ladder</a> that decides whether any of it worked.",
              "<strong>Serving &amp; operations</strong> is the half most candidates skip: <a href='#/mlsd/serving/retrieval-ranking'>two-stage retrieval</a>, <a href='#/mlsd/serving/inference-architecture'>where inference runs</a>, <a href='#/mlsd/serving/drift-monitoring'>how you notice decay</a>, and <a href='#/mlsd/serving/feedback-loops'>how the system corrupts its own training data</a>.",
              "The <strong>breakdowns</strong> then run whole problems end to end — <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a>, <a href='#/mlcase/trust/harmful-content'>harmful content detection</a>, <a href='#/mlcase/retrieval/search-ranking'>search ranking</a> and more — using exactly this vocabulary."
            ]
          },
          { t: "cue", html: "You are in an ML design round, not a systems round, the moment the prompt contains a word like <em>relevant</em>, <em>personalized</em>, <em>recommended</em>, <em>detect</em>, <em>rank</em>, <em>predict</em> or <em>similar</em>. Those words mean the correct output is not defined by a specification — it has to be learned, and therefore measured." },
          { t: "note", variant: "key", html: "<strong>You are graded on whether you optimized the right thing, not on whether the boxes were drawn correctly.</strong> Say what you predict, where the labels come from, and how you will know it worked — in the first ten minutes, out loud, before anything else." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "phase-plan",
        title: "A six-phase plan with a clock on it",
        summary: "Where the 45 minutes go, why the first eight decide the other thirty-seven, and how the split tilts by problem flavour.",
        minutes: 9,
        tags: ["framework", "process"],
        blocks: [
          { t: "p", html: "A design round is a time-boxed conversation, and the most common way to fail it is to run out of clock with the interesting half unsaid. The fix is boring: decide in advance where the minutes go, announce the plan, and keep moving even when a phase feels unfinished." },
          { t: "h", text: "The six phases" },
          {
            t: "ol", items: [
              "<strong>Requirements &amp; scope (~5 min).</strong> Who uses it, what surface it appears on, rough scale, latency budget, and — most importantly — what is explicitly out of scope.",
              "<strong>Frame the ML objective (~3 min).</strong> Business goal → ML objective → the metric you will optimize and the constraint you will not violate.",
              "<strong>High-level design (~10 min).</strong> The offline path and the online path, drawn as boxes, with the logging arrow that connects them.",
              "<strong>Data &amp; features (~10 min).</strong> Where labels come from, what signal sources exist, and which of them will betray you.",
              "<strong>Training &amp; evaluation (~7 min).</strong> How you split, what you measure offline, and how the online test is designed.",
              "<strong>Deep dives (whatever remains).</strong> The one or two hard parts the interviewer keeps circling back to."
            ]
          },
          {
            t: "stat", items: [
              { v: "~5 min", k: "requirements & scope" },
              { v: "~3 min", k: "framing the objective" },
              { v: "~10 min", k: "high-level design" },
              { v: "~10 min", k: "data & features" },
              { v: "~7 min", k: "training & evaluation" },
              { v: "~10 min", k: "deep dives" }
            ]
          },
          { t: "note", variant: "tip", html: "Say the plan out loud at minute one: <em>\"I'll spend about five minutes on requirements, pin the objective, sketch the offline and online paths, then go deep wherever you want.\"</em> It costs fifteen seconds and it converts every later transition from an interruption into a scheduled handover." },
          { t: "widget", id: "mlsdBudget" },
          { t: "h", text: "Phase one: requirements you can design against" },
          { t: "p", html: "Five minutes is enough for four things, and you should ask for exactly these four." },
          {
            t: "ul", items: [
              "<strong>Surface and user.</strong> Where does the output appear, and who sees it? A ranked shelf on a home page and an automated deletion are different systems with the same model inside.",
              "<strong>Scale, to an order of magnitude.</strong> Millions or billions of items? Thousands or millions of requests per second? You need the exponent, not the number.",
              "<strong>Latency budget.</strong> Tens of milliseconds on a request path, or hours in a nightly job? This one decision eliminates most of the architecture space.",
              "<strong>Out of scope.</strong> Name two or three things you are not building — cold start for brand-new markets, multilingual support, the appeals workflow — and get agreement."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>The scoping trap is asking questions you will not use.</strong> If you ask about GDPR and then never mention data retention again, you spent thirty seconds proving you know an acronym. Ask only what will change a later decision, and say which decision it changes: <em>\"Is this on the request path? That decides whether the ranker can be a heavy model or has to be distilled.\"</em>" },
          { t: "h", text: "Phase two: three minutes that decide the round" },
          { t: "p", html: "Three minutes sounds too short for the most important phase. It is short because the output is small: two sentences and a constraint. Getting there is fast when you have practised the ladder, which is the entire subject of <a href='#/mlsd/framework/problem-framing'>the next lesson</a>." },
          {
            t: "code", lang: "text", code:
              "Business goal    : fewer users see harmful content\n" +
              "ML objective     : predict P(post violates policy | post, author, context)\n" +
              "Optimize         : views of violating content that we prevent\n" +
              "Subject to       : precision on auto-removal at or above an agreed floor\n" +
              "Out of scope     : appeals, human review staffing, policy authoring"
          },
          { t: "h", text: "Phases three to five, and the discipline of moving on" },
          { t: "p", html: "The middle three phases are where most of the content lives, and each has one thing that must not be skipped. High-level design must include the arrow from serving logs back into training data. Data and features must name at least one way the features could be lying to you. Training and evaluation must state how you split the data and why a random split would have been wrong." },
          { t: "p", html: "When a phase overruns, close it with a promise instead of finishing it: <em>\"There is more to say about the label pipeline — flag it and I'll come back if there's time.\"</em> Interviewers reward that. Silence while you think, or a fourth minute on a diagram, they do not." },
          { t: "h", text: "Phase six: choosing a deep dive" },
          { t: "p", html: "The deep dive is the elastic phase — it absorbs whatever the earlier phases left, which is why the planner above shrinks it hardest when the round is short. Offer the interviewer a choice rather than picking silently: <em>\"The two interesting parts here are the candidate generation strategy and how we keep the training data honest once the model is choosing what gets shown. Which is more useful?\"</em>" },
          {
            t: "compare",
            bad: { title: "Running the clock badly", items: ["Fifteen minutes of clarifying questions", "Architecture drawn before the objective exists", "Every phase finished perfectly, evaluation never reached", "Deep dive chosen by whoever talks first"] },
            good: { title: "Running the clock well", items: ["Plan announced at minute one", "Objective pinned by minute eight", "Phases closed with a promise, not perfection", "Deep dive offered as a choice"] }
          },
          { t: "cue", html: "Two phrases mean you are behind schedule and should skip forward: <em>\"one more clarifying question\"</em> after minute five, and <em>\"let me redraw that\"</em> at any point. Both are the sound of a phase refusing to close. Say what you have, name what is missing, and move." },
          { t: "note", variant: "key", html: "<strong>Announce the plan, pin the objective by minute eight, and let the deep dive absorb every overrun.</strong> A round that reaches evaluation with a mediocre architecture beats a beautiful architecture that never reaches evaluation." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "problem-framing",
        title: "Turning a business goal into an ML objective",
        summary: "The highest-value three minutes in the round: climbing from a vague wish to a bounded, measurable objective — with two worked ladders.",
        minutes: 11,
        tags: ["framework", "objectives"],
        blocks: [
          { t: "p", html: "Every prompt you will get is stated as a business wish. <em>Keep the platform safe. Make the feed more engaging. Show relevant results.</em> None of those is something a model can be trained against, and the gap between the wish and a trainable objective is where this round is won." },
          { t: "p", html: "The move is always the same. Take the wish, and ask two questions: <strong>what is the unit of harm or value</strong>, and <strong>what is the cost of being wrong in each direction</strong>? The first turns the wish into something countable. The second turns the count into a constrained objective." },
          { t: "note", variant: "tip", html: "Say the ladder out loud, including the rungs you reject. <em>\"The naive version is X, which fails because Y, so I'd rather optimize Z.\"</em> Rejecting a bad objective with a reason scores far higher than arriving at a good one silently — it shows the interviewer the reasoning they are actually grading." },
          { t: "h", text: "Worked ladder one: content moderation" },
          { t: "p", html: "The prompt: <em>\"Design a system that keeps harmful content off the platform.\"</em> Here is the ladder, worst rung first." },
          {
            t: "table",
            headers: ["Tier", "Objective", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "\"Remove the most harmful posts\"", "Unbounded false positives. Nothing in the objective says wrongful removals cost anything, so the degenerate solution — remove far more — scores better than the careful one. It also has no notion of which harms are worse than others."],
              ["<strong>Naive</strong>", "\"Maximize accuracy\"", "Class imbalance makes it meaningless. When 99.9% of posts are fine, approving everything scores 99.9%, and a genuinely useful model might score 99.7% while catching most of the harm. The metric cannot see the class you care about."],
              ["<strong>Solid</strong>", "\"Maximize harmful content removed, subject to a precision floor\"", "Now both errors are priced. The floor bounds the damage to innocent posts and is a number the policy team can argue about; recall becomes the thing you push. This is a defensible answer and most candidates stop here."],
              ["<strong>Standout</strong>", "\"Minimize <em>views</em> of harmful content, subject to that same floor\"", "Exposure is what actually causes harm. A post removed after a million views is a failure that the removal-count objective records as a success. Counting views makes latency, reach and prioritization part of the objective instead of separate nice-to-haves."]
            ]
          },
          { t: "p", html: "That last step is worth dwelling on, because it changes the system, not just the metric. If you optimize removals, a nightly batch job is fine. If you optimize views prevented, you now need fast scoring on the upload path, a way to prioritize high-reach accounts, and a reason to score a post again when it starts trending. The objective wrote the architecture." },
          { t: "note", variant: "warn", html: "<strong>A precision floor is not optional garnish.</strong> Without it, \"minimize views of harmful content\" is satisfied perfectly by removing the entire site. Any objective phrased as a single maximization has a degenerate solution; the constraint is what makes it a real problem. Expect to be asked where the floor number comes from — the honest answer is that it is a policy decision informed by the cost of an appeal, not something you derive." },
          { t: "h", text: "Worked ladder two: a recommendation surface" },
          { t: "p", html: "The prompt: <em>\"Design the system that decides what to show on the home shelf.\"</em> Same ladder, different failure modes." },
          {
            t: "table",
            headers: ["Tier", "Objective", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "\"Maximize clicks\"", "Clicks are cheap to manufacture. The optimizer discovers thumbnails and titles that provoke a tap and reveal nothing about whether the user was glad they tapped. You get a measurable win and a worse product, and the damage compounds because those clicks become tomorrow's training labels."],
              ["<strong>Solid</strong>", "\"Maximize watch time\"", "Consumption is harder to fake than a tap, so this fixes the worst of the click problem. But it has its own degenerate direction — long, low-value content and autoplay chains score well — and it says nothing about whether the user comes back."],
              ["<strong>Standout</strong>", "\"Maximize satisfying engagement, with retention as the north star\"", "Combine a consumption signal with explicit quality signals — completion rate, saves, surveys, and negative feedback like skips, hides and reports — and validate the whole thing against whether users return next week. Slow to measure, but it is the objective the product is actually judged on."]
            ]
          },
          { t: "p", html: "The catch, and you should name it before the interviewer does: retention is a terrible training target. It is delayed by days, attributable to a hundred causes, and far too coarse to supervise a per-item ranking decision. So you train on the fast proxy and you <em>validate</em> against the slow one." },
          {
            t: "code", lang: "text", code:
              "train on   : per-impression signals available in minutes\n" +
              "             (completion, save, skip, hide, report)\n" +
              "guard with : session-level quality metrics\n" +
              "judge by   : next-week retention, measured in the online test\n" +
              "\n" +
              "if the proxy moves and retention does not -> the proxy is wrong,\n" +
              "                                            not the experiment"
          },
          { t: "h", text: "The shape that generalizes" },
          { t: "p", html: "Both ladders climb the same three steps, and you can run them on any prompt in about ninety seconds." },
          {
            t: "ol", items: [
              "<strong>Find the unit of value or harm.</strong> Not the event you can log most easily — the thing that actually matters. Views, not removals. Satisfied sessions, not taps.",
              "<strong>Price both errors.</strong> What does a false positive cost, what does a false negative cost, and which one is worse here? If they are wildly asymmetric, say so; that asymmetry becomes your constraint.",
              "<strong>Write it as optimize-subject-to.</strong> One quantity you push, one constraint you refuse to violate. If you cannot phrase it that way, you have a wish, not an objective."
            ]
          },
          {
            t: "compare",
            bad: { title: "Proxy chosen for convenience", items: ["Clicks, because they are already logged", "Removals, because the tool counts them", "Accuracy, because it needs no discussion", "Optimizes what is easy to instrument"] },
            good: { title: "Proxy chosen and then defended", items: ["Named as a proxy, out loud", "Its degenerate solution stated in advance", "Bounded by a constraint that prices the other error", "Validated against the slow metric it stands in for"] }
          },
          { t: "note", variant: "trap", html: "<strong>Every proxy metric has a degenerate solution, and a sufficiently good optimizer will find it.</strong> Before you commit to one, finish this sentence: <em>\"The dumbest system that maxes this metric is …\"</em> If that sentence describes something you would be embarrassed to ship, you need the constraint before you need the model." },
          { t: "p", html: "The metric vocabulary underneath all of this — precision, recall, and why the choice of floor is a business decision rather than a modelling one — is covered in <a href='#/mlsd/concepts/evaluation'>the evaluation lesson</a>. For now it is enough to say the words in the right shape; that lesson makes them precise. If you want to see the moderation ladder driven all the way to an architecture, the <a href='#/mlcase/trust/harmful-content'>harmful content breakdown</a> does exactly that." },
          { t: "cue", html: "Reach for the ladder whenever the prompt contains a word that sounds measurable but is not: <em>engaging</em>, <em>relevant</em>, <em>safe</em>, <em>useful</em>, <em>high quality</em>, <em>spammy</em>. Each of those is a wish wearing a metric's clothing." },
          { t: "note", variant: "key", html: "<strong>Optimize one quantity, subject to one constraint, and say out loud what the degenerate solution would be.</strong> A candidate who rejects two objectives with reasons before choosing a third has already demonstrated the judgement the rest of the round is testing for." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "high-level-design",
        title: "Sketching the offline and online paths",
        summary: "Two loops on one whiteboard — and the arrow between them that most candidates forget to draw.",
        minutes: 9,
        tags: ["framework", "architecture"],
        blocks: [
          { t: "p", html: "Every ML system is two systems that share a model. The <strong>offline path</strong> runs on a schedule over stored data and produces a trained artifact. The <strong>online path</strong> runs on the request, under a latency budget, and produces a response. Draw both, always, even when the prompt only asks about one." },
          { t: "h", text: "The offline path" },
          {
            t: "code", lang: "text", code:
              "raw events ──> label construction ──> feature computation\n" +
              "                                            │\n" +
              "                                            v\n" +
              "                                   training dataset\n" +
              "                                            │\n" +
              "                                            v\n" +
              "                             training ──> evaluation ──> model registry\n" +
              "                                                              │\n" +
              "                                                     (promote if it beats\n" +
              "                                                      the incumbent)"
          },
          {
            t: "ul", items: [
              "<strong>Label construction</strong> is a design decision, not a given. Somebody decides that a watch counts at 30 seconds, or that a chargeback within 90 days means fraud. Say who decides and how long the label takes to arrive.",
              "<strong>Feature computation</strong> must reproduce, for a historical moment, the values the online path would have had at that moment. That is the whole subject of <a href='#/mlsd/concepts/feature-stores'>feature stores and point-in-time correctness</a>.",
              "<strong>Evaluation</strong> is a gate, not a report. Name the metric and the bar it has to clear before anything is promoted.",
              "<strong>The registry</strong> stores versioned artifacts with the data and code that produced them. It is what makes a rollback a one-line operation instead of an incident."
            ]
          },
          { t: "h", text: "The online path" },
          {
            t: "code", lang: "text", code:
              "request ──> candidate generation ──> ranking ──> business rules ──> response\n" +
              "                    │                    │                             │\n" +
              "            (cheap, high recall,   (expensive, high        (dedup, diversity,\n" +
              "             whole corpus)          precision, ~10^2       policy, freshness,\n" +
              "                                    candidates)             ads/organic mix)\n" +
              "                                                                      │\n" +
              "                                                                      v\n" +
              "                                                                  logging"
          },
          { t: "p", html: "Three things earn credit in this sketch. That retrieval is cheap and ranking is expensive, and why that split exists at all — the subject of <a href='#/mlsd/serving/retrieval-ranking'>two-stage retrieval</a>. That business rules are a separate stage rather than something smuggled into the model, so policy can change without retraining. And that the last box is logging." },
          { t: "h", text: "The arrow everyone forgets" },
          { t: "p", html: "Those two paths are usually drawn as two diagrams, and drawn that way they are both wrong. The online path's logs — what was requested, what was shown, in what order, and what happened next — <em>are</em> the raw events at the top of the offline path. The system trains on its own output." },
          {
            t: "code", lang: "text", code:
              "        ┌──────────────── OFFLINE ────────────────┐\n" +
              "        │  events -> labels -> features           │\n" +
              "        │        -> training -> eval -> registry  │\n" +
              "        └──────┬──────────────────────────┬───────┘\n" +
              "               │ model artifact           ^\n" +
              "               v                          │ logs\n" +
              "        ┌──────────────── ONLINE ─────────┴───────┐\n" +
              "        │  request -> retrieve -> rank            │\n" +
              "        │          -> rules -> response -> log    │\n" +
              "        └─────────────────────────────────────────┘"
          },
          { t: "note", variant: "trap", html: "<strong>Missing that arrow is the most common structural omission in this round</strong>, and it is expensive because everything interesting hangs off it. Without it you cannot explain where next month's labels come from, you cannot discuss <a href='#/mlsd/concepts/feature-pitfalls'>feedback loops</a>, and you cannot answer \"what happens if the model gets worse?\" — because you have not drawn the path along which it would get worse." },
          { t: "h", text: "What to log, decided at design time" },
          { t: "p", html: "Logging is cheap to add now and impossible to add retroactively. You cannot reconstruct, six months later, which items were shown and in what position. Name these at design time:" },
          {
            t: "ul", items: [
              "The <strong>request context</strong> and the <strong>feature values actually used</strong> — not the feature names, the values, so you can reconstruct the exact input later.",
              "The <strong>full candidate set and its ordering</strong>, not just what the user interacted with. Items shown and ignored are labels too.",
              "The <strong>position</strong> of every item, because position drives interaction independently of quality.",
              "The <strong>model version</strong> that produced the response, so an experiment can be attributed and a regression can be bisected.",
              "The <strong>probability with which each item was selected</strong>, when any randomization is in play. This one cannot be recovered afterwards — see <a href='#/mlsd/serving/feedback-loops'>feedback loops</a>."
            ]
          },
          {
            t: "compare",
            bad: { title: "Two disconnected diagrams", items: ["Offline pipeline on the left", "Serving stack on the right", "No path between them", "\"How do you retrain?\" has no answer"] },
            good: { title: "One loop", items: ["Registry feeds the serving layer", "Serving logs feed the training data", "Label delay marked on the arrow", "Retraining, drift and bias all have a place to live"] }
          },
          { t: "cue", html: "If you have drawn boxes for ten minutes and no arrow leaves the response, stop and add it. \"And the serving logs flow back here, which is where next week's training data comes from\" is one sentence and it unlocks half the remaining conversation." },
          { t: "note", variant: "key", html: "<strong>Draw one loop, not two pipelines.</strong> Model artifacts flow from offline to online; logs flow from online to offline. The second arrow is the one candidates forget, and it is the one every interesting follow-up question depends on." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "assessment",
        title: "The five dimensions you are scored on",
        summary: "What the interviewer is writing down, and the weak-versus-strong signal for each of the five things they grade.",
        minutes: 7,
        tags: ["framework", "assessment"],
        blocks: [
          { t: "p", html: "Interviewers do not score \"did they get it right\" — there is no right answer to design. They score a small number of dimensions, usually written on a form, and their notes are a list of signals. Knowing the list lets you supply the signals deliberately." },
          {
            t: "table",
            headers: ["Dimension", "Weak signal", "Strong signal"],
            rows: [
              ["<strong>Problem navigation</strong>", "Starts drawing immediately; asks broad questions with no use for the answers; never states the objective", "Scopes in five minutes, states the ML objective as optimize-subject-to, names what is out of scope and gets agreement"],
              ["<strong>ML fundamentals</strong>", "Names models by reputation; mixes up precision and recall; treats every metric as interchangeable", "Ties model choice to a constraint; picks a metric that survives the class balance; knows why a random split would leak here"],
              ["<strong>System design sense</strong>", "One monolithic model box; no latency budget; no logging; training and serving compute features independently", "Two-stage retrieval where it belongs; explicit latency decomposition; logs designed at design time; one loop, not two pipelines"],
              ["<strong>Pragmatism about trade-offs</strong>", "Reaches for the largest model available; presents choices as free; no fallback for cold start or failure", "Proposes the simplest thing that clears the bar; states cost in latency, money and maintenance; has a heuristic baseline and a fallback path"],
              ["<strong>Communication</strong>", "Long silences; unlabelled boxes; answers a question with the answer to a different one; defends every challenge", "Announces the plan; thinks out loud; labels the diagram; concedes a good point and adapts without losing the thread"]
            ]
          },
          { t: "note", variant: "tip", html: "Two of the five — pragmatism and communication — have nothing to do with machine learning, and they are the two most candidates neglect. They are also the cheapest to improve: announce your plan, name the cost of every choice, and say \"good point, that changes X\" when you are challenged." },
          { t: "h", text: "Signals you can supply on purpose" },
          {
            t: "ul", items: [
              "<strong>A baseline.</strong> \"Before any model, I'd ship popularity plus a blocklist and measure it. That is the bar the model has to beat.\" This one sentence hits pragmatism and problem navigation at once.",
              "<strong>A cost, attached to every choice.</strong> Not \"we'll use a two-tower model\" but \"a two-tower model, which costs us cross features between query and item — that is what the ranker is for.\"",
              "<strong>A named failure mode.</strong> \"The risk with this feature set is leakage from the review flag; I'd check the feature timestamps against the decision timestamps.\"",
              "<strong>A fallback.</strong> Every design gets asked what happens when a dependency is down or the user is brand new. Having an answer ready is worth more than the answer being clever.",
              "<strong>An explicit non-goal.</strong> \"I'm not going to design the human review queue — I'll assume it exists with a fixed daily capacity.\" Scope control reads as seniority."
            ]
          },
          { t: "h", text: "The failure modes that sink otherwise strong candidates" },
          {
            t: "compare",
            bad: { title: "What sinks the round", items: ["Complexity as a substitute for judgement", "Silence while thinking, for a minute at a time", "Defending a challenged decision reflexively", "Only the model discussed; data and evaluation skipped", "Precise-sounding numbers invented on the spot"] },
            good: { title: "What rescues it", items: ["The simplest design that clears the stated bar", "Narrating the search: \"two options here — …\"", "\"That's fair. If X, then I'd switch to Y.\"", "Time reserved for data, evaluation and operations", "Orders of magnitude, stated as estimates"] }
          },
          { t: "note", variant: "warn", html: "<strong>Do not invent precise numbers.</strong> \"Nearest-neighbour lookup is about 4.7 milliseconds\" invites a follow-up you cannot survive; \"single-digit to low tens of milliseconds, depending on index type and recall target\" is both true and unattackable. Interviewers read false precision as a bluff, and one bluff makes them re-examine everything else you said." },
          { t: "p", html: "The bar for each of these dimensions moves with the level you are interviewing at, and the difference is not what most people assume. <a href='#/mlsd/framework/level-expectations'>The next lesson</a> lays out what mid, senior and staff actually require." },
          { t: "cue", html: "Certain interviewer moves are the dimension being probed out loud. <em>\"Why not something simpler?\"</em> is pragmatism. <em>\"What if that service is down?\"</em> is system design sense. <em>\"How would you know this is working?\"</em> is problem navigation. <em>\"Walk me through that again\"</em> is communication — and it usually means the last thing you said did not land, not that they missed it." },
          { t: "note", variant: "key", html: "<strong>Three of the five dimensions are about judgement and communication, not machine learning.</strong> Supply the signals deliberately: a baseline, a cost attached to every choice, a named failure mode, a fallback, and an explicit non-goal." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "level-expectations",
        title: "What mid, senior and staff actually require",
        summary: "The same prompt, three different bars — and why the staff bar is about scope, not about knowing more.",
        minutes: 7,
        tags: ["framework", "calibration"],
        blocks: [
          { t: "p", html: "Everyone gets roughly the same prompt. What changes is how much of the problem you are expected to own without being asked, and how much ambiguity you are expected to resolve yourself. It is not a knowledge ladder — a staff answer is often <em>simpler</em> than a senior one." },
          {
            t: "table",
            headers: ["Level", "Expected to do without prompting", "What still gets a pass", "What fails it"],
            rows: [
              ["<strong>Mid</strong>", "Follow a sensible structure; pick a reasonable model and features; compute the right offline metric; describe training and serving as separate paths", "Needing the interviewer to steer toward evaluation, cold start or drift; a straightforward architecture with no deep dive", "Never stating what is predicted; confusing precision and recall; no idea where labels come from"],
              ["<strong>Senior</strong>", "State the objective as optimize-subject-to; draw the full loop including logging; name leakage, cold start and drift unprompted; design the online test; go deep on one hard part", "Missing one operational concern if the rest is coherent; a rough cost estimate rather than a precise one", "An architecture with no failure story; optimizing a proxy without naming its degenerate solution; no fallback path"],
              ["<strong>Staff</strong>", "Challenge the framing itself; sequence delivery so value lands before the expensive parts; name what you would <em>not</em> build; connect the design to team cost, on-call load and the second-order effects on the product", "Deferring a modelling detail — \"I'd benchmark two options here\" — when the trade-off is stated correctly", "Designing the maximal system; treating the requirements as fixed; no view on what happens to the system after launch"]
            ]
          },
          { t: "h", text: "The same question, three answers" },
          { t: "p", html: "Take the interviewer asking: <em>\"How would you handle brand-new items that nobody has interacted with?\"</em>" },
          {
            t: "ul", items: [
              "<strong>Mid:</strong> \"Cold start. I'd use content features for new items so they can still be ranked.\" Correct, complete, waited to be asked.",
              "<strong>Senior:</strong> \"That's the cold-start path, and I'd already planned for it — the item tower runs on content features only, so a new item gets an embedding at publish time. I'd also reserve a small exploration slot so new items get impressions and generate their own interaction data.\" Anticipated, and connected to the data problem underneath.",
              "<strong>Staff:</strong> \"Before the mechanism: how much of the catalogue is new in a given week? If it's two percent, an exploration slot and content features are plenty and I'd not build more. If it's forty percent — a marketplace with constant new listings — cold start isn't an edge case, it's the main workload, and I'd design the retrieval stage around content similarity from the start rather than bolting it on.\" Made the scope of the problem the first question."
            ]
          },
          { t: "note", variant: "tip", html: "The staff move in that example is not extra knowledge. It is refusing to answer a design question before knowing whether the case is rare or dominant — and then committing to a smaller build in one branch. You can practise that on any question: ask how big the case is before you design for it." },
          { t: "h", text: "Calibrating yourself honestly" },
          {
            t: "ol", items: [
              "Record yourself designing one problem end to end with a 45-minute timer running.",
              "Play it back and mark, for each of the <a href='#/mlsd/framework/assessment'>five dimensions</a>, whether the signal was weak or strong.",
              "Count how many operational concerns — leakage, cold start, drift, feedback loops, fallback — you raised before being asked. Zero is mid, two or three is senior.",
              "Check whether you ever narrowed the scope. If you only ever added to the design, you were interviewing below the staff bar regardless of the content."
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Interviewing above your level is a real failure mode.</strong> If you challenge the framing but cannot then execute a clean design, you score worse than someone who executed the obvious design well. Earn the right to reframe by being fast and correct on the fundamentals first." },
          { t: "p", html: "Every breakdown in this app closes with a version of this table, calibrated to that specific problem — <a href='#/mlcase/recsys/feed-ranking'>feed ranking</a> and <a href='#/mlcase/trust/bot-detection'>bot detection</a> are good places to see how the bars differ once the problem is concrete." },
          { t: "cue", html: "The moment to reach for the staff move is when a question presupposes a build: <em>\"how would you handle X?\"</em> Before answering, ask how large X is. If the honest answer is \"rare\", say you would not design for it beyond a fallback — and then be specific about the fallback so it reads as judgement rather than avoidance." },
          { t: "note", variant: "key", html: "<strong>The staff bar is scope judgement, not knowledge depth.</strong> Mid executes a sensible design; senior anticipates the operational failures; staff decides which system deserves to be built at all and says out loud what it will not build." },
          { t: "quiz", id: "mlsd-framework" }
        ]
      }
    ]
  };

  /* ==================================================================
     5. Module: Modelling Foundations
  ================================================================== */
  var MOD_CONCEPTS = {
    id: "concepts",
    name: "Modelling Foundations",
    icon: "blocks",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "embeddings",
        title: "Embeddings: why dense representations exist",
        summary: "From matrix factorisation to two-tower models to graph embeddings — what each one buys you, and the bill that comes with it.",
        minutes: 9,
        tags: ["representations", "embeddings"],
        blocks: [
          { t: "p", html: "A model cannot compare two things it has no way to represent. Give it a user id and an item id and it sees two arbitrary integers: nothing about id 4471 says it is similar to id 9082. An <strong>embedding</strong> fixes that by mapping each entity to a vector of numbers, learned so that <em>similar entities land near each other</em>." },
          { t: "p", html: "Once entities live in the same vector space, three expensive operations become cheap. Similarity is a dot product. \"Find me things like this\" is a nearest-neighbour lookup. And a cold, sparse identifier becomes a dense feature a model can generalize from." },
          { t: "note", variant: "tip", html: "The interview-grade definition, in one sentence: <em>\"An embedding is a learned, low-dimensional vector for an entity, trained so that geometric closeness in that space means whatever the training objective said similarity means.\"</em> The last clause is the one people drop, and it is the one that matters — an embedding trained on co-purchase encodes something different from one trained on co-view." },
          { t: "h", text: "Rung one: matrix factorisation" },
          { t: "p", html: "Lay out every user-item interaction as a giant, mostly empty matrix. Factor it into two thin matrices — one row per user, one row per item — such that the dot product of a user row and an item row reconstructs the observed interactions. Those rows are your embeddings, and they were learned purely from who interacted with what." },
          {
            t: "code", lang: "text", code:
              "interactions R  ~  U  x  V^T\n" +
              "  (n_users x n_items)   (n_users x d)   (d x n_items)\n" +
              "\n" +
              "score(user u, item i) = dot(U[u], V[i])\n" +
              "d is typically tens to a few hundred"
          },
          {
            t: "compare",
            bad: { title: "What it costs", items: ["No vector at all for a user or item with no interactions — cold start is fatal, not degraded", "Cannot use side features: an item's title, language and category are invisible", "Refreshing means refactorizing; new entities wait for the next run", "One global notion of taste, with no context"] },
            good: { title: "What it buys", items: ["Collaborative signal with no feature engineering at all", "Scoring is a dot product — trivially cheap", "Strong baseline on dense interaction data", "Easy to explain and to debug"] }
          },
          { t: "h", text: "Rung two: two-tower models" },
          { t: "p", html: "Replace the two lookup tables with two <strong>neural encoders</strong>. One tower turns everything you know about the query side — the user, their recent history, the context — into a vector. The other turns everything you know about an item into a vector of the same size. Train them jointly so that the dot product of a matching pair scores higher than mismatched pairs." },
          {
            t: "code", lang: "text", code:
              "query side                    item side\n" +
              "  user features                  content features\n" +
              "  recent history                 category, language\n" +
              "  context (time, device)         creator, age\n" +
              "        |                              |\n" +
              "     tower_q                        tower_i\n" +
              "        |                              |\n" +
              "        v                              v\n" +
              "      q_vec  ------ dot product ----- i_vec\n" +
              "\n" +
              "the towers never see each other until this dot product"
          },
          { t: "p", html: "That last line is the whole design. Because the towers are independent, every item vector can be computed offline, in bulk, and loaded into an index — so retrieval over a corpus of millions becomes one query-tower forward pass plus a nearest-neighbour lookup. This is what <a href='#/mlsd/concepts/ann-serving'>approximate nearest-neighbour serving</a> is built for, and why the same design shows up in <a href='#/mlcase/retrieval/rag-assistant'>retrieval-augmented assistants</a> as well as in recommenders." },
          { t: "p", html: "It also cuts cold start down to size. A brand-new item has no interactions, but it does have a title, a category and a creator — so the item tower produces a usable vector at publish time. The representation degrades instead of failing." },
          { t: "note", variant: "warn", html: "<strong>The independence that makes two-tower models servable is exactly what limits them.</strong> A single dot product cannot represent \"this user likes short videos <em>only</em> in the evening <em>and only</em> from creators they follow.\" Interactions of that kind need a model that sees both sides at once, which is far too expensive to run over a whole corpus — hence <a href='#/mlsd/serving/retrieval-ranking'>a cheap retrieval stage and an expensive ranking stage</a>." },
          { t: "h", text: "Rung three: graph embeddings" },
          { t: "p", html: "Users, items and their interactions form a graph. Graph embedding methods learn a vector for each node by repeatedly mixing in information from its neighbours, so a node's representation absorbs its two-hop and three-hop neighbourhood, not just its direct edges." },
          {
            t: "table",
            headers: ["", "Buys you", "Costs you"],
            rows: [
              ["Matrix factorisation", "Collaborative signal for free; dot-product scoring", "Nothing for new entities; no side features; transductive"],
              ["Two-tower", "Arbitrary features on both sides; item side precomputable and indexable; cold start degrades gracefully", "No query-item interaction before the final dot product; needs negative sampling done carefully"],
              ["Graph", "Multi-hop signal; sparse nodes borrow from well-connected neighbours; naturally handles several edge types", "Expensive to train and refresh; harder to serve incrementally; inherits and amplifies popularity bias in the graph"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Negative sampling is where two-tower models are usually broken, and it is rarely discussed.</strong> The model learns from pairs that should score high against pairs that should score low, and if your negatives are drawn uniformly at random, almost all of them are trivially unrelated — so the model learns to separate obvious mismatches and stays useless at the hard, near-miss decisions retrieval actually faces. Mixing in-batch negatives with sampled hard negatives is the usual answer, and popularity correction is usually needed on top." },
          { t: "h", text: "Sizing and refreshing, without inventing numbers" },
          {
            t: "ul", items: [
              "<strong>Dimensionality</strong> is a capacity knob like any other: too small and distinct tastes collapse together, too large and you overfit and pay for memory and lookup. Typical production sizes are in the tens to low hundreds, chosen empirically rather than derived.",
              "<strong>Memory</strong> is the sober constraint. Vectors times dimensions times bytes per value, and it is easy for a large catalogue to reach tens of gigabytes in full precision — which is why <a href='#/mlsd/concepts/ann-serving'>quantization</a> exists.",
              "<strong>Refresh cadence</strong> is a design decision: items typically get an embedding at publish time, while the towers themselves are retrained on a much slower schedule. Say both cadences out loud — an interviewer will ask.",
              "<strong>Version skew is a real outage.</strong> If the query tower is upgraded and the index still holds vectors from the previous item tower, the dot products are meaningless and nothing errors. Rebuild the index and the query encoder together, or version the space explicitly."
            ]
          },
          { t: "cue", html: "Reach for embeddings when the prompt contains <em>similar</em>, <em>related</em>, <em>you might also like</em>, <em>semantic</em>, or any request to compare two things that have no natural numeric representation. Reach for a two-tower shape specifically when the corpus is too big to score item by item." },
          { t: "note", variant: "key", html: "<strong>Two-tower models are a retrieval architecture, not an accuracy trick.</strong> The towers stay independent so item vectors can be precomputed and indexed; that is what makes searching millions of items feasible, and it is exactly why a separate ranking stage with cross features still has to exist." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "ann-serving",
        title: "Approximate nearest neighbours",
        summary: "Exact search does not survive contact with production. The recall-latency knob, and the three families of index that give you one.",
        minutes: 9,
        tags: ["retrieval", "serving"],
        blocks: [
          { t: "p", html: "You have a query vector and a corpus of item vectors, and you want the closest few. Exact search is trivially correct: compare the query against every item and keep the best. It is also, at production scale, arithmetic you cannot afford." },
          { t: "h", text: "Why exact search loses" },
          { t: "p", html: "Every query costs one similarity computation per item, and each of those is proportional to the vector dimension. Multiply corpus size by dimension by queries per second and the total work grows to the point where you would be buying machines purely to compute dot products you are going to throw away." },
          {
            t: "code", lang: "text", code:
              "exact scan, per query:\n" +
              "  work  ~  N items  x  d dimensions\n" +
              "\n" +
              "N = 10^7 items, d = 128  ->  ~10^9 multiply-adds  per query\n" +
              "and you have a budget measured in single-digit milliseconds,\n" +
              "shared with feature fetch and the ranker.\n" +
              "\n" +
              "the numbers vary by hardware and library; the conclusion\n" +
              "does not."
          },
          { t: "note", variant: "tip", html: "Exact search is still the right answer more often than people expect. Below roughly a hundred thousand vectors, a well-implemented brute-force scan is fast, exact, trivial to operate and has no index to rebuild. Say that out loud before reaching for an approximate index — it is a pragmatism signal and it is frequently true." },
          { t: "h", text: "The knob: recall versus latency" },
          { t: "p", html: "Approximate indices work by refusing to look at most of the corpus. Every one of them exposes some version of \"how hard should I look\", and that knob trades search effort against <strong>recall</strong> — the fraction of the true nearest neighbours that actually come back." },
          {
            t: "table",
            headers: ["Turn the knob down", "Turn the knob up"],
            rows: [
              ["Visits fewer candidates", "Visits more candidates"],
              ["Lower latency, higher throughput", "Higher latency, lower throughput"],
              ["Lower recall — real neighbours get missed", "Recall approaches exact search"],
              ["Cheaper per query", "More CPU and memory traffic per query"]
            ]
          },
          { t: "p", html: "The right way to set it is empirical and it is a good thing to say out loud: take a sample of real queries, compute the exact answer offline once, then sweep the knob and plot recall against latency. Pick the cheapest setting whose recall the downstream ranker cannot tell apart from exact." },
          { t: "note", variant: "warn", html: "<strong>Retrieval recall and the model's recall are different things with the same name.</strong> Here it means \"did the index return the true nearest vectors\". In <a href='#/mlsd/concepts/evaluation'>evaluation</a> it means \"of all genuinely relevant items, what fraction did the system surface\". An index at 90% recall is not a system at 90% recall; say which one you mean." },
          { t: "h", text: "Three families, conceptually" },
          {
            t: "table",
            headers: ["Family", "Idea", "The knob", "Character"],
            rows: [
              ["<strong>Partition / inverted file</strong>", "Cluster the corpus once; at query time compare only against the few clusters nearest the query", "How many clusters to probe", "Simple, memory-light, easy to reason about; recall suffers when the true neighbour sits just across a cluster boundary"],
              ["<strong>Graph-based</strong>", "Link each vector to its near neighbours, then greedily walk that graph from an entry point toward the query", "How wide to search — how many candidates to keep on the frontier", "Usually the best recall-per-millisecond; costs the most memory, and incremental deletion is awkward"],
              ["<strong>Quantization</strong>", "Compress vectors into short codes so distances are approximated from small lookup tables", "Code size — bits per vector", "Cuts memory by a large factor, which is often what makes the index fit at all; every bit you remove costs accuracy"]
            ]
          },
          { t: "p", html: "In practice these compose rather than compete. Partitioning to narrow the search and quantization to shrink what you store is a very common pairing; graph indices are often used where memory is available and latency is the binding constraint. What you should carry into an interview is the shape of the trade-off, not a library recommendation." },
          {
            t: "stat", items: [
              { v: "recall", k: "the thing you are trading away" },
              { v: "memory", k: "usually the binding constraint" },
              { v: "rebuild", k: "the operational cost nobody plans for" },
              { v: "single-digit ms", k: "order of magnitude for a tuned index" }
            ]
          },
          { t: "note", variant: "trap", html: "<strong>State latencies as ranges and say what they depend on.</strong> A tuned index over a corpus in the millions typically answers in single-digit to low-tens of milliseconds, but that number moves with dimension, recall target, index family, memory pressure and how many results you ask for. A precise figure quoted without those caveats is a claim you will be asked to defend and cannot." },
          { t: "h", text: "The operational half nobody prepares for" },
          {
            t: "ul", items: [
              "<strong>Updates.</strong> Most index structures are built, not edited. New items usually land in a small, frequently-rebuilt shard that is searched alongside the big one and periodically merged in. Say this — it is the difference between a design and a diagram.",
              "<strong>Deletes.</strong> Usually a tombstone plus filtering after retrieval, with a real rebuild on a slower cycle. This matters when deletion is a legal obligation rather than a nicety.",
              "<strong>Filtering.</strong> \"Nearest neighbours, but only in this locale and not blocked for this user\" is harder than it sounds: filter after retrieval and a heavily-filtered query can come back nearly empty; filter during traversal and you complicate the index. Over-fetching and then filtering is the common compromise.",
              "<strong>Sharding.</strong> Split the corpus, query every shard, merge the top results. Latency becomes the slowest shard's latency, so the tail matters more than the mean."
            ]
          },
          { t: "cue", html: "You need an approximate index when the prompt involves finding a handful of items out of millions by similarity, under a request-time budget: semantic search, candidate generation, near-duplicate detection, \"more like this\". You do not need one when the corpus is small, when the filter narrows the space to a few thousand anyway, or when the answer can be precomputed." },
          { t: "note", variant: "key", html: "<strong>Approximate search buys latency with recall, and every index family is just a different way of spending that.</strong> Measure recall against exact search on a query sample, pick the cheapest setting the ranker cannot distinguish from exact, and have an answer ready for updates, deletes and filtering." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "feature-engineering",
        title: "Five sources of signal",
        summary: "The user, the item, the interaction history, the context, and the crosses between them — with what each one costs to serve.",
        minutes: 9,
        tags: ["features"],
        blocks: [
          { t: "p", html: "When an interviewer asks \"what features would you use?\", the failure mode is a shapeless list. The fix is a taxonomy you can walk in order, because it makes the answer complete and it makes the gaps visible. There are five places signal comes from." },
          {
            t: "ol", items: [
              "<strong>The user.</strong> Who is asking — attributes, stated preferences, account age, subscription tier, historical aggregates.",
              "<strong>The item.</strong> What is being scored — category, language, creator, length, price, quality scores, and increasingly a content embedding.",
              "<strong>The interaction history.</strong> What this user has done — clicked, watched, skipped, saved, reported — usually summarized over several time windows.",
              "<strong>The context.</strong> The circumstances of this specific request — time of day, day of week, device, network, locale, entry surface, session position.",
              "<strong>Cross-features.</strong> This user against this item — affinity for the creator, match with preferred language, distance in embedding space between the user's history and the item."
            ]
          },
          { t: "widget", id: "mlsdFeatureLab" },
          { t: "h", text: "Why the ordering in that list matters" },
          { t: "p", html: "It is roughly the order of increasing lift and increasing fragility. Context features are nearly free and always available and buy the least. Interaction history buys the most and is empty exactly when a new user arrives. Cross-features are where the personalization actually lives, and they are also the most expensive to compute at request time and the most likely to be computed differently in training than in serving." },
          {
            t: "table",
            headers: ["Source", "Typical lift", "Serving cost", "Cold start"],
            rows: [
              ["Context", "Small but nearly free", "Negligible — comes with the request", "Always available"],
              ["User profile", "Modest", "One key-value lookup", "Available at signup, thin at first"],
              ["Item / content", "Moderate", "One lookup, cacheable across users", "Available at publish — the lever that makes new items rankable"],
              ["Interaction history", "Largest single source", "Heaviest lookup; often a list to aggregate", "Empty for a new user — this is where cold start hurts"],
              ["Cross-features", "Large, and the source of actual personalization", "Computed per candidate, so cost scales with candidate count", "Needs both sides populated to mean anything"]
            ]
          },
          { t: "note", variant: "tip", html: "Cross-features are computed <em>per candidate</em>, not per request. If you are ranking five hundred candidates, a cross-feature that takes a hundred microseconds costs fifty milliseconds. That arithmetic is why heavy cross-features live in the ranking stage and never in retrieval — see <a href='#/mlsd/serving/retrieval-ranking'>two-stage retrieval</a>." },
          { t: "h", text: "Three transformations worth naming out loud" },
          {
            t: "ul", items: [
              "<strong>Windowed aggregates.</strong> Not \"how many videos has this user watched\" but the same count over the last hour, day, week and quarter. Multiple windows let the model see both a stable taste and a sudden change, and the short windows are what make a session feel responsive.",
              "<strong>Ratios and rates instead of raw counts.</strong> A creator with 100 likes from 200 impressions and one with 100 likes from 100,000 impressions are not the same creator. Rates need smoothing toward a prior, or a brand-new item with one click reads as a perfect item.",
              "<strong>Bucketing continuous values.</strong> Age, price and duration usually matter non-monotonically — the interesting thing is the band, not the number. Tree models find bands themselves; linear and neural models generally need help."
            ]
          },
          {
            t: "code", lang: "text", code:
              "smoothed rate, so one lucky impression is not a 100% CTR:\n" +
              "\n" +
              "  rate = (clicks + a * prior) / (impressions + a)\n" +
              "\n" +
              "  prior = the global average rate\n" +
              "  a     = strength of the prior, in pseudo-impressions\n" +
              "\n" +
              "  low volume -> answer sits near the prior\n" +
              "  high volume -> answer approaches the observed rate"
          },
          { t: "h", text: "What to say when asked for \"more features\"" },
          { t: "p", html: "Adding a sixth idea to a list of five is a weak answer. A strong answer changes axis: <em>\"Rather than more features of the same kind, the bigger wins are usually a shorter window on the history features, so the session reacts within a few items; and negative signals — skips, hides, reports — which most designs ignore and which carry a lot of information.\"</em> Negative feedback in particular is under-used and easy to name." },
          { t: "note", variant: "warn", html: "<strong>Every feature you add is a dependency on the request path.</strong> A feature is not free because it exists in a table: it is a lookup that can be slow, a service that can be down, a schema that can change, and a definition that can drift between training and serving. \"What is my fallback when this feature is missing?\" should have an answer before the feature ships — a default value the model saw during training, not a null it has never encountered." },
          { t: "cue", html: "When asked for features, walk the five sources out loud in order and say which one dominates for <em>this</em> problem. For a feed it is interaction history; for fraud it is velocity and device context; for search it is query-document crosses; for a marketplace with constant new listings it is item content, because history barely exists." },
          { t: "note", variant: "key", html: "<strong>Walk the five sources — user, item, history, context, crosses — and name the cost of each.</strong> Interaction history gives the biggest lift and the worst cold start; cross-features cost per candidate, which is why they belong to the ranker and not to retrieval." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "feature-pitfalls",
        title: "The five ways features betray you",
        summary: "Leakage, cold start, feedback loops, adversarial drift and distribution drift — each with how you detect it and what you do about it.",
        minutes: 10,
        tags: ["features", "failure-modes"],
        blocks: [
          { t: "p", html: "Features fail in ways that a metric does not catch, because the metric is computed on data that contains the same flaw. Each of the five below has a signature you can look for and a mitigation you can name — and naming one unprompted is one of the clearest senior signals in the round." },
          { t: "h", text: "1. Leakage: a feature that encodes the label" },
          { t: "p", html: "<strong>Leakage</strong> is information in your training features that will not be available, in that form, at the moment you actually have to predict. The model finds it instantly, the offline metric looks superb, and production is a disaster." },
          {
            t: "ul", items: [
              "<strong>Target leakage.</strong> A feature that is a consequence of the label rather than a cause of it. Predicting fraud with <code class='tok'>times_manually_reviewed</code> — reviews happen <em>because</em> fraud was suspected. Predicting churn with <code class='tok'>received_retention_offer</code> — the offer was triggered by the churn model.",
              "<strong>Temporal leakage.</strong> A feature computed from data that did not exist yet at prediction time. Joining today's <code class='tok'>account_lifetime_orders</code> onto an event from six months ago hands every historical row an answer from its own future.",
              "<strong>Preprocessing leakage.</strong> Fitting a scaler, an imputer or a vocabulary over the whole dataset and <em>then</em> splitting. The validation set's statistics are now baked into the training transform, so the validation score is optimistic.",
              "<strong>Group leakage.</strong> The same user, or a near-duplicate item, present on both sides of the split. The model memorizes the entity instead of learning the pattern, and scores brilliantly on entities it has already met."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>The signature of leakage is a metric that is too good.</strong> If your first model achieves something close to perfect on a genuinely hard problem, do not celebrate — go looking. Rank features by importance, take the top one or two, remove them, and retrain. If the metric collapses to something plausible, you found it. The systematic version of this check is to compare every feature's computation timestamp against the decision timestamp, which is what <a href='#/mlsd/concepts/feature-stores'>point-in-time correctness</a> automates." },
          { t: "h", text: "2. Cold start: no history to stand on" },
          { t: "p", html: "A new user, a new item, a new market. The features that carry most of your lift are empty, and the model does not know it is guessing — it produces confident predictions from default values it barely saw during training." },
          {
            t: "table",
            headers: ["Flavour", "Detect it by", "Mitigate with"],
            rows: [
              ["New user", "Segmenting metrics by account age; day-one quality against day-thirty", "Content and context features only; a popularity or editorial fallback; onboarding that collects a preference cheaply"],
              ["New item", "Measuring how long an item waits for its first impressions, and what share of the catalogue never gets any", "Content-based embeddings at publish time; a reserved exploration slot so new items earn their own data"],
              ["New market or locale", "Comparing feature null rates across locales", "Transfer from a similar market; explicitly wider exploration until data accumulates"]
            ]
          },
          { t: "note", variant: "tip", html: "Cold start is not one problem, and saying which flavour dominates is the calibration signal. On a marketplace with constant new listings, item cold start is not an edge case — it is the main workload, and it should shape the retrieval stage rather than being handled by a fallback." },
          { t: "h", text: "3. Feedback loops: the model shapes its own training data" },
          { t: "p", html: "Your model chooses what gets shown. Users can only interact with what was shown. Those interactions become the training data for the next model, which therefore learns mostly that the previous model was right. The catalogue the system draws from narrows, quietly, every cycle." },
          {
            t: "code", lang: "text", code:
              "model v1 ranks  ->  impressions  ->  clicks  ->  training data\n" +
              "     ^                                                  |\n" +
              "     |                                                  v\n" +
              "     +----------------------------------------  model v2\n" +
              "\n" +
              "nothing enters this loop from outside unless you put it there"
          },
          { t: "p", html: "Detection is by coverage rather than by accuracy: track the share of the catalogue that receives any impressions, and watch it over weeks. Accuracy metrics will look fine the entire time, because they are computed on the narrowed distribution. Mitigation is exploration and propensity logging, which is involved enough to get <a href='#/mlsd/serving/feedback-loops'>a lesson of its own</a>." },
          { t: "h", text: "4. Adversarial drift: an opponent adapts" },
          { t: "p", html: "In spam, fraud, abuse and bot detection your input distribution is not drifting — it is being <em>moved</em>, on purpose, by someone reading your decisions as feedback. Every block teaches them something, and the more accurate your model becomes, the faster they learn." },
          {
            t: "compare",
            bad: { title: "Ordinary drift", items: ["Changes gradually and for external reasons", "Retraining on recent data fixes it", "A stable feature keeps working", "A slow retrain cadence is fine"] },
            good: { title: "Adversarial drift", items: ["Changes abruptly, in direct response to you", "Retraining teaches the opponent your new boundary too", "Any easily-observable feature gets evaded first", "Cadence, cost of evasion and hidden signals all matter"] }
          },
          {
            t: "ul", items: [
              "<strong>Detect it</strong> by watching for sharp changes in the score distribution rather than gradual ones, and by tracking how quickly a newly-blocked pattern is replaced by a variant.",
              "<strong>Prefer features that are expensive to change.</strong> A user agent string costs nothing to fake; a coherent behavioural pattern over weeks, or the economics of acquiring aged accounts, costs real money. Lean on the expensive ones.",
              "<strong>Do not leak your decision boundary.</strong> Instant, precise feedback on every block is a free gradient signal for the attacker; delayed, batched or coarse enforcement raises the cost of probing.",
              "<strong>Retrain faster and keep humans in the loop</strong>, because the labels themselves shift meaning. The <a href='#/mlcase/trust/bot-detection'>bot detection breakdown</a> works through this end to end."
            ]
          },
          { t: "h", text: "5. Distribution drift: the world moves" },
          { t: "p", html: "No adversary, no bug — the world simply stops resembling your training set. A new product launches, a locale opens, an upstream team changes a default, a holiday arrives. The model keeps returning well-formed predictions and slowly becomes wrong." },
          {
            t: "table",
            headers: ["Kind", "What changed", "Typical response"],
            rows: [
              ["Covariate shift", "The inputs changed; the relationship between inputs and label did not", "Retrain on recent data; reweight toward the current distribution"],
              ["Concept drift", "The same inputs now imply a different label", "Retrain more often; shorten the training window; revisit the label definition"],
              ["Schema or upstream change", "A producer changed a unit, a default, an enum, or started sending nulls", "Contract tests and null-rate alarms on every input feature — the cheapest, highest-yield monitoring you can add"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>The third row is the one that actually pages you.</strong> Genuine concept drift is usually slow. An upstream team shipping a change that turns a feature into nulls, or switches a currency from cents to units, is instant and total — and to the model it is indistinguishable from the world changing. Alarm on null rates and value ranges per feature; it is a few lines of monitoring and it catches more real incidents than any drift statistic. <a href='#/mlsd/serving/drift-monitoring'>Drift monitoring</a> covers how to build it." },
          { t: "cue", html: "Name the relevant betrayal unprompted, matched to the problem: leakage whenever a feature could be a consequence of the label; cold start whenever new users or items are a meaningful share of traffic; feedback loops whenever the model chooses what gets shown; adversarial drift whenever there is a human on the other side who profits; distribution drift always." },
          { t: "note", variant: "key", html: "<strong>An offline metric cannot detect a flaw that its own data shares.</strong> Leakage looks like brilliance, feedback loops look like stability, and adversarial drift looks like a good week. Each has a detection method that lives outside the metric — timestamp checks, coverage tracking, score-distribution monitoring — and naming one before you are asked is the strongest single signal in this module." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "feature-stores",
        title: "Feature stores and training/serving skew",
        summary: "What the thing is actually for: one definition, two read paths, and historical values that are honest about what was knowable when.",
        minutes: 8,
        tags: ["features", "infrastructure"],
        blocks: [
          { t: "p", html: "A feature store is usually introduced as \"a database for features\", which explains nothing — you already have databases. It exists to prevent one specific, expensive, silent failure: <strong>training/serving skew</strong>." },
          { t: "h", text: "The failure it prevents" },
          { t: "p", html: "The same feature gets implemented twice. Once in the training pipeline, in a batch job over a warehouse, by whoever built the model. Once in the serving path, in an online service, by whoever built the API — often a different person, in a different language, months apart. Both are called <code class='tok'>user_purchases_30d</code>. They are not the same number." },
          {
            t: "table",
            headers: ["Where they diverge", "Training says", "Serving says"],
            rows: [
              ["Window boundary", "Last 30 calendar days, warehouse time zone", "Last 720 hours, rolling, in UTC"],
              ["Missing values", "Filled with the column mean", "Filled with zero"],
              ["Late-arriving data", "Present — the batch ran a day later", "Absent — the event has not landed yet"],
              ["Cancellations", "Excluded, because the warehouse table is corrected", "Included, because the online store never saw the correction"],
              ["Type handling", "Amount in currency units", "Amount in minor units"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Skew fails silently and it fails in the worst possible place.</strong> The offline evaluation is computed with the training definition, so it looks fine. The service returns well-formed predictions with normal latency, so monitoring looks fine. The only symptom is that the online result is worse than the offline result predicted, and by then a dozen other explanations are on the table." },
          { t: "h", text: "One definition, two read paths" },
          { t: "p", html: "The core idea is dull and effective: a feature is <em>defined once</em>, and the store materializes it into two places that are guaranteed to agree." },
          {
            t: "code", lang: "text", code:
              "            feature definition (written once)\n" +
              "                        |\n" +
              "          +-------------+-------------+\n" +
              "          v                           v\n" +
              "   OFFLINE STORE                ONLINE STORE\n" +
              "   full history                 latest value only\n" +
              "   as-of joins                  key-value, low latency\n" +
              "   used to build                used at request time\n" +
              "   training sets                by the model service"
          },
          { t: "p", html: "Around that, three things come along for free and are worth naming: <strong>reuse</strong>, because the next model does not rebuild the same aggregate; <strong>discovery</strong>, because features have owners and documentation instead of living inside a notebook; and <strong>lineage</strong>, because you can answer which models break if an upstream table changes." },
          { t: "h", text: "Point-in-time correctness, plainly" },
          { t: "p", html: "This is the part worth being able to explain slowly, because it is where most people are vague. Suppose you are building a training row for something that happened on 3 March. You need every feature to hold the value it <em>had</em> on 3 March — the value the online system would have read at that instant." },
          { t: "p", html: "The naive join takes today's feature table and attaches today's values to that March event. Now the row says the account had 47 lifetime orders, when on 3 March it had 12. You have handed a historical example an answer from its own future, and the model learns from a world that could not have existed." },
          {
            t: "code", lang: "text", code:
              "WRONG — join the current value\n" +
              "  event(2024-03-03) + orders_total(today)      -> 47\n" +
              "\n" +
              "RIGHT — join the value as of the event\n" +
              "  event(2024-03-03) + orders_total(2024-03-03) -> 12\n" +
              "\n" +
              "the store keeps every value with the time it became true,\n" +
              "so the join asks: what would serving have read, right then?"
          },
          { t: "note", variant: "trap", html: "<strong>Point-in-time errors are leakage with better manners.</strong> There is no obviously suspicious feature to spot — <code class='tok'>orders_total</code> is a perfectly reasonable thing to use. The value is just quietly from the future, so it correlates with outcomes it could not have influenced, and the offline metric rewards you for it. This is the exact failure covered from the feature side in <a href='#/mlsd/concepts/feature-pitfalls'>the pitfalls lesson</a>." },
          { t: "p", html: "There is a second, subtler version: <strong>label lookahead</strong>. Even with correct as-of joins, if your label is \"did this account charge back within 90 days\", then every training row needs 90 days of hindsight — so your freshest usable training data is three months old. Say that out loud; it constrains the retraining cadence and it is a detail interviewers notice." },
          { t: "h", text: "The honest cost" },
          {
            t: "compare",
            bad: { title: "What it costs you", items: ["Another distributed system to run, monitor and pay for", "A new failure mode: the online store is stale or partially written", "Freshness becomes an explicit SLA per feature, and someone has to own it", "Nothing about it prevents a feature from being defined badly"] },
            good: { title: "What it buys you", items: ["One definition, so skew cannot come from two implementations", "Point-in-time joins without hand-written windowing", "Reuse across models and teams", "Lineage: which models break if this table changes"] }
          },
          { t: "note", variant: "tip", html: "You do not need a feature store to say the right thing here. \"One definition, computed once, materialized to both an offline store for training and a low-latency online store for serving, with as-of joins so historical rows only see what was knowable then\" is the answer. Whether that is a product, a shared library, or a pair of well-disciplined jobs is a build-versus-buy question, and small teams are frequently right to skip the product." },
          { t: "cue", html: "Raise it the moment a design has features computed in more than one place, or the moment you build a training set by joining a historical event table to a current-state table. Both are skew waiting to happen." },
          { t: "note", variant: "key", html: "<strong>A feature store's product is a single definition with two consistent read paths, plus as-of joins that stop history from knowing its own future.</strong> Skew is silent — offline looks fine, serving looks fine, only the online result disappoints — which is exactly why it needs infrastructure rather than discipline." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "training-pipelines",
        title: "Training pipelines and splitting data honestly",
        summary: "The stages between raw events and a promotable artifact — and why a random split is wrong for most of the data you will actually meet.",
        minutes: 9,
        tags: ["training", "pipelines"],
        blocks: [
          { t: "p", html: "The training pipeline is the offline half of the loop, and in an interview it is worth naming as stages rather than as a single \"train the model\" box. Each stage is somewhere a design decision hides." },
          {
            t: "ol", items: [
              "<strong>Ingest.</strong> Raw events land — impressions, interactions, transactions, moderation decisions.",
              "<strong>Label construction.</strong> Turn events into supervised targets. A watch counts at what threshold? A chargeback within how many days? Somebody decides, and the decision is part of the design.",
              "<strong>Feature computation.</strong> Materialize features with as-of correctness, per <a href='#/mlsd/concepts/feature-stores'>the previous lesson</a>.",
              "<strong>Split.</strong> Divide into training, validation and test — the subject of most of this lesson.",
              "<strong>Train.</strong> Fit, with hyperparameters selected against validation, never against test.",
              "<strong>Evaluate.</strong> Compute the gating metrics, on the test split and on the slices you care about.",
              "<strong>Register and promote.</strong> Version the artifact with the data and code that produced it; promote only if it beats the incumbent on the agreed bar."
            ]
          },
          { t: "note", variant: "tip", html: "Two properties are worth claiming for the pipeline out loud, because they cost nothing to say and signal that you have operated one: <strong>reproducibility</strong> — same code, same data snapshot, same artifact — and <strong>idempotence</strong> — a rerun overwrites rather than duplicates. The second one is what makes a backfill safe." },
          { t: "h", text: "Why random splits are usually wrong" },
          { t: "p", html: "The default is to shuffle and cut. That is correct only when your rows are genuinely independent and identically distributed, and production data almost never is. Two structures break it, and they usually appear together." },
          { t: "h2", text: "Structure one: time" },
          { t: "p", html: "Almost all interaction data is time-ordered, and a shuffle scatters future rows into the training set. The model is then evaluated on predicting a past whose future it already studied — it may have seen this exact user's later sessions, this item's eventual popularity, or the aftermath of an event it is being asked to anticipate." },
          {
            t: "code", lang: "text", code:
              "RANDOM SPLIT (leaks)\n" +
              "  time ->  ..T..V..T..T..V..T..V..T..\n" +
              "           training rows sit after validation rows\n" +
              "\n" +
              "TEMPORAL SPLIT (honest)\n" +
              "  time ->  TTTTTTTTTTTT | VVVV | EEEE\n" +
              "           train          val    test\n" +
              "           every eval row is strictly after every train row,\n" +
              "           which is the only arrangement production ever offers"
          },
          { t: "p", html: "A temporal split usually reports a worse number than a random one. That is the point: the worse number is the true one, and the gap between them is a good estimate of how much your random split was flattering you." },
          { t: "h2", text: "Structure two: groups" },
          { t: "p", html: "Rows cluster by entity — many rows per user, many per session, many per merchant. Split randomly and the same user appears on both sides, so the model can memorize that user and be rewarded for it. The score then answers \"how well do we serve users we have already seen a lot of?\" when the question you needed answered was about new ones." },
          {
            t: "table",
            headers: ["Data shape", "Split by", "Because"],
            rows: [
              ["Time-ordered events", "Time — train on the past, evaluate on the future", "Production only ever offers the past"],
              ["Many rows per user", "User id, so a user is wholly in one side", "Otherwise you measure memorization, not generalization"],
              ["Near-duplicate items", "Content cluster", "Otherwise a duplicate in training makes the test row trivial"],
              ["Both time and groups", "Time first, then check group overlap across the boundary", "The common real case; the two constraints interact"],
              ["Genuinely independent rows", "Random, stratified by label if it is rare", "The textbook case, and the rarest one in production"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>A temporal split has its own trap: the eval window is a single period.</strong> If your test week contains a holiday, a launch or an outage, you are measuring that week rather than the model. Rolling-origin evaluation — train to time T and test on the window after it, then slide T forward and repeat — gives several independent estimates and shows whether the model degrades as the gap from training grows. That degradation curve is also how you choose a retraining cadence." },
          { t: "h", text: "Class imbalance, handled without breaking the metric" },
          { t: "p", html: "When positives are rare, training on the raw distribution can waste most of the compute on easy negatives. Downsampling negatives or reweighting the positive class both help, and both are fine — with one hard rule attached." },
          {
            t: "compare",
            bad: { title: "Rebalancing wrongly", items: ["Resample, then split — the same positive lands on both sides", "Rebalance the evaluation set too", "Report precision on a 50/50 test set", "Use the resampled probabilities directly for a downstream decision"] },
            good: { title: "Rebalancing correctly", items: ["Split first, then resample the training portion only", "Leave validation and test at the production base rate", "Report precision at the real prevalence it will face", "Recalibrate before using probabilities as probabilities"] }
          },
          { t: "p", html: "That last point matters whenever the score is used for anything other than sorting: downsampling negatives shifts the model's output upward in a systematic way, so the probabilities are no longer probabilities until you correct them. If the score only ever sorts a list, you can live with it; if it feeds a threshold, a budget or an expected-value calculation, you cannot. Calibration is covered in <a href='#/mlsd/concepts/evaluation'>the evaluation lesson</a>." },
          { t: "cue", html: "Before choosing a split, ask two questions about the data: <em>is it ordered in time</em>, and <em>are there many rows per entity</em>. If either is yes — and for interaction data both usually are — say why a random split would leak before anyone asks you." },
          { t: "note", variant: "key", html: "<strong>The split is a modelling decision, not a utility function.</strong> Time-ordered data wants a temporal split; entity-clustered data wants a grouped split; most real data wants both. Resample the training portion only, and leave evaluation at the prevalence production will actually hand you." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "generalization",
        title: "Overfitting, underfitting, and three levers",
        summary: "Capacity as the organising idea, bias and variance without the algebra, and why transfer, augmentation and regularisation attack the same problem differently.",
        minutes: 8,
        tags: ["training", "generalization"],
        blocks: [
          { t: "p", html: "A model has a budget for complexity — a <strong>capacity</strong>. Too little and it cannot express the pattern in your data. Too much, with too few examples to pin it down, and it will happily describe the noise as well as the signal. Everything in this lesson is a way of matching that budget to what the data can actually support." },
          {
            t: "table",
            headers: ["Symptom", "Training error", "Validation error", "Diagnosis"],
            rows: [
              ["Both bad, and close together", "High", "High, similar", "<strong>Underfitting.</strong> Not enough capacity, or the features do not contain the signal"],
              ["Training great, validation poor", "Low", "Much higher", "<strong>Overfitting.</strong> Capacity is spent memorizing this particular sample"],
              ["Both acceptable and close", "Low", "Slightly higher", "Healthy — the usual small gap is fine"],
              ["Validation better than training", "Higher", "Lower", "Suspicious. Usually a broken split, a leaky feature, or regularization active only in training"]
            ]
          },
          { t: "note", variant: "tip", html: "That table <em>is</em> the diagnostic procedure, and it is the first thing to say when an interviewer describes a model behaving badly. Compare training error to validation error before proposing any fix — the two failures have opposite remedies, and guessing wrong makes the problem worse rather than leaving it unchanged." },
          { t: "h", text: "Bias and variance, without the algebra" },
          { t: "p", html: "Imagine training your model many times on different samples of the same size drawn from the same source. Two things can be wrong with the resulting family of models." },
          {
            t: "ul", items: [
              "<strong>Bias</strong> is the error they all share. Every model in the family misses the same way, because the model class simply cannot represent the true relationship. Fitting a straight line to a curve: more data will not help, because the constraint is the shape you allowed.",
              "<strong>Variance</strong> is how much they disagree with each other. Each one chases the particular noise in its own sample, so predictions swing wildly with the draw. More data helps directly, because noise averages out and the sample pins the model down."
            ]
          },
          { t: "p", html: "Which is why the fixes are opposite. High bias wants a richer model or better features. High variance wants constraint or more data. The classical picture is a trade-off — reduce one and you raise the other — although in practice heavily overparameterized models trained with strong regularization do not follow that curve as tidily as the textbook version suggests, so treat it as intuition rather than as law." },
          { t: "h", text: "Three levers on the same problem" },
          {
            t: "table",
            headers: ["Lever", "What it actually changes", "Reach for it when"],
            rows: [
              ["<strong>Regularisation</strong>", "Shrinks the space of functions the model is allowed to settle on — weight decay, dropout, early stopping, tree depth limits, fewer parameters", "You are overfitting and cannot get more data. It is the cheapest lever and usually the first one to try"],
              ["<strong>Augmentation</strong>", "Grows the effective sample by generating variants that should not change the label — crops and colour shifts on images, paraphrases on text, resampled windows on time series", "You are overfitting and you know a transformation the label is genuinely invariant to. Free data, if and only if that invariance is real"],
              ["<strong>Transfer learning</strong>", "Imports a representation learned on a much larger corpus, so your data only has to fit the last part of the problem rather than all of it", "Your labelled dataset is small but the input domain is one where large pretrained models exist — text, images, audio, code"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Augmentation encodes a claim, and a wrong claim is a bug.</strong> Horizontally flipping a photo of a cat is a cat. Horizontally flipping a photo of text, a road sign, or an ultrasound is a different thing wearing the same label — and you have just taught the model that the difference does not matter. Every augmentation is an assertion about which transformations preserve the label; say the assertion out loud before you use it." },
          { t: "h", text: "Where the levers do not reach" },
          { t: "p", html: "Two very common situations look like overfitting and are not, and proposing a regularization fix for either is a visible mistake." },
          {
            t: "compare",
            bad: { title: "Looks like overfitting", items: ["Validation collapses after a data-pipeline change", "Model does well overall, badly on one locale", "Gap appears only after deployment", "Fixing it with more dropout"] },
            good: { title: "Is actually", items: ["A broken feature or schema change — check null rates first", "A slice problem — the aggregate is hiding a small, badly-served segment", "Training/serving skew or drift, not a capacity problem", "Fixing the data, then revisiting capacity"] }
          },
          { t: "p", html: "The second row deserves its own habit. An aggregate metric is an average over segments, and a model can be excellent on the majority slice and unusable on a minority one while the headline number barely moves. Report the metric on slices — locale, device, account age, item category — and treat a bad slice as a real defect rather than as rounding." },
          { t: "cue", html: "When an interviewer says \"the model does well in testing but poorly in production\", do not jump to regularization. Walk the ladder out loud: is it a split problem (leakage), a data problem (skew or drift), a slice problem (an average hiding a segment), or genuinely a capacity problem? Capacity is the last suspect, not the first." },
          { t: "note", variant: "key", html: "<strong>Compare training error to validation error before you propose anything.</strong> Underfitting wants capacity or better features; overfitting wants constraint or more data; and a large gap that appears only after deployment is usually not a generalization problem at all." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "evaluation",
        title: "The metric ladder",
        summary: "Business metric to product metric to ML metric — then the specific measures per task family, including why ROC-AUC lies under heavy imbalance.",
        minutes: 12,
        tags: ["evaluation", "metrics"],
        blocks: [
          { t: "p", html: "Most ML failures are not modelling failures. They are cases where a number went up and nothing improved. The defence is a ladder: every ML metric you optimize should be traceable, one rung at a time, to something the business would notice if it changed." },
          {
            t: "table",
            headers: ["Rung", "Example", "Measured", "Moves"],
            rows: [
              ["<strong>Business metric</strong>", "Revenue, retention, cost per resolved case, regulatory exposure", "Weeks to quarters", "Slowly, and for a hundred reasons"],
              ["<strong>Product metric</strong>", "Satisfied sessions, harmful-content views prevented, successful searches", "Days to weeks", "In an online test"],
              ["<strong>ML metric</strong>", "Precision at a recall floor, NDCG, calibration error", "Minutes, offline", "Every training run"]
            ]
          },
          { t: "p", html: "You optimize the bottom rung because it is the only one you can compute in a training loop. The classic failure is forgetting that it is the bottom rung — shipping a model whose offline number improved while the rung above it moved sideways or down. State the chain explicitly and you have pre-empted the question: <em>\"I'll optimize NDCG offline, validate against satisfied sessions in the online test, and the business case is retention.\"</em>" },
          { t: "note", variant: "trap", html: "<strong>If you cannot draw a line from the ML metric up to something a business cares about, you are optimizing a number, not a system.</strong> This is also the honest answer to \"why not just optimize the business metric directly?\" — it is too slow, too noisy and far too coarse to supervise per-item decisions. So you use a proxy deliberately, and you say that you know it is one." },
          { t: "h", text: "Classification: precision, recall, and the confusion matrix" },
          { t: "p", html: "For a binary decision, everything starts with four counts. Get these exactly right; they are the foundation of every other metric in this section." },
          {
            t: "code", lang: "text", code:
              "                     actually positive   actually negative\n" +
              "  predicted positive        TP                  FP\n" +
              "  predicted negative        FN                  TN\n" +
              "\n" +
              "  precision = TP / (TP + FP)\n" +
              "      of everything we flagged, how much was right\n" +
              "\n" +
              "  recall    = TP / (TP + FN)\n" +
              "      of everything that was truly positive, how much we caught\n" +
              "\n" +
              "  F1        = harmonic mean of precision and recall\n" +
              "      one number when you have no reason to weight one over the other"
          },
          {
            t: "ul", items: [
              "<strong>Precision is about the cost of acting.</strong> Low precision means you are punishing innocent users, wasting reviewer time, or showing junk. It is the metric a support team feels.",
              "<strong>Recall is about the cost of missing.</strong> Low recall means harm gets through, fraud clears, disease goes undetected. It is the metric a risk team feels.",
              "<strong>They trade against each other through the threshold.</strong> Lower the threshold and you flag more: recall rises, precision falls. The model does not change — only the operating point does.",
              "<strong>F1 is a convenience, not a decision.</strong> It assumes precision and recall matter equally, which in an asymmetric domain is exactly the assumption you were supposed to make explicitly."
            ]
          },
          { t: "note", variant: "tip", html: "In this round, the strong phrasing is almost never \"we'll maximize F1\". It is <em>\"precision at a fixed recall\"</em> or <em>\"recall at a fixed precision\"</em> — one of them pinned by the business, the other optimized. That single move shows you understand the threshold is a product decision and not a modelling one." },
          { t: "h", text: "Why ROC-AUC misleads under heavy imbalance" },
          { t: "p", html: "This is the most commonly-botched point in ML interviews, so it is worth being exact. Both curves sweep the same threshold from strict to permissive; they differ in what they plot." },
          {
            t: "code", lang: "text", code:
              "ROC curve:  true positive rate   vs  FALSE POSITIVE RATE\n" +
              "              TP / (TP + FN)          FP / (FP + TN)\n" +
              "                                      ^^^^^^^^^^^^^\n" +
              "                                      divides by ALL negatives\n" +
              "\n" +
              "PR curve:   precision            vs  recall\n" +
              "              TP / (TP + FP)          TP / (TP + FN)\n" +
              "                                      no TN anywhere"
          },
          { t: "p", html: "That difference is everything. False-positive rate divides by the total number of negatives, and when negatives outnumber positives by a thousand to one, that denominator is enormous. A pile of false positives that ruins precision barely registers as movement along the ROC x-axis." },
          { t: "p", html: "Concretely: a stream with 1,000,000 negatives and 1,000 positives. The model flags 10,000 items and 500 of them are genuinely positive." },
          {
            t: "code", lang: "text", code:
              "  TP = 500      FP = 9,500\n" +
              "  FN = 500      TN = 990,500\n" +
              "\n" +
              "  recall              = 500 / 1,000        = 50%\n" +
              "  false positive rate = 9,500 / 1,000,000  = 0.95%\n" +
              "  precision           = 500 / 10,000       = 5%\n" +
              "\n" +
              "  on the ROC curve this is a superb operating point:\n" +
              "  50% of the positives caught for under 1% FPR.\n" +
              "  in the review queue, 19 of every 20 items are innocent."
          },
          { t: "note", variant: "warn", html: "<strong>Two further facts, both worth stating.</strong> First, a random classifier scores ROC-AUC 0.5 regardless of class balance, but its PR-AUC is approximately the positive rate — so a PR-AUC of 0.30 on a 1%-positive problem is a large achievement, while the same number on a balanced problem is poor. PR-AUC values are only comparable within a fixed base rate. Second, ROC-AUC has a clean interpretation worth keeping: it is the probability that a randomly chosen positive is ranked above a randomly chosen negative. That is a genuinely useful summary of ranking quality — it is just not a summary of whether your review queue is full of innocent people." },
          { t: "p", html: "So: use precision-recall curves and PR-AUC when positives are rare and the cost of a false positive is real. ROC-AUC is fine for roughly balanced problems, and fine as a model-comparison statistic, as long as nobody mistakes it for an operating-point decision." },
          { t: "h", text: "Ranking metrics" },
          { t: "p", html: "When the output is an ordered list, a single correct-or-not verdict throws away the thing that matters — <em>where</em> the good items landed. Three measures, each answering a different question." },
          {
            t: "table",
            headers: ["Metric", "What it measures", "Use it when"],
            rows: [
              ["<strong>Recall@k</strong>", "Of all relevant items, what fraction appear in the top k. Position within the top k is ignored", "Evaluating a retrieval stage, where the job is to get candidates into the set at all"],
              ["<strong>Precision@k</strong>", "Of the k shown, what fraction are relevant", "The user sees a fixed-size slot and every filled slot has a cost"],
              ["<strong>NDCG@k</strong>", "Graded relevance, discounted by position, normalized by the best ordering possible for that query", "Ranking quality where relevance is a scale and top positions matter far more than lower ones"],
              ["<strong>MRR</strong>", "The reciprocal of the rank of the first relevant result, averaged over queries", "Known-item lookup — one right answer, and how fast the user reaches it is the whole story"]
            ]
          },
          { t: "p", html: "NDCG is the one people fumble, so here it is mechanically. Each result contributes a gain based on its relevance grade, divided by a discount that grows with position. Sum those to get DCG. Then compute the same sum for the perfect ordering of that query's results — the ideal DCG — and divide. The normalization is what makes an easy query with many relevant results comparable to a hard one with two." },
          {
            t: "code", lang: "text", code:
              "  DCG@k  = sum over positions i=1..k of   gain(rel_i) / log2(i + 1)\n" +
              "\n" +
              "         gain is often rel_i, or (2^rel_i - 1) to reward\n" +
              "         highly-relevant results more sharply\n" +
              "\n" +
              "  IDCG@k = the same sum for the best possible ordering\n" +
              "  NDCG@k = DCG@k / IDCG@k        ->  lands in [0, 1]"
          },
          { t: "note", variant: "trap", html: "<strong>Every ranking metric needs relevance labels, and where those come from is the real question.</strong> Human judgements are expensive, slow and inconsistent but unbiased by your system. Logged clicks are free, plentiful and thoroughly contaminated by <a href='#/mlsd/serving/feedback-loops'>position and presentation bias</a> — an item at rank one gets clicked more because it was at rank one. Offline ranking metrics computed on raw click logs mostly measure how closely the new model imitates the old one." },
          { t: "h", text: "Regression error measures" },
          {
            t: "table",
            headers: ["Measure", "Behaviour", "Watch out for"],
            rows: [
              ["<strong>MAE</strong>", "Mean absolute error. Every unit of error counts the same; reads in the original units", "Insensitive to a few catastrophic errors, which may be exactly what you care about"],
              ["<strong>RMSE</strong>", "Root mean squared error. Penalizes large errors disproportionately; also in the original units", "One extreme outlier can dominate the number; check whether that is a feature or a distortion"],
              ["<strong>MAPE</strong>", "Mean absolute percentage error. Scale-free, so it compares across items of different magnitude", "Explodes as the true value approaches zero, undefined at zero, and asymmetric — it punishes over-prediction and under-prediction unequally"],
              ["<strong>Quantile loss</strong>", "Optimizes a chosen quantile rather than the mean", "The right choice when over- and under-prediction have genuinely different costs — inventory, staffing, capacity"]
            ]
          },
          { t: "h", text: "Calibration, when the number is used and not just sorted" },
          { t: "p", html: "One more distinction that separates strong candidates. Ranking metrics are invariant to any order-preserving transformation of the scores, so a model can rank perfectly and still have output that means nothing as a probability. If a downstream system multiplies the score by a value — an expected-value bid, an expected-cost threshold, a budget allocation — then the number itself has to be right, not just its ordering." },
          {
            t: "ul", items: [
              "<strong>Reliability check:</strong> bucket predictions by score, and compare each bucket's mean predicted probability to its observed frequency. A well-calibrated model has 0.3 mean 30% of the time.",
              "<strong>Proper scoring rules</strong> — log loss and Brier score — reward calibration as well as discrimination, unlike AUC.",
              "<strong>Post-hoc correction</strong> — fitting a simple monotone mapping on a held-out set — usually fixes calibration without touching the ranking.",
              "<strong>Downsampling breaks calibration</strong> by construction, as <a href='#/mlsd/concepts/training-pipelines'>the training pipeline lesson</a> noted. If you resampled, you must correct before the probabilities are used as probabilities."
            ]
          },
          { t: "cue", html: "Pick the metric family from the shape of the output, not from habit. A yes/no decision with rare positives means precision-recall, never ROC-AUC alone. An ordered list means NDCG or recall@k depending on the stage. A number means MAE or RMSE, and quantile loss when the two error directions cost differently. A score that feeds arithmetic means calibration on top of whichever of those applies. <a href='#/mlcase/recsys/ad-click-prediction'>Ad click prediction</a> is the canonical case where ranking and calibration are both non-negotiable." },
          { t: "note", variant: "key", html: "<strong>ROC-AUC hides false positives behind an enormous negative class; precision-recall does not.</strong> Under heavy imbalance, report PR-AUC or precision at a fixed recall, remember that PR values only compare within a fixed base rate, and add calibration whenever the score is used for anything other than sorting." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "ab-testing",
        title: "Online evaluation and why offline gains evaporate",
        summary: "Guardrails, novelty effects, interference between arms, and how to reason about experiment size without inventing formulas.",
        minutes: 10,
        tags: ["evaluation", "experimentation"],
        blocks: [
          { t: "p", html: "Offline evaluation asks whether the model predicts the past better. Online evaluation asks whether the system makes the future better. Those are different questions, and the gap between them is wide enough that \"the offline metric improved and the online test was flat\" is one of the most common outcomes in applied ML." },
          { t: "h", text: "Five reasons offline gains fail to replicate" },
          {
            t: "ol", items: [
              "<strong>The offline data was chosen by the old model.</strong> Your logs contain only what the incumbent decided to show. A new model that would surface different items is evaluated on a distribution it will never actually face — and the items it likes have no logged outcomes at all.",
              "<strong>The metric was a proxy.</strong> NDCG went up. Whether users had better sessions is a separate empirical question, and proxies are only correlated with the thing they stand in for, never identical to it.",
              "<strong>The system changed, not just the model.</strong> A larger model that adds latency can lose more from slower responses than it gains from better ranking. Offline evaluation cannot see a millisecond.",
              "<strong>Position and presentation bias.</strong> Offline replay on logged clicks rewards models that reproduce the old ordering, because that is the ordering the clicks were collected under.",
              "<strong>Feedback effects need time.</strong> A ranking change alters what gets shown, which alters what users do, which alters the data. Day one and week four can point in different directions."
            ]
          },
          { t: "note", variant: "tip", html: "Saying that gap out loud, unprompted, is a strong signal: <em>\"Offline I'd expect this to look better, but I'd treat the offline number as a gate rather than as evidence — the only claim I'd make before an online test is that it is not worse.\"</em>" },
          { t: "h", text: "Guardrail metrics" },
          { t: "p", html: "You test one hypothesis, but you can break many things. A guardrail is a metric you are not trying to improve and will not accept a regression in — it turns \"we shipped a win\" into a claim about the whole system rather than one number." },
          {
            t: "table",
            headers: ["Guardrail", "Catches"],
            rows: [
              ["Latency, especially the tail", "A heavier model that wins on quality and loses on speed"],
              ["Error rate and timeout rate", "A dependency that only fails under the new traffic pattern"],
              ["Revenue or conversion", "An engagement win paid for out of monetization"],
              ["Reports, hides, blocks, unsubscribes", "Engagement bought with content people resent"],
              ["Catalogue coverage and diversity", "A model collapsing onto a narrow, popular slice"],
              ["New-user metrics, separately", "A change that helps established users and hurts first sessions"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Guardrails need a decision rule agreed before the test starts.</strong> \"Latency is a guardrail\" is not a rule; \"we ship if the primary metric is up and tail latency has not regressed by more than an agreed margin\" is. Without the rule you will be negotiating the threshold after seeing the numbers, which is not an experiment — it is a rationalization with a control group." },
          { t: "h", text: "Novelty and primacy" },
          { t: "p", html: "Users react to change as change. Something new gets extra attention regardless of quality — a <strong>novelty effect</strong> — and lifts that decay over the first days are usually this rather than a real gain. The reverse also happens: a redesign that disrupts habits can look bad for a week and be better afterwards, which is the <strong>primacy effect</strong>." },
          {
            t: "ul", items: [
              "Run long enough to see the curve flatten, not just long enough to reach significance. Those are different stopping conditions and only one of them is about the truth.",
              "Plot the effect by day since exposure. A lift that decays toward zero is novelty; a lift that holds is real; a lift that grows is often learning or a feedback effect.",
              "Look separately at users who were exposed on day one and users who joined the experiment later — the second group has no novelty to react to.",
              "Watch for reallocation rather than creation: engagement moved from one surface to another is not a gain, and only a metric wide enough to cover both surfaces will show it."
            ]
          },
          { t: "h", text: "Interference between arms" },
          { t: "p", html: "Standard A/B analysis assumes one user's assignment does not affect another user's outcome. That assumption is comfortable, frequently false, and its failure is the most common way a real experiment gives a confidently wrong answer." },
          {
            t: "compare",
            bad: { title: "Where the assumption breaks", items: ["Marketplaces — treatment consumes supply control needed", "Social graphs — treated users change untreated friends' feeds", "Shared budgets or ad inventory across both arms", "A shared cache or model warmed by one arm", "Anything with a global rate limit or a finite queue"] },
            good: { title: "What to do about it", items: ["Randomize by cluster: geography, market, social community", "Budget-split tests, so each arm has its own supply", "Switchback: alternate the whole system in time slices", "Accept less statistical power in exchange for a valid comparison", "Or state the bias direction explicitly and bound it"] }
          },
          { t: "p", html: "The two-sided marketplace case is worth being able to state crisply, because it is a favourite follow-up: if the treatment ranking wins by capturing scarce inventory that the control arm would otherwise have used, the measured gap is partly a transfer rather than a gain — and once everyone is in treatment, there is nobody left to take it from. The lift shrinks on full rollout, and nothing was mismeasured." },
          { t: "h", text: "Sizing, in directions rather than formulas" },
          { t: "p", html: "You will not be asked to derive a sample size at a whiteboard. You will be asked which way the levers point, and getting the directions right is what is being tested." },
          {
            t: "table",
            headers: ["Lever", "Direction", "Why"],
            rows: [
              ["Smallest effect you care to detect", "Smaller effect → far more traffic", "Small differences need many observations to separate from noise, and the requirement grows fast as the target effect shrinks"],
              ["Variance of the metric", "Noisier metric → more traffic", "Revenue per user is far noisier than click-through rate, so it needs much more data for the same sensitivity"],
              ["Traffic available", "More traffic → shorter test", "But never shorter than the novelty window, whatever the arithmetic says"],
              ["Number of variants", "More arms → more traffic, and a multiple-comparison problem", "Testing enough variants guarantees one looks significant by chance"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Peeking is the quiet killer.</strong> Checking the result repeatedly and stopping the moment it crosses significance inflates the false-positive rate well beyond the number you think you are controlling — you have given yourself many chances to be fooled and counted only the last one. Fix the duration in advance, or use a sequential method designed for continuous monitoring. \"We'd pre-register the primary metric and the duration\" is a one-line answer that lands well." },
          { t: "p", html: "One more practical point: not everything can be A/B tested. Brand effects, long-horizon retention and network-wide changes may need holdout populations measured over months, or geographic experiments, or a before-and-after comparison with all the caveats that carries. Saying \"this one I would not A/B test, and here is what I would do instead\" is a genuinely senior move. <a href='#/mlcase/recsys/feed-ranking'>Feed ranking</a> works through a full experiment design on exactly this kind of problem." },
          { t: "cue", html: "Reach for interference concerns whenever arms share a finite resource — inventory, budget, attention, a rate limit — or whenever users influence each other. Reach for the novelty discussion whenever the change is visible to the user. Reach for guardrails always." },
          { t: "note", variant: "key", html: "<strong>Offline evaluation is a gate; the online test is the evidence.</strong> Fix the duration and the decision rule before you start, carry guardrails you will not regress, let the novelty curve flatten, and check whether the arms are competing for the same finite resource before you believe the number." },
          { t: "quiz", id: "mlsd-concepts" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Module: Serving & Operations
  ================================================================== */
  var MOD_SERVING = {
    id: "serving",
    name: "Serving & Operations",
    icon: "bolt",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "retrieval-ranking",
        title: "Two stages: retrieval then ranking",
        summary: "Cheap and high-recall, then expensive and high-precision. Why one stage cannot do both, and how to size the candidate set.",
        minutes: 9,
        tags: ["serving", "architecture"],
        blocks: [
          { t: "p", html: "You have millions of items, tens of milliseconds, and a user expecting the best few. The pattern that resolves that tension is a funnel: a cheap stage that looks at everything and keeps a few hundred plausible candidates, then an expensive stage that looks carefully at those few hundred and orders them." },
          {
            t: "code", lang: "text", code:
              "  corpus            10^6 - 10^9 items\n" +
              "        |\n" +
              "        |  RETRIEVAL      cheap per item, high recall\n" +
              "        v                 embedding lookup + heuristic sources\n" +
              "  candidates        10^2 - 10^3 items\n" +
              "        |\n" +
              "        |  RANKING        expensive per item, high precision\n" +
              "        v                 cross features, heavy model\n" +
              "  ordered list      10^1 items\n" +
              "        |\n" +
              "        |  RULES          dedup, diversity, policy, freshness\n" +
              "        v\n" +
              "  response"
          },
          { t: "h", text: "Why one stage cannot do both" },
          { t: "p", html: "The argument is arithmetic, and you should be able to give it in two sentences. Precision at the top of a list comes from cross features — this user against this specific item — and those are computed per candidate, so their cost is linear in how many items you score. A model cheap enough to run across the whole corpus cannot afford them; a model that has them cannot afford the whole corpus." },
          {
            t: "compare",
            bad: { title: "Retrieval alone", items: ["Scores the whole corpus cheaply", "Cannot express user-by-item interactions", "Good at 'plausibly relevant'", "Bad at ordering the top ten"] },
            good: { title: "Ranking alone", items: ["Rich cross features, sharp ordering", "Cost is linear in items scored", "Fine over hundreds of items", "Impossible over millions inside a request"] }
          },
          { t: "p", html: "So the two stages are not two models doing the same job at different quality levels. They have different objectives: retrieval optimizes <strong>recall</strong> — do not lose anything the ranker would have wanted — and ranking optimizes <strong>precision at the top</strong>. Evaluate them separately, with different metrics, as <a href='#/mlsd/concepts/evaluation'>the metric ladder</a> lays out." },
          { t: "h", text: "Retrieval is usually several sources, not one" },
          { t: "p", html: "A common weak answer treats candidate generation as a single embedding lookup. Production systems almost always blend several cheap sources and take the union, because each one covers a different failure of the others." },
          {
            t: "table",
            headers: ["Source", "Covers", "Weakness it has alone"],
            rows: [
              ["Embedding nearest neighbours", "Semantic and behavioural similarity", "Inherits whatever bias the embedding was trained on"],
              ["Recent and trending", "Freshness, breaking events", "Popular items crowd out personalization"],
              ["Followed or subscribed", "Explicit user intent", "Only works for users who have expressed any"],
              ["Same category, creator or topic", "Coherent, explainable continuation", "Narrow; reinforces what the user already sees"],
              ["Exploration slot", "New and rarely-shown items", "Costs short-term quality by construction"]
            ]
          },
          { t: "note", variant: "tip", html: "Naming a blend rather than a single source is a cheap, strong signal — and the exploration slot in that list is the strongest of the five, because it shows you are thinking about where next month's training data comes from. That is the subject of <a href='#/mlsd/serving/feedback-loops'>the last lesson in this track</a>." },
          { t: "h", text: "Sizing the candidate set" },
          { t: "p", html: "K is a real dial with a measurable answer, and \"how would you choose K?\" is a standard follow-up. The quantity to measure is <strong>retrieval recall</strong>: of the items the ranker would have put on the first page had it seen everything, what fraction made it into the candidate set?" },
          {
            t: "code", lang: "text", code:
              "sweep K, measure retrieval recall on a query sample:\n" +
              "\n" +
              "  K = 100    recall 0.72\n" +
              "  K = 300    recall 0.89\n" +
              "  K = 500    recall 0.93\n" +
              "  K = 1000   recall 0.95   <- flattening; extra K buys little\n" +
              "\n" +
              "then the budget check:\n" +
              "  ranker cost per item  x  K   must fit inside the\n" +
              "  ranking slice of the latency budget\n" +
              "\n" +
              "(illustrative shape, not measured values — the curve's\n" +
              " form is the point, not the numbers)"
          },
          { t: "p", html: "The curve is steep and then flat, and the flattening point is your answer — subject to the ranker's cost per item multiplied by K still fitting the budget. If the two disagree, you have a genuine trade-off to state rather than a number to look up: either make the ranker cheaper, or accept the recall the budget can pay for." },
          { t: "note", variant: "warn", html: "<strong>Do not measure retrieval recall against clicks.</strong> Logged clicks only exist for items the old system chose to show, so a candidate set that surfaces genuinely better items scores badly for being different rather than for being wrong. Measure against the ranker's own judgement over a much larger candidate set computed offline, or against human relevance labels — both are honest, and both are slower." },
          { t: "h", text: "The third stage nobody draws" },
          { t: "p", html: "Between the ranker and the response sits a layer of business rules, and putting it in the diagram is worth real credit because it explains how the system stays governable." },
          {
            t: "ul", items: [
              "<strong>Deduplication</strong> — near-identical items, or three items from the same creator in a row.",
              "<strong>Diversity</strong> — deliberately demoting an item the ranker loves to avoid a monotonous list, which costs immediate relevance and buys session quality.",
              "<strong>Policy and eligibility</strong> — age gating, locale restrictions, blocked creators, legal removals.",
              "<strong>Freshness and mixing</strong> — quotas for new content, or the organic-versus-sponsored blend.",
              "<strong>Manual overrides</strong> — the ability for a human to pin or suppress something within minutes rather than within a training cycle."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Resist the urge to push these rules into the model.</strong> \"The model will learn not to show blocked content\" is how you end up unable to change a policy without a retrain, unable to explain a specific decision to a regulator, and unable to fix an incident in under a day. Rules that must be exactly enforced belong in code; the model handles the part that is genuinely a judgement about relevance." },
          { t: "cue", html: "Reach for the two-stage funnel whenever the corpus is far larger than what you can afford to score per request, and whenever the prompt is about relevance rather than a yes/no verdict. Do <em>not</em> reach for it when there are only a few hundred candidates to begin with — a single ranker is simpler, and saying so is a pragmatism signal. <a href='#/mlcase/retrieval/search-ranking'>Search ranking</a> and <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a> both build out the full funnel." },
          { t: "note", variant: "key", html: "<strong>Retrieval optimizes recall, ranking optimizes precision at the top, and business rules stay outside the model.</strong> Size K by measuring where retrieval recall flattens, then check that K times the ranker's per-item cost still fits the latency budget." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "inference-architecture",
        title: "Where inference runs, and what the request budget buys",
        summary: "Online, batch and streaming; decomposing the latency budget; batching, caching, model size, and when precomputation wins outright.",
        minutes: 10,
        tags: ["serving", "latency"],
        blocks: [
          { t: "p", html: "\"Where does the model run?\" has three answers, and picking the wrong one is a more expensive mistake than picking the wrong model. The deciding question is not how good the prediction needs to be — it is <strong>how fresh the input has to be, and how quickly the answer is needed</strong>." },
          {
            t: "table",
            headers: ["Mode", "Runs", "Fits when", "Costs"],
            rows: [
              ["<strong>Online</strong>", "On the request, synchronously", "The input only exists at request time — a query, a cart, a live session", "Every millisecond is on the user's critical path; capacity must be provisioned for peak"],
              ["<strong>Batch</strong>", "On a schedule, results written to a store", "Inputs are enumerable in advance and staleness of hours is acceptable", "Answers are as old as the last run; the input space must be finite"],
              ["<strong>Streaming</strong>", "Continuously, on an event stream", "The trigger is an event and seconds of lag are fine — fraud on a transaction, an alert on a signal", "A stateful pipeline to operate, with ordering, replay and late-data semantics"]
            ]
          },
          { t: "note", variant: "tip", html: "Most real systems are hybrids, and saying so is the strong answer: embeddings computed in batch, aggregates maintained by a stream, and one small online model that combines them at request time. Naming which parts live where is a better answer than choosing one mode for everything." },
          { t: "h", text: "Decomposing the budget" },
          { t: "p", html: "\"The p99 must be under 200 milliseconds\" is not a constraint until you split it. The decomposition is what turns a target into design decisions, and doing it out loud is worth more than any single choice you make afterwards." },
          {
            t: "code", lang: "text", code:
              "end-to-end request budget\n" +
              "  network in / out and TLS\n" +
              "  authentication, request parsing\n" +
              "  feature fetch            <- often the biggest single slice\n" +
              "  candidate retrieval\n" +
              "  ranking model forward pass\n" +
              "  business rules, dedup, diversity\n" +
              "  response serialization\n" +
              "  logging                  <- must be asynchronous\n" +
              "\n" +
              "budget the p99 of each slice, not the mean;\n" +
              "the slices do not add tidily, so leave headroom"
          },
          { t: "p", html: "Two observations that surprise people and are usually true. Feature fetch, not the model, is frequently the largest slice — several lookups against different stores, each with its own tail. And the tail dominates: if you make five parallel calls that each have a one-percent chance of being slow, the chance that the slowest one is slow is much higher than one percent, so the request's tail is worse than any dependency's tail." },
          { t: "note", variant: "warn", html: "<strong>Logging must never be synchronous on the request path.</strong> It is not optional — <a href='#/mlsd/framework/high-level-design'>the whole training loop depends on it</a> — but it belongs on a fire-and-forget path with a bounded buffer. A logging sink that slows down should degrade your data quality, never your latency, and a bounded buffer that drops under pressure is the correct behaviour rather than a bug." },
          { t: "h", text: "Batching" },
          { t: "p", html: "Accelerators are throughput devices: the fixed overhead of a call is large relative to the work of one small input, so processing many inputs at once raises utilization dramatically. <strong>Dynamic batching</strong> collects arriving requests for a few milliseconds and runs them together." },
          {
            t: "compare",
            bad: { title: "Batch size 1", items: ["Lowest possible per-request latency", "Hardware badly under-utilized", "Cost per prediction is high", "Simple to reason about"] },
            good: { title: "Dynamic batching", items: ["Throughput per unit of hardware rises substantially", "Each request waits for the batch window", "Cost per prediction falls", "One more timeout to tune against the tail"] }
          },
          { t: "p", html: "The knob is the maximum wait. A few milliseconds is usually invisible against a budget measured in hundreds; tens of milliseconds usually is not. Note also that ranking is <em>already</em> a batch — scoring K candidates for one user is one batched forward pass — so this discussion is about batching across users, not across candidates." },
          { t: "h", text: "Caching, from cheapest to hardest" },
          {
            t: "ul", items: [
              "<strong>Item embeddings and item features</strong> — the same for every user, small, and almost free to cache. Do this first.",
              "<strong>User features</strong> — per user, changes within a session; a short time-to-live is usually safe and cuts the feature-fetch slice significantly.",
              "<strong>Whole responses</strong> — enormous win when it hits, and it only hits when the same user asks the same thing with the same context. Personalization and freshness both destroy the hit rate.",
              "<strong>Scores for a (user, item) pair</strong> — a middle ground: cache the expensive part while letting the surrounding rules stay live.",
              "<strong>A stale-but-serving fallback</strong> — the highest-value cache of all is the one that lets you return yesterday's ranking when a dependency is down, instead of returning an error."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>A cache is a second, undocumented source of training/serving skew.</strong> If the ranker reads a cached feature value at serving time and the training job reads the fresh warehouse value, the two paths disagree — and unlike an ordinary skew bug, this one is intermittent and depends on cache hit rate. Either log the values you actually used, or make the staleness bound part of the feature's definition. <a href='#/mlsd/concepts/feature-stores'>The feature store lesson</a> covers the general problem." },
          { t: "h", text: "Model size against latency" },
          { t: "p", html: "When a model is too slow, there are four standard moves. State the one you would try and why, rather than listing all four." },
          {
            t: "table",
            headers: ["Move", "What it does", "The catch"],
            rows: [
              ["<strong>Distillation</strong>", "Train a small model to imitate a large one's outputs", "You keep most of the quality and lose some; the large model still has to exist and be maintained"],
              ["<strong>Quantization</strong>", "Represent weights and activations at lower precision", "Large speed and memory wins; accuracy loss is usually small but must be measured, not assumed"],
              ["<strong>Pruning</strong>", "Remove weights or structures that contribute little", "Unstructured sparsity often does not translate into real speedups without hardware support"],
              ["<strong>Split the work</strong>", "Heavy model offline for a precomputed part, small model online for the rest", "Two systems to keep consistent; the offline part goes stale between runs"]
            ]
          },
          { t: "h", text: "When precomputation is simply the right answer" },
          { t: "p", html: "Precomputation converts inference into a lookup, which no amount of optimization on the request path can beat. It is available exactly when two conditions hold: you can enumerate the inputs ahead of time, and the answer may be stale for as long as your run interval." },
          {
            t: "compare",
            bad: { title: "Precomputation does not fit", items: ["The input includes a free-text query", "The answer must reflect the last few seconds", "The user-by-item space is far too large to enumerate", "Context — location, device, session — changes the answer"] },
            good: { title: "Precomputation fits", items: ["A daily digest or notification", "A homepage shelf refreshed on a schedule", "'Related items' keyed only on the item", "Any answer where hours of staleness is invisible"] }
          },
          { t: "p", html: "The hybrid is often best and is worth naming: precompute a per-user candidate list nightly, then re-rank it online with fresh context. You pay one cheap ranking pass at request time instead of a full retrieval, and the freshness that actually matters — this session, this device, this moment — is still live." },
          { t: "cue", html: "Ask two questions to pick the mode. <em>Does the input exist before the request?</em> If no, it must be online. <em>How stale can the answer be?</em> Seconds means streaming, hours means batch. Everything else — batching, caching, distillation — is optimization within the mode you have chosen." },
          { t: "note", variant: "key", html: "<strong>Decompose the latency budget before choosing anything.</strong> Feature fetch is usually the largest slice and the model is usually not; batching buys throughput with per-request latency; and precomputation beats every optimization when the inputs are enumerable and hours of staleness are acceptable." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "drift-monitoring",
        title: "Monitoring a system that fails quietly",
        summary: "Inputs, predictions and delayed ground truth — and how to alert on something before the business metric moves.",
        minutes: 9,
        tags: ["serving", "operations"],
        blocks: [
          { t: "p", html: "An ordinary service tells you it is broken within seconds: requests fail, latency spikes, a dashboard turns red. A model that has become wrong keeps returning well-formed responses at normal latency, with a perfectly healthy error rate, and it will keep doing that for as long as you let it." },
          { t: "p", html: "So ML monitoring is not service monitoring with extra charts. You still need the service layer — latency, errors, saturation, and every dependency's health — but on top of it you need three things that have nothing to do with whether the request succeeded." },
          { t: "h", text: "Layer one: input distributions" },
          { t: "p", html: "This is the cheapest layer and it catches the most real incidents. For every feature the model consumes, track a small set of summary statistics per time window and compare them against the training distribution and against yesterday." },
          {
            t: "ul", items: [
              "<strong>Null and missing rate.</strong> The single highest-yield alarm in ML operations. An upstream team shipping a change that turns a feature into nulls is instant, total, and completely invisible to service monitoring.",
              "<strong>Range and summary statistics.</strong> Minimum, maximum, mean and a couple of quantiles. Catches unit changes — cents to units, seconds to milliseconds — which are silent and devastating.",
              "<strong>Category cardinality and unseen values.</strong> A new enum value the model has never encountered gets bucketed as unknown, and quality drops for exactly that slice.",
              "<strong>Distribution distance from a reference.</strong> A single scalar per feature summarizing how far the current window has moved from the training window. Useful as a trend and a triage aid; noisy as a page on its own, so alert on it loosely and investigate rather than paging.",
              "<strong>Training-versus-serving comparison.</strong> Log the feature values actually used at serving time and compare their distribution against the training set's. This is the direct detector for the skew described in <a href='#/mlsd/concepts/feature-stores'>the feature store lesson</a>."
            ]
          },
          { t: "note", variant: "tip", html: "If you can only say one sentence about monitoring in a design round, say this one: <em>\"Per-feature null rates and value ranges, alarmed against the training distribution.\"</em> It is a few lines of code, it catches upstream breakage before any quality metric moves, and it is the thing most candidates skip in favour of something more sophisticated and less useful." },
          { t: "h", text: "Layer two: prediction distributions" },
          { t: "p", html: "You do not need labels to notice that the model's behaviour changed. Watch the output itself: the histogram of scores, the fraction crossing your decision threshold, the mix of items the ranker chooses, and how confident it is." },
          {
            t: "table",
            headers: ["Signal", "What a shift can mean"],
            rows: [
              ["Score histogram moves", "Input distribution changed, a feature broke, or a new model version was rolled out"],
              ["Positive rate at the threshold jumps", "Either genuine change in the world, or the threshold is now in the wrong place"],
              ["Confidence collapses toward the middle", "Inputs are unlike anything in training — often a new segment or locale"],
              ["Catalogue coverage narrows", "A <a href='#/mlsd/serving/feedback-loops'>feedback loop</a> tightening; slow, and invisible to accuracy metrics"],
              ["Score distribution differs by version", "Shadow or canary comparison working exactly as intended"]
            ]
          },
          { t: "p", html: "Prediction monitoring is fast — it needs no labels — and it is ambiguous: a shift tells you something changed without telling you whether it was the world or the system. Treat it as a trigger for investigation, not as a verdict." },
          { t: "h", text: "Layer three: delayed ground truth" },
          { t: "p", html: "This is the layer that makes ML monitoring structurally harder than service monitoring. The metric you actually care about needs labels, and labels arrive late — sometimes very late." },
          {
            t: "code", lang: "text", code:
              "prediction at t=0\n" +
              "     |\n" +
              "     |   click / no click            minutes\n" +
              "     |   watch completion            hours\n" +
              "     |   moderation appeal upheld    days\n" +
              "     |   fraud chargeback            weeks to months\n" +
              "     |   churn window closes         a full window, by definition\n" +
              "     v\n" +
              "the accuracy dashboard is always behind by the label delay,\n" +
              "and it is behind by MORE for the errors that cost the most"
          },
          { t: "note", variant: "warn", html: "<strong>Label delay is not uniform, and that is the dangerous part.</strong> The cheap labels arrive quickly and the expensive ones arrive slowly, so your fast feedback is systematically biased toward the failures that matter least. A fraud model can look healthy on every fast signal for a month and be quietly leaking money the entire time." },
          { t: "h", text: "Alerting before the business metric moves" },
          { t: "p", html: "The business metric is the last thing to move and the worst thing to alert on — by the time weekly revenue is visibly down, the damage is a week old and a dozen other changes are confounded with yours. Order your alarms by how early they fire." },
          {
            t: "table",
            headers: ["Fires", "Signal", "Alarm on it?"],
            rows: [
              ["Immediately", "Feature null rate, value range, schema mismatch", "Yes — page. These are almost always real and almost always upstream"],
              ["Minutes", "Prediction distribution shift, positive-rate jump", "Yes — ticket, with context. Too noisy to page reliably"],
              ["Hours", "Fast proxy labels: click-through, immediate abandonment", "Yes, on a large deviation, segmented by slice"],
              ["Days", "Slower labels: completion, appeals, resolution rate", "Trend review rather than an alarm"],
              ["Weeks", "The business metric", "Never the primary alarm — it is the confirmation"]
            ]
          },
          { t: "h", text: "Two habits that catch what dashboards miss" },
          {
            t: "ul", items: [
              "<strong>Segment everything.</strong> An aggregate metric is an average, and an average can be flat while a small segment — a locale, a device class, new accounts — is being served badly. Report the primary metric by slice and treat a bad slice as a defect. This is the same discipline described in <a href='#/mlsd/concepts/generalization'>generalization</a>, applied to production.",
              "<strong>Keep a fixed evaluation set and re-score it on a schedule.</strong> A frozen, labelled sample scored by every new model version gives you a comparison that is unaffected by whatever the traffic did this week — which is exactly what you want when you are trying to work out whether the model changed or the world did."
            ]
          },
          { t: "p", html: "And have the response ready before you are asked for it: a versioned registry so rollback is one operation, a documented owner, a threshold that can be adjusted without a retrain, and a fallback path — a heuristic, a cached ranking, or a previous model — that the system can drop to while you investigate." },
          { t: "cue", html: "When an interviewer asks \"how would you know the model is getting worse?\", do not answer with accuracy. Answer with the three layers and their timing: inputs immediately, predictions within minutes, labels after a delay you should state in the units of this specific problem." },
          { t: "note", variant: "key", html: "<strong>ML failures are silent, and ground truth is late.</strong> Alarm on the layers that fire early — per-feature null rates and ranges first, prediction distributions second — because by the time the quality metric moves, the incident is already as old as your label delay." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "feedback-loops",
        title: "Closing the loop without poisoning it",
        summary: "Position and presentation bias, exploration as the price of honest data, and the degenerate spiral where a model only learns from what it already chose.",
        minutes: 10,
        tags: ["serving", "operations", "bias"],
        blocks: [
          { t: "p", html: "This is the last lesson in the track, and it closes the loop that <a href='#/mlsd/framework/high-level-design'>the high-level design lesson</a> opened. That arrow from serving logs back into training data is what keeps the system learning. It is also the mechanism by which the system can quietly corrupt itself, and the difference between those two outcomes is entirely down to decisions you make at design time." },
          { t: "h", text: "Your logs are not a sample of the world" },
          { t: "p", html: "It is tempting to treat logged interactions as observations of user preference. They are not. They are observations of user preference <em>conditioned on what your system chose to show, in the position it chose to show it</em>. Two distinct biases are baked in." },
          {
            t: "table",
            headers: ["Bias", "Mechanism", "Consequence for training"],
            rows: [
              ["<strong>Position bias</strong>", "Items higher in a list get more attention and more clicks regardless of quality", "A click partly measures where the old model put the item, so a naive model learns to reproduce the old ordering"],
              ["<strong>Presentation bias</strong>", "Only what was displayed can be interacted with at all", "Items never shown have no data, so they can never be learned to be good, so they are never shown"],
              ["<strong>Trust and context bias</strong>", "Users react to layout, thumbnails, badges and surrounding items, not to the item alone", "The same item scores differently depending on what it was shown next to"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Position bias makes offline replay on click logs deeply misleading.</strong> A new ranking evaluated against old clicks is rewarded for agreeing with the old ranking, because that is the ordering under which the clicks were collected. Any model that reorders significantly looks worse offline — including the good ones. This is a large part of why <a href='#/mlsd/concepts/ab-testing'>offline gains fail to replicate online</a>, in both directions." },
          { t: "h", text: "The degenerate spiral" },
          { t: "p", html: "Put the two biases together and the system develops a preference for its own past opinions. Nothing here is a bug. Every step is the system working exactly as designed." },
          {
            t: "code", lang: "text", code:
              "model believes item class A is good\n" +
              "   -> shows more A, less B\n" +
              "   -> collects interaction data mostly about A\n" +
              "   -> B accumulates no evidence, in either direction\n" +
              "   -> next model sees strong signal for A, nothing for B\n" +
              "   -> believes A is good, with more confidence\n" +
              "   -> ...\n" +
              "\n" +
              "the accuracy metric improves the whole way down,\n" +
              "because it is computed on the narrowing distribution"
          },
          { t: "p", html: "The symptoms are recognisable once you know to look, and none of them show up on an accuracy dashboard: catalogue coverage falls week over week; new items take longer and longer to get their first impressions; a small set of popular items takes an ever-larger share of traffic; and long-term engagement drifts down while every short-term metric looks healthy." },
          { t: "h", text: "Exploration: paying for honest data" },
          { t: "p", html: "The only way information enters the loop from outside is if you put it there deliberately. That means showing some things the model did not rank highest — and accepting that it will cost you." },
          {
            t: "ul", items: [
              "<strong>A randomized slice.</strong> Reserve a small fraction of traffic, or a slot in each result set, for items chosen randomly rather than by score. Simple, unbiased, and the easiest thing to explain and to switch off.",
              "<strong>Bandit-style allocation.</strong> Allocate impressions in proportion to uncertainty rather than uniformly, so exploration concentrates where you actually do not know the answer instead of being spread evenly.",
              "<strong>A new-item quota.</strong> Guarantee every new item some minimum number of impressions before the model is allowed to decide it is bad. Targets the exact failure that hurts a catalogue most.",
              "<strong>Explore in low-cost contexts.</strong> Lower positions, later in a session, or on surfaces where a mediocre result is cheap. Buys data at a discount."
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Exploration has a real cost and you should name it rather than presenting it as free.</strong> Every explored impression is one you expected to be worse, so short-term engagement goes down by construction. The argument for it is not that it is costless — it is that without it the training distribution narrows until the model can no longer discover anything, and you are paying for a slow decline instead of a visible line item." },
          { t: "h", text: "Propensity logging: the thing you cannot add later" },
          { t: "p", html: "If you know the probability with which each item was selected, you can reweight your logs to approximate what you would have seen under a different policy — items shown rarely count for more, items shown constantly count for less. That correction is only possible if the probability was recorded at the moment of the decision." },
          {
            t: "code", lang: "text", code:
              "log, at decision time, for every impression:\n" +
              "  item id\n" +
              "  position\n" +
              "  model version\n" +
              "  p(shown)     <- the selection probability under the\n" +
              "                  policy that was live at that instant\n" +
              "\n" +
              "you cannot reconstruct p(shown) afterwards:\n" +
              "the model has been retrained, the candidate set is gone,\n" +
              "and the randomization seed was never persisted."
          },
          { t: "note", variant: "trap", html: "<strong>This is the most expensive thing in this track to add retroactively, and it costs almost nothing to add up front.</strong> A design that mentions logging propensities alongside position and model version reads as someone who has run one of these systems. It is also a prerequisite for evaluating a candidate policy offline at all — without it, the only honest way to compare policies is a live test." },
          { t: "h", text: "Debiasing at training time" },
          { t: "p", html: "Two standard techniques, both worth being able to name and neither a complete fix." },
          {
            t: "compare",
            bad: { title: "Position as an ordinary feature", items: ["The model learns rank one is good", "At serving it must predict a position it has not chosen yet", "Circular: position depends on score depends on position"] },
            good: { title: "Position handled deliberately", items: ["Include position during training so the model attributes some click to placement", "Set it to a fixed constant at inference for every candidate", "The model then scores relevance, not placement"] }
          },
          {
            t: "ul", items: [
              "<strong>Inverse propensity weighting.</strong> Weight each logged example by the inverse of the probability it was shown, so rarely-shown items count more. It removes bias in expectation and adds variance — a single very-low-propensity example can dominate the gradient, so weights are usually clipped, which trades a little bias back for stability.",
              "<strong>Position debiasing.</strong> The pattern in the comparison above: position is a training-time feature and a serving-time constant. Cheap, effective, and easy to get subtly wrong by forgetting the constant at inference."
            ]
          },
          { t: "h", text: "What to say when this comes up" },
          { t: "p", html: "It comes up in almost every recommendation, feed, ads and search prompt, usually as \"what could go wrong with training on your own logs?\" A complete answer has four parts and takes about thirty seconds." },
          {
            t: "ol", items: [
              "<strong>Name the bias.</strong> \"The logs only contain what we chose to show, in the position we showed it, so clicks measure placement as well as quality.\"",
              "<strong>Name the spiral.</strong> \"Left alone, each generation confirms the last, coverage narrows, and every short-term metric looks fine while it happens.\"",
              "<strong>Name the instrumentation.</strong> \"So I'd log position, model version and selection probability at decision time — none of which can be reconstructed later.\"",
              "<strong>Name the cost.</strong> \"And I'd reserve a small exploration slice, which costs short-term engagement and is the price of having data that can still teach us something next quarter.\""
            ]
          },
          { t: "p", html: "That is the arc of this track in miniature: an objective that is honest about what it optimizes, a system designed so its own operation does not invalidate its evidence, and a trade-off stated out loud rather than hidden. The <a href='#/mlsd/framework/problem-framing'>framing lesson</a> and this one are the same idea at opposite ends of the pipeline. The breakdowns — <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a>, <a href='#/mlcase/recsys/ad-click-prediction'>ad click prediction</a>, <a href='#/mlcase/trust/harmful-content'>harmful content</a>, <a href='#/mlcase/retrieval/search-ranking'>search ranking</a> — put the whole vocabulary to work on one problem at a time." },
          { t: "cue", html: "Raise feedback loops unprompted whenever the model chooses what the user sees and the user's response becomes training data. That covers recommendations, feeds, search, ads, and any moderation system where enforcement decides which content ever gets reviewed again." },
          { t: "note", variant: "key", html: "<strong>A system that trains on its own choices will keep confirming them, and every short-term metric will approve.</strong> Log position, model version and selection probability at decision time — they cannot be recovered later — reserve a slice of exploration, and treat catalogue coverage as a health metric alongside accuracy." },
          { t: "quiz", id: "mlsd-serving" }
        ]
      }
    ]
  };

  /* ==================================================================
     7. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.mlsd = {
    id: "mlsd",
    name: "ML System Design",
    short: "MLSD",
    tagline: "Design the system, not the algorithm",
    color: "#a78bfa",
    blurb: "The interview round where the hard part is choosing an objective you can measure and defending a modelling choice — not sizing a cache. A six-phase phase plan with time budgets, then the modelling vocabulary you have to defend under pressure: embeddings and approximate retrieval, features and the five ways they betray you, honest data splits, and the metrics that decide whether any of it worked. Closes with the operational half most candidates skip — two-stage serving, inference architecture, drift, and the feedback loop that lets a system quietly poison its own training data.",
    modules: [MOD_FRAMEWORK, MOD_CONCEPTS, MOD_SERVING]
  };
})();
