/* =====================================================================
   SYNAPSE · ML Foundations
   window.TRACKS.found — modules: framing / metrics / experiments

   Self-contained: this file registers its own widgets, its own quizzes,
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

  var SVG_NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  function pct(x, dp) {
    if (typeof x !== "number" || !isFinite(x)) return "n/a";
    return (x * 100).toFixed(dp == null ? 1 : dp) + "%";
  }
  function fix(x, dp) {
    if (typeof x !== "number" || !isFinite(x)) return "n/a";
    return x.toFixed(dp);
  }
  function commas(n) {
    var s = String(Math.round(n));
    var out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  var Widgets = {};

  /* ==================================================================
     1. foundThreshold — "Move the threshold"
     Fixed dataset: 8 positives, 32 negatives, overlapping scores.
     Predicted positive when score >= threshold.
  ================================================================== */
  var TH_POS = [0.92, 0.85, 0.78, 0.71, 0.64, 0.57, 0.42, 0.33];
  var TH_NEG = [0.02, 0.04, 0.06, 0.08, 0.11, 0.12, 0.14, 0.16, 0.18, 0.21, 0.22, 0.24, 0.26, 0.28,
    0.31, 0.34, 0.36, 0.38, 0.41, 0.44, 0.47, 0.49, 0.52, 0.56, 0.58, 0.61, 0.66, 0.69, 0.73, 0.77, 0.81, 0.88];
  var TH_COSTS = {
    balanced: { fn: 1, fp: 1, label: "a miss and a false alarm cost the same (1 each)" },
    fn: { fn: 10, fp: 1, label: "a miss costs 10, a false alarm costs 1" },
    fp: { fn: 1, fp: 10, label: "a miss costs 1, a false alarm costs 10" }
  };

  function thCounts(t) {
    var c = { tp: 0, fp: 0, tn: 0, fn: 0 }, i;
    for (i = 0; i < TH_POS.length; i++) { if (TH_POS[i] >= t - 1e-9) c.tp++; else c.fn++; }
    for (i = 0; i < TH_NEG.length; i++) { if (TH_NEG[i] >= t - 1e-9) c.fp++; else c.tn++; }
    return c;
  }
  function thCost(c, sc) { return c.fn * sc.fn + c.fp * sc.fp; }

  Widgets.foundThreshold = function (mount) {
    shell(mount, "threshold lab", "Move the threshold",
      "Forty scored examples — 8 real positives, 32 negatives — with overlapping scores. Slide the decision threshold and watch the four cells trade against each other, then pick a cost scenario to see which threshold is actually cheapest.");

    var t = 0.5;
    var scenario = "balanced";
    var valSpan = h("b", {}, "0.50");
    var input = h("input", { type: "range", min: "0.05", max: "0.95", step: "0.05", value: "0.5" });
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      if (isFinite(v)) t = Math.round(v * 100) / 100;
      paint();
    });

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function cell(label, count, border, hint) {
      return h("div", {
        style: "border:2px solid " + border + ";border-radius:10px;padding:10px 12px;color:var(--text);min-height:64px"
      },
        h("div", { style: "font-size:0.74rem;color:var(--text-dim);font-family:var(--font-mono)" }, label),
        h("div", { style: "font-size:1.5rem;font-weight:700;font-family:var(--font-mono)" }, String(count)),
        h("div", { style: "font-size:0.76rem;color:var(--text-dim)" }, hint));
    }

    function paint() {
      valSpan.textContent = t.toFixed(2);
      var c = thCounts(t);
      var sc = TH_COSTS[scenario] || TH_COSTS.balanced;
      var prec = (c.tp + c.fp) ? c.tp / (c.tp + c.fp) : NaN;
      var rec = c.tp / TH_POS.length;
      var f1 = (isFinite(prec) && prec + rec > 0) ? 2 * prec * rec / (prec + rec) : NaN;
      var fpr = c.fp / TH_NEG.length;
      var acc = (c.tp + c.tn) / (TH_POS.length + TH_NEG.length);
      var cost = thCost(c, sc);

      var best = 0.05, bestCost = Infinity, k;
      for (k = 1; k <= 19; k++) {
        var tt = Math.round(k * 5) / 100;
        var cc = thCost(thCounts(tt), sc);
        if (cc < bestCost) { bestCost = cc; best = tt; }
      }

      clear(stage);
      stage.appendChild(h("div", {
        style: "display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:stretch;max-width:520px"
      },
        h("span", {}, ""),
        h("span", { style: "font-size:0.78rem;color:var(--text-dim);text-align:center" }, "Actually positive"),
        h("span", { style: "font-size:0.78rem;color:var(--text-dim);text-align:center" }, "Actually negative"),
        h("span", { style: "font-size:0.78rem;color:var(--text-dim);align-self:center" }, "Flagged"),
        cell("TP", c.tp, "var(--lime)", "caught"),
        cell("FP", c.fp, "var(--amber)", "false alarm"),
        h("span", { style: "font-size:0.78rem;color:var(--text-dim);align-self:center" }, "Not flagged"),
        cell("FN", c.fn, "var(--rose)", "missed"),
        cell("TN", c.tn, "var(--line-strong)", "correctly ignored")
      ));

      /* a strip of every example: lime = positive, dashed = negative */
      var strip = h("div", { style: "display:flex;flex-wrap:wrap;gap:4px;margin-top:12px" });
      var all = [], i;
      for (i = 0; i < TH_POS.length; i++) all.push({ s: TH_POS[i], y: 1 });
      for (i = 0; i < TH_NEG.length; i++) all.push({ s: TH_NEG[i], y: 0 });
      all.sort(function (a, b) { return b.s - a.s; });
      for (i = 0; i < all.length; i++) {
        var flagged = all[i].s >= t - 1e-9;
        strip.appendChild(h("span", {
          title: (all[i].y ? "positive" : "negative") + " score " + all[i].s.toFixed(2),
          style: "font-family:var(--font-mono);font-size:0.7rem;padding:2px 4px;border-radius:4px;color:" +
            (flagged ? "var(--text)" : "var(--text-dim)") + ";border:1px " + (flagged ? "solid " : "dashed ") +
            (all[i].y ? "var(--lime)" : "var(--line-strong)")
        }, (all[i].y ? "+" : "-") + all[i].s.toFixed(2)));
      }
      stage.appendChild(strip);

      clear(readout);
      readout.appendChild(ro("precision", isFinite(prec) ? pct(prec) : "undefined (nothing flagged)"));
      readout.appendChild(ro("recall", pct(rec)));
      readout.appendChild(ro("F1", isFinite(f1) ? fix(f1, 2) : "n/a"));
      readout.appendChild(ro("FPR", pct(fpr)));
      readout.appendChild(ro("accuracy", pct(acc)));
      readout.appendChild(ro("expected cost", cost));
      readout.appendChild(ro("cheapest threshold", best.toFixed(2) + " (cost " + bestCost + ")"));

      var verdict;
      if (Math.abs(best - t) < 1e-9) {
        verdict = "You are sitting on the cheapest threshold for this scenario, where " + sc.label + ". Change the scenario and watch the optimum move — the model did not change, only the prices did.";
      } else if (best < t) {
        verdict = "Too strict for these prices: " + c.fn + " misses are costing you. When " + sc.label + ", the cheapest threshold is lower, at " + best.toFixed(2) + " — accept more false alarms to catch more positives.";
      } else {
        verdict = "Too lenient for these prices: " + c.fp + " false alarms are costing you. When " + sc.label + ", the cheapest threshold is higher, at " + best.toFixed(2) + " — let a few positives through to stop flagging negatives.";
      }
      if (acc >= 0.8 && rec < 0.5) verdict += " Note the accuracy: " + pct(acc) + " while missing most positives, which is exactly why accuracy is the wrong scoreboard here.";
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "Threshold ", input, " ", valSpan),
      segment([["balanced", "Balanced"], ["fn", "Misses are costly"], ["fp", "False alarms are costly"]], 0,
        function (v) { scenario = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. foundCurves — "ROC vs PR under imbalance"
     Binormal model: negatives ~ N(0,1), positives ~ N(d,1).
  ================================================================== */
  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var p = 0.3275911, t = 1 / (1 + p * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  }
  function phi(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }

  var CURVE_QUALITY = { weak: 0.8, decent: 1.6, strong: 2.5 };

  function curveData(d, pi) {
    var roc = [], pr = [], i, steps = 240, lo = -5, hi = d + 5;
    for (i = 0; i <= steps; i++) {
      var th = hi - (hi - lo) * i / steps;
      var tpr = 1 - phi(th - d);
      var fpr = 1 - phi(th);
      roc.push([fpr, tpr]);
      if (tpr > 1e-6) {
        var prec = tpr * pi / (tpr * pi + fpr * (1 - pi));
        pr.push([tpr, prec]);
      }
    }
    var rocAuc = 0;
    for (i = 1; i < roc.length; i++) rocAuc += (roc[i][0] - roc[i - 1][0]) * (roc[i][1] + roc[i - 1][1]) / 2;
    var prAuc = 0;
    if (pr.length) {
      prAuc = pr[0][0] * pr[0][1];
      for (i = 1; i < pr.length; i++) prAuc += (pr[i][0] - pr[i - 1][0]) * (pr[i][1] + pr[i - 1][1]) / 2;
    }
    var t80 = d - 0.8416;
    var fpr80 = 1 - phi(t80);
    var p80 = 0.8 * pi / (0.8 * pi + fpr80 * (1 - pi));
    return { roc: roc, pr: pr, rocAuc: rocAuc, prAuc: prAuc, p80: p80, fpr80: fpr80 };
  }

  function chart(title, pts, xLabel, yLabel, ref) {
    var W = 240, H = 210, L = 38, R = 10, T = 22, B = 34;
    var pw = W - L - R, ph = H - T - B;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: String(W), height: String(H), role: "img", "aria-label": title });
    function X(v) { return L + v * pw; }
    function Y(v) { return T + (1 - v) * ph; }
    s.appendChild(svg("rect", { x: L, y: T, width: pw, height: ph, fill: "none", stroke: "var(--line-strong)", "stroke-width": "1" }));
    var ticks = [0, 0.5, 1], i;
    for (i = 0; i < ticks.length; i++) {
      var tx = svg("text", { x: X(ticks[i]), y: H - B + 14, "text-anchor": "middle", style: "fill:var(--text-dim);font-size:11px" });
      tx.textContent = String(ticks[i]);
      s.appendChild(tx);
      var ty = svg("text", { x: L - 6, y: Y(ticks[i]) + 4, "text-anchor": "end", style: "fill:var(--text-dim);font-size:11px" });
      ty.textContent = String(ticks[i]);
      s.appendChild(ty);
    }
    if (ref) {
      s.appendChild(svg("line", {
        x1: X(ref[0][0]), y1: Y(ref[0][1]), x2: X(ref[1][0]), y2: Y(ref[1][1]),
        stroke: "var(--text-dim)", "stroke-width": "1", "stroke-dasharray": "4 3"
      }));
    }
    var str = [];
    for (i = 0; i < pts.length; i++) str.push(X(pts[i][0]).toFixed(1) + "," + Y(pts[i][1]).toFixed(1));
    s.appendChild(svg("polyline", { points: str.join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": "2.2" }));
    var tt = svg("text", { x: L, y: 14, style: "fill:var(--text);font-size:12px;font-weight:600" });
    tt.textContent = title;
    s.appendChild(tt);
    var xl = svg("text", { x: L + pw / 2, y: H - 4, "text-anchor": "middle", style: "fill:var(--text-dim);font-size:11px" });
    xl.textContent = xLabel;
    s.appendChild(xl);
    var yl = svg("text", { x: 12, y: T + ph / 2, "text-anchor": "middle", transform: "rotate(-90 12 " + (T + ph / 2) + ")", style: "fill:var(--text-dim);font-size:11px" });
    yl.textContent = yLabel;
    s.appendChild(yl);
    return s;
  }

  Widgets.foundCurves = function (mount) {
    shell(mount, "curve lab", "ROC vs PR under imbalance",
      "The same model, scored on populations with different base rates. Positives score ~N(d,1), negatives ~N(0,1). Change the base rate and watch which curve moves — and which one stays perfectly still.");

    var pi = 0.1;
    var quality = "decent";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var d = CURVE_QUALITY[quality] || 1.6;
      var cd = curveData(d, pi);
      clear(stage);
      stage.appendChild(h("div", { style: "display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start" },
        chart("ROC curve", cd.roc, "false positive rate", "true positive rate", [[0, 0], [1, 1]]),
        chart("Precision-recall", cd.pr, "recall", "precision", [[0, pi], [1, pi]])
      ));

      clear(readout);
      readout.appendChild(ro("base rate", pct(pi, pi < 0.01 ? 1 : 0)));
      readout.appendChild(ro("separation d", fix(d, 1)));
      readout.appendChild(ro("ROC-AUC", fix(cd.rocAuc, 3)));
      readout.appendChild(ro("PR-AUC (approx.)", fix(cd.prAuc, 3)));
      readout.appendChild(ro("precision at 80% recall", pct(cd.p80)));
      readout.appendChild(ro("FPR at 80% recall", pct(cd.fpr80)));

      var flagged = 0.8 * pi + cd.fpr80 * (1 - pi);
      var perTrue = cd.p80 > 0 ? (1 / cd.p80) : Infinity;
      var verdict = "ROC-AUC is " + fix(cd.rocAuc, 3) + " at every base rate — it only asks how often a random positive outranks a random negative. ";
      if (pi <= 0.01) {
        verdict += "But at a " + pct(pi, pi < 0.01 ? 1 : 0) + " base rate, catching 80% of positives means flagging " + pct(flagged) + " of all traffic, and you review about " + fix(perTrue, 0) + " items per real hit. PR shows the cost; ROC hides it.";
      } else {
        verdict += "At a " + pct(pi, 0) + " base rate precision at 80% recall is " + pct(cd.p80) + ". Drop the base rate and watch the PR curve collapse while the ROC curve does not move a pixel.";
      }
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[0.5, "50%"], [0.1, "10%"], [0.01, "1%"], [0.001, "0.1%"]], 1, function (v) { pi = v; paint(); }),
      segment([["weak", "Weak model"], ["decent", "Decent model"], ["strong", "Strong model"]], 1, function (v) { quality = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. foundSampleSize — "How many users do you need?"
     n per arm = (z_{1-a/2} + z_power)^2 * 2 p(1-p) / delta^2
  ================================================================== */
  Widgets.foundSampleSize = function (mount) {
    shell(mount, "power calculator", "How many users do you need?",
      "A two-arm conversion test at alpha = 0.05, two-sided. Set the baseline, the smallest relative lift worth detecting, the power you want and the traffic you have. Traffic is split 50/50.");

    var base = 5, lift = 5, power = 80, traffic = 100000;
    var baseVal = h("b", {}, "5%");
    var liftVal = h("b", {}, "5%");
    var baseIn = h("input", { type: "range", min: "1", max: "30", step: "1", value: "5" });
    var liftIn = h("input", { type: "range", min: "1", max: "20", step: "1", value: "5" });
    baseIn.addEventListener("input", function () { var v = parseInt(baseIn.value, 10); if (isFinite(v)) base = v; paint(); });
    liftIn.addEventListener("input", function () { var v = parseInt(liftIn.value, 10); if (isFinite(v)) lift = v; paint(); });

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      baseVal.textContent = base + "%";
      liftVal.textContent = lift + "%";
      var p = base / 100;
      var delta = p * lift / 100;
      var zb = power === 90 ? 1.28 : 0.84;
      var z = 1.96 + zb;
      var n = Math.ceil(z * z * 2 * p * (1 - p) / (delta * delta));
      var perArmPerDay = traffic / 2;
      var days = Math.max(1, Math.ceil(n / perArmPerDay));

      clear(stage);
      var maxDays = 56;
      var w = Math.min(100, Math.round(days / maxDays * 100));
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:minmax(110px,1fr) 3fr auto;gap:12px;align-items:center" },
        h("span", { style: "font-size:0.84rem;color:var(--text)" }, "Days to finish"),
        h("span", { style: "display:block;background:var(--surface-solid);border-radius:6px;overflow:hidden;height:12px" },
          h("i", { style: "display:block;height:12px;border-radius:6px;width:" + Math.max(2, w) + "%;background:" + (days > 28 ? "var(--rose)" : days < 7 ? "var(--amber)" : "var(--lime)") })),
        h("span", { style: "font-family:var(--font-mono);font-size:0.82rem;color:var(--text)" }, days > maxDays ? days + " d (off scale)" : days + " d")
      ));
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim);margin:10px 0 0;line-height:1.6" },
        "n/arm = (1.96 + " + zb.toFixed(2) + ")^2 x 2 x " + p.toFixed(2) + " x " + (1 - p).toFixed(2) + " / " + delta.toFixed(5) + "^2 = " + commas(n)));

      clear(readout);
      readout.appendChild(ro("absolute effect", (delta * 100).toFixed(3) + " pp"));
      readout.appendChild(ro("users per arm", commas(n)));
      readout.appendChild(ro("users total", commas(2 * n)));
      readout.appendChild(ro("per arm per day", commas(perArmPerDay)));
      readout.appendChild(ro("days needed", days));

      var verdict;
      if (days > 28) {
        verdict = "Over four weeks — too long to be practical, and long enough for the population to drift under you. Increase the MDE, use a more sensitive metric, apply CUPED to cut variance, or switch to interleaving if this is a ranking change.";
      } else if (days < 7) {
        verdict = "Statistically you could stop in " + days + " day" + (days === 1 ? "" : "s") + ", but run at least one full week anyway so weekday and weekend behaviour are both in the sample and the novelty spike has time to fade.";
      } else {
        verdict = "Feasible: " + days + " days covers at least one weekly cycle. Fix this duration before launch and do not stop early because the dashboard looks significant.";
      }
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "Baseline conversion ", baseIn, " ", baseVal),
      h("label", { class: "w-field" }, "Min. detectable lift (relative) ", liftIn, " ", liftVal),
      segment([[80, "80% power"], [90, "90% power"]], 0, function (v) { power = v; paint(); }),
      segment([[10000, "10k/day"], [100000, "100k/day"], [1000000, "1M/day"]], 1, function (v) { traffic = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     4. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "found-framing": {
      title: "Framing checkpoint",
      sub: "When to use ML at all, which learning setup fits the label you have, and how to read a fitting problem.",
      questions: [
        {
          q: "A team wants to use ML to route support tickets to one of four queues. Today a keyword rule routes 92% correctly. What should come first?",
          options: [
            "Train a transformer classifier on the ticket text immediately",
            "Pause the project until a million freshly labelled tickets exist, because a model trained on less data will never be competitive with the rule",
            "Treat the keyword rule as the baseline, measure where it fails, and only build a model if those failures are worth the cost",
            "Replace the queues with a single queue so no routing is needed"
          ],
          answer: 2,
          explain: "A 92% rule is a strong baseline, and the model has to beat it by enough to pay for training, serving and monitoring. Measuring the 8% of failures tells you whether they are a learnable pattern or just ambiguous tickets no model will fix. Skipping the baseline means you cannot even say whether the model helped."
        },
        {
          q: "You have millions of transactions and no fraud labels, and you want to surface unusual ones for analysts. Which framing fits?",
          options: [
            "Unsupervised anomaly detection, with analyst verdicts collected as labels for a later supervised model",
            "Supervised regression on transaction amount",
            "Reinforcement learning with the analyst as the environment",
            "Supervised binary classification on the current data, treating every transaction nobody has disputed so far as a confirmed legitimate example"
          ],
          answer: 0,
          explain: "Without labels a supervised classifier has nothing to learn from, so you start by scoring how unusual each transaction is. The analysts' decisions on what you surface then become labels, which lets you move to a supervised model once you have enough. Regression on the amount predicts the wrong quantity entirely."
        },
        {
          q: "Training loss is 0.05 and validation loss is 0.60, and the gap keeps widening as training continues. What is the most likely diagnosis?",
          options: [
            "Underfitting — the model needs more capacity",
            "The learning rate is too small to make progress",
            "The validation set is too easy",
            "Overfitting — the model is memorizing the training set; regularize, stop earlier, or add data"
          ],
          answer: 3,
          explain: "Low training error with much higher, rising validation error is the signature of high variance. The model is fitting noise that does not generalize, so the fixes are the ones that reduce effective capacity or add evidence: regularization, early stopping, augmentation or more data. Adding capacity would make it worse."
        },
        {
          q: "Both training and validation error are high and close together, and adding more training data barely moves either. What is the right next step?",
          options: [
            "Collect ten times more data, because more examples always shrink both training and validation error",
            "Increase capacity or add better features — the model is too simple for the signal",
            "Add stronger L2 regularization",
            "Shrink the validation set so the estimate is less noisy"
          ],
          answer: 1,
          explain: "When the two curves have converged at a high error, the model is biased: it cannot represent the pattern even with all the data it already has. More data helps variance, not bias, which is why the curve is flat. Regularization pushes further in the wrong direction."
        },
        {
          q: "Which statement about labels across learning setups is correct?",
          options: [
            "Self-supervised learning needs more human labels than supervised learning",
            "Clustering requires a label for every example",
            "A contextual bandit only observes the reward for the action it actually took",
            "Reinforcement learning requires a human-labelled correct action for every state the agent visits"
          ],
          answer: 2,
          explain: "A bandit gets partial feedback: it sees the reward for the item it showed and nothing about the alternatives, which is why exploration and logged propensities matter. Self-supervised learning manufactures labels from the data itself, clustering needs none, and RL learns from rewards rather than correct actions."
        },
        {
          q: "Why should an ML problem statement name how wrong predictions will be tolerated before modelling starts?",
          options: [
            "Because error tolerance decides the metric and threshold, and can rule out ML entirely when any error is unacceptable",
            "Because models with a stated error budget train faster",
            "Because regulators require a number on every model card",
            "Because it determines which programming language to use"
          ],
          answer: 0,
          explain: "Every model is wrong some of the time, so the product has to absorb errors gracefully. If a single mistake is catastrophic and cannot be caught by a human or a fallback, a deterministic rule may be the only acceptable design. If errors are cheap and reversible, ML is a good fit and the tolerance sets the operating point."
        }
      ]
    },

    "found-metrics": {
      title: "Metrics checkpoint",
      sub: "Confusion matrices, ROC and PR, ranking metrics, and calibration.",
      questions: [
        {
          q: "Out of 10,000 transactions, 100 are fraud. Your model flags 300 and 80 of those are fraud. What are precision and recall?",
          options: [
            "Precision 80%, recall 26.7%",
            "Precision 26.7%, recall 80%",
            "Precision 97.6%, recall 80%",
            "Precision 26.7%, recall 97.8%"
          ],
          answer: 1,
          explain: "Precision is true positives over everything flagged: 80 / 300 = 26.7%. Recall is true positives over every real positive: 80 / 100 = 80%. 97.6% is the accuracy and 97.8% is the specificity, both inflated by the 9,900 legitimate transactions."
        },
        {
          q: "A model's ROC-AUC is 0.87 on a balanced test set. You deploy it where positives are 0.5% of traffic. What happens to ROC-AUC and to precision at a fixed recall?",
          options: [
            "Both stay the same",
            "Both drop sharply",
            "ROC-AUC drops sharply because negatives now dominate, while precision at a fixed recall stays where it was",
            "ROC-AUC stays about the same; precision at that recall falls sharply"
          ],
          answer: 3,
          explain: "TPR and FPR are each computed within one class, so the ROC curve and its area do not depend on the base rate. Precision mixes the two classes, so when negatives outnumber positives 199 to 1, the same FPR produces far more false positives per true one. That is why PR is the honest view for rare events."
        },
        {
          q: "What does a ROC-AUC of 0.80 mean in plain terms?",
          options: [
            "A randomly chosen positive scores higher than a randomly chosen negative 80% of the time",
            "The model is correct on 80% of examples",
            "Precision is 80% at the default threshold",
            "80% of positives score above 0.5"
          ],
          answer: 0,
          explain: "ROC-AUC equals the probability that the model ranks a random positive above a random negative. It is a statement about ordering, independent of any threshold, so it says nothing directly about accuracy or precision at a particular cut-off."
        },
        {
          q: "For one query the ranked relevance grades are [3, 2, 0, 1, 2]. Why is NDCG below 1?",
          options: [
            "Because one result has grade 0, and any zero-relevance item anywhere in the top k forces NDCG strictly below 1 regardless of its position",
            "Because NDCG is always below 1 for five results",
            "Because a grade-2 item sits at position 5 below a grade-0 and a grade-1 item, while the ideal order is [3, 2, 2, 1, 0]",
            "Because the top result should have been grade 2"
          ],
          answer: 2,
          explain: "NDCG divides the list's discounted gain by the gain of the ideal ordering of the same items. Here the ideal is [3, 2, 2, 1, 0]; the actual list buries a grade-2 result at rank 5, so it collects less discounted gain, about 0.97 of the ideal. A zero at the bottom of an otherwise ideal list would still score 1."
        },
        {
          q: "An ads model ranks well (high AUC) but its predicted click rates average 2x the observed rate. Why does that matter if ranking is fine?",
          options: [
            "It does not matter — the auction only ever looks at the order of ads, so any monotone distortion of the predicted rates cancels out",
            "Because it means AUC was computed incorrectly",
            "Because overestimated probabilities always lower recall",
            "Because the auction multiplies pCTR by the bid, so inflated probabilities distort prices and comparisons against other advertisers' models"
          ],
          answer: 3,
          explain: "When predictions feed arithmetic — expected value, bids, budget pacing, cost-based thresholds — their absolute values matter, not just their order. A model can be perfectly discriminative and badly calibrated. Recalibrating with Platt or isotonic scaling fixes the scale without changing the ranking."
        },
        {
          q: "You train a click model after keeping only 10% of negatives. What must you do before serving its probabilities?",
          options: [
            "Correct them: p = p' / (p' + (1 - p') / 0.1), or refit a calibrator on unsampled data",
            "Nothing — downsampling changes only how fast the model trains, so its probabilities are already on the right scale",
            "Multiply every prediction by 10",
            "Divide every prediction by 0.1 and clip at 1"
          ],
          answer: 0,
          explain: "Downsampling negatives inflates the apparent positive rate, so raw predictions are too high. The correction re-weights the odds by the sampling rate, which keeps rankings the same and restores the right scale. Multiplying predictions by 10 moves them in the wrong direction entirely."
        }
      ]
    },

    "found-experiments": {
      title: "Experiments checkpoint",
      sub: "Offline-online gaps, A/B test sizing and hygiene, and interleaving.",
      questions: [
        {
          q: "Baseline conversion is 5% and you want to detect a 5% relative lift with 80% power at alpha 0.05. Roughly how many users per arm?",
          options: [
            "About 120,000",
            "About 1,200",
            "About 12,000",
            "About 1.2 million"
          ],
          answer: 0,
          explain: "The absolute effect is 0.05 x 0.05 = 0.0025 and the variance is 0.05 x 0.95 = 0.0475. Per arm n is about 15.7 x 0.0475 / 0.0025 squared, roughly 119,000. Small relative lifts on low baselines are expensive, which is why sample size has to be computed before launch."
        },
        {
          q: "An experiment is assigned 50/50, but after a week the arms hold 506,000 and 494,000 users. What should you do?",
          options: [
            "Nothing — a 1.2% imbalance is normal noise",
            "Reweight the smaller arm back to an even 50/50 split so the comparison is fair again, then report the result as planned",
            "Extend the test until the counts even out",
            "Treat it as a sample ratio mismatch and find the assignment or logging bug before trusting any metric"
          ],
          answer: 3,
          explain: "With a million users, a chi-square test on those counts gives a statistic around 144, far beyond chance. Something is dropping or duplicating users in one arm, and whatever it is likely correlates with the outcome. Results from a test with SRM are untrustworthy until the cause is fixed."
        },
        {
          q: "Why does checking an A/B test daily and stopping the first time p < 0.05 inflate false positives?",
          options: [
            "Because p-values are only valid on weekends",
            "Because each look is another chance for noise to cross the line, so the overall false positive rate climbs well above 5%",
            "Because each extra day of data shrinks the effective sample, so later p-values are computed on fewer independent users than earlier ones",
            "Because daily checks change user behaviour"
          ],
          answer: 1,
          explain: "A fixed-horizon test controls error only when you look once. Repeated looks with the same threshold give noise many chances to look significant, and stopping on the first crossing locks in those flukes. Fix the duration in advance, or use a sequential method designed for repeated looks."
        },
        {
          q: "CUPED uses each user's pre-experiment metric as a covariate. If that covariate correlates with the outcome at rho = 0.6, how much does variance shrink?",
          options: [
            "By 60%, because the variance reduction equals the correlation coefficient itself",
            "By 6%",
            "By about 36% (variance is multiplied by 1 - rho squared = 0.64)",
            "It does not change variance, only the mean"
          ],
          answer: 2,
          explain: "The adjusted metric removes the part of the outcome explained by the covariate, leaving variance multiplied by 1 - rho squared. With rho = 0.6 that is 0.64, so you need about 36% fewer users for the same power. The treatment effect estimate stays unbiased because the covariate was measured before assignment."
        },
        {
          q: "In team-draft interleaving, how are clicks turned into a verdict?",
          options: [
            "Each click is credited to the ranker whose team contributed that result; the ranker with more credited clicks across many queries wins",
            "Clicks on the top result are credited to both rankers equally",
            "Users are split into two groups and each sees one ranker",
            "Clicks are ignored; the ranker whose list had higher offline NDCG on the judged set for that query is declared the winner of the round"
          ],
          answer: 0,
          explain: "Both rankers contribute results to a single merged list, alternating picks with a coin flip deciding who goes first each round. Because every user sees both rankers side by side, the comparison is within-user, which removes between-user variance and is why interleaving needs far less traffic than an A/B test."
        },
        {
          q: "When is interleaving the wrong tool?",
          options: [
            "When comparing two ranking models for the same search page",
            "When you need the effect of a change on revenue or long-term retention",
            "When traffic is limited",
            "When you want a quick screen of several candidate rankers"
          ],
          answer: 1,
          explain: "Interleaving measures which ranker users prefer within a single mixed list. It cannot tell you how a full product experience moves session-level or business metrics, because no user ever experiences one ranker alone. Use it to screen candidates quickly, then confirm the winner with an A/B test."
        }
      ]
    }
  });

  /* ==================================================================
     5. Module: Framing the problem
  ================================================================== */
  var MOD_FRAMING = {
    id: "framing",
    name: "Framing the problem",
    icon: "compass",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "ml-or-not",
        title: "Should this be ML at all?",
        summary: "A four-question test for when a learned model beats a rule, and why a baseline is the first thing you build either way.",
        minutes: 9,
        tags: ["framing", "baseline", "beginner"],
        blocks: [
          { t: "p", html: "A rule is code you write. A model is code you <em>fit</em> to examples. The second only pays off when the pattern is too fuzzy, too high-dimensional, or too fast-changing to write down — and when you can afford the machinery that keeps a fitted function honest after launch." },
          { t: "p", html: "Software engineers new to ML tend to make one of two mistakes: reaching for a model when twenty lines of <code class='tok'>if</code> statements would do, or refusing ML on a problem where rules have already plateaued. The test below separates the two in a couple of minutes." },
          { t: "h", text: "The four-question test" },
          {
            t: "table",
            headers: ["Question", "ML fits when…", "Rules fit when…"],
            rows: [
              ["<strong>Is there a learnable pattern?</strong>", "Many weak signals combine non-obviously (spam, relevance, fraud)", "One or two crisp conditions decide the outcome (age limit, file size)"],
              ["<strong>Is there data with labels, or a way to get them?</strong>", "Historical outcomes exist or users generate them (clicks, chargebacks)", "Nobody has ever recorded the outcome and nobody can"],
              ["<strong>Is there a feedback loop?</strong>", "You will learn whether predictions were right, soon enough to retrain", "Errors are never observed, so the model can never improve"],
              ["<strong>Can the product tolerate errors?</strong>", "Mistakes are cheap, reversible, or caught by a human", "A single error is catastrophic and nothing downstream catches it"]
            ]
          },
          { t: "p", html: "You want four yeses. Three yeses with a hard no on error tolerance usually means <em>ML with a guard</em>: the model proposes, a deterministic rule or a human disposes. A no on labels sends you to the <a href='#/found/framing/learning-types'>unsupervised and self-supervised setups</a> or to a labelling plan — Synapse's <a href='#/data/labels/label-sources'>Data &amp; Features track</a> covers that in depth." },
          { t: "note", variant: "tip", html: "Rules and models are not rivals. Most production ML systems are a model wrapped in rules: hard filters before it (never show out-of-stock items), business constraints after it (at most two items per seller), and an override list for the cases where policy beats probability." },
          { t: "h", text: "Baseline first, always" },
          { t: "p", html: "Before training anything, build the dumbest thing that could work and measure it with the metric you will use for the model. The baseline gives the model something to beat, catches broken evaluation code (if the fancy model loses to <em>predict the majority class</em>, suspect your pipeline first), and often ships as the fallback when the model is down." },
          {
            t: "table",
            headers: ["Problem", "Baseline worth building first"],
            rows: [
              ["Recommendations", "Most popular in the user's region over the last 7 days"],
              ["Search ranking", "BM25 text match plus a freshness boost"],
              ["Fraud", "Velocity rules: more than N cards per device per hour"],
              ["Demand forecasting", "Same day last week, or a 4-week moving average"],
              ["Churn", "Days since last active, thresholded"]
            ]
          },
          {
            t: "code", lang: "python", code:
              "# a baseline is a model too: same split, same metric, same report\n" +
              "from sklearn.metrics import average_precision_score\n\n" +
              "baseline = (df_val.days_since_active > 14).astype(float)\n" +
              "print('baseline PR-AUC', average_precision_score(df_val.churned, baseline))\n" +
              "print('model    PR-AUC', average_precision_score(df_val.churned, model.predict_proba(X_val)[:, 1]))\n" +
              "# if the gap is small, the model's ongoing cost may not be worth it"
          },
          { t: "h", text: "What ML costs that rules do not" },
          { t: "p", html: "A model adds a training pipeline, a feature pipeline that must match between training and serving, monitoring for drift, a retraining schedule, and an on-call story for <em>the predictions got worse and nobody changed any code</em>. That is a standing tax. It is worth paying when the lift is large or the rules have become unmaintainable; it is not worth paying for a two-point gain over a heuristic nobody complains about." },
          {
            t: "table",
            headers: ["Tier", "Answer to 'should we use ML here?'", "Why"],
            rows: [
              ["<strong>Naive</strong>", "Yes, we have data, so train a deep model", "No baseline, no error budget, no plan for when it decays"],
              ["<strong>Solid</strong>", "Ship the heuristic, log outcomes, train a model once labels accumulate, launch if it beats the heuristic", "Measurable, incremental, and the heuristic remains the fallback"],
              ["<strong>Standout</strong>", "Solid, plus a stated error budget, the lift needed to justify the running cost, and which part stays rule-based by policy", "Treats ML as an investment with a hurdle rate rather than a default"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>No feedback loop, no learning.</strong> If you will never observe whether a prediction was right — a loan you denied never shows whether it would have defaulted — the model can only be as good as the day it shipped, and it inherits every bias in its original labels. Name that gap; it is a design constraint, not a footnote." },
          { t: "p", html: "In an interview this is the move that opens the round well: <a href='#/mlsd/framework/problem-framing'>framing the objective</a> starts with whether a model belongs here at all and what it has to beat." },
          { t: "cue", html: "Reach for this test when a prompt says <em>use AI to…</em> about something with a clear rule (eligibility, formatting, routing by a single field), or when the labels do not obviously exist. Saying <em>I would start with a heuristic baseline and log outcomes so we can earn the model</em> is a pragmatism signal interviewers look for." },
          { t: "note", variant: "key", html: "<strong>Use ML when there is a fuzzy pattern, labels, a feedback loop and room for error — and only after a baseline tells you what the model has to beat.</strong> The baseline is not a formality; it is the yardstick, the bug detector and the fallback." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "learning-types",
        title: "Learning setups and the label each one needs",
        summary: "Supervised, unsupervised, self-supervised, semi-supervised and bandit/RL framings — told apart by what feedback they learn from.",
        minutes: 10,
        tags: ["framing", "supervised", "unsupervised", "bandits"],
        blocks: [
          { t: "p", html: "The cleanest way to tell learning setups apart is not by algorithm but by <strong>what feedback the system gets</strong>. A correct answer per example? No answer at all? An answer the data supplies for free? A reward only for the action you actually took? Each answer gives you a different family of methods and a different labelling bill." },
          {
            t: "table",
            headers: ["Setup", "Feedback per example", "Typical tasks", "Label cost"],
            rows: [
              ["Supervised — classification", "The correct class", "Spam or not, fraud or not, which of 40 categories", "High unless labels come free from user actions"],
              ["Supervised — regression", "The correct number", "Delivery time, price, demand next week", "Often free: the number is observed later"],
              ["Unsupervised — clustering", "None", "Customer segments, grouping near-duplicate items", "Zero, but evaluation is hard"],
              ["Unsupervised — dimensionality reduction", "None", "Compressing 1,000 features to 50, visualization", "Zero"],
              ["Unsupervised — anomaly detection", "None (or a few known anomalies)", "Unusual transactions, failing machines", "Zero to start; analyst verdicts later"],
              ["Self-supervised", "A label manufactured from the data itself", "Predict the masked word, the next item, the other half of an image", "Zero human labels, lots of compute"],
              ["Semi-supervised", "A few true labels plus lots of unlabelled data", "Pseudo-labelling, consistency training", "Low"],
              ["Bandit / reinforcement", "A reward for the action taken only", "Which item to show, which price to offer, which route to take", "Free, but partial and biased by your own policy"]
            ]
          },
          { t: "h", text: "Supervised: the default when labels exist" },
          { t: "p", html: "Most production ML is supervised, and the hard part is almost never the algorithm. It is defining the label precisely — <em>a click within 30 minutes of impression, excluding clicks shorter than 2 seconds</em> — and making sure it is available for training at the time you would have made the prediction. A vague label produces a model that optimizes something nobody meant." },
          { t: "note", variant: "tip", html: "<strong>Regression or classification is often your choice.</strong> <em>Will this order arrive late?</em> (classification) and <em>how many minutes late?</em> (regression) are the same problem with different labels. Pick by what the product consumes: a yes/no badge wants a class; an ETA display wants a number, ideally with a quantile so you can show a range." },
          { t: "h", text: "Unsupervised: structure without answers" },
          { t: "p", html: "Clustering finds groups; dimensionality reduction finds a compact representation; anomaly detection finds points that do not fit. All three need no labels, which is the appeal, and all three are hard to evaluate for the same reason. A clustering is good only if someone downstream finds the clusters useful — so define that downstream use before you pick <em>k</em>." },
          { t: "h", text: "Self-supervised and semi-supervised: manufacturing labels" },
          { t: "p", html: "Self-supervised learning hides part of the input and asks the model to predict it. The learned representation — an <a href='#/mlsd/concepts/embeddings'>embedding</a> — then transfers to tasks with few labels. Semi-supervised learning starts from a small labelled set and exploits the unlabelled bulk, for example by training on the model's own confident predictions. The language-model end of this world belongs to Lumen (<a href='../llm-academy/index.html'>Lumen</a> covers LLM pre-training and fine-tuning); here the point is that a label budget of thousands can be enough when representations come from millions of unlabelled examples." },
          { t: "h", text: "Bandits and RL: learning from your own choices" },
          { t: "p", html: "When the system picks an action and only sees the outcome of that action, you are in bandit territory. Show item A, observe a click or not; you never learn what B would have earned. That partial feedback creates two needs a supervised framing ignores: <strong>exploration</strong> (sometimes show something uncertain so you learn about it) and <strong>logging the probability of each choice</strong> so you can correct for your own bias later. Full reinforcement learning adds state that your actions change over time — rare in product ML outside of robotics, games and some ads pacing problems." },
          {
            t: "compare",
            bad: { title: "Treating clicks as plain supervised labels", items: ["Model trains only on items it already chose to show", "Never learns about items it never showed", "Each retrain confirms the last model's beliefs", "Offline metrics look great, catalogue coverage shrinks"] },
            good: { title: "Treating clicks as bandit feedback", items: ["A small exploration slice shows uncertain items", "Logged propensity per impression", "Training reweights by inverse propensity", "Coverage tracked as a health metric"] }
          },
          {
            t: "code", lang: "text", code:
              "Same product, four framings — pick by the feedback you can get\n\n" +
              "Moderation, labels from reviewers      -> supervised classification\n" +
              "Moderation, no labels yet              -> anomaly scores to triage, reviewers create labels\n" +
              "Moderation, 2k labels + 50M posts      -> self-supervised embeddings + small classifier\n" +
              "Which warning banner to show           -> contextual bandit (reward = user did not report)"
          },
          { t: "note", variant: "trap", html: "<strong>Do not say reinforcement learning for a recommender unless you mean it.</strong> Interviewers will ask what the state, transition and long-horizon reward are. A contextual bandit — one decision, immediate reward, logged propensities — is the honest framing for most ranking surfaces, and the <a href='#/rank/dynamics/bandits'>bandits lesson</a> goes deep on it." },
          { t: "cue", html: "Listen for the feedback in the prompt. <em>We have historical outcomes</em> means supervised. <em>We have no labels</em> means anomaly detection or clustering first, plus a plan to collect labels. <em>Lots of raw data, few labels</em> means self-supervised representations. <em>The system chooses what users see</em> means bandit feedback — say exploration and propensities out loud." },
          { t: "note", variant: "key", html: "<strong>Name the setup by its feedback, not its algorithm.</strong> Correct answers per example is supervised; none is unsupervised; answers carved from the data is self-supervised; rewards only for what you chose is a bandit — and that last one needs exploration and logged propensities from day one." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "bias-variance",
        title: "Underfitting, overfitting and how to tell which",
        summary: "The bias-variance trade-off as a diagnostic: read two error numbers and a learning curve, then reach for the right fix.",
        minutes: 10,
        tags: ["framing", "generalization", "regularization"],
        blocks: [
          { t: "p", html: "A model can be wrong for two opposite reasons. It can be too simple to represent the pattern — <strong>high bias, underfitting</strong> — or flexible enough to memorize the noise in its training set — <strong>high variance, overfitting</strong>. The fixes are opposites too, which is why diagnosing before treating matters." },
          { t: "p", html: "Picture fitting a curve through 20 noisy points. A straight line misses the bend no matter how many points you add: bias. A degree-15 polynomial passes through every point and swings wildly between them: variance. Something in the middle follows the bend and ignores the jitter. <em>Capacity</em> is the dial between those extremes — number of parameters, tree depth, feature count, training time." },
          { t: "h", text: "The diagnosis table" },
          {
            t: "table",
            headers: ["Training error", "Validation error", "Diagnosis", "Reach for"],
            rows: [
              ["High", "High, close to training", "Underfitting (bias)", "More capacity, better features, train longer, less regularization"],
              ["Low", "Much higher than training", "Overfitting (variance)", "More data, regularization, early stopping, simpler model, augmentation"],
              ["Low", "Low, close to training", "Healthy", "Check slices and an out-of-time split before celebrating"],
              ["Low", "Suspiciously low, even below training", "Probably leakage or a broken split", "Audit features and the split — see the <a href='#/data/correctness/leakage-taxonomy'>leakage taxonomy</a>"],
              ["Fine", "Fine offline, bad in production", "Not a capacity problem", "Skew, drift or a proxy gap — see <a href='#/found/experiments/offline-online'>offline vs online</a>"]
            ]
          },
          { t: "note", variant: "tip", html: "Compare against a reference error, not zero. If expert humans disagree on 8% of labels, 9% validation error is close to the ceiling and the remaining work is mostly label quality. Knowing the irreducible error tells you whether you are fighting bias or just noise." },
          { t: "h", text: "Learning curves: the cheapest experiment you can run" },
          { t: "p", html: "Train on 10%, 25%, 50% and 100% of the data and plot training and validation error at each size. The shape tells you whether collecting more data is worth it — a question that can be worth months of labelling budget." },
          {
            t: "code", lang: "text", code:
              "Underfitting                        Overfitting\n" +
              "err                                 err\n" +
              " |  val  ‾‾‾‾‾‾‾‾‾‾‾‾               |  val  ‾‾‾\\___\n" +
              " |  train ______/‾‾‾‾                |              ‾‾‾\\___   (still falling)\n" +
              " |   (curves meet high, flat)       |  train ____________/   (gap narrows with data)\n" +
              " +--------------- data size         +--------------- data size\n\n" +
              "-> more data will not help         -> more data WILL help; so will regularization"
          },
          { t: "h", text: "Regularization: paying for simplicity" },
          {
            t: "ul", items: [
              "<strong>L2 (weight decay)</strong> adds λ·Σw² to the loss and shrinks every weight toward zero. Smooth, almost always on in neural nets.",
              "<strong>L1</strong> adds λ·Σ|w| and drives some weights exactly to zero — built-in feature selection for linear models.",
              "<strong>Early stopping</strong> halts training when validation loss stops improving. Free, effective, and the reason you always need a validation set separate from the test set.",
              "<strong>Dropout and augmentation</strong> inject noise so the network cannot rely on any single path or pixel.",
              "<strong>For trees</strong>: limit depth, require a minimum number of samples per leaf, lower the learning rate and add more trees, subsample rows and columns."
            ]
          },
          { t: "p", html: "Each of these trades a little training fit for better generalization, and λ (or depth, or dropout rate) is a hyperparameter you tune on validation data. Tuning it on the test set leaks the test set into the model — the number you report then overstates what production will see." },
          { t: "h2", text: "A note on double descent" },
          { t: "p", html: "Very large neural networks sometimes break the classic U-shaped curve: validation error rises as capacity approaches the point where the model can exactly fit the training data, then falls again as capacity keeps growing. You do not need the theory for a design round. You need the practical reading: in heavily over-parameterized deep models, <em>more parameters plus good regularization and lots of data</em> can generalize well, so do not assume bigger always means more overfitting. For tabular models and moderate data, the classic picture still holds." },
          {
            t: "compare",
            bad: { title: "Treating symptoms blindly", items: ["Validation is bad, so add more layers", "Training is bad, so add more data", "Tune regularization on the test set", "Never look at a learning curve"] },
            good: { title: "Diagnose, then treat", items: ["Compare train vs validation vs a reference error", "Plot a learning curve before buying labels", "Tune on validation, report on an untouched test split", "Rule out leakage and skew before blaming capacity"] }
          },
          { t: "note", variant: "warn", html: "<strong>A random split can hide overfitting.</strong> If the same user or the same week appears in both training and validation, the model can memorize user-specific or time-specific quirks and still score well. For interaction data, split by time or by entity — the <a href='#/mlsd/concepts/generalization'>generalization lesson</a> walks through why." },
          { t: "cue", html: "When an interviewer says <em>the model does great offline but poorly in production</em>, capacity is the last suspect. When they say <em>training loss is low but validation is much higher</em>, that is overfitting — name regularization, early stopping and more data, and mention a learning curve to decide which." },
          { t: "note", variant: "key", html: "<strong>Read two numbers before touching the model.</strong> High train and high validation error is bias — add capacity or features. Low train and high validation is variance — regularize, stop earlier, or add data. A learning curve tells you whether more data is worth buying." },
          { t: "quiz", id: "found-framing" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Module: Metrics that mean something
  ================================================================== */
  var MOD_METRICS = {
    id: "metrics",
    name: "Metrics that mean something",
    icon: "trend",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "confusion-matrix",
        title: "The confusion matrix and choosing a threshold",
        summary: "TP, FP, TN, FN; precision, recall, F1, Fβ and specificity; and how the cost of each error sets the threshold — with worked numbers.",
        minutes: 11,
        tags: ["metrics", "classification", "threshold"],
        blocks: [
          { t: "p", html: "A classifier usually outputs a score, and a <strong>threshold</strong> turns that score into a decision. Every decision lands in one of four cells. Every classification metric you will ever be asked about is just a different ratio of those four counts." },
          {
            t: "table",
            headers: ["", "Actually positive", "Actually negative"],
            rows: [
              ["<strong>Predicted positive</strong>", "TP — true positive (caught)", "FP — false positive (false alarm)"],
              ["<strong>Predicted negative</strong>", "FN — false negative (missed)", "TN — true negative (correctly ignored)"]
            ]
          },
          { t: "h", text: "The ratios, and the question each answers" },
          {
            t: "table",
            headers: ["Metric", "Formula", "Answers"],
            rows: [
              ["Precision", "TP / (TP + FP)", "When I flag something, how often am I right?"],
              ["Recall (TPR, sensitivity)", "TP / (TP + FN)", "Of everything real, how much did I catch?"],
              ["Specificity (TNR)", "TN / (TN + FP)", "Of everything innocent, how much did I leave alone?"],
              ["False positive rate", "FP / (FP + TN) = 1 − specificity", "How often do innocents get flagged?"],
              ["Accuracy", "(TP + TN) / all", "How often am I right overall? (Misleading under imbalance.)"],
              ["F1", "2·P·R / (P + R)", "Harmonic mean — high only if both P and R are high"],
              ["Fβ", "(1 + β²)·P·R / (β²·P + R)", "β &gt; 1 weights recall more; β &lt; 1 weights precision more"]
            ]
          },
          { t: "h", text: "Worked example: a fraud screen" },
          { t: "p", html: "10,000 transactions, 100 of them fraud. The model flags 300, and 80 of those are fraud." },
          {
            t: "code", lang: "text", code:
              "TP = 80     FP = 220\n" +
              "FN = 20     TN = 9,680\n\n" +
              "precision   = 80 / 300            = 26.7%\n" +
              "recall      = 80 / 100            = 80.0%\n" +
              "F1          = 2*.267*.8 / 1.067    = 0.40\n" +
              "specificity = 9,680 / 9,900       = 97.8%\n" +
              "accuracy    = 9,760 / 10,000      = 97.6%\n\n" +
              "the do-nothing model: accuracy = 9,900 / 10,000 = 99.0%  (recall 0%)"
          },
          { t: "note", variant: "trap", html: "<strong>The do-nothing model beats yours on accuracy.</strong> Under a 1% base rate, predicting <em>never fraud</em> scores 99%. Accuracy is dominated by the majority class and cannot see the work you care about. Report precision and recall — or PR-AUC — whenever positives are rare. The <a href='#/data/labels/class-imbalance'>class imbalance lesson</a> covers resampling and weighting." },
          { t: "h", text: "The threshold is a business decision" },
          { t: "p", html: "Raising the threshold flags fewer items: precision usually rises, recall always falls or stays the same. Lowering it does the opposite. There is no correct threshold in the abstract — there is a cheapest one, given what each error costs." },
          { t: "p", html: "Say a missed fraud costs $500 in chargeback and a false alarm costs $5 of analyst time. At the operating point above, cost = 20 × 500 + 220 × 5 = $11,100. If the model's scores are <a href='#/found/metrics/calibration'>calibrated probabilities</a>, the cost-minimizing rule falls straight out: flag when expected loss from ignoring exceeds expected loss from flagging." },
          {
            t: "code", lang: "text", code:
              "flag if  p * C_FN  >  (1 - p) * C_FP\n" +
              "     ->  p  >  C_FP / (C_FP + C_FN)\n\n" +
              "C_FN = $500, C_FP = $5   ->  flag if p > 5 / 505 ~= 0.0099\n" +
              "C_FN = $5,   C_FP = $500 ->  flag if p > 500 / 505 ~= 0.99"
          },
          { t: "p", html: "That formula only works if a score of 0.3 really means a 30% chance. If scores are not calibrated, choose the threshold empirically instead: sweep it on a validation set, compute cost at each point, and take the minimum. That is exactly what the widget below does." },
          { t: "widget", id: "foundThreshold" },
          { t: "note", variant: "tip", html: "In practice teams often fix one metric as a constraint and push the other: <em>maximize recall subject to precision ≥ 90%</em> for auto-removal, or <em>maximize precision subject to recall ≥ 95%</em> for a medical screen. That phrasing maps directly to a threshold you can pick on validation data and monitor in production." },
          {
            t: "compare",
            bad: { title: "Threshold by habit", items: ["0.5 because it is the default", "Chosen to maximize F1 with no cost discussion", "Never revisited after the base rate shifts", "One threshold for every market and segment"] },
            good: { title: "Threshold by cost", items: ["Error costs stated, even roughly", "Picked on validation data to minimize expected cost or meet a floor", "Re-checked when traffic mix or base rate moves", "Per-segment thresholds where costs genuinely differ"] }
          },
          { t: "cue", html: "Any prompt with <em>detect</em>, <em>flag</em>, <em>block</em> or <em>screen</em> wants a threshold discussion. Say which error is worse and by how much, name the metric you will hold as a floor, and say the threshold is chosen on validation data against that cost — not left at 0.5." },
          { t: "note", variant: "key", html: "<strong>Every classification metric is a ratio of four counts, and the threshold decides the counts.</strong> Price both errors, pick the threshold that minimizes cost or meets a floor, and never let accuracy speak for a rare class." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "roc-pr-curves",
        title: "ROC vs PR curves, and the base-rate trap",
        summary: "What AUC actually measures, why ROC is blind to class balance, and why precision-recall is the honest view for rare events.",
        minutes: 10,
        tags: ["metrics", "roc", "pr-auc", "imbalance"],
        blocks: [
          { t: "p", html: "A single threshold gives one confusion matrix. Sweep the threshold from 1 down to 0 and you get a whole family of them — a <strong>curve</strong>. The two curves everyone uses plot different pairs of ratios from those matrices, and the difference matters enormously when positives are rare." },
          {
            t: "table",
            headers: ["Curve", "x-axis", "y-axis", "Random model looks like"],
            rows: [
              ["ROC", "False positive rate", "True positive rate (recall)", "The diagonal; AUC = 0.5"],
              ["Precision-recall", "Recall", "Precision", "A flat line at the base rate π; AUC ≈ π"]
            ]
          },
          { t: "h", text: "What ROC-AUC means" },
          { t: "p", html: "The area under the ROC curve has a clean interpretation: <strong>the probability that a randomly chosen positive scores higher than a randomly chosen negative</strong>. AUC 0.5 is coin-flip ordering; 1.0 is perfect separation. It is threshold-free and purely about ranking, which makes it a good model-selection metric when you care about ordering." },
          {
            t: "code", lang: "python", code:
              "# ROC-AUC as a ranking probability, computed by brute force\n" +
              "import itertools\n" +
              "pairs = list(itertools.product(pos_scores, neg_scores))\n" +
              "auc = sum((p > n) + 0.5 * (p == n) for p, n in pairs) / len(pairs)\n" +
              "# equals sklearn.metrics.roc_auc_score on the same data"
          },
          { t: "h", text: "Why ROC ignores the base rate" },
          { t: "p", html: "TPR is computed only over positives and FPR only over negatives. Neither ratio mixes the two classes, so if you keep the model fixed and change how many negatives there are, both rates — and the whole ROC curve — stay put. Precision is different: its denominator, TP + FP, adds counts from both classes." },
          {
            t: "code", lang: "text", code:
              "precision = TPR * pi / (TPR * pi + FPR * (1 - pi))\n\n" +
              "same model, operating point TPR = 80%, FPR = 22.4%   (ROC-AUC ~ 0.87)\n\n" +
              "base rate pi = 50%  -> precision = .40   / (.40   + .112)  = 78%\n" +
              "base rate pi = 10%  -> precision = .08   / (.08   + .202)  = 28%\n" +
              "base rate pi =  1%  -> precision = .008  / (.008  + .222)  = 3.5%\n" +
              "base rate pi = 0.1% -> precision = .0008 / (.0008 + .224)  = 0.36%"
          },
          { t: "p", html: "Same model, same ROC curve, same AUC. At a 1% base rate, catching 80% of positives means roughly 28 false alarms for every real hit. If a human reviews each flag, that operating point is probably unaffordable, and ROC never warned you. Play with the base rate below and watch which curve moves." },
          { t: "widget", id: "foundCurves" },
          { t: "note", variant: "warn", html: "<strong>A high ROC-AUC on a rare-event problem can describe a useless model.</strong> FPR = 1% sounds tiny, but with a million negatives it is 10,000 false alarms. For fraud, abuse, defect detection, rare-disease screening — anything with positives under a few percent — report PR-AUC (average precision) and precision at the recall you need." },
          { t: "h", text: "Reading the PR curve" },
          {
            t: "ul", items: [
              "<strong>The baseline is π, not 0.5.</strong> A PR-AUC of 0.15 sounds bad and is excellent when π = 0.5%; it is 30 times better than random.",
              "<strong>PR-AUC values are not comparable across datasets with different base rates.</strong> Compare models on the same evaluation set only.",
              "<strong>The left end is noisy.</strong> At very high thresholds only a handful of items are flagged, so precision jumps around. Do not over-read it.",
              "<strong>Pick the operating point, not just the area.</strong> <em>Precision at 80% recall</em> or <em>recall at 95% precision</em> is what the product actually experiences."
            ]
          },
          {
            t: "compare",
            bad: { title: "ROC-AUC for everything", items: ["0.95 AUC reported for a 0.1% fraud rate", "No precision number anywhere", "Ops team discovers 50 false alarms per hit after launch", "Model comparison flattered by easy negatives"] },
            good: { title: "Metric matched to base rate", items: ["ROC-AUC for balanced ranking or model selection", "PR-AUC plus precision at target recall for rare events", "Base rate stated next to every PR number", "Operating point translated into reviews per day"] }
          },
          { t: "p", html: "The <a href='#/mlsd/concepts/evaluation'>evaluation lesson in the interview track</a> places these metrics on the wider ladder from offline metric to business outcome; the next lesson here handles ordered lists, where neither curve is quite the right tool." },
          { t: "cue", html: "The moment a prompt mentions something rare — fraud, abuse, defects, a 1-in-1,000 event — say <em>ROC-AUC will look flattering here because it ignores the base rate; I would report PR-AUC and precision at the recall the reviewers can handle.</em> That single sentence is one of the most reliable credibility signals in an ML round." },
          { t: "note", variant: "key", html: "<strong>ROC-AUC is a ranking probability that does not care about class balance; precision does.</strong> For rare positives, judge the model by PR-AUC and precision at the recall you need, and translate that into false alarms per real hit." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "ranking-metrics",
        title: "Ranking metrics: precision@k to NDCG",
        summary: "How to score an ordered list — precision@k, recall@k, MAP, MRR and NDCG with a worked computation — and the traps in offline ranking evaluation.",
        minutes: 11,
        tags: ["metrics", "ranking", "ndcg", "search"],
        blocks: [
          { t: "p", html: "Search results, feeds and recommendations are lists, and users mostly look at the top. A good ranking metric therefore rewards putting the best items <em>first</em>, cares little about position 80, and copes with the fact that you only know the relevance of some items." },
          { t: "h", text: "The family, from simplest to richest" },
          {
            t: "table",
            headers: ["Metric", "Relevance type", "What it rewards", "Use when"],
            rows: [
              ["Precision@k", "Binary", "Fraction of the top k that are relevant", "A fixed-size shelf, e.g. 10 slots"],
              ["Recall@k", "Binary", "Fraction of all relevant items found in the top k", "Candidate retrieval — did the good items survive to ranking?"],
              ["MRR", "Binary", "1 / rank of the first relevant item", "One right answer matters: navigational search, Q&amp;A"],
              ["MAP", "Binary", "Average of precision at every relevant hit", "Many relevant items, order of all of them matters"],
              ["NDCG@k", "Graded (0-3, etc.)", "Discounted gain vs the ideal order", "Relevance has levels; top positions dominate"]
            ]
          },
          { t: "h", text: "MRR and MAP in two lines each" },
          {
            t: "code", lang: "text", code:
              "MRR over 3 queries, first relevant result at ranks 1, 3, none:\n" +
              "  (1/1 + 1/3 + 0) / 3 = 0.444\n\n" +
              "AP for one query, ranked relevance [1, 0, 1, 0, 1], 3 relevant total:\n" +
              "  precision at each hit: 1/1, 2/3, 3/5\n" +
              "  AP = (1.000 + 0.667 + 0.600) / 3 = 0.756\n" +
              "MAP = mean of AP over all queries"
          },
          { t: "h", text: "NDCG, worked end to end" },
          { t: "p", html: "NDCG handles graded relevance. Each result earns a <strong>gain</strong> (commonly 2<sup>rel</sup> − 1, so a grade-3 item is worth far more than a grade-1) and the gain is <strong>discounted</strong> by position, 1 / log₂(rank + 1). Sum to get DCG, then divide by the DCG of the ideal ordering of the same items." },
          {
            t: "code", lang: "text", code:
              "ranked grades : [3, 2, 0, 1, 2]\n" +
              "gains 2^r - 1 : [7, 3, 0, 1, 3]\n" +
              "discount      : [1.000, 0.631, 0.500, 0.431, 0.387]\n\n" +
              "DCG  = 7(1.000) + 3(0.631) + 0(0.500) + 1(0.431) + 3(0.387)\n" +
              "     = 7.000 + 1.893 + 0 + 0.431 + 1.161  = 10.484\n\n" +
              "ideal grades  : [3, 2, 2, 1, 0]  -> gains [7, 3, 3, 1, 0]\n" +
              "IDCG = 7.000 + 1.893 + 1.500 + 0.431 + 0  = 10.824\n\n" +
              "NDCG@5 = 10.484 / 10.824 = 0.969"
          },
          { t: "p", html: "The list loses about 3% because a grade-2 result sits at position 5, under a grade-0 and a grade-1. Swap positions 3 and 5 and NDCG becomes 1.0. Note how little the bottom matters: the same mistake at positions 1 and 2 would cost far more." },
          { t: "note", variant: "tip", html: "<strong>Graded or binary?</strong> Binary relevance (clicked or not) is cheap and plentiful but flattens <em>perfect</em> and <em>acceptable</em> into one bucket. Graded relevance from human raters or richer signals (purchase > add-to-cart > click) separates good from great, which is what top-of-list quality is about. Many teams use graded human labels for offline NDCG and binary engagement for online metrics." },
          { t: "h", text: "Offline ranking evaluation pitfalls" },
          {
            t: "ul", items: [
              "<strong>Unlabelled items are not irrelevant.</strong> If the new ranker surfaces items nobody ever rated, treating them as zero penalizes exactly the novelty you wanted. Report how many top-k items are unjudged.",
              "<strong>Logged clicks carry position bias.</strong> Items shown at rank 1 get clicked partly because they were at rank 1. Evaluating a new ranker on old clicks rewards it for agreeing with the old ranker.",
              "<strong>Averages hide head and tail.</strong> Mean NDCG is dominated by frequent, easy queries. Slice by query frequency, by new vs returning users, by locale.",
              "<strong>Match k to the surface.</strong> NDCG@100 for a mobile screen that shows 4 results measures something users never see.",
              "<strong>Recall@k is a retrieval metric, NDCG a ranking metric.</strong> Use each at the stage where it applies in the <a href='#/rank/retrieval/ranking-funnel'>ranking funnel</a>."
            ]
          },
          {
            t: "compare",
            bad: { title: "Ranking eval that misleads", items: ["One metric, averaged over all queries", "Unjudged items silently scored as irrelevant", "Evaluated on clicks logged by the old ranker", "k chosen by default, not by screen size"] },
            good: { title: "Ranking eval you can defend", items: ["NDCG@k with k = visible slots, plus recall@k for retrieval", "Unjudged rate reported; gaps filled by rater labels", "Debiased with position weighting or confirmed by <a href='#/found/experiments/interleaving'>interleaving</a>", "Sliced by query frequency and user cohort"] }
          },
          { t: "p", html: "Learning-to-rank losses that optimize these metrics directly — pairwise and listwise objectives — live in the <a href='#/rank/ranking/learning-to-rank'>Search, Ranking &amp; Recs track</a>." },
          { t: "cue", html: "When the output is a list, never answer with accuracy or AUC alone. Say <em>recall@k for the retrieval stage, NDCG@k at the ranking stage with k equal to the visible slots</em>, and mention position bias in logged clicks. Use MRR when there is one right answer, such as navigational queries." },
          { t: "note", variant: "key", html: "<strong>Ranking metrics reward getting the top right.</strong> Use recall@k to judge retrieval, NDCG@k for graded ranking quality, MRR when one answer matters — and distrust offline numbers built on clicks the old ranker caused." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "calibration",
        title: "Calibration: when the number itself matters",
        summary: "Reliability diagrams, ECE, Platt, isotonic and temperature scaling — and why ads, auctions and cost-based thresholds cannot live without calibrated probabilities.",
        minutes: 10,
        tags: ["metrics", "calibration", "ads", "probability"],
        blocks: [
          { t: "p", html: "A model is <strong>calibrated</strong> when its scores mean what they say: of all the items it scores 0.3, about 30% turn out positive. Calibration is a separate property from <strong>discrimination</strong> — how well the model ranks positives above negatives. A model can rank perfectly and still be badly miscalibrated, and AUC will never tell you." },
          {
            t: "table",
            headers: ["", "Discrimination", "Calibration"],
            rows: [
              ["Question", "Does it put positives above negatives?", "Does a score of p mean probability p?"],
              ["Metric", "ROC-AUC, PR-AUC, NDCG", "Reliability diagram, ECE, log loss, Brier score"],
              ["Changed by monotone rescaling?", "No", "Yes — that is how you fix it"],
              ["Matters most for", "Ordering a list, picking the top k", "Bids, expected values, thresholds from costs, combining models"]
            ]
          },
          { t: "h", text: "Reliability diagrams and ECE" },
          { t: "p", html: "Bucket predictions by score (say ten bins of width 0.1), and for each bin plot the mean predicted probability against the observed positive rate. A calibrated model lies on the diagonal. Points below it mean overconfidence; above it, underconfidence. <strong>Expected calibration error</strong> summarizes the diagram as the traffic-weighted average gap." },
          {
            t: "code", lang: "text", code:
              "ECE = sum over bins  (n_b / N) * | observed_rate_b - mean_predicted_b |\n\n" +
              "bin   n     predicted  observed  gap\n" +
              "0.1   500   0.10       0.08      0.02\n" +
              "0.5   300   0.50       0.40      0.10\n" +
              "0.9   200   0.90       0.75      0.15\n\n" +
              "ECE = 0.5(0.02) + 0.3(0.10) + 0.2(0.15) = 0.010 + 0.030 + 0.030 = 0.07\n" +
              "-> overconfident at the top end, which is where expensive decisions live"
          },
          { t: "note", variant: "warn", html: "ECE depends on the binning and can look small when most traffic sits in one low bin. Pair it with log loss (which punishes confident mistakes hard) and look at the diagram itself, sliced by segment — a model calibrated on average can be badly off for new users or one country." },
          { t: "h", text: "Why miscalibration happens" },
          {
            t: "ul", items: [
              "<strong>Negative downsampling.</strong> Training on 10% of negatives inflates the apparent positive rate, so raw predictions are too high.",
              "<strong>Class weights</strong> do the same thing on purpose.",
              "<strong>Modern deep nets</strong> trained to minimize loss for many epochs tend to be overconfident.",
              "<strong>Boosted trees and max-margin models</strong> produce scores, not probabilities, and are often S-shaped against the diagonal.",
              "<strong>Distribution shift.</strong> A model calibrated last quarter drifts when the base rate moves — monitor it like any other metric."
            ]
          },
          { t: "h", text: "Fixing it: three standard recalibrators" },
          {
            t: "table",
            headers: ["Method", "How it works", "Strengths", "Costs"],
            rows: [
              ["Platt scaling", "Fit a logistic regression σ(a·s + b) on held-out scores", "Two parameters, works with little data", "Assumes an S-shaped miscalibration"],
              ["Isotonic regression", "Fit a monotone step function from score to observed rate", "Fixes any monotone distortion", "Needs more data; can overfit and produce ties"],
              ["Temperature scaling", "Divide logits by a single T before the softmax", "One parameter, standard for neural nets, keeps argmax", "Only fixes uniform over- or under-confidence"]
            ]
          },
          { t: "p", html: "All three are monotone, so they leave ranking — and therefore AUC — unchanged. Fit them on a held-out calibration set, never on the training data, and refit whenever the model is retrained." },
          {
            t: "code", lang: "python", code:
              "from sklearn.calibration import CalibratedClassifierCV\n\n" +
              "# isotonic on held-out folds; use method='sigmoid' for Platt scaling\n" +
              "cal = CalibratedClassifierCV(base_model, method='isotonic', cv=5).fit(X_tr, y_tr)\n\n" +
              "# undo negative downsampling at rate w (kept fraction of negatives)\n" +
              "def correct(p, w):\n" +
              "    return p / (p + (1 - p) / w)\n" +
              "correct(0.20, 0.1)   # -> 0.0244"
          },
          { t: "h", text: "Where calibration is non-negotiable" },
          {
            t: "ul", items: [
              "<strong>Ads and auctions.</strong> Expected value per impression is pCTR × bid. Overestimate pCTR by 2x and you overcharge or overspend; compare two advertisers' models and the better-calibrated one wins unfairly. See <a href='#/mlcase/recsys/ad-click-prediction'>ad click prediction</a>.",
              "<strong>Cost-based thresholds.</strong> The <a href='#/found/metrics/confusion-matrix'>flag if p &gt; C_FP / (C_FP + C_FN)</a> rule is only valid if p is a real probability.",
              "<strong>Combining scores.</strong> Multi-objective ranking that adds P(click) and P(purchase) with weights assumes both are on a meaningful scale.",
              "<strong>Showing a probability to people.</strong> A 90% confidence badge that is right 60% of the time destroys trust fast."
            ]
          },
          {
            t: "compare",
            bad: { title: "Score treated as probability", items: ["Downsampled model's outputs fed straight to the bidder", "AUC reported as proof it is fine", "Calibration checked once at launch", "One global calibrator for every market"] },
            good: { title: "Probability earned", items: ["Downsampling correction plus a held-out recalibrator", "Reliability diagram and log loss reported next to AUC", "Calibration drift alerted like any other metric", "Per-segment check where base rates differ"] }
          },
          { t: "cue", html: "Raise calibration unprompted whenever a prediction feeds arithmetic: an auction, an expected-value calculation, a cost-based threshold, a weighted blend of model outputs, or a number shown to a user. Say <em>AUC tells me the ordering is good; I also need the reliability diagram because the value itself drives the bid.</em>" },
          { t: "note", variant: "key", html: "<strong>Discrimination is about order; calibration is about meaning.</strong> Whenever a score is multiplied, compared to a cost, or shown to a person, check the reliability diagram, correct for sampling, and recalibrate on held-out data with Platt, isotonic or temperature scaling." },
          { t: "quiz", id: "found-metrics" }
        ]
      }
    ]
  };

  /* ==================================================================
     7. Module: Offline to online
  ================================================================== */
  var MOD_EXPERIMENTS = {
    id: "experiments",
    name: "Offline to online",
    icon: "bolt",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "offline-online",
        title: "Why offline wins do not always ship",
        summary: "The proxy gap between offline metrics and online outcomes, holdouts and backtests, and a first look at off-policy evaluation with inverse propensity scoring.",
        minutes: 10,
        tags: ["experiments", "evaluation", "off-policy"],
        blocks: [
          { t: "p", html: "Every team eventually ships a model that improved offline NDCG by four points and moved the online metric by nothing — or moved it backwards. That is not bad luck. Offline evaluation answers <em>does the new model agree better with labels we logged in the past?</em> Online evaluation answers <em>does the product get better when real users react to it?</em> Those are different questions." },
          { t: "h", text: "Five reasons the two disagree" },
          {
            t: "table",
            headers: ["Gap", "What happens", "Example"],
            rows: [
              ["Proxy gap", "The offline metric is a stand-in for what the business wants", "Better click prediction, but more clickbait and lower retention"],
              ["Logging bias", "Offline labels exist only for items the old system chose to show", "New model favours items nobody ever saw, so it cannot get credit"],
              ["Training-serving skew", "Features differ between the offline table and the live request", "A feature is computed daily offline but hourly online"],
              ["Feedback and interaction", "Users react to the new ranking; the ecosystem changes", "Creators adapt to what is promoted within weeks"],
              ["Saturation", "Gains on easy cases users already handle", "Better ranking at position 40 that nobody scrolls to"]
            ]
          },
          { t: "note", variant: "tip", html: "Before running an A/B test, check that offline improvements <em>historically</em> predict online ones. Plot past launches: offline delta on one axis, online delta on the other. If the correlation is weak, your offline metric is a filter for obvious regressions, not a forecast." },
          { t: "h", text: "Honest offline evaluation" },
          {
            t: "ul", items: [
              "<strong>Out-of-time holdout.</strong> Train on weeks 1-8, validate on week 9, test on week 10. Never let the future leak into training — see the <a href='#/mlsd/concepts/generalization'>generalization lesson</a>.",
              "<strong>Backtesting.</strong> Repeat that split across several rolling windows. A model that wins on one window and loses on three is not a winner.",
              "<strong>Slice everything.</strong> New users, cold items, small markets, low-end devices. Averages hide the regressions that become incidents.",
              "<strong>Long-term holdout.</strong> Keep a small slice of users (1-5%) on the old system for months to measure cumulative effects that a two-week test cannot see."
            ]
          },
          { t: "h", text: "Off-policy evaluation: asking what-if of logged data" },
          { t: "p", html: "Suppose the old policy chose items with known probabilities and you logged them. You can estimate how a <em>new</em> policy would have performed by reweighting the logged rewards: each logged action counts more if the new policy would choose it more often than the old one did. That is <strong>inverse propensity scoring (IPS)</strong>." },
          {
            t: "code", lang: "text", code:
              "V_new ~= (1/n) * sum_i  r_i * pi_new(a_i | x_i) / pi_log(a_i | x_i)\n\n" +
              "example: old policy showed item A with prob 0.5, got a click (r = 1)\n" +
              "         new policy would show A with prob 0.9\n" +
              "         weight = 0.9 / 0.5 = 1.8  -> this click counts 1.8x\n\n" +
              "if pi_log(a) = 0.01 and pi_new(a) = 0.5 -> weight 50: one lucky click dominates"
          },
          { t: "note", variant: "warn", html: "<strong>IPS is unbiased only if propensities were logged at decision time and every action the new policy takes had a non-zero chance under the old one.</strong> A deterministic old ranker gives you nothing to reweight. Large weights cause huge variance, which teams tame by clipping weights or using doubly robust estimators that combine IPS with a reward model." },
          {
            t: "compare",
            bad: { title: "Offline as a forecast", items: ["Random split on interaction data", "One aggregate metric", "Logged clicks treated as ground truth", "Ship if offline improves"] },
            good: { title: "Offline as a gate", items: ["Out-of-time split and rolling backtests", "Sliced metrics with regression thresholds", "Propensities logged; IPS where exploration exists", "Ship to an online test if offline does not regress"] }
          },
          { t: "p", html: "The online test that settles the question is the subject of the <a href='#/found/experiments/ab-test-design'>next lesson</a>; the interview-level view is in <a href='#/mlsd/concepts/ab-testing'>online testing</a>. Rolling a model out safely — shadow, canary, ramp — is covered in the <a href='#/ops/inference/safe-rollouts'>MLOps track</a>." },
          { t: "cue", html: "When asked <em>how do you know the model is better?</em>, answer in two layers: offline as a gate (out-of-time split, slices, no regressions) and online as the evidence (an A/B test on the business metric). Mention logging propensities if the system chooses what users see — it is what makes off-policy evaluation possible later." },
          { t: "note", variant: "key", html: "<strong>Offline metrics measure agreement with the past; online tests measure the product.</strong> Use honest out-of-time offline evaluation as a gate, log propensities so you can ask what-if questions with IPS, and let the online experiment make the decision." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "ab-test-design",
        title: "Designing an A/B test that can answer the question",
        summary: "Randomization unit, MDE, power and alpha, the sample size formula, duration, peeking, SRM checks, guardrails and CUPED — with a calculator.",
        minutes: 12,
        tags: ["experiments", "ab-testing", "statistics"],
        blocks: [
          { t: "p", html: "An A/B test randomly splits traffic between the current system (control) and the new one (treatment) and compares a metric. Randomization is what makes the comparison causal: any difference beyond noise must come from the change. Most failed experiments did not fail at the statistics — they failed at design, before a single user was assigned." },
          { t: "h", text: "Six decisions to make before launch" },
          {
            t: "ol", items: [
              "<strong>Unit of randomization.</strong> Usually the user, so one person sees one experience. Requests are cheaper but leak across arms; sessions sit in between. For marketplaces or social features where users affect each other, randomize by region or cluster.",
              "<strong>Primary metric.</strong> One metric decides; write it down. Pick something sensitive enough to move in weeks.",
              "<strong>Guardrails.</strong> Metrics that must not regress: latency, error rate, unsubscribes, revenue per user, complaint rate.",
              "<strong>Minimum detectable effect (MDE).</strong> The smallest lift worth detecting. Smaller MDE means more users.",
              "<strong>Alpha and power.</strong> Typically α = 0.05 (5% false positive rate) and 80% power (80% chance to detect a true effect of size MDE).",
              "<strong>Duration.</strong> Computed from sample size and traffic, rounded up to whole weeks."
            ]
          },
          { t: "h", text: "Sample size, from the formula" },
          { t: "p", html: "For a two-sided test at α = 0.05 with 80% power, a handy approximation for users per arm is <strong>n ≈ 16·σ² / δ²</strong>, where σ² is the metric variance and δ the absolute effect you want to detect. The 16 comes from (1.96 + 0.84)² × 2 ≈ 15.7. For a conversion rate p, the variance is p(1 − p)." },
          {
            t: "code", lang: "text", code:
              "n per arm = (z_{1-a/2} + z_power)^2 * 2 * p(1-p) / delta^2\n\n" +
              "baseline p = 5%, relative MDE = 5%  -> delta = 0.05 * 0.05 = 0.0025\n" +
              "n = 7.84 * 2 * 0.05 * 0.95 / 0.0025^2\n" +
              "  = 7.84 * 0.095 / 0.00000625\n" +
              "  ~= 119,000 users per arm   (~238,000 total)\n\n" +
              "halve the MDE (2.5%)  -> 4x the users (~477,000 per arm)\n" +
              "90% power (z = 1.28)  -> ~1.34x the users"
          },
          { t: "widget", id: "foundSampleSize" },
          { t: "note", variant: "tip", html: "Sample size scales with 1/δ². That inverse square is why a team with 10,000 daily users cannot measure a 1% lift on a 2% conversion rate in any reasonable time — and why the honest answer is often <em>pick a more sensitive metric</em> rather than <em>run it longer</em>." },
          { t: "h", text: "Duration and novelty" },
          { t: "p", html: "Run for at least one full week, ideally two, even if the numbers say you could stop sooner: weekday and weekend users behave differently. Visible changes also produce <strong>novelty effects</strong> (users poke at something new, then lose interest) or <strong>change aversion</strong> (the reverse). Plot the treatment effect by day; if it is still trending, the test is not done." },
          { t: "h", text: "Peeking" },
          { t: "p", html: "If you check the p-value every day and stop the first time it dips below 0.05, the real false positive rate can climb to several times 5%, because each look is another chance for noise to cross the line. Either fix the duration in advance and look once, or use a sequential testing method built for continuous monitoring." },
          { t: "note", variant: "trap", html: "<strong>Check sample ratio mismatch before reading any metric.</strong> If the design is 50/50 and you got 506,000 vs 494,000 users out of a million, a chi-square test gives a statistic near 144 — essentially impossible by chance. Something (a redirect, a crash, a bot filter, a logging bug) is dropping users from one arm, and it is probably correlated with your metric. Stop and debug; do not reweight." },
          { t: "h", text: "CUPED: same answer, fewer users" },
          { t: "p", html: "Much of a metric's variance is just users being different from each other. CUPED subtracts the part predictable from each user's <em>pre-experiment</em> behaviour, which shrinks variance without biasing the effect, because pre-period data cannot be affected by treatment." },
          {
            t: "code", lang: "text", code:
              "Y_adj = Y - theta * (X - mean(X))       X = same metric, pre-period\n" +
              "theta = cov(X, Y) / var(X)\n\n" +
              "var(Y_adj) = var(Y) * (1 - rho^2)\n" +
              "rho = 0.6  -> variance x 0.64  -> ~36% fewer users for the same power\n" +
              "rho = 0.8  -> variance x 0.36  -> ~64% fewer users"
          },
          {
            t: "table",
            headers: ["Tier", "Experiment plan", "Why"],
            rows: [
              ["<strong>Naive</strong>", "Launch to 50%, watch the dashboard, ship when it looks green", "No MDE, no duration, peeking guaranteed, no guardrails"],
              ["<strong>Solid</strong>", "User-level randomization, one primary metric, guardrails, sample size from MDE, fixed two-week duration, SRM check", "Answers the question it set out to ask"],
              ["<strong>Standout</strong>", "Solid, plus CUPED, a novelty check by day, interference analysis for shared resources, and a long-term holdout", "Fewer users, fewer surprises, and evidence about effects a two-week test cannot see"]
            ]
          },
          { t: "p", html: "The interview-track take, including interference between arms, is in <a href='#/mlsd/concepts/ab-testing'>online testing</a>. For ranking changes specifically there is a much more sensitive option: <a href='#/found/experiments/interleaving'>interleaving</a>." },
          { t: "cue", html: "When asked <em>how would you test this?</em>, list the six decisions in order: unit, primary metric, guardrails, MDE, power and alpha, duration. Then add <em>I would check sample ratio mismatch first and fix the duration in advance so we are not peeking</em>. If traffic is small, mention CUPED or a more sensitive metric before suggesting a longer test." },
          { t: "note", variant: "key", html: "<strong>Size the test before you start it.</strong> n per arm ≈ 16·p(1−p)/δ², rounded up to whole weeks; one primary metric, guardrails, an SRM check before reading anything, no peeking — and CUPED when users are scarce." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "interleaving",
        title: "Interleaving: a sharper test for rankers",
        summary: "How team-draft interleaving works, why it needs far less traffic than an A/B test for ranking changes, and where it cannot help.",
        minutes: 8,
        tags: ["experiments", "interleaving", "ranking"],
        blocks: [
          { t: "p", html: "An A/B test shows each user one ranker and compares groups of users. Most of the noise comes from users being different: heavy users click more than light ones no matter what you show them. <strong>Interleaving</strong> removes that noise by showing <em>each</em> user a single list that mixes results from both rankers, then seeing whose results they click." },
          { t: "h", text: "Team-draft interleaving, step by step" },
          {
            t: "ol", items: [
              "Ranker A and ranker B each produce their own ordered list for the query.",
              "Each round, flip a coin to decide which ranker picks first.",
              "The picking ranker adds its highest-ranked result that is not already in the merged list, and that slot is tagged with its team. Then the other ranker does the same.",
              "Repeat until the merged list is full, then show it to the user.",
              "Credit each click to the team that contributed that result. The ranker with more credited clicks wins that query; aggregate wins over many queries."
            ]
          },
          {
            t: "code", lang: "text", code:
              "A: [d1, d2, d3, d4]       B: [d2, d5, d1, d6]\n\n" +
              "round 1: coin -> A first   A adds d1 (team A)   B adds d2 (team B)\n" +
              "round 2: coin -> B first   B adds d5 (team B)   A adds d3 (team A)\n" +
              "shown  : [d1(A), d2(B), d5(B), d3(A)]\n\n" +
              "user clicks d2 and d5 -> B: 2, A: 0 -> B wins this query\n" +
              "over 50,000 queries: B wins 52.1%, A wins 46.3%, ties 1.6%"
          },
          { t: "p", html: "The coin flip matters: without it, the ranker that always picks first would grab the top slot and win from position bias alone. With it, each ranker gets the top slot about half the time, and position bias cancels out on average." },
          { t: "h", text: "Why it is so sensitive" },
          { t: "p", html: "Because the comparison happens within one user and one query, the between-user variance that dominates an A/B test disappears. Teams that run both commonly report that interleaving reaches a confident verdict with one to two orders of magnitude less traffic — often quoted as 10x to 100x — for ranking changes. That turns a four-week A/B test into a few days, or lets you screen many candidates instead of one." },
          { t: "stat", items: [
            { v: "10-100x", k: "less traffic, commonly reported" },
            { v: "1 list", k: "per user, both rankers mixed" },
            { v: "per query", k: "unit of comparison" }
          ] },
          { t: "note", variant: "warn", html: "<strong>Interleaving measures preference, not business impact.</strong> It tells you users click B's results more than A's in a mixed list. It cannot tell you what happens to revenue, retention or session length when users see only B, because nobody ever does. It also only works when both systems output a list over a shared pool of items." },
          {
            t: "table",
            headers: ["", "Interleaving", "A/B test"],
            rows: [
              ["Unit of comparison", "Query, within one user", "User group vs user group"],
              ["Traffic needed", "Small", "Large"],
              ["Measures", "Relative preference between two rankers", "Absolute effect on any metric"],
              ["Works for", "Ranking and retrieval changes", "Anything: UI, pricing, ranking, policy"],
              ["Cannot measure", "Revenue, retention, whole-page effects", "Small ranking differences cheaply"]
            ]
          },
          { t: "h", text: "How teams use it" },
          { t: "p", html: "The common pattern is a two-stage funnel for experiments. Interleave to screen several candidate rankers quickly and cheaply; discard the losers; then run a properly sized <a href='#/found/experiments/ab-test-design'>A/B test</a> on the winner to measure the business metric and the guardrails. Multileaving extends the same idea to more than two rankers at once." },
          {
            t: "compare",
            bad: { title: "Interleaving misused", items: ["Used to claim a revenue lift", "Applied to a UI redesign", "No coin flip, so one ranker always picks first", "Ships the winner without an A/B confirmation"] },
            good: { title: "Interleaving used well", items: ["Screens ranking candidates in days", "Randomized pick order cancels position bias", "Reports win rate with a confidence interval", "Winner confirmed in an A/B test on business metrics"] }
          },
          { t: "p", html: "Interleaving pairs naturally with the offline <a href='#/found/metrics/ranking-metrics'>ranking metrics</a>: offline NDCG filters out obvious regressions, interleaving picks the best candidate, and an A/B test confirms the impact. The ranking models themselves are covered in <a href='#/rank/ranking/learning-to-rank'>learning to rank</a>." },
          { t: "cue", html: "Reach for interleaving when the change is a ranker or retriever, traffic is limited, or you have several candidates to compare. Say <em>I would interleave to pick the best candidate quickly, then confirm the winner with an A/B test on the business metric</em> — it shows you know both its power and its limit." },
          { t: "note", variant: "key", html: "<strong>Interleaving compares two rankers inside one list for each user, which removes between-user noise and needs far less traffic.</strong> Use it to screen ranking candidates fast; confirm business impact with an A/B test, because interleaving only measures preference." },
          { t: "quiz", id: "found-experiments" }
        ]
      }
    ]
  };

  /* ==================================================================
     8. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.found = {
    id: "found",
    name: "ML Foundations",
    short: "Found",
    tagline: "The ideas every ML design answer stands on",
    color: "#38bdf8",
    blurb: "The groundwork software engineers need before an ML design conversation makes sense. Start by deciding whether a problem deserves a model at all, which learning setup fits the feedback you actually have, and how to tell underfitting from overfitting with two numbers and a learning curve. Then the metrics that keep you honest: the confusion matrix and cost-based thresholds, why ROC flatters rare-event models while precision-recall does not, how to score a ranked list with NDCG, and when calibration matters more than ranking. Closes with the bridge from offline to online — why offline wins fail to ship, how to size an A/B test before launching it, and how interleaving compares rankers with a fraction of the traffic. Three hands-on labs make the numbers concrete.",
    modules: [MOD_FRAMING, MOD_METRICS, MOD_EXPERIMENTS]
  };
})();
