/* =====================================================================
   SYNAPSE · MLOps
   window.TRACKS.ops — modules: delivery / inference / monitoring

   Classical ML operations: registries, CI/CD for models, packaging,
   inference modes, safe rollouts, serving performance, drift and the
   incident playbook. LLMOps lives in Lumen; general SRE in Beacon;
   data pipelines in Cascade.

   Self-contained: registers its own widget, quizzes and track data.
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
     1. opsDrift — "Is this drift?"
     Deterministic: the current window is a pure function of
     (scenario, magnitude). Illustrative feature: order value.
  ================================================================== */
  var DRIFT_BINS = ["$0-10", "$10-20", "$20-30", "$30-40", "$40-50", "$50-60", "$60-70", "$70-80", "$80-90", "$90+"];
  var DRIFT_REF = [4, 7, 11, 14, 16, 15, 12, 9, 7, 5];
  /* zero-sum wobble used for the stable scenario */
  var DRIFT_NOISE = [0.4, -0.3, 0.5, -0.6, 0.2, 0.3, -0.4, 0.1, -0.2, 0];
  /* the order-value profile of a newly acquired, low-spend cohort */
  var DRIFT_SEG = [18, 22, 20, 14, 10, 7, 4, 3, 1, 1];

  var DRIFT_ACTIONS = {
    stable: "No action. Record this PSI as the noise floor for the feature, so the alert threshold sits above ordinary week-to-week wobble instead of on top of it.",
    season: "Check the calendar before the pager: compare against the same window last year and look at fast proxy labels by slice. If quality holds, annotate and widen the reference; if it does not, schedule a retrain on a window that includes the season.",
    bug: "Treat it as a pipeline incident, not a model problem. Mass piling into the lowest bin at a deploy boundary is the signature of nulls coerced to zero: check the null rate and the upstream change log, impute or kill the feature, and block retraining until the data is fixed.",
    "new": "Slice by acquisition cohort before touching the model. If the new segment is served badly, route it to a fallback or a segment-aware threshold now, and fold it into training once its labels mature."
  };

  function driftNormalize(arr) {
    var s = 0, i, out = [];
    for (i = 0; i < arr.length; i++) s += arr[i];
    if (!(s > 0)) s = 1;
    for (i = 0; i < arr.length; i++) out.push(arr[i] * 100 / s);
    return out;
  }

  function driftCurrent(scn, m) {
    var cur = [], i, f, w, sh;
    if (scn === "stable") {
      for (i = 0; i < DRIFT_REF.length; i++) cur.push(DRIFT_REF[i] + DRIFT_NOISE[i] * (1 + 3 * m));
    } else if (scn === "season") {
      /* mass slides two bins up the value axis, the top bin absorbs the overflow */
      sh = [1, 1];
      for (i = 0; i < 8; i++) sh.push(DRIFT_REF[i]);
      sh[9] += DRIFT_REF[8] + DRIFT_REF[9];
      for (i = 0; i < DRIFT_REF.length; i++) cur.push((1 - m) * DRIFT_REF[i] + m * sh[i]);
    } else if (scn === "bug") {
      f = 0.4 * m;
      for (i = 0; i < DRIFT_REF.length; i++) cur.push(DRIFT_REF[i] * (1 - f));
      cur[0] += 100 * f;
    } else {
      w = 0.6 * m;
      for (i = 0; i < DRIFT_REF.length; i++) cur.push((1 - w) * DRIFT_REF[i] + w * DRIFT_SEG[i]);
    }
    return driftNormalize(cur);
  }

  function driftPsi(ref, cur) {
    var parts = [], total = 0, i, e, a, p;
    for (i = 0; i < ref.length; i++) {
      e = Math.max(ref[i] / 100, 0.0001);
      a = Math.max(cur[i] / 100, 0.0001);
      p = (a - e) * Math.log(a / e);
      if (!isFinite(p)) p = 0;
      parts.push(p);
      total += p;
    }
    return { parts: parts, total: total };
  }

  function driftBand(psi) {
    if (psi < 0.1) return "none";
    if (psi <= 0.25) return "moderate";
    return "major";
  }

  Widgets.opsDrift = function (mount) {
    shell(mount, "drift lab", "Is this drift?",
      "Reference histogram of order value from the training window against this week's window. Pick what happened upstream and how hard it hit; PSI is computed per bin and summed. Illustrative numbers, real arithmetic.");

    var scn = "stable";
    var mag = 50;

    var magOut = h("b", {}, "50");
    var slider = h("input", { type: "range", min: "0", max: "100", step: "5", value: "50", "aria-label": "Shift magnitude" });
    slider.addEventListener("input", function () {
      var v = parseInt(slider.value, 10);
      mag = isFinite(v) ? v : 0;
      paint();
    });

    var legend = h("div", { style: "display:flex;gap:18px;flex-wrap:wrap;font-size:0.8rem;padding:4px 0 8px" },
      h("span", { style: "display:inline-flex;align-items:center;gap:6px;color:var(--text)" },
        h("i", { style: "display:inline-block;width:14px;height:8px;border-radius:3px;background:var(--text-dim)" }), "reference (training)"),
      h("span", { style: "display:inline-flex;align-items:center;gap:6px;color:var(--text)" },
        h("i", { style: "display:inline-block;width:14px;height:8px;border-radius:3px;background:var(--accent)" }), "current window"));

    var bands = h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;padding:10px 0 4px" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function bandChip(label, active) {
      return h("span", {
        style: "font-family:var(--font-mono);font-size:0.76rem;padding:4px 10px;border-radius:999px;border:1px " +
          (active ? "solid var(--accent);color:var(--accent-ink)" : "dashed var(--line-strong);color:var(--text-dim)")
      }, label);
    }

    function paint() {
      var m = mag / 100;
      var cur = driftCurrent(scn, m);
      var res = driftPsi(DRIFT_REF, cur);
      var band = driftBand(res.total);
      var max = 1, top = 0, i;
      for (i = 0; i < DRIFT_REF.length; i++) {
        if (DRIFT_REF[i] > max) max = DRIFT_REF[i];
        if (cur[i] > max) max = cur[i];
        if (res.parts[i] > res.parts[top]) top = i;
      }
      magOut.textContent = String(mag);

      clear(stage);
      stage.appendChild(legend);
      for (i = 0; i < DRIFT_REF.length; i++) {
        var isTop = i === top && res.total >= 0.1;
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:62px minmax(80px,2fr) 118px 62px;gap:10px;align-items:center;padding:4px 0 4px 8px;border-left:3px " +
            (isTop ? "solid var(--accent)" : "solid transparent")
        },
          h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text)" }, DRIFT_BINS[i]),
          h("span", { style: "display:flex;flex-direction:column;gap:3px" },
            h("span", { style: "display:block;background:var(--surface-solid);border-radius:4px;overflow:hidden" },
              h("i", { style: "display:block;height:7px;border-radius:4px;background:var(--text-dim);width:" + Math.round(DRIFT_REF[i] / max * 100) + "%" })),
            h("span", { style: "display:block;background:var(--surface-solid);border-radius:4px;overflow:hidden" },
              h("i", { style: "display:block;height:7px;border-radius:4px;background:var(--accent);width:" + Math.round(cur[i] / max * 100) + "%" }))),
          h("span", { style: "font-family:var(--font-mono);font-size:0.74rem;color:var(--text-dim)" },
            DRIFT_REF[i].toFixed(1) + "% → " + cur[i].toFixed(1) + "%"),
          h("span", {
            style: "font-family:var(--font-mono);font-size:0.74rem;text-align:right;color:" + (isTop ? "var(--accent-ink)" : "var(--text)")
          }, res.parts[i].toFixed(3))
        ));
      }

      clear(bands);
      bands.appendChild(bandChip("none < 0.10", band === "none"));
      bands.appendChild(bandChip("moderate 0.10-0.25", band === "moderate"));
      bands.appendChild(bandChip("major > 0.25", band === "major"));

      clear(readout);
      readout.appendChild(ro("PSI", res.total.toFixed(3)));
      readout.appendChild(ro("band", band));
      readout.appendChild(ro("largest bin", DRIFT_BINS[top] + " (" + res.parts[top].toFixed(3) + ")"));
      readout.appendChild(ro("magnitude", mag + "/100"));
      var action = DRIFT_ACTIONS[scn] || DRIFT_ACTIONS.stable;
      if (scn !== "stable" && band === "none") {
        action = "Below the alarm line at this magnitude, so nothing pages. Keep the trend on the dashboard: slow drift that never crosses 0.1 in one window can still cross it over a quarter. If it grows: " + action;
      }
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, "First action — " + action));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["stable", "Stable week"], ["season", "Seasonal shift"], ["bug", "Upstream bug (nulls → 0)"], ["new", "New user segment"]], 0,
        function (v) { scn = v; paint(); }),
      h("label", { class: "w-field" }, "Shift magnitude ", slider, " ", magOut)
    ));
    mount.appendChild(stage);
    mount.appendChild(bands);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     2. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ops-delivery": {
      title: "Shipping models checkpoint",
      sub: "Registries, CI/CD gates for models, and packaging that does not drift from training.",
      questions: [
        {
          q: "A bad model reached production an hour ago. Serving resolves the model through a registry alias. What is the fastest correct rollback?",
          options: [
            "Retrain the previous model from its archived training data and redeploy it",
            "Rebuild the serving container from the previous release branch",
            "Move the production alias back to the previous registered version",
            "Patch the model weights in place on each serving host"
          ],
          answer: 2,
          explain: "When serving looks up 'whatever version the production alias points at', rollback is a metadata change measured in seconds. The previous version is still stored, immutable and already validated. Retraining or rebuilding reintroduces risk and takes hours at exactly the moment you need minutes."
        },
        {
          q: "Which piece of registry metadata matters most because it cannot be reconstructed after the fact?",
          options: [
            "An identifier or hash of the exact training data snapshot",
            "The serving fleet's CPU utilisation on the day the model was released",
            "A screenshot of the training loss curve",
            "The number of people who reviewed the pull request"
          ],
          answer: 0,
          explain: "Code lives in version control and can be checked out again, but source tables are overwritten, backfilled and compacted. Without a pinned snapshot id you cannot reproduce the model, debug a leak, or answer which data an audited prediction was based on. Loss curves are nice to have; data lineage is the one you cannot fake later."
        },
        {
          q: "Why should a CI quality gate use a tolerance and slice-level checks instead of 'candidate must beat production on overall AUC'?",
          options: [
            "Because AUC cannot be computed on a held-out evaluation set",
            "Because slice-level metrics are always higher than the aggregate metric on held-out data",
            "Because tolerances let the training pipeline finish faster",
            "Seed noise makes strict gates flaky, and averages can hide a slice regression"
          ],
          answer: 3,
          explain: "Two retrains on the same data differ by a few thousandths of AUC from seeds alone, so a strict 'must beat' gate fails randomly and teaches people to override it. A tolerance absorbs that noise, and slice gates catch the case where the average improves while a locale or device class quietly gets worse."
        },
        {
          q: "An upstream team changes a duration feature from seconds to milliseconds. Which test should catch it first?",
          options: [
            "A training smoke test that runs the full pipeline for one epoch on a tiny sample",
            "A data validation test asserting the feature's expected value range",
            "A latency budget test on the serving container",
            "An invariance test that perturbs the user's display name"
          ],
          answer: 1,
          explain: "A thousand-fold unit change is a range violation, and a range assertion on the feature catches it before any model is trained on it. The smoke test will happily train on wrong units, the latency test does not look at values, and invariance tests probe model behaviour rather than input sanity."
        },
        {
          q: "Why bundle preprocessing into the model artifact rather than reimplementing it in the serving service?",
          options: [
            "Bundling always makes the artifact smaller on disk",
            "Two copies of one transform drift apart and cause training-serving skew",
            "Serving services are not allowed to perform arithmetic on raw feature values",
            "Model registries refuse artifacts that do not include preprocessing"
          ],
          answer: 1,
          explain: "When training uses one implementation of tokenization or scaling and serving uses a rewrite, small differences — a default value, a rounding rule, a vocabulary version — become silent skew. Shipping the transform with the model means the exact code that produced training features also produces serving features."
        },
        {
          q: "A teammate offers a pickled model file from an unknown source to save a week of training. What is the main risk of loading it?",
          options: [
            "It will load more slowly than a framework checkpoint",
            "Its predicted probabilities will be poorly calibrated for your traffic",
            "It will only run on GPU-equipped hosts",
            "Unpickling can execute arbitrary code embedded in the file"
          ],
          answer: 3,
          explain: "Language-native object serialization reconstructs objects by running code, so a crafted file can execute anything with the permissions of the process that loads it. Only load such artifacts from a trusted, access-controlled registry, and prefer weight-only or graph-interchange formats for anything crossing a trust boundary."
        }
      ]
    },

    "ops-inference": {
      title: "Inference patterns checkpoint",
      sub: "Choosing the inference mode, rolling out safely, and the latency and cost arithmetic of serving.",
      questions: [
        {
          q: "You need a score for each of 5 million products once per day, and every input is final at midnight. Which inference mode fits?",
          options: [
            "Batch precompute overnight and serve the scores from a key-value lookup",
            "Online request/response inference with GPU autoscaling",
            "Streaming inference triggered by every page-view event",
            "Online inference with a short-lived prediction cache in front of the model"
          ],
          answer: 0,
          explain: "The inputs are enumerable and exist before any request, and a day of staleness is acceptable by the requirement. That is the textbook case for batch: compute once, serve with a lookup that costs a millisecond. Online inference would recompute the same answer thousands of times a day for no gain in freshness."
        },
        {
          q: "What can a shadow deployment NOT tell you about a challenger model?",
          options: [
            "Whether it meets the latency budget under real production traffic",
            "How often its predictions disagree with the champion's",
            "Whether it throws errors on real-world inputs",
            "How users would respond to the challenger's outputs"
          ],
          answer: 3,
          explain: "In shadow mode the challenger sees real requests but its outputs are discarded, so no user ever reacts to them. You learn latency, errors, and the prediction distribution and its disagreement with the champion — but clicks, conversions and feedback-loop effects require users to actually see the output, which is what a canary or A/B test is for."
        },
        {
          q: "A canary at 5% shows conversion 0.3% below control after two hours, well inside the noise. What is the best next step?",
          options: [
            "Promote to 100%, because the difference is not statistically significant",
            "Roll back immediately and abandon the model",
            "Hold at 5% until the pre-agreed bake time or sample size is reached",
            "Jump straight to 50% to reach significance faster"
          ],
          answer: 2,
          explain: "Not significant after two hours means not yet measured, not 'no effect'. Promotion criteria should be fixed before the rollout — a minimum bake time and sample size — and honoured. Jumping to 50% multiplies the blast radius if the regression is real, and rolling back on noise trains the team to ignore canaries."
        },
        {
          q: "Turning on dynamic batching with a 10 ms maximum wait on a GPU model server mainly trades what for what?",
          options: [
            "Model accuracy in exchange for higher throughput",
            "Up to 10 ms of extra per-request latency in exchange for more throughput per GPU",
            "Host memory in exchange for lower disk usage",
            "Cache hit rate in exchange for fresher features"
          ],
          answer: 1,
          explain: "The server holds requests for up to the wait window so it can run them as one batch, which uses the accelerator far more efficiently. Each request can therefore wait up to the window before compute starts. Predictions are identical; the cost is paid in latency, so the window has to fit inside the p99 budget."
        },
        {
          q: "A model service has p50 latency of 30 ms and p99 of 400 ms. What is the most likely first suspect?",
          options: [
            "A slow tail in a dependency — feature-store misses, retries or pauses",
            "The model is simply too large, on average, for the hardware it is running on",
            "The p50 measurement is wrong and should be ignored",
            "Serializing the response payload on every request"
          ],
          answer: 0,
          explain: "If the average request is fast, the model's typical compute is fine — a 13x gap between median and tail points at something that only happens sometimes. Cache misses that fall through to a slow store, retries with backoff, garbage-collection pauses and queueing during bursts are the usual culprits, and the feature fetch is the most common place they live."
        },
        {
          q: "A GPU instance costs $3.00 per hour and can serve 500 predictions per second, but averages 50% utilization. Roughly what does 1,000 predictions cost?",
          options: [
            "About $0.0017",
            "About $0.006",
            "About $0.0033",
            "About $0.033"
          ],
          answer: 2,
          explain: "Effective throughput is 500 × 0.5 = 250 per second, or 900,000 per hour — 900 lots of 1,000. $3.00 / 900 ≈ $0.0033 per 1,000. The $0.0017 answer assumes full utilization, which is the most common error in serving cost estimates — you pay for idle capacity too."
        }
      ]
    },

    "ops-monitoring": {
      title: "Monitoring and response checkpoint",
      sub: "Drift taxonomy, PSI and friends, retraining triggers, and running a model incident.",
      questions: [
        {
          q: "The PSI between the training window and this week for one feature is 0.31. What does the common rule of thumb say?",
          options: [
            "No meaningful shift — ordinary sampling noise",
            "A moderate shift worth watching on the dashboard",
            "The model's accuracy has fallen by roughly 31%",
            "A major shift that warrants investigation now"
          ],
          answer: 3,
          explain: "The usual bands are below 0.1 for no meaningful change, 0.1 to 0.25 for moderate, and above 0.25 for major. PSI measures how far the input distribution moved, not how much accuracy dropped — a major input shift can leave quality untouched or wreck it, which is exactly what the investigation is for."
        },
        {
          q: "Fraud labels arrive about 60 days after the transaction. What should you monitor in the meantime?",
          options: [
            "Nothing yet — waiting for real labels avoids false alarms",
            "Input drift, the prediction distribution, and fast proxies like review outcomes",
            "Only the monthly fraud-loss figure reported by finance",
            "The training loss that was recorded when the deployed model was originally fit"
          ],
          answer: 1,
          explain: "With a two-month label delay, waiting for ground truth means a broken model leaks money for two months. Inputs and predictions are available instantly, and partial labels such as analyst review decisions or early chargebacks arrive in days. They are biased proxies, but they fire early, which is what monitoring is for."
        },
        {
          q: "Transaction features look exactly like last quarter, but fraudsters changed tactics so the same features now mean something different. What kind of change is this?",
          options: [
            "Concept drift",
            "Covariate drift",
            "Training-serving skew",
            "Prior (label) shift"
          ],
          answer: 0,
          explain: "Concept drift is a change in the relationship between inputs and the label, P(y|x), while the input distribution P(x) may be unchanged. That is why input-drift monitors can stay green during concept drift — only labels or label proxies reveal it. Covariate drift moves P(x); prior shift moves the base rate P(y); skew is a mismatch between your own training and serving pipelines."
        },
        {
          q: "A drift detector fires and the pipeline can retrain automatically tonight. Why might retraining immediately be the wrong move?",
          options: [
            "Retraining on more recent data always reduces accuracy",
            "Models cannot safely be retrained more than once a month",
            "If the drift is an upstream bug, retraining bakes the corrupted data into the next model",
            "Drift detectors only fire on false alarms, never on real change"
          ],
          answer: 2,
          explain: "A drift alarm says the data changed, not why. If the cause is a broken join or a null-coercion bug, retraining teaches the new model that the broken values are normal and makes the incident harder to reverse. Triage first — pipeline bug or real-world shift — and gate automated retraining on data validation."
        },
        {
          q: "A feature histogram shows a sudden spike of mass in exactly the lowest bin, starting at an upstream deploy. What is the most likely cause?",
          options: [
            "A seasonal change in customer behaviour",
            "A newly acquired cohort of low-spend users arriving this week",
            "Concept drift in the relationship to the label",
            "An upstream change coercing nulls or failures to zero"
          ],
          answer: 3,
          explain: "Real-world shifts move mass gradually and across several bins. A step change concentrated in one value, aligned with a deploy, is the fingerprint of a pipeline defect — most often missing values silently filled with zero. Check the null rate and the upstream change log before anyone touches the model."
        },
        {
          q: "How should you choose a scheduled retraining cadence for a model?",
          options: [
            "Retrain daily, because fresher data is always better",
            "Measure decay on future windows and retrain before it exceeds tolerance",
            "Match the cadence of the application's code release train",
            "Retrain whenever a KS test on any single feature gives a p-value below 0.05"
          ],
          answer: 1,
          explain: "Train on a fixed window, score it on each following week, and plot the metric: the slope tells you how fast this model goes stale and what each retrain buys. Daily retraining can cost more than the decay it prevents, and a KS p-value on production-sized samples is significant for trivially small shifts."
        }
      ]
    }
  });

  /* ==================================================================
     3. Module: delivery — Shipping models
  ================================================================== */
  var MOD_DELIVERY = {
    id: "delivery",
    name: "Shipping models",
    icon: "cube",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "model-registry",
        title: "The model registry: versions, lineage, and rollback by pointer",
        summary: "Immutable versioned artifacts with enough metadata to reproduce them, stage transitions with approvals, and aliases that turn rollback into a one-line change.",
        minutes: 9,
        tags: ["mlops", "registry", "lineage"],
        blocks: [
          { t: "p", html: "Shipping a model is the start of its life, not the end. From the moment it serves traffic you will need to answer questions about it: which data trained it, which code, who approved it, what it scored on the slice that just regressed, and how to put the previous one back. A <strong>model registry</strong> is the system of record that answers those questions in seconds instead of in an archaeology project." },
          { t: "p", html: "Hold this mental model: a registry is to models what an artifact repository is to binaries, plus a lineage database. Every trained model becomes an <em>immutable, numbered version</em> under a named model. Nothing is ever overwritten; stages and aliases are just pointers into that history." },
          { t: "h", text: "What a registered version contains" },
          {
            t: "table",
            headers: ["Field", "Example", "Why it earns its place"],
            rows: [
              ["Artifact", "Weights plus bundled preprocessing, content-hashed", "The thing serving actually loads; the hash proves it was not altered"],
              ["Training data snapshot", "Table snapshot id, partition range, row count, hash", "Source tables get overwritten; this is the field you cannot reconstruct later"],
              ["Code version", "Commit of the training pipeline and feature definitions", "Reproduce the run; diff two versions when behaviour changes"],
              ["Feature list and versions", "<code class='tok'>order_value_7d@v3</code>, <code class='tok'>user_tenure@v1</code>", "Serving must provide exactly these, with these semantics"],
              ["Environment", "Lockfile of library versions, base image digest", "A minor library bump can change numerics or deserialization"],
              ["Evaluation", "Overall metric plus per-slice metrics and the eval set id", "The gate decision is auditable, and regressions can be localized"],
              ["Signature", "Input schema, output schema, units", "A contract the serving layer can validate against at deploy time"],
              ["Ownership and intent", "Owning team, intended use, known limitations", "Someone gets paged; nobody reuses it for a purpose it was never tested on"]
            ]
          },
          { t: "p", html: "Most of these come for free if training already logs runs to an experiment tracker — <a href='#/train/experiments/experiment-tracking'>experiment tracking</a> covers that side. The registry is where a run is <em>promoted</em> from 'something we tried' to 'something we might ship', and the documentation side of the intent fields is covered in <a href='#/resp/explain/model-documentation'>model documentation</a>." },
          { t: "note", variant: "trap", html: "<strong>Registering the artifact without the data snapshot is the most common gap.</strong> The weights reproduce predictions, but not the model. When a leak or a bias complaint arrives six months later, the question is always 'what was it trained on?', and a table name without a snapshot id answers nothing — the table has been rewritten a hundred times since." },
          { t: "h", text: "Stage transitions" },
          { t: "p", html: "Each version moves through a small, explicit lifecycle. The exact names vary by tool; the shape does not." },
          {
            t: "code", lang: "text", code:
              "candidate ──(automated gates pass)──> staging\n" +
              "staging   ──(shadow/canary clean + human approval)──> production\n" +
              "production ──(superseded)──> archived      (kept, never deleted)\n" +
              "\n" +
              "any stage ──(gate or incident)──> rejected  (kept, with the reason)"
          },
          {
            t: "table",
            headers: ["Transition", "Who or what approves", "Evidence required"],
            rows: [
              ["candidate → staging", "The CI pipeline, automatically", "Data validation, quality gates vs baseline, slice gates, size and latency budgets"],
              ["staging → production", "A named owner, recorded in the registry", "Clean shadow or canary window, rollout plan, rollback target identified"],
              ["production → archived", "Automatic when superseded", "Nothing — but the artifact and metadata are retained for audit"],
              ["anything → rejected", "Gate failure or reviewer", "The reason, so the next attempt does not repeat it"]
            ]
          },
          { t: "h", text: "Aliases, and rollback by pointer" },
          { t: "p", html: "Serving should never load 'version 41'. It should load <em>whatever the <code class='tok'>production</code> alias points at</em> for a given model name. That one indirection changes what a rollback is." },
          {
            t: "compare",
            bad: { title: "Version baked into the deploy", items: ["Rollback means a new build and deploy", "Minutes to hours, during an incident", "The old artifact may not even still be built"] },
            good: { title: "Serving resolves an alias", items: ["Rollback moves <code class='tok'>production</code> from v42 back to v41", "Seconds; v41 is immutable and already validated", "The move itself is an auditable registry event"] }
          },
          { t: "p", html: "Use a few aliases deliberately: <code class='tok'>production</code> for the champion, <code class='tok'>challenger</code> for what is in shadow or canary, and <code class='tok'>fallback</code> for a simpler model or heuristic you trust when everything else is in doubt. Rollback is then a decision about which pointer to move, and the playbook in <a href='#/ops/monitoring/drift-playbook'>the drift playbook</a> can say exactly which one." },
          { t: "note", variant: "warn", html: "<strong>Pointer rollback is only safe if the old version still fits the world.</strong> If the feature schema changed since v41 shipped — a renamed feature, a new encoding — v41 may load fine and then score garbage. Validate each version's signature against what serving currently provides, and keep the previous version's features alive until the new one has baked." },
          { t: "cue", html: "Bring up the registry whenever a prompt says 'retrain regularly', 'audit', 'regulated', or 'roll back'. The sentence that earns credit: <em>\"Every model is an immutable registry version with its data snapshot, code commit and eval results; serving resolves a production alias, so rollback is moving a pointer.\"</em>" },
          { t: "note", variant: "key", html: "<strong>Version everything immutably, record the data snapshot, and serve through an alias.</strong> Lineage answers 'what is this model?', approvals answer 'who said it could ship?', and alias-based serving turns the most stressful operation in MLOps into a one-line change." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "ml-cicd",
        title: "CI/CD when code, data, and model all change",
        summary: "A test pyramid for ML, quality gates against a baseline with tolerance and slices, and continuous training as a pipeline you test like any other.",
        minutes: 11,
        tags: ["mlops", "cicd", "testing"],
        blocks: [
          { t: "p", html: "Ordinary CI/CD assumes one thing changes: the code. An ML system has three independent axes of change, and any one of them can break production while the others are untouched. <strong>Code</strong> changes when someone edits a feature transform. <strong>Data</strong> changes every day whether anyone touches it or not. The <strong>model</strong> changes every time you retrain, even with identical code and data, because of seeds and nondeterministic kernels." },
          { t: "p", html: "So the pipeline has to test each axis separately. The mental model is a test pyramid, wide and cheap at the bottom, narrow and expensive at the top — the same shape as service testing, with layers that only ML needs." },
          { t: "h", text: "The ML test pyramid" },
          {
            t: "table",
            headers: ["Layer", "What it checks", "Runs on", "Typical cost"],
            rows: [
              ["Unit tests on features", "Each transform on hand-written inputs: nulls, empty strings, extreme values, time zones", "Every commit", "Seconds"],
              ["Data validation", "Schema, null rates, ranges, category sets, row counts vs expectation", "Every new training snapshot", "Seconds to minutes"],
              ["Training smoke test", "Pipeline runs end to end on a small sample; loss decreases; artifact loads", "Every commit touching training", "Minutes"],
              ["Quality gates vs baseline", "Primary metric within tolerance of the production model on a fixed eval set", "Every candidate", "Minutes to an hour"],
              ["Slice gates", "No important slice regresses beyond its own tolerance", "Every candidate", "Same run as above"],
              ["Behavioural tests", "Invariance and directional expectations on crafted inputs", "Every candidate", "Minutes"],
              ["Budgets", "p99 latency, memory, artifact size on the target hardware", "Every candidate", "Minutes"]
            ]
          },
          { t: "p", html: "Data validation deserves its own lesson and has one in the Data track: <a href='#/data/correctness/data-validation'>data validation</a>. The short version for CI: a training run that starts on an unvalidated snapshot is an untested deploy, whatever your code coverage says. For the pipeline machinery itself — scheduling, backfills, data contracts — Cascade covers it in depth: <a href='../data-eng-academy/index.html'>Cascade</a>." },
          { t: "h", text: "Quality gates: three tiers" },
          {
            t: "table",
            headers: ["Tier", "Gate", "What goes wrong"],
            rows: [
              ["Naive", "Candidate AUC must be greater than production AUC", "Seed noise makes it fail at random; people learn to override it"],
              ["Solid", "Candidate within a tolerance of production on a frozen eval set, plus absolute floors", "An aggregate pass can still hide a regressed slice"],
              ["Standout", "Tolerance gate plus per-slice gates, behavioural tests and latency/size budgets, all declared as config in the repo", "Costs a curated eval set per slice — which is the point"]
            ]
          },
          { t: "note", variant: "tip", html: "<strong>Measure the noise before you set the tolerance.</strong> Retrain the production configuration five times with different seeds and look at the spread of the primary metric. If AUC varies by ±0.002, a tolerance of 0.003 is defensible; a tolerance of zero is a coin flip with extra steps." },
          { t: "h", text: "Behavioural tests" },
          { t: "p", html: "Aggregate metrics tell you how often the model is right. Behavioural tests tell you whether it is right for the reasons you expect, on inputs you construct deliberately." },
          {
            t: "ul", items: [
              "<strong>Invariance.</strong> Changing something irrelevant should not move the score: the user's display name, the casing of a product title, the order of items in an unordered set.",
              "<strong>Directional expectation.</strong> Changing something relevant should move it the right way: more failed logins should not lower a fraud score; a higher price should not raise predicted conversion, all else equal.",
              "<strong>Minimum functionality.</strong> A handful of cases the model must get right, written by people who know the domain — the ones that would be embarrassing in front of a customer."
            ]
          },
          { t: "h", text: "Gates as code" },
          { t: "p", html: "Declare the gate in the repository next to the training code, so a change to a threshold is reviewed like any other change, and the registry can record exactly which gate a version passed." },
          {
            t: "code", lang: "text", code:
              "# gates/churn_model.yaml\n" +
              "baseline: alias:production\n" +
              "eval_set: churn-eval-frozen-v7\n" +
              "primary:\n" +
              "  metric: pr_auc\n" +
              "  tolerance: -0.003        # may be at most 0.003 below baseline\n" +
              "  floor: 0.42              # absolute minimum regardless of baseline\n" +
              "slices:\n" +
              "  - {by: country,  min_rows: 2000, tolerance: -0.010}\n" +
              "  - {by: tenure_bucket,            tolerance: -0.010}\n" +
              "behavioural:\n" +
              "  - suite: invariance_name_change   max_score_delta: 0.01\n" +
              "  - suite: directional_support_tickets  expect: non_decreasing\n" +
              "budgets:\n" +
              "  p99_latency_ms: 25       # on the target CPU instance, batch 1\n" +
              "  artifact_mb: 300\n" +
              "on_fail: reject_and_record_reason"
          },
          { t: "note", variant: "warn", html: "<strong>Slice gates need a minimum row count.</strong> A slice with 80 examples will fail a tight tolerance on noise alone. Set <code class='tok'>min_rows</code>, widen tolerances for small slices, and report rather than block when a slice is too small to measure honestly." },
          { t: "h", text: "Continuous training is a pipeline too" },
          { t: "p", html: "Once retraining is automated, the deploy unit is no longer a model — it is the pipeline that produces models. That pipeline is code, and it gets the same treatment: versioned, tested, and promoted through environments. Each scheduled or triggered run then executes the gates above and produces a candidate in the registry, never a production model directly." },
          {
            t: "code", lang: "text", code:
              "trigger (schedule | drift | performance)\n" +
              "  -> snapshot training data          (id recorded)\n" +
              "  -> validate data                   (fail = stop, alert data owner)\n" +
              "  -> train                           (seeded, env pinned)\n" +
              "  -> evaluate vs alias:production    (gates from config)\n" +
              "  -> register as candidate           (or rejected, with reason)\n" +
              "  -> shadow / canary                 (see safe rollouts)\n" +
              "  -> human or policy approval -> move alias"
          },
          { t: "p", html: "What triggers that pipeline, and how often, is a decision with its own trade-offs — covered in <a href='#/ops/monitoring/retraining-triggers'>retraining triggers</a>." },
          { t: "cue", html: "When a prompt says 'the model is retrained weekly' or 'automate retraining', the interviewer is listening for what stops a bad retrain from shipping. Name the three axes of change, then the gates: <em>\"validated data, a tolerance gate against the production model on a frozen eval set, slice gates, and latency budgets — all as config in the repo.\"</em>" },
          { t: "note", variant: "key", html: "<strong>Code, data and model each change on their own schedule, so test each one.</strong> Unit-test the transforms, validate every snapshot, gate every candidate against the production baseline with a measured tolerance and per-slice checks, and treat the retraining pipeline as the thing you actually deploy." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "model-packaging",
        title: "Packaging a model so serving matches training",
        summary: "Serialization choices, bundling preprocessing, containers and model servers, signature contracts, pinned dependencies, and the CPU-versus-GPU image decision.",
        minutes: 9,
        tags: ["mlops", "packaging", "serving"],
        blocks: [
          { t: "p", html: "The registry stores a model; packaging decides what that model <em>is</em> when it leaves the training environment. The goal is narrow and unforgiving: the serving process must compute exactly the function that was evaluated, on exactly the inputs it was evaluated on. Every packaging decision is a way of keeping that promise or quietly breaking it." },
          { t: "h", text: "Serialization formats, in general terms" },
          {
            t: "table",
            headers: ["Kind of format", "Buys you", "Costs you"],
            rows: [
              ["Language-native object serialization", "Saves anything, including custom Python objects, in one line", "Loading executes code; tied to library versions; not portable across languages"],
              ["Framework-native checkpoint", "Weights plus architecture, the framework's supported path", "You need that framework, often that major version, at serving time"],
              ["Portable graph-interchange format", "One artifact runs on several runtimes and languages", "Not every operator converts; custom layers need work; verify numerics after export"],
              ["Compiled or optimized runtime format", "Fused kernels, lower latency, often reduced precision", "Hardware-specific; another conversion step to validate; harder to debug"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Never load a language-native serialized model from a source you do not control.</strong> Deserialization reconstructs objects by running code, so a crafted file executes with the permissions of your serving process. Restrict loading to artifacts pulled from your own registry by content hash, and prefer weight-only or interchange formats at any trust boundary." },
          { t: "h", text: "Bundle preprocessing with the model" },
          { t: "p", html: "The most common source of <a href='#/mlsd/concepts/feature-stores'>training-serving skew</a> is not the feature store — it is a transform implemented twice. Training normalizes with a Python function; serving reimplements it in another service; one of them handles nulls differently, or uses last month's vocabulary." },
          {
            t: "compare",
            bad: { title: "Transform reimplemented at serving", items: ["Two codebases for one function", "Defaults, rounding and vocab versions drift apart", "Skew appears only on rare inputs, so tests miss it"] },
            good: { title: "Transform shipped inside the artifact", items: ["Fitted scalers, vocabularies and encoders saved with the weights", "One implementation, evaluated and served", "Costs a slightly heavier artifact and a shared runtime"] }
          },
          {
            t: "code", lang: "python", code:
              "# Fit and save the whole pipeline, not just the estimator\n" +
              "pipe = Pipeline([\n" +
              "    (\"impute\", SimpleImputer(strategy=\"median\")),\n" +
              "    (\"scale\",  StandardScaler()),\n" +
              "    (\"model\",  GradientBoostingClassifier(random_state=7)),\n" +
              "])\n" +
              "pipe.fit(X_train, y_train)\n" +
              "\n" +
              "# serving calls pipe.predict_proba(raw_rows) -- the medians and\n" +
              "# scaling constants learned in training travel with the artifact"
          },
          { t: "h", text: "Signatures: the contract at the boundary" },
          { t: "p", html: "A <strong>signature</strong> declares the input columns, their types and units, and the output shape. Record it at registration and check it twice: at deploy time, against what the serving layer will actually supply, and at request time, rejecting or flagging inputs that violate it. A signature check at deploy is what makes pointer rollback safe when schemas have moved." },
          { t: "h", text: "Containers and model servers" },
          { t: "p", html: "Two shapes dominate. Either the model is embedded in an application container with your own request handler, or it is loaded by a general-purpose <strong>model server</strong> that provides batching, multiple model versions, health checks and metrics out of the box." },
          {
            t: "table",
            headers: ["Choice", "Fits when", "Watch out for"],
            rows: [
              ["Model inside the app container", "One small model, custom pre/post logic, CPU serving", "You rebuild batching, versioning and metrics yourself"],
              ["Dedicated model server", "Several models, GPUs, dynamic batching, version routing", "Another component to operate; custom preprocessing must fit its extension points"],
              ["Batch job image", "Scheduled scoring over a table", "Same artifact and transforms as online, or batch and online scores disagree"]
            ]
          },
          { t: "h", text: "Pin everything, and budget the image" },
          {
            t: "ul", items: [
              "<strong>Dependency pinning.</strong> Serve with the exact lockfile recorded at training time. A minor version bump in a numerical library can change results in the fourth decimal place — enough to flip decisions near a threshold.",
              "<strong>CPU versus GPU images.</strong> GPU images carry driver and runtime libraries and run to several gigabytes; CPU images can be a few hundred megabytes. Tree models and small networks usually belong on CPU; large dense networks with batching usually earn the GPU.",
              "<strong>Size budgets.</strong> Image size drives cold-start time when autoscaling. A 6 GB image that takes 90 seconds to pull is a 90-second gap in capacity during a traffic spike, so set an artifact and image budget in the CI gates."
            ]
          },
          { t: "stat", items: [
            { v: "1", k: "implementation of each transform" },
            { v: "2", k: "signature checks: deploy and request" },
            { v: "0", k: "untrusted deserializations" }
          ] },
          { t: "cue", html: "When a prompt mentions 'the model works offline but not in production', reach for packaging first: <em>\"I'd ship preprocessing inside the artifact, validate a signature at deploy and request time, and serve with the training lockfile — most offline/online gaps are a transform implemented twice.\"</em>" },
          { t: "note", variant: "key", html: "<strong>Package the function you evaluated, not just the weights.</strong> Bundle fitted preprocessing, enforce a signature contract, pin the environment, keep untrusted serialization out, and budget image size because it becomes your autoscaling cold-start." },
          { t: "quiz", id: "ops-delivery" }
        ]
      }
    ]
  };

  /* ==================================================================
     4. Module: inference — Inference patterns
  ================================================================== */
  var MOD_INFERENCE = {
    id: "inference",
    name: "Inference patterns",
    icon: "queue",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "inference-modes",
        title: "Batch, online, or streaming: picking the inference mode",
        summary: "A decision table by freshness, latency, cost and input cardinality — and the hybrid patterns most production systems actually run.",
        minutes: 9,
        tags: ["inference", "serving", "architecture"],
        blocks: [
          { t: "p", html: "The interview-level overview of serving shapes lives in <a href='#/mlsd/serving/inference-architecture'>inference architecture</a>. This lesson is the operator's version: how to decide, what each mode costs to run, and the hybrids that let you avoid choosing just one." },
          { t: "p", html: "The mental model is a question about <em>when the inputs exist</em>. If every input you will ever need to score exists before anyone asks, you can compute answers ahead of time. If the input is created by the request itself — a search query, a just-uploaded photo, a transaction being authorized — the model must run on the request path." },
          { t: "h", text: "The three modes" },
          {
            t: "table",
            headers: ["Mode", "How it runs", "Freshness", "Request latency", "Cost shape"],
            rows: [
              ["Batch precompute", "Scheduled job scores every entity; results written to a key-value store", "Hours to a day", "One lookup, ~1 ms", "Pay to score everything, even entities nobody requests"],
              ["Online request/response", "Model service scores each request synchronously", "Inputs as fresh as the request", "Model plus feature fetch, tens of ms", "Pay per request, plus idle capacity for peaks"],
              ["Streaming / event-driven", "Consumer scores events from a log as they arrive; results pushed or stored", "Seconds", "None on the user path — results are already there", "Always-on consumers; replay and ordering to manage"]
            ]
          },
          { t: "h", text: "The decision table" },
          {
            t: "table",
            headers: ["If…", "Lean toward", "Because"],
            rows: [
              ["Inputs are enumerable (users, products) and a day of staleness is fine", "Batch", "Cheapest per answer and the most reliable serving path there is"],
              ["The input is created by the request (query, upload, transaction)", "Online", "There is nothing to precompute"],
              ["Inputs are enumerable but the space is huge and most entries are never requested", "Online, or batch for the head only", "Scoring 500 million pairs to serve 2 million is waste"],
              ["The answer must react to events within seconds, but not inside a request", "Streaming", "Fresh without putting the model on the latency-critical path"],
              ["Latency budget under ~10 ms with a heavy model", "Batch or cache", "The model may not fit the budget at all online"]
            ]
          },
          { t: "note", variant: "tip", html: "<strong>Do the cardinality arithmetic out loud.</strong> 10 million users × 1 score each nightly is trivial. 10 million users × 50,000 items is 500 billion pairs — not a batch job anyone runs. The second number is why recommendation systems split into retrieval and ranking rather than precomputing every pair." },
          { t: "h", text: "Hybrids that most systems actually run" },
          {
            t: "ul", items: [
              "<strong>Precomputed candidates, online re-ranking.</strong> A nightly job produces the top few hundred candidates per user; at request time a ranker re-scores them with session context. Batch carries the expensive breadth, online carries the freshness.",
              "<strong>Batch head, online tail.</strong> Precompute scores for the most-requested entities and fall through to online inference for the rest. Most traffic hits the cheap path.",
              "<strong>Streaming features, online model.</strong> A stream processor keeps features like 'transactions in the last 10 minutes' fresh in a store; the online model reads them at request time. Freshness comes from the features, not from rescoring.",
              "<strong>Online with a prediction cache.</strong> Identical requests within a short window reuse the answer. Effective when inputs repeat — popular queries — and useless when every request is unique."
            ]
          },
          {
            t: "code", lang: "text", code:
              "nightly batch:   user -> top 300 candidates      (written to KV, ~2h job)\n" +
              "request path:    KV lookup            ~2 ms\n" +
              "                 session features     ~6 ms\n" +
              "                 re-rank 300 items    ~15 ms\n" +
              "                 business rules       ~2 ms\n" +
              "                 ---------------------------\n" +
              "                                      ~25 ms, fresh to the session"
          },
          { t: "note", variant: "warn", html: "<strong>Two paths means two chances to diverge.</strong> If batch and online score the same entity, they must use the same artifact and the same feature definitions, or the same user sees different scores depending on which path served them. Point both at one registry alias and one feature definition source." },
          { t: "h", text: "What each mode costs you operationally" },
          {
            t: "compare",
            bad: { title: "Batch failure modes", items: ["A failed nightly job silently serves yesterday's scores", "New entities have no score until the next run", "Backfills are large and slow"] },
            good: { title: "Online failure modes", items: ["Every dependency is on the request path", "Peak capacity is paid for all day", "A feature-store outage is a user-facing outage"] }
          },
          { t: "p", html: "Batch needs a freshness alarm (the age of the newest score) and a default for unscored entities. Online needs timeouts, a fallback when features are missing, and capacity for peaks. Streaming needs consumer-lag alarms and a replay plan. General service reliability — SLOs, error budgets, on-call — is covered in Beacon: <a href='../sre-academy/index.html'>Beacon</a>." },
          { t: "cue", html: "Ask two questions out loud to pick the mode: <em>\"Does the input exist before the request?\"</em> and <em>\"How stale can the answer be?\"</em> Then size the cardinality. Saying 'precomputed candidates with online re-ranking' for a recommendation prompt is usually the expected landing." },
          { t: "note", variant: "key", html: "<strong>Pick the mode by when the inputs exist and how stale the answer may be, then hybridize.</strong> Batch is cheapest and most reliable for enumerable inputs, online is mandatory when the request creates the input, streaming buys seconds-level freshness off the request path — and most real systems combine two of them." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "safe-rollouts",
        title: "Safe rollouts: shadow, canary, and the kill switch",
        summary: "How to expose a new model to traffic in steps you can reverse, what each step can and cannot teach you, and rollback criteria decided before the rollout starts.",
        minutes: 10,
        tags: ["inference", "rollout", "experimentation"],
        blocks: [
          { t: "p", html: "Passing offline gates proves a model is good on yesterday's labelled data. It does not prove the model behaves on today's real inputs, at real load, with real users reacting to it. A rollout is the sequence of steps that closes that gap while keeping the blast radius small and every step reversible." },
          { t: "p", html: "Think of it as a ladder where each rung exposes more risk and teaches you something the previous rung could not. You climb only when the current rung is clean, and you know before you start what 'not clean' means." },
          { t: "h", text: "The ladder" },
          {
            t: "table",
            headers: ["Step", "What happens", "Users affected", "What you learn"],
            rows: [
              ["Shadow", "Challenger scores a copy of live traffic; outputs logged, never used", "None", "Latency, errors, prediction distribution, disagreement with champion"],
              ["Canary", "A small share of traffic is actually served by the challenger", "1-5%", "Real user response at small scale; operational surprises"],
              ["Progressive rollout", "Share increases in steps with a bake time at each", "5% → 25% → 50% → 100%", "Effects that only show at scale: load, caches, downstream systems"],
              ["A/B as rollout", "Fixed split held long enough for a powered comparison", "Typically 50/50 or 90/10", "A causal estimate of the effect on the primary and guardrail metrics"]
            ]
          },
          { t: "h", text: "What shadow can and cannot tell you" },
          {
            t: "compare",
            bad: { title: "Shadow cannot tell you", items: ["How users respond — nobody sees the output", "Effects on clicks, conversion or retention", "Feedback-loop effects on future training data", "Whether downstream systems cope with the new decisions"] },
            good: { title: "Shadow can tell you", items: ["p50/p99 latency and error rate on real inputs", "Score distribution versus the champion", "Where and how often the two models disagree", "Inputs that crash or produce out-of-range outputs"] }
          },
          { t: "note", variant: "tip", html: "<strong>Read the disagreement set, not just the disagreement rate.</strong> If the challenger disagrees with the champion on 4% of requests, pull a sample of those requests and look at them. That 4% is where the entire difference between the models lives, and a domain expert can often tell in ten minutes which model is right." },
          { t: "h", text: "Canary with automated analysis" },
          { t: "p", html: "A canary is only useful if someone — preferably something — compares it fairly. Compare the canary cohort to a <em>concurrent</em> control cohort of the same size, not to last week's numbers, so time-of-day and seasonal effects cancel out. Automate the comparison on a fixed set of metrics and let it halt the rollout." },
          {
            t: "code", lang: "text", code:
              "rollout: fraud-model v42 (alias: challenger)\n" +
              "steps:   [1%, 5%, 25%, 50%, 100%]\n" +
              "bake:    2h minimum and >= 20,000 scored requests per step\n" +
              "compare: canary cohort vs concurrent control cohort\n" +
              "halt if:\n" +
              "  error_rate        > control + 0.2pp\n" +
              "  p99_latency_ms    > 60\n" +
              "  block_rate        outside control +/- 15% (relative)\n" +
              "  manual_review_overturn_rate > control + 1pp\n" +
              "on halt: move traffic to alias:production, page owner"
          },
          { t: "p", html: "For the statistics behind a fair comparison — sample size, power, peeking — see <a href='#/found/experiments/ab-test-design'>A/B test design</a> and the interview framing in <a href='#/mlsd/concepts/ab-testing'>A/B testing</a>. The operational point is simpler: decide the bake time and sample size before the rollout, and do not promote early because the dashboard looks green after an hour." },
          { t: "h", text: "Blue-green and kill switches" },
          { t: "p", html: "<strong>Blue-green</strong> keeps two complete serving stacks; you switch traffic between them at the router. It makes infrastructure changes — new runtime, new hardware, new image — reversible in one move. For pure model changes, an alias move inside one stack is usually enough." },
          { t: "p", html: "A <strong>kill switch</strong> is a runtime flag that routes all traffic away from a model without a deploy: to the previous version, to a simpler fallback model, or to a heuristic. It must be tested before you need it, owned by the on-call, and usable by someone who did not build the model." },
          { t: "h", text: "Rollback criteria, decided in advance" },
          {
            t: "table",
            headers: ["Signal", "Example threshold", "Action"],
            rows: [
              ["Error or timeout rate", "> control + 0.2 percentage points for 10 min", "Automatic rollback"],
              ["p99 latency", "> budget for 10 min", "Automatic rollback"],
              ["Prediction distribution", "Positive rate outside ±15% of control", "Halt rollout, investigate"],
              ["Guardrail metric", "Complaints, refunds or overturns worse than control beyond noise", "Halt; roll back if confirmed"],
              ["Primary metric", "Significantly worse at the planned sample size", "Roll back and record the result"],
              ["Primary metric", "Inconclusive at the planned sample size", "Decide on cost, simplicity and guardrails — not on hope"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Rolling forward through a regression is how small incidents become big ones.</strong> 'It's only 1% of traffic, let's push to 25% and get more data' multiplies the damage if the regression is real. When a halt condition fires, the default is back, not up." },
          { t: "cue", html: "When asked 'how would you launch this model?', climb the ladder out loud: <em>\"Shadow to check latency and disagreement, a 1-5% canary against a concurrent control with automated halt criteria, progressive steps with bake times, and a tested kill switch to the previous alias.\"</em> Then say what shadow cannot measure." },
          { t: "note", variant: "key", html: "<strong>Every rung of the rollout teaches something the last one could not, and every rung must be reversible.</strong> Shadow for behaviour on real inputs, canary for real user response at small scale, progressive steps for effects at scale — with halt criteria written down before the first request is served." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "serving-performance",
        title: "Serving performance: latency budgets, batching, and cost per prediction",
        summary: "Decomposing a p99 budget, the batching trade-off, caching, model compression at the concept level, queue-depth autoscaling, and the arithmetic of cost per thousand predictions.",
        minutes: 11,
        tags: ["inference", "performance", "cost"],
        blocks: [
          { t: "p", html: "A model that is accurate and too slow is not shippable, and a model that is fast and too expensive will be turned off by the next budget review. Performance work starts with one habit: write the latency budget down as a sum of parts, and measure each part before optimizing any of them." },
          { t: "h", text: "Decompose the budget" },
          {
            t: "code", lang: "text", code:
              "end-to-end p99 budget                       100 ms\n" +
              "  network + gateway                          10 ms\n" +
              "  feature fetch (store + fallbacks)          35 ms   <- usually the largest\n" +
              "  model inference                            25 ms\n" +
              "  post-processing + business rules           10 ms\n" +
              "  headroom for retries, GC, bursts           20 ms\n" +
              "\n" +
              "rule: per-component p99s do NOT add up to the end-to-end p99,\n" +
              "but if any one component's p99 exceeds its slice, the total will"
          },
          { t: "note", variant: "tip", html: "<strong>Optimize the largest slice first, and it is rarely the model.</strong> Teams spend weeks shaving 5 ms from inference while feature fetch costs 35 ms because of three sequential lookups that could have been one batched read. Measure before you quantize." },
          { t: "h", text: "p50 versus p99" },
          { t: "p", html: "The median tells you about a typical request; the 99th percentile tells you about one request in a hundred — which, for a page that makes ten model calls, is one page load in ten. A wide gap between p50 and p99 means something happens <em>sometimes</em>: cache misses falling through to slow storage, retries, garbage-collection pauses, cold replicas, or queueing during bursts. Fix the cause of the tail; adding hardware rarely helps a tail caused by a dependency." },
          { t: "h", text: "Dynamic batching" },
          { t: "p", html: "Accelerators are far more efficient on a batch of 32 than on 32 batches of one. A model server with <strong>dynamic batching</strong> holds incoming requests for up to a maximum wait, then runs whatever has accumulated as one batch." },
          {
            t: "table",
            headers: ["Max wait", "Typical batch at 2,000 req/s", "Added latency (worst case)", "Throughput per GPU"],
            rows: [
              ["0 ms (off)", "1", "0 ms", "Baseline"],
              ["2 ms", "~4", "2 ms", "Roughly 2-3x baseline"],
              ["5 ms", "~10", "5 ms", "Roughly 4-6x baseline"],
              ["20 ms", "~32 (capped)", "20 ms", "Near the hardware ceiling — if the budget allows it"]
            ]
          },
          { t: "p", html: "The figures are illustrative; the shape is not. Throughput rises steeply and then flattens as batches approach the hardware's sweet spot, while the worst-case latency cost rises linearly with the wait. Pick the largest wait that still fits inside the model's slice of the p99 budget. At low traffic, batches never fill and you pay the wait for nothing — which is why the wait is a maximum, not a fixed delay." },
          { t: "h", text: "Caching predictions and features" },
          {
            t: "ul", items: [
              "<strong>Prediction cache.</strong> Key on the full input; works when inputs repeat (popular queries, item-only scores) and fails when every request is personalized. Its time-to-live is a staleness decision, not a performance one.",
              "<strong>Feature cache.</strong> Cache slow-changing features (user profile, item metadata) close to the model service. Usually a bigger win than prediction caching because features repeat across requests even when full inputs do not.",
              "<strong>Embedding cache.</strong> Item embeddings change only when the item or model changes; precompute them and key by model version, so a new model never reads the old model's vectors."
            ]
          },
          { t: "h", text: "Model compression, at the concept level" },
          {
            t: "table",
            headers: ["Technique", "Idea", "Typical effect", "Risk"],
            rows: [
              ["Quantization", "Store and compute weights in fewer bits, e.g. 8-bit integers instead of 32-bit floats", "Around 4x smaller weights, often 2-4x faster on supporting hardware", "Small accuracy loss; can be uneven across slices"],
              ["Distillation", "Train a small student to mimic a large teacher's outputs", "Large speedups; student often retains most of the quality", "A second training pipeline to maintain"],
              ["Pruning", "Remove weights or whole units that contribute little", "Smaller model; speedups only with structured pruning or sparse-aware kernels", "Unstructured sparsity often gives no real speedup"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Run a compressed model through the same slice gates as any other candidate.</strong> Quantization error is not spread evenly — rare inputs and small slices tend to absorb more of it. A compressed model is a new model version and goes through the registry and rollout like one." },
          { t: "p", html: "Serving large language models brings its own versions of all of this — token-level batching, key-value caches, prompt and output monitoring — and Lumen covers that LLMOps side: <a href='../llm-academy/index.html'>Lumen</a>. Everything here applies to the classical models that still make most production decisions." },
          { t: "h", text: "Autoscaling on the right signal" },
          { t: "p", html: "CPU utilization is a poor scaling signal for GPU model servers and a lagging one for everything else. Scale on <strong>queue depth</strong> or in-flight requests per replica: when requests start waiting, latency is about to break, regardless of what CPU says. And remember the cold start — a new replica must pull the image and load the model before it helps, so scale early and keep a warm minimum." },
          { t: "h", text: "Cost per 1,000 predictions" },
          {
            t: "code", lang: "text", code:
              "GPU replica:  $2.50 / hour, sustains 400 predictions/s at target latency\n" +
              "  at 100% utilization: 400 * 3600 = 1,440,000 / hour\n" +
              "                       $2.50 / 1,440 = $0.0017 per 1k\n" +
              "  at  40% utilization (real traffic has troughs):\n" +
              "                       $2.50 / 576   = $0.0043 per 1k\n" +
              "\n" +
              "CPU replica:  $0.40 / hour, sustains 50 predictions/s\n" +
              "  at  40% utilization: 50 * 0.4 * 3600 = 72,000 / hour\n" +
              "                       $0.40 / 72    = $0.0056 per 1k\n" +
              "\n" +
              "at 200M predictions/day: GPU ~ $870/day, CPU ~ $1,110/day\n" +
              "-> utilization moves the answer more than the hardware choice"
          },
          { t: "stat", items: [
            { v: "$0.0043", k: "GPU per 1k at 40% util" },
            { v: "$0.0056", k: "CPU per 1k at 40% util" },
            { v: "2.5x", k: "cost of running at 40% vs 100%" }
          ] },
          { t: "cue", html: "When the prompt gives a QPS and a latency target, do two calculations out loud: the latency budget split (and which slice you would attack first), and cost per 1,000 predictions <em>at realistic utilization</em>. Interviewers notice when you divide by utilization; most candidates assume 100%." },
          { t: "note", variant: "key", html: "<strong>Budget latency as a sum of parts and fix the largest part, which is usually the feature fetch.</strong> Batching buys throughput with bounded latency, compression buys speed with slice risk, autoscaling should follow queue depth, and cost per prediction is dominated by utilization." },
          { t: "quiz", id: "ops-inference" }
        ]
      }
    ]
  };

  /* ==================================================================
     5. Module: monitoring — Monitoring and response
  ================================================================== */
  var MOD_MONITORING = {
    id: "monitoring",
    name: "Monitoring and response",
    icon: "trend",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "drift-and-skew",
        title: "Drift and skew: telling the kinds of change apart",
        summary: "Covariate drift, prior shift, concept drift and training-serving skew; PSI, divergences and statistical tests; delayed labels and per-slice monitoring.",
        minutes: 12,
        tags: ["monitoring", "drift", "statistics"],
        blocks: [
          { t: "p", html: "'The model drifted' is not a diagnosis. It is four different problems with four different fixes, and the first job of monitoring is to tell them apart. The interview-level view of the three monitoring layers is in <a href='#/mlsd/serving/drift-monitoring'>monitoring a system that fails quietly</a>; this lesson goes into the mechanics." },
          { t: "h", text: "Four kinds of change" },
          {
            t: "table",
            headers: ["Name", "What moved", "Example", "Visible without labels?"],
            rows: [
              ["Covariate (data) drift", "The input distribution P(x)", "Holiday baskets are larger; a new device model dominates traffic", "Yes — input monitors see it"],
              ["Prior (label) shift", "The base rate P(y)", "Fraud rate doubles during a coordinated attack", "Partly — the predicted positive rate moves"],
              ["Concept drift", "The relationship P(y|x)", "Fraudsters change tactics; the same features now mean something else", "No — only labels or label proxies reveal it"],
              ["Training-serving skew", "Your pipelines disagree", "Serving computes a feature differently from training", "Yes — compare logged serving features with training"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Concept drift can happen with every input monitor green.</strong> If inputs look the same but mean something different, distribution checks have nothing to see. That is why input drift monitoring is necessary and not sufficient — you still need labels, delayed or partial, to catch the most damaging kind of change." },
          { t: "p", html: "Skew is the odd one out: it is not the world changing, it is your system disagreeing with itself. Its most common causes — a transform implemented twice, a feature read at different points in time — are covered in <a href='#/mlsd/concepts/feature-stores'>feature stores</a> and <a href='#/data/correctness/point-in-time'>point-in-time correctness</a>. The detector is simple: log the features actually used at serving time and compare them to the training set." },
          { t: "h", text: "Population Stability Index" },
          { t: "p", html: "PSI is the workhorse for numeric and binned features. Bin the reference (training) distribution, compute the share of each window in each bin, and sum a per-bin term that is large when a bin's share changed a lot relative to its size." },
          {
            t: "code", lang: "text", code:
              "PSI = Σ over bins  (a_i − e_i) · ln(a_i / e_i)\n" +
              "\n" +
              "  e_i = share of the reference window in bin i\n" +
              "  a_i = share of the current window in bin i\n" +
              "\n" +
              "worked bin: e = 0.10, a = 0.20\n" +
              "  (0.20 − 0.10) · ln(2.0) = 0.10 · 0.693 = 0.069\n" +
              "\n" +
              "rule-of-thumb bands:\n" +
              "  PSI < 0.10        no meaningful shift\n" +
              "  0.10 – 0.25       moderate: watch, investigate if it persists\n" +
              "  PSI > 0.25        major: investigate now"
          },
          {
            t: "code", lang: "python", code:
              "import numpy as np\n" +
              "\n" +
              "def psi(reference, current, bins=10, eps=1e-4):\n" +
              "    # bin edges come from the REFERENCE, so bins mean the same thing every week\n" +
              "    edges = np.quantile(reference, np.linspace(0, 1, bins + 1))\n" +
              "    edges[0], edges[-1] = -np.inf, np.inf\n" +
              "    e = np.histogram(reference, edges)[0] / len(reference)\n" +
              "    a = np.histogram(current, edges)[0] / len(current)\n" +
              "    e, a = np.clip(e, eps, None), np.clip(a, eps, None)\n" +
              "    return float(np.sum((a - e) * np.log(a / e)))"
          },
          { t: "note", variant: "warn", html: "<strong>PSI depends on the binning and needs a floor for empty bins.</strong> Fix bin edges from the reference window and keep them; re-binning each week makes values incomparable. Clip shares to a small epsilon, or a single empty bin sends the logarithm to infinity. And treat the bands as conventions, not laws — calibrate the threshold per feature against its own week-to-week noise." },
          { t: "widget", id: "opsDrift" },
          { t: "p", html: "Notice in the lab that the upstream bug produces the largest PSI from a single bin while the seasonal shift spreads its contribution across many. That shape — where the contribution comes from — is often more diagnostic than the total." },
          { t: "h", text: "The rest of the toolbox" },
          {
            t: "table",
            headers: ["Measure", "Use it for", "Watch out for"],
            rows: [
              ["KL divergence", "Asymmetric distance from reference to current over the same bins", "Infinite when the current window has mass where the reference has none; not symmetric"],
              ["JS divergence", "Symmetric, bounded version of KL; easier to threshold across features", "Still needs binning for continuous features"],
              ["Kolmogorov-Smirnov test", "Continuous features: maximum gap between the two cumulative distributions", "With large samples, trivially small shifts are 'significant'"],
              ["Chi-square test", "Categorical features: observed vs expected counts per category", "Same large-sample problem; sparse categories need merging"],
              ["Null rate, range, unseen categories", "Pipeline breakage", "None — these are the cheapest, highest-yield checks you have"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Do not page on p-values from production-sized samples.</strong> With a million rows per window, a KS test will reject 'same distribution' for a shift nobody could ever care about. Use the test statistic (or PSI, or JS) as an effect size and threshold that, rather than the p-value." },
          { t: "h", text: "Delayed labels and proxies" },
          { t: "p", html: "Ground truth arrives late — minutes for clicks, weeks for chargebacks — and the expensive errors arrive last. Between prediction and label, monitor in layers: input drift and skew immediately, the prediction distribution within minutes, and <strong>proxy labels</strong> as soon as they exist. Proxies are biased (analyst reviews only cover flagged cases; early chargebacks are not representative), so treat a move in a proxy as a reason to look, and reconcile against true labels when they mature." },
          { t: "h", text: "Monitor per slice" },
          { t: "p", html: "An aggregate PSI of 0.04 can hide a PSI of 0.6 in one country whose traffic is 3% of the total. Compute drift and quality per important slice — locale, platform, acquisition channel, tenure — and alert on the worst slice weighted by its business importance, not just on the global number." },
          { t: "cue", html: "When asked 'how do you detect drift?', separate the kinds first: <em>\"Covariate drift and skew I can see in inputs immediately with PSI and null-rate checks per slice; prior shift shows in the prediction distribution; concept drift only shows in labels, so I need proxies while the real labels are delayed.\"</em>" },
          { t: "note", variant: "key", html: "<strong>Name which kind of change you are looking at before choosing the detector.</strong> PSI and friends catch input drift and skew without labels, the prediction distribution hints at prior shift, and only labels or proxies reveal concept drift — computed per slice, thresholded on effect size, never on p-values." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "retraining-triggers",
        title: "When to retrain: schedules, triggers, and the decay curve",
        summary: "Scheduled, drift-triggered and performance-triggered retraining, how to measure how fast a model goes stale, champion/challenger, and guarding against training on corrupted data.",
        minutes: 9,
        tags: ["monitoring", "retraining", "mlops"],
        blocks: [
          { t: "p", html: "Retraining is not free and not automatically good. Each run costs compute, reviewer attention and rollout risk, and a retrain on bad data is worse than no retrain at all. The question is not 'should we retrain?' but 'what evidence should cause a retrain, and what evidence should stop one?'" },
          { t: "h", text: "Three kinds of trigger" },
          {
            t: "table",
            headers: ["Trigger", "Fires when", "Strength", "Weakness"],
            rows: [
              ["Scheduled", "Calendar: nightly, weekly, monthly", "Predictable, easy to staff and budget", "Retrains when nothing changed; too slow when something did"],
              ["Drift-triggered", "Input or prediction drift crosses a threshold", "Reacts quickly, needs no labels", "Drift does not imply decay; bugs look like drift"],
              ["Performance-triggered", "Measured quality (or a proxy) drops below tolerance", "Responds to the thing you actually care about", "Only as fast as your labels arrive"]
            ]
          },
          { t: "p", html: "Most mature systems combine them: a schedule as the baseline, a performance trigger as the primary signal, and drift as an early warning that opens an investigation rather than launching a training job." },
          { t: "h", text: "Measure the decay curve" },
          { t: "p", html: "How often to retrain is an empirical question with a cheap answer. Train on a fixed historical window, then evaluate that same frozen model on each subsequent week. The curve tells you how fast this particular model goes stale." },
          {
            t: "code", lang: "text", code:
              "model trained on data up to week 0, evaluated on later weeks (PR-AUC)\n" +
              "\n" +
              "week  1   0.612   ████████████████████\n" +
              "week  2   0.609   ███████████████████▉\n" +
              "week  4   0.604   ███████████████████▊\n" +
              "week  8   0.584   ███████████████████\n" +
              "week 12   0.566   ██████████████████▍\n" +
              "\n" +
              "tolerance: at most 0.010 below week-1 quality\n" +
              "-> crosses tolerance between week 4 and week 8\n" +
              "-> a ~4-week cadence holds quality; daily retraining buys ~0.002"
          },
          { t: "note", variant: "tip", html: "<strong>Repeat the experiment from several starting weeks.</strong> One curve can be dominated by a holiday or an incident. Three or four curves from different start dates show whether decay is steady (a schedule works) or bursty (you need a performance or drift trigger on top)." },
          { t: "h", text: "Cost and benefit" },
          {
            t: "table",
            headers: ["Tier", "Policy", "What goes wrong"],
            rows: [
              ["Naive", "Retrain daily because fresher is better", "Pays for compute and rollout risk every day to recover decay that takes weeks to matter"],
              ["Solid", "Cadence set from the decay curve, with gates on every run", "A sudden shift waits for the next scheduled run"],
              ["Standout", "Decay-curve cadence, plus a performance trigger on proxies, plus drift as an investigation trigger — with data validation able to veto any run", "More moving parts to own and document"]
            ]
          },
          { t: "h", text: "Guard against retraining on corrupted data" },
          { t: "p", html: "An automated retrain triggered by drift has an ugly failure mode: the drift is a pipeline bug, the retrain learns the bug as normal, the new model passes gates computed on the same broken data, and now the bug is baked into production. The guards are cheap." },
          {
            t: "ul", items: [
              "<strong>Validate the training snapshot</strong> against the previous snapshot's statistics before training starts — the checks in <a href='#/data/correctness/data-validation'>data validation</a>. A failure stops the run and alerts the data owner, not the model owner.",
              "<strong>Evaluate on a frozen set</strong> that is not refreshed by the same pipeline, so a corrupted refresh cannot also corrupt the yardstick.",
              "<strong>Check the label rate.</strong> A sudden change in the fraction of positives in new training data is more often a labelling bug than a change in the world.",
              "<strong>Require a human approval</strong> on drift-triggered retrains until the trigger has a track record."
            ]
          },
          { t: "h", text: "Champion and challenger" },
          { t: "p", html: "Every retrain produces a <strong>challenger</strong>; the model in production is the <strong>champion</strong>. The challenger has to earn promotion by passing the gates against the champion and then surviving a rollout — see <a href='#/ops/inference/safe-rollouts'>safe rollouts</a>. Keep the champion's registry alias untouched until the challenger has baked, so 'retrain failed' always means 'nothing changed' rather than 'production is in an unknown state'." },
          {
            t: "compare",
            bad: { title: "Retrain-and-replace", items: ["New model overwrites the old artifact", "No comparison on the same eval set", "A bad retrain is discovered by users"] },
            good: { title: "Champion/challenger", items: ["Challenger registered as a new version", "Gated against the champion, then canaried", "The champion keeps serving until the challenger has earned it"] }
          },
          { t: "cue", html: "When a prompt says 'the data changes over time' or asks 'how often would you retrain?', do not pick a number. Say: <em>\"I'd measure the decay curve on future windows to set the cadence, add a performance trigger on proxy labels, and treat drift as an investigation trigger — with data validation able to veto any retrain.\"</em>" },
          { t: "note", variant: "key", html: "<strong>Let the decay curve set the cadence, let performance trigger the extra retrains, and let data validation veto them.</strong> Every retrain is a challenger that must beat the champion on a frozen yardstick and survive a rollout before it touches production." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "drift-playbook",
        title: "The drift playbook: running a model incident",
        summary: "Detect, triage pipeline bug versus real-world shift, mitigate, fix and review — with a symptoms table, severity levels and clear ownership.",
        minutes: 10,
        tags: ["monitoring", "incident", "operations"],
        blocks: [
          { t: "p", html: "An alert fires at 02:40: the predicted positive rate of the fraud model has doubled in an hour. Whatever happens next should not depend on who happens to be on call. A <strong>playbook</strong> turns a model incident into a sequence of decisions someone can follow half-awake, and it is written before the incident, not during it." },
          { t: "p", html: "General incident practice — paging, roles, communication, blameless reviews — is the same as for any service, and Beacon covers it in depth: <a href='../sre-academy/index.html'>Beacon</a>. What is specific to models is the triage question in the middle, and the mitigations available that do not exist for ordinary code." },
          { t: "h", text: "The five steps" },
          {
            t: "ol", items: [
              "<strong>Detect.</strong> An alert from the layered monitors: input checks, prediction distribution, proxy labels, or a business guardrail. Record the time, the signal and the slice.",
              "<strong>Triage.</strong> The one question that decides everything else: <em>is this a pipeline bug or a real-world shift?</em> Check upstream change logs, null rates, deploy times, and whether the change is a step or a slope.",
              "<strong>Mitigate.</strong> Stop the damage before understanding it fully: roll back the alias, drop to a fallback model or heuristic, adjust the threshold, or kill a broken feature.",
              "<strong>Fix.</strong> Repair the pipeline, or retrain on data that includes the new reality — after validation, through the normal gates and rollout.",
              "<strong>Review.</strong> A blameless postmortem: timeline, detection delay, what the monitors missed, and one concrete change to monitoring or process."
            ]
          },
          { t: "h", text: "Triage: bug or world?" },
          {
            t: "compare",
            bad: { title: "Looks like a pipeline bug", items: ["Step change aligned with a deploy or schema change", "Mass piles into one value: zero, empty, a default", "Null rate or unseen-category rate jumps", "Every slice moves at once, identically"] },
            good: { title: "Looks like a real-world shift", items: ["Gradual slope over days, or aligned with a calendar event", "Mass moves across several bins", "Concentrated in a plausible slice: a region, a cohort, a channel", "Corroborated by sources outside your pipeline"] }
          },
          { t: "note", variant: "trap", html: "<strong>Do not retrain your way out of a pipeline bug.</strong> If a join broke and a feature is now zero, a retrain teaches the model that zero is normal, and fixing the join later causes a second incident. Triage before any training job runs." },
          { t: "h", text: "Symptoms, likely causes, first action" },
          {
            t: "table",
            headers: ["Symptom", "Likely cause", "First action"],
            rows: [
              ["One feature's null rate jumps at a deploy boundary", "Upstream schema or job change", "Kill or impute the feature; contact the upstream owner; freeze retraining"],
              ["Mass spikes in exactly one bin (often zero)", "Nulls or errors coerced to a default", "Same as above; confirm with the raw upstream values"],
              ["Score distribution shifts right after a model release", "The new version, not the world", "Roll the alias back; compare versions on the frozen eval set"],
              ["Gradual drift across many bins over weeks", "Real covariate drift", "Check proxy labels by slice; schedule a validated retrain if quality is falling"],
              ["Inputs stable, proxy labels worsening", "Concept drift", "Tighten or retune the threshold; retrain on recent labelled data"],
              ["Predicted positive rate jumps, inputs stable", "Prior shift, or an attack", "Check base-rate sources; consider a temporary threshold change; involve domain owners"],
              ["One slice degrades, aggregate flat", "New segment or locale-specific change", "Route the slice to a fallback; investigate its features"],
              ["Serving features differ from training for the same entity", "Training-serving skew", "Diff the two implementations; fix the transform, then re-evaluate"]
            ]
          },
          { t: "h", text: "Mitigations, ordered by speed" },
          {
            t: "table",
            headers: ["Mitigation", "Time to apply", "Use when", "Cost"],
            rows: [
              ["Alias rollback to the previous version", "Seconds", "A release caused it", "Lose the new model's gains"],
              ["Fallback model or heuristic", "Seconds, via kill switch", "The model itself cannot be trusted right now", "Lower quality, but bounded and understood"],
              ["Threshold adjustment", "Minutes, via config", "Score distribution moved but ranking is still sound", "Precision/recall trade-off shifts; must be revisited"],
              ["Feature kill or imputation", "Minutes", "One feature is broken upstream", "Model runs on less signal; check it was trained to tolerate missing values"],
              ["Retrain", "Hours to days", "Real, persistent change confirmed", "Full gate and rollout cycle — never the first move"]
            ]
          },
          { t: "h", text: "Severity and ownership" },
          {
            t: "table",
            headers: ["Level", "Example", "Response"],
            rows: [
              ["SEV1", "Model blocking legitimate payments at scale; harmful content passing unfiltered", "Page immediately; mitigate within minutes; incident lead assigned"],
              ["SEV2", "Major drift with proxy labels worsening on an important slice", "Page in business hours, or immediately if revenue-critical; mitigate same day"],
              ["SEV3", "Moderate drift, no quality signal yet", "Ticket to the owning team; review in the next triage meeting"]
            ]
          },
          { t: "p", html: "Ownership must be written into the registry before launch: who is paged for the model, who owns each upstream feature, and who may move the production alias. A model incident that needs three teams and has no named owner is a model incident that lasts all night." },
          { t: "h", text: "How this scores at each level" },
          {
            t: "table",
            headers: ["Level", "What the answer needs"],
            rows: [
              ["Mid", "Names drift monitoring and rollback; knows that a retrain is not the first response"],
              ["Senior", "Separates pipeline bugs from real shifts with concrete signals; lists mitigations by speed; ties severity to business impact"],
              ["Staff", "Designs the playbook into the system up front: aliases, fallbacks, kill switches, per-feature ownership, retraining vetoes — and makes detection delay a reviewed metric"]
            ]
          },
          { t: "cue", html: "When the interviewer asks 'your model's metrics just dropped — what do you do?', answer with the sequence, not a guess: <em>\"Triage bug versus world first — step or slope, deploy-aligned or not, one value or many bins. Mitigate by rollback, fallback or threshold before anything else; retrain only once the data is validated.\"</em>" },
          { t: "note", variant: "key", html: "<strong>Triage before you treat.</strong> Decide pipeline bug or real-world shift from the shape of the change, mitigate with the fastest reversible lever — alias rollback, fallback, threshold, feature kill — and only then fix and retrain, through the same gates as any other release." },
          { t: "quiz", id: "ops-monitoring" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ops = {
    id: "ops",
    name: "MLOps",
    short: "Ops",
    tagline: "Shipping a model is the start of its life, not the end",
    color: "#fb923c",
    blurb: "The operational half of classical machine learning, taught as mechanics rather than buzzwords. Start with delivery: a registry that versions every model with its data snapshot and turns rollback into moving a pointer, CI/CD that tests code, data and model as three separate axes of change, and packaging that ships the exact function you evaluated. Then inference: choosing batch, online or streaming by when the inputs exist, climbing a rollout ladder from shadow to canary with halt criteria written in advance, and doing the latency-budget and cost-per-prediction arithmetic out loud. Close with monitoring and response: the four kinds of drift and the statistics that detect them, retraining driven by a measured decay curve, and an incident playbook that triages pipeline bug versus real-world shift before anyone retrains. LLM operations live in Lumen, general reliability practice in Beacon, and data pipelines in Cascade.",
    modules: [MOD_DELIVERY, MOD_INFERENCE, MOD_MONITORING]
  };
})();
