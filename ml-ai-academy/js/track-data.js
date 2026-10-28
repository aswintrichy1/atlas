/* =====================================================================
   SYNAPSE · Data & Features
   window.TRACKS.data — modules: labels / correctness / features

   Self-contained: this file registers its own widget, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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
     1. dataLeakSpotter — "Spot the leak"
     Deterministic: the readout is a pure function of (scenario, picks, revealed).
  ================================================================== */
  var LEAK_KIND_LABEL = {
    safe: "safe",
    target: "target leak",
    temporal: "temporal leak",
    contamination: "contamination"
  };

  var LEAK_SCENARIOS = {
    churn: {
      label: "30-day churn",
      setup: "A subscription product scores every active subscriber at 00:00 on the 1st of the month. Label: did the subscriber cancel within the next 30 days? Training rows come from 24 monthly snapshots.",
      features: [
        { name: "tenure_months", detail: "months since signup, as of the scoring date", truth: "safe",
          why: "Fully determined by the signup date and the scoring date. Nothing after the decision instant can change it." },
        { name: "cancellation_reason_code", detail: "dropdown filled in on the cancel screen", truth: "target",
          why: "This field only exists for people who cancelled, so a non-null value is the label wearing a disguise. Expect it to top the importance chart and to be null for every live request." },
        { name: "support_tickets_30d", detail: "tickets opened in the 30 days before the scoring date", truth: "safe",
          why: "The window ends at the decision instant. As long as ticket timestamps are event times and not ingestion times, this is exactly what serving would see." },
        { name: "lifetime_logins", detail: "read from the current user_stats table", truth: "temporal",
          why: "The current table holds today's count. Attached to a snapshot from last year, it includes every login that happened after the scoring date — and churners stop logging in, so it separates the classes using the future." },
        { name: "plan_price", detail: "monthly price on the scoring date", truth: "safe",
          why: "Known at decision time, and price is a legitimate cause of churn rather than a consequence of it." },
        { name: "user_id (random row split)", detail: "raw id used as a feature; monthly rows split at random", truth: "contamination",
          why: "The same subscriber appears in train and test across different months. The model memorises per-user outcomes through the id, so test accuracy measures recall of people it has already met. Split by user or by time, and drop the raw id." },
        { name: "days_since_last_login", detail: "computed at 00:00 on the scoring date", truth: "safe",
          why: "A strong, honest signal: it only looks backwards from the decision instant, and serving can compute the same value from the same log." },
        { name: "account_status", detail: "joined from the live CRM table", truth: "temporal",
          why: "Live CRM says 'closed' for anyone who has since cancelled. Joined onto old snapshots it is the label from the future. You need the status as it stood at 00:00 on the scoring date, which means an as-of join against a history table." }
      ]
    },
    loan: {
      label: "Loan default",
      setup: "A lender decides at application time whether to approve. Label: did the borrower default within 12 months of origination? Training rows come from three years of funded loans.",
      features: [
        { name: "months_of_payments_made", detail: "count of on-time payments on the loan", truth: "temporal",
          why: "Payments happen after the loan is funded. At application time this is always zero, so the model learns a relationship it will never be allowed to use." },
        { name: "stated_annual_income", detail: "from the application form", truth: "safe",
          why: "Captured on the form at the decision instant. It may be noisy or exaggerated, but noise is not leakage — serving sees the same field." },
        { name: "collections_agency_assigned", detail: "flag from the servicing system", truth: "target",
          why: "Collections are assigned because a borrower defaulted. This is a consequence of the label, and it is perfectly predictive offline and permanently false online." },
        { name: "debt_to_income", detail: "computed from the application and bureau pull at apply time", truth: "safe",
          why: "Both inputs are frozen at application. Make sure the bureau pull is the one stored with the application, not a later refresh." },
        { name: "credit_score", detail: "read from the bureau table, refreshed nightly", truth: "temporal",
          why: "A nightly-refreshed table holds the current score. A borrower who defaulted last year has a much lower score today, so the feature imports the outcome. Store and join the score that was pulled for the decision." },
        { name: "prior_applications_12m", detail: "applications in the year before this one", truth: "safe",
          why: "Backward-looking from the application timestamp and computable at serving time from the same table." },
        { name: "applicant (re-applications)", detail: "the same person re-applies; rows split at random", truth: "contamination",
          why: "Re-applications are near-duplicates with the same outcome. With a random split, one copy trains and the other tests, inflating the score. Group the split by applicant and dedupe near-identical applications." },
        { name: "employment_length_years", detail: "from the application form", truth: "safe",
          why: "Declared at the decision instant and available identically at serving time." }
      ]
    }
  };

  function leakTally(feats, picks) {
    var t = { correct: 0, missed: 0, falseAlarm: 0, unsure: 0, leaks: 0 };
    for (var i = 0; i < feats.length; i++) {
      var isLeak = feats[i].truth !== "safe";
      var p = picks[i];
      if (isLeak) t.leaks++;
      if (p === "?") { t.unsure++; continue; }
      if ((p === "leak") === isLeak) t.correct++;
      else if (isLeak) t.missed++;
      else t.falseAlarm++;
    }
    return t;
  }

  function leakVerdict(t, n, revealed) {
    if (revealed) return "Answers revealed. The pattern to keep: every leak here is either a consequence of the label, a value read from after the decision instant, or the same entity on both sides of the split.";
    if (t.unsure === n) return "Classify each feature. Ask one question per row: could serving read exactly this value at the decision instant, for an entity the model has never seen?";
    if (t.missed > 0) return t.missed + " leak" + (t.missed === 1 ? "" : "s") + " slipped through. A missed leak is the expensive error: the offline metric rewards it and production pays for it.";
    if (t.falseAlarm > 0) return t.falseAlarm + " false alarm" + (t.falseAlarm === 1 ? "" : "s") + ". Cheaper than a miss, but dropping honest signal costs you lift — check the timestamp before you cut a feature.";
    if (t.unsure > 0) return "No mistakes so far, " + t.unsure + " still unsure. Read the setup again for the decision instant.";
    return "All " + n + " classified correctly. That is the audit an interviewer wants to hear you run out loud.";
  }

  Widgets.dataLeakSpotter = function (mount) {
    shell(mount, "audit", "Spot the leak",
      "Pick a scenario, then mark each candidate feature Safe or Leaks. Each explanation appears once you commit to a call. The readout counts correct calls, missed leaks and false alarms.");

    var scenario = "churn";
    var picks = [];
    var revealed = false;
    var rows = [];

    var setupP = h("p", { style: "font-size:0.86rem;line-height:1.55;margin:0 0 6px;color:var(--text)" });
    var list = h("div", {});
    var stage = h("div", { class: "w-stage" }, setupP, list);
    var readout = h("div", { class: "w-readout" });

    function resetPicks() {
      var n = LEAK_SCENARIOS[scenario].features.length;
      picks = [];
      for (var i = 0; i < n; i++) picks.push("?");
      revealed = false;
    }

    function buildList() {
      var sc = LEAK_SCENARIOS[scenario];
      setupP.textContent = sc.setup;
      clear(list);
      rows = [];
      for (var i = 0; i < sc.features.length; i++) {
        (function (f, idx) {
          var verdict = h("span", { style: "font-family:var(--font-mono);font-size:0.74rem" });
          var why = h("div", { style: "font-size:0.82rem;line-height:1.5;color:var(--text-dim);margin-top:4px" });
          var row = h("div", { style: "padding:9px 0 9px 12px;margin:6px 0;border-left:3px dashed var(--line-strong)" },
            h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between" },
              h("span", { style: "font-size:0.86rem;color:var(--text)" },
                h("code", { class: "tok" }, f.name), " — " + f.detail),
              segment([["?", "Unsure"], ["ok", "Safe"], ["leak", "Leaks"]], 0, function (v) { picks[idx] = v; paint(); })
            ),
            h("div", { style: "margin-top:4px" }, verdict),
            why
          );
          rows.push({ row: row, verdict: verdict, why: why });
          list.appendChild(row);
        })(sc.features[i], i);
      }
    }

    function paint() {
      var feats = LEAK_SCENARIOS[scenario].features;
      for (var i = 0; i < feats.length; i++) {
        var f = feats[i], r = rows[i], p = picks[i];
        var isLeak = f.truth !== "safe";
        var show = revealed || p !== "?";
        if (p === "?" && !revealed) {
          r.row.style.borderLeft = "3px dashed var(--line-strong)";
          r.verdict.style.color = "var(--text-dim)";
          r.verdict.textContent = "unclassified";
        } else if (p === "?") {
          r.row.style.borderLeft = "3px dashed var(--amber)";
          r.verdict.style.color = "var(--amber-ink)";
          r.verdict.textContent = "answer: " + LEAK_KIND_LABEL[f.truth];
        } else {
          var right = (p === "leak") === isLeak;
          r.row.style.borderLeft = "3px solid " + (right ? "var(--lime)" : "var(--rose)");
          r.verdict.style.color = right ? "var(--lime-ink)" : "var(--rose-ink)";
          r.verdict.textContent = (right ? "correct — " : (isLeak ? "missed — " : "false alarm — ")) + LEAK_KIND_LABEL[f.truth];
        }
        r.why.textContent = show ? f.why : "";
      }

      var t = leakTally(feats, picks);
      clear(readout);
      readout.appendChild(ro("correct", t.correct + "/" + feats.length));
      readout.appendChild(ro("missed leaks", t.missed));
      readout.appendChild(ro("false alarms", t.falseAlarm));
      readout.appendChild(ro("unsure", t.unsure));
      readout.appendChild(ro("true leaks", t.leaks));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, leakVerdict(t, feats.length, revealed)));
    }

    var revealBtn = h("button", { type: "button", class: "w-btn primary" }, "Reveal all");
    revealBtn.addEventListener("click", function () { revealed = true; paint(); });
    var resetBtn = h("button", { type: "button", class: "w-btn ghost" }, "Reset");
    resetBtn.addEventListener("click", function () { resetPicks(); buildList(); paint(); });

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["churn", LEAK_SCENARIOS.churn.label], ["loan", LEAK_SCENARIOS.loan.label]], 0, function (v) {
        scenario = v; resetPicks(); buildList(); paint();
      }),
      revealBtn,
      resetBtn
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    resetPicks();
    buildList();
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     2. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "data-labels": {
      title: "Labels checkpoint",
      sub: "Where labels come from, how to buy them cheaply, and what imbalance does to your probabilities.",
      questions: [
        {
          q: "Two annotators agree on 90% of items, and each marks about 10% of items positive. Why is 90% agreement less reassuring than it sounds?",
          options: [
            "Agreement above 80% on any binary task usually means annotators are copying each other",
            "Chance alone gives about 82% agreement here, so kappa is only around 0.44",
            "Percent agreement is undefined for binary labels and must be replaced by plain accuracy",
            "Agreement only becomes meaningful once there are three or more annotators per item"
          ],
          answer: 1,
          explain: "When most items are negative, two annotators who both say 'no' most of the time agree constantly by accident: 0.1 × 0.1 + 0.9 × 0.9 = 0.82. Kappa subtracts that chance agreement, giving (0.90 − 0.82) / (1 − 0.82) ≈ 0.44 — moderate at best. Report kappa, or agreement on the positive class, for imbalanced tasks."
        },
        {
          q: "You train a click model after keeping only 10% of negatives. On a held-out example it outputs 0.50. What is the calibrated probability on the true distribution?",
          options: [
            "0.05",
            "0.50 (unchanged)",
            "About 0.09",
            "About 0.33"
          ],
          answer: 2,
          explain: "Downsampling negatives by w = 0.1 multiplies the odds by 1/w. Undo it with p = p' / (p' + (1 − p') / w) = 0.5 / (0.5 + 0.5 / 0.1) = 0.5 / 5.5 ≈ 0.091. The ranking order is unchanged, but anything that consumes the probability — an auction bid, an expected-value threshold — needs the corrected number."
        },
        {
          q: "Which labelling approach is the best first move when you have no labels, a domain expert for one afternoon, and two million unlabelled support tickets?",
          options: [
            "Have the expert write labelling functions, combine their votes, and check them on a small gold set",
            "Hand-label tickets sampled at random, one by one, until the afternoon and budget run out",
            "Train an unsupervised clustering model over ticket embeddings and treat every resulting cluster as a ticket class",
            "Wait until enough customers self-report their category, then train on those reports alone"
          ],
          answer: 0,
          explain: "An afternoon of expert time labels maybe a few hundred tickets by hand, but the same afternoon spent writing heuristics labels millions. Weak supervision combines noisy, overlapping rules into a probabilistic label, and the small gold set tells you how accurate those rules are. Clustering does not know your classes, and waiting for self-reports gives you a biased, delayed sample."
        },
        {
          q: "An active-learning loop picks only the examples the model is least certain about. After a few rounds the labelled batches are nearly identical. What is the fix?",
          options: [
            "Switch to picking the examples the model is most certain about, so each batch is clean",
            "Stop active learning and label at random from now on",
            "Increase the batch size so the duplicates are diluted by more examples from the same region",
            "Blend uncertainty with diversity: cluster the uncertain pool, sample across clusters"
          ],
          answer: 3,
          explain: "Pure uncertainty sampling concentrates on one confusing region, so a batch can be fifty near-copies of the same ambiguous case. Diversity sampling spreads the batch across the input space so each label teaches something new. Most production loops also keep a slice of random samples so evaluation stays unbiased."
        },
        {
          q: "Fraud is 0.2% of transactions. You train with class weights that make positives count 500 times more. What must you still do before shipping?",
          options: [
            "Nothing — class weights keep predicted probabilities calibrated to the real base rate automatically",
            "Remove the weights at inference time by dividing scores by 500",
            "Evaluate precision, recall and calibration on a test set with the true 0.2% base rate",
            "Upsample the test set so it matches the training balance"
          ],
          answer: 2,
          explain: "Weights change what the loss pays attention to, which also shifts predicted probabilities upward; they are no longer calibrated to the real base rate. Precision in particular depends on prevalence, so it must be measured on data with the production mix. Rebalancing the test set would make precision look far better than it will be."
        },
        {
          q: "Your label is 'loan defaulted within 12 months'. What is the main design consequence of that label delay?",
          options: [
            "Complete labels are a year old, so you need an earlier proxy label to react faster",
            "The model can only be retrained once per year, on the anniversary of the label window",
            "Label delay only affects evaluation, never training",
            "Shorten the label window to one week so labels are always fresh, keeping the same target"
          ],
          answer: 0,
          explain: "Every training row needs twelve months of hindsight, so the newest complete labels describe applications from a year ago. Teams add an early proxy — say, 60-day delinquency — that correlates with default and arrives sooner, and they monitor how well the proxy tracks the real label. Shrinking the window to a week changes what you predict rather than fixing the delay."
        }
      ]
    },

    "data-correctness": {
      title: "Correctness checkpoint",
      sub: "Leakage, point-in-time joins, and the validation gates that keep bad data out of training and serving.",
      questions: [
        {
          q: "A churn model scores AUC 0.99 offline and barely beats a baseline online. Which check is the fastest way to find the problem?",
          options: [
            "Retrain with a larger model and more data to close the offline/online gap",
            "Increase the A/B test duration",
            "Switch the offline metric from AUC to log loss, which is more sensitive to skew in production",
            "Rank features by importance and audit the top few against the decision timestamp"
          ],
          answer: 3,
          explain: "A near-perfect offline score on a hard problem plus a large offline/online gap is the signature of leakage. The leaking feature is almost always among the most important ones, because it carries label information. Checking when each of those features became knowable relative to the decision instant usually finds it in minutes."
        },
        {
          q: "You standardise features using the mean and standard deviation of the whole dataset, then split into train and test. What kind of leakage is this?",
          options: [
            "Target leakage",
            "Preprocessing leakage — test-set statistics shape the training transform",
            "Label noise",
            "Temporal leakage, because the event timestamps were included in the scaling step"
          ],
          answer: 1,
          explain: "Fitting any transform — scaler, imputer, vocabulary, target encoder — before splitting lets the test rows influence what the model sees during training. The effect is usually small for a scaler and large for a target encoder. Fit every transform on training data only, inside the cross-validation fold."
        },
        {
          q: "In an as-of join that builds training rows, which timestamp should the feature row be compared against the event time with?",
          options: [
            "The time the feature value became readable by the serving path",
            "The time the training job ran",
            "The partition date of the warehouse table",
            "The time the event row was ingested into the warehouse by the loading job"
          ],
          answer: 0,
          explain: "The join must reproduce what serving could have read at the decision instant. A daily aggregate computed for 'yesterday' may only land in the online store at 06:00 today; using its logical date instead of its availability time hands training a few hours of future. Ingestion and job-run times describe the pipeline, not what the model could see."
        },
        {
          q: "A backfill recomputes a feature for the past two years with a corrected definition. What is the risk for point-in-time correctness?",
          options: [
            "Backfills always break the online store",
            "None — a corrected value is always better for training, so the backfill strictly improves the model",
            "It may use late or corrected data, so training sees cleaner history than serving did",
            "Backfills only matter for streaming features"
          ],
          answer: 2,
          explain: "A backfill run today can see late events, refunds and corrections that the live pipeline did not have at the time. Training then learns from a tidier past than serving will ever see, which is a quiet form of skew. Either reproduce the original lag in the backfill or record the availability timestamp honestly."
        },
        {
          q: "A nightly ingestion check finds that a feature's null rate jumped from 1% to 40%. Which response is usually the right default before training?",
          options: [
            "Train anyway; the model will learn to handle nulls",
            "Quarantine the batch and alert the owner, training on the last good snapshot",
            "Fill the nulls with the column mean from the last good snapshot and continue the run",
            "Delete the feature from the model permanently"
          ],
          answer: 1,
          explain: "A 40x jump in nulls is almost always an upstream break, not a change in the world. Quarantining keeps the bad batch out of training while preserving it for debugging, and the model keeps running on the last good data. Imputing silently trains the model on a broken signal, and permanently dropping the feature overreacts to one bad night."
        },
        {
          q: "Which split best protects a session-level click model against train/test contamination?",
          options: [
            "Random split at the row level",
            "Stratified split on the click label",
            "Split by feature hash so that each feature value appears in both the train and the test set",
            "Split by user and by time, so test users and test days are unseen in training"
          ],
          answer: 3,
          explain: "Rows from the same user share habits and often near-duplicate contexts, so a row-level split lets the model recognise users rather than generalise. A time split mirrors production, where you always predict the future. Stratifying on the label fixes class balance but does nothing about shared entities."
        }
      ]
    },

    "data-features": {
      title: "Features in production checkpoint",
      sub: "Feature stores, encodings, and embeddings as features — what each one costs once real traffic hits it.",
      questions: [
        {
          q: "What does a feature store's online store typically hold?",
          options: [
            "Full feature history for every entity, used to answer as-of joins",
            "Raw event logs before aggregation",
            "Model weights and training checkpoints",
            "The latest value per entity key, served at low latency"
          ],
          answer: 3,
          explain: "The online store is a key-value view optimised for request-time lookups, so it keeps only the current value per key. History lives in the offline store, where training does as-of joins. Materialisation keeps both in sync from a single definition."
        },
        {
          q: "You target-encode a high-cardinality merchant id using the mean fraud rate per merchant. What must you do to avoid leakage?",
          options: [
            "Compute it out-of-fold or from strictly earlier rows, smoothed toward the global mean",
            "Compute the encoding on the full dataset before splitting so every merchant has a stable value",
            "One-hot encode the merchant id instead and skip smoothing",
            "Use the encoding only at serving time"
          ],
          answer: 0,
          explain: "A row's own label contributes to its merchant's mean if you encode on the full data, so the feature partly is the label — badly so for merchants with few rows. Out-of-fold or time-ordered encoding removes the row's own label, and smoothing stops a merchant with two transactions from getting a 0% or 100% encoding."
        },
        {
          q: "You store 100 million item embeddings of dimension 256 in float32. Roughly how much raw storage is that?",
          options: [
            "About 10 GB",
            "About 1 TB (1,000 GB)",
            "About 100 GB",
            "About 25 GB"
          ],
          answer: 2,
          explain: "100,000,000 × 256 dimensions × 4 bytes = 102.4 billion bytes, about 100 GB before any index overhead. Int8 quantisation cuts that to about 25 GB, and product quantisation to 32 bytes per vector brings it near 3 GB, each at some cost in recall."
        },
        {
          q: "You retrain the embedding model that produces item vectors. Why can't you just swap the new vectors into the existing nearest-neighbour index?",
          options: [
            "The new vectors are always larger in dimension",
            "Different model versions produce incompatible spaces, so queries, items and index must match",
            "Nearest-neighbour indexes are immutable and cannot accept any new vectors once they are built",
            "The old vectors are automatically deleted on retrain"
          ],
          answer: 1,
          explain: "Each training run picks its own arbitrary rotation of the space; a query embedded with v2 compared against items embedded with v1 returns noise. That is the re-index problem: you rebuild the index for v2, keep v1 live until it is ready, then cut queries and items over together. Downstream models that consume the vectors as features need retraining too."
        },
        {
          q: "When is a dedicated feature store most likely not worth it?",
          options: [
            "When dozens of models share user-level aggregates",
            "When features must be fresh within seconds at serving time and are shared by several request-time models",
            "When several teams keep reimplementing the same features",
            "One batch model, scored offline daily, with features computed in the same job that trains it"
          ],
          answer: 3,
          explain: "A feature store pays for itself by giving one definition two consistent read paths and by enabling reuse. A single batch model scored by the same pipeline that trains it has only one read path, so skew between two implementations cannot happen. Shared aggregates, tight freshness and duplicated work are exactly the situations it is built for."
        },
        {
          q: "Hashing a high-cardinality categorical into 2^18 buckets instead of one-hot encoding it buys you a fixed-size feature. What does it cost?",
          options: [
            "Collisions: unrelated categories share a bucket, which adds noise mostly for rare values",
            "It requires building and versioning a vocabulary over the full training data before training can start",
            "New categories at serving time cause a crash",
            "It leaks the label into the feature"
          ],
          answer: 0,
          explain: "The hashing trick avoids a vocabulary entirely, so unseen categories simply land in some bucket at serving time. The price is collisions: two unrelated values can share a weight. With enough buckets the damage is small and falls mostly on rare values, which had little signal anyway."
        }
      ]
    }
  });

  /* ==================================================================
     3. Module: labels
  ================================================================== */
  var MOD_LABELS = {
    id: "labels",
    name: "Labels",
    icon: "database",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "label-sources",
        title: "Where labels come from and how they lie",
        summary: "Explicit, implicit and human-annotated labels; delay, proxies, agreement, gold sets and the noise you will never fully remove.",
        minutes: 10,
        tags: ["labels", "data-quality"],
        blocks: [
          { t: "p", html: "Every supervised model is a compression of its labels. If the labels measure the wrong thing, arrive late, or disagree with themselves, no architecture saves you — the model faithfully learns the flaw. Before you pick a model in an interview, say where the labels come from and what is wrong with them." },
          { t: "h", text: "Three sources, three failure modes" },
          {
            t: "table",
            headers: ["Source", "Example", "Strength", "Failure mode"],
            rows: [
              ["Explicit feedback", "Star ratings, thumbs, 'report this post'", "Unambiguous intent", "Sparse and self-selected: only people with strong opinions respond"],
              ["Implicit feedback", "Clicks, watch time, purchases, dwell", "Abundant, free, arrives in real time", "Measures behaviour, not satisfaction; shaped by what you chose to show"],
              ["Human annotation", "Reviewers labelling content against a policy", "You define exactly what the label means", "Slow, expensive, and annotators disagree more than you expect"],
              ["Outcome logs", "Chargebacks, defaults, returns", "Ground truth about the thing you care about", "Arrives weeks or months later"]
            ]
          },
          { t: "p", html: "Implicit labels deserve the most suspicion because they look like ground truth. A click is evidence the thumbnail worked, not that the video was good. A long watch session might mean engagement or a phone left on a table. Pick the implicit signal that sits closest to the value you actually want, and say which way it is biased." },
          { t: "h", text: "Label delay and proxy labels" },
          { t: "p", html: "Some labels only exist after a wait. Fraud is confirmed by a chargeback that can arrive 60–90 days later; a loan default needs a year. The freshest fully-labelled row is therefore as old as the label window, which caps how quickly the model can react to a new pattern." },
          {
            t: "code", lang: "text", code:
              "label: chargeback within 90 days\n" +
              "today:                       2026-10-28\n" +
              "newest complete label from:  2026-07-30\n" +
              "\n" +
              "proxy: 'disputed within 14 days'  -> complete for 2026-10-14\n" +
              "  catches maybe 60-70% of eventual chargebacks, 11 weeks sooner"
          },
          { t: "p", html: "The standard answer is a <strong>proxy label</strong> that arrives early and correlates with the real one, used alongside it: train on the proxy for freshness, evaluate against the real outcome once it lands, and watch the correlation between the two. When the proxy drifts away from the outcome, the model is optimising the wrong thing and the metrics will not tell you." },
          { t: "note", variant: "trap", html: "<strong>Unmatured labels look like negatives.</strong> A transaction from last week with no chargeback yet is not a clean negative — the chargeback may still be coming. Train on it as a negative and you teach the model that recent fraud is safe. Either exclude rows younger than the label window or model the maturation explicitly." },
          { t: "h", text: "Measuring whether humans agree" },
          { t: "p", html: "If two careful annotators cannot agree on an item, the model will not either, and the ceiling on your metric is set by that disagreement. Raw percent agreement overstates quality on imbalanced tasks, because annotators agree on the obvious negatives by accident. <strong>Cohen's kappa</strong> corrects for that chance agreement:" },
          {
            t: "code", lang: "text", code:
              "kappa = (p_observed - p_chance) / (1 - p_chance)\n" +
              "\n" +
              "two annotators, each marks 10% positive, agree on 90% of items\n" +
              "p_chance = 0.10*0.10 + 0.90*0.90 = 0.82\n" +
              "kappa    = (0.90 - 0.82) / (1 - 0.82) = 0.44   -> only moderate"
          },
          { t: "p", html: "Low kappa is usually a <em>guideline</em> problem, not an annotator problem. The fix is to read the disagreements, find the ambiguous policy clause, rewrite it with examples on both sides of the line, and re-measure. Kappa around 0.6–0.8 is a common target for subjective policy tasks; much lower means the label is not well-defined yet." },
          { t: "h", text: "Gold sets and label noise" },
          {
            t: "ul", items: [
              "<strong>Gold set.</strong> A few hundred to a few thousand items labelled by your best experts, adjudicated, and frozen. It is your evaluation anchor and your annotator quality check — seed gold items into every annotation batch and score each annotator against them.",
              "<strong>Random noise</strong> (an annotator misclicks) mostly lowers the ceiling; large models tolerate a few percent of it.",
              "<strong>Systematic noise</strong> (one region's reviewers read the policy differently, or implicit labels biased by position) teaches the model a wrong rule. It does not average out with more data.",
              "<strong>Finding noise:</strong> train, then inspect examples where a confident model disagrees with the label. A meaningful share will be label errors, and fixing them often beats any model change."
            ]
          },
          { t: "note", variant: "tip", html: "Keep evaluation labels to a higher standard than training labels. Training on noisy labels costs a little accuracy; evaluating on noisy labels means you cannot tell whether a change helped. This is why the gold set is adjudicated by experts while training labels can come from cheaper sources." },
          { t: "cue", html: "Raise labels whenever the prompt says 'we have engagement data', 'users can report', 'we have a review team', or 'confirmed outcomes arrive later'. Say which source you would use, its bias, its delay, and how you would measure its quality — in that order." },
          { t: "note", variant: "key", html: "<strong>Name the label's source, its bias, its delay and its agreement rate before you name a model.</strong> Implicit labels measure behaviour, not value; delayed labels need a proxy; and an adjudicated gold set is the only thing that lets you tell a model improvement from label noise." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "weak-active-labeling",
        title: "Buying labels cheaply: weak supervision and active learning",
        summary: "Labelling functions, distant supervision, uncertainty and diversity sampling, budget arithmetic, and the human queue that keeps it all honest.",
        minutes: 10,
        tags: ["labels", "active-learning"],
        blocks: [
          { t: "p", html: "Hand labels are the most expensive input in most ML systems, and the budget is always smaller than the problem. Two families of technique stretch it: <strong>weak supervision</strong> produces many cheap, noisy labels from rules, and <strong>active learning</strong> spends expensive human labels only where they teach the model the most." },
          { t: "h", text: "The budget arithmetic first" },
          {
            t: "code", lang: "text", code:
              "target:           50,000 labelled tickets\n" +
              "annotators/item:  3 (majority vote, measure agreement)\n" +
              "time per label:   30 s     cost per label: $0.08 platform + time\n" +
              "\n" +
              "labels needed  = 50,000 * 3           = 150,000\n" +
              "annotator time = 150,000 * 30 s       = 1,250 hours\n" +
              "at 6 productive h/day, 10 annotators  = ~21 working days"
          },
          { t: "p", html: "Twenty working days for one dataset, before the first guideline revision. That number is the reason the rest of this lesson exists — and saying it out loud in an interview shows you know labelling is a schedule constraint, not a checkbox." },
          { t: "h", text: "Weak supervision with labelling functions" },
          { t: "p", html: "A <strong>labelling function</strong> is a small rule that votes on an example or abstains: a regex, a keyword list, a lookup against a known-bad list, an existing heuristic model. Each one is noisy and covers only part of the data. A label model then learns how accurate each function is from their agreements and conflicts, and outputs a probabilistic label per example." },
          {
            t: "code", lang: "python", code:
              "ABSTAIN, BILLING, OTHER = -1, 1, 0\n" +
              "\n" +
              "def lf_refund_words(t):\n" +
              "    return BILLING if any(w in t.text for w in (\"refund\", \"charged twice\")) else ABSTAIN\n" +
              "\n" +
              "def lf_invoice_link(t):\n" +
              "    return BILLING if t.has_invoice_attachment else ABSTAIN\n" +
              "\n" +
              "def lf_password_reset(t):\n" +
              "    return OTHER if \"reset my password\" in t.text else ABSTAIN\n" +
              "\n" +
              "# label model: weight each LF by its estimated accuracy, combine votes\n" +
              "# into P(BILLING | votes); train the end model on those soft labels"
          },
          {
            t: "ul", items: [
              "<strong>Coverage</strong> — share of examples where at least one function votes. Uncovered examples get no label.",
              "<strong>Conflict</strong> — how often functions disagree. Some conflict is what lets the label model estimate accuracies.",
              "<strong>Generalisation</strong> — the end model learns from features beyond the rules, so it labels examples no function covered. That is the payoff."
            ]
          },
          { t: "p", html: "<strong>Distant supervision</strong> is the same idea using an existing knowledge source: if a product catalogue says an item is a kitchen appliance, every listing that mentions it gets that label. It is cheap and wrong in predictable ways — a mention is not always the topic — so treat it as one more noisy vote." },
          { t: "note", variant: "warn", html: "<strong>Weak labels inherit the rules' blind spots.</strong> If every function keys on English keywords, the model is weak on everything else, and an evaluation set built from the same rules will not show it. Always measure against a hand-labelled gold set the rules never touched." },
          { t: "h", text: "Active learning: spend humans where the model is confused" },
          {
            t: "table",
            headers: ["Strategy", "Picks", "Risk"],
            rows: [
              ["Random", "Any unlabelled example", "Wastes labels on easy, redundant examples"],
              ["Uncertainty", "Smallest margin between top two classes, or probability nearest 0.5", "Batches collapse onto one confusing region; also chases pure label noise"],
              ["Diversity", "Examples spread across clusters of the embedding space", "Ignores what the model already knows"],
              ["Uncertainty + diversity", "Cluster the most uncertain pool, sample across clusters", "More moving parts; usually the right default"]
            ]
          },
          { t: "p", html: "Gains are real but modest and front-loaded: reaching a target accuracy with a fraction of the random-sampling labels is common in early rounds, and the advantage shrinks as the model matures. Keep a slice of every batch random, because actively-selected examples are a biased sample — you cannot evaluate on them." },
          { t: "h", text: "The human-in-the-loop queue" },
          {
            t: "ol", items: [
              "<strong>Route</strong> by model confidence: auto-accept above a high threshold, auto-reject below a low one, send the middle band to people.",
              "<strong>Prioritise</strong> the queue by expected value — reach of the item, severity of the policy, model uncertainty.",
              "<strong>Seed gold items</strong> into every reviewer's queue to measure quality continuously.",
              "<strong>Feed decisions back</strong> as labels, with the routing reason logged, so you know which labels came from a biased slice."
            ]
          },
          { t: "compare",
            bad: { title: "Labels as a one-off project", items: ["One big batch, then never again", "No agreement measurement", "Queue order is arrival time", "Reviewer decisions never reach training"] },
            good: { title: "Labels as a running system", items: ["Continuous batches chosen by the model", "Kappa and gold-set accuracy tracked per reviewer", "Queue ordered by expected value", "Every decision logged as a label with its routing reason"] }
          },
          { t: "cue", html: "Reach for this when the prompt says 'we have very few labels', 'reviewers are expensive', 'a new policy just launched', or 'millions of unlabelled examples'. Open with the budget arithmetic, then weak supervision to bootstrap, then active learning to refine." },
          { t: "note", variant: "key", html: "<strong>Labels are a budget: do the arithmetic, bootstrap with rules, refine with active learning, and measure everything against a gold set the rules never saw.</strong> Mix diversity into uncertainty sampling, and keep a random slice so you can still evaluate honestly." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "class-imbalance",
        title: "Class imbalance without breaking your probabilities",
        summary: "Base rates, negative downsampling and the correction it demands, class weights, focal loss, and evaluating on the distribution you will actually serve.",
        minutes: 10,
        tags: ["labels", "imbalance", "calibration"],
        blocks: [
          { t: "p", html: "Most interesting problems are imbalanced: clicks are a few percent of impressions, fraud a fraction of a percent of transactions, policy violations rarer still. Imbalance is not a bug to fix — it is a fact about the world. What you control is how you train on it and how honestly you measure the result." },
          { t: "stat", items: [
            { v: "~1–3%", k: "click-through on many feeds" },
            { v: "~0.1–0.5%", k: "card fraud rate, typical range" },
            { v: "99.8%", k: "accuracy of 'never fraud' at 0.2% base rate" }
          ] },
          { t: "h", text: "Downsampling negatives — and paying it back" },
          { t: "p", html: "With billions of impressions a day, keeping every negative is wasteful: most are easy and teach little. A common move is to keep all positives and a fraction <code class='tok'>w</code> of negatives. Training gets several times cheaper with little loss in ranking quality. But the model now sees a world where positives are far more common, so its outputs are inflated." },
          {
            t: "code", lang: "text", code:
              "keep all positives, keep fraction w of negatives\n" +
              "model trained on the sampled data outputs p'\n" +
              "\n" +
              "calibrated  p = p' / (p' + (1 - p') / w)\n" +
              "\n" +
              "w = 0.1, p' = 0.50  ->  p = 0.5 / (0.5 + 5.0)  = 0.091\n" +
              "w = 0.1, p' = 0.10  ->  p = 0.1 / (0.1 + 9.0)  = 0.011\n" +
              "w = 1.0             ->  p = p'  (no sampling, no correction)"
          },
          { t: "p", html: "The formula comes from odds: keeping a fraction <code class='tok'>w</code> of negatives multiplies the odds of a positive by <code class='tok'>1/w</code>, so you multiply the model's odds by <code class='tok'>w</code> to undo it. Ranking is unaffected — the correction is monotonic — which is why teams forget it until something consumes the probability directly." },
          { t: "note", variant: "trap", html: "<strong>Forgetting the correction is a pricing bug, not a modelling bug.</strong> An ad auction bids on expected value, so a click probability inflated tenfold bids tenfold too high. A fraud system that blocks above an expected-loss threshold blocks ten times too often. Apply the correction, then verify with a reliability plot — <a href='#/found/metrics/calibration'>calibration</a> covers how." },
          { t: "h", text: "The other levers" },
          {
            t: "table",
            headers: ["Technique", "What it does", "Cost"],
            rows: [
              ["Negative downsampling", "Drops most easy negatives", "Needs the correction above; can drop rare hard negatives"],
              ["Upsampling positives", "Repeats or synthesises positives", "Overfits to repeated rows; synthetic points can be unrealistic"],
              ["Class weights", "Multiplies the loss on the rare class", "Shifts probabilities upward, so recalibrate; noisy positives get amplified"],
              ["Focal loss", "Down-weights examples the model already gets right", "One more hyperparameter; mostly helps dense detection-style tasks"],
              ["Threshold choice", "Leaves training alone, picks the operating point", "Needs calibrated scores and a cost model"]
            ]
          },
          { t: "p", html: "<strong>Focal loss</strong> multiplies cross-entropy by <code class='tok'>(1 - p_t)^γ</code>, where <code class='tok'>p_t</code> is the predicted probability of the true class. With <code class='tok'>γ = 2</code>, an easy example the model gets right with 0.9 contributes 100 times less than with plain cross-entropy, so the gradient budget goes to the hard cases. It reshapes attention rather than the class ratio." },
          { t: "note", variant: "tip", html: "Often the strongest answer is to change nothing in training. Gradient-boosted trees and large neural nets handle a 1% positive rate fine on their own. Train on the natural distribution, choose the threshold from a cost model, and only reach for resampling when training cost or a very extreme ratio forces it." },
          { t: "h", text: "Evaluate on the true distribution" },
          { t: "p", html: "Whatever you do to the training data, the <em>test</em> set must keep the production base rate. Precision depends directly on prevalence: the same model has very different precision at 50% positives than at 0.2%. A balanced test set makes precision look wonderful and tells you nothing about the alert volume your reviewers will face." },
          {
            t: "code", lang: "text", code:
              "recall 0.80, false-positive rate 0.01, 1,000,000 transactions\n" +
              "\n" +
              "balanced test (50% fraud):  precision = 0.80 / (0.80 + 0.01) = 0.99\n" +
              "true mix (0.2% fraud):\n" +
              "  true positives  = 2,000 * 0.80   = 1,600\n" +
              "  false positives = 998,000 * 0.01 = 9,980\n" +
              "  precision       = 1,600 / 11,580 = 0.14"
          },
          { t: "compare",
            bad: { title: "Naive handling", items: ["Balance train and test to 50/50", "Report accuracy", "Use raw sampled-model scores as probabilities"] },
            good: { title: "Standout handling", items: ["Downsample train only, keep test at the real mix", "Report PR-AUC and precision at the operating recall", "Correct and verify calibration before any score is consumed"] }
          },
          { t: "cue", html: "Raise this the moment a base rate under a few percent appears in the prompt, or when a score feeds a bid, a price, or an expected-loss threshold. Say: 'I'd downsample negatives for training cost, correct the probabilities, and evaluate on the natural mix.' Then do the precision arithmetic out loud — <a href='#/found/metrics/roc-pr-curves'>PR curves</a> are the right picture here." },
          { t: "note", variant: "key", html: "<strong>Resample the training set if you must, never the test set, and always undo the resampling before a probability is used.</strong> The correction is p = p' / (p' + (1 − p') / w); precision only means something at the real base rate." },
          { t: "quiz", id: "data-labels" }
        ]
      }
    ]
  };

  /* ==================================================================
     4. Module: correctness
  ================================================================== */
  var MOD_CORRECTNESS = {
    id: "correctness",
    name: "Correctness",
    icon: "shield",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "leakage-taxonomy",
        title: "A field guide to leakage",
        summary: "Six ways information from the answer sneaks into the question, and the three heuristics that catch nearly all of them.",
        minutes: 11,
        tags: ["leakage", "correctness"],
        blocks: [
          { t: "p", html: "Leakage is any path by which training features carry information that will not exist, in that form, at the moment the model has to decide. The model finds that path before it finds anything else, because it is the easiest signal in the data. <a href='#/mlsd/concepts/feature-pitfalls'>The pitfalls overview</a> introduces it; this lesson is the detailed field guide." },
          { t: "p", html: "One test covers every case: <strong>could the serving path read exactly this value, at the decision instant, for an entity the model has never seen?</strong> If not, it leaks." },
          { t: "h", text: "The six species" },
          {
            t: "table",
            headers: ["Kind", "Mechanism", "Example"],
            rows: [
              ["Target leakage", "Feature is a consequence of the label", "<code class='tok'>cancellation_reason</code> in a churn model; <code class='tok'>collections_assigned</code> in a default model"],
              ["Temporal leakage", "Feature value read from after the decision", "Today's <code class='tok'>lifetime_orders</code> joined onto a row from last spring"],
              ["Duplicate contamination", "Same or near-same row in train and test", "Re-posted listings, re-applications, retried transactions"],
              ["Entity contamination", "Same user or item on both sides of a split", "Random row split over monthly snapshots of each user"],
              ["Preprocessing leakage", "Transform fitted on all data before splitting", "Scaler, imputer, vocabulary or target encoder fitted pre-split"],
              ["Leakage via ids and proxies", "A field encodes the label indirectly", "Sequential ids issued after manual review; a 'queue' field that only flagged items pass through"]
            ]
          },
          { t: "h2", text: "Proxies of the label" },
          { t: "p", html: "The hardest leaks to spot are features that are not the label but are produced by the same process. A medical model that learns from 'number of tests ordered' learns what the doctor already suspected. A fraud model with a feature from the manual-review tool learns which transactions reviewers looked at — which were the ones a previous model flagged. The feature is real, but it is downstream of a decision you are trying to replace." },
          { t: "h2", text: "Leakage through identifiers" },
          { t: "p", html: "Ids look harmless and are not. Auto-increment ids encode time, so a model can learn that high ids belong to a period with a different base rate. Ids assigned by a downstream system — a ticket number created only when a case is escalated — encode the escalation. And any raw entity id lets the model memorise per-entity outcomes, which is entity contamination in disguise." },
          { t: "widget", id: "dataLeakSpotter" },
          { t: "h", text: "Three heuristics that catch most leaks" },
          {
            t: "ol", items: [
              "<strong>Suspiciously high importance.</strong> One feature with several times the importance of the next, or a near-perfect metric on a hard problem. Drop the top feature and retrain; if the metric falls to something plausible, you found it.",
              "<strong>Offline/online gap.</strong> Offline AUC 0.95, online lift near zero. Compare feature distributions between training rows and logged serving requests — a leaking feature often has a different null rate or range online.",
              "<strong>Timestamp audit.</strong> For every feature, write down when its value becomes readable by serving and compare it to the decision instant. Tedious, mechanical and the only check that is exhaustive."
            ]
          },
          {
            t: "code", lang: "python", code:
              "# quick leak probe: train on each feature alone\n" +
              "for f in features:\n" +
              "    auc = fit_and_score(train[[f]], y_train, test[[f]], y_test)\n" +
              "    if auc > 0.90:\n" +
              "        flag(f, auc)   # a single feature this strong is a suspect, not a gift"
          },
          { t: "note", variant: "warn", html: "<strong>Leaks also appear after launch.</strong> An upstream team adds a field that gets populated by a later process, a new review tool writes back into a shared table, or a retention campaign starts targeting your model's high scorers. Re-run the timestamp audit whenever a feature's source table changes owner or schema." },
          { t: "compare",
            bad: { title: "Naive response to a great metric", items: ["Ship it — the model learned something", "Assume the online gap is noise", "Split randomly because it is the default"] },
            good: { title: "Standout response", items: ["Treat a near-perfect score as a bug report", "Probe the top features and audit timestamps", "Split by entity and time to match how the model will be used"] }
          },
          { t: "cue", html: "Raise leakage whenever a candidate feature comes from a table that is updated after the decision, from a review or escalation process, or from a system the model's output influences. Saying 'I'd audit when each feature becomes available relative to the decision timestamp' earns credit on its own." },
          { t: "note", variant: "key", html: "<strong>Every leak fails one test: serving could not read this value, at the decision instant, for an unseen entity.</strong> Catch them with an importance probe, the offline/online gap, and a per-feature timestamp audit — and treat any too-good metric as a bug report." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "point-in-time",
        title: "Point-in-time correctness and as-of joins",
        summary: "Event time versus processing time, availability timestamps, as-of joins in SQL, backfills, and label windows that line up with the decision.",
        minutes: 11,
        tags: ["leakage", "joins", "time"],
        blocks: [
          { t: "p", html: "Temporal leakage is the leak that does not look like one. <code class='tok'>orders_30d</code> is a perfectly reasonable feature; it only leaks when a historical training row is given the value from the wrong moment. Getting this right is mostly about keeping the right timestamps and writing one kind of join correctly." },
          { t: "h", text: "Four timestamps, not one" },
          {
            t: "table",
            headers: ["Timestamp", "Meaning", "Use it for"],
            rows: [
              ["Event time", "When the thing happened in the world", "Windowing aggregates (orders in the last 30 days)"],
              ["Processing time", "When the pipeline saw the event", "Debugging lag; never for windowing"],
              ["Availability time", "When the feature value became readable by serving", "The as-of join condition"],
              ["Decision time", "When the model was asked to predict", "The left side of every training row"]
            ]
          },
          { t: "p", html: "The common mistake is joining on the feature's <em>logical</em> date. A daily aggregate 'for 27 October' is computed by a job that finishes at 04:30 on the 28th and lands in the online store at 05:00. A request at 01:00 on the 28th could only see the 26 October value. Join on availability time, or on logical date plus a realistic lag, and training sees exactly what serving saw." },
          { t: "h", text: "The as-of join" },
          { t: "p", html: "For each event, find the most recent feature row for that entity whose availability time is at or before the decision time. In a warehouse that supports <code class='tok'>QUALIFY</code>:" },
          {
            t: "code", lang: "sql", code:
              "SELECT e.event_id,\n" +
              "       e.user_id,\n" +
              "       e.decision_ts,\n" +
              "       f.orders_30d,\n" +
              "       f.available_ts\n" +
              "FROM   training_events e\n" +
              "LEFT JOIN user_feature_history f\n" +
              "       ON f.user_id = e.user_id\n" +
              "      AND f.available_ts <= e.decision_ts\n" +
              "QUALIFY ROW_NUMBER() OVER (\n" +
              "          PARTITION BY e.event_id\n" +
              "          ORDER BY f.available_ts DESC) = 1;"
          },
          { t: "p", html: "In engines without <code class='tok'>QUALIFY</code>, a lateral subquery expresses the same thing and is often faster when the history table is indexed by entity and time:" },
          {
            t: "code", lang: "sql", code:
              "SELECT e.event_id, e.decision_ts, f.orders_30d\n" +
              "FROM   training_events e\n" +
              "LEFT JOIN LATERAL (\n" +
              "    SELECT h.orders_30d\n" +
              "    FROM   user_feature_history h\n" +
              "    WHERE  h.user_id = e.user_id\n" +
              "      AND  h.available_ts <= e.decision_ts\n" +
              "    ORDER BY h.available_ts DESC\n" +
              "    LIMIT 1\n" +
              ") f ON TRUE;"
          },
          { t: "note", variant: "trap", html: "<strong>The inequality is the whole point.</strong> Write <code class='tok'>f.available_ts &lt;= e.decision_ts</code>, never an equality on date and never a join against the current-state table. And add a TTL: a feature value last updated eight months ago is probably not what serving would use — the online store would have expired it and served a default, so training should too." },
          { t: "p", html: "This only works if the history table exists. Current-state tables that overwrite in place — a <code class='tok'>user_stats</code> row updated nightly — destroy the past. Keep an append-only, timestamped history of every feature, or snapshot daily; the storage is cheap compared with a model trained on the future. Cascade covers slowly-changing history tables and event-time windowing in depth at <a href='../data-eng-academy/index.html'>its pipelines track</a>, and Glacier walks through as-of joins and time-travel on a warehouse at <a href='../snowflake-academy/index.html'>its warehouse track</a>." },
          { t: "h", text: "Backfills" },
          { t: "p", html: "When you add a feature, you need its history to train on, so you backfill it. A backfill run today can see late-arriving events, refunds and corrections that the live pipeline never had at the time. Training then learns from a cleaner past than serving will ever see." },
          {
            t: "ul", items: [
              "Window on <strong>event time</strong> but filter inputs by what had <strong>arrived</strong> by the simulated availability time, when the raw log keeps arrival timestamps.",
              "If it does not, add the pipeline's typical lag to every backfilled availability time, and say the residual skew out loud.",
              "Validate the backfill: for the recent overlap period, the backfilled values should match what the live pipeline actually wrote."
            ]
          },
          { t: "h", text: "Label windows" },
          { t: "p", html: "The label needs the same discipline in the other direction. 'Churned within 30 days of the decision' means the label window starts at decision time and ends 30 days later — not at the end of the calendar month, and not 30 days from the last login. Rows whose window has not finished yet are excluded, not counted as negatives." },
          {
            t: "code", lang: "text", code:
              "      features <= decision_ts         label window\n" +
              "  ------------------------------|=============================|---->\n" +
              "                          decision_ts            decision_ts + 30d\n" +
              "\n" +
              "  nothing on the left may be read from after decision_ts\n" +
              "  nothing on the right may be used as a feature"
          },
          { t: "cue", html: "Bring this up as soon as you describe building a training set by joining events to features. The sentence that earns credit: 'Every training row is an as-of join on availability time, so it sees exactly what serving would have read, and rows with an unfinished label window are dropped.'" },
          { t: "note", variant: "key", html: "<strong>Join features on availability time with an inequality, keep append-only history so the past still exists, and align the label window to start at the decision.</strong> Backfills must reproduce the live pipeline's lag, or training learns from a tidier world than serving lives in." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "data-validation",
        title: "Data validation: contracts for training data",
        summary: "Schema, range, null, cardinality and distribution checks; where to put the gates; and when to quarantine rather than fail.",
        minutes: 9,
        tags: ["data-quality", "validation"],
        blocks: [
          { t: "p", html: "Most production model incidents are not modelling incidents. An upstream service ships a change, a column turns into nulls or switches units, and the model keeps returning well-formed predictions that are quietly wrong. Data validation turns 'quietly wrong' into an alert before training or serving consumes the data." },
          { t: "h", text: "What to check" },
          {
            t: "table",
            headers: ["Check", "Catches", "Example rule"],
            rows: [
              ["Schema", "Renamed, dropped or retyped columns", "<code class='tok'>amount</code> is a non-negative decimal; <code class='tok'>country</code> is a string"],
              ["Nulls", "Broken joins, upstream outages", "<code class='tok'>device_type</code> null rate below 2%"],
              ["Range", "Unit changes, sentinel values", "<code class='tok'>age</code> between 13 and 120; no <code class='tok'>-999</code>"],
              ["Cardinality", "New enum values, exploding ids", "<code class='tok'>plan_tier</code> has at most 6 distinct values"],
              ["Distribution", "Silent shifts, partial loads", "Mean of <code class='tok'>basket_value</code> within 3 standard deviations of the trailing 28 days"],
              ["Volume and freshness", "Missing partitions, stuck jobs", "Row count within ±30% of the same weekday last week; partition under 6 hours old"]
            ]
          },
          { t: "p", html: "Distribution checks compare today's batch with a reference — the training set, or a trailing window. Population stability index or a simple per-bucket share comparison is enough for most features; the threshold matters less than having one per feature and tuning it after a few weeks of false alarms." },
          { t: "h", text: "Expectations as a contract" },
          { t: "p", html: "Write the checks down next to the feature definition, owned by the same people, versioned with the same code. That turns implicit assumptions into a contract the producer can test against before shipping a change." },
          {
            t: "code", lang: "python", code:
              "EXPECTATIONS = {\n" +
              "    \"amount_usd\":   {\"type\": \"float\", \"min\": 0, \"max\": 50_000, \"max_null\": 0.001},\n" +
              "    \"country\":      {\"type\": \"str\", \"max_distinct\": 250, \"max_null\": 0.01},\n" +
              "    \"device_type\":  {\"allowed\": [\"ios\", \"android\", \"web\"], \"max_null\": 0.02},\n" +
              "    \"_batch\":       {\"min_rows_vs_last_week\": 0.7, \"max_age_hours\": 6},\n" +
              "}\n" +
              "\n" +
              "def validate(batch, expectations, reference):\n" +
              "    failures = [c for c in run_checks(batch, expectations, reference) if not c.ok]\n" +
              "    return Verdict(passed=not failures, failures=failures)"
          },
          { t: "h", text: "Where to put the gates" },
          {
            t: "table",
            headers: ["Gate", "Protects", "Typical action on failure"],
            rows: [
              ["Ingestion", "Everything downstream", "Quarantine the partition, alert the producer"],
              ["Pre-training", "The next model version", "Block the training run; keep the last good snapshot"],
              ["Pre-serving (online)", "Live predictions", "Fall back to a default or the last good value, raise an alert; never block requests"]
            ]
          },
          { t: "note", variant: "tip", html: "The online gate has a different job from the batch gates. A request cannot wait for a human, so validation at serving time clamps, substitutes a default, and counts — and the counter is what pages someone. Logging which features were substituted on each request also makes the <a href='#/ops/monitoring/drift-and-skew'>drift and skew</a> analysis possible later." },
          { t: "h", text: "Quarantine versus fail" },
          { t: "compare",
            bad: { title: "Fail hard", items: ["Pipeline stops on any violation", "Clear signal, no bad data trained on", "One noisy check halts every model downstream", "Teams learn to disable the check"] },
            good: { title: "Quarantine", items: ["Bad partition set aside, good data flows on", "Consumers keep using the last good snapshot", "Owner alerted with the failing rows attached", "Needs a release process to un-quarantine"] }
          },
          { t: "p", html: "A useful split: <strong>fail</strong> on schema violations and empty or missing partitions, which are unambiguous; <strong>quarantine</strong> on distribution and range violations, which are sometimes real changes in the world and need a person to decide. Either way, the decision and its reason are logged." },
          { t: "note", variant: "warn", html: "<strong>Alert fatigue kills validation.</strong> Fifty checks that each fire once a week produce seven alerts a day, and within a month nobody reads them. Start with null rate, row count and freshness on every feature — they catch most real incidents — and add distribution checks only for the features the model leans on most." },
          { t: "cue", html: "Mention validation whenever the design depends on data from another team, a third party, or a pipeline you do not own. 'I'd put contract checks at ingestion and before training, quarantine on distribution shifts, and clamp with a counter at serving time' is a complete answer in one breath." },
          { t: "note", variant: "key", html: "<strong>Treat training data as an interface with a written contract: schema, nulls, ranges, cardinality, distribution, volume and freshness.</strong> Gate at ingestion, before training and at serving; fail on unambiguous breaks, quarantine on shifts, and never block a live request." },
          { t: "quiz", id: "data-correctness" }
        ]
      }
    ]
  };

  /* ==================================================================
     5. Module: features
  ================================================================== */
  var MOD_FEATURES = {
    id: "features",
    name: "Features in production",
    icon: "blocks",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "feature-store-design",
        title: "Designing a feature store",
        summary: "Offline and online stores, materialisation, freshness SLAs and TTLs, point-in-time retrieval, streaming features, and when to skip the whole thing.",
        minutes: 11,
        tags: ["features", "infrastructure"],
        blocks: [
          { t: "p", html: "<a href='#/mlsd/concepts/feature-stores'>The feature-store overview</a> explains why the thing exists: one definition, two consistent read paths. This lesson is the design underneath — what you would actually build, the numbers you would commit to, and the parts that page people." },
          { t: "h", text: "The moving parts" },
          {
            t: "code", lang: "text", code:
              "   sources: event stream, warehouse tables, service DBs\n" +
              "                     |\n" +
              "          feature definitions (code, versioned)\n" +
              "                     |\n" +
              "        +------------+-------------+\n" +
              "        v                          v\n" +
              "  batch materialiser        stream materialiser\n" +
              "        |                          |\n" +
              "        v                          v\n" +
              "  OFFLINE STORE  <--- log --- ONLINE STORE\n" +
              "  columnar, full history      key-value, latest value\n" +
              "  as-of retrieval API         get(entity_ids, features) in ms"
          },
          {
            t: "table",
            headers: ["Component", "Typical technology shape", "Number to commit to"],
            rows: [
              ["Offline store", "Columnar files or warehouse tables, partitioned by date", "Retention long enough for the longest training window"],
              ["Online store", "Low-latency key-value store keyed by entity id", "p99 read latency in single-digit milliseconds for a batch of keys"],
              ["Batch materialiser", "Scheduled jobs writing both stores", "Freshness SLA, e.g. 'yesterday's value by 06:00'"],
              ["Stream materialiser", "Stream processor updating windowed aggregates", "Freshness SLA in seconds to minutes"],
              ["Registry", "Definitions, owners, versions, lineage", "Every feature has an owner and a deprecation path"]
            ]
          },
          { t: "h", text: "Materialisation, freshness and TTL" },
          { t: "p", html: "Each feature carries two promises. <strong>Freshness</strong> is how stale the online value may be — a 30-day purchase count can be a day old; 'transactions in the last 10 minutes' for fraud cannot. <strong>TTL</strong> is how long a value is served before it is treated as missing; without one, a user who went dormant a year ago is scored with their year-old activity as if it were current." },
          { t: "note", variant: "trap", html: "<strong>TTL must apply in training too.</strong> If the online store expires values after 7 days and serves a default, the as-of join must do the same: a feature row older than 7 days at decision time becomes the default. Otherwise training sees values that serving would never return — a form of skew that is invisible in every dashboard." },
          { t: "h", text: "The retrieval APIs" },
          {
            t: "code", lang: "python", code:
              "# training: point-in-time retrieval against the offline store\n" +
              "rows = store.get_historical(\n" +
              "    entity_df=events[[\"user_id\", \"decision_ts\"]],\n" +
              "    features=[\"user:orders_30d\", \"user:avg_basket_90d\", \"merchant:chargeback_rate_90d\"],\n" +
              ")  # as-of join on availability time, TTL applied\n" +
              "\n" +
              "# serving: latest values from the online store\n" +
              "vec = store.get_online(\n" +
              "    entity_ids={\"user_id\": uid, \"merchant_id\": mid},\n" +
              "    features=[\"user:orders_30d\", \"user:avg_basket_90d\", \"merchant:chargeback_rate_90d\"],\n" +
              ")"
          },
          { t: "p", html: "The same feature names, the same definitions, two read paths. That symmetry is the product. A third path worth adding: <strong>log the online feature vector with each prediction</strong>. Training on logged serving features removes skew by construction for any feature you can wait to accumulate, and it is the cleanest dataset for skew detection." },
          { t: "h", text: "Streaming features" },
          { t: "p", html: "Some signals lose their value in minutes: card velocity, session intent, a sudden burst of reports on a post. These need a stream materialiser that maintains windowed aggregates on event time and writes to the online store continuously, with the same aggregates logged to the offline store so training sees them." },
          {
            t: "ul", items: [
              "<strong>Cost:</strong> a stream job per feature family, state that must be checkpointed, and late events that must be handled with a watermark.",
              "<strong>Skew risk:</strong> the batch backfill and the stream must compute the same aggregate; test them against each other on overlapping days.",
              "<strong>Default to batch</strong> and promote a feature to streaming only when you can show the freshness buys lift."
            ]
          },
          { t: "h", text: "When you do not need one" },
          { t: "compare",
            bad: { title: "Skip it", items: ["One or two models, one team", "Batch scoring from the same pipeline that trains", "Features are simple columns from one table", "No request-time scoring"] },
            good: { title: "Build or adopt it", items: ["Many models sharing entity-level aggregates", "Request-time scoring with a latency budget", "Freshness requirements in minutes", "Teams repeatedly reimplementing the same features"] }
          },
          { t: "note", variant: "tip", html: "A shared feature library plus a disciplined pair of jobs — one writing history, one writing a key-value table — gets you most of the benefit for a small team. Say that it is a build-versus-adopt decision and name the trigger that would change it, such as 'the third model that needs these features'." },
          { t: "cue", html: "Raise feature-store design when the prompt has request-time scoring, features shared across models, or freshness measured in minutes. Commit to a freshness SLA and a TTL per feature family — that specificity is what separates a design from a diagram." },
          { t: "note", variant: "key", html: "<strong>A feature store is two stores, two materialisers, one set of definitions and an as-of retrieval API — with freshness and TTL promised per feature and applied identically in training and serving.</strong> Default to batch, promote to streaming when freshness pays, and skip the product entirely when only one read path exists." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "encoding-transforms",
        title: "Encodings and transforms that survive production",
        summary: "Scaling, logs and buckets; one-hot, hashing, target encoding and embeddings for categoricals; high-cardinality ids, text basics, missing values and crosses.",
        minutes: 10,
        tags: ["features", "encoding"],
        blocks: [
          { t: "p", html: "An encoding is a contract between raw data and the model. In a notebook it only has to work once; in production it has to work for values it has never seen, at serving latency, computed identically in two places. <a href='#/mlsd/concepts/feature-engineering'>Feature engineering</a> covers what signals to build; this lesson covers how to represent them." },
          { t: "h", text: "Numeric features" },
          {
            t: "table",
            headers: ["Transform", "Use when", "Watch out for"],
            rows: [
              ["Standardise (z-score)", "Roughly symmetric values, linear or neural models", "Fit mean and variance on training data only"],
              ["Log (log1p)", "Heavy right tail: counts, prices, durations", "Negative values; pick an offset deliberately"],
              ["Clip", "Rare extreme values dominate the gradient", "Clip bounds are part of the model version"],
              ["Bucketise", "Non-linear effect, or a linear model needs thresholds", "Boundaries chosen on training data; too many buckets overfit"],
              ["Leave raw", "Tree models", "Trees are invariant to monotonic transforms — scaling buys nothing"]
            ]
          },
          { t: "h", text: "Categorical features: four options" },
          {
            t: "table",
            headers: ["Encoding", "Good for", "Cost"],
            rows: [
              ["One-hot", "Low cardinality (tens of values)", "Width grows with cardinality; unseen values need an 'other' slot"],
              ["Hashing", "High or unbounded cardinality; no vocabulary to maintain", "Collisions; uninterpretable buckets"],
              ["Target encoding", "High cardinality where the category's base rate is the signal", "Leaks unless computed out-of-fold or from strictly earlier data"],
              ["Learned embedding", "Very high cardinality with enough data per value", "Needs a neural model; cold values get an untrained vector"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Target encoding is a leakage machine if done naively.</strong> Encoding a merchant by its mean fraud rate over the whole dataset puts each row's own label into its feature — catastrophically for merchants with a handful of rows. Compute it out-of-fold, or from data strictly before each row, and smooth toward the global mean: <code class='tok'>(n * mean_cat + m * mean_global) / (n + m)</code> with <code class='tok'>m</code> around 10–100." },
          { t: "h", text: "High-cardinality ids" },
          { t: "p", html: "User, item, merchant and device ids number in the millions. Feeding them raw lets the model memorise per-id outcomes — useful for frequent ids, useless for new ones, and a contamination risk when splits share ids. The usual pattern is to replace the id with <em>aggregates about it</em> (merchant chargeback rate, item click-through) plus, in neural models, a learned or hashed embedding with a shared fallback vector for rare and unseen ids." },
          {
            t: "code", lang: "python", code:
              "def merchant_features(mid, as_of):\n" +
              "    s = history.stats(mid, until=as_of)          # point-in-time\n" +
              "    n = s.txn_count_90d\n" +
              "    smoothed = (s.fraud_count_90d + 20 * GLOBAL_RATE) / (n + 20)\n" +
              "    return {\n" +
              "        \"merchant_txn_90d_log\": log1p(n),\n" +
              "        \"merchant_fraud_rate_smoothed\": smoothed,\n" +
              "        \"merchant_is_new\": n < 10,\n" +
              "    }"
          },
          { t: "h", text: "Text, missing values and crosses" },
          {
            t: "ul", items: [
              "<strong>Text basics.</strong> TF-IDF over word or character n-grams with a linear model is a strong, cheap baseline for classification. Pretrained text embeddings usually beat it; Lumen covers text models in depth at <a href='../llm-academy/index.html'>its LLM track</a>.",
              "<strong>Missing values.</strong> Missingness is often informative — no phone number on an account means something. Impute a neutral value <em>and</em> add an is-missing indicator, and make sure serving produces the same default for the same reason.",
              "<strong>Crosses.</strong> A user-country × item-language feature lets a linear model learn interactions directly. Trees and neural nets learn many crosses themselves, but explicit crosses of a few strong pairs still help, and they are cheap to hash."
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Every fitted transform is model state.</strong> Means, clip bounds, bucket edges, vocabularies and target-encoding tables must be versioned and shipped with the model, not recomputed at serving time from whatever data is around. A vocabulary rebuilt on today's data silently reassigns indices and scrambles every embedding lookup." },
          { t: "compare",
            bad: { title: "Naive encoding plan", items: ["One-hot everything, including user ids", "Fill nulls with zero", "Target-encode on the full dataset", "Refit scalers at serving time"] },
            good: { title: "Standout encoding plan", items: ["Aggregates plus a hashed or learned embedding for ids", "Neutral fill plus a missing indicator", "Out-of-fold, smoothed target encoding", "Every fitted parameter versioned with the model"] }
          },
          { t: "cue", html: "When you list features in an interview, say the encoding next to each one in a word: 'log-scaled', 'bucketised', 'hashed', 'smoothed target encoding, out-of-fold'. It takes no extra time and signals you have run these in production." },
          { t: "note", variant: "key", html: "<strong>Pick encodings that survive unseen values and two implementations: log and clip heavy tails, hash or embed high-cardinality ids, target-encode only out-of-fold with smoothing, and keep a missing indicator.</strong> Every fitted parameter is model state and ships with the model." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "embeddings-as-features",
        title: "Embeddings as features: versioning, staleness and cost",
        summary: "Pretrained versus in-task embeddings, the re-index problem, refresh cadence and compatibility, and the storage arithmetic that decides quantisation.",
        minutes: 10,
        tags: ["features", "embeddings"],
        blocks: [
          { t: "p", html: "An embedding is a dense vector that places an entity — a user, an item, a query, a piece of text — in a space where distance means similarity. <a href='#/mlsd/concepts/embeddings'>The embeddings lesson</a> covers how they are learned. Here the question is operational: once a vector becomes an input to other models and indexes, it becomes a dependency with versions, a refresh schedule and a storage bill." },
          { t: "h", text: "Pretrained or trained in-task" },
          {
            t: "compare",
            bad: { title: "Pretrained, frozen", items: ["Available on day one, no labels needed", "Captures general similarity, not your objective", "Upgrades are someone else's schedule", "Good default for text and images, cold-start items"] },
            good: { title: "Trained in-task", items: ["Learned from your interactions or labels", "Encodes exactly what your objective rewards", "Needs data per entity; cold entities are weak", "You own the retraining and the versioning"] }
          },
          { t: "p", html: "Many systems use both: a pretrained content embedding available the moment an item is created, and an in-task collaborative embedding that takes over once the item has interactions. The ranker takes both as features and learns how much to trust each by item age." },
          { t: "h", text: "Versioning and the re-index problem" },
          { t: "p", html: "Two training runs of the same embedding model produce two incompatible spaces: the axes are arbitrary, so a v2 query vector compared with v1 item vectors returns noise. Every consumer — a nearest-neighbour index, a downstream ranker that takes the vector as input, a cache of user vectors — is tied to one version." },
          {
            t: "ol", items: [
              "Train embedding model v2; embed the whole catalogue with it.",
              "Build a new index from the v2 item vectors alongside the live v1 index.",
              "Retrain or at least re-validate downstream models that consume the vectors as features.",
              "Cut over queries and items together, behind a flag, with v1 kept warm for rollback.",
              "Retire v1 only after the online metrics hold."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Mixed-version vectors fail silently.</strong> If new items are embedded with v2 while the index and query encoder are still v1, those items are scattered at random in the space: they never get retrieved, and nothing errors. Store the model version with every vector and reject mismatches at read time." },
          { t: "h", text: "Refresh cadence and staleness" },
          {
            t: "table",
            headers: ["What refreshes", "Typical cadence", "Staleness symptom"],
            rows: [
              ["Embedding model weights", "Weekly to quarterly", "Drift: new vocabulary, new item types map poorly"],
              ["Item vectors (same model)", "On create or update", "New items invisible to retrieval until embedded"],
              ["User vectors", "Daily, or computed at request time from recent history", "Recommendations lag what the user just did"],
              ["Downstream models", "Whenever the embedding model version changes", "Feature distribution shift on the upgrade day"]
            ]
          },
          { t: "p", html: "Separate the two clocks. Re-embedding items with the <em>same</em> model is cheap and keeps the space stable. Changing the <em>model</em> forces the full re-index above. Most teams refresh vectors continuously and the model rarely, and they gate each model upgrade like a release — <a href='#/ops/delivery/model-registry'>the model registry</a> is where those versions and their compatible consumers are tracked." },
          { t: "h", text: "The storage arithmetic" },
          {
            t: "code", lang: "text", code:
              "100,000,000 items x 256 dims x 4 bytes (float32)\n" +
              "  = 102,400,000,000 bytes  ~= 100 GB    raw, before index overhead\n" +
              "\n" +
              "float16           2 bytes/dim  -> ~51 GB\n" +
              "int8 scalar quant 1 byte/dim   -> ~26 GB\n" +
              "product quant     32 bytes/vec -> ~3.2 GB\n" +
              "\n" +
              "x 2 during a re-index (v1 and v2 live together)"
          },
          { t: "p", html: "Quantisation trades recall for memory. Int8 usually loses little; aggressive product quantisation loses more, which is why retrieval often searches compressed vectors and re-scores the top few hundred with full-precision ones. Remember the doubling during a migration — that is the moment the cluster runs out of memory. <a href='#/rank/retrieval/ann-indexes'>Approximate nearest-neighbour indexes</a> cover the recall side of this trade." },
          { t: "note", variant: "tip", html: "Dimension is a cost lever too. Halving from 256 to 128 dimensions halves storage and search cost, and for many catalogues the quality loss is small. Measure retrieval recall at both sizes before defaulting to the larger one." },
          { t: "cue", html: "Raise this whenever an embedding feeds more than one consumer, or the prompt mentions millions of items and retrieval. The two sentences that earn credit: 'Every vector carries its model version, and an embedding upgrade is a coordinated re-index' and '100 million by 256 floats is about 100 GB, so I'd quantise to int8 and re-score with full precision.'" },
          { t: "note", variant: "key", html: "<strong>An embedding is a versioned dependency: vectors from different model versions are incompatible, so an upgrade means re-embedding, re-indexing and revalidating consumers together.</strong> Refresh vectors often and the model rarely, store the version with every vector, and do the storage arithmetic — 100M × 256 float32 ≈ 100 GB — before choosing a quantisation." },
          { t: "quiz", id: "data-features" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.data = {
    id: "data",
    name: "Data & Features",
    short: "Data",
    tagline: "Most model bugs are data bugs",
    color: "#34d399",
    blurb: "The part of ML systems where most production failures actually start. Labels first — where they come from, how they are biased and delayed, how to buy them cheaply with weak supervision and active learning, and how to train on rare classes without wrecking your probabilities. Then correctness: a field guide to leakage with a hands-on audit, point-in-time as-of joins written out in SQL, and validation gates that keep broken upstream data out of training and serving. Closes with features in production — feature-store design with freshness and TTL commitments, encodings that survive unseen values, and embeddings treated as the versioned, expensive dependencies they are.",
    modules: [MOD_LABELS, MOD_CORRECTNESS, MOD_FEATURES]
  };
})();
