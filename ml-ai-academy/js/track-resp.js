/* =====================================================================
   SYNAPSE · Responsible ML
   window.TRACKS.resp — modules: fairness / explain / governance

   Self-contained: this file registers its own widget, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   Classical ML scope. LLM-specific safety material lives in Lumen.
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

  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  var Widgets = {};

  /* ==================================================================
     1. respFairness — "One threshold, two groups"
     Deterministic: 30 hard-coded [score, label] pairs per group.
     Group A base rate 12/30 = 40%; group B base rate 6/30 = 20%.
     No score sits on a 0.05 grid point, so ">= threshold" is unambiguous.
  ================================================================== */
  var FAIR_A = [
    [0.92, 1], [0.86, 1], [0.81, 1], [0.77, 1], [0.72, 1], [0.66, 1],
    [0.61, 1], [0.57, 1], [0.52, 1], [0.44, 1], [0.38, 1], [0.27, 1],
    [0.71, 0], [0.63, 0], [0.56, 0], [0.48, 0], [0.43, 0], [0.39, 0],
    [0.34, 0], [0.31, 0], [0.28, 0], [0.24, 0], [0.21, 0], [0.18, 0],
    [0.14, 0], [0.12, 0], [0.09, 0], [0.07, 0], [0.04, 0], [0.02, 0]
  ];
  var FAIR_B = [
    [0.83, 1], [0.69, 1], [0.58, 1], [0.47, 1], [0.36, 1], [0.22, 1],
    [0.62, 0], [0.53, 0], [0.46, 0], [0.41, 0], [0.37, 0], [0.33, 0],
    [0.29, 0], [0.26, 0], [0.23, 0], [0.19, 0], [0.17, 0], [0.16, 0],
    [0.13, 0], [0.11, 0], [0.08, 0], [0.06, 0], [0.06, 0], [0.04, 0],
    [0.03, 0], [0.03, 0], [0.02, 0], [0.01, 0], [0.01, 0], [0.12, 0]
  ];
  var FAIR_TOL = 0.05;

  function fairStats(data, t) {
    var tp = 0, fp = 0, fn = 0, tn = 0, i, sel;
    for (i = 0; i < data.length; i++) {
      sel = data[i][0] >= t - 1e-9;
      if (data[i][1] === 1) { if (sel) tp++; else fn++; }
      else { if (sel) fp++; else tn++; }
    }
    var n = tp + fp + fn + tn;
    return {
      tp: tp, fp: fp, fn: fn, tn: tn, n: n,
      base: n ? (tp + fn) / n : 0,
      sel: n ? (tp + fp) / n : 0,
      tpr: (tp + fn) ? tp / (tp + fn) : 0,
      fpr: (fp + tn) ? fp / (fp + tn) : 0,
      prec: (tp + fp) ? tp / (tp + fp) : null
    };
  }

  function pct(x) { return x == null ? "undefined" : Math.round(x * 100) + "%"; }
  function gapOf(a, b) { return (a == null || b == null) ? null : Math.abs(a - b); }
  function gapText(g) { return g == null ? "undefined" : (g * 100).toFixed(1) + " pts"; }
  function fmtT(t) { return t.toFixed(2); }

  function fairStrip(data, t) {
    var W = 560, H = 80, L = 20, R = 540;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", style: "display:block;max-width:100%" });
    function xOf(s) { return L + s * (R - L); }
    svg.appendChild(svgEl("line", { x1: L, y1: 62, x2: R, y2: 62, style: "stroke:var(--line-strong);stroke-width:1" }));
    var ticks = [0, 0.25, 0.5, 0.75, 1];
    for (var k = 0; k < ticks.length; k++) {
      var tx = svgEl("text", { x: xOf(ticks[k]), y: 76, "text-anchor": "middle", style: "fill:var(--text-dim);font-size:11px" });
      tx.textContent = String(ticks[k]);
      svg.appendChild(tx);
    }
    var pi = 0, ni = 0;
    for (var i = 0; i < data.length; i++) {
      var s = data[i][0], pos = data[i][1] === 1, sel = s >= t - 1e-9;
      var y = pos ? (pi++ % 2 ? 30 : 22) : (ni++ % 2 ? 52 : 44);
      var col = pos ? "var(--lime)" : "var(--rose)";
      svg.appendChild(svgEl("circle", {
        cx: xOf(s).toFixed(1), cy: y, r: 4.5,
        style: sel ? "fill:" + col + ";stroke:" + col + ";stroke-width:1.5" : "fill:none;stroke:" + col + ";stroke-width:1.5"
      }));
    }
    var lx = xOf(t);
    svg.appendChild(svgEl("line", { x1: lx, y1: 14, x2: lx, y2: 62, style: "stroke:var(--amber);stroke-width:2" }));
    var lab = svgEl("text", { x: lx + 4, y: 12, style: "fill:var(--text);font-size:11px" });
    lab.textContent = "t = " + fmtT(t);
    svg.appendChild(lab);
    return svg;
  }

  function fairVerdict(dp, eo, pp, mode) {
    var ok = [], bad = [];
    (dp != null && dp <= FAIR_TOL ? ok : bad).push("demographic parity");
    (eo != null && eo <= FAIR_TOL ? ok : bad).push("equal opportunity");
    (pp != null && pp <= FAIR_TOL ? ok : bad).push("predictive parity");
    var head;
    if (pp == null) {
      head = "Precision is undefined for a group that selects nobody, so predictive parity cannot even be assessed — a reminder that a threshold extreme enough to empty a group is not a fairness fix.";
    } else if (!ok.length) {
      head = "No criterion is within 5 points: every gap is open at once.";
    } else if (!bad.length) {
      head = "All three gaps sit inside 5 points here, which only happens at near-degenerate thresholds on this data — check how few people are being selected.";
    } else {
      head = "Within 5 points: " + ok.join(" and ") + ". Still open: " + bad.join(" and ") + ".";
    }
    var tail = " Base rates are 40% in A and 20% in B, so short of a perfect classifier you generally cannot close all three gaps together — closing one tends to open another.";
    var hint = mode === "single"
      ? " One shared threshold treats every score identically, which leaves the selection-rate gap wide because A's scores sit higher. Switch to per-group thresholds to trade one gap for another."
      : " Try A 0.55 with B 0.45 to equalize true positive rates, or A 0.55 with B 0.30 to equalize selection rates, and watch the precision gap widen either way.";
    return head + tail + hint;
  }

  Widgets.respFairness = function (mount) {
    shell(mount, "fairness lab", "One threshold, two groups",
      "Thirty scored examples per group, fixed and identical every time. Group A is 40% positive, group B is 20% positive. Move the thresholds and watch which fairness gap closes — and which one opens.");

    var mode = "single";
    var tA = 0.5, tB = 0.5;

    function mkSlider(val) {
      return h("input", { type: "range", min: "0.05", max: "0.95", step: "0.05", value: String(val) });
    }
    var sA = mkSlider(tA), sB = mkSlider(tB);
    var vA = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink);margin-left:6px" }, fmtT(tA));
    var vB = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink);margin-left:6px" }, fmtT(tB));
    var modeNote = h("span", { style: "font-size:0.8rem;color:var(--text-dim)" }, "");

    function readSlider(el) {
      var v = Math.round(parseFloat(el.value) * 100) / 100;
      if (!(v >= 0.05)) v = 0.05;
      if (v > 0.95) v = 0.95;
      return v;
    }

    sA.addEventListener("input", function () {
      tA = readSlider(sA);
      if (mode === "single") { tB = tA; sB.value = String(tB); }
      paint();
    });
    sB.addEventListener("input", function () {
      tB = readSlider(sB);
      if (mode === "single") { tA = tB; sA.value = String(tA); }
      paint();
    });

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function row(cells, head) {
      var r = h("div", {
        style: "display:grid;grid-template-columns:minmax(110px,1.3fr) repeat(3,minmax(70px,1fr));gap:10px;padding:5px 0;border-bottom:1px solid var(--line-strong)"
      });
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        r.appendChild(h("span", {
          style: "font-size:0.84rem;" + (i ? "font-family:var(--font-mono);" : "") +
            "color:" + (head ? "var(--text-dim)" : (c.color || "var(--text)"))
        }, c.text));
      }
      return r;
    }

    function gapCell(g) {
      if (g == null) return { text: "undefined", color: "var(--text-dim)" };
      return { text: gapText(g), color: g <= FAIR_TOL ? "var(--lime-ink)" : "var(--rose-ink)" };
    }

    function paint() {
      vA.textContent = fmtT(tA);
      vB.textContent = fmtT(tB);
      modeNote.textContent = mode === "single"
        ? "Single threshold: the two sliders move together."
        : "Per-group thresholds: each slider is independent.";

      var a = fairStats(FAIR_A, tA), b = fairStats(FAIR_B, tB);
      var dp = gapOf(a.sel, b.sel), eo = gapOf(a.tpr, b.tpr), pp = gapOf(a.prec, b.prec), fg = gapOf(a.fpr, b.fpr);
      var acc = (a.tp + a.tn + b.tp + b.tn) / (a.n + b.n);

      clear(stage);
      stage.appendChild(h("div", { style: "font-size:0.8rem;color:var(--text-dim);margin-bottom:2px" }, "Group A — threshold " + fmtT(tA)));
      stage.appendChild(fairStrip(FAIR_A, tA));
      stage.appendChild(h("div", { style: "font-size:0.8rem;color:var(--text-dim);margin:8px 0 2px" }, "Group B — threshold " + fmtT(tB)));
      stage.appendChild(fairStrip(FAIR_B, tB));
      stage.appendChild(h("p", { style: "font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin:6px 0 10px" },
        "Upper row: actual positives (lime). Lower row: actual negatives (rose). Filled = selected (score at or above the threshold); hollow = not selected."));

      var tbl = h("div", { style: "margin-top:4px" });
      tbl.appendChild(row([{ text: "Metric" }, { text: "Group A" }, { text: "Group B" }, { text: "Gap" }], true));
      tbl.appendChild(row([{ text: "Base rate" }, { text: pct(a.base) }, { text: pct(b.base) }, { text: gapText(gapOf(a.base, b.base)), color: "var(--text-dim)" }]));
      tbl.appendChild(row([{ text: "Selection rate" }, { text: pct(a.sel) }, { text: pct(b.sel) }, gapCell(dp)]));
      tbl.appendChild(row([{ text: "TPR (recall)" }, { text: pct(a.tpr) }, { text: pct(b.tpr) }, gapCell(eo)]));
      tbl.appendChild(row([{ text: "FPR" }, { text: pct(a.fpr) }, { text: pct(b.fpr) }, gapCell(fg)]));
      tbl.appendChild(row([{ text: "Precision" }, { text: pct(a.prec) }, { text: pct(b.prec) }, gapCell(pp)]));
      tbl.appendChild(row([{ text: "Selected / 30" }, { text: String(a.tp + a.fp) }, { text: String(b.tp + b.fp) }, { text: "", color: "var(--text-dim)" }]));
      stage.appendChild(tbl);

      clear(readout);
      readout.appendChild(ro("demographic parity gap", gapText(dp)));
      readout.appendChild(ro("equal opportunity gap", gapText(eo)));
      readout.appendChild(ro("predictive parity gap", gapText(pp)));
      readout.appendChild(ro("overall accuracy", pct(acc)));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, fairVerdict(dp, eo, pp, mode)));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["single", "Single threshold"], ["split", "Per-group thresholds"]], 0, function (v) {
        mode = v;
        if (mode === "single") { tB = tA; sB.value = String(tB); }
        paint();
      }),
      h("label", { class: "w-field" }, "Group A threshold ", sA, vA),
      h("label", { class: "w-field" }, "Group B threshold ", sB, vB),
      modeNote
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     2. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "resp-fairness": {
      title: "Fairness checkpoint",
      sub: "Group metrics, the impossibility result, where bias enters, and what each mitigation actually moves.",
      questions: [
        {
          q: "Two groups have different base rates and your classifier is good but not perfect. Which statement is true?",
          options: [
            "A carefully tuned single threshold can satisfy demographic parity, equal opportunity and predictive parity together",
            "Only demographic parity conflicts with accuracy; the other two criteria always coexist",
            "Equal TPR, equal FPR and equal precision cannot all hold at once, so you must choose which gap to close",
            "The conflict disappears once the protected attribute is removed from the feature set"
          ],
          answer: 2,
          explain: "When base rates differ, the error rates and the precision of a group are tied together by an identity: fix two of them and the third is determined by the base rate. So an imperfect classifier cannot equalize TPR, FPR and precision across both groups simultaneously. The practical consequence is that choosing a fairness definition is a decision about which harm matters most, not a tuning problem."
        },
        {
          q: "A team proposes to make a credit model fair by deleting the gender and ethnicity columns. What is the main weakness?",
          options: [
            "Proxies such as postcode or shopping history can reconstruct the attribute, and you lose the ability to measure gaps",
            "Gradient-boosted models refuse to train when demographic columns are missing from the schema",
            "Deleting the columns always increases the demographic parity gap by exactly the base-rate difference",
            "Most regulators require protected attributes to be direct inputs to every credit model"
          ],
          answer: 0,
          explain: "Removing a column does not remove the information: correlated features let the model rebuild the attribute almost for free. Worse, if the attribute is gone from the whole pipeline you can no longer compute per-group metrics, so you cannot tell whether the gap shrank. Keep the attribute for evaluation even when it is excluded from the model's inputs."
        },
        {
          q: "In a lending model, the harm stakeholders care about most is creditworthy applicants being wrongly declined. Which criterion targets that harm directly?",
          options: [
            "Demographic parity — equal approval rates across groups",
            "Predictive parity — equal precision among those approved",
            "Individual fairness under a learned similarity metric",
            "Equal opportunity — equal true positive rate among the creditworthy"
          ],
          answer: 3,
          explain: "A wrongly declined creditworthy applicant is a false negative among actual positives, and equal opportunity equalizes exactly that: the share of qualified people in each group who get approved. Demographic parity ignores qualification entirely, and predictive parity looks at the approved population rather than the qualified one. Start from the harm, then pick the metric that counts it."
        },
        {
          q: "You reweigh training data with weight P(group) x P(label) / P(group, label). Groups are equal size; A is 40% positive, B is 20% positive, so 30% overall. What weight does a positive example in group B get?",
          options: ["0.75", "1.5", "0.875", "2.0"],
          answer: 1,
          explain: "P(B) is 0.5 and P(positive) is 0.3, so the numerator is 0.15. P(B and positive) is 0.5 x 0.2 = 0.10. The weight is 0.15 / 0.10 = 1.5, which up-weights the under-represented positives in B so that, in the weighted data, label and group look statistically independent."
        },
        {
          q: "You fix a selection-rate gap by giving each group its own decision threshold. What is the main caveat?",
          options: [
            "Thresholds cannot move any fairness metric, because the model's scores stay exactly the same",
            "Every threshold change requires a full retrain of the model before it can take effect",
            "Group-specific thresholds only work for neural networks, not for tree ensembles",
            "It needs the group attribute at decision time, which some domains restrict, and it moves errors rather than removing them"
          ],
          answer: 3,
          explain: "Post-processing is cheap and transparent, but it changes who absorbs the errors rather than making the model better at telling the classes apart. It also requires knowing each person's group when the decision is made, which some settings treat as explicit differential treatment. That is a question for your legal and policy partners, and you should raise it before shipping rather than after."
        },
        {
          q: "At launch the equal-opportunity gap was 2 points. Six months later it is 9 points, while overall AUC has not moved. What is the most likely explanation and the right response?",
          options: [
            "Statistical noise; a stable overall AUC proves the model is still behaving fairly",
            "The protected attribute column was renamed upstream and the dashboard is reading nulls",
            "One group's distribution drifted or a feedback loop shifted it; monitor per-group metrics on a schedule with alerts",
            "Fairness metrics decay on a fixed schedule and simply need yearly recalibration"
          ],
          answer: 2,
          explain: "Aggregate metrics average over groups, so a deterioration in a minority slice can hide inside a flat overall number. Drift in one group's inputs, a policy change upstream, or the model's own decisions reshaping who applies are all common causes. Fairness is a monitored property with per-group alerts and an owner, not a launch checkbox."
        }
      ]
    },

    "resp-explain": {
      title: "Explainability checkpoint",
      sub: "Global versus local, importance pitfalls, Shapley credit, counterfactuals, and the documents that carry it all.",
      questions: [
        {
          q: "A SHAP explanation has base value 0.30, a +0.225 contribution from income and a -0.075 contribution from debt. What did the model predict?",
          options: ["0.60", "0.45", "0.375", "0.225"],
          answer: 1,
          explain: "Shapley explanations are additive: the base value plus the sum of the contributions equals the prediction. Here 0.30 + 0.225 - 0.075 = 0.45. If an explanation does not add up to the actual output, it is not a Shapley decomposition of that prediction."
        },
        {
          q: "A random forest's built-in impurity importance ranks a near-unique customer ID feature above every real signal. What is going on?",
          options: [
            "High-cardinality features are, by construction, always the most predictive ones in a forest",
            "Impurity importance is computed on held-out data, so the ID column must be leaking the label",
            "Random forests silently ignore categorical features and redistribute their importance",
            "Impurity importance favours features with many split points, even noise; check with permutation importance on held-out data"
          ],
          answer: 3,
          explain: "Impurity-based importance is accumulated on the training data, and a feature with many distinct values offers many candidate splits, so it can look useful purely by overfitting. Permutation importance measured on held-out data asks a better question — how much does performance drop when this feature's information is destroyed — and a noisy ID column usually falls to near zero."
        },
        {
          q: "Two features are 0.95 correlated. Permutation importance shows each of them as almost unimportant, yet dropping both hurts badly. Why?",
          options: [
            "Permuting one leaves its twin carrying the same signal, so neither looks essential alone",
            "Correlated features are detected and removed automatically by most training libraries",
            "Permutation importance is only valid for linear and logistic regression models",
            "The model must be badly underfit, which deflates every importance score equally"
          ],
          answer: 0,
          explain: "Permutation importance measures the damage from destroying one feature while the others stay intact. If a near-duplicate remains, the model barely notices. Group correlated features and permute them together, or report importance at the level of feature groups, before concluding that a signal does not matter."
        },
        {
          q: "An applicant has been declined for a loan and asks why. Which explanation serves them best?",
          options: [
            "The global feature importance ranking computed over the model's whole training set",
            "The full vector of SHAP values for all two hundred model inputs, unsorted",
            "A short list of reason codes plus the smallest actionable change that would have flipped the decision",
            "The model card's training data section, which describes where the examples came from"
          ],
          answer: 2,
          explain: "A person affected by a decision needs a local explanation phrased in terms they can act on. Reason codes name the top factors against them, and a counterfactual says what would have to change, restricted to things they can actually change. Global importance describes the model, not their case, and a raw attribution vector is unreadable."
        },
        {
          q: "In a churn model, SHAP shows that a high number of support calls strongly raises predicted churn. Product proposes making support harder to reach. What is wrong with that reasoning?",
          options: [
            "Explanations describe what the model associates with churn, not causes; calls may be a symptom of dissatisfaction",
            "SHAP values are only mathematically valid for tree-based models, not for this one",
            "A positive SHAP value means the feature lowers the prediction, so the plot was misread",
            "The plot needs more background samples before any reading of it is meaningful"
          ],
          answer: 0,
          explain: "Attribution methods explain the model's input-output behaviour; they say nothing about what happens in the world if you intervene on a feature. Unhappy customers call support and also churn, so suppressing calls removes the symptom while the cause remains. Causal claims need an experiment or a causal design, not a feature-attribution chart."
        },
        {
          q: "Which model card section is most often left out, and most dangerous to omit?",
          options: [
            "The full list of hyperparameters used in the final training run",
            "The type and count of accelerators the model was trained on",
            "The names and contact details of every engineer who touched it",
            "Out-of-scope uses and metrics broken down by slice"
          ],
          answer: 3,
          explain: "Reuse is where most documented harms come from: a model built for one population or decision gets repurposed for another. A card that states what the model must not be used for, and shows how performance varies across slices, is what lets the next team decide whether it fits. Hyperparameters and hardware belong in the experiment tracker."
        }
      ]
    },

    "resp-governance": {
      title: "Privacy and governance checkpoint",
      sub: "Minimization, re-identification, differential privacy, model risk tiers, oversight and incident response.",
      questions: [
        {
          q: "You release counts with the Laplace mechanism and tighten epsilon from 1.0 to 0.1. What happens?",
          options: [
            "Less noise is added and the privacy guarantee becomes weaker",
            "The noise is unchanged; only the privacy-budget accounting is different",
            "Noise is dropped for any count large enough to be statistically safe",
            "About ten times more noise is added, for a stronger privacy guarantee"
          ],
          answer: 3,
          explain: "For a counting query the noise scale is sensitivity divided by epsilon, so dividing epsilon by ten multiplies the noise by ten. Smaller epsilon means any one person's presence changes the output distribution less, which is the guarantee. The cost is accuracy, which is why small cohorts become unusable at strict budgets."
        },
        {
          q: "A team replaces user IDs with salted hashes and calls the dataset anonymized. How should it be classified?",
          options: [
            "Anonymized, because the original identifiers no longer appear anywhere in it",
            "Pseudonymized: records still link to one person, and quasi-identifiers can re-identify them",
            "Differentially private, since salting adds randomness to each identifier",
            "k-anonymous, with k equal to the number of distinct salts used"
          ],
          answer: 1,
          explain: "A stable hash is a new identifier: every row for the same person still joins together, and combinations like postcode, birth date and device can single that person out. That is pseudonymization, which reduces risk but usually leaves the data treated as personal. Anonymization requires that re-identification is no longer reasonably possible."
        },
        {
          q: "What does a membership inference attack try to learn?",
          options: [
            "The exact weights of a model, reconstructed purely from its public prediction API",
            "Which poisoned examples would most shift the model when added to training data",
            "Whether a specific record was in the training set, often from unusually confident outputs",
            "Which small input perturbation will force the model to emit a chosen output"
          ],
          answer: 2,
          explain: "Overfit models behave differently on examples they memorized — typically lower loss and higher confidence. An attacker who can query the model compares its behaviour on a target record against reference behaviour to guess whether that record was trained on. If membership itself is sensitive, such as being in a clinical dataset, that guess is a privacy leak."
        },
        {
          q: "Who should validate a model in the highest risk tier before it goes live?",
          options: [
            "A team independent of the builders, with the authority to block or condition the launch",
            "The building team, because they understand the model's assumptions best",
            "Any reviewer at all, provided the offline AUC clears the agreed threshold",
            "No human reviewer; automated CI checks on the training pipeline are sufficient"
          ],
          answer: 0,
          explain: "Builders share the model's blind spots, so validation by the same people mostly re-confirms their assumptions. Independent validation re-derives the evaluation, probes slices and failure modes, and has real authority to say no. Effort scales with the tier: low-risk models get lightweight checks, high-risk ones get this."
        },
        {
          q: "Reviewers in your human-in-the-loop queue agree with the model's recommendation 99% of the time. What is the best design response?",
          options: [
            "Remove the reviewers, since agreeing that often shows they add no value",
            "Raise the per-hour case quota so reviewers spend less time on each case",
            "Seed known-answer cases and audit samples to measure whether reviewers catch model errors",
            "Hide the model's score from reviewers in every case, permanently"
          ],
          answer: 2,
          explain: "High agreement can mean the model is excellent or that reviewers are rubber-stamping it, and the agreement rate alone cannot tell you which. Planted cases where the model is known to be wrong measure the reviewers' real catch rate. If it is low, you have automation bias, and the fixes include showing the score only after an independent judgement, shorter queues and feedback on missed cases."
        },
        {
          q: "After an upstream data change, a classifier starts issuing a burst of harmful denials. What should happen first?",
          options: [
            "Retrain immediately on the most recent data so the model adapts to the change",
            "Trip the kill switch or fall back to a safe policy, then investigate using the audit trail",
            "Wait for next week's fairness report to confirm that the pattern is real",
            "Add a disclaimer to the decision letters while the team investigates the cause"
          ],
          answer: 1,
          explain: "Incident response for a harmful model puts containment first: stop the harm with a pre-built fallback, such as a previous model version, a conservative rule or routing to human review. Then use the logged inputs, model version and decisions to find the cause and identify the affected people. Retraining on data that may itself be broken can make things worse."
        }
      ]
    }
  });

  /* ==================================================================
     3. Module: fairness
  ================================================================== */
  var MOD_FAIRNESS = {
    id: "fairness",
    name: "Fairness",
    icon: "diamond",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "fairness-definitions",
        title: "Fairness definitions and why they collide",
        summary: "Protected attributes and proxies, the four group metrics, individual fairness, the impossibility result in plain terms, and how to choose a definition from the harm.",
        minutes: 12,
        tags: ["fairness", "metrics", "ethics"],
        blocks: [
          { t: "p", html: "Every fairness conversation that goes in circles has the same cause: two people are using the word to mean different, mathematically incompatible things. This lesson gives you the vocabulary to name which one you mean, the arithmetic that shows why you cannot have them all, and a way to choose that starts from who gets hurt. Everything here builds on the <a href='#/found/metrics/confusion-matrix'>confusion matrix</a> — every group metric below is one of its cells, computed per group." },
          { t: "h", text: "Protected attributes and their proxies" },
          { t: "p", html: "A <strong>protected attribute</strong> is a characteristic on which unequal treatment is considered unacceptable for this decision — commonly things like sex, ethnicity, age, disability or religion, though the exact list depends on jurisdiction and domain. A <strong>proxy</strong> is any other feature that carries the same information: postcode, first name, shopping basket, device type, the school someone attended, gaps in employment history." },
          { t: "note", variant: "trap", html: "<strong>Deleting the protected column is not a fairness strategy.</strong> Proxies let a model reconstruct the attribute with little effort, so the gap typically survives. What you <em>do</em> lose is the ability to measure the gap at all. Keep the attribute available to the evaluation pipeline even when it is excluded from the model's inputs." },
          { t: "h", text: "Four group metrics, four different promises" },
          { t: "p", html: "Group fairness compares a statistic across groups. Each criterion below picks a different statistic, and each one encodes a different idea of what a fair outcome is." },
          {
            t: "table",
            headers: ["Criterion", "Equalize across groups", "Confusion-matrix form", "The promise it makes"],
            rows: [
              ["<strong>Demographic parity</strong>", "Selection rate", "(TP + FP) / N", "Each group receives the positive decision at the same rate, regardless of labels"],
              ["<strong>Equal opportunity</strong>", "True positive rate", "TP / (TP + FN)", "Qualified people in every group are approved at the same rate"],
              ["<strong>Equalized odds</strong>", "TPR <em>and</em> FPR", "TP / P and FP / N", "Both the qualified and the unqualified are treated alike across groups"],
              ["<strong>Predictive parity</strong>", "Precision (PPV)", "TP / (TP + FP)", "A positive decision means the same thing in every group"]
            ]
          },
          { t: "p", html: "A close cousin of predictive parity is <strong>calibration within groups</strong>: a score of 0.7 should correspond to roughly a 70% positive rate in <em>every</em> group, not just on average. If you have read the <a href='#/found/metrics/calibration'>calibration lesson</a>, this is the same reliability check, run once per group. Predictive parity is what calibration within groups implies at a fixed threshold." },
          { t: "h", text: "A worked example with two groups" },
          { t: "p", html: "A lender scores 1,000 applicants from each of two groups. In group A, 400 would repay (base rate 40%); in group B, 200 would (base rate 20%). One shared threshold produces these outcomes:" },
          {
            t: "code", lang: "text", code:
              "                 TP    FN    FP    TN   | select  TPR    FPR    precision\n" +
              "group A (40%)   320    80    40   560   |  36%    80%    6.7%    88.9%\n" +
              "group B (20%)   160    40    40   760   |  20%    80%    5.0%    80.0%\n" +
              "\n" +
              "equal opportunity gap   80% - 80%     =  0 pts   (satisfied)\n" +
              "demographic parity gap  36% - 20%     = 16 pts   (violated)\n" +
              "predictive parity gap   88.9% - 80%   = 8.9 pts  (violated)\n" +
              "FPR gap                 6.7% - 5.0%   = 1.7 pts  (close)"
          },
          { t: "p", html: "Now suppose a stakeholder demands demographic parity: group B must also be approved at 36%, i.e. 360 people. But only 200 people in B would repay, so at least 160 of those approvals are defaults. Precision in B can be <em>at most</em> 200 / 360 ≈ 56%. You closed one gap by blowing another wide open, and you approved people who will struggle to repay — which is itself a harm." },
          { t: "h", text: "The impossibility result, in plain terms" },
          { t: "p", html: "The example is not bad luck. Precision, TPR, FPR and the base rate are linked by an identity, so once the base rates differ you cannot pick all three error statistics freely:" },
          {
            t: "code", lang: "text", code:
              "FPR  =  p / (1 - p)  x  (1 - PPV) / PPV  x  TPR\n" +
              "\n" +
              "p   = base rate of the group\n" +
              "PPV = precision\n" +
              "\n" +
              "check, group A:  0.4/0.6 x 0.111/0.889 x 0.80  =  0.067   (6.7%)\n" +
              "if PPV and TPR are equal across groups but p differs,\n" +
              "FPR is forced to differ. Equalize any two, the third moves."
          },
          { t: "p", html: "The only escapes are a perfect classifier (no errors to distribute) or equal base rates. In practice you have neither, so the honest framing is: <strong>you will pick which gap to close and accept the others</strong>. Explore it below — the data is fixed, so the numbers are reproducible." },
          { t: "widget", id: "respFairness" },
          { t: "h", text: "Individual fairness" },
          { t: "p", html: "Group metrics can be satisfied while individuals are treated arbitrarily — approve the right <em>number</em> of people from each group and the right count hides a random choice of which ones. <strong>Individual fairness</strong> asks instead that similar people get similar outcomes. Its weak point is the word <em>similar</em>: someone has to define a task-relevant distance, and that definition carries all the value judgements the group metrics made explicit. It is most useful as a test — pairs of near-identical applications that differ only in a proxy should get near-identical scores." },
          { t: "h", text: "Choosing a definition from the harm" },
          {
            t: "table",
            headers: ["Tier", "How the definition is chosen", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "\"Make it fair\" — no definition stated", "Every later disagreement is about which metric was meant, and nobody can tell whether the work succeeded"],
              ["<strong>Solid</strong>", "Pick one metric that matches the dominant harm, set a tolerance, report the others", "Explicit, testable, and honest that the remaining gaps are a chosen cost"],
              ["<strong>Standout</strong>", "Start from who is harmed by which error, involve the affected stakeholders, then map the harm to a metric and a tolerance, with an owner and a review date", "The metric is a consequence of the harm analysis rather than a habit, and the decision survives an audit"]
            ]
          },
          {
            t: "ul", items: [
              "<strong>Missing out on a benefit is the harm</strong> (loans, jobs, scholarships): equal opportunity — qualified people should be approved at equal rates.",
              "<strong>Wrongful punitive action is the harm</strong> (fraud holds, account bans, extra scrutiny): equalize false positive rates — innocent people should be flagged at equal rates.",
              "<strong>The score is consumed as a probability</strong> (risk pricing, triage): calibration within groups, so a 0.7 means 0.7 for everyone.",
              "<strong>Representation itself is the goal</strong> (who is shown an opportunity at all): demographic parity, accepting that it ignores labels — which may be the point if the labels themselves are biased."
            ]
          },
          { t: "cue", html: "Reach for this vocabulary whenever a prompt involves decisions about people — credit, hiring, insurance, moderation, fraud, housing, healthcare triage — or the words <em>fair</em>, <em>biased</em>, <em>equitable</em> or <em>discriminate</em>. The sentence that earns credit: \"Base rates differ here, so I can't equalize everything; the harm that matters is X, so I'd hold the gap on Y within Z points and report the rest.\"" },
          { t: "note", variant: "key", html: "<strong>Fairness is a choice of which error to equalize, made from the harm, not a property you can maximize.</strong> With different base rates and an imperfect model, selection rate, error rates and precision cannot all match — so name the metric, set a tolerance, keep the protected attribute for measurement, and report the gaps you chose to leave open." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "bias-mitigation",
        title: "Where bias enters and what each fix moves",
        summary: "Sampling, label, measurement and feedback-loop bias; slice evaluation; pre-, in- and post-processing mitigations with their costs; and fairness as a monitored property.",
        minutes: 11,
        tags: ["fairness", "data", "monitoring"],
        blocks: [
          { t: "p", html: "The previous lesson was about measuring unfairness. This one is about where it comes from and what you can do about it. The short version: most bias arrives with the data, long before any model is trained, and every mitigation is a trade that moves error from one place to another. Name the trade out loud." },
          { t: "h", text: "Four doors bias walks through" },
          {
            t: "table",
            headers: ["Source", "Mechanism", "Concrete example"],
            rows: [
              ["<strong>Sampling</strong>", "Some groups are under-represented or represented by a skewed subset", "A skin-condition classifier trained mostly on lighter skin tones performs worse on darker ones"],
              ["<strong>Labels</strong>", "The target encodes past human decisions, not the ground truth you want", "\"Was hired\" as a label for \"good candidate\" reproduces whoever the past interviewers preferred"],
              ["<strong>Measurement</strong>", "A feature or label is recorded with different accuracy or meaning across groups", "Arrest counts as a proxy for offending, when policing intensity differs by neighbourhood"],
              ["<strong>Feedback loops</strong>", "The model's decisions shape the next round of training data", "Declined applicants never get a repayment label, so the model never learns it was wrong about them"]
            ]
          },
          { t: "p", html: "The feedback-loop door is the one specific to deployed ML. It is the selective-labels version of the spiral described in <a href='#/mlsd/serving/feedback-loops'>closing the loop without poisoning it</a>: you only observe outcomes for people the model approved, so its mistakes about the rejected are invisible and self-perpetuating. Ranking systems have the same problem with exposure — <a href='#/rank/dynamics/feedback-fairness'>feedback and fairness in ranking</a> covers the provider-side version, where creators who are never shown never accumulate the engagement that would get them shown." },
          { t: "note", variant: "warn", html: "<strong>A label that records a human decision is a model of that human, not of the world.</strong> If the historical decisions were biased, a highly accurate model is a highly accurate copy of the bias. No amount of in-processing fixes this — the fix is a better label, or explicitly treating the label as suspect in evaluation." },
          { t: "h", text: "Slice evaluation comes first" },
          { t: "p", html: "You cannot mitigate what you have not measured. Before choosing any intervention, break every headline metric down by group and by intersections of groups — gaps often hide at intersections that neither single attribute shows." },
          {
            t: "code", lang: "python", code:
              "import pandas as pd\n" +
              "\n" +
              "def slice_report(df, group_cols, threshold):\n" +
              "    df = df.assign(pred=(df.score >= threshold).astype(int))\n" +
              "    def stats(g):\n" +
              "        tp = ((g.pred == 1) & (g.label == 1)).sum()\n" +
              "        fp = ((g.pred == 1) & (g.label == 0)).sum()\n" +
              "        pos, neg = (g.label == 1).sum(), (g.label == 0).sum()\n" +
              "        return pd.Series({\n" +
              "            'n': len(g),\n" +
              "            'base_rate': pos / len(g),\n" +
              "            'selection': (tp + fp) / len(g),\n" +
              "            'tpr': tp / pos if pos else None,\n" +
              "            'fpr': fp / neg if neg else None,\n" +
              "            'precision': tp / (tp + fp) if tp + fp else None,\n" +
              "        })\n" +
              "    return df.groupby(group_cols).apply(stats)\n" +
              "\n" +
              "# slice_report(eval_df, ['sex'], 0.5)\n" +
              "# slice_report(eval_df, ['sex', 'age_band'], 0.5)   # intersections"
          },
          { t: "note", variant: "tip", html: "<strong>Report the slice size next to every slice metric.</strong> A TPR of 50% on 8 positives has a confidence interval wide enough to be meaningless. Small slices need bootstrapped intervals, a minimum-count rule before alerting, or aggregation over a longer window." },
          { t: "h", text: "Three places to intervene" },
          {
            t: "table",
            headers: ["Stage", "Technique", "What it moves", "What it costs"],
            rows: [
              ["<strong>Pre-processing</strong>", "Reweighing, resampling, collecting more data for thin groups, relabeling suspect labels", "The training distribution, so the model sees groups and outcomes in better balance", "Model-agnostic and auditable, but cannot fix a label that is wrong for everyone; resampling can overfit duplicated rows"],
              ["<strong>In-processing</strong>", "A fairness constraint or penalty in the loss — e.g. penalize the TPR gap during training", "The model's decision boundary directly, trading a little accuracy for a smaller gap", "Needs group labels at training time, couples the model to one metric, harder to explain and to tune"],
              ["<strong>Post-processing</strong>", "Group-specific thresholds or score adjustments chosen on a validation set", "Who sits above the cut-off in each group, with the model untouched", "Cheapest and most transparent, but needs the group at decision time and shifts errors rather than removing them"]
            ]
          },
          { t: "h2", text: "Reweighing, worked" },
          { t: "p", html: "Reweighing gives each (group, label) cell the weight that would make group and label statistically independent in the weighted data: <code class='tok'>w = P(group) x P(label) / P(group, label)</code>. With equal-sized groups, A at 40% positive and B at 20% positive (30% overall):" },
          {
            t: "code", lang: "text", code:
              "cell            P(g)  P(y)  P(g,y)   weight\n" +
              "A, positive     0.5   0.3   0.20     0.75\n" +
              "A, negative     0.5   0.7   0.30     1.17\n" +
              "B, positive     0.5   0.3   0.10     1.50\n" +
              "B, negative     0.5   0.7   0.40     0.875\n" +
              "\n" +
              "weighted positive rate, A:  0.20*0.75 / (0.20*0.75 + 0.30*1.17) = 0.30\n" +
              "weighted positive rate, B:  0.10*1.50 / (0.10*1.50 + 0.40*0.875) = 0.30"
          },
          { t: "p", html: "After weighting, both groups look 30% positive to the learner. Note what that does and does not mean: it pushes the model toward demographic parity on the training data, and it is a deliberate statement that the base-rate difference should not drive decisions. If the base-rate difference is real and relevant, that is a value judgement to make explicitly, not a side effect." },
          {
            t: "compare",
            bad: { title: "Mitigation as a one-off fix", items: ["Pick a technique because a library offers it", "Report one gap at launch, then stop measuring", "Treat the trade-off as an engineering detail"] },
            good: { title: "Mitigation as a stated trade", items: ["Pick the stage that matches the bias source — label problems are not solved by thresholds", "Report the accuracy cost and every other gap that moved", "Get sign-off on the trade from the people accountable for the decision"] }
          },
          { t: "note", variant: "warn", html: "<strong>Legal and policy caveats are real and domain-specific.</strong> In some regulated settings, using a protected attribute directly in a decision — including a group-specific threshold — can itself be treated as unequal treatment, while in others measuring and correcting disparities is expected. This lesson is not legal advice: raise the question with legal and policy partners before choosing post-processing, and document what was decided and why." },
          { t: "h", text: "Fairness is a monitored property" },
          { t: "p", html: "A gap that was 2 points at launch can be 9 points in six months while overall AUC stays flat, because aggregates average over groups. Group mix changes, an upstream feature drifts for one population, or the model's own decisions reshape who applies. Treat per-group metrics like any other production signal:" },
          {
            t: "ul", items: [
              "Compute the chosen fairness metric and its siblings per group on every labelled batch, with slice sizes and intervals.",
              "Alert when the chosen gap exceeds its tolerance for a sustained window, not on a single noisy day.",
              "Track the group mix of incoming traffic — a shift in who arrives can move gaps before any label does.",
              "Give the dashboard an owner and a review cadence; a metric nobody is accountable for is decoration."
            ]
          },
          { t: "cue", html: "When asked \"how would you make this fair?\", resist naming a technique first. Walk the order: which harm, which metric, where the bias likely entered (sampling, labels, measurement, feedback), then the cheapest intervention at that stage, its cost, and how you will monitor the gap after launch. Labels and feedback loops are the answers interviewers are hoping you will raise." },
          { t: "note", variant: "key", html: "<strong>Most bias arrives with the data, and every fix moves error rather than deleting it.</strong> Evaluate by slice first, intervene at the stage where the bias entered, state what the intervention costs in accuracy and in other gaps, check the policy constraints on using the attribute, and keep measuring after launch." },
          { t: "quiz", id: "resp-fairness" }
        ]
      }
    ]
  };

  /* ==================================================================
     4. Module: explain
  ================================================================== */
  var MOD_EXPLAIN = {
    id: "explain",
    name: "Explainability",
    icon: "compass",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "explainability",
        title: "Explaining a model without fooling yourself",
        summary: "Global versus local, interpretable versus post-hoc, importance pitfalls, permutation importance, partial dependence, Shapley values with a worked example, LIME, counterfactuals and reason codes.",
        minutes: 12,
        tags: ["explainability", "shap", "interpretability"],
        blocks: [
          { t: "p", html: "\"Can you explain the model?\" means at least three different questions depending on who asks. A regulator wants to know what the model relies on overall. A declined customer wants to know why <em>they</em> were declined and what to change. An engineer debugging a regression wants to know which feature started behaving oddly. Each needs a different tool, and each tool has a failure mode that produces confident nonsense." },
          { t: "h", text: "Two axes: scope and source" },
          {
            t: "table",
            headers: ["", "Global (the whole model)", "Local (one prediction)"],
            rows: [
              ["<strong>Intrinsic</strong> (the model is the explanation)", "Coefficients of a sparse linear model; the rules of a shallow tree; a scorecard", "The terms that fired for this row: \"+18 points for income band, -12 for utilization\""],
              ["<strong>Post-hoc</strong> (a separate method explains a black box)", "Permutation importance; partial dependence; mean absolute SHAP", "SHAP values for this row; a LIME surrogate; a counterfactual"]
            ]
          },
          { t: "p", html: "Intrinsically interpretable models — monotone-constrained gradient boosting, generalized additive models, scorecards — cost some accuracy on many problems, often less than people assume on tabular data. Post-hoc methods let you keep a black box but add an approximation layer that can itself be wrong. In high-stakes decisions, ask whether the accuracy gap of an interpretable model is actually large enough to justify that layer." },
          { t: "h", text: "Feature importance and its traps" },
          { t: "p", html: "The importance chart that comes free with a tree ensemble is usually <strong>impurity-based</strong>: how much each feature reduced the split criterion, summed over the training data. It has two well-known biases." },
          {
            t: "ul", items: [
              "<strong>Cardinality bias.</strong> Features with many distinct values offer many split points and can look important purely by fitting noise. A near-unique ID column can top the chart.",
              "<strong>Correlation splitting.</strong> When two features carry the same signal, credit is divided between them arbitrarily, so both can look modest while the signal they share is essential."
            ]
          },
          { t: "p", html: "<strong>Permutation importance</strong> asks a better question on held-out data: if I shuffle this column, destroying its relationship with the label, how much does the metric drop? It is model-agnostic and cheap to reason about:" },
          {
            t: "code", lang: "python", code:
              "import numpy as np\n" +
              "\n" +
              "def permutation_importance(model, X, y, metric, n_repeats=5, seed=0):\n" +
              "    rng = np.random.default_rng(seed)\n" +
              "    base = metric(y, model.predict_proba(X)[:, 1])\n" +
              "    out = {}\n" +
              "    for col in X.columns:\n" +
              "        drops = []\n" +
              "        for _ in range(n_repeats):\n" +
              "            Xp = X.copy()\n" +
              "            Xp[col] = rng.permutation(Xp[col].values)\n" +
              "            drops.append(base - metric(y, model.predict_proba(Xp)[:, 1]))\n" +
              "        out[col] = (np.mean(drops), np.std(drops))\n" +
              "    return out   # run on HELD-OUT data, never the training set"
          },
          { t: "note", variant: "trap", html: "<strong>Permutation importance still trips on correlated features.</strong> Shuffle one of two near-duplicates and the model leans on the other, so each looks unimportant alone. Permute correlated groups together, and shuffling also creates unrealistic rows (a 19-year-old with 30 years of credit history), so interpret large drops with that in mind." },
          { t: "p", html: "<strong>Partial dependence</strong> shows how the average prediction changes as one feature sweeps its range, holding the others at their observed values. It is the right picture for \"is the effect of income monotone?\" It averages away interactions — if the effect goes up for one segment and down for another, the average can be flat — so pair it with per-row curves (individual conditional expectation) when interactions are plausible." },
          { t: "h", text: "Shapley values: fair credit over coalitions" },
          { t: "p", html: "Shapley values come from cooperative game theory. Treat the features as players and the prediction as a payout. A feature's contribution is its <strong>average marginal effect over every order in which features could be added</strong>. That definition is the unique one satisfying a handful of fairness properties — most usefully <strong>additivity</strong>: the base value (the average prediction) plus the sum of all contributions equals this prediction exactly." },
          {
            t: "code", lang: "text", code:
              "two features: income (I) and debt (D)\n" +
              "model output when only some features are 'known':\n" +
              "  f({})      = 0.30   base value (average prediction)\n" +
              "  f({I})     = 0.50\n" +
              "  f({D})     = 0.20\n" +
              "  f({I, D})  = 0.45   the actual prediction\n" +
              "\n" +
              "order I then D:  I adds 0.50-0.30 = +0.20   D adds 0.45-0.50 = -0.05\n" +
              "order D then I:  D adds 0.20-0.30 = -0.10   I adds 0.45-0.20 = +0.25\n" +
              "\n" +
              "phi(I) = (0.20 + 0.25) / 2 = +0.225\n" +
              "phi(D) = (-0.05 - 0.10) / 2 = -0.075\n" +
              "\n" +
              "check: 0.30 + 0.225 - 0.075 = 0.45   (additivity holds)"
          },
          { t: "p", html: "With many features the number of orders explodes, so practical SHAP implementations approximate — exactly and quickly for tree ensembles, by sampling for arbitrary models. The other subtlety is what \"a feature is unknown\" means: it is filled in from a <strong>background dataset</strong>, and a different background gives a different base value and different contributions. State the background when you report SHAP." },
          { t: "h2", text: "LIME, briefly" },
          { t: "p", html: "LIME explains one prediction by perturbing that row many times, scoring the perturbations with the black box, and fitting a small weighted linear model in the neighbourhood. It is flexible and intuitive. Its weakness is stability: the explanation depends on how the neighbourhood is sampled and weighted, and two runs can disagree. Shapley-based methods trade more compute for the additivity guarantee." },
          { t: "h", text: "Counterfactuals and reason codes" },
          { t: "p", html: "The person on the receiving end of a decision rarely wants attributions. They want two things: <em>what counted against me</em> and <em>what would change the outcome</em>. That is a reason-code list plus a counterfactual — the smallest change to the input that flips the decision." },
          {
            t: "compare",
            bad: { title: "Explanation built for the builder", items: ["Full SHAP vector over 200 features", "Includes things the person cannot change (age, history)", "Counterfactual that says \"earn 40% more\""] },
            good: { title: "Explanation built for the affected person", items: ["Top three to four reason codes in plain language", "Counterfactual restricted to actionable, plausible changes", "Consistent with what the decision letter or adverse-action style notice must state"] }
          },
          { t: "note", variant: "warn", html: "<strong>Explanations are not causal.</strong> An attribution says what the model associates with the output, not what would happen if you intervened on the world. If \"many support calls\" pushes predicted churn up, making support harder to reach does not reduce churn — the calls were a symptom. Causal claims need an experiment or a causal design." },
          { t: "p", html: "For LLMs, explanation looks quite different — attribution over tokens, generated rationales that may not reflect the computation — and that material lives in <a href='../llm-academy/index.html'>Lumen</a>. Everything here assumes a classical model over structured features." },
          { t: "cue", html: "When an interviewer asks \"how would you explain this model?\", answer with a question: <em>to whom?</em> Then pick: global importance on held-out data for a reviewer, partial dependence for \"is this monotone?\", SHAP with a stated background for debugging a single row, and reason codes plus an actionable counterfactual for the affected person. Add, unprompted, that none of these are causal." },
          { t: "note", variant: "key", html: "<strong>Pick the explanation for the audience, and know how each one lies.</strong> Impurity importance flatters high-cardinality noise, permutation importance hides correlated twins, partial dependence averages away interactions, SHAP depends on its background — and none of them say what happens if you change the world." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "model-documentation",
        title: "Model cards, datasheets and decision logs",
        summary: "What a model card must say, the dataset datasheet that should travel with it, decision logs for the choices nobody will remember, and who actually reads each document.",
        minutes: 9,
        tags: ["documentation", "governance", "explainability"],
        blocks: [
          { t: "p", html: "Explanations describe a model's behaviour. Documentation describes its <em>intent</em>: what it was built for, what it was tested on, where it breaks, and what it must never be used for. Most documented harms from ML are not models doing something unexpected in their intended use — they are models reused for a purpose, population or decision they were never evaluated on. Documentation is the control against that." },
          { t: "h", text: "The model card" },
          { t: "p", html: "A model card is a short, structured document that ships with a model version. Short is the point — a twenty-page card is not read." },
          {
            t: "table",
            headers: ["Section", "What it must say", "What it looks like when done well"],
            rows: [
              ["<strong>Intended use</strong>", "The decision, the population, the deployment context", "\"Ranks credit-line-increase offers for existing customers with 6+ months of history, as one input to a human-reviewed decision\""],
              ["<strong>Out-of-scope use</strong>", "Uses that were not evaluated or are known to be unsafe", "\"Not for new-applicant underwriting; not for collections prioritization; not validated outside the original market\""],
              ["<strong>Metrics by slice</strong>", "Headline metrics broken down by group, region, tenure and other relevant slices, with sample sizes", "A table with PR-AUC, TPR at the operating threshold and calibration error per slice, plus the fairness gap and its tolerance"],
              ["<strong>Training data</strong>", "Source, time window, filters, label definition, known gaps", "\"Applications Jan 2023 to Jun 2025; label = 90-day delinquency; approved applicants only (selective labels)\""],
              ["<strong>Limitations and risks</strong>", "Known failure modes and the conditions under which they appear", "\"Under-predicts risk for thin-file customers; scores drift when bureau data is delayed\""],
              ["<strong>Ownership</strong>", "Owner, review date, escalation path, version", "A named team, a date, and a link to the registry entry"]
            ]
          },
          { t: "note", variant: "trap", html: "<strong>The section that gets skipped is the one that matters most.</strong> Out-of-scope uses and per-slice metrics are what let the next team decide whether the model fits their problem. Hyperparameters and hardware belong in the experiment tracker, not the card." },
          { t: "h", text: "Datasheets for datasets" },
          { t: "p", html: "A model inherits every property of its data, so the dataset deserves its own document. A datasheet answers: why was this collected, by whom, from whom, with what consent, over what period; how were labels produced and by whom; what is missing or under-represented; what preprocessing was applied; what uses are inappropriate; and how long it may be retained. Write it once per dataset and link every model card that trains on it." },
          {
            t: "code", lang: "text", code:
              "datasheet: credit_applications_v4\n" +
              "  motivation     : underwriting risk models, internal only\n" +
              "  collection     : application form + bureau pull, 2023-01..2025-06\n" +
              "  population     : applicants in market X; excludes business accounts\n" +
              "  labels         : 90-day delinquency, observed ONLY for approved apps\n" +
              "  known gaps     : thin-file applicants under-represented (~4% of rows)\n" +
              "  sensitive cols : age, sex (evaluation only; excluded from features)\n" +
              "  retention      : raw rows 24 months; aggregates indefinitely\n" +
              "  not for        : marketing targeting, employee screening"
          },
          { t: "h", text: "Decision logs" },
          { t: "p", html: "The choices that matter most are the ones nobody will remember in a year: why this fairness metric, why this tolerance, why this threshold, why the protected attribute was or was not used in post-processing, which slice was accepted as a known limitation. A decision log is an append-only list of those choices with date, decision, alternatives considered, rationale and who signed off. When an auditor or a new owner asks \"why is it like this?\", the log is the only answer that is not a guess." },
          {
            t: "compare",
            bad: { title: "Documentation as launch paperwork", items: ["Written once, the week before launch", "Lives in a wiki page nobody links to", "Describes v1 while v7 is serving"] },
            good: { title: "Documentation as part of the artifact", items: ["Generated partly from the evaluation pipeline, so slice metrics are never stale", "Versioned with the model in the registry", "A required field in the approval gate — no card, no promotion"] }
          },
          { t: "h", text: "Who reads them" },
          {
            t: "table",
            headers: ["Reader", "What they look for", "Document"],
            rows: [
              ["Another team considering reuse", "Intended and out-of-scope use, slice metrics", "Model card"],
              ["Model validator or review board", "Evaluation design, limitations, fairness choices", "Model card + decision log"],
              ["Privacy and legal partners", "Consent, retention, sensitive fields", "Datasheet"],
              ["On-call engineer during an incident", "Known failure modes, fallback, owner", "Model card limitations + ownership"],
              ["Future you", "Why a threshold or metric was chosen", "Decision log"]
            ]
          },
          { t: "note", variant: "tip", html: "<strong>Automate the parts that go stale.</strong> Slice metrics, training window and data versions can be written into the card by the evaluation job and stored alongside the model in the <a href='#/ops/delivery/model-registry'>model registry</a>. Humans then only maintain the parts that need judgement: intended use, out-of-scope use and limitations." },
          { t: "cue", html: "Bring up documentation whenever a prompt mentions reuse (\"other teams want to use this score\"), regulated decisions, audits, or a model that has been around for years. The line that lands: \"The card states what this model must not be used for and shows metrics by slice, and promotion in the registry is blocked without it.\"" },
          { t: "note", variant: "key", html: "<strong>Most ML harm comes from reuse outside the evaluated scope, and documentation is the control.</strong> A short model card with out-of-scope uses and per-slice metrics, a datasheet for the data it inherits, and a decision log for the choices nobody will remember — versioned with the model and required at the approval gate." },
          { t: "quiz", id: "resp-explain" }
        ]
      }
    ]
  };

  /* ==================================================================
     5. Module: governance
  ================================================================== */
  var MOD_GOVERNANCE = {
    id: "governance",
    name: "Privacy & governance",
    icon: "shield",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "privacy-ml",
        title: "Privacy in ML systems",
        summary: "Minimization and retention, pseudonymization versus anonymization, k-anonymity, differential privacy and DP-SGD, federated learning, model-level attacks, and why deletion is hard once a model has learned.",
        minutes: 12,
        tags: ["privacy", "differential-privacy", "security"],
        blocks: [
          { t: "p", html: "Privacy in ML has two layers. The first is the ordinary data-protection layer — collect less, keep it shorter, restrict who sees it. The second is specific to ML: a trained model is a compressed summary of its training data, and a summary can leak. A design that only handles the first layer has handled the easy half." },
          { t: "h", text: "Collect less, for a reason, for a while" },
          {
            t: "ul", items: [
              "<strong>Data minimization.</strong> Every feature needs a reason. A field that adds 0.1 points of AUC and is sensitive may not be worth holding — and you can measure that with an ablation before deciding.",
              "<strong>Purpose limitation.</strong> Data collected for fraud prevention is not automatically available for marketing models. Record the purpose in the datasheet and enforce it in access control, not in a policy document.",
              "<strong>Retention.</strong> Raw rows get a time limit; aggregates and trained models may live longer. Decide which, write it down, and build the deletion job before the data accumulates."
            ]
          },
          { t: "h", text: "Pseudonymized is not anonymized" },
          { t: "p", html: "<strong>Pseudonymization</strong> replaces direct identifiers with tokens — a salted hash of the user ID, say. Every row for the same person still links together, so the data is still about that person. <strong>Anonymization</strong> means re-identification is no longer reasonably possible, which is a much higher bar. The gap between them is <strong>quasi-identifiers</strong>: fields that are harmless alone but identifying in combination. Postcode, birth date and sex together single out a large fraction of people in many populations." },
          { t: "note", variant: "trap", html: "<strong>\"We hashed the IDs\" is the most common false claim of anonymity.</strong> A stable hash is a new identifier, and joining on quasi-identifiers or on external data re-identifies people. Treat hashed data as personal data unless someone has analysed the re-identification risk." },
          { t: "p", html: "<strong>k-anonymity</strong> is a classic attempt to quantify this: generalize or suppress quasi-identifiers until every record is indistinguishable from at least k-1 others. It is easy to explain and weak in practice — if all k people in a group share the same sensitive value, the group reveals it, and with many columns the generalization needed destroys most of the data's usefulness." },
          { t: "h", text: "Differential privacy, by intuition" },
          { t: "p", html: "Differential privacy (DP) makes a promise about a <em>process</em>, not a dataset: the output distribution barely changes whether or not any one person's data was included. \"Barely\" is set by <strong>epsilon</strong> (ε) — smaller ε, stronger promise. The usual mechanism is calibrated noise. For a count, adding or removing one person changes the answer by at most 1 (the sensitivity), and Laplace noise with scale <code class='tok'>sensitivity / ε</code> gives ε-DP." },
          {
            t: "code", lang: "text", code:
              "true count of patients with condition X in a cohort: 50\n" +
              "sensitivity of a count: 1\n" +
              "\n" +
              "epsilon   noise scale b   std dev (~1.41 b)   typical released value\n" +
              "  1.0        1             ~1.4                48 .. 52\n" +
              "  0.1       10             ~14                 25 .. 75\n" +
              "  0.01     100             ~141                meaningless\n" +
              "\n" +
              "the noise does not depend on cohort size:\n" +
              "a count of 50,000 at epsilon 0.1 is still +/- ~14  (fine)\n" +
              "a count of 50 at epsilon 0.1 is +/- ~14           (useless)"
          },
          { t: "p", html: "That last pair is the whole trade-off: DP is cheap for large aggregates and expensive for small ones. Two more facts matter in design. Budgets <strong>compose</strong> — answering many queries spends ε each time, so a system needs a budget and an accountant. And DP protects against any attacker, including one with unlimited side information, which is what makes it stronger than k-anonymity." },
          { t: "h2", text: "DP-SGD: training with a privacy budget" },
          { t: "p", html: "To train a model with DP, the standard approach clips each example's gradient to a maximum norm (bounding any one person's influence, i.e. the sensitivity), adds Gaussian noise to the summed gradients at each step, and tracks the privacy spent across all steps. The costs are real: lower accuracy, especially for under-represented groups whose signal is closest to the noise floor; slower training, because per-example gradients are expensive; and more hyperparameters to tune." },
          { t: "note", variant: "warn", html: "<strong>DP can worsen fairness.</strong> Clipping and noise hurt rare patterns most, and minority groups are often rare patterns. If you adopt DP-SGD, re-run the slice evaluation from the <a href='#/resp/fairness/bias-mitigation'>bias mitigation lesson</a> — the privacy gain may come out of one group's accuracy." },
          { t: "h", text: "Federated and on-device training" },
          { t: "p", html: "Federated learning keeps raw data on users' devices: each device computes an update on its local data, and only updates are sent to a server that aggregates them. It reduces what is centrally collected, but updates can still leak information, so production systems pair it with secure aggregation (the server sees only the sum) and often with DP noise. It also adds hard engineering: devices are intermittently available, data is non-identically distributed across devices, and debugging a model you cannot inspect the data for is slow." },
          { t: "h", text: "Attacks on the model itself" },
          {
            t: "table",
            headers: ["Attack", "What the attacker learns", "Main mitigations"],
            rows: [
              ["<strong>Membership inference</strong>", "Whether a specific record was in the training set — overfit models are more confident on examples they memorized", "Regularization and less overfitting; DP training; return labels or coarse scores rather than full probabilities"],
              ["<strong>Model inversion / attribute inference</strong>", "Sensitive attributes of training records, reconstructed from outputs and partial inputs", "Limit output detail; rate-limit and monitor queries; DP training; avoid training on attributes you could not justify exposing"],
              ["<strong>Model extraction</strong>", "A functional copy of the model, which then enables the attacks above offline", "Query budgets, anomaly detection on query patterns, coarse outputs"]
            ]
          },
          { t: "h", text: "Deletion and machine unlearning" },
          { t: "p", html: "When someone exercises a right to deletion, removing their rows from the warehouse is the easy part. Their data also lives in features derived from it, in cached training sets, in embeddings, and in the weights of every model trained since. Exact <strong>machine unlearning</strong> — producing the model you would have had without them — generally means retraining. Practical approaches: retrain on a regular cadence from deletion-filtered data and document the maximum lag; shard training so only the affected shard is retrained; and lean on DP, whose guarantee bounds how much any one person could have influenced the model in the first place." },
          { t: "cue", html: "Raise privacy whenever the prompt involves health, finance, children, location, messages or anything a user would be upset to see leaked. The strong answer covers both layers: minimization, purpose and retention for the data, then \"the model is also a summary of the data\" — membership inference, coarse outputs, and how deletion reaches the weights." },
          { t: "note", variant: "key", html: "<strong>A trained model is a summary of its data, and summaries leak.</strong> Minimize and time-limit the data, treat hashed IDs as personal, use differential privacy where aggregates are large enough to absorb the noise, and have a stated answer for how a deletion request eventually reaches the model's weights." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "model-governance",
        title: "Model governance that people actually follow",
        summary: "Risk tiers, an inventory of models, approval gates, validation independent of the builders, audit trails, and how regulatory pressure shapes the process — in general terms.",
        minutes: 10,
        tags: ["governance", "risk", "mlops"],
        blocks: [
          { t: "p", html: "Governance has a bad reputation because it is usually implemented as a meeting everyone dreads, applied identically to a spam filter and to a credit model. Done well it is the opposite: proportionate, mostly automated, and built into the same pipeline that ships the model, so the compliant path is also the fastest one." },
          { t: "h", text: "Start with an inventory" },
          { t: "p", html: "You cannot govern models you do not know exist. The inventory lists every model in production — including spreadsheets and rules engines that make consequential decisions — with an owner, purpose, risk tier, data sources, downstream consumers and last review date. In practice the inventory is the <a href='#/ops/delivery/model-registry'>model registry</a> with a few extra required fields, not a separate spreadsheet that drifts out of date." },
          { t: "h", text: "Tier by risk, not by technique" },
          {
            t: "table",
            headers: ["Tier", "Typical examples", "Required before launch", "Ongoing"],
            rows: [
              ["<strong>Low</strong>", "Internal forecasting, search autocomplete, content tagging", "Model card, automated tests, owner on record", "Standard drift monitoring"],
              ["<strong>Medium</strong>", "Recommendations, marketing propensity, support routing", "Plus slice evaluation and a peer review", "Plus periodic slice checks"],
              ["<strong>High</strong>", "Credit, hiring, insurance pricing, fraud holds, health triage, account enforcement", "Plus independent validation, fairness analysis, documented human oversight, sign-off by an accountable owner", "Plus scheduled revalidation, fairness monitoring, audit trail retention"]
            ]
          },
          { t: "p", html: "The tier is set by the <em>impact of a wrong decision on a person</em> and by how reversible it is — not by whether the model is a deep network. A logistic regression that denies loans is higher-risk than a transformer that tags photos." },
          { t: "h", text: "Approval gates in the pipeline" },
          {
            t: "code", lang: "text", code:
              "registry stage transitions and what blocks them\n" +
              "\n" +
              "  candidate  -> staging     : tests pass, model card present,\n" +
              "                              slice metrics generated by eval job\n" +
              "  staging    -> production  : tier LOW    : owner approval\n" +
              "                              tier MEDIUM : + peer review recorded\n" +
              "                              tier HIGH   : + independent validation report\n" +
              "                                            + fairness gap within tolerance\n" +
              "                                            + accountable sign-off\n" +
              "  production -> retired     : consumers notified, fallback confirmed\n" +
              "\n" +
              "every transition writes: who, when, version, evidence links"
          },
          { t: "note", variant: "tip", html: "<strong>Make the gate a check, not a meeting.</strong> If the evaluation job writes slice metrics and the fairness gap into the registry, the gate can verify them automatically, and humans spend their time only on the high-tier judgement calls that genuinely need them." },
          { t: "h", text: "Validation independent of the builders" },
          { t: "p", html: "Builders share their model's blind spots: they chose the split, the label, the slices and the metric, so their evaluation mostly confirms their own assumptions. Independent validation — a separate team or at least a separate reviewer with authority to block — re-derives the evaluation, challenges the label definition, probes slices the builders did not think of, checks for <a href='#/mlsd/concepts/feature-pitfalls'>leakage and skew</a>, and stress-tests behaviour on shifted data. The independence is the value; a validator who reports to the builder's manager and cannot say no is a formality." },
          {
            t: "compare",
            bad: { title: "Governance as ceremony", items: ["Same review for every model", "A committee meeting after the model is already serving", "Approval recorded in an email thread", "No re-review when the model is retrained"] },
            good: { title: "Governance as engineering", items: ["Effort scales with risk tier", "Gates enforced in the registry before promotion", "Evidence stored with the model version", "Material changes — new data, new features, new use — trigger re-review automatically"] }
          },
          { t: "h", text: "Audit trails" },
          { t: "p", html: "For any consequential decision you should be able to answer, months later: which model version made it, with which input values, producing which score, at which threshold, and whether a human overrode it. That means logging those fields at decision time — they cannot be reconstructed after a retrain — and retaining them for as long as the decision can be challenged. The same log is what makes incident response and fairness re-analysis possible." },
          { t: "note", variant: "warn", html: "<strong>Regulatory pressure is rising, and specifics vary by jurisdiction and sector.</strong> Common themes include risk-based classification of automated systems, documentation and transparency duties, rights to an explanation or to contest a decision, and requirements for human oversight in high-impact uses. This is general context, not legal advice — the governance process should have a standing channel to legal and compliance partners who own the actual obligations." },
          { t: "h", text: "How this scores at each level" },
          {
            t: "table",
            headers: ["Level", "What the answer includes"],
            rows: [
              ["<strong>Mid</strong>", "Mentions a model card, a review before launch and monitoring after it"],
              ["<strong>Senior</strong>", "Tiers models by impact, enforces gates in the registry, logs decision-time fields for audit, and separates validation from building"],
              ["<strong>Staff</strong>", "Designs governance so the compliant path is the fastest path, sets which changes trigger re-review, owns the inventory across teams, and names the residual risk leadership is explicitly accepting"]
            ]
          },
          { t: "cue", html: "Reach for governance when the prompt says <em>regulated</em>, <em>audit</em>, <em>bank</em>, <em>insurer</em>, <em>hospital</em>, <em>hiring</em>, or when the model's output decides something about a person that is hard to undo. Say the tier first, then the gates it implies — that ordering shows you scale process to risk instead of applying it uniformly." },
          { t: "note", variant: "key", html: "<strong>Govern in proportion to the harm of a wrong decision, and enforce it in the pipeline.</strong> An inventory that is the registry, tiers set by impact and reversibility, gates that check evidence automatically, validation by people who can say no, and decision-time logs that make every outcome auditable." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "human-oversight",
        title: "Human oversight, appeals and incident response",
        summary: "In-the-loop versus on-the-loop, appeals as a system component, escalation, automation bias, red-teaming classical models, kill switches, and responding when a model causes harm.",
        minutes: 11,
        tags: ["oversight", "incident-response", "safety"],
        blocks: [
          { t: "p", html: "\"A human reviews it\" is the most common answer to \"what if the model is wrong?\" and one of the least examined. Oversight only works if the human has the time, the information and the incentive to disagree with the model — and if the system is designed so that a disagreement actually changes something. This lesson treats oversight as a component you design, size and test." },
          { t: "h", text: "In the loop, on the loop, out of the loop" },
          {
            t: "table",
            headers: ["Pattern", "How it works", "Fits when", "Fails when"],
            rows: [
              ["<strong>Human-in-the-loop</strong>", "The model recommends; a person makes each decision", "Volume is modest and each decision is high-stakes and hard to reverse", "Volume grows faster than reviewers, or reviewers defer to the score"],
              ["<strong>Human-on-the-loop</strong>", "The model decides; people monitor aggregates, sample decisions and can intervene", "Volume is high and individual errors are reversible", "Nobody watches the dashboards, or there is no lever to pull when they do"],
              ["<strong>Out of the loop</strong>", "Fully automated, with periodic offline review", "Low-impact, easily reversed decisions", "Applied to decisions that should have been tiered higher"]
            ]
          },
          { t: "p", html: "Most real systems mix them by confidence: auto-decide the clear cases, route the uncertain band to people. The routing threshold is then a capacity decision — the size of the review band must match reviewer hours, or the queue grows until reviews become rubber stamps." },
          { t: "h", text: "Automation bias" },
          { t: "p", html: "People who are shown a model's recommendation tend to agree with it, especially under time pressure and when the model is usually right. A 99% agreement rate can mean an excellent model or reviewers who stopped looking, and the agreement rate alone cannot distinguish them." },
          {
            t: "ul", items: [
              "<strong>Measure it.</strong> Seed the queue with known-answer cases where the model is wrong and track the catch rate per reviewer.",
              "<strong>Order the information.</strong> For high-stakes cases, collect the reviewer's independent judgement before revealing the model's score.",
              "<strong>Size the queue.</strong> Throughput targets that leave thirty seconds per case guarantee deference.",
              "<strong>Close the loop.</strong> Tell reviewers when a decision they approved was later overturned."
            ]
          },
          { t: "h", text: "Appeals are part of the system" },
          { t: "p", html: "An appeal path is not customer service bolted on afterwards. It is the channel through which the system learns about its false positives, and for selective-label problems it may be the <em>only</em> source of labels on the people the model rejected. Design it with the same care as the model:" },
          {
            t: "code", lang: "text", code:
              "decision -> notice with reason codes -> appeal submitted\n" +
              "   -> routed to a reviewer who did NOT make the original call\n" +
              "   -> outcome: upheld / overturned (+ reason)\n" +
              "   -> overturned cases:\n" +
              "        * reverse the action and its side effects\n" +
              "        * log as a labelled false positive, tagged with model version\n" +
              "        * feed the evaluation set and the fairness slice report\n" +
              "\n" +
              "track: appeal rate, overturn rate, time-to-resolution, all by group"
          },
          { t: "note", variant: "trap", html: "<strong>A rising overturn rate is a model-quality alarm, not a support metric.</strong> If overturns concentrate in one group, it is also a fairness alarm that will fire weeks before the labelled-outcome dashboards do. Route it to the model owner, not only to the support lead." },
          { t: "h", text: "Red-teaming classical models" },
          { t: "p", html: "Red-teaming is not only for language models. For a classical classifier it means deliberately searching for inputs that produce harmful or embarrassing decisions before an adversary or a journalist does: probing slices and intersections the evaluation set under-represents, constructing near-identical pairs that differ only in a proxy, testing how the score moves with plausible manipulation of features a user controls, and checking behaviour on stale or missing upstream data. Write findings into the model card's limitations. For prompt-based attacks, jailbreaks and LLM-specific safety evaluation, see <a href='../llm-academy/index.html'>Lumen</a>." },
          { t: "h", text: "Kill switches and incident response" },
          { t: "p", html: "Every consequential model needs a pre-built way to stop it that does not require a deploy: a flag that routes traffic to a fallback — the previous model version, a conservative rule set, or full human review. Test it before you need it. When a model causes harm, the sequence is the same as any production incident, with two ML-specific steps:" },
          {
            t: "ol", items: [
              "<strong>Contain.</strong> Trip the switch to the fallback. Do not retrain first — the new data may be what broke it.",
              "<strong>Scope.</strong> Use the decision-time audit log to find exactly which decisions, which model version and which people were affected.",
              "<strong>Remediate the people.</strong> Reverse or re-review the affected decisions and notify where required. This step is the one ML teams forget.",
              "<strong>Find the cause.</strong> Upstream data change, drift, a feature pipeline bug, a feedback loop — the <a href='#/ops/monitoring/drift-playbook'>drift playbook</a> covers the diagnostic sequence.",
              "<strong>Prevent recurrence.</strong> Add the monitor that would have caught it earlier, update the model card's limitations, and record the incident in the decision log."
            ]
          },
          { t: "p", html: "The <a href='#/mlcase/trust/harmful-content'>harmful content breakdown</a> shows these pieces together at scale: confidence-banded routing to human review, appeals feeding labels back, and enforcement decisions that must be reversible." },
          {
            t: "table",
            headers: ["Tier", "Oversight design", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "\"A human reviews the flagged cases\"", "No sizing, no measure of whether reviewers catch errors, no path for the affected person"],
              ["<strong>Solid</strong>", "Confidence-banded routing sized to reviewer capacity, an appeal path, a tested fallback switch", "Each failure has a lever, and the levers exist before the incident"],
              ["<strong>Standout</strong>", "Plus seeded-case audits for automation bias, overturns feeding evaluation and fairness slices, and an incident runbook that includes remediating affected people", "Oversight is measured, learns from its own corrections, and treats the people harmed as part of the fix"]
            ]
          },
          { t: "cue", html: "Raise oversight the moment you say \"a human reviews it\" — and immediately say how many cases per hour, how you know reviewers are not rubber-stamping, how a wrongly affected person appeals, and what switch you flip if the model goes bad at 3 a.m. Those four answers turn a reassurance into a design." },
          { t: "note", variant: "key", html: "<strong>Oversight is a component you size, measure and test, not a reassurance.</strong> Match the review band to reviewer capacity, measure automation bias with seeded cases, make appeals a source of labels, keep a tested kill switch to a safe fallback, and include remediating affected people in every incident response." },
          { t: "quiz", id: "resp-governance" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.resp = {
    id: "resp",
    name: "Responsible ML",
    short: "Resp",
    tagline: "Fair, explainable, private — and provably so",
    color: "#2dd4bf",
    blurb: "The questions that decide whether a model should ship at all, asked with the same rigour as latency and recall. Fairness definitions as confusion-matrix arithmetic, why they collide when base rates differ, and where bias enters the pipeline before any model is trained. Explanations matched to their audience — permutation importance, partial dependence, Shapley credit with a worked example, counterfactual reason codes — and the documents that stop a model being reused where it was never tested. Closes with privacy beyond hashing IDs, differential privacy by intuition, governance tiered by harm, and human oversight designed as a measured, testable component. Classical ML throughout; LLM-specific safety lives in Lumen.",
    modules: [MOD_FAIRNESS, MOD_EXPLAIN, MOD_GOVERNANCE]
  };
})();
