/* =====================================================================
   SYNAPSE · ML Problem Breakdowns
   window.TRACKS.mlcase  +  QUIZZES["mlcase-*"]  +  Widgets.mlcaseThreshold

   Thirteen full design walkthroughs across four modules (recsys, trust,
   retrieval, forecast). Every lesson runs the same eight beats:
     1. the ask + clarifying questions      5. high-level design (offline/online)
     2. requirements as measured targets    6. data, features, label
     3. objective ladder  Naive/Solid/Standout    7. evaluation + deep dives
     4. model ladder      Naive/Solid/Standout    8. Mid/Senior/Staff bar + key note

   The concepts these pages apply live in the mlsd track; this track is where
   you spend them on real problems.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================== */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag), k, i, kid;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (attrs[k] == null) continue;
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      }
    }
    for (i = 2; i < arguments.length; i++) {
      kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function fmt(n) {
    var s = String(Math.round(n)), out = "", c = 0, i;
    for (i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = "," + out;
    }
    return out;
  }
  function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1) + "%"; }

  /* ---- fixed synthetic score distributions (20 bins of width 0.05) ----
     pos[i] / neg[i] = count of truly-positive / truly-negative items whose
     model score fell in bin i, i.e. in [i/20, (i+1)/20).
     Each array is built so per-bin precision rises monotonically with the
     score. That guarantees the pedagogy holds: raising the threshold always
     raises precision and always lowers recall. Numbers are illustrative,
     not measurements. */
  var BINS = 20, BAND = 3; /* review band = 3 bins = 0.15 wide, below the cut */

  var SCENARIOS = [
    {
      key: "harm",
      tab: "harmful content",
      unit: "posts",
      floor: 0.95,
      cap: 3000,
      bandName: "queued for human review",
      wrong: "authors whose posts were taken down for nothing",
      slip: "harmful posts stay up and keep collecting views",
      neg: [46000, 20000, 12000, 7000, 4500, 3000, 2000, 1400, 950, 650, 430, 300, 200, 140, 95, 60, 40, 24, 12, 4],
      pos: [4, 6, 9, 13, 18, 25, 34, 46, 62, 80, 100, 120, 140, 160, 180, 200, 230, 280, 350, 420]
    },
    {
      key: "bot",
      tab: "bot detection",
      unit: "accounts",
      floor: 0.98,
      cap: 1500,
      bandName: "sent a challenge / rate limit",
      wrong: "real people locked out of their own accounts",
      slip: "automated accounts keep operating at full speed",
      neg: [38000, 19000, 12000, 8000, 5500, 4000, 3000, 2200, 1600, 1150, 820, 580, 400, 280, 190, 130, 85, 50, 25, 8],
      pos: [10, 15, 24, 38, 60, 95, 150, 230, 330, 450, 560, 640, 690, 700, 660, 580, 470, 340, 200, 90]
    },
    {
      key: "ad",
      tab: "ad click",
      unit: "impressions",
      floor: 0,
      cap: 0,
      bandName: "bid discounted",
      wrong: "advertisers paying for impressions that were never going to convert",
      slip: "impressions that would have paid for themselves are thrown away",
      neg: [16000, 15000, 13500, 12000, 10000, 8000, 6200, 4600, 3300, 2300, 1600, 1050, 700, 450, 280, 170, 100, 55, 25, 8],
      pos: [120, 180, 260, 380, 520, 700, 880, 1000, 1050, 1000, 880, 720, 560, 420, 300, 210, 140, 85, 45, 15]
    }
  ];

  function tally(sc, ti) {
    var i, tp = 0, fp = 0, band = 0, missed = 0, posAll = 0, all = 0;
    var lowEdge = ti - BAND; if (lowEdge < 0) lowEdge = 0;
    for (i = 0; i < BINS; i++) {
      posAll += sc.pos[i];
      all += sc.pos[i] + sc.neg[i];
      if (i >= ti) { tp += sc.pos[i]; fp += sc.neg[i]; }
      else if (i >= lowEdge) { band += sc.pos[i] + sc.neg[i]; }
      else { missed += sc.pos[i]; }
    }
    var actioned = tp + fp;
    return {
      tp: tp, fp: fp, actioned: actioned, band: band, missed: missed,
      posAll: posAll, all: all,
      prevalence: all > 0 ? posAll / all : 0,
      precision: actioned > 0 ? tp / actioned : null,
      recall: posAll > 0 ? tp / posAll : 0
    };
  }

  /* best precision any threshold can reach: keep only the top-scoring bin */
  function ceilingPrecision(sc) {
    var i = BINS - 1, d = sc.pos[i] + sc.neg[i];
    return d > 0 ? sc.pos[i] / d : 0;
  }

  function verdictFor(sc, ti, s) {
    var t = (ti / BINS).toFixed(2), out, ratio, ceil;
    if (s.actioned === 0) {
      return "At " + t + " nothing is auto-actioned at all: recall is 0% and precision is undefined because you never predict positive. " +
        "A threshold of 1.00 is not a conservative policy, it is the decision not to ship the model.";
    }
    if (ti === 0) {
      out = "At 0.00 you action every scored item, so precision collapses to the base rate of " + pct(s.prevalence) +
        " and recall is 100% by construction. " + fmt(s.fp) + " " + sc.unit + " are actioned wrongly, and the whole cost lands on " + sc.wrong + ".";
      if (sc.key === "ad") out += " For an auction this is doubly wrong: a hard cut throws away the very quantity the auction runs on \u2014 the probability itself.";
      return out;
    }
    out = "At " + t + " you auto-action " + fmt(s.actioned) + " " + sc.unit + " and hold " + fmt(s.band) + " in the band below the cut (" + sc.bandName + "). ";
    if (sc.floor <= 0) {
      out += "Precision of " + pct(s.precision) + " against recall of " + pct(s.recall) + " is the trade at this cut, and " +
        fmt(s.missed) + " " + sc.unit + " that would have paid off are dropped below the band entirely.";
    } else if (s.precision < sc.floor) {
      out += "Precision of " + pct(s.precision) + " is under the " + pct(sc.floor) + " floor policy asked for, so about " +
        fmt(s.fp) + " of what you actioned is wrong \u2014 that cost lands on " + sc.wrong + ", who did not opt into your error budget.";
    } else {
      out += "Precision of " + pct(s.precision) + " clears the floor, but recall is only " + pct(s.recall) + ": " +
        fmt(s.missed) + " truly positive " + sc.unit + " fall below the band and are never looked at, so " + sc.slip + ".";
    }
    if (sc.cap > 0) {
      ratio = Math.round((s.band / sc.cap) * 10) / 10;
      if (ratio >= 1.5) {
        out += " And the band is " + ratio + "\u00d7 the stated review capacity of " + fmt(sc.cap) +
          "/day, so most of it is queue theatre \u2014 items age out unreviewed.";
      } else if (s.band > sc.cap) {
        out += " The band is a little over the stated review capacity of " + fmt(sc.cap) + "/day, so its tail ages out unreviewed.";
      } else {
        out += " The band fits inside the stated review capacity of " + fmt(sc.cap) + "/day, so a human actually sees all of it.";
      }
    }
    ceil = ceilingPrecision(sc);
    if (sc.floor > 0 && sc.floor > ceil) {
      out += " Worth noticing: no threshold on this distribution reaches the " + pct(sc.floor) + " floor \u2014 the best this score can do is " +
        pct(ceil) + ". That is a finding, not a tuning problem: at this separation the harshest action is not automatable, and the top of the ladder has to be a challenge or a human.";
    }
    if (sc.key === "ad") {
      out += " Remember the framing though: an auction wants the calibrated probability, not a yes/no \u2014 a threshold here is a blunt instrument for a job that needs a number.";
    }
    return out;
  }

  Widgets.mlcaseThreshold = function (mount) {
    mount.classList.add("widget");

    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "policy lab"),
      h("h3", {}, "Where do you set the threshold?")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "One fixed score distribution per scenario, roughly 100,000 scored items. Move the cut and watch who pays for it. " +
      "Items scoring within 0.15 below the cut go to the second tier; truly positive items below that band are seen by nobody."));

    var idx = 0, ti = 14; /* default scenario = harmful content, threshold 0.70 */

    var seg = h("div", { class: "w-seg" });
    var segBtns = [];
    var i;
    for (i = 0; i < SCENARIOS.length; i++) {
      (function (n) {
        var b = h("button", {
          class: "w-seg-btn" + (n === idx ? " active" : ""),
          type: "button",
          onclick: function () { idx = n; paint(); }
        }, SCENARIOS[n].tab);
        segBtns.push(b);
        seg.appendChild(b);
      })(i);
    }

    var slider = h("input", {
      type: "range", min: "0", max: "20", step: "1", value: String(ti),
      "aria-label": "decision threshold"
    });
    slider.addEventListener("input", function () { ti = parseInt(slider.value, 10) || 0; paint(); });
    slider.addEventListener("change", function () { ti = parseInt(slider.value, 10) || 0; paint(); });

    var tEcho = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, "0.70");
    var down = h("button", { class: "w-btn", type: "button", onclick: function () { ti = Math.max(0, ti - 1); paint(); } }, "\u2212 0.05");
    var up = h("button", { class: "w-btn", type: "button", onclick: function () { ti = Math.min(BINS, ti + 1); paint(); } }, "+ 0.05");

    mount.appendChild(h("div", { class: "widget-controls" },
      seg,
      h("label", { class: "w-field" }, "threshold ", slider, tEcho),
      down, up));

    var roPrec = h("div", { class: "ro" });
    var roRec = h("div", { class: "ro" });
    var roAct = h("div", { class: "ro" });
    var roBand = h("div", { class: "ro" });
    var roMiss = h("div", { class: "ro" });
    var readout = h("div", { class: "w-readout" }, roPrec, roRec, roAct, roBand, roMiss);
    var verdict = h("p", { style: "margin:14px 0 0;font-size:0.86rem;line-height:1.6;color:var(--text-dim)" });

    mount.appendChild(h("div", { class: "w-stage" }, readout, verdict));

    function paint() {
      var sc, s, j;
      try {
        if (ti < 0) ti = 0;
        if (ti > BINS) ti = BINS;
        if (idx < 0 || idx >= SCENARIOS.length) idx = 0;
        sc = SCENARIOS[idx];
        s = tally(sc, ti);

        for (j = 0; j < segBtns.length; j++) {
          segBtns[j].className = "w-seg-btn" + (j === idx ? " active" : "");
        }
        slider.value = String(ti);
        tEcho.textContent = (ti / BINS).toFixed(2);

        roPrec.innerHTML = "<b>" + (s.precision === null ? "n/a" : pct(s.precision)) + "</b> precision";
        roRec.innerHTML = "<b>" + pct(s.recall) + "</b> recall";
        roAct.innerHTML = "<b>" + fmt(s.actioned) + "</b> auto-actioned";
        roBand.innerHTML = "<b>" + fmt(s.band) + "</b> second tier";
        roMiss.innerHTML = "<b>" + fmt(s.missed) + "</b> missed, unseen";
        verdict.textContent = verdictFor(sc, ti, s);
      } catch (e) {
        verdict.textContent = "Threshold lab could not compute this setting.";
      }
    }

    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     QUIZZES OWNED BY THIS FILE
     ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {

    "mlcase-recsys": {
      title: "Recommendation & ranking checkpoint",
      sub: "Objectives, two-stage serving, cold start, multi-objective scores, and calibration.",
      questions: [
        {
          q: "You are recommending videos on a home surface. Why is total watch time a flawed objective even though it beats clicks?",
          options: [
            "It systematically favours long videos and under-rewards short content the viewer was completely satisfied by",
            "It cannot be logged reliably from mobile clients",
            "It is not differentiable, so no model can be trained against it",
            "It correlates too weakly with clicks to be a usable label"
          ],
          answer: 0,
          explain: "Watch time is measured in seconds, so a two-hour video that half-holds attention outscores a ninety-second clip that fully answered the viewer's need. "
            + "The objective therefore pushes the catalogue toward length rather than toward satisfaction. The fix is not to abandon watch time but to normalise it by duration "
            + "and combine it with explicit satisfaction signals."
        },
        {
          q: "In a two-tower retrieval model, why can the item tower not consume user\u00d7item cross features?",
          options: [
            "Cross features leak the label into the training set",
            "The item embedding has to be independent of the request so it can be computed in advance and loaded into an approximate-nearest-neighbour index",
            "Cross features make the towers too small to train stably",
            "The vector index only accepts sparse inputs"
          ],
          answer: 1,
          explain: "The whole economic argument for two towers is that the item side is precomputed once for the entire catalogue and searched with an ANN index in milliseconds. "
            + "A feature that depends on the requesting user would force you to recompute item vectors per request, which is exactly the cost the architecture exists to avoid. "
            + "Cross features belong in the ranker, which only scores a few hundred candidates."
        },
        {
          q: "A creator uploads a video with zero engagement history. Which mechanism actually gets it into recommendations?",
          options: [
            "Hold it out of the candidate pool until its engagement statistics are stable",
            "Increase the ranker's regularisation so sparse-history items are not penalised",
            "Embed it from content and creator features so it is retrievable immediately, and reserve an exploration budget so it can earn engagement signal",
            "Serve it only to users who opted into seeing new uploads"
          ],
          answer: 2,
          explain: "Cold start is two problems: the item must be representable without behavioural features, and it must receive impressions before it can accumulate them. "
            + "Content and creator features solve the first; a deliberately reserved slice of traffic solves the second. Waiting for engagement to stabilise is circular \u2014 "
            + "engagement never arrives if the item is never shown."
        },
        {
          q: "Your feed ranker scores items as a weighted sum of several predicted actions. What determines the weights?",
          options: [
            "Fitting them by minimising log loss on the training set",
            "Choosing them so the predicted action probabilities sum to one",
            "Copying them from the retrieval stage's scoring function",
            "They encode product policy, so you set them deliberately and validate them in an online experiment"
          ],
          answer: 3,
          explain: "Engagement logs can tell you how likely each action is, but they contain no information about how much each action is worth \u2014 that is a judgement about what the "
            + "product is for. So the weights are a policy artefact, argued for explicitly and then tested online. Fitting them to the same logs just re-derives whatever the "
            + "current system already rewards."
        },
        {
          q: "A feed must be able to rank items created seconds ago. What does that do to the serving design?",
          options: [
            "Heavy precomputation of ranked feeds is incompatible with second-old items, so the fresh path has to compute features and score at request time",
            "Nothing, as long as ranked feeds are precomputed hourly for every user",
            "Freshness constrains retrieval only; ranking is unaffected",
            "Fresh items should be held out of ranking until their engagement features are dense"
          ],
          answer: 0,
          explain: "Precomputation and freshness pull in opposite directions: anything you computed an hour ago cannot know about an item that is one minute old. "
            + "Systems that need both typically precompute the slow, stable part of the candidate set and merge a request-time fresh path on top. "
            + "Holding fresh items back is the same cold-start trap in a different costume."
        },
        {
          q: "Why does an ad auction need a calibrated click probability, when a ranker only needs the right order?",
          options: [
            "Because a ranker's ordering is unstable unless the scores are calibrated",
            "Because expected value is bid \u00d7 predicted click probability, so a mis-scaled probability misprices every auction even when the ordering is perfect",
            "Because uncalibrated models cannot meet a low latency budget",
            "Because calibration is required in order to compute ROC-AUC"
          ],
          answer: 1,
          explain: "Ranking cares only about relative order, so any monotone transform of the scores is harmless. An auction multiplies the probability by a bid and charges money "
            + "against the result, so the number itself has to mean what it says. This is why negative downsampling has to be corrected for, and why calibration error is tracked "
            + "as an operational metric rather than an afterthought."
        },
        {
          q: "Clicks on ads are rare \u2014 well under a few percent of impressions. Why is PR-AUC (average precision) more informative than ROC-AUC here?",
          options: [
            "ROC-AUC cannot be computed when classes are imbalanced",
            "PR-AUC has a fixed baseline of 0.5, which makes comparison easier",
            "The false-positive rate has an enormous denominator, so thousands of extra false positives barely move ROC-AUC, while precision reacts to them directly",
            "PR-AUC is threshold-free whereas ROC-AUC requires a chosen threshold"
          ],
          answer: 2,
          explain: "ROC-AUC pairs recall against FP/(all negatives). When negatives outnumber positives by a hundred to one, a huge absolute number of false positives is a tiny "
            + "fraction of that denominator, so the curve looks flattering. Precision divides by the predictions you actually made, so it tracks the cost you actually pay. "
            + "Note the baselines invert the claim in option 2: PR-AUC's baseline is the prevalence, ROC-AUC's is 0.5."
        },
        {
          q: "A people-you-may-know model is promoted because connection requests sent rose 12%. Why is that weak evidence of success?",
          options: [
            "Requests sent cannot be logged on the recipient's side, so the number is unreliable and should be replaced by impressions",
            "A rise in requests always means the model drifted and needs retraining before any launch decision is made",
            "Requests are a lagging metric that only stabilises after a quarter, so a short test cannot measure it",
            "A connection needs both sides; sends ignore whether recipients accept, use, or report the request"
          ],
          answer: 3,
          explain: "Friend suggestions are a two-sided recommendation: the sender's tap is only half of the event, and the recipient bears the cost of every unwanted request. "
            + "An objective that counts sends will happily push requests at strangers and hubs, raising declines, ignores and harassment reports. "
            + "Scoring p(send) \u00d7 p(accept) weighted by the chance the connection leads to interaction prices in reciprocity."
        },
        {
          q: "Your notification model predicts p(open | sent) very well, yet a persistent holdout shows almost no lift in daily actives. What is the most likely explanation?",
          options: [
            "The model is miscalibrated, so its probabilities need an isotonic correction fitted on recent opens",
            "Open tracking on mobile is unreliable, so the holdout comparison is mostly measuring logging noise",
            "It favours users who would have come back anyway; the target should be uplift, not response",
            "Daily actives is too coarse a metric to ever move with notifications, whatever the model does"
          ],
          answer: 2,
          explain: "A response model learns who opens notifications, and the most reliable openers are heavy users who were coming back regardless. "
            + "Their opens look like success but are not incremental. Uplift modelling estimates the difference in engagement between sending and not sending, which requires randomised "
            + "send/no-send data and is the quantity a holdout actually measures."
        }
      ]
    },

    "mlcase-trust": {
      title: "Trust & safety checkpoint",
      sub: "Exposure-weighted objectives, threshold policy, label noise, and adversaries that retrain against you.",
      questions: [
        {
          q: "Which objective is the strongest framing for a harmful-content system?",
          options: [
            "Maximise classification accuracy on a class-balanced sample",
            "Remove as much harmful content as the model can find",
            "Maximise recall at whatever review-queue size the team can staff",
            "Minimise views of harmful content subject to a precision floor"
          ],
          answer: 3,
          explain: "Accuracy is close to meaningless at low prevalence, and unbounded removal has an unbounded false-positive bill. The precision floor is what bounds the harm you "
            + "do to innocent authors, and weighting by views is what aligns the objective with the actual damage, which is proportional to exposure rather than to item count. "
            + "Option 4 is a real improvement over the first two but still treats a viral post and an unseen one as equals."
        },
        {
          q: "You raise the auto-action threshold on a well-behaved score. What happens?",
          options: [
            "Precision rises and recall falls",
            "Precision falls and recall rises",
            "Both rise, because you are actioning fewer items",
            "Both fall, because the model has fewer examples to learn from"
          ],
          answer: 0,
          explain: "A higher bar means you only act on items the model is more confident about, so a larger share of what you action is genuinely positive \u2014 precision goes up. "
            + "But the items you no longer action include true positives, so recall goes down. Recall is monotone in the threshold by definition; precision rises whenever "
            + "higher scores really do carry a higher positive rate, which is what a usefully ranked score means."
        },
        {
          q: "Who should own the value of the removal threshold?",
          options: [
            "The model \u2014 whatever value maximises F1 on the validation set",
            "Policy and legal, because the threshold sets the exchange rate between posts removed in error and harmful posts left up",
            "The on-call engineer, tuned per incident",
            "The annotation vendor, derived from inter-rater agreement"
          ],
          answer: 1,
          explain: "The model supplies a ranked score; choosing where to cut is a statement about how many wrongful removals one prevented harm is worth, and that is a policy "
            + "judgement with legal and regional dimensions. F1 silently asserts that precision and recall matter equally, which is almost never the policy anyone would defend "
            + "out loud. Your job is to hand policy an honest precision/recall curve and implement whatever they choose."
        },
        {
          q: "What is the honest characterisation of labels in a moderation system?",
          options: [
            "Reports arrive essentially instantly, so label delay is not a real concern",
            "Reviewer disagreement disappears under majority vote, after which labels are exact",
            "Labels arrive late and skew toward content that got attention, so a naive recent-window training set over-represents viral items and barely sees unreported harm",
            "Enforcement actions have no effect on future training data"
          ],
          answer: 2,
          explain: "A post has to be seen before it is reported and reviewed before it is labelled, so your freshest data is also your least complete, and what does get labelled is "
            + "biased toward whatever was distributed widely. Majority vote reduces variance but cannot fix a genuinely ambiguous policy boundary. And enforcement truncates the "
            + "signal: content you removed generates no further engagement, which changes the distribution your next model trains on."
        },
        {
          q: "Your bot classifier's precision decays steadily after each deploy. What is the correct reading?",
          options: [
            "A model that generalises properly would not decay, because account behaviour is stationary",
            "Decay is a data-quality defect and should be fixed by cleaning the training set",
            "Decay is avoided by freezing the model so attackers cannot probe it",
            "The opponent adapts to whatever you ship, so the distribution moves because you deployed \u2014 retraining cadence and drift monitoring are design requirements, not maintenance chores"
          ],
          answer: 3,
          explain: "In an adversarial setting your deployment is an intervention on the data-generating process: the cheapest evasions are the ones your current model punishes, so "
            + "operators move off them first. That means measured decay is expected behaviour, not a bug, and the design has to include how fast you can retrain and how you detect "
            + "the shift. Freezing the model only guarantees that the evasion, once found, works forever."
        },
        {
          q: "How should the asymmetric cost of false positives shape a bot-detection design?",
          options: [
            "Because a false positive locks a real person out, hard actions need a high precision floor, softer challenges can run at lower confidence, and appeals both remedy errors and supply hard labels",
            "An appeals path is a support-team concern and sits outside the ML design",
            "Appeals should be routed back to the model that made the decision, for consistency",
            "False positives and false negatives cost the same, so a symmetric cut at 0.5 is the neutral choice"
          ],
          answer: 0,
          explain: "Losing an account is a severe, personal harm, while a missed bot is a diffuse cost \u2014 so the action ladder should match confidence: challenge in the middle band, "
            + "suspend only at the top. Appeals matter twice over: they are the remedy that makes a high-severity action defensible, and overturned decisions are precisely the hard "
            + "negatives your next training round needs most."
        },
        {
          q: "A payment-fraud model is retrained only on transactions it previously approved, using chargebacks as labels. What does that do to the training data?",
          options: [
            "Nothing important, as long as the chargeback window has fully matured before each retraining run",
            "Declined patterns never get labels and become a blind spot; a capped random-approve slice fixes it",
            "It removes the class imbalance problem, because approved transactions are overwhelmingly legitimate",
            "It makes labels arrive faster, since declined transactions no longer wait on the chargeback window"
          ],
          answer: 1,
          explain: "Labels only exist where the system let the transaction through, so the training set is selected by the previous model. "
            + "Anything it declined has no label, and the next model cannot learn whether those patterns were really fraud. Approving a small, amount-capped random slice deliberately buys "
            + "unbiased labels; reject inference, which imputes labels using the old model, is circular and should be treated as a weak signal at best."
        },
        {
          q: "Your calibrated fraud model gives p(fraud) = 0.05 to both a $20 and a $2,000 card-not-present purchase. What should the decision layer do?",
          options: [
            "Apply the same threshold to both, because the calibrated score already captures all of the risk",
            "Decline both, because a 5% fraud probability is roughly fifty times the base rate of fraud",
            "Compare expected cost per action: approve the $20 one, step up or review the $2,000 one",
            "Send both to manual review, since a 5% score sits in the uncertain middle band for both orders"
          ],
          answer: 2,
          explain: "Expected fraud loss is probability times amount (plus fees), while the cost of wrongly declining a good customer grows much more slowly with amount. "
            + "So the break-even probability falls as the amount rises, and the same score maps to different actions in different amount bands. "
            + "That only works if the probability is calibrated, which is why calibration is a requirement rather than a nicety here."
        }
      ]
    },

    "mlcase-retrieval": {
      title: "Search & retrieval checkpoint",
      sub: "Hybrid retrieval, click bias, chunking, groundedness, and where the latency actually goes.",
      questions: [
        {
          q: "Why does hybrid lexical + dense retrieval usually beat either one alone?",
          options: [
            "Dense retrieval is strictly better; hybrid survives only because inverted indexes are already deployed",
            "Lexical matching nails rare exact tokens like error codes and part numbers, dense retrieval handles paraphrase and intent, and their failure modes are largely uncorrelated",
            "Running both halves the latency of running either",
            "Lexical retrieval is a prerequisite for computing the embeddings"
          ],
          answer: 1,
          explain: "A dense encoder maps meaning, which is exactly why an unusual literal string can get smeared into a neighbourhood of vaguely similar text. "
            + "An inverted index has the opposite profile: perfect on the literal token, blind to a synonym. Fusing them recovers most of both, at the cost of running and tuning "
            + "two retrieval systems and a fusion step."
        },
        {
          q: "What is position bias in click logs?",
          options: [
            "Users click lower results more often because they scan the whole page before deciding",
            "Clicks are a fair sample of relevance provided the sample is large enough",
            "A result is clicked partly because it was placed high, so training on raw clicks teaches the model to reproduce the ranking it was shown",
            "It affects paid results only, never organic ones"
          ],
          answer: 2,
          explain: "Click probability factors roughly into whether the user examined the result and whether they found it relevant, and examination falls steeply with rank. "
            + "So a click on position one is weak evidence of relevance and no click on position nine is weak evidence of irrelevance. Trained naively, the model learns the "
            + "incumbent ranking, and the loop closes."
        },
        {
          q: "Which mechanism actually debiases click training data?",
          options: [
            "Discard every click below position three",
            "Train on impressions rather than clicks",
            "Normalise click counts by query frequency",
            "Weight each click by the inverse of the estimated probability that its position was examined, with those propensities estimated from deliberate randomisation"
          ],
          answer: 3,
          explain: "Inverse-propensity weighting treats the log as a biased sample and reweights it: a click at a rarely examined position counts for more than one at the top. "
            + "The propensities have to come from somewhere, which is why teams run small randomised swaps or interleaving experiments to measure examination by position. "
            + "Truncating positions throws away the very tail that carries the new information."
        },
        {
          q: "How does chunk size affect a retrieval-augmented assistant?",
          options: [
            "It trades retrieval precision against answer completeness: too small and the passage loses the context that made it answerable, too large and one vector averages several topics",
            "Smaller is always better, because shorter text produces a more precise embedding",
            "It affects storage cost only, never retrieval quality",
            "Chunks must land on a fixed token count or the reranker cannot score them"
          ],
          answer: 0,
          explain: "A chunk is simultaneously the unit you match against and the unit you hand to the generator, and those two jobs want different sizes. "
            + "Fragments retrieve sharply but arrive without the surrounding definition or caveat; long chunks are semantically muddy and burn context. "
            + "Splitting on document structure and expanding a retrieved fragment to its parent section is the usual way to stop choosing."
        },
        {
          q: "You have to report a hallucination rate. What is the workable approach?",
          options: [
            "Use fluency or helpfulness scores as a proxy for groundedness",
            "Break the answer into individual claims and check each against the retrieved passages, then human-audit a sample to calibrate whatever automatic judge you use",
            "Accept that it is unmeasurable and reduce it with prompt instructions instead",
            "Compare the answer against the same model's answer without retrieval"
          ],
          answer: 1,
          explain: "Groundedness is a property of individual assertions, so the unit of evaluation has to be the claim, not the response. An automated judge makes this affordable, "
            + "but a judge is a model with its own error rate, so you need a human-labelled slice to know how much to trust it. Fluency is actively misleading here: the most "
            + "dangerous hallucinations are the well-written ones."
        },
        {
          q: "Where does the latency budget in a RAG request usually go?",
          options: [
            "Retrieval dominates, so the reranker is the first thing to cut",
            "Latency is fixed by the vector index and cannot meaningfully be budgeted",
            "Generation usually dominates end to end, so you budget retrieval and reranking tightly and stream tokens so time-to-first-token is what the user feels",
            "Adding a reranker lowers total latency, because it shortens the prompt"
          ],
          answer: 2,
          explain: "Vector search over a well-built index is fast, and a cross-encoder over a few dozen candidates is bounded; producing a few hundred tokens is not. "
            + "That is why the useful target is time-to-first-token plus a streaming rate, rather than a single end-to-end number. A reranker can shorten the prompt, but it adds "
            + "its own serial hop \u2014 the win is quality, not speed."
        },
        {
          q: "Which offline metric best measures whether query autocomplete is doing its job?",
          options: [
            "Click-through rate on shown suggestions, replayed from last month's keystroke logs",
            "Recall@1000 of the candidate generator, measured over every query logged in the period",
            "Average popularity of the suggestions shown at each prefix, weighted by prefix traffic",
            "Keystrokes saved and the rank of the query the user finally submitted"
          ],
          answer: 3,
          explain: "Autocomplete exists to get the user to the query they meant with less typing, so the natural ground truth is the query they ended up submitting. "
            + "Replaying each prefix and asking where that query appeared \u2014 and how many characters it would have saved \u2014 measures exactly that. "
            + "Suggestion CTR rewards sensational completions, and popularity says nothing about whether the suggestion matched this user's intent."
        },
        {
          q: "Autocomplete must respond on every keystroke within a few tens of milliseconds. Which design choice buys the most headroom?",
          options: [
            "Cache ranked results for short prefixes and keep request-time work to a light rerank",
            "Run a cross-encoder over all completions of the prefix on each keystroke for best quality",
            "Skip prefixes shorter than five characters entirely, since they are too ambiguous to rank",
            "Generate completions with a large language model on every request and cache nothing at all"
          ],
          answer: 0,
          explain: "There are only a few thousand one- to three-character prefixes, and they receive a large share of traffic, so caching their ranked completions removes most of the work. "
            + "The trie or FST already stores top-k per node, so the remaining request-time cost is a small rerank with personal and fresh signals. "
            + "Heavy models per keystroke blow the budget, and skipping short prefixes throws away the moments where suggestions save the most typing."
        }
      ]
    },

    "mlcase-forecast": {
      title: "Forecasting & marketplaces checkpoint",
      sub: "Quantiles and asymmetric cost, residual models, honest metrics, rolling-origin backtests, and censored demand.",
      questions: [
        {
          q: "Your ETA service shows a P90 delivery time. What is the right check that it is calibrated?",
          options: [
            "The P90 has a lower mean absolute error than the P50 on the most recent month of orders",
            "The P90 is always at least ten minutes above the P50, whatever the distance or city",
            "About 90% of actuals land at or below it, overall and in each city and hour",
            "The P90 minimises squared error on the validation set compared with every other quantile"
          ],
          answer: 2,
          explain: "A quantile forecast makes a frequency claim: the actual should land below the 90th percentile about nine times in ten. "
            + "Coverage is the direct test, and it has to hold per slice, because an overall 90% can hide one city at 75% and another at 98%. "
            + "Error metrics like MAE or squared error measure a different property and say nothing about whether the quantile is honest."
        },
        {
          q: "Each minute a delivery arrives later than promised costs about three times as much as each minute it arrives early. Which single number should the ETA show?",
          options: [
            "The 0.75 quantile, since 3 / (3 + 1) = 0.75",
            "The median, because it is robust to the long right tail of slow deliveries",
            "The mean, because it minimises total squared error across all delivered orders",
            "The 0.25 quantile, so that most orders comfortably beat their promised time"
          ],
          answer: 0,
          explain: "Under pinball loss the optimal point forecast is the \u03c4 quantile with \u03c4 = under-cost / (under-cost + over-cost); here that is 3 / (3 + 1) = 0.75. "
            + "Showing the median or mean treats lateness and earliness as equally bad, which the business has told you they are not. "
            + "The 0.25 quantile gets the asymmetry backwards and would make most orders late."
        },
        {
          q: "Why do many ETA systems train an ML model on the residual of a routing engine's estimate rather than predicting travel time from scratch?",
          options: [
            "Residual targets are always normally distributed, which lets a simple linear model fit them well",
            "The routing engine cannot be called at serving time, so its output has to be learned offline",
            "It removes the need for real-time traffic features, since routing already includes live speeds",
            "Routing already captures road physics; the model learns only what it misses"
          ],
          answer: 3,
          explain: "A routing engine's segment-sum is a strong, physically grounded baseline that a model would otherwise have to rediscover from data. "
            + "Learning the correction concentrates model capacity on what routing misses and degrades gracefully in places with little history. "
            + "The cost is coupling: upgrading the routing engine shifts the residual distribution, so the two must be versioned and retrained together."
        },
        {
          q: "A retail forecast covers millions of SKU-store series, many of which sell zero units on most days. Why is WAPE preferred to MAPE as the headline metric?",
          options: [
            "WAPE is the only accuracy metric that can be computed for quantile forecasts as well as point forecasts",
            "MAPE breaks on zero and tiny actuals; WAPE divides total error by total volume",
            "WAPE penalises over-forecasting much more heavily than MAPE does, which protects against waste",
            "MAPE cannot be computed inside a rolling-origin backtest because the folds overlap in time"
          ],
          answer: 1,
          explain: "Percentage error per series divides by the actual, so a zero-sales day is undefined and a one-unit day turns a one-unit miss into 100%. "
            + "On intermittent data that lets a handful of slow movers dominate the average. WAPE sums absolute errors and divides by summed actuals, which is defined, stable, "
            + "and proportional to the volume the decision actually moves."
        },
        {
          q: "How should a demand-forecasting model be backtested?",
          options: [
            "Rolling origins: train to a cutoff, forecast ahead, move the cutoff, repeat",
            "With a random 80/20 split of days, so that every season appears in both training and test",
            "On the most recent month only, since that period is the closest match to production conditions",
            "By cross-validating over stores while holding the time period fixed across all of the folds"
          ],
          answer: 0,
          explain: "A forecast is used at a point in time to predict the future, so the evaluation has to recreate that situation many times across seasons and events. "
            + "Random splits let the model see neighbouring future days and inflate accuracy. A single recent window is one noisy draw, and splitting by store still leaks shared "
            + "future shocks across folds."
        },
        {
          q: "Recorded sales for a popular item drop to zero for three days because it was out of stock. What should the training pipeline do?",
          options: [
            "Train on the zeros as recorded, since recorded sales are the only ground truth available",
            "Drop the item from training entirely until it has accumulated a month of clean history",
            "Replace the zeros with the forecast that was made for those days, so the series stays smooth",
            "Treat those days as censored demand and mask or impute them"
          ],
          answer: 3,
          explain: "Sales are demand truncated by available stock, so a stockout day records what you had, not what customers wanted. "
            + "Training on those zeros teaches the model that demand fell, and a lower forecast leads to smaller orders and more stockouts \u2014 a self-reinforcing spiral. "
            + "Masking or imputing censored days, using a stock-availability flag, breaks the loop; reusing the old forecast just bakes in its errors."
        }
      ]
    }
  });

  /* ==================================================================
     TRACK
     ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.mlcase = {
    id: "mlcase",
    name: "ML Problem Breakdowns",
    short: "CASES",
    tagline: "Thirteen problems, worked end to end",
    color: "#f472b6",
    blurb: "Thirteen full ML system design walkthroughs \u2014 video recommendations, feed ranking, ad click prediction, people-you-may-know, notification ranking, harmful-content detection, bot detection, payment fraud, search ranking, a retrieval-augmented assistant, query autocomplete, delivery ETA prediction, and demand forecasting. Every page runs the same eight beats: the clarifying questions, requirements as measurable targets, a graded Naive/Solid/Standout ladder for the objective and for the model, the offline and online paths, the label definition and its traps, evaluation with the deep dives you will be pushed on, and what the Mid, Senior, and Staff bar looks like on that specific problem.",
    modules: [

      /* ==================== RECSYS ==================== */
      {
        id: "recsys",
        name: "Recommendation & Ranking",
        icon: "trend",
        lessons: [

          /* ---------- 1. video recommendations ---------- */
          {
            id: "video-recommendations",
            title: "Recommending videos on a home surface",
            summary: "The canonical two-stage recommender, and the objective ladder from clicks to a satisfaction-weighted score with guardrails.",
            minutes: 11,
            tags: ["recommendation", "two-tower", "objective", "cold-start"],
            blocks: [
              { t: "p", html: "The prompt is one sentence: <em>build the home surface for a video app</em>. Everything that matters is hidden in what nobody said \u2014 which surface, what the catalogue looks like, and above all what \"good\" means. You already have the machinery for this from <a href='#/mlsd/framework/phase-plan'>the six-phase framework</a>; this page is about spending it on a real problem. The mental model to hold: a home surface is a <strong>funnel</strong>. Millions of items become hundreds cheaply, hundreds become twenty expensively, and a policy layer has the final say \u2014 and every decision below is really a decision about which stage absorbs which cost." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>Which surface, exactly?</strong> A cold home grid, an up-next rail, or a search results page? <em>Assume:</em> the logged-in home grid, roughly 20 slots, refreshed on each visit.",
                "<strong>What is the catalogue?</strong> Long-form only, short-form only, or mixed? <em>Assume:</em> mixed durations from 30 seconds to two hours \u2014 which, as you will see, is the single most consequential answer for the objective.",
                "<strong>Who is the customer?</strong> Only viewers, or viewers and creators? <em>Assume:</em> both. A design that starves new creators kills its own supply.",
                "<strong>Is there a business metric already?</strong> <em>Assume:</em> daily active viewers and next-day return, so the ML objective has to ladder up to retention rather than to a session number.",
                "<strong>How fresh must new uploads be?</strong> <em>Assume:</em> recommendable within minutes, not hours. This is a hard architectural constraint, not a nice-to-have.",
                "<strong>What is out of scope?</strong> <em>Assume:</em> search, subscriptions ranking, notifications, and ads. Say this out loud so nobody thinks you forgot them."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> given a viewer and a context, return a ranked, deduplicated set of about 20 videos; support a \"not interested\" signal; make a brand-new upload eligible for retrieval within minutes; never show the same item twice in a session.",
                "<strong>Non-functional:</strong> the numbers below. State them as assumptions, then design against them."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target (order of magnitude)", "Why it binds the design"],
                rows: [
                  ["Catalogue", "~10<sup>8</sup> retrievable items", "Too large to score item-by-item \u2014 forces a cheap retrieval stage"],
                  ["Daily viewers", "~10<sup>8</sup>, a few sessions each", "Peak request rate in the tens of thousands per second; per-request compute is a budget, not an afterthought"],
                  ["End-to-end latency", "p99 in the low hundreds of milliseconds for the whole surface", "Leaves the ranker roughly tens of milliseconds after feature fetch and network"],
                  ["Ranking depth", "a few hundred candidates scored per request", "Sets how heavy the ranker is allowed to be"],
                  ["New-item freshness", "minutes from upload to retrievable", "Rules out designs that only refresh the index nightly"],
                  ["Model refresh", "ranker retrained daily; embeddings refreshed on a similar cadence", "Slower than this and you drift; faster and the cost curve bites"]
                ]
              },
              { t: "note", variant: "tip", html: "Say the words \"<strong>these are assumptions</strong>\" and write them on the board. An interviewer who wanted 10<sup>6</sup> items rather than 10<sup>8</sup> will correct you in ten seconds, and you will have saved yourself a design built on the wrong scale. Inventing a suspiciously precise number is worse than admitting a range." },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "p", html: "This is the part of the answer that actually differentiates candidates, so slow down here. The question is not \"which loss function\" but \"<strong>what does this product want more of</strong>, and what does that proxy break when you push on it?\"" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the product"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise clicks: predict <code class='tok'>p(click)</code> and rank on it", "Optimises the thumbnail and the title, not the video. You get a home page full of content that was compelling to open and disappointing to watch, and the model has no way to know the difference \u2014 the reward arrives before the experience does."],
                  ["<strong>Naive</strong>", "Maximise total watch time in seconds", "Fixes the clickbait hole and opens a bigger one. Seconds are absolute, so a two-hour video that half-holds attention beats a 90-second clip that fully satisfied the viewer. You end up rewarding duration, and creators respond to that within weeks."],
                  ["<strong>Solid</strong>", "Maximise a satisfaction-weighted engagement score: predict several actions \u2014 completion-normalised watch, like, share, subscribe, \"not interested\" \u2014 and combine them with explicit weights", "Now length is normalised away and negative feedback can actually push a score down. The weights are a policy statement, so they are arguable in public rather than buried in a loss function."],
                  ["<strong>Standout</strong>", "The same weighted score, but <em>subject to guardrails</em> \u2014 topic diversity, integrity filters, a creator-supply floor \u2014 and validated against next-day return rather than in-session engagement", "This is the answer that survives contact with reality: it names the metric it optimises, the metrics it refuses to regress, and the longer-horizon metric that decides whether the whole thing worked. Guardrails are what stop a proxy win from becoming a product loss."]
                ]
              },
              { t: "p", html: "The mechanism behind the Great row is boring and important: you predict each action separately, then combine. Score = <code class='tok'>&Sigma; w<sub>a</sub> &middot; p(action<sub>a</sub>)</code>, with negative weights on negative actions. The weights are <em>not</em> learned from engagement logs \u2014 logs know how likely an action is, not how much it is worth \u2014 so they get set deliberately and validated with <a href='#/mlsd/concepts/ab-testing'>an online experiment</a>. Read the full metric ladder in <a href='#/mlsd/concepts/evaluation'>evaluation</a>." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Global popularity list, lightly personalised by country", "Buys you a working page in a day and a genuinely useful baseline number. Costs you all personalisation, and it is a <a href='#/mlsd/serving/feedback-loops'>feedback loop</a> in its purest form: popular gets shown, shown gets popular, the tail never surfaces."],
                  ["<strong>Naive</strong>", "One heavy model that scores the whole catalogue per request", "Buys perfect ranking in theory. Costs you the request \u2014 10<sup>8</sup> scorings inside tens of milliseconds is not an engineering problem you can optimise your way out of, it is the wrong shape."],
                  ["<strong>Solid</strong>", "<a href='#/mlsd/concepts/embeddings'>Two-tower</a> retrieval into an <a href='#/mlsd/concepts/ann-serving'>ANN index</a>, then a gradient-boosted ranker over a few hundred candidates with rich cross features", "Buys the funnel: cheap recall, expensive precision, each where it belongs. Costs you a second system to keep consistent, and the towers cannot use user\u00d7item cross features by construction \u2014 the item side must be request-independent to be precomputable."],
                  ["<strong>Standout</strong>", "Several retrieval sources unioned (two-tower, co-watch neighbours, fresh/trending, subscribed creators) \u2192 multi-task neural ranker with a shared trunk and one head per predicted action \u2192 policy layer for dedupe, diversity, and exploration", "Buys per-objective heads that share representation, plus a place to put product rules that do not belong in a model. Costs real complexity: more sources to monitor, and a shared trunk means one bad training run degrades every head at once."]
                ]
              },
              { t: "p", html: "Why a tree model is a perfectly respectable Good ranker: on a few hundred rows of dense tabular features it is fast, cheap to retrain, and hard to beat. You move to the neural ranker when you want <em>multi-task heads</em> and sequence features, not because trees ran out of accuracy." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE  (hours \u2192 daily)                ONLINE  (per request)\n" +
                "-------------------------------------   -----------------------------------\n" +
                "impression + watch + action logs        request(viewer, context, surface)\n" +
                "        |                                          |\n" +
                "        v                                          v\n" +
                "label & feature jobs ---> FEATURE STORE <--- feature fetch (viewer, context)\n" +
                "        |                     ^                    |\n" +
                "        v                     |                    v\n" +
                "two-tower training            |            CANDIDATE SOURCES (union, ~1k)\n" +
                "  |            |              |            two-tower | co-watch | fresh\n" +
                "  |            v              |                     |\n" +
                "  |    item tower -> embed     |                     v\n" +
                "  |    whole catalogue ---> ANN INDEX ------> RANKER (multi-task, ~500)\n" +
                "  v                                                  |\n" +
                "ranker training --------> model registry ---------->  v\n" +
                "                                            POLICY LAYER\n" +
                "                                    dedupe | diversity | integrity\n" +
                "                                    freshness boost | exploration slot\n" +
                "                                                     |\n" +
                "                                                     v\n" +
                "                                            ~20 items + logging\n"
              },
              { t: "p", html: "Two arrows carry most of the weight. First, <strong>feature store \u2192 both training and serving</strong>: that shared box is the only reason your offline metrics predict anything online, because it is what keeps the two feature computations identical (<a href='#/mlsd/concepts/feature-stores'>training-serving skew</a>). Second, <strong>policy layer \u2192 client</strong>: it comes after the model on purpose. Diversity rules, integrity filters, and the exploration slot are product decisions with legal and editorial owners, and burying them in a loss function makes them unauditable. The rest of the shape is the standard <a href='#/mlsd/serving/retrieval-ranking'>retrieve-then-rank</a> pattern; the box-and-arrow reasoning about caches, replicas, and fan-out is Blueprint territory." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log</strong> every impression with its position and the ranker score, every watch with duration and the video's length, every explicit action, and the model version that produced the slate. Without position and model version in the log you cannot debias later and you cannot attribute a regression.",
                "<strong>Features</strong> come from the <a href='#/mlsd/concepts/feature-engineering'>five usual sources</a>: viewer profile, item content and metadata, viewer\u00d7item history (watched this creator before), context (device, hour, network), and aggregates (item completion rate over the last hour).",
                "<strong>The label</strong> is where the real thinking is. \"Watched\" needs a definition: seconds watched is duration-biased, so use <em>fraction completed</em>, or better, watch time relative to what is typical for videos of that length. Both are choices you must defend.",
                "<strong>Negatives</strong> are the other half of the label. Un-clicked impressions are weak negatives (maybe unseen); random catalogue items are easy negatives useful for the towers; in-batch sampled negatives are the standard trick for training retrieval. Mixing them changes what the model learns."
              ] },
              { t: "note", variant: "trap", html: "<strong>The leak that gets shipped most often here is aggregate features computed over the full training window.</strong> \"Item completion rate\" computed across all of last month, then used to predict an event from the middle of that month, has quietly told the model the future. Every aggregate must be computed as of the prediction timestamp \u2014 point-in-time correctness \u2014 or your offline numbers will be beautiful and your online numbers will not move. More failure shapes in <a href='#/mlsd/concepts/feature-pitfalls'>feature pitfalls</a>." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline, retrieval:</strong> recall@k against the items the viewer actually engaged with \u2014 the retrieval stage's only job is to not lose the good item.",
                "<strong>Offline, ranking:</strong> NDCG or a similar ordering metric on held-out sessions, plus per-head calibration and log loss so you can tell whether a head broke.",
                "<strong>Offline, always:</strong> split by time, never at random. Random splits on interaction data leak the future and inflate everything (see <a href='#/mlsd/concepts/training-pipelines'>splits</a>).",
                "<strong>Online:</strong> the weighted objective as the primary metric; guardrails on integrity actions, topic diversity, creator coverage, and \"not interested\" rate; next-day return as the decision metric.",
                "<strong>Guardrail worth naming out loud:</strong> report negative feedback per thousand impressions. A proxy win with a negative-feedback regression is a product loss wearing a win's clothes."
              ] },
              { t: "ol", items: [
                "<strong>Cold start for new uploads.</strong> Two separate problems: the item must be <em>representable</em> without behavioural features (embed it from title, transcript, thumbnail, and creator priors) and it must be <em>shown</em> before it can accumulate any (a reserved exploration slice). Waiting for engagement to stabilise is circular. The ANN index also has to accept inserts continuously rather than only at rebuild time.",
                "<strong>Presentation and position bias.</strong> The item at slot one gets engagement partly because it was at slot one. Train naively and you learn your own ranking. Feed position into training and drop it at serving, or reweight by examination propensity \u2014 the same machinery as <a href='#/mlcase/retrieval/search-ranking'>search ranking</a>.",
                "<strong>The feedback loop.</strong> Your model chooses what gets logged, and the logs train your next model. Without a deliberate exploration budget the candidate space collapses toward whatever the first model liked. See <a href='#/mlsd/serving/feedback-loops'>feedback loops</a>."
              ] },
              { t: "cue", html: "Say this and you sound like you have shipped one: \u201cI'd rank on a weighted combination of predicted actions rather than a single engagement number, because any single proxy has a known pathology \u2014 clicks reward thumbnails, raw watch time rewards length. The weights are a product decision, so I'd make them explicit and A/B test them, and I'd hold diversity and negative-feedback rate as guardrails.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Gets to two stages: cheap retrieval, then a ranker. Names <code class='tok'>p(click)</code> or watch time as the objective and can describe features and a train/serve split. May not spot the pathologies in the objective until prompted."],
                  ["<strong>Senior</strong>", "Volunteers the objective ladder unprompted and explains why watch time rewards length. Designs the two-tower plus ranker split for a stated latency budget, handles cold start with content features plus exploration, and names a specific leakage risk with the point-in-time fix."],
                  ["<strong>Staff</strong>", "Treats the whole thing as a closed loop: the objective is defined so it ladders to retention, guardrails and their owners are named, the exploration budget is justified as the cost of keeping the loop from collapsing, and the creator-supply side is designed for rather than assumed. Can say which parts they would <em>not</em> build in v1 and why."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>The objective is the design.</strong> Retrieval and ranking are a solved shape you can draw in two minutes; what you are actually being assessed on is whether you can name what a proxy metric will do to the product when the whole system pushes on it \u2014 and whether you set guardrails before, not after, the experiment." }
            ]
          },

          /* ---------- 2. feed ranking ---------- */
          {
            id: "feed-ranking",
            title: "Ranking a social feed of mixed item types",
            summary: "Multi-objective ranking over heterogeneous items, the engagement-versus-quality tension, and how freshness fights precomputation.",
            minutes: 11,
            tags: ["ranking", "multi-objective", "freshness", "quality"],
            blocks: [
              { t: "p", html: "A feed is harder than a video surface for one structural reason: the items are not comparable. A photo from a close friend, a long text post from a group, a live video, and a suggested account all compete for the same slot, and they generate completely different engagement signals. Ranking them means putting them on <strong>one scale that you invented</strong> \u2014 and defending it. So the mental model is that a feed ranker is a <strong>value function</strong>, not a relevance model: relevance asks \"does this match?\", a feed asks \"what is this worth to this person right now, net of what it costs them?\" Everything below follows from taking that seriously." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What is in the feed?</strong> Only content from connections, or connections plus recommended content? <em>Assume:</em> mostly connections, with a bounded share of recommended items \u2014 which means two candidate sources with different cold-start profiles.",
                "<strong>How heterogeneous?</strong> <em>Assume:</em> five or six item types (photo, text, video, link, live, suggested-account). Their base rates for every action differ by an order of magnitude, which is the whole difficulty.",
                "<strong>Is chronology a product promise?</strong> <em>Assume:</em> no, but recency is a strong feature and users notice when something from three days ago is at the top.",
                "<strong>What counts as quality?</strong> <em>Assume:</em> there is an integrity classifier stack already, plus a notion of low-quality-but-legal content (engagement bait, borderline). <em>You do not get to define policy, but you must consume it.</em>",
                "<strong>Session shape?</strong> <em>Assume:</em> viewers open the app several times a day and consume tens of items per session, so the unit that matters is the session, not the single impression.",
                "<strong>Out of scope:</strong> the storage and fan-out architecture for the underlying timeline. That is a system design question and Blueprint covers it; here it appears only as a constraint on what you can compute per request."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> return a ranked page of items on each fetch; support infinite scroll with no repeats; honour explicit controls (mute, follow, \"show less like this\"); apply integrity filtering before ranking; be able to rank an item created seconds ago.",
                "<strong>Non-functional:</strong> targets below \u2014 orders of magnitude, stated as assumptions."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Consequence"],
                rows: [
                  ["Candidates per request", "~10<sup>3</sup> after retrieval and integrity filtering", "Small enough for a heavy ranker; large enough that per-candidate cost matters"],
                  ["Ranking latency", "tens of milliseconds p99 for the ranking stage", "One model pass over ~10<sup>3</sup> candidates, batched; no per-candidate network calls"],
                  ["Freshness", "an item posted seconds ago must be rankable", "Kills any design that precomputes finished ranked feeds"],
                  ["Actions predicted", "~6\u201310 heads (dwell, like, comment, share, hide, report, follow)", "Multi-task is a requirement, not a refinement"],
                  ["Model refresh", "ranker retrained at least daily; near-real-time counters for engagement aggregates", "Behaviour on a feed shifts within hours during news events"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the product"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise time spent in the feed", "The one objective that is almost never what the business means. It rewards anything sticky, cannot distinguish absorbed from stuck, and is trivially satisfied by making the product harder to leave. It also actively fights any effort to make the feed more efficient."],
                  ["<strong>Naive</strong>", "Maximise total engagement events", "Treats a report and a like as both \"engagement\", and treats item types as comparable when their base rates are not. Content that provokes gets a structural advantage, because outrage generates cheap comments. Push on this for two quarters and the feed changes character."],
                  ["<strong>Solid</strong>", "Maximise a weighted sum of predicted actions, with explicit negative weights on hide, report, and \"show less\"", "Now the trade-off is written down: a share is worth <em>n</em> likes because someone decided so. Negative actions can lower a score, which is the mechanism that lets quality push back on engagement at all."],
                  ["<strong>Standout</strong>", "Maximise predicted <em>session value</em> \u2014 the weighted action sum, minus a quality penalty from the integrity and low-quality classifiers, subject to diversity and per-source-share guardrails \u2014 with retention as the decision metric", "Optimises the unit the user actually experiences, prices quality into the score rather than bolting it on as a filter, and admits that the metric you can measure today (session engagement) is a proxy for the one you care about (they come back next week)."]
                ]
              },
              { t: "p", html: "The engagement-versus-quality tension is not resolvable by a better model, and saying so is a strength. Engagement signals are dense, fast, and cheap; quality signals are sparse, slow, and contested. Any weighting you pick is a position on that trade. The two mechanisms that make it tractable: <strong>negative-feedback heads</strong> (predicting hide and report, so unpleasant content is penalised by the same score that rewards likes) and <strong>a quality term</strong> whose weight is a product parameter you can turn up during an incident." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Reverse chronological, no model", "Genuinely buys a lot: perfect freshness, zero ranking latency, trivially explainable, no feedback loop. Costs you relevance at any real follow count \u2014 with hundreds of connections the good item is on page four. Worth naming as your baseline rather than dismissing."],
                  ["<strong>Naive</strong>", "One binary classifier for <code class='tok'>p(any engagement)</code>", "Buys simplicity. Costs you the entire problem: one head cannot express that a report is bad and a share is good, and it will be dominated by whichever item type has the highest base rate."],
                  ["<strong>Solid</strong>", "One model per predicted action (trees or a small network), combined by weights at serving time", "Buys independent heads you can debug, retrain, and calibrate separately, and weights you can change without retraining. Costs you <em>n</em> models to serve inside one latency budget, plus no shared representation."],
                  ["<strong>Standout</strong>", "Multi-task network: shared trunk over user, item, and sequence features, one head per action, per-item-type calibration on the outputs, negative-feedback heads trained on the same trunk", "Buys shared representation (rare actions like \"report\" borrow strength from dense ones), one forward pass for all heads, and a place to put user history as a sequence. Costs coupling \u2014 a bad trunk update degrades every head simultaneously \u2014 and per-type calibration becomes a maintained artefact."]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>Heterogeneous items need per-type calibration, not just per-type features.</strong> If <code class='tok'>p(comment)</code> is systematically over-predicted for text posts and under-predicted for video, then your weighted sum is comparing two differently-scaled numbers and the whole ranking tilts \u2014 silently, and in a way no single-model metric will show you. Calibrate each head within each item type and monitor the calibration error per slice." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE                                 ONLINE  (per fetch)\n" +
                "-----------------------------------     -----------------------------------\n" +
                "engagement + negative-action logs        request(user, cursor, context)\n" +
                "        |                                          |\n" +
                "        v                                          v\n" +
                "point-in-time label join                  CANDIDATE SOURCES\n" +
                "        |                                  connections timeline (stored)\n" +
                "        v                                  recommended pool (ANN)\n" +
                "multi-task trunk training                  FRESH PATH (seconds old)\n" +
                "        |                                          |\n" +
                "        v                                          v\n" +
                "model registry ------------------->       integrity filter (hard)\n" +
                "                                                   |\n" +
                "FEATURE STORE  <----- streaming counters ---------> |  feature fetch\n" +
                "  (same definitions both sides)                     v\n" +
                "                                          MULTI-TASK RANKER\n" +
                "                                          p(dwell) p(like) p(share)\n" +
                "                                          p(hide)  p(report) ...\n" +
                "                                                   |\n" +
                "                                                   v\n" +
                "                                          VALUE COMBINER\n" +
                "                                          Sum w_a * p_a  -  quality penalty\n" +
                "                                                   |\n" +
                "                                                   v\n" +
                "                                          diversity / source-share caps\n" +
                "                                          dedupe against seen-set\n" +
                "                                                   |\n" +
                "                                                   v\n" +
                "                                          page of items + impression log\n"
              },
              { t: "p", html: "The load-bearing arrow is <strong>FRESH PATH \u2192 ranker</strong>. Everything else in the diagram could be precomputed; that one branch cannot. An item posted forty seconds ago has no engagement aggregates, no impression history, and possibly no embedding yet, so the ranker must be able to score it from author, type, text, and context alone \u2014 which means those features have to be sufficient for a reasonable prediction, and it means your feature store needs a streaming path with second-scale freshness rather than an hourly batch. The second arrow worth talking about: <strong>integrity filter before ranking</strong>. Filtering is a hard yes/no owned by policy; ranking is a soft score owned by you. Putting the filter first keeps that boundary clean and shrinks what the ranker has to score. Underneath all of it sits the fan-out question \u2014 whether a timeline is assembled on write or on read. Push-based assembly gives you a ready list but makes very-high-follower authors expensive; pull-based gives you freshness but pays at read time. Blueprint works that trade-off properly; what matters here is that <em>whichever you inherit sets the size and staleness of your candidate set</em>, and therefore what your ranker is allowed to assume." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log</strong> the full slate with positions, dwell time per item (with a viewport signal so you know it was actually on screen), every positive and negative action, and the item type. Impressions without a viewport signal make dwell labels meaningless.",
                "<strong>Features:</strong> author\u2013viewer affinity (past interactions, mutual connections), item content and type, item age, viewer's recent action sequence, near-real-time item aggregates, and context. Affinity features are usually the strongest single family.",
                "<strong>The label is genuinely hard here.</strong> \"Engaged\" is not one event. Dwell needs a threshold and that threshold differs by item type \u2014 three seconds on a photo is engagement, three seconds on a long text post is a bounce. Every head needs its own defensible definition, and \"no action\" has to be distinguished from \"never actually seen\".",
                "<strong>Negative actions are labels too</strong>, and they are rare enough that class weighting or explicit oversampling is usually required for those heads to learn anything."
              ] },
              { t: "note", variant: "trap", html: "<strong>The bias specific to feeds is exposure bias compounded by the social graph.</strong> You only observe engagement on items you showed, and what you showed was chosen by the previous model from a candidate set the fan-out already narrowed. So popular authors accumulate evidence of being engaging, and a new or low-reach author has no path to accumulating any. Left alone this concentrates the feed on a shrinking set of authors \u2014 measure author coverage as a guardrail and reserve exploration for low-reach candidates." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> per-head AUC and log loss (each head is its own classifier), calibration error per item type, and a ranking metric on held-out sessions. Time-based splits only.",
                "<strong>Offline caution:</strong> offline ranking metrics on logged feeds are optimistic by construction \u2014 you can only score the items the old model chose to show. Treat them as regression detectors, not as predictions of online lift.",
                "<strong>Online primary:</strong> the value score itself, plus per-action rates so you can see <em>which</em> term moved.",
                "<strong>Online guardrails:</strong> negative feedback per thousand impressions, integrity action rate, item-type mix, author coverage, and a low-quality exposure metric. Retention as the slower decision metric \u2014 see <a href='#/mlsd/concepts/ab-testing'>A/B testing</a> for why session metrics and retention often disagree."
              ] },
              { t: "ol", items: [
                "<strong>How do you set the weights?</strong> The honest answer has three parts: start from a rough exchange rate elicited from product owners, run an experiment sweeping a few weight vectors, and re-derive them when the metric definitions change. Do not claim you can learn them from engagement logs \u2014 the logs cannot tell you what a share <em>ought</em> to be worth.",
                "<strong>Freshness versus precomputation.</strong> Precompute the stable slice and merge a request-time fresh path, or precompute nothing and pay per request. This is the trade you will be asked to defend, and the answer depends entirely on the latency and freshness numbers you assumed at the start.",
                "<strong>Diversity and the seen-set.</strong> Infinite scroll means the ranker is called repeatedly with overlapping candidates, so \"already shown\" is state you must carry. Doing this as a post-ranking pass is fine and much easier to reason about than trying to express it inside the model."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cI'd predict each action separately and combine them into one value score with explicit weights, because the items aren't comparable and a single engagement label would just rank whichever type has the highest base rate. Negative-action heads are how quality pushes back on engagement inside the same score, and I'd calibrate per item type before trusting the sum.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Ranks with a single engagement model and can list sensible features including author affinity. Knows integrity filtering happens somewhere. Usually misses that heterogeneous item types break a single-label formulation."],
                  ["<strong>Senior</strong>", "Goes multi-objective without being asked, with negative-feedback heads and explicit weights, and can explain why the weights are a product decision. Handles the freshness-versus-precomputation trade with reference to the stated latency budget, and names per-type calibration as a real risk."],
                  ["<strong>Staff</strong>", "Frames the objective as session value laddering to retention, prices quality into the score rather than filtering after it, names the exposure-bias dynamic on the author side and designs a guardrail for it, and is explicit about which offline metrics they do <em>not</em> trust and why. Also says what they would ship first."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>When items are not comparable, the score has to be invented \u2014 so invent it in the open.</strong> Predict each action, weight the actions explicitly, calibrate per item type before summing, and put negative feedback in the same score rather than in a separate report nobody reads." }
            ]
          },

          /* ---------- 3. ad click prediction ---------- */
          {
            id: "ad-click-prediction",
            title: "Predicting click-through for an ad auction",
            summary: "The one ranking problem where the probability itself has to be true: calibration, extreme imbalance, hashing, and a brutal latency budget.",
            minutes: 11,
            tags: ["ctr", "calibration", "imbalance", "latency"],
            blocks: [
              { t: "p", html: "Every other problem in this track wants a <em>good order</em>. This one wants a <strong>true number</strong>. In an auction, the platform ranks candidate ads by expected value \u2014 roughly <code class='tok'>bid &times; p(click)</code> \u2014 and then charges money based on the result. If your probabilities are uniformly twice too high, the ordering is untouched and the marketplace is broken: budgets burn at the wrong rate, and pricing is wrong for everyone. Hold that distinction firmly, because it is the whole lesson. <strong>Ranking is invariant to monotone transforms of the score; pricing is not.</strong> Everything below \u2014 the objective, the model, the loss, the monitoring \u2014 falls out of needing calibration as a first-class requirement rather than a nice property." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What is the auction mechanism?</strong> <em>Assume:</em> a second-price-style auction ranking on expected value, so <code class='tok'>p(click)</code> feeds both ranking and pricing. This is the answer that makes calibration mandatory \u2014 ask it first.",
                "<strong>What is the surface?</strong> <em>Assume:</em> one in-feed placement, one ad per request. Multi-slot introduces cross-slot effects; say you are excluding them deliberately.",
                "<strong>Which prediction, exactly?</strong> Click only, or click and downstream conversion? <em>Assume:</em> click is the primary model, with conversion as a separate, sparser model referenced but not designed here.",
                "<strong>What is the latency budget?</strong> <em>Assume:</em> the ad request must return within a few tens of milliseconds, and the CTR model gets a slice of that measured in single-digit to low-tens of milliseconds. This is far tighter than any other problem in this track and it constrains the model class directly.",
                "<strong>What is the base rate?</strong> <em>Assume:</em> clicks are a low single-digit percentage of impressions or less. Order of magnitude is enough; the point is that you are firmly in imbalanced territory.",
                "<strong>Out of scope:</strong> budget pacing, bid optimisation, fraud, and the billing pipeline \u2014 all real, all adjacent, none of them this model."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> given a request context and a candidate ad, return a calibrated <code class='tok'>p(click)</code>; handle ads and advertisers never seen in training; support fast rollback of a model version; log every scored candidate for later training and auditing.",
                "<strong>Non-functional:</strong> below. Note that one of these targets is a <em>quality</em> requirement rather than a speed one, which is unusual and is the point."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds"],
                rows: [
                  ["Model latency", "single-digit to low-tens of ms p99 for scoring a batch of candidates", "Rules out deep multi-hop models without distillation or quantisation; favours one batched forward pass"],
                  ["Throughput", "~10<sup>5</sup>\u201310<sup>6</sup> scored candidates per second at peak", "Per-candidate cost is a hard budget; feature fetch must be batched"],
                  ["Calibration", "expected calibration error small in absolute terms, tracked per major slice", "A first-class SLO, not a diagnostic. Slice-level matters: overall calibration can look fine while a segment is badly off"],
                  ["Feature cardinality", "~10<sup>8</sup>\u201310<sup>9</sup> distinct ids across users, ads, creatives, publishers", "Forces hashing or learned embeddings with a fixed parameter budget"],
                  ["Freshness", "new creatives priced sensibly within minutes; model refreshed at least daily, often continuously", "Ad content turns over far faster than a video catalogue"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the marketplace"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise clicks on ads", "Sounds aligned and is not. It ignores that different advertisers pay different amounts, so it happily fills the slot with cheap high-CTR inventory and destroys revenue. It also ignores the user entirely."],
                  ["<strong>Naive</strong>", "Maximise short-term revenue by ranking on bid", "Removes the model from the loop and sells the slot to whoever shouts loudest, regardless of whether anyone will click. Expected revenue is bid \u00d7 probability; dropping the probability is not a simplification, it is a different and worse business."],
                  ["<strong>Solid</strong>", "Rank by expected value \u2014 <code class='tok'>bid &times; p(click)</code> \u2014 with <code class='tok'>p(click)</code> trained on log loss and explicitly calibrated", "The right shape. Log loss (rather than a ranking loss) because it is a proper scoring rule: it is minimised by the true probability, which is exactly the property an auction needs."],
                  ["<strong>Standout</strong>", "Maximise long-run marketplace value: expected value including post-click quality signals, minus a user-experience term, with calibration error as a monitored SLO and per-slice calibration enforced", "Prices in the fact that a click on a bad landing page is worth less than the auction thinks, and that ad load has a cost the auction never sees. Names calibration as an operational commitment rather than an offline metric."]
                ]
              },
              { t: "note", variant: "tip", html: "<strong>Use a proper scoring rule and do not squash it.</strong> Log loss is minimised when your predicted probability equals the true probability, which is why it is the right training loss here and why a pairwise ranking loss \u2014 perfectly sensible in <a href='#/mlcase/retrieval/search-ranking'>search</a> \u2014 is the wrong choice for an auction. If you optimise only for order, you have thrown away the number you are about to charge money against." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Historical CTR per ad id, smoothed", "Buys a legitimate baseline and a useful feature forever. Costs you all context \u2014 the same ad has very different CTR by placement, hour, and audience \u2014 and it has nothing to say about a creative launched an hour ago."],
                  ["<strong>Naive</strong>", "A tree ensemble over raw high-cardinality ids", "Buys strong performance on the dense numeric features. Costs you the sparse side: trees split on values they saw, so hundreds of millions of ids either get dropped, blow up the model, or arrive at serving as unseen categories with no representation."],
                  ["<strong>Solid</strong>", "Regularised logistic regression on hashed sparse features plus hand-built crosses, with an explicit calibration stage", "Buys exactly what an auction wants: a naturally probabilistic output, trivial and predictable latency, cheap frequent retraining, and easy debugging by feature weight. Costs you interaction modelling \u2014 crosses have to be authored, and you will not capture what you did not think of."],
                  ["<strong>Standout</strong>", "Sparse-embedding network: hashed id embeddings plus dense features, an explicit interaction layer, distilled or quantised to hit the latency budget, with an isotonic or Platt calibration layer fitted per major slice", "Buys learned interactions and shared strength across sparse ids. Costs the hardest engineering in this track \u2014 embedding tables are large, the latency budget is unforgiving, and every training-pipeline change risks the calibration you were relying on."]
                ]
              },
              { t: "h2", text: "Extreme imbalance: what actually changes" },
              { t: "ul", items: [
                "<strong>Metric choice.</strong> ROC-AUC compares recall against FP/(all negatives), and with a hundred negatives per positive an enormous absolute number of false positives is a rounding error in that denominator \u2014 so ROC-AUC looks flattering and moves sluggishly. PR-AUC (average precision) divides by the predictions you made, so it reacts to the cost you pay. Note that PR-AUC's no-skill baseline is the prevalence, while ROC-AUC's is 0.5, so PR numbers look low and are not comparable across datasets with different base rates.",
                "<strong>Log loss stays central</strong> regardless, because it is the metric that penalises being confidently wrong about the probability, which is the failure mode that costs money.",
                "<strong>Negative downsampling</strong> is the standard cost control: keep all positives and a fraction <em>w</em> of negatives, and you cut training data volume dramatically. But it shifts the base rate, so the model's output is calibrated to the sampled world, not the real one.",
                "<strong>You must undo it.</strong> With negatives kept at rate <em>w</em>, recover the true probability from the model's output <em>p<sub>s</sub></em> with <code class='tok'>p = p<sub>s</sub> / (p<sub>s</sub> + (1 &minus; p<sub>s</sub>)/w)</code>. Skip this and every prediction is inflated by roughly 1/<em>w</em> at low probabilities \u2014 the single most common calibration bug in ad systems."
              ] },
              { t: "h2", text: "Feature hashing, honestly" },
              { t: "p", html: "You cannot hold a parameter per user id, per creative, per publisher, and per cross of those. Hashing solves it by mapping every id into a fixed number of buckets: <code class='tok'>bucket = hash(field_name + \":\" + value) mod m</code>. You get a fixed memory footprint chosen in advance, no vocabulary to maintain, and \u2014 the underrated part \u2014 a defined behaviour for ids that did not exist at training time, which for a stream of new creatives is not a corner case but the normal state. The cost is collisions: two unrelated ids land in one bucket and share a weight, so their signals blur. That is a real accuracy loss and you trade it directly against memory by choosing <em>m</em>. Two things make it survivable: including the field name in the hash input so a user id cannot collide with a publisher id, and the fact that the ids most likely to collide are rare ones whose weights were weakly estimated anyway. Hash the id, keep the frequency-based features separately, and monitor the collision rate as a real quantity rather than assuming it away." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE                                 ONLINE  (inside the ad request)\n" +
                "-----------------------------------     -----------------------------------\n" +
                "impression + click join                  request(user, context, placement)\n" +
                "  (wait out the attribution window)                 |\n" +
                "        |                                           v\n" +
                "        v                                  candidate ads (targeting +\n" +
                "negative downsampling (rate w)              budget/pacing eligible)\n" +
                "        |                                           |\n" +
                "        v                                           v\n" +
                "hashing + feature assembly  <--- FEATURE STORE ---> batched feature fetch\n" +
                "        |                        (same hashing code)         |\n" +
                "        v                                                    v\n" +
                "train (log loss)                                    CTR MODEL, one batched\n" +
                "        |                                           forward pass\n" +
                "        v                                                    |\n" +
                "CALIBRATION FIT                                              v\n" +
                "  undo downsampling: p = ps/(ps+(1-ps)/w)            CALIBRATION LAYER\n" +
                "  isotonic/Platt per slice ------------------------>  (per slice)\n" +
                "        |                                                    |\n" +
                "        v                                                    v\n" +
                "model registry (versioned, fast rollback)             AUCTION\n" +
                "        ^                                        rank by bid * p(click)\n" +
                "        |                                        price the winner\n" +
                "calibration + drift monitors <--- scored-candidate log <------+\n"
              },
              { t: "p", html: "Three arrows do the work. <strong>Impression\u2013click join waits out the attribution window</strong>: a click can arrive after the impression, so your freshest impressions have provisional labels and a naive \"last hour\" training set is full of false negatives. <strong>The calibration layer sits after the model and before the auction</strong>, as a separately fitted, separately monitored artefact \u2014 keeping it separate is what lets you refit calibration without retraining, which is the fix you will want at 3am. And <strong>scored-candidate log \u2192 monitors</strong> closes the loop: predicted versus realised CTR per slice is the alarm that catches a broken deploy long before revenue reporting does. Wider treatment in <a href='#/mlsd/serving/inference-architecture'>inference architecture</a> and <a href='#/mlsd/serving/drift-monitoring'>drift monitoring</a>." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log</strong> every <em>scored candidate</em>, not just the winner \u2014 otherwise you only ever train on ads the current model already liked, and the selection bias is baked in permanently.",
                "<strong>Features:</strong> ad and creative (id, format, advertiser, category, text), user (long-run interest aggregates, recent behaviour), context (placement, position, device, hour), and crosses (advertiser \u00d7 user interest, creative \u00d7 placement). Crosses are usually where the accuracy is.",
                "<strong>The label</strong> is a click, and it is less obvious than it sounds: accidental clicks, immediate back-navigation, and bot traffic all look like positives. A defensible definition filters invalid traffic and often requires a minimum post-click dwell.",
                "<strong>Frequency features are a leakage minefield.</strong> \"Times this user saw this ad\" must be as-of the impression, never computed over the whole training window."
              ] },
              { t: "note", variant: "trap", html: "<strong>The classic leak: an aggregate that includes the outcome you are predicting.</strong> Build \"creative CTR over the last 7 days\" from a window that overlaps your label period and the feature partly <em>is</em> the label. Offline AUC jumps, the team celebrates, and online performance is flat because at serving time the future half of that window does not exist. Every count and rate feature needs a point-in-time cutoff and a serving path that computes it the same way \u2014 see <a href='#/mlsd/concepts/feature-pitfalls'>feature pitfalls</a> and <a href='#/mlsd/concepts/feature-stores'>feature stores</a>." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> log loss as primary (proper scoring rule), PR-AUC for discrimination under imbalance, ROC-AUC only as a familiar secondary, and calibration measured as a curve \u2014 predicted probability versus realised rate per bucket \u2014 not as a single scalar.",
                "<strong>Calibration per slice</strong> is the check people skip: overall calibration can look excellent while new advertisers are over-predicted by 40% and one placement is under-predicted. Slice by placement, advertiser tenure, device, and predicted-probability decile.",
                "<strong>Online:</strong> revenue per thousand requests and realised CTR versus predicted CTR as the calibration monitor. Guardrails on user-side metrics and on advertiser-side delivery, because a calibration shift silently reallocates spend between advertisers.",
                "<strong>Latency</strong> is an evaluation metric here, not an ops detail. A model that is 1% better on log loss and blows the p99 budget is not better."
              ] },
              { t: "ol", items: [
                "<strong>\"Your AUC is 0.85 but revenue dropped. What happened?\"</strong> The expected answer names calibration: ordering intact, probabilities shifted, so expected-value ranking against fixed bids reallocated spend and mispriced. Check predicted-versus-realised CTR by slice first, and check whether a downsampling rate changed.",
                "<strong>Position and selection effects.</strong> The ad you observed was in a slot, and the slot affects clicks. If your placement or position is a feature, it is doing double duty as a bias term \u2014 handle it the way search handles <a href='#/mlcase/retrieval/search-ranking'>position bias</a>, and be careful that it stays fixed at serving time.",
                "<strong>Cold-start creatives.</strong> A brand-new creative has no history, so it leans on advertiser, category, and format priors, and it needs a small exploration allowance to earn its own estimate. Under-predict it and it never gets shown; over-predict it and the advertiser's budget is spent on a guess. This is the same shape as new-item cold start in <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a>, but the mistake costs someone money immediately."
              ] },
              { t: "cue", html: "The sentence that separates this problem from every other ranker: \u201cThis is the one place where the probability has to be numerically true, not just correctly ordered \u2014 the auction multiplies it by a bid and charges against the result. So I'd train with log loss, correct for negative downsampling explicitly, keep calibration as a separate fitted layer I can refit without retraining, and monitor predicted versus realised CTR per slice as an SLO.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds a binary classifier with sensible features, knows the classes are imbalanced, and mentions AUC. Typically treats the output as a score to rank with and does not distinguish ranking from pricing."],
                  ["<strong>Senior</strong>", "Leads with calibration as a requirement and can justify log loss as a proper scoring rule. Handles cardinality with hashing and states the collision trade-off. Applies the downsampling correction, uses PR-AUC under imbalance for the right reason, and designs to the latency budget explicitly."],
                  ["<strong>Staff</strong>", "Treats calibration as an operational SLO with per-slice monitoring and a refit path independent of retraining. Reasons about marketplace effects \u2014 how a calibration shift reallocates advertiser spend \u2014 names the delayed-label problem in the training join, and can debug the \"AUC up, revenue down\" scenario from first principles."]
                ]
              },
              { t: "quiz", id: "mlcase-recsys" },
              { t: "note", variant: "key", html: "<strong>A ranker needs order; an auction needs truth.</strong> Every unusual choice on this page \u2014 log loss over a ranking loss, a separate calibration layer, the <code class='tok'>p = p<sub>s</sub>/(p<sub>s</sub>+(1&minus;p<sub>s</sub>)/w)</code> correction after downsampling, per-slice calibration monitoring \u2014 exists because a monotone rescaling of your scores changes nothing about the ranking and everything about the money." }
            ]
          },

          /* ---------- 8. people you may know ---------- */
          {
            id: "people-you-may-know",
            title: "Suggesting people you may know",
            summary: "Graph candidate generation, reciprocity as part of the score, and an objective that counts accepted connections that turn into interaction \u2014 not requests sent.",
            minutes: 11,
            tags: ["recommendation", "graph", "reciprocity", "guardrails"],
            blocks: [
              { t: "p", html: "Every other recommender in this module suggests an item to a person. This one suggests <strong>a person to a person</strong>, and that single change rewrites the problem. The item never minds being recommended; the recipient of a connection request does. A suggestion only succeeds if the viewer sends, the recipient accepts, and the new edge is then actually used \u2014 three events, two people, and a cost borne by someone who never asked to be part of your experiment. The mental model to hold: this is a <strong>two-sided match on a graph</strong>. Candidates come from the graph's own structure, the score has to model both sides' willingness, and the guardrails protect the side that is not holding the phone." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What kind of edge?</strong> Symmetric (request, then accept) or asymmetric (follow, no consent needed)? <em>Assume:</em> symmetric request-and-accept. Asymmetric follows make reciprocity optional and the problem much closer to plain recommendation \u2014 say which one you are designing.",
                "<strong>Which surface?</strong> <em>Assume:</em> a dedicated suggestions module plus an onboarding flow for brand-new members. The onboarding moment is where this product matters most, because a member with no connections has an empty experience everywhere else.",
                "<strong>Scale of the graph?</strong> <em>Assume:</em> on the order of 10<sup>9</sup> members, median degree in the low hundreds, with a long tail of members holding thousands of connections.",
                "<strong>What signals may we use?</strong> <em>Assume:</em> the connection graph, shared contexts (school, employer, groups, events), and contact uploads only where the member consented. Privacy constraints here are product requirements, not legal footnotes.",
                "<strong>What is success for the business?</strong> <em>Assume:</em> members who form a handful of active connections early retain far better, so the objective must ladder up to <em>useful</em> connections rather than a raw edge count.",
                "<strong>Out of scope:</strong> the messaging product, group recommendations, and the follow/creator graph. Name them so they are clearly a choice."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> return a ranked list of suggested members; update suggestions soon after a new connection forms; never suggest a blocked member, an existing connection, or a pending request; respect per-recipient limits on incoming requests; support dismiss as an explicit negative signal.",
                "<strong>Non-functional:</strong> orders of magnitude below, stated as assumptions."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds the design"],
                rows: [
                  ["Members", "~10<sup>9</sup>", "Pairwise scoring is impossible; candidates must come from graph structure or an index"],
                  ["Two-hop fan-out", "a member with 500 connections whose connections each have 500 reaches ~250,000 friend-of-friend paths", "Friends-of-friends has to be sampled, weighted, and truncated, not enumerated per request"],
                  ["Serving latency", "tens of milliseconds to rank a few hundred precomputed candidates", "Candidate generation runs offline or incrementally; only the ranker runs per request"],
                  ["Freshness after a new edge", "minutes", "The moment after someone connects is when their next suggestions are most accurate \u2014 a nightly-only refresh wastes it"],
                  ["Inbound request load", "a capped number of suggestion-driven requests per recipient per week", "Stops popular members from absorbing everyone's suggestions; becomes a constraint in ranking"]
                ]
              },
              { t: "note", variant: "tip", html: "Say the two-hop arithmetic out loud. <strong>500 \u00d7 500 = 250,000</strong> paths for an ordinary member, and members with thousands of connections push that into the millions. That one sentence justifies offline candidate generation, weighting that down-ranks hubs, and an incremental path for new edges \u2014 three design decisions earned in ten seconds." },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the network"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise connection requests sent", "Rewards whatever gets a tap \u2014 attractive strangers, popular members, people from one shared event a decade ago. Recipients drown in requests they ignore or resent, and the surface becomes a harassment vector with a recommendation engine attached."],
                  ["<strong>Naive</strong>", "Maximise accepted requests", "Better, and still gameable. People accept out of politeness, so you grow edges nobody uses, and the model learns to route requests toward members who accept everything, concentrating load on a small set of hubs."],
                  ["<strong>Solid</strong>", "Maximise expected accepted connections: <code class='tok'>p(send | shown) &times; p(accept | sent)</code>, with guardrails on decline, ignore, and report rates", "Reciprocity is now inside the score: a suggestion the recipient would never accept is worth nothing however likely the sender is to tap it. The recipient's experience has a measured floor."],
                  ["<strong>Standout</strong>", "Maximise accepted connections that lead to <em>meaningful interaction</em> within a window (messages, mutual engagement), subject to recipient-side harm caps, a per-recipient inbound budget, and a priority on activating new members", "Optimises the edge's value rather than its existence, protects the side that bears the cost, and spends suggestions where they change someone's experience most \u2014 a member with three connections gains far more from a fourth than one with three thousand."]
                ]
              },
              { t: "p", html: "The mechanism is a product of terms, and each term is a separate head: <code class='tok'>score = p(send) &middot; p(accept | send) &middot; E[interaction | connected] &minus; &lambda; &middot; p(report or block)</code>. The accept head is trained on the <em>recipient's</em> features and history \u2014 how they respond to requests from strangers, from shared employers, from people with few mutuals \u2014 which is what reciprocity means in practice. The inbound cap then turns this from independent per-viewer ranking into a light allocation problem: a recipient who is a top suggestion for ten thousand people should be shown to the ones most likely to form a useful edge. More on combining heads in <a href='#/rank/ranking/multi-objective'>multi-objective ranking</a>." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Rank friends-of-friends by mutual-connection count", "Buys a strong, explainable baseline in a day \u2014 mutual count is genuinely one of the best single features. Costs you hub bias (a mutual who knows everyone is weak evidence), nothing for members with no connections yet, and no notion of whether the recipient wants the request."],
                  ["<strong>Naive</strong>", "One <code class='tok'>p(send)</code> classifier over all candidates", "Buys personalisation on the sender side. Costs you reciprocity entirely: it learns who people tap on, not who would say yes, and it will keep surfacing the same attractive strangers."],
                  ["<strong>Solid</strong>", "Several candidate sources \u2014 weighted friends-of-friends, shared contexts, consented contacts, graph-embedding neighbours \u2014 unioned into a gradient-boosted ranker with send and accept heads", "Buys coverage from structurally different sources and a ranker that sees mutual counts, context overlap, and recipient behaviour together. Costs multiple candidate pipelines to keep fresh and a second label (accept) that arrives later than the first."],
                  ["<strong>Standout</strong>", "The same sources plus <a href='#/rank/retrieval/two-tower'>two-tower</a> or graph-embedding retrieval for sparse members \u2192 multi-task ranker with send, accept, interact, and harm heads \u2192 policy layer enforcing blocks, safety rules, inbound caps, and exploration for new members", "Buys a score that encodes both sides and the edge's value, plus a place for rules that must never be learned away. Costs a multi-head model whose heads disagree by design, and an allocation step that couples rankings across users."]
                ]
              },

              { t: "h2", text: "Candidate generation on a graph" },
              { t: "ul", items: [
                "<strong>Weighted friends-of-friends.</strong> Do not just count mutuals \u2014 weight each mutual by how informative it is. A mutual with 40 connections is strong evidence; one with 4,000 is barely any. Scores in the Adamic\u2013Adar family do exactly this by dividing by the log of each mutual's degree.",
                "<strong>Sample the expensive hops.</strong> For high-degree members, walk a sample of their connections (or run short random walks) rather than enumerating every two-hop path. Personalised random walks give a natural, tunable approximation.",
                "<strong>Shared contexts.</strong> Same school and years, same employer and team, same group or event. These cover members whose graph neighbourhood is thin and they explain themselves well in the UI.",
                "<strong>Embeddings.</strong> Graph embeddings (or a two-tower model trained on formed edges) put structurally similar members near each other and serve through an <a href='#/rank/retrieval/ann-indexes'>ANN index</a>. They help most for new members, provided onboarding gave you a few edges or contexts to embed from.",
                "<strong>Two cadences.</strong> Recompute everything in a daily batch, and incrementally refresh a member's candidates when a new edge event arrives on the stream. The incremental path is where most of the lift on fresh connections lives."
              ] },
              { t: "code", lang: "text", code:
                "Adamic-Adar style weight for candidate c of viewer v:\n" +
                "  score(v, c) = sum over mutuals m of  1 / log(degree(m))\n" +
                "\n" +
                "  mutual with  40 connections -> 1/log(40)   ~= 0.27\n" +
                "  mutual with 4000 connections -> 1/log(4000) ~= 0.12\n" +
                "\n" +
                "candidate budget per viewer:\n" +
                "  ~250k two-hop paths -> top ~1,000 by weight (offline)\n" +
                "  + shared-context + embedding sources        (~500)\n" +
                "  -> filter blocks / existing / pending        -> ranker (~300)\n"
              },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE  (daily + streaming)               ONLINE  (per page view)\n" +
                "-------------------------------------      ----------------------------------\n" +
                "graph snapshot + edge events               request(viewer, surface)\n" +
                "     |                                             |\n" +
                "     +--> weighted FoF / random walks              v\n" +
                "     +--> shared-context joins           CANDIDATE STORE (precomputed ~1.5k)\n" +
                "     +--> graph embeddings -> ANN INDEX    + incremental refresh on new edge\n" +
                "     |                                             |\n" +
                "     v                                             v\n" +
                "candidate store  <---- edge stream        HARD FILTERS: blocked, existing,\n" +
                "                                           pending, safety rules (minors etc.)\n" +
                "suggestion + request + accept logs                 |\n" +
                "     |                                             v\n" +
                "     v                                    MULTI-TASK RANKER\n" +
                "label joins (send, accept, interact,       p(send) p(accept) p(interact)\n" +
                "  decline, report, block)                  p(report/block)\n" +
                "     |                                             |\n" +
                "     v                                             v\n" +
                "ranker training ---> registry ------->     ALLOCATION / POLICY LAYER\n" +
                "                                           inbound caps per recipient\n" +
                "                                           new-member priority, explore\n" +
                "                                                   |\n" +
                "                                                   v\n" +
                "                                           ~10 suggestions + impression log\n"
              },
              { t: "p", html: "Two arrows carry the design. <strong>Edge stream \u2192 candidate store</strong> is the incremental path: when someone connects, their two-hop neighbourhood changes immediately, and refreshing it within minutes is cheap relative to the value of that moment. <strong>Allocation / policy layer after the ranker</strong> is where the recipient is protected: hard filters run before ranking because they are absolute, while inbound caps run after ranking because they need the scores to decide who gets the scarce slots. The graph storage and traversal machinery is Blueprint's territory; here it is a component that hands you candidates with mutual counts attached." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log</strong> every suggestion shown with its position and source, every send, every accept, decline, and ignore (a request still pending after N days), and every report or block that follows. Without the source you cannot tell which candidate pipeline is pulling its weight.",
                "<strong>Features:</strong> mutual count and weighted mutual score, shared contexts and their strength (same team versus same 50,000-person employer), geographic and language overlap, the candidate's inbound pending requests, both members' degree and tenure, and the recipient's historical accept rate by request type.",
                "<strong>Three labels, three delays.</strong> Send is immediate; accept arrives over days; interaction arrives over weeks. Train the send head on fresh data and the accept and interact heads on matured windows, or the slow heads learn that recent requests were all declined.",
                "<strong>Negatives:</strong> shown-but-not-sent is a weak negative (perhaps not noticed); an explicit dismiss is strong; a decline or ignore is the accept head's negative; a report or block is the strongest signal you will get and deserves its own head."
              ] },
              { t: "note", variant: "trap", html: "<strong>A friend suggestion can reveal something private.</strong> Suggest a member's therapist, an ex they blocked on another surface, or someone they only know because the other person uploaded their phone number, and you have exposed a relationship nobody chose to share. The safety rules are concrete: blocked pairs never surface in either direction, contact-upload signals only flow where both sides consented, minors are never suggested to unrelated adults, and senders with high harassment or spam scores lose suggestion visibility before they lose anything else. These are hard filters, not model features." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> hold out edges formed after a cutoff and measure recall@k of those future edges among the candidates and top-ranked suggestions. Time-based splits only \u2014 a random edge split lets the model see the triangle it is being asked to close.",
                "<strong>Offline, per head:</strong> AUC and calibration for send, accept, and harm heads; the product of heads is only meaningful if each one is calibrated (see <a href='#/found/metrics/calibration'>calibration</a>).",
                "<strong>Online primary:</strong> accepted connections per member that show interaction within the window. <strong>Guardrails:</strong> decline and ignore rate, reports and blocks per thousand requests, inbound request load on the most-suggested members, and new-member activation.",
                "<strong>Experiment design trap:</strong> treating a viewer also changes the inbox of recipients who may be in control, so a naive per-user split leaks. Cluster or graph-partitioned randomisation reduces that interference \u2014 see <a href='#/found/experiments/ab-test-design'>A/B test design</a>."
              ] },
              { t: "ol", items: [
                "<strong>Reciprocity.</strong> Expect to be asked how you model the recipient. The answer is an accept head trained on recipient-side features and outcomes, plus an inbound cap, so a suggestion's score reflects both people.",
                "<strong>The new member.</strong> No edges, so friends-of-friends is empty. Lean on onboarding signals \u2014 consented contacts, declared school and employer, location \u2014 and give new members a priority share of everyone else's suggestion slots. The general machinery is in <a href='#/rank/dynamics/cold-start'>cold start</a>.",
                "<strong>Rich-get-richer.</strong> Mutual-count ranking concentrates suggestions on already well-connected members, which grows hubs and starves the periphery. Measure the distribution of suggestions received and treat it as a guardrail; <a href='#/rank/dynamics/feedback-fairness'>feedback and fairness</a> covers the loop."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cThis is a two-sided match, so I'd score a suggestion as p(send) times p(accept), weighted by the chance the connection actually gets used, minus a harm term \u2014 and I'd protect the recipient with hard safety filters and a cap on inbound suggestion-driven requests, because they bear the cost of every bad suggestion.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Generates friends-of-friends candidates, ranks by mutual count or a send classifier, and names sensible graph features. Usually optimises requests or accepts and does not model the recipient."],
                  ["<strong>Senior</strong>", "Puts reciprocity in the score with a separate accept head, handles the two-hop explosion with weighting and sampling, adds shared-context and embedding sources for sparse members, and names the safety filters and the interference problem in experiments."],
                  ["<strong>Staff</strong>", "Optimises for connections that lead to interaction and frames suggestions as a scarce allocation across recipients, with inbound caps and new-member priority. Treats privacy leaks as hard constraints, designs graph-aware experiments, and watches suggestion concentration as a network-health guardrail."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>A person is not an item: the recipient has to want it too.</strong> Generate candidates from graph structure with hub-aware weighting, score <code class='tok'>p(send) &times; p(accept)</code> weighted by the chance the edge gets used, and protect the recipient with hard safety filters and an inbound cap \u2014 because a send-only objective turns a growth feature into a harassment tool." }
            ]
          },

          /* ---------- 9. notification ranking ---------- */
          {
            id: "notification-ranking",
            title: "Choosing which notifications to send, and when",
            summary: "Incremental engagement versus the cost of a disabled channel, uplift instead of response prediction, volume caps, send-time, and the holdouts that make any of it measurable.",
            minutes: 12,
            tags: ["notifications", "uplift", "fatigue", "holdout"],
            blocks: [
              { t: "p", html: "Notifications are the one recommendation surface the user did not open. Every other system in this module ranks what someone asked to see; this one decides whether to <strong>interrupt</strong> them. That makes two things true at once. Each send spends from a shared, finite budget of attention, and overspending is close to permanent \u2014 a member who disables push or unsubscribes from email takes the whole channel with them. And the number everyone reaches for first, the open rate, mostly measures who was coming back anyway. The mental model: <strong>a notification is an intervention, and its value is the difference it makes</strong> \u2014 engagement if sent minus engagement if not sent, minus what it costs in fatigue and lost channels." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>Which channels?</strong> <em>Assume:</em> mobile push and email. In-app inbox items are cheaper and can be ranked like a feed; say you are excluding them.",
                "<strong>Which notifications are optional?</strong> <em>Assume:</em> transactional messages (security alerts, receipts, password resets) always send and are out of scope. Everything social or recommendation-driven is a candidate the system may suppress.",
                "<strong>Where do candidates come from?</strong> <em>Assume:</em> event producers (someone commented, a connection posted, a live stream started) and scheduled producers (digests, recommendations, reminders), generating tens of candidates per member per day.",
                "<strong>How fast must social events go out?</strong> <em>Assume:</em> within seconds to minutes when sent \u2014 a reply notification delivered tomorrow is worthless. Digests can be batched.",
                "<strong>What counts as harm?</strong> <em>Assume:</em> push disables, email unsubscribes, spam complaints, and app uninstalls. Each is a one-way door that removes future value.",
                "<strong>Out of scope:</strong> the delivery infrastructure, device token management, and template copywriting."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> for each candidate decide send now, delay to a better time, aggregate with similar candidates, or drop; enforce per-member volume caps and quiet hours in local time; deduplicate (\"five people liked your post\" rather than five pushes); keep a persistent holdout that receives no optional notifications.",
                "<strong>Non-functional:</strong> orders of magnitude below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds the design"],
                rows: [
                  ["Candidates", "~10<sup>9</sup> per day across ~10<sup>8</sup> members", "Decision service must be cheap per candidate and horizontally scaled"],
                  ["Decision latency", "seconds for event-driven candidates; batch for digests", "Two paths: a streaming decision path and a scheduled planner"],
                  ["Volume cap", "a small, per-member adaptive daily budget", "Turns ranking into allocation: sending one thing means not sending another"],
                  ["Send-time windows", "local-time windows, quiet hours honoured", "Requires timezone and activity-pattern features, and a delay queue"],
                  ["Global holdout", "a small persistent slice (order 1\u20135%) with no optional sends", "The only way to measure incrementality of the whole system over months"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the product"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise notification open rate", "Optimises who to send to rather than what helps: the highest open rates belong to heavy users who would have opened the app within the hour regardless. Open rate climbs, incremental value stays near zero, and light users \u2014 the ones a notification could actually bring back \u2014 are ignored."],
                  ["<strong>Naive</strong>", "Maximise sessions attributed to notifications", "Rewards volume. Attribution credits every session that started from a tap, including the ones that would have started organically, so the system cannibalises organic traffic and reports it as growth \u2014 until disable rates catch up with it."],
                  ["<strong>Solid</strong>", "Per candidate, maximise <code class='tok'>p(engage | sent) &minus; &lambda; &middot; p(disable | sent)</code> under a daily volume cap", "Puts the cost of fatigue into the same score as the benefit, and the cap bounds the worst case. Still a response objective, so it still over-credits sure-thing users."],
                  ["<strong>Standout</strong>", "Maximise <em>incremental</em> long-run engagement \u2014 <code class='tok'>E[engagement | send] &minus; E[engagement | no send]</code> \u2014 minus a priced cost of disables and unsubscribes (the lifetime value of the channel), allocated under adaptive caps and quiet hours, and validated against a persistent holdout", "Optimises the causal effect rather than the correlation, prices the one-way door explicitly, and measures the whole system against members who received nothing \u2014 the only comparison that cannot be fooled by attribution."]
                ]
              },
              { t: "code", lang: "python", code:
                "def decide(member, cand, sent_today, cap, lam):\n" +
                "    # uplift: how much more likely is engagement if we send?\n" +
                "    uplift = p_engage_if_sent(member, cand) - p_engage_if_not(member, cand)\n" +
                "    # one-way door: disabling push removes all future value of the channel\n" +
                "    cost = lam * p_disable_if_sent(member, cand)\n" +
                "    value = uplift - cost\n" +
                "    if sent_today >= cap or value <= 0:\n" +
                "        return \"drop\"            # or fold into tomorrow's digest\n" +
                "    if in_quiet_hours(member):\n" +
                "        return \"delay\"\n" +
                "    return \"send\"\n"
              },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Hand rules: send every event of certain types, cap at N per day, newest first", "Buys predictability and an easy baseline. Costs you any notion of which notification matters to which member, and fixed caps are simultaneously too many for light users and too few for engaged ones."],
                  ["<strong>Naive</strong>", "A response model ranking candidates by <code class='tok'>p(open | sent)</code>", "Buys personalisation and a high open rate. Costs you incrementality: it learns who opens, not who opens <em>because</em> of the notification, so it pours budget onto sure things."],
                  ["<strong>Solid</strong>", "Response model with separate engage and disable heads, a per-member adaptive cap, aggregation of similar candidates, and a send-time model", "Buys fatigue awareness and better timing at modest cost. Still credits sure things, but the disable head stops the worst over-sending."],
                  ["<strong>Standout</strong>", "Uplift model trained on randomised send/no-send data (two-model or meta-learner style), disable and unsubscribe heads, a daily planner that allocates each member's budget across candidates and hours, plus exploration and a persistent holdout", "Buys a score aligned with causal value and a planner that treats the cap as a real constraint. Costs you a deliberate randomisation budget \u2014 some members miss some notifications so you can learn \u2014 and uplift estimates are noisier than response estimates."]
                ]
              },

              { t: "h2", text: "Uplift, not response" },
              { t: "p", html: "Split members, for any given notification, into four groups by what they would do with and without it. A response model sees only the left column of outcomes and cannot tell the groups apart; an uplift model is trained to." },
              { t: "table",
                headers: ["Group", "If sent", "If not sent", "What a response model does"],
                rows: [
                  ["Persuadable", "engages", "does not engage", "Ranks them moderately \u2014 these are the only members where the send creates value"],
                  ["Sure thing", "engages", "engages anyway", "Ranks them highest \u2014 every open looks like success and none of it is incremental"],
                  ["Lost cause", "does not engage", "does not engage", "Ranks them low, correctly, but for the wrong reason"],
                  ["Do-not-disturb", "disengages or disables", "stays", "Cannot see the harm at all unless a disable head exists"]
                ]
              },
              { t: "p", html: "Uplift needs counterfactual data, which logs from a deterministic policy do not contain: if every high-score candidate was sent, you never observed what those members did without it. So you randomise \u2014 hold back a small random fraction of would-be sends at the candidate level \u2014 and train either two models (sent, not sent) and subtract, or a single model with the treatment as an input. Evaluate with uplift or Qini curves on held-out randomised data, not with AUC on opens. The general experimentation machinery is in <a href='#/found/experiments/ab-test-design'>A/B test design</a>." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "PRODUCERS                                   DECISION PATH\n" +
                "-------------------------------------       ----------------------------------\n" +
                "event producers (reply, mention, live)       candidate(member, type, payload)\n" +
                "scheduled producers (digest, recs)                    |\n" +
                "            |                                         v\n" +
                "            +------------------------------>  HARD RULES: opt-outs, transactional\n" +
                "                                              bypass, quiet hours, dedupe\n" +
                "OFFLINE                                               |\n" +
                "-------------------------------------                 v\n" +
                "send / no-send logs (+ random flag)          feature fetch: activity, sent today,\n" +
                "engagement + disable + unsub labels            per-type history, hour profile\n" +
                "            |                                         |\n" +
                "            v                                         v\n" +
                "uplift + disable + send-time models -------> SCORER: uplift - lam * p(disable)\n" +
                "            |                                         |\n" +
                "            v                                         v\n" +
                "registry                                     PLANNER: per-member budget,\n" +
                "                                              aggregate, pick send time\n" +
                "GLOBAL HOLDOUT (no optional sends) ---+               |\n" +
                "                                      |     send / delay queue / drop\n" +
                "                                      v               |\n" +
                "                       incrementality report  <--- delivery + outcome log\n"
              },
              { t: "p", html: "Three arrows matter. <strong>Random flag in the logs</strong>: the small randomised hold-back is what turns observational logs into training data for uplift, so it must be recorded on every candidate, not inferred later. <strong>Planner after scorer</strong>: scores are per candidate, but the cap is per member per day, so a later, better candidate should be able to displace an earlier one \u2014 that needs a planner with a short delay queue, not a send-immediately decision. <strong>Global holdout \u2192 incrementality report</strong>: per-candidate randomisation tells you about one notification; only a persistent holdout tells you whether the whole system adds or subtracts engagement over months." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log</strong> every candidate, including the ones you did not send, with the decision, the score, the randomisation flag, and the planned send time. Logging only sends makes every future model blind to the counterfactual.",
                "<strong>Features:</strong> recency and frequency of the member's activity, notifications already sent today and this week, historical engagement by notification type, an hour-of-day activity profile, the relationship to the actor (close connection versus stranger), and content quality.",
                "<strong>The label</strong> is engagement within a window after the decision \u2014 for example, any session within two hours \u2014 measured for sent <em>and</em> not-sent candidates, so the two can be compared. A tap is not the label; a session is.",
                "<strong>Harm labels:</strong> push disable, unsubscribe, spam complaint, and uninstall within a window after a send. They are rare and delayed, so pool them across notification types and use class weighting (see <a href='#/data/labels/class-imbalance'>class imbalance</a>)."
              ] },
              { t: "note", variant: "trap", html: "<strong>Attribution lies in your favour.</strong> \"Sessions opened from a notification\" counts every member who tapped, including the many who would have opened the app ten minutes later anyway. Teams that optimise this number ship more notifications, see attributed sessions rise, and only discover months later \u2014 through disable rates and a flat overall engagement curve \u2014 that they were relabelling organic traffic. Only a comparison against members who did not receive the notification measures what it did." },

              { t: "h2", text: "Send time, fatigue, and caps" },
              { t: "ul", items: [
                "<strong>Send-time optimisation</strong> predicts engagement by hour for each member and delays non-urgent candidates to the best window. Beware confounding: members engage at 8pm partly because that is when you sent them things. Randomise send times on a small slice to learn the real curve.",
                "<strong>Fatigue is diminishing returns, then negative returns.</strong> The fifth notification of the day is worth less than the first and costs more in disable risk. Encode it as features (sent today, sent this week) and as an adaptive cap that shrinks for members who ignore notifications.",
                "<strong>Aggregation</strong> \u2014 folding similar events into one message \u2014 is often the single biggest fatigue win, and it is a product decision as much as a model one.",
                "<strong>Email is different.</strong> Spam complaints damage sender reputation for <em>every</em> member, so a complaint costs far more than one lost subscriber and deserves its own, higher price."
              ] },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> uplift or Qini curves on randomised held-out candidates for the uplift model; calibration and recall for the disable head; replay of the planner against logged candidates to check caps and timing behave.",
                "<strong>Online primary:</strong> incremental daily or weekly actives versus the persistent holdout \u2014 the system's whole-life effect.",
                "<strong>Online guardrails:</strong> push disable rate, email unsubscribe and complaint rate, uninstall rate, and notifications per member per day.",
                "<strong>Run experiments long enough.</strong> Fatigue accumulates over weeks, so a one-week test of a higher-volume policy shows the engagement gain and hides most of the disable cost. Watch the treatment effect over time and expect it to shrink."
              ] },
              { t: "ol", items: [
                "<strong>\"Open rate is up 20%, why aren't you celebrating?\"</strong> Because the model may simply be sending to sure things. Ask what the holdout says.",
                "<strong>Holdout design.</strong> A persistent member-level holdout measures the whole system; candidate-level randomisation trains the uplift model. They answer different questions and you usually want both.",
                "<strong>Caps as constraints.</strong> With a daily budget, the right question is not \"is this candidate good?\" but \"is it the best use of one of today's slots?\" \u2014 a small allocation problem that a greedy planner with a short delay window handles well."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cI wouldn't rank on open probability \u2014 that rewards sending to people who were coming back anyway. I'd model uplift, the difference between engaging if sent and if not sent, train it on a small randomised hold-back, subtract a priced cost for disables because that channel never comes back, and measure the whole system against a persistent no-notification holdout.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Ranks candidates by predicted open probability with a daily cap and sensible features. Measures success by open rate or attributed sessions."],
                  ["<strong>Senior</strong>", "Adds a disable head and prices fatigue into the score, separates event-driven from batched paths, handles send time and aggregation, and insists on a holdout because attribution overstates impact."],
                  ["<strong>Staff</strong>", "Frames the objective as incremental engagement minus a priced one-way-door cost, explains why a response model credits sure things and how randomised data enables uplift, treats the cap as an allocation problem, and designs experiments long enough to see fatigue."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>A notification's value is the difference it makes, not the tap it gets.</strong> Model uplift from randomised send/no-send data, price disables and unsubscribes as the permanent losses they are, allocate a per-member budget rather than sending everything that scores well, and judge the system only against members who received nothing." }
            ]
          }
        ]
      },

      /* ==================== TRUST ==================== */
      {
        id: "trust",
        name: "Trust & Safety",
        icon: "shield",
        lessons: [

          /* ---------- 4. harmful content ---------- */
          {
            id: "harmful-content",
            title: "Detecting and acting on harmful content",
            summary: "The objective ladder that ends at views rather than items, the human queue as part of the system, and why the threshold is not yours to choose.",
            minutes: 12,
            tags: ["moderation", "precision-floor", "multimodal", "human-in-the-loop"],
            blocks: [
              { t: "p", html: "This problem looks like classification and is really <strong>resource allocation under an asymmetric cost</strong>. You have a firehose of content, a model that produces a score, a small number of human reviewers, and two very different ways to be wrong: you can silence someone who did nothing, or you can leave something up that hurts people. The design is mostly about where you put that trade. So the mental model is that <strong>the model does not make decisions, it makes a queue</strong> \u2014 ranking, thresholds, actions, and appeals are the system, and the classifier is one component inside it. Candidates who see only the classifier plateau at mid-level on this problem." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>Which policies?</strong> \"Harmful\" is not one class \u2014 violent threats, self-harm, spam, and misinformation have different severities, different legal exposure, and different evidence. <em>Assume:</em> several policy areas, modelled separately, with severity tiers.",
                "<strong>What actions are available?</strong> <em>Assume:</em> a ladder \u2014 remove, restrict distribution, add a warning interstitial, or queue for human review. Having more than one action is what makes the design tractable.",
                "<strong>Is there human review capacity?</strong> <em>Assume:</em> yes, and it is small relative to volume \u2014 thousands of reviews per day against millions of posts. Its size is a hard constraint on the whole design.",
                "<strong>Where do labels come from?</strong> <em>Assume:</em> user reports, reviewer decisions, and a small deliberately-sampled audit set. All three are biased differently, which matters more than their volume.",
                "<strong>Proactive or reactive?</strong> <em>Assume:</em> proactive \u2014 score at upload, before distribution. That is what makes exposure reducible, and it puts a latency budget on the ingest path.",
                "<strong>Out of scope:</strong> writing policy, regional legal variation, and the reviewer tooling itself. Name them so it is clear you know they exist."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> score every new post against each policy at upload; auto-action above a per-policy threshold; produce a <em>ranked</em> review queue sized to actual reviewer capacity; support appeal and reversal; keep an audit trail of every automated decision.",
                "<strong>Non-functional:</strong> below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds"],
                rows: [
                  ["Ingest volume", "~10<sup>6</sup>\u201310<sup>7</sup> new items/day", "Cheap pre-filter tier is mandatory; you cannot run the heavy multimodal model on everything"],
                  ["Scoring latency", "fast enough to decide before distribution \u2014 sub-second for the cheap tier, seconds acceptable for the heavy tier", "Two-tier design: cheap model on everything, heavy model on the uncertain slice"],
                  ["Prevalence", "well under 1% for most policies", "Accuracy is a meaningless metric; PR-based metrics only"],
                  ["Precision floor on removal", "high, set by policy per severity tier \u2014 the number is theirs, not yours", "Determines the operating point and therefore recall"],
                  ["Review capacity", "~10<sup>3</sup> reviews/day", "The queue must be ranked, and its length is capped by people, not by compute"],
                  ["Label latency", "hours to days for reported content", "Recent data is the least complete data; training windows must account for it"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "p", html: "This ladder is the best example in the whole track of why the objective deserves your first five minutes rather than your last." },
              { t: "table",
                headers: ["Tier", "Objective", "Why it lands there"],
                rows: [
                  ["<strong>Naive</strong>", "Remove the most harmful content possible", "Unbounded on the wrong side. Taken literally, removing everything scores perfectly. There is no term for the people you silenced, so the objective cannot tell a good system from a censorship machine."],
                  ["<strong>Naive</strong>", "Maximise classification accuracy", "At sub-1% prevalence, predicting \"safe\" for everything scores above 99%. The metric is dominated by the majority class and is essentially blind to the thing you care about. This one is worth naming explicitly because it is the default instinct."],
                  ["<strong>Solid</strong>", "Maximise the volume of harmful content removed, subject to a precision floor on removals", "Now both errors are represented: the floor bounds the harm you do to innocent authors, and within that constraint you maximise the harm you prevent. This is a defensible production objective."],
                  ["<strong>Standout</strong>", "Minimise <em>views</em> of harmful content, subject to that same precision floor", "The insight that separates senior from staff on this problem: harm is proportional to exposure, not to item count. A post seen by two people and a post seen by two million are not equal, so weight each candidate by its expected future views and let the queue and the actions follow that ordering. Same precision guarantee, far more harm prevented per unit of review capacity."]
                ]
              },
              { t: "p", html: "The Great row has a concrete mechanism, and you should give it: order the review queue and the borderline-action decisions by <code class='tok'>p(violates policy) &times; E[future views]</code>, not by <code class='tok'>p</code> alone. Predicted virality is itself a model, which you should admit \u2014 but even a crude version (author reach, early engagement velocity, item type) reorders the queue dramatically in favour of the items that actually matter. It also changes what \"recall\" should mean: report <strong>view-weighted recall</strong> alongside item recall, because the two can move in opposite directions." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Keyword and hash blocklists", "Buys instant, auditable, zero-latency enforcement, and for known-bad media hashes it remains genuinely correct forever \u2014 keep it as a tier. Costs you everything requiring context: it cannot distinguish a slur used as an attack from the same word quoted in a news report, and evasion is a single character substitution away."],
                  ["<strong>Naive</strong>", "One text classifier over the post body", "Buys a real improvement and handles the largest single modality. Costs you the majority of hard cases: harm arrives in images, video, audio, in the interaction between a benign caption and a violating image, and in coordinated behaviour that no single post reveals."],
                  ["<strong>Solid</strong>", "Per-policy multimodal classifiers (text + image/video frames + metadata) with severity-aware thresholds and routing into the review queue", "Buys per-policy operating points \u2014 essential, because a violent-threat threshold and a spam threshold should not be the same number \u2014 and the routing that turns scores into decisions. Costs you many models to train, monitor, and keep calibrated."],
                  ["<strong>Standout</strong>", "Shared multimodal encoder with per-policy heads, a cheap pre-filter tier in front of it, weak supervision for new policies, exposure-weighted queueing, and a fast path for hash-matched known media", "Buys sample efficiency where it is scarcest (rare policies borrow representation from common ones), the ability to stand up a new policy in days rather than months, and a compute profile that fits the ingest volume. Costs coupling and a genuinely complex evaluation surface \u2014 you now need per-policy, per-modality, per-language slices."]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>The threshold is not an ML decision.</strong> It is the exchange rate between wrongful removals and prevented harm, and it has legal, regional, and editorial dimensions. Your job is to hand policy an honest precision/recall curve per policy area and implement whatever point they pick \u2014 then measure whether reality matched the curve. Choosing it yourself by maximising F1 silently asserts that precision and recall matter equally, which nobody would defend out loud." },
              { t: "widget", id: "mlcaseThreshold" },
              { t: "p", html: "Move the threshold in the lab above and watch what is actually happening: <strong>precision rises and recall falls, always, in that direction</strong>. Recall is monotone by definition \u2014 raising the bar can only remove items from the actioned set. Precision rises because a usefully ranked score means higher scores carry a higher true-positive rate, so discarding the lowest-scoring slice discards the worst-purity slice. Two things worth noticing: the review band is frequently many times larger than any plausible reviewer headcount, and at a threshold of 1.00 you have not built a cautious system, you have built no system." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "INGEST (per new item)                    OFFLINE\n" +
                "-----------------------------------      ---------------------------------\n" +
                "new post\n" +
                "   |\n" +
                "   v\n" +
                "hash match / blocklist  --yes-->  act immediately, log\n" +
                "   | no\n" +
                "   v\n" +
                "CHEAP TIER (small model, all items)\n" +
                "   |                                     reviewer decisions ---+\n" +
                "   | uncertain slice only                 user reports --------+--> LABEL\n" +
                "   v                                      audit sample -------+     STORE\n" +
                "HEAVY TIER (multimodal, per-policy heads)                            |\n" +
                "   |                                                                v\n" +
                "   v                             training (per-policy heads,  shared encoder)\n" +
                "score_p  +  E[future views]                                        |\n" +
                "   |                                                                v\n" +
                "   +--> above auto-action threshold ---> ACTION (remove / restrict /\n" +
                "   |                                              interstitial) --> appeal\n" +
                "   +--> in review band ---> RANKED QUEUE (by p * views, capped at\n" +
                "   |                        reviewer capacity) --> reviewer --> label\n" +
                "   +--> below band ---> allow  (sampled for audit)\n" +
                "\n" +
                "appeal --> human re-review --> reversal + hard-negative label\n"
              },
              { t: "p", html: "The arrows that matter are the ones going <em>back</em>. <strong>Reviewer \u2192 label store</strong> is your highest-quality label source, which means the queue you build determines the training data you get \u2014 rank only by score and you will systematically never label the ambiguous low-score region, and your model will stay blind there. Reserve a slice of review capacity for <em>random</em> sampling specifically to get unbiased labels, even though it feels like wasting scarce reviewers. <strong>Appeal \u2192 hard-negative label</strong> is the other one: overturned decisions are exactly the examples your model is most confidently wrong about. And the <strong>below-band audit sample</strong> is the only way you can ever estimate what you are missing, since by construction nobody looks at that region." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Signals are multimodal and behavioural:</strong> post text (and its language), image and video frames, audio transcript, OCR text inside images \u2014 which is where a lot of evasion goes \u2014 plus author history, early engagement pattern, and the reaction of the audience (mass reporting, comment sentiment).",
                "<strong>Cross-modal cases are the hard ones.</strong> A benign caption over a violating image, or a violating caption over a benign image, are both invisible to any single-modality model. This is the strongest technical argument for a shared encoder over independent per-modality classifiers.",
                "<strong>The label definition is the hardest part of this problem.</strong> \"Harmful\" is a policy judgement, so the label is a human decision with real inter-rater disagreement on exactly the boundary cases you most need to learn. Treat reviewer agreement as data: items with split votes are genuinely ambiguous and should be trained on as soft labels rather than forced to 0 or 1.",
                "<strong>Label sources are biased in different directions.</strong> Reports over-represent content that got distribution and content that offended a vocal audience; reviewer decisions only exist for items you queued; the audit sample is the only unbiased source and it is small. Weight accordingly and never treat the union as one clean dataset."
              ] },
              { t: "note", variant: "trap", html: "<strong>Two failure modes specific to this problem.</strong> First, <em>label delay</em>: reports and reviews arrive hours to days late, so your most recent training window is systematically missing positives and looks deceptively clean. Second, <em>enforcement truncation</em>: content you removed generated no further engagement, so the behavioural features of positives in your training data are shaped by your own past interventions \u2014 the model partly learns \"what my predecessor removed\" instead of \"what is harmful\". Both are <a href='#/mlsd/serving/feedback-loops'>feedback loops</a>, and both are why the random audit sample is worth its cost." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> precision at the policy-mandated recall, recall at the policy-mandated precision, and PR curves per policy. Never accuracy, and never a single global number across policies with different prevalences.",
                "<strong>Offline, the metric people forget:</strong> view-weighted recall. Item recall of 60% could mean you caught the two-view posts and missed the viral one, or the reverse. Only the view-weighted number tells you whether you reduced exposure.",
                "<strong>Slices are not optional here:</strong> per language, per region, per item type, per author-follower band. A model that performs well on average and badly in one language is a fairness problem and a policy incident waiting to happen.",
                "<strong>Online:</strong> prevalence of harmful content measured on a randomly sampled and human-reviewed slice of what users actually saw \u2014 that is the north-star number, because it is measured on the output of the whole system rather than on the classifier. Plus appeal rate and appeal-overturn rate as your false-positive alarm, and review-queue utilisation and age."
              ] },
              { t: "ol", items: [
                "<strong>\"You have capacity for 1,000 reviews a day and 50,000 uncertain items. What do you do?\"</strong> The expected answer: rank the queue by expected harm prevented, not by score; spend a fixed fraction on random sampling for unbiased labels; use the action ladder so the middle band gets a cheap reversible action (reduced distribution, interstitial) rather than waiting for a human; and be explicit that items which age out are a measured loss, not an invisible one.",
                "<strong>Adversarial evasion.</strong> Operators probe your thresholds and adapt \u2014 character substitution, cropping, re-encoding, text baked into images. Same dynamic as <a href='#/mlcase/trust/bot-detection'>bot detection</a>: your model decays because you deployed it, so retraining cadence and drift detection are design requirements. Never explain in the user-facing message exactly which signal fired.",
                "<strong>Precision floors and small policies.</strong> For a rare, high-severity policy you may have only hundreds of positive examples. Weak supervision, transfer from the shared encoder, and human-in-the-loop for everything above a low threshold are the realistic answers \u2014 and sometimes the honest answer is that a policy is not automatable yet and should be routed entirely to humans."
              ] },
              { t: "cue", html: "The framing that lands: \u201cI'd optimise for reducing <em>views</em> of violating content subject to a precision floor that policy sets, not for the count of items removed \u2014 harm scales with exposure. The classifier's real output is a ranked queue against a fixed review capacity, so the queue order and the action ladder are as much of the design as the model is.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds a text classifier, knows accuracy is wrong under imbalance and reaches for precision/recall. Mentions human review as a fallback. Usually picks the threshold themselves and does not distinguish item count from exposure."],
                  ["<strong>Senior</strong>", "States the objective as bounded removal under a precision floor, hands threshold selection to policy explicitly, designs the two-tier cheap/heavy architecture for the stated volume, treats the review queue as capacity-constrained and ranked, and names label delay and noise with concrete handling."],
                  ["<strong>Staff</strong>", "Optimises exposure rather than item count and can justify the view-weighting. Designs the label-generation loop deliberately \u2014 including spending scarce review capacity on random samples for unbiased evaluation \u2014 names enforcement truncation as a feedback loop, reasons about per-language and per-region fairness slices, and knows which policies should not be automated at all."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>Harm scales with exposure, so the objective should too.</strong> Minimise views of violating content subject to a precision floor that somebody else owns; treat the ranked human-review queue and the graduated action ladder as first-class parts of the system; and spend some of your scarcest resource \u2014 reviewer time \u2014 on random samples, because it is the only way you ever learn what you missed." }
            ]
          },

          /* ---------- 5. bot detection ---------- */
          {
            id: "bot-detection",
            title: "Detecting automated accounts",
            summary: "The problem where your opponent retrains against you: graph and behavioural signals, asymmetric false-positive cost, and why appeals are part of the architecture.",
            minutes: 11,
            tags: ["abuse", "adversarial", "graph-features", "appeals"],
            blocks: [
              { t: "p", html: "Every other problem on this track assumes the world is indifferent to your model. This one does not. Behind the accounts you are classifying is someone with a budget, a feedback signal (their accounts got banned), and an incentive to find the cheapest change that stops that happening. <strong>Your deployment is an intervention on the data-generating process.</strong> A model that decays after launch is not broken; it is working, and the opponent is responding. The consequence to internalise up front: <strong>a static model is a wrong answer here regardless of its accuracy.</strong> The deliverable is a system with a retraining cadence, drift detection, an action ladder graded by confidence, and a reversal path \u2014 not a classifier with a good validation score." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What counts as a bot?</strong> <em>Assume:</em> automation used for abuse \u2014 spam, fake engagement, scraping, credential stuffing. Note explicitly that plenty of automation is legitimate (publishing tools, accessibility clients, sanctioned APIs), so \"automated\" is not the label; \"abusive automation\" is.",
                "<strong>What actions are available?</strong> <em>Assume:</em> a ladder \u2014 silent rate limit, challenge (verification step), feature restriction, suspension. Multiple actions at different confidences is the single most important design lever you have.",
                "<strong>What is the decision latency?</strong> <em>Assume:</em> two paths. A real-time path at signup and login (milliseconds, thin features) and an asynchronous path that re-scores accounts on a schedule with rich history and graph features. Trying to do everything in one path is a common wrong turn.",
                "<strong>Where do labels come from?</strong> <em>Assume:</em> confirmed abuse (spam reports, payment fraud), manual investigations, appeal outcomes, and honeypots. All are sparse and delayed.",
                "<strong>How bad is a false positive?</strong> <em>Assume:</em> severe and personal \u2014 a real person locked out of their account, sometimes their livelihood. This asymmetry drives the whole operating-point discussion.",
                "<strong>Out of scope:</strong> account recovery flows, the challenge implementation itself, and the payments-fraud model. Adjacent, not this."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> score accounts and key actions for abusive automation; apply graduated actions by confidence; detect coordinated groups, not just individuals; support appeal with human review and full reversal; keep an audit trail of which signals drove each action.",
                "<strong>Non-functional:</strong> below, and note that one of them is about <em>decay</em>, which is unusual and is the point."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds"],
                rows: [
                  ["Real-time path latency", "tens of milliseconds at signup/login", "Only thin features available; no graph traversal, no long history"],
                  ["Async re-scoring", "all active accounts re-scored on a schedule (hours\u2013daily)", "Where the graph and behavioural-history features live"],
                  ["Precision floor, hard actions", "very high \u2014 suspension is the most expensive mistake in the system", "Sets the suspension threshold; everything below it gets a softer action"],
                  ["Model decay", "measurable within weeks of a deploy; retrain cadence must beat it", "Retraining and monitoring are requirements, not maintenance"],
                  ["Coverage", "must catch coordinated rings, not only individually-suspicious accounts", "Forces a graph or clustering component alongside the per-account classifier"],
                  ["Appeal turnaround", "bounded, and reversal must be complete", "An appeals path with a queue is part of the architecture"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "Why it lands there"],
                rows: [
                  ["<strong>Naive</strong>", "Block all bots", "Two failures in three words. It has no term for the real users you lock out, and it targets the wrong class \u2014 much automation is legitimate, so \"all bots\" would break sanctioned integrations on day one."],
                  ["<strong>Naive</strong>", "Maximise the classifier's AUC", "A metric masquerading as an objective. It says nothing about which errors cost what, nothing about the action taken, and \u2014 critically here \u2014 nothing about holding up over time against an adapting opponent. A model can have excellent AUC on last month's attack and be useless on this month's."],
                  ["<strong>Solid</strong>", "Maximise abusive accounts actioned, subject to a precision floor on hard actions", "Correct shape: bounded harm to real users, maximise enforcement inside that bound. Enough to run a real system."],
                  ["<strong>Standout</strong>", "Minimise <em>abuse delivered</em> \u2014 spam sent, fake engagement served, scraped volume \u2014 subject to a false-positive ceiling on authentic accounts, with a graduated action ladder and measured resistance to evasion", "Optimises the damage rather than the account count (the same exposure insight as <a href='#/mlcase/trust/harmful-content'>harmful content</a>: a dormant fake account causes nothing, a high-volume one causes a lot). Adds the two things this problem uniquely needs: the action ladder, so confidence maps to severity, and evasion resistance as an explicit objective rather than a hope."]
                ]
              },
              { t: "p", html: "Why the action ladder deserves to be in the objective and not in an appendix: a single threshold forces one decision for every confidence level, which means you either suspend on weak evidence or do nothing about a whole population of probably-abusive accounts. With a ladder you can rate-limit at 0.6, challenge at 0.8, and suspend at 0.97 \u2014 and challenges are especially valuable because they are <em>cheap for a real user and expensive for an operator running ten thousand accounts</em>. That asymmetry is a design tool, not an inconvenience." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Static rules and rate limits", "Buys instant, explainable, cheap enforcement and stays useful forever as a floor \u2014 keep it. Costs you adaptivity: a fixed rule is a published specification of exactly what to stay under, and operators find the edge within days."],
                  ["<strong>Naive</strong>", "Supervised classifier on static account attributes (age, followers, profile completeness)", "Buys a quick win on lazy automation. Costs you everything else: these are the cheapest features to fake, so the model's lifetime is short and it disproportionately flags legitimate new users, who look exactly like fresh fake accounts."],
                  ["<strong>Solid</strong>", "Gradient-boosted model over behavioural, device, and graph-aggregate features, retrained frequently, feeding a graduated action ladder", "Buys features that are expensive to fake \u2014 timing regularity, device consistency, network structure \u2014 plus fast retraining, which is the property that matters most in an adversarial setting. Costs feature-pipeline complexity and a hard dependency on labels that arrive late."],
                  ["<strong>Standout</strong>", "Ensemble of three complementary detectors: the supervised model; an unsupervised graph/clustering tier that finds coordinated rings without labels; and an anomaly tier for behaviour that is simply unlike anything human \u2014 plus adversarial evaluation and staged rollout", "Buys robustness through diversity: evading all three simultaneously is much more expensive than evading one, and the unsupervised tier can catch a novel campaign before any label exists for it. Costs operational weight \u2014 three things to tune, plus a fusion policy \u2014 and unsupervised tiers need careful precision control before they touch anything."]
                ]
              },
              { t: "note", variant: "tip", html: "<strong>The most valuable feature family here is the one the opponent cannot cheaply change.</strong> A profile photo is free to change; a coherent device, network, and social-graph footprint across ten thousand accounts is not. That is why graph and behavioural-consistency features outlive attribute features \u2014 you are not looking for suspicious accounts, you are looking for accounts that are suspiciously <em>similar to each other</em>." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "REAL-TIME PATH                          ASYNC PATH  (hours \u2192 daily)\n" +
                "-----------------------------------     -----------------------------------\n" +
                "signup / login / post action            all active accounts\n" +
                "        |                                       |\n" +
                "        v                                        v\n" +
                "thin features (device, IP,              behavioural history (timing\n" +
                "  velocity counters)                    regularity, session entropy)\n" +
                "        |                               device + network footprint\n" +
                "        v                               GRAPH FEATURES (shared device/IP,\n" +
                "  fast model (ms)                        co-follow, creation bursts)\n" +
                "        |                                       |\n" +
                "        v                                        v\n" +
                "  ACTION LADDER  <--------------------  ensemble: supervised +\n" +
                "  0.6 rate limit                        clustering + anomaly\n" +
                "  0.8 challenge                                  |\n" +
                "  0.97 suspend                                   v\n" +
                "        |                               cluster-level decisions\n" +
                "        v                               (action a ring together)\n" +
                "  user-facing outcome\n" +
                "        |\n" +
                "        v\n" +
                "  APPEAL --> human investigation --> reverse? --> LABEL STORE\n" +
                "                                                     |\n" +
                "  honeypots + confirmed abuse + investigations ------>+\n" +
                "                                                     v\n" +
                "                                        retrain (frequent) + DRIFT MONITOR\n" +
                "                                        (precision decay per attack family)\n"
              },
              { t: "p", html: "Three arrows are load-bearing. <strong>Graph features \u2192 cluster-level decisions</strong>: the unit of enforcement should sometimes be the ring rather than the account, because a coordinated campaign is far easier to identify collectively than member-by-member. <strong>Appeal \u2192 label store</strong>: overturned suspensions are your most informative training examples, since they are precisely where the model was confidently wrong; an appeals path is therefore both an ethical requirement and your best hard-negative mining pipeline. <strong>Drift monitor \u2192 retrain</strong>: track precision <em>per attack family</em> over time, because aggregate precision can look stable while one family collapses. See <a href='#/mlsd/serving/drift-monitoring'>drift monitoring</a> for the general machinery." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Behavioural:</strong> inter-action timing (humans are irregular; scripts often are not), session length distribution, action mix, activity across the 24-hour clock, typing and interaction cadence where available. Regularity itself is the signal.",
                "<strong>Graph:</strong> accounts sharing device fingerprints or IP ranges, co-follow and co-engagement overlap, creation-time clustering, and the shape of the local follow graph. Aggregate these into per-account features, and also cluster on them directly.",
                "<strong>Device and network:</strong> fingerprint stability, emulator and datacentre-IP indicators, consistency between claimed and observed platform.",
                "<strong>The label is genuinely hard, in a different way from moderation.</strong> There is no ground truth about intent. \"Confirmed abuse\" is high-precision but low-recall and biased toward attacks you already detect; unlabelled is not negative, it is unknown. Treating unlabelled accounts as clean negatives will teach the model that anything your current detectors miss is fine \u2014 which is exactly backwards. Positive-unlabelled framing, honeypots, and human investigations are how you get out of this.",
                "<strong>Honeypots</strong> deserve a mention: deliberately attractive targets that only automation would engage with give you clean positives that are not selected by your existing model."
              ] },
              { t: "note", variant: "trap", html: "<strong>The fairness trap here is specific and common: new legitimate users look exactly like new fake accounts.</strong> Little history, sparse graph, default profile, unusual device \u2014 every attribute-based model penalises them. Left unchecked, your abuse system becomes a bad onboarding experience concentrated on people joining from newer devices, cheaper networks, or regions with heavy carrier NAT (where many real users genuinely share an IP). Slice precision and false-positive rate by account age, region, and network type before you ship, and prefer behavioural evidence over attribute priors for young accounts." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> precision and recall on confirmed-abuse labels, but read them knowing recall is unmeasurable in absolute terms \u2014 you cannot compute the denominator for abuse nobody detected. Report recall against <em>known</em> abuse and say so.",
                "<strong>Time-forward evaluation is mandatory:</strong> train on one period, test on the next, and report how much precision decays across the gap. A model evaluated on a random split of an adversarial dataset is measuring nothing useful.",
                "<strong>Online primary:</strong> abuse delivered \u2014 spam messages received per user, fake engagement served, scrape volume \u2014 because that is the damage. Account counts are an activity metric, not an outcome metric.",
                "<strong>Online guardrails:</strong> appeal rate and appeal-overturn rate as the false-positive proxy you actually get to observe; challenge pass rate; and false-positive rate sliced by account age and region. A rising overturn rate is the alarm that matters most.",
                "<strong>Adversarial evaluation:</strong> red-team your own model. If a small team can find a cheap evasion in a week, the opponent will find it faster."
              ] },
              { t: "ol", items: [
                "<strong>\"Precision drops 15% two weeks after every deploy. Is your model bad?\"</strong> No \u2014 that is the expected signature of an adapting opponent, and the design question is whether your retraining cadence and drift alarms are faster than the decay. Distinguish this from ordinary <a href='#/mlsd/serving/drift-monitoring'>drift</a>: here the shift is caused by your own deployment, so it will not stop.",
                "<strong>Why the appeals path is architecture, not customer support.</strong> It bounds the worst-case harm of a false positive, which is what makes a high-severity automated action defensible at all; it produces your best labels; and its overturn rate is a live estimate of your real precision on hard actions. Design its queue and turnaround like you would design any other component.",
                "<strong>Information leakage to the adversary.</strong> Every message you show and every threshold you expose teaches the opponent. Keep user-facing explanations generic, avoid deterministic thresholds an operator can binary-search, and consider randomised enforcement delays so the mapping from behaviour to action is not trivially learnable."
              ] },
              { t: "cue", html: "The sentence that shows you have thought about the adversary: \u201cThe opponent retrains against me, so the model decays <em>because</em> I deployed it \u2014 that makes retraining cadence, per-attack-family drift monitoring, and hard-to-fake graph features part of the design rather than operational follow-up. And because a false positive locks out a real person, I'd use an action ladder with a very high precision floor on suspension and treat appeals as both the remedy and my hard-negative pipeline.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds a supervised classifier on account and behavioural features and knows false positives are costly. Usually treats unlabelled accounts as negatives and evaluates on a random split, missing the adversarial dynamic entirely."],
                  ["<strong>Senior</strong>", "Leads with the adversarial framing and designs for decay: frequent retraining, time-forward evaluation, drift monitoring. Uses graph and behavioural features because they are expensive to fake, splits real-time from async scoring, and maps confidence to a graduated action ladder rather than one threshold."],
                  ["<strong>Staff</strong>", "Optimises abuse delivered rather than accounts caught, treats the appeals loop as architecture (remedy, label source, and live precision estimate), handles the positive-unlabelled label problem explicitly with honeypots and investigations, reasons about information leakage back to the adversary, and slices false positives by account age and region as a fairness requirement."]
                ]
              },
              { t: "quiz", id: "mlcase-trust" },
              { t: "note", variant: "key", html: "<strong>You are not classifying a fixed distribution \u2014 you are playing a repeated game.</strong> Design for decay (retrain fast, monitor per attack family, prefer features that are expensive to fake), grade actions by confidence so weak evidence never produces a severe outcome, and treat the appeals path as a first-class component: it is the remedy, the label source, and your only honest read on precision." }
            ]
          },

          /* ---------- 10. payment fraud ---------- */
          {
            id: "fraud-detection",
            title: "Catching payment fraud at authorization time",
            summary: "A decision in tens of milliseconds, labels that arrive weeks late and only for approved transactions, and an objective priced in currency rather than accuracy.",
            minutes: 12,
            tags: ["fraud", "imbalance", "delayed-labels", "cost-sensitive", "streaming-features"],
            blocks: [
              { t: "p", html: "Every authorization is a bet with a price tag on both sides. Approve a fraudulent purchase and you lose the amount plus a chargeback fee; decline a genuine one and you lose the margin, an annoyed customer, and often their next purchase too. In many businesses the second loss is larger in total than the first, which is the fact candidates most often miss. The mental model: <strong>the model estimates a probability; a decision layer converts it into an action by comparing expected costs in currency.</strong> Everything that makes this problem hard \u2014 the latency budget, labels that arrive weeks late, labels that exist only for transactions you let through, and an opponent who probes your thresholds \u2014 is a constraint on one of those two halves." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>Who is deciding?</strong> <em>Assume:</em> a payments platform scoring card-not-present (online) purchases before sending them on for authorization. Card-present fraud and anti-money-laundering are different problems; scope them out.",
                "<strong>What actions exist?</strong> <em>Assume:</em> approve, step-up (an extra verification challenge), queue for manual review on flows that can wait, and decline. A ladder of actions is the most important lever you have \u2014 the same lesson as <a href='#/mlcase/trust/bot-detection'>bot detection</a>.",
                "<strong>How rare is fraud?</strong> <em>Assume:</em> on the order of one transaction in a thousand, but a larger share by value, because fraudsters prefer resellable, high-value goods.",
                "<strong>Where do labels come from?</strong> <em>Assume:</em> chargebacks (arriving over weeks to a few months), customer fraud reports, issuer alerts, and manual review outcomes.",
                "<strong>What does a false decline cost?</strong> <em>Assume:</em> the lost margin plus an estimate of future customer value, provided by finance. Ask for it \u2014 without it there is no objective.",
                "<strong>Out of scope:</strong> merchant onboarding risk, the challenge implementation, and dispute handling."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> return an action and a reason code for every transaction inside the authorization budget; support per-merchant and per-region policy; keep a full audit trail of features and scores; feed review outcomes and chargebacks back as labels; allow rules to be added within minutes during an attack.",
                "<strong>Non-functional:</strong> below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds the design"],
                rows: [
                  ["Throughput", "~10<sup>4</sup> transactions per second at peak", "Feature fetch and scoring must be constant-time per transaction, with no fan-out to slow stores"],
                  ["Decision latency", "tens of milliseconds p99, including feature lookups", "Only precomputed and streaming features; no heavy graph traversal at request time"],
                  ["Prevalence", "~0.1% of transactions", "Accuracy is meaningless; metrics and training must be imbalance-aware"],
                  ["Label delay", "weeks to a few months for chargebacks", "Recent data is mostly unlabelled; training needs a maturity window"],
                  ["Feature freshness", "velocity counters reflect transactions from seconds ago", "Requires a streaming aggregation path, not a nightly batch"],
                  ["Review capacity", "a fixed number of analyst decisions per day", "Manual review is a scarce tier; only the most valuable uncertain cases go there"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the business"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise classification accuracy", "At 0.1% prevalence, approving everything scores 99.9%. The metric is satisfied by a system that catches nothing."],
                  ["<strong>Naive</strong>", "Minimise the fraud rate", "Satisfied by declining anything slightly unusual. Fraud falls, genuine customers are turned away at scale, and the false-decline bill \u2014 invisible on the fraud dashboard \u2014 is often larger than the fraud it prevented."],
                  ["<strong>Solid</strong>", "Maximise fraud caught at a fixed false-positive or decline rate, measured by PR-AUC and recall at that operating point", "A real classifier objective that respects imbalance. Still counts transactions rather than money, so a caught $5 fraud and a caught $5,000 fraud score the same."],
                  ["<strong>Standout</strong>", "Minimise total expected cost in currency \u2014 fraud losses and chargeback fees, plus false-decline cost, plus step-up friction, plus review cost \u2014 choosing the action per transaction by expected cost, with thresholds that vary by amount band", "Optimises the money that actually moves, makes the false-decline cost explicit instead of invisible, and naturally produces different thresholds for small and large purchases. Requires a calibrated probability, which becomes a hard requirement."]
                ]
              },
              { t: "code", lang: "text", code:
                "Expected cost of each action, for fraud probability p and amount A:\n" +
                "  approve  = p * (A + fee)                                fee = 15\n" +
                "  decline  = (1 - p) * L_good       L_good = 0.03*A + 10   (margin + future value)\n" +
                "  step-up  = friction + (1 - p) * abandon * L_good + p * pass * (A + fee)\n" +
                "                                    friction = 1, abandon = 0.10, pass = 0.20\n" +
                "\n" +
                "p = 0.05, A = $20:     approve 1.75   decline 10.07   step-up 2.36  -> APPROVE\n" +
                "p = 0.05, A = $2,000:  approve 100.75 decline 66.50   step-up 27.80 -> STEP-UP\n" +
                "\n" +
                "break-even p for approve vs decline:\n" +
                "  A = $20     p* = 10.6 / (35 + 10.6)   ~= 0.23\n" +
                "  A = $2,000  p* = 70 / (2015 + 70)     ~= 0.034\n"
              },
              { t: "p", html: "The same score produces different decisions at different amounts, and the break-even probability falls by almost an order of magnitude between a $20 and a $2,000 purchase. That is why a single global threshold is the wrong shape here, and why the threshold reasoning in <a href='#/found/metrics/confusion-matrix'>the confusion-matrix lesson</a> has to be done in currency rather than in counts. It also shows why the probability must be calibrated: every comparison above multiplies <em>p</em> by money, the same argument as the <a href='#/mlcase/recsys/ad-click-prediction'>ad auction</a>. See <a href='#/found/metrics/calibration'>calibration</a>." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Rules only: velocity limits, blocklists, country mismatches", "Buys instant, explainable control that you will keep forever as a floor and as the fastest response to a live attack. Costs you adaptivity and precision: rules are coarse, they interact unpredictably, and fraudsters learn the limits within days."],
                  ["<strong>Naive</strong>", "A classifier trained on all labelled transactions with a random split", "Buys an impressive offline number. Costs you honesty: a random split leaks future fraud patterns into training, immature labels count unfinished fraud as genuine, and every label comes from transactions the old system approved."],
                  ["<strong>Solid</strong>", "Gradient-boosted model over transaction, streaming velocity, device, and account features, trained on a time split with matured labels, calibrated, feeding the expected-cost decision layer", "Buys a fast, strong, retrainable model on exactly the tabular features this problem has, with probabilities you can price. Costs a streaming feature pipeline and a label pipeline that respects maturity."],
                  ["<strong>Standout</strong>", "Tiered system: rules for hard blocks and live-attack response \u2192 GBDT with graph-linking features (shared devices, cards, emails, and addresses resolved into entities) \u2192 expected-cost decision layer by amount band \u2192 manual review for the uncertain, high-value band \u2014 with a small random-approve holdout for unbiased labels and champion/challenger rollout", "Buys coverage of coordinated rings, a reviewer tier spent where it is worth the most, and labels that are not entirely selected by your own model. Costs real operational weight: entity resolution jobs, review tooling, and a deliberate budget of fraud you choose to let through."]
                ]
              },

              { t: "h2", text: "Labels that arrive late and only where you said yes" },
              { t: "p", html: "Two separate problems hide in the label. <strong>Delay:</strong> a chargeback can arrive weeks or months after the purchase, so last week's transactions look overwhelmingly genuine simply because their fraud has not been reported yet. <strong>Selection:</strong> a declined transaction never completes, so it never generates a chargeback \u2014 you get labels only for what the previous model approved. Train naively and the model learns nothing about the region its predecessor blocked; if a pattern was declined for a year, the data contains no evidence about whether it was ever really fraud." },
              { t: "ul", items: [
                "<strong>Respect maturity.</strong> Train on transactions old enough for most chargebacks to have arrived, and use faster partial signals (customer reports, issuer alerts, review outcomes) to cover the recent window, with the gap measured rather than assumed.",
                "<strong>Buy unbiased labels on purpose.</strong> Approve a small random slice of transactions the system would have declined or stepped up, capped by amount, and label their outcomes. It costs real fraud losses, so set it as an explicit budget \u2014 it is the only clean view of the blocked region.",
                "<strong>Treat reject inference as weak.</strong> Imputing labels for declined transactions by asking the old model is circular: it teaches the new model to agree with the old one. Use it, if at all, as a down-weighted signal.",
                "<strong>Use step-up outcomes.</strong> A transaction abandoned at the challenge is weak evidence of fraud, one that passes is weak evidence of genuineness \u2014 partial labels on exactly the uncertain band.",
                "<strong>Imbalance:</strong> downsample genuine transactions for training cost and correct the probabilities afterwards, or use class weights; either way calibrate on the true distribution before pricing. See <a href='#/data/labels/class-imbalance'>class imbalance</a>."
              ] },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "ONLINE  (inside the authorization)            NEAR-REAL-TIME / OFFLINE\n" +
                "------------------------------------         ------------------------------------\n" +
                "purchase(card, device, account, amount)       auth event stream\n" +
                "        |                                            |\n" +
                "        v                                            v\n" +
                "ONLINE FEATURE STORE  <--------------------  STREAM AGGREGATOR\n" +
                "  velocity counters (card/device/IP)          counts, sums, distinct counts\n" +
                "  entity risk (from graph job)                over 10 min / 1 h / 24 h windows\n" +
                "        |                                            \n" +
                "        v                                     ENTITY RESOLUTION (hourly)\n" +
                "RULES: blocklists, hard limits                link cards, devices, emails,\n" +
                "        |                                     addresses -> entity risk scores\n" +
                "        v                                            \n" +
                "GBDT MODEL -> calibrated p(fraud)             LABEL PIPELINE\n" +
                "        |                                     chargebacks + reports + review\n" +
                "        v                                     joined with maturity window\n" +
                "DECISION LAYER (expected cost by band)        + random-approve holdout flag\n" +
                "  approve | step-up | review | decline               |\n" +
                "        |                                            v\n" +
                "        +---> REVIEW QUEUE (capacity-bound)   retrain (frequent) + monitors\n" +
                "        |                                     fraud bps, decline rate, drift\n" +
                "        v\n" +
                "decision + features + score log\n"
              },
              { t: "p", html: "Three arrows carry the weight. <strong>Stream aggregator \u2192 online feature store</strong> is what makes velocity features exist at all: the strongest fraud signal is often \"this card has tried six merchants in four minutes\", and that has to be true as of seconds ago. <strong>Entity resolution \u2192 entity risk</strong> runs off the request path, because traversing a graph of linked devices and cards is too slow for the authorization budget \u2014 its output is a precomputed risk score per entity that the online path can look up. <strong>Random-approve flag \u2192 label pipeline</strong> is the small, deliberate cost that keeps training data honest. Cascade covers the streaming aggregation machinery in depth: <a href='../data-eng-academy/index.html'>Cascade</a>." },

              { t: "h2", text: "Velocity features from streaming aggregates" },
              { t: "code", lang: "sql", code:
                "-- Conceptual definition; a stream processor maintains these incrementally\n" +
                "SELECT card_id,\n" +
                "       COUNT(*)                    AS txn_count_10m,\n" +
                "       SUM(amount)                 AS amount_sum_10m,\n" +
                "       COUNT(DISTINCT merchant_id) AS distinct_merchants_10m,\n" +
                "       COUNT(DISTINCT device_id)   AS distinct_devices_10m\n" +
                "FROM   auth_events\n" +
                "WHERE  event_time >  :as_of - INTERVAL '10 minutes'\n" +
                "  AND  event_time <= :as_of\n" +
                "GROUP  BY card_id;\n"
              },
              { t: "note", variant: "trap", html: "<strong>Velocity features are where offline and online quietly diverge.</strong> Training needs each counter reconstructed <em>as of that transaction's timestamp</em>, with a consistent rule about whether the current transaction is included. Recompute them from a nightly table and you either leak later transactions into the window or define the boundary differently from the stream processor \u2014 and the model you validated is not the model you serve. Point-in-time reconstruction is covered in <a href='#/data/correctness/point-in-time'>point-in-time correctness</a>." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Transaction:</strong> amount, currency, merchant category, whether shipping and billing addresses match, time of day, and how unusual the amount is for this card.",
                "<strong>Velocity:</strong> counts, sums, and distinct counts per card, device, IP, email, and shipping address over several windows. Ratios against the entity's own history are usually stronger than raw counts.",
                "<strong>Device and network:</strong> fingerprint age and stability, IP geolocation versus billing country, proxy and datacentre indicators.",
                "<strong>Graph and linking:</strong> how many cards this device has used, whether any linked entity was previously confirmed fraudulent, and how young the linked cluster is. Rings reuse infrastructure even when they rotate cards.",
                "<strong>The label</strong> is \"confirmed fraud\" from chargebacks with a fraud reason, reports, and review \u2014 explicitly not every chargeback, since many are disputes about delivery or quality rather than theft."
              ] },
              { t: "note", variant: "warn", html: "<strong>False declines are not evenly distributed.</strong> Customers with thin histories, cross-border purchases, or shared and mobile networks look \"unusual\" by construction and absorb a disproportionate share of declines. Slice false-decline and step-up rates by region, account age, and payment method before you ship, and decide explicitly what disparity is acceptable \u2014 <a href='#/resp/fairness/fairness-definitions'>fairness definitions</a> covers the options and why they conflict." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> time-forward splits with matured labels only. Report PR-AUC, recall at the operating point, <em>value-weighted</em> recall (fraud currency caught), and \u2014 most importantly \u2014 total expected cost at the chosen policy, compared with the incumbent.",
                "<strong>Calibration per amount band and region</strong>, because the decision layer prices every band separately.",
                "<strong>Online primary:</strong> net cost \u2014 fraud losses in basis points of volume plus estimated false-decline cost. <strong>Guardrails:</strong> approval rate, step-up rate and completion, review queue depth, and customer complaints about declines.",
                "<strong>Chargebacks lag the experiment.</strong> Use early signals (reports, review outcomes, step-up abandonment) as leading indicators, then confirm with matured chargebacks weeks later."
              ] },
              { t: "ol", items: [
                "<strong>Adversarial adaptation.</strong> Fraud rings test stolen cards with small purchases, find what passes, then scale. Expect the score distribution to shift after every deploy, keep rules as a fast-response tier, retrain frequently, and monitor drift per attack pattern \u2014 see <a href='#/ops/monitoring/drift-and-skew'>drift and skew</a>.",
                "<strong>Thresholds per amount band.</strong> Be ready to derive the break-even probability from the cost terms and show it falling as the amount rises.",
                "<strong>Review as a scarce resource.</strong> Rank the review queue by expected cost reduction per review, not by score, and cap it at analyst capacity \u2014 a queue that grows without bound is a decline policy with extra steps.",
                "<strong>The selection-bias question.</strong> \"How do you learn about transactions you declined?\" The answer is a budgeted random-approve holdout, step-up outcomes as partial labels, and honest caveats about reject inference."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cI'd have the model output a calibrated fraud probability and let a decision layer choose approve, step-up, review, or decline by expected cost in currency \u2014 fraud loss is p times the amount, a false decline costs margin and customer value \u2014 so the threshold naturally falls as the amount rises. And because labels only exist for approved transactions and arrive weeks late, I'd train on matured windows and keep a small random-approve holdout to see what the old model blocked.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds an imbalance-aware classifier with sensible transaction and velocity features and picks a threshold. Usually evaluates on a random split and treats all recent unlabelled transactions as genuine."],
                  ["<strong>Senior</strong>", "Frames the objective as expected cost in currency with an action ladder, uses streaming velocity features with point-in-time training, respects label maturity, calibrates, and sets thresholds per amount band."],
                  ["<strong>Staff</strong>", "Names the selection bias in labels and budgets a random-approve holdout to fix it, designs rules, model, and review as tiers with the review queue ranked by cost reduction, adds entity-linking for rings, plans for adversarial adaptation, and slices false declines as a fairness requirement."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>Fraud is priced in money, labelled late, and labelled only where you said yes.</strong> Output a calibrated probability, choose the action by expected cost so thresholds fall as amounts rise, build velocity features from a stream with point-in-time training, wait for labels to mature, and spend a small, deliberate budget approving at random so the model can see what its predecessor blocked." }
            ]
          }
        ]
      },

      /* ==================== RETRIEVAL ==================== */
      {
        id: "retrieval",
        name: "Search & Retrieval",
        icon: "database",
        lessons: [

          /* ---------- 6. search ranking ---------- */
          {
            id: "search-ranking",
            title: "Ranking results for a text query",
            summary: "Lexical versus dense retrieval and why hybrid wins, learning-to-rank, debiasing click logs, and the freshness-relevance tension.",
            minutes: 11,
            tags: ["search", "hybrid-retrieval", "learning-to-rank", "position-bias"],
            blocks: [
              { t: "p", html: "Search differs from recommendation in one decisive way: <strong>the user told you what they want.</strong> That query is the strongest feature you will ever get, and it changes the shape of the problem \u2014 intent is explicit, sessions are short and goal-directed, and success has a crisp definition (they found it and stopped looking) that recommendation never gets. The mental model is still a funnel, but with a twist worth stating: <strong>retrieval decides your ceiling, ranking decides how close you get to it.</strong> No amount of reranking recovers a document that retrieval never returned, which is why the retrieval design gets real attention here rather than being waved through." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What corpus?</strong> <em>Assume:</em> a large document collection \u2014 order 10<sup>8</sup> documents \u2014 of mixed length and quality. Web-scale versus enterprise-scale changes the infrastructure but not the reasoning.",
                "<strong>What do queries look like?</strong> <em>Assume:</em> a heavy head of repeated queries and a long tail of rare ones, mostly short (a few words), a mix of navigational, informational, and time-sensitive intents. The head/tail split matters: the head can be cached and hand-tuned, the tail is where your model earns its keep.",
                "<strong>Is there existing traffic?</strong> <em>Assume:</em> yes \u2014 you have click logs. This is good news and a trap, and half this lesson is about the trap.",
                "<strong>What is success?</strong> <em>Assume:</em> the user's need is met without reformulating or abandoning. Not \"they clicked\".",
                "<strong>Latency budget?</strong> <em>Assume:</em> a couple of hundred milliseconds p99 for the whole result page. That is generous compared with an ad auction and tight compared with an offline pipeline \u2014 enough for a two-pass ranker over a small top-k, not enough for an unbounded one.",
                "<strong>Out of scope:</strong> crawling, indexing infrastructure, spelling correction, and query autocomplete. The inverted-index machinery is Blueprint's territory; here it is a component you consume."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> given a query and a user context, return a ranked page of results; handle rare exact-match tokens (error codes, part numbers, names) as well as paraphrase; incorporate freshness where the intent calls for it; log impressions with positions so the system can learn without teaching itself its own bias.",
                "<strong>Non-functional:</strong> below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds"],
                rows: [
                  ["Corpus", "~10<sup>8</sup> documents", "Retrieval must be sublinear \u2014 inverted index and/or ANN, never a scan"],
                  ["Page latency", "~200 ms p99 end to end", "Retrieval tens of ms, first-pass ranking tens of ms, reranker limited to a small top-k"],
                  ["Retrieval depth", "~10<sup>3</sup> candidates to first-pass ranking; ~10<sup>2</sup> to the reranker", "Sets the compute budget per stage and therefore the model class at each stage"],
                  ["Recall@1000", "as high as you can get it \u2014 this is the ceiling on everything downstream", "Justifies hybrid retrieval on its own"],
                  ["Index freshness", "new and updated documents searchable in minutes for time-sensitive intents", "Forces an incremental index path alongside periodic rebuilds"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the product"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise clicks on results", "Optimises the title and the snippet, not the answer, and rewards documents engineered to look clickable. Worse, it is measured on a log that your own ranking produced, so it partly rewards \"was already ranked highly\"."],
                  ["<strong>Naive</strong>", "Maximise click-through rate at position one", "Superficially sharper and still wrong. It punishes queries that legitimately have no single good answer, ignores abandonment entirely, and says nothing about the user who clicked, bounced, and reformulated \u2014 the clearest possible failure, scored as a success."],
                  ["<strong>Solid</strong>", "Maximise NDCG against graded human relevance judgements", "A real objective with a real signal. Human judgements are unbiased by your ranking, gradeable rather than binary, and stable enough to compare models across quarters. Costs money and does not scale to the tail."],
                  ["<strong>Standout</strong>", "Maximise successful sessions \u2014 the share of queries resolved without reformulation or abandonment \u2014 using debiased clicks as the dense training signal and NDCG on judgements as the trustworthy offline check", "Names the outcome (need met), the scalable signal (clicks, corrected for position bias), and the honest referee (judgements). Each covers the others' weakness: clicks are plentiful and biased, judgements are clean and scarce, sessions are what the product is for."]
                ]
              },
              { t: "note", variant: "tip", html: "The three-signal structure is worth saying explicitly because it generalises: <strong>a dense biased signal for training, a sparse clean signal for validation, and a business outcome for the decision.</strong> Whenever you have plentiful behavioural data and expensive ground truth, that is usually the right arrangement \u2014 not a choice between them. See <a href='#/mlsd/concepts/evaluation'>the metric ladder</a>." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Lexical retrieval only (inverted index with a term-weighting score), ranked by that score", "Buys a genuinely strong baseline: exact matching, near-zero cost, complete interpretability, no training data required, and it never embarrasses you on a rare literal string. Costs you the vocabulary gap \u2014 a query and a document that mean the same thing in different words simply do not match."],
                  ["<strong>Naive</strong>", "Dense retrieval only (bi-encoder plus ANN), ranked by vector similarity", "Buys semantic matching and paraphrase robustness. Costs you precision on exactly the queries where users are least forgiving: rare tokens, identifiers, and names get smeared into a neighbourhood of plausible-looking text. Also needs training data and a full re-embedding whenever the encoder changes."],
                  ["<strong>Solid</strong>", "Hybrid retrieval (lexical \u222a dense, fused) into a learning-to-rank first pass over hundreds of features, trained on debiased clicks and judgements", "Buys most of the available recall and a strong, fast, well-understood ranker \u2014 a gradient-boosted ranking model over feature vectors is still an excellent choice here. Costs two retrieval systems, a fusion step to tune, and a feature pipeline."],
                  ["<strong>Standout</strong>", "Hybrid retrieval \u2192 LTR first pass \u2192 cross-encoder reranker on the top ~100, distilled to hit the latency budget, with freshness weighting conditioned on predicted query intent", "Buys the biggest single quality jump available \u2014 a cross-encoder reads query and document <em>together</em>, so it can judge relationships a bi-encoder's independent vectors cannot represent. Costs latency (it is a serial hop over ~100 documents), a distillation step, and an intent model that can itself be wrong."]
                ]
              },
              { t: "p", html: "Why hybrid genuinely wins rather than being a hedge: the two methods fail on <em>different</em> queries. Lexical retrieval fails when the words differ and the meaning matches; dense retrieval fails when the words matter more than the meaning. Because those failure sets barely overlap, the union recovers far more than either alone \u2014 and fusion can be as simple as combining each system's rank positions rather than trying to make two incomparable score scales agree. The bi-encoder/cross-encoder distinction is the same independence trade-off as the two towers in <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a>: precomputable and cheap, or joint and expensive. See <a href='#/mlsd/concepts/embeddings'>embeddings</a> and <a href='#/mlsd/concepts/ann-serving'>ANN serving</a>." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE                                 ONLINE  (per query)\n" +
                "-----------------------------------     -----------------------------------\n" +
                "documents                                query\n" +
                "   |                                        |\n" +
                "   +--> tokenize ---> INVERTED INDEX        v\n" +
                "   |                       ^          query understanding\n" +
                "   +--> encode -----> ANN INDEX ^      (intent, freshness need, entities)\n" +
                "                              | |            |\n" +
                "click logs                    | |            v\n" +
                "   |                          | +----- LEXICAL RETRIEVAL  ---+\n" +
                "   v                          |                              |\n" +
                "propensity estimation          +------ DENSE RETRIEVAL  -----+\n" +
                "  (from randomized swaps)                                    |\n" +
                "   |                                                          v\n" +
                "   v                                                    FUSION (~1000)\n" +
                "IPW-weighted training set                                     |\n" +
                "   +  human judgements                                        v\n" +
                "   |                                                LTR FIRST PASS (~100)\n" +
                "   v                                                          |\n" +
                "LTR + reranker training ---> model registry --------->         v\n" +
                "                                                     CROSS-ENCODER RERANK\n" +
                "                                                              |\n" +
                "                                                              v\n" +
                "                                                     freshness / diversity\n" +
                "                                                     blend by intent\n" +
                "                                                              |\n" +
                "                                                              v\n" +
                "                                                     page + position log\n"
              },
              { t: "p", html: "Two arrows carry the lesson. <strong>Randomised swaps \u2192 propensity estimation \u2192 training set</strong>: you deliberately perturb a small fraction of live traffic so you can measure how examination falls with position, and that measurement is what makes the click log usable. It costs a little relevance on that traffic slice and it is worth it. <strong>Query understanding \u2192 freshness blend</strong>: freshness is not a global weight, it is intent-conditioned, so the branch that predicts intent has to run before the blend. Everything about the index itself \u2014 sharding, replication, caching the head queries \u2014 is Blueprint's subject, and you should say so rather than re-deriving it." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log</strong> every result's position, the full slate, dwell after click, whether the user reformulated, and whether the session ended without a click. Abandonment is a label, and it is invisible if you only log clicks.",
                "<strong>Features</strong> span four families: query (length, intent, rarity), document (quality, length, freshness, authority), query\u2013document match (term overlap, field matches, dense similarity, cross-encoder score), and behavioural (historical CTR for this query\u2013document pair \u2014 powerful for the head, useless for the tail, and a leakage risk if computed carelessly).",
                "<strong>The label is the hard part, and it is hard in an interesting way:</strong> the plentiful signal is systematically wrong. A click is <em>evidence of relevance conditioned on having been examined</em>, and examination collapses with rank. So raw clicks encode your previous ranking as much as they encode relevance.",
                "<strong>Better click labels</strong> come from combining signals: a click with long dwell and no reformulation is a strong positive; a click followed by an immediate return and a reworded query is a negative; the last click in a session often marks the satisfying result."
              ] },
              { t: "h2", text: "Position bias, and how to actually fix it" },
              { t: "p", html: "Model a click as roughly two things happening: the user <em>examined</em> the result, and the result was <em>relevant</em>. Examination depends mostly on position; relevance is what you want. Since you only observe the product, a naive model trained on raw clicks learns \"things at the top get clicked\" and reproduces the ranking it was trained on \u2014 a closed loop that is stable, self-confirming, and wrong." },
              { t: "ul", items: [
                "<strong>Inverse propensity weighting.</strong> Weight each observed click by 1/(probability that its position was examined). A click at position nine, where examination is rare, then counts for much more than one at position one. This makes the biased log an unbiased estimator, at the cost of higher variance on the rarely-examined tail \u2014 which is why you clip the weights.",
                "<strong>Estimating the propensities</strong> is the part that requires design, not just math: you need an intervention. Randomly swapping adjacent result pairs, or interleaving two rankings, on a small traffic slice lets you observe the same document at different positions and read examination off directly.",
                "<strong>Alternatively, model the bias explicitly.</strong> Train a two-part model where one component consumes position and the other consumes relevance features, then drop the position component at serving time. Cheaper than running randomisation, but it leans on the assumption that position affects examination and nothing else.",
                "<strong>What does not work:</strong> dropping low positions (throws away the tail you most need), or normalising by query frequency (fixes a different problem entirely)."
              ] },
              { t: "note", variant: "trap", html: "<strong>Freshness versus relevance is not one global dial.</strong> Boost recency everywhere and you degrade every timeless query \u2014 documentation, reference material, definitions. Ignore it and you fail every time-sensitive query, badly and visibly. The resolution is that <em>the freshness weight is itself a prediction</em>: some intents demand recency and most do not, so predict the query's time sensitivity (from query terms, from how result CTR by document age varies for that query, from spikes in query volume) and blend accordingly. Getting this wrong is one of the most user-visible failures in search." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline, trustworthy:</strong> NDCG on a human-judged query set, stratified across head and tail and across intent types. This is your referee because it is independent of your current ranking.",
                "<strong>Offline, scalable:</strong> IPW-corrected click metrics on held-out logged traffic. Cheap, plentiful, and only as good as your propensity estimates \u2014 report both these and NDCG, and worry when they disagree.",
                "<strong>Retrieval separately from ranking:</strong> recall@1000 for the retrieval stage. It is the ceiling, it is easy to measure, and it is where hybrid retrieval proves its value.",
                "<strong>Online:</strong> successful-session rate, reformulation rate, abandonment rate, and clicks at position one. Interleaving experiments are especially valuable in search \u2014 they compare two rankings on the same user and are far more sensitive than a split test, though they measure preference rather than absolute outcome. Standard A/B for the final call (<a href='#/mlsd/concepts/ab-testing'>A/B testing</a>).",
                "<strong>Slice by query frequency band.</strong> A model that wins on average by improving the head while degrading the tail is usually the wrong trade, and the average will not tell you."
              ] },
              { t: "ol", items: [
                "<strong>\"Your offline click metric improved and the online test was flat. Why?\"</strong> Leading suspect: your offline metric is computed on logs your old ranker produced, so it rewards agreeing with the incumbent. Second suspect: propensity estimates are stale or wrong. Third: you improved the head and the online metric is dominated by the tail. Naming all three and how to distinguish them is a strong answer.",
                "<strong>Head versus tail strategy.</strong> Head queries are repeated enough to cache, hand-audit, and learn query-specific behavioural features for. Tail queries have no behavioural signal at all, so they depend entirely on content matching \u2014 which is exactly where dense retrieval and the cross-encoder earn their cost. Saying that these are two different problems sharing one pipeline is a senior observation.",
                "<strong>Where the cross-encoder goes and why it is last.</strong> It is the most accurate and most expensive component, so it runs on the smallest candidate set. If latency will not permit it, distil it into the first-pass ranker \u2014 train the cheap model to imitate the expensive one's scores \u2014 which recovers a real share of the quality at first-pass cost."
              ] },
              { t: "cue", html: "The two sentences that earn credit here: \u201cI'd retrieve hybrid \u2014 lexical for rare exact tokens, dense for paraphrase \u2014 because their failure modes are largely uncorrelated, and retrieval recall is the ceiling on everything downstream. And I would not train on raw clicks: a click is relevance <em>times</em> examination, and examination collapses with position, so I'd reweight by estimated propensity with propensities measured from a small randomised slice, and keep human judgements as the referee.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Retrieves with an inverted index or embeddings, ranks with a trained model on sensible query\u2013document features, and evaluates with NDCG. Usually trains on raw clicks without flagging position bias."],
                  ["<strong>Senior</strong>", "Argues hybrid retrieval from uncorrelated failure modes, separates retrieval recall from ranking quality as distinct metrics, raises position bias unprompted and proposes IPW with a concrete way to estimate propensities, and places the cross-encoder correctly against the latency budget."],
                  ["<strong>Staff</strong>", "Frames the objective as successful sessions and explains the three-signal arrangement (biased-dense for training, clean-sparse for validation, business outcome for the decision). Treats freshness as an intent-conditioned prediction rather than a dial, distinguishes head and tail as different problems, and can debug offline-improves/online-flat from first principles."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>Retrieval sets your ceiling; click logs lie in a predictable direction.</strong> Go hybrid because lexical and dense fail on different queries, and never train on raw clicks \u2014 a click is relevance times examination, so reweight by measured propensity and keep a small human-judged set as the referee your logs cannot be." }
            ]
          },

          /* ---------- 7. RAG assistant ---------- */
          {
            id: "rag-assistant",
            title: "A retrieval-augmented assistant over a document corpus",
            summary: "Chunking, hybrid retrieve-then-rerank, grounding and citations, measuring hallucination, and splitting a latency and cost budget across the pipeline.",
            minutes: 12,
            tags: ["rag", "grounding", "hallucination", "latency-budget", "cost"],
            blocks: [
              { t: "p", html: "The ask: users type a question in natural language and get an answer grounded in your corpus, with citations. The temptation is to treat this as a prompt-engineering exercise. Resist it \u2014 <strong>this is a retrieval system with a generator on the end</strong>, and almost every failure you will debug is a retrieval failure wearing a generation costume. The mental model that keeps you honest: <strong>the generator can only be as correct as what you put in its context, and it will produce a confident, fluent answer either way.</strong> That asymmetry \u2014 quality varies, confidence does not \u2014 is why hallucination has to be measured rather than hoped away, and why an abstention path is a feature and not an admission of defeat." },
              { t: "note", variant: "tip", html: "This page treats the generator as a component and designs the system around it. For the internals \u2014 how LLMs, embeddings for RAG, prompting, and LLMOps actually work \u2014 go to <a href='../llm-academy/index.html'>Lumen</a>, which covers them in depth." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What corpus, and how does it change?</strong> <em>Assume:</em> order 10<sup>6</sup> documents of internal reference material \u2014 policies, runbooks, product docs \u2014 updated continuously, with real version churn. Stale answers are a correctness bug here, not an inconvenience.",
                "<strong>What kinds of questions?</strong> <em>Assume:</em> mostly single-fact lookups and short procedural how-tos, with a minority needing synthesis across documents. Multi-hop reasoning is a different and much harder system; scope it out loud.",
                "<strong>Does access control apply?</strong> <em>Assume:</em> yes \u2014 users may only see what they are entitled to. This is the one requirement that cannot be approximated, and it constrains the retrieval path directly.",
                "<strong>What happens when the answer is not in the corpus?</strong> <em>Assume:</em> the assistant must say so. Getting explicit agreement that <em>abstention counts as success</em> reshapes the entire evaluation design.",
                "<strong>Latency and cost targets?</strong> <em>Assume:</em> first token within about a second, complete answer within a few seconds, and a per-query cost budget tight enough that you cannot rerank a thousand candidates with a large model.",
                "<strong>Out of scope:</strong> training or fine-tuning the generator, multi-turn dialogue state, and tool use or actions. Say it, then design the retrieval system properly."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> answer a natural-language question using only retrieved corpus content; cite the passages used; abstain when support is insufficient; respect per-user access control at retrieval time; reflect document updates within minutes; stream the answer.",
                "<strong>Non-functional:</strong> below \u2014 and note that the latency line is a <em>decomposition</em>, because a single end-to-end number tells you nothing about where to optimise."
              ] },
              { t: "table",
                headers: ["Stage", "Assumed budget (order of magnitude)", "What it constrains"],
                rows: [
                  ["Query understanding / embedding", "a few ms to low tens of ms", "One small encoder pass; no room for a large model here"],
                  ["Hybrid retrieval (lexical + dense)", "tens of ms", "ANN index plus inverted index, run in parallel, not in series"],
                  ["Reranking", "tens of ms for ~20\u201350 candidates", "Caps candidate count and reranker size \u2014 this is the main quality/latency dial"],
                  ["Generation, first token", "the dominant term \u2014 hundreds of ms and up", "Why time-to-first-token plus streaming is the target rather than total latency"],
                  ["Generation, full answer", "grows with output length", "Answer length is a cost and latency parameter, so bound it deliberately"],
                  ["Corpus freshness", "minutes from document update to retrievable", "Incremental indexing and re-embedding of changed chunks only"]
                ]
              },
              { t: "note", variant: "tip", html: "<strong>Decomposing the latency budget is itself the senior move.</strong> \u201cUnder two seconds\u201d is a wish; \u201c30 ms retrieval, 40 ms rerank, first token by 800 ms, streamed thereafter\u201d is a design you can hold each component accountable to. It also immediately shows you where the money is: generation dominates, so retrieval and reranking should be tuned for quality within a tight fixed budget rather than shaved for speed." },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "Why it lands there"],
                rows: [
                  ["<strong>Naive</strong>", "Answer every question the user asks", "Guarantees hallucination. Coverage as an objective means the system is rewarded for producing something when the corpus contains nothing, and a fluent wrong answer about a policy is worse than no answer at all \u2014 it will be acted on."],
                  ["<strong>Naive</strong>", "Maximise a model-rated helpfulness score", "Cheap and dangerous. An automated judge rewards fluency, structure, and confidence, all of which a hallucination has in abundance. Optimise against it directly and you get answers that read beautifully and are unsupported \u2014 you have taught the system to satisfy the referee."],
                  ["<strong>Solid</strong>", "Maximise the rate of grounded, correct answers subject to a hallucination ceiling", "Correct shape. It makes unsupported claims a bounded budget rather than an unmeasured externality, which is exactly what a precision floor does for moderation."],
                  ["<strong>Standout</strong>", "Maximise resolved questions per session subject to a hallucination ceiling <em>and</em> a per-query cost/latency budget \u2014 with a correct abstention counted as a resolution", "Optimises the user's actual outcome, prices in the constraint that makes production RAG hard (cost and latency, not accuracy alone), and encodes the crucial policy that saying \u201cthis isn't in the corpus, here's who owns it\u201d is a <em>win</em>. Without that last clause the system is structurally pushed toward guessing."]
                ]
              },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "No retrieval \u2014 rely on the generator's parametric knowledge, or dump as much of the corpus into the context as fits", "Buys a demo in an hour. Costs you correctness (nothing is grounded, nothing is citable, updates never propagate) and, for the context-dump variant, cost and latency that scale with the corpus while attention to any single relevant passage gets diluted."],
                  ["<strong>Naive</strong>", "Dense-only retrieval, top-k straight into the prompt", "Buys the standard tutorial pipeline, and it works on easy questions. Costs you the queries that matter most in a reference corpus: exact identifiers, error codes, policy numbers, and version strings, all of which dense retrieval smears. It also has no way to reorder a mediocre top-k."],
                  ["<strong>Solid</strong>", "Hybrid retrieval \u2192 cross-encoder rerank of ~20\u201350 candidates \u2192 grounded generation with per-claim citations", "Buys the largest available quality jump for a bounded latency cost. The reranker matters more here than in search, because you are not showing ten results \u2014 you are choosing the handful of passages the answer will be built from, so precision at the very top is everything."],
                  ["<strong>Standout</strong>", "Query understanding and routing \u2192 structure-aware chunking with parent expansion \u2192 hybrid retrieval with access filtering \u2192 rerank \u2192 grounded generation with citations and an abstention path \u2192 caching plus a cheap/expensive route split", "Buys production viability: routing sends easy questions down a cheap path and keeps the expensive one for questions that need it, parent expansion decouples the retrieval unit from the reading unit, and abstention bounds the worst case. Costs a genuinely multi-component system where each part needs its own evaluation."]
                ]
              },

              { t: "h", text: "Chunking: the decision that quietly sets your ceiling" },
              { t: "p", html: "A chunk plays two roles that want opposite things. As the <em>retrieval unit</em> it wants to be small and topically pure, because one embedding has to represent the whole thing and a vector averaging four topics matches none of them well. As the <em>reading unit</em> it wants to be large enough to be self-contained, because a paragraph that says \u201cthis does not apply to enterprise accounts\u201d is worse than useless without the sentence defining what \u201cthis\u201d is." },
              { t: "ul", items: [
                "<strong>Too small:</strong> sharp retrieval, fragmentary context. The generator gets a true sentence stripped of its caveat and produces an answer that is technically sourced and practically wrong.",
                "<strong>Too large:</strong> muddy embeddings, diluted matches, wasted context and cost. Recall degrades in a way that is hard to see because you are still retrieving <em>something</em> plausible.",
                "<strong>Split on structure, not on character count.</strong> Headings, sections, list boundaries, and table rows carry the author's own semantics \u2014 use them, and keep tables intact rather than slicing them mid-row.",
                "<strong>Decouple the two roles.</strong> Retrieve on small chunks, then expand the winner to its parent section before handing it to the generator. This is the single highest-leverage change most RAG pipelines are missing.",
                "<strong>Carry metadata on every chunk:</strong> source document, section path, version, effective date, and access-control labels. Citations, freshness filtering, and access enforcement all depend on it, and retrofitting it later means re-indexing everything.",
                "<strong>Modest overlap</strong> between adjacent chunks stops facts from being severed at a boundary, at a proportional cost in index size."
              ] },
              { t: "note", variant: "warn", html: "<strong>Access control cannot be a post-filter.</strong> If you retrieve the top-k and then remove what the user may not see, you have already leaked the shape of the corpus through result counts and, worse, you may hand the generator a passage that gets summarised into the answer. Filter <em>during</em> retrieval by carrying access labels on the chunk and constraining the query. This is the requirement in this design with the least room for approximation." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "INDEXING PIPELINE                       QUERY PATH\n" +
                "-----------------------------------     -----------------------------------\n" +
                "documents (continuous updates)          question + user identity\n" +
                "   |                                            |\n" +
                "   v                                            v\n" +
                "parse -> structure-aware chunk          query understanding\n" +
                "   |     (+ metadata: source,           (intent, route, entities,\n" +
                "   |      section, version, ACL)          answerable-from-corpus?)\n" +
                "   v                                            |\n" +
                "   +--> lexical index                           v\n" +
                "   |                                   cache hit? --yes--> stream cached\n" +
                "   +--> embed -> vector index                    | no\n" +
                "   |      (re-embed changed chunks only)         v\n" +
                "   v                                     HYBRID RETRIEVAL (parallel)\n" +
                "eval sets:                               lexical || dense, ACL-filtered\n" +
                "  golden Q/A, claim-level                        |\n" +
                "  groundedness, abstention set                   v\n" +
                "   |                                     FUSE -> ~50 candidates\n" +
                "   v                                             |\n" +
                "offline eval  <--- sampled traffic               v\n" +
                "   |                                     CROSS-ENCODER RERANK -> top ~5\n" +
                "   v                                             |\n" +
                "human audit of judge  ------------->             v\n" +
                "                                         parent expansion\n" +
                "                                                 |\n" +
                "                                                 v\n" +
                "                                         enough support? --no--> ABSTAIN\n" +
                "                                                 | yes             (+ route\n" +
                "                                                 v                  to owner)\n" +
                "                                         GROUNDED GENERATION\n" +
                "                                         cite per claim, stream tokens\n" +
                "                                                 |\n" +
                "                                                 v\n" +
                "                                         log: retrieved set, citations,\n" +
                "                                         abstention, latency per stage\n"
              },
              { t: "p", html: "Three arrows are doing real work. <strong>\u201cEnough support?\u201d \u2192 abstain</strong> is the branch most implementations omit, and it is the one that bounds your worst case: if the reranked top passages score poorly, no prompt instruction will conjure grounding, so refuse and route the user to a human owner. <strong>Re-embed changed chunks only</strong> is what makes continuous corpus updates affordable \u2014 re-embedding a million documents because forty changed is the kind of cost mistake that gets a project cancelled. <strong>Log the retrieved set and the citations</strong>, not just the answer: when someone reports a wrong answer, the first question is always whether the right passage was retrieved and, if it was, whether the generator ignored it \u2014 and you cannot answer that after the fact without the log." },

              { t: "h", text: "Measuring hallucination, properly" },
              { t: "p", html: "\u201cThe model hallucinates sometimes\u201d is not a metric, and you cannot improve what you have not instrumented. Groundedness is a property of <em>individual assertions</em>, so the unit of evaluation has to be the claim, not the response \u2014 an answer with four supported claims and one invented one is not 80% fine, it is wrong in the way that gets acted on." },
              { t: "ol", items: [
                "<strong>Decompose the answer into atomic claims.</strong> Automatable, and it forces the evaluation to be specific rather than a vibe.",
                "<strong>Check each claim against the retrieved passages</strong> \u2014 is it entailed, contradicted, or simply absent? Absent is the interesting category, because that is the hallucination.",
                "<strong>Use an automated judge for volume, and audit it with humans.</strong> A judge is a model with its own error rate, so maintain a human-labelled slice and report the judge's agreement with it. Without that number your hallucination rate is unfalsifiable.",
                "<strong>Track retrieval and generation failures separately.</strong> Recall@k on a golden query set tells you whether the answer was even reachable. Answers that were unsupported <em>despite</em> the right passage being present are a generation or prompting problem. Conflating them means you optimise the wrong half of the pipeline for a quarter.",
                "<strong>Keep an explicit abstention set:</strong> questions you know the corpus cannot answer. Measure how often the system correctly declines. A system that never abstains has not solved hallucination, it has hidden it."
              ] },
              { t: "note", variant: "trap", html: "<strong>Fluency is anti-correlated with your ability to notice the problem.</strong> The dangerous failure is not a garbled answer, it is a well-structured, appropriately-hedged, plausibly-cited answer whose third sentence is invented. This is why helpfulness ratings, readability scores, and user thumbs-up are all inadequate as groundedness measures \u2014 and why citations must be checked to actually support the claim they are attached to, rather than merely being present. A citation that does not support its claim is worse than none, because it manufactures trust." },

              { t: "h", text: "Cost control, and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Cache aggressively at two levels:</strong> exact-question cache for repeats, and a retrieval cache keyed on the normalised query, since retrieval is deterministic given a corpus version. Head questions repeat far more than people expect.",
                "<strong>Route by difficulty.</strong> Most questions are simple lookups that a small model answers correctly from two well-chosen passages. Reserve the expensive generator for questions the router flags as needing synthesis, and measure the router's error rate \u2014 it is a model too.",
                "<strong>Bound the context.</strong> Cost and latency scale with what you put in the prompt, and past a handful of well-ranked passages the marginal one usually adds noise rather than support. A better reranker is cheaper than a bigger context.",
                "<strong>Distil the reranker.</strong> Same move as in <a href='#/mlcase/retrieval/search-ranking'>search ranking</a>: train a small cross-encoder to imitate a large one, and keep most of the quality at a fraction of the latency.",
                "<strong>Bound the output.</strong> Answer length is the single easiest cost lever and it usually improves the product \u2014 for a reference corpus, short and cited beats long and discursive."
              ] },
              { t: "ol", items: [
                "<strong>\u201cUsers say answers are outdated. Where do you look?\u201d</strong> Walk the pipeline in order: is the document indexed, was the changed chunk re-embedded, is the stale version <em>also</em> still in the index (the most common cause \u2014 update-as-insert without delete), does the reranker prefer the old chunk, and does the prompt tell the generator to prefer the most recent effective date when passages conflict? Version metadata on chunks is what makes this debuggable at all.",
                "<strong>\u201cRetrieval recall is 95% but answers are still wrong.\u201d</strong> Then the failure is downstream: the right passage was retrieved but ranked below the context cut, or it was in context and the generator preferred its own parametric knowledge, or the passage was truncated away from the qualifier that changed its meaning. These have different fixes, which is exactly why you measure the stages separately.",
                "<strong>\u201cHow do you know it is getting better?\u201d</strong> A frozen golden set with claim-level groundedness labels, an abstention set, per-stage latency percentiles, and cost per resolved question \u2014 tracked over time, with the judge re-audited against humans each time you change it. Vibes-based iteration on RAG systems is how teams spend six months and cannot say whether they improved."
              ] },
              { t: "cue", html: "The framing that separates a designer from a prompt-tuner: \u201cAlmost every wrong answer here is a retrieval failure, so I'd invest in chunking, hybrid retrieval, and a reranker before touching the prompt \u2014 and I'd measure groundedness at the claim level against the retrieved passages, with an explicit abstention set, because a fluent unsupported answer is the failure mode that actually causes harm.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds chunk \u2192 embed \u2192 top-k \u2192 prompt, with citations. Knows hallucination is a risk and addresses it with prompt instructions. Typically has no measurement plan and no abstention path."],
                  ["<strong>Senior</strong>", "Argues hybrid retrieval and a reranker from the corpus's actual query mix, treats chunking as a real design decision with the retrieval/reading trade named, decomposes the latency budget per stage, and measures groundedness at the claim level rather than rating answers holistically."],
                  ["<strong>Staff</strong>", "Designs the evaluation before the pipeline: golden set, claim-level groundedness with a human-audited judge, abstention set, per-stage attribution of failures. Treats cost per resolved question as a first-class constraint with routing and caching to manage it, enforces access control inside retrieval, and makes abstention an explicitly successful outcome."]
                ]
              },

              { t: "h", text: "What generalises from the first seven" },
              { t: "p", html: "The first seven problems on this track look nothing alike \u2014 a video surface, a feed, an auction, two abuse systems, a search engine, an assistant. The same handful of moves did most of the work every time, and that transfer is the real deliverable of this track. The six later breakdowns — people you may know, notifications, fraud, autocomplete, ETA and demand forecasting — are where you test whether the moves transfer." },
              { t: "ul", items: [
                "<strong>The objective is the design.</strong> Every problem here turned on the objective ladder, and every ladder had the same shape: a naive proxy with a known pathology, a better proxy that bounds the harm, then a framing that optimises the thing you actually care about \u2014 exposure rather than item count, session value rather than clicks, resolved questions rather than answers produced.",
                "<strong>Constrained optimisation beats a single number.</strong> \u201cMaximise X subject to a floor on Y\u201d appeared in almost every Great row, because it is the only framing that represents both ways of being wrong. Whenever you catch yourself proposing one metric to maximise, ask what it lets you destroy.",
                "<strong>Two stages, cheap then expensive.</strong> Retrieval and ranking; cheap tier and heavy tier in moderation; first-pass ranker and cross-encoder; lookup route and synthesis route. Whenever candidates outnumber your compute budget, the answer is a funnel \u2014 and the cheap stage's only job is to not lose the good item.",
                "<strong>The label is usually the hard part.</strong> Watch time needs normalising; feed engagement is several labels with different thresholds; a click needs an attribution window; harm is a human judgement with real disagreement; \u201cbot\u201d has no ground truth at all; a click in search is relevance times examination. If a problem's label seems obvious, you have not looked at it yet.",
                "<strong>Your model chooses the data your successor trains on.</strong> Exposure bias, enforcement truncation, position bias, adversarial adaptation \u2014 four names for one dynamic. The countermeasures are always some mix of deliberate randomisation, exploration budget, and unbiased audit samples, and all three feel wasteful right up until you need them.",
                "<strong>Say the numbers, label them as assumptions.</strong> Every requirements table on these pages is an order of magnitude with the word \u201cassume\u201d attached. That is not hedging \u2014 it is what makes the design checkable, and it invites the correction that saves you fifteen minutes of designing for the wrong scale."
              ] },
              { t: "p", html: "Next: pressure-test the framework itself in <a href='#/mlsd/framework/assessment'>assessment</a>, and check your reading of the bar against <a href='#/mlsd/framework/level-expectations'>level expectations</a>. If any beat on these pages felt like recitation rather than reasoning, the concept behind it is in <a href='#/mlsd/framework/what-is-mlsd'>the mlsd track</a> \u2014 and the fastest way to find out which is to pick a problem nobody wrote up and run the eight beats on it yourself." },
              { t: "quiz", id: "mlcase-retrieval" },
              { t: "note", variant: "key", html: "<strong>RAG is a retrieval system with a generator attached, and hallucination is a measurement problem before it is a modelling one.</strong> Chunk on structure and retrieve small but read large, go hybrid then rerank, enforce access control inside retrieval, count abstention as success, and score groundedness claim by claim against the passages you actually retrieved \u2014 with a human-audited judge, or your hallucination rate is just a number you made up." }
            ]
          },

          /* ---------- 11. search autocomplete ---------- */
          {
            id: "search-autocomplete",
            title: "Suggesting queries as the user types",
            summary: "A per-keystroke latency budget, prefix-indexed candidates from query logs, ranking that blends popularity, personalisation and freshness, and a safety filter that is never optional.",
            minutes: 11,
            tags: ["search", "autocomplete", "latency", "trie", "safety"],
            blocks: [
              { t: "p", html: "Autocomplete looks like a small feature and behaves like a demanding system. It runs on <strong>every keystroke</strong>, so its request rate is several times that of search itself; it must answer before the next keystroke lands, so its budget is a few tens of milliseconds; and it returns only five to ten suggestions, so every slot is precious. It also has a property ordinary rankers lack: <strong>people read suggestions as the system's opinion.</strong> A completion of someone's name with something defamatory, or of a neutral query with something offensive, is a public statement you made. The mental model: a <strong>prefix-keyed ranking problem with a brutal latency budget, an editorial responsibility, and a privacy floor</strong> \u2014 and its success is measured by how quickly it gets the user to the query they meant." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>Where do suggestions come from?</strong> <em>Assume:</em> past queries from the search logs, aggregated across users, plus the member's own recent searches. Entity suggestions (products, people, places) are a natural extension; mention them and scope them out.",
                "<strong>How many languages and markets?</strong> <em>Assume:</em> several, each with its own suggestion index, because popularity and offensiveness are both local.",
                "<strong>Is personalisation allowed?</strong> <em>Assume:</em> yes, using the member's own history and coarse context such as locale. Never anyone else's individual queries.",
                "<strong>Latency target?</strong> <em>Assume:</em> server-side p99 of a few tens of milliseconds. Keystrokes arrive every 100\u2013200 ms for a fast typist, and a suggestion that arrives after the next keystroke is wasted work.",
                "<strong>Typos and trending?</strong> <em>Assume:</em> both in scope \u2014 suggestions should survive a mistyped prefix, and breaking topics should appear within minutes.",
                "<strong>Out of scope:</strong> the search results page and spelling correction of submitted queries. Search ranking is its own case: <a href='#/mlcase/retrieval/search-ranking'>search ranking</a>."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> return up to ten ranked completions for a prefix and context; tolerate small typos; surface trending queries quickly; never surface offensive, dangerous, or defamatory completions; never surface a query typed by too few distinct users to be safely public; support a user removing items from their own history.",
                "<strong>Non-functional:</strong> below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds the design"],
                rows: [
                  ["Request rate", "several \u00d7 search query rate (one request per keystroke, reduced by client debouncing)", "Per-request work must be tiny; caching is the main lever"],
                  ["Latency", "a few tens of ms p99 server-side", "No heavy model in the loop; candidate lookup must be prefix-indexed"],
                  ["Suggestion pool", "~10<sup>8</sup> distinct logged queries, pruned to those above a frequency and distinct-user threshold", "Fits in memory as a compressed prefix structure per market"],
                  ["Privacy floor", "a query appears only if typed by at least <em>k</em> distinct users", "Rare queries often contain personal details; the threshold keeps them out"],
                  ["Freshness", "trending queries suggestible within minutes", "Needs a streaming path alongside the periodic rebuild of the main index"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the product"],
                rows: [
                  ["<strong>Naive</strong>", "Maximise suggestion click-through", "Accepting a suggestion is cheap, so this rewards whatever looks intriguing. Sensational and provocative completions win, and a curious tap on a suggestion the user never intended counts as success."],
                  ["<strong>Naive</strong>", "Always show the most popular completions of the prefix", "A strong baseline and a bad end state: no personalisation, slow to react to events, dominated by head queries, and it amplifies whatever is popular \u2014 including offensive completions \u2014 with the system's implicit endorsement."],
                  ["<strong>Solid</strong>", "Maximise keystrokes saved and the reciprocal rank of the query the user eventually submitted among the suggestions shown", "Grounds success in intent: the submitted query is the label, and a good suggestion is one that would have saved the user the rest of the typing. Computable offline by replaying logs."],
                  ["<strong>Standout</strong>", "Maximise successful searches reached sooner \u2014 keystrokes saved, weighted by whether the resulting search succeeded \u2014 subject to hard safety and privacy constraints, with freshness for time-sensitive intents", "Adds the downstream outcome, so a suggestion that saves typing but leads to a dead-end search does not get credit, and makes safety and privacy constraints rather than terms to trade off."]
                ]
              },
              { t: "note", variant: "tip", html: "The label here is unusually clean: <strong>the query the user ended up submitting.</strong> For every prefix they typed on the way, you know what they meant. That makes autocomplete one of the few ranking problems where offline replay of logs is a reasonable estimate of online behaviour \u2014 provided you remember the suggestions they saw influenced what they typed." },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "A trie of logged queries with the top-k most frequent completions stored at each node", "Buys a lookup proportional to prefix length and a genuinely good baseline. Costs you personalisation, freshness (it is rebuilt periodically), and any tolerance for typos."],
                  ["<strong>Naive</strong>", "A neural model that generates completions token by token for every keystroke", "Buys coverage of prefixes no one has typed before. Costs you the latency budget, safety (it can invent completions no filter has seen), and privacy guarantees that a frequency threshold gives you for free."],
                  ["<strong>Solid</strong>", "Compressed prefix index (trie or finite-state transducer) with precomputed top-k per node \u2192 a small GBDT reranker over ~50 candidates using time-decayed popularity, personal history match, locale, and freshness \u2192 safety filter", "Buys personalisation and freshness inside the budget, because the expensive part (candidate enumeration) is precomputed and the per-request part is a tiny rerank. Costs a rebuild pipeline and a ranker to keep in sync with the index."],
                  ["<strong>Standout</strong>", "Several candidate sources \u2014 prefix index, typo-tolerant index, the member's own history, a trending detector \u2014 merged and reranked, with per-prefix caching for short prefixes, a layered safety filter, and strictly filtered generated completions only for tail prefixes with no coverage", "Buys coverage of typos, breaking news, and personal repeats without paying for them on every request. Costs several indexes to build and keep consistent, and a safety layer that must vet every source equally."]
                ]
              },

              { t: "h2", text: "Candidate generation: prefix indexes and the typo problem" },
              { t: "ul", items: [
                "<strong>Store top-k at each node.</strong> Walking a trie to the prefix node is cheap; enumerating every completion below it is not. Precompute the best few dozen completions per node offline, so a lookup is a walk plus a read.",
                "<strong>Compress.</strong> A finite-state transducer shares both prefixes and suffixes and fits a large query vocabulary in memory per market \u2014 important when the index is replicated on many serving hosts.",
                "<strong>Typo tolerance</strong> expands the prefix to its neighbours within a small edit distance (or along keyboard-adjacent substitutions) and unions their candidates. The neighbourhood grows quickly, so restrict it to prefixes of a few characters or more and penalise corrected candidates in ranking.",
                "<strong>Cold prefixes.</strong> A prefix with no logged completions falls back to completing just the last word, or to an entity index. Generated suggestions, if used at all, must pass the same safety and privacy filters as everything else.",
                "<strong>Short prefixes are a cache problem.</strong> There are only a few thousand one-to-three-character prefixes per market and they carry a large share of traffic \u2014 cache their ranked results outright."
              ] },
              { t: "code", lang: "text", code:
                "prefix \"wea\"  ->  trie node 'w'->'e'->'a'\n" +
                "  precomputed top-k at node:  weather (0.41)  weather tomorrow (0.12)\n" +
                "                              wealth tax (0.06)  weave patterns (0.03) ...\n" +
                "\n" +
                "per-keystroke budget (server side, p99):\n" +
                "  cache lookup / trie walk     ~1-3 ms\n" +
                "  merge personal + trending    ~1-2 ms\n" +
                "  rerank ~50 candidates (GBDT) ~2-5 ms\n" +
                "  safety + privacy filter      ~1 ms\n" +
                "  -------------------------------------\n" +
                "  well inside a few tens of ms, leaving room for network\n"
              },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE  (daily rebuild + streaming)        ONLINE  (per keystroke)\n" +
                "-------------------------------------       ----------------------------------\n" +
                "search query logs                           prefix + member + locale\n" +
                "    |                                               |\n" +
                "    v                                               v\n" +
                "normalise, aggregate, k-user threshold     PREFIX CACHE (short prefixes) --hit--+\n" +
                "    |                                               | miss                   |\n" +
                "    v                                               v                        |\n" +
                "SAFETY CLASSIFIER + blocklists              PREFIX INDEX (trie / FST, top-k)     |\n" +
                "    |                                       + typo-tolerant expansion            |\n" +
                "    v                                       + member's own history               |\n" +
                "build trie / FST per market ------------>   + TRENDING store                    |\n" +
                "                                                    |                        |\n" +
                "query stream --> spike detector --> TRENDING        v                        |\n" +
                "                 (diverse users,            RERANK (small GBDT)              |\n" +
                "                  rate-limited)                     |                        |\n" +
                "                                                    v                        |\n" +
                "keystroke logs (prefix, shown, chosen,      SAFETY + PRIVACY FILTER  <-------+\n" +
                "  submitted query) --> ranker training              |\n" +
                "                                                    v\n" +
                "                                            <= 10 suggestions + log\n"
              },
              { t: "p", html: "Two arrows matter most. <strong>Safety classifier before the index build</strong> means offensive completions never enter the serving structure, while the <strong>final safety filter</strong> catches what slipped through or arrived via the trending and personal paths \u2014 defence in depth, because a single bad suggestion is screenshot material. <strong>Spike detector \u2192 trending store</strong> is the freshness path, and it is also an attack surface: coordinated groups can type a phrase repeatedly to push it into suggestions, so trending candidates need a minimum number of <em>distinct</em> users and rate limits per user before they count." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>Log at keystroke level:</strong> the prefix, the suggestions shown with positions, whether one was chosen, and the query finally submitted. The submitted query is the label for every prefix along the way.",
                "<strong>Features:</strong> time-decayed global frequency of the completion, frequency within the member's locale, match to the member's own history, recency of the completion's spike, prefix length, whether the candidate came from typo expansion, and the downstream success rate of searches for that completion.",
                "<strong>Position bias still applies.</strong> Users pick from what they were shown, and the top slot gets picked more. Use the submitted query (including when the user typed it out rather than selecting it) as the label rather than selections alone, and treat selections with the same care as clicks in <a href='#/mlcase/retrieval/search-ranking'>search ranking</a>.",
                "<strong>Personal history</strong> is a strong feature and a privacy obligation: members must be able to delete it, and it must never leak to anyone else's suggestions."
              ] },
              { t: "note", variant: "warn", html: "<strong>Safety filtering cannot be optional or purely learned.</strong> Completions that attach slurs, sexual content, violence, or unverified accusations to a prefix \u2014 especially to a person's name \u2014 cause real harm, and the system's suggestion reads as endorsement. Use layered defences: curated blocklists, a classifier over completions, extra scrutiny on prefixes that look like names, fast human escalation for reports, and a privacy threshold so no query typed by only a handful of people is ever suggested. Measure these as guardrails with owners, not as model features." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> replay logged sessions prefix by prefix and measure keystrokes saved and the reciprocal rank of the eventually submitted query among the suggestions, sliced by prefix length. Split by time so trending behaviour is evaluated honestly. Ranking-metric background in <a href='#/found/metrics/ranking-metrics'>ranking metrics</a>.",
                "<strong>Online:</strong> suggestion acceptance rate, characters typed per search, time to submit, downstream search success, and zero-suggestion rate. Serving p99 latency is a first-class metric.",
                "<strong>Guardrails:</strong> safety reports per million suggestions, blocklist hit rate, and audits of suggestions for name-like prefixes.",
                "<strong>Experiments:</strong> autocomplete changes what users type, which changes the query mix search sees \u2014 so watch search-side metrics too, not just suggestion acceptance."
              ] },
              { t: "ol", items: [
                "<strong>\"How do you stay inside the latency budget?\"</strong> Precompute top-k per node, cache short prefixes outright, keep the request-time model to a small rerank, debounce on the client, and prefetch the likely next prefixes.",
                "<strong>Trending versus manipulation.</strong> Detect spikes by comparing short-window counts with an expected baseline, but count distinct users, cap any single user's contribution, and pass every trending candidate through safety before it goes live.",
                "<strong>Personalisation versus privacy.</strong> Personal history makes repeat searches fast, but it must stay per-member, be deletable, and never cross into the global index without passing the distinct-user threshold."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cI'd generate candidates from a prefix index with top-k precomputed at each node and cache short prefixes outright, so the per-keystroke work is a small rerank on popularity, personal history, and freshness. I'd measure success as keystrokes saved toward the query the user eventually submitted, and treat safety and a distinct-user privacy threshold as hard filters, because a suggestion reads as the system's own opinion.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds a trie of popular queries and returns the top completions, perhaps with caching. Measures suggestion click-through and treats safety as a blocklist."],
                  ["<strong>Senior</strong>", "Designs top-k-per-node precomputation and per-prefix caching against an explicit per-keystroke budget, adds personalisation and trending with a small reranker, and uses the eventually submitted query as the label with keystrokes saved or MRR as the offline metric."],
                  ["<strong>Staff</strong>", "Treats safety and privacy as layered hard constraints with owners, defends trending against coordinated manipulation, connects suggestion quality to downstream search success, and anticipates that autocomplete reshapes the query distribution the rest of search depends on."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>Autocomplete is a prefix-keyed ranker on a per-keystroke budget that speaks with your voice.</strong> Precompute top-k at every prefix node and cache the short prefixes, spend request time only on a small rerank, measure keystrokes saved toward the query the user actually submitted, and make safety and a distinct-user privacy floor hard filters, not features." }
            ]
          }
        ]
      },

      /* ==================== FORECAST ==================== */
      {
        id: "forecast",
        name: "Forecasting & marketplaces",
        icon: "trend",
        lessons: [

          /* ---------- 12. ETA prediction ---------- */
          {
            id: "eta-prediction",
            title: "Predicting arrival times for rides and deliveries",
            summary: "Regression with an asymmetric cost, quantiles instead of a single number, a residual model on top of a routing engine, and the feedback effect of showing an ETA at all.",
            minutes: 11,
            tags: ["regression", "quantiles", "eta", "calibration", "marketplace"],
            blocks: [
              { t: "p", html: "An ETA is a <strong>promise made before the customer decides</strong>. It is shown on the restaurant list, the ride confirmation, the checkout page \u2014 and it changes what people choose. It is also judged asymmetrically: arriving five minutes early is pleasant, arriving five minutes late generates refunds, support contacts, and churn. Those two facts set the shape of the whole design. The output should be a <strong>distribution</strong> (at least a median and an upper quantile) rather than one number; the loss should encode the asymmetry; and because a routing engine already knows a great deal about roads, the model's job is usually to <strong>correct a physics-based estimate</strong> rather than to replace it." },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>Which ETA?</strong> Pickup time for a ride, or door-to-door time for a delivery? <em>Assume:</em> food delivery end to end \u2014 preparation, courier travel to the merchant, waiting, travel to the customer, and handoff. The components have different drivers and different data.",
                "<strong>Where is it shown?</strong> <em>Assume:</em> before ordering (on listings and at checkout) and after ordering (a live, updating estimate). The pre-order ETA changes conversion; the post-order ETA changes trust.",
                "<strong>How bad is late versus early?</strong> <em>Assume:</em> late is several times worse per minute. Ask for the number \u2014 it picks the quantile you show.",
                "<strong>Scale?</strong> <em>Assume:</em> every listing view needs ETAs for dozens of merchants, so predictions run at ~10<sup>5</sup> per second at peak, with live updates for orders in progress every 30 seconds or so.",
                "<strong>What routing exists?</strong> <em>Assume:</em> a routing engine that returns a path and a segment-by-segment travel-time estimate. You consume it; you do not rebuild it.",
                "<strong>Out of scope:</strong> dispatch (which courier gets which order) and pricing \u2014 both consume your ETA, which is worth saying because it means your errors propagate."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> return a median and an upper-quantile ETA for a candidate order, for many merchants per page; update the estimate during the order; never move the live estimate erratically; log every prediction with its inputs so it can be compared with the actual.",
                "<strong>Non-functional:</strong> below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds the design"],
                rows: [
                  ["Prediction rate", "~10<sup>5</sup> per second at peak", "Batch scoring per page; heavy per-merchant work must be precomputed"],
                  ["Latency", "tens of ms p99 for a batch of merchant ETAs", "Routing calls are the expensive part; cache them by area and time bucket"],
                  ["Accuracy", "median absolute error in low single-digit minutes for typical orders", "Sets the bar against the routing-only baseline"],
                  ["Quantile calibration", "the shown P90 covers ~90% of actuals, overall and per city and hour", "A coverage SLO, not just an error metric"],
                  ["Traffic freshness", "minute-level speeds on major segments", "Needs a streaming feature path for current conditions"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the product"],
                rows: [
                  ["<strong>Naive</strong>", "Minimise mean squared error", "Squared error is dominated by the rare order that took ninety minutes, and its optimum is the mean of a right-skewed distribution. The result is a single number pulled around by outliers that treats late and early as equally bad."],
                  ["<strong>Naive</strong>", "Minimise mean absolute error overall", "More robust \u2014 the optimum is the median \u2014 but still symmetric and still a single number. Half of all orders arrive after the promise by construction, and the customer has no idea how uncertain it is."],
                  ["<strong>Solid</strong>", "Predict several quantiles (P50 and P90) with pinball loss, and show a range or the upper bound", "Encodes uncertainty directly and lets the product decide how to present it. Requires calibrated quantiles, which becomes something you monitor."],
                  ["<strong>Standout</strong>", "Minimise the business cost of error: choose the quantile to promise from the ratio of late to early cost, calibrate quantiles per segment, and measure the ETA's effect on conversion and lateness together", "Turns \"how accurate is it?\" into \"what does each minute of error cost?\", admits that the shown number changes behaviour, and makes the trade between an honest promise and a competitive-looking one explicit."]
                ]
              },
              { t: "code", lang: "python", code:
                "def pinball(actual, pred, tau):\n" +
                "    diff = actual - pred          # positive = delivery was later than predicted\n" +
                "    return max(tau * diff, (tau - 1) * diff)\n" +
                "\n" +
                "# If each late minute costs c_late and each early minute costs c_early,\n" +
                "# the cost-minimising promise is the tau-quantile with:\n" +
                "c_late, c_early = 3.0, 1.0\n" +
                "tau = c_late / (c_late + c_early)   # 0.75\n" +
                "\n" +
                "# Example: true P50 = 30 min, P75 = 36 min, P90 = 42 min\n" +
                "# promise 36 min; show '30-42 min' as the range\n"
              },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Routing engine estimate alone", "Buys a physically grounded number with no training data, and it is the baseline every model must beat. Costs you everything off the road: preparation time, waiting at the merchant, parking, and finding the customer's door \u2014 often a large share of the total."],
                  ["<strong>Naive</strong>", "A global regression from raw features that ignores routing", "Buys a learned model quickly. Costs you the physics: the model has to rediscover road networks from data, does badly in areas with little history, and breaks whenever the road network changes."],
                  ["<strong>Solid</strong>", "Gradient-boosted residual model on top of the routing estimate, predicting several quantiles, with features for time, merchant preparation history, order size, weather, and courier supply", "Buys a strong, fast model that concentrates on what routing misses and degrades gracefully to the routing estimate. Costs coupling: a routing-engine upgrade changes the residuals, so the two must be versioned together."],
                  ["<strong>Standout</strong>", "Decomposed model \u2014 separate quantile models for preparation, travel, and handoff legs, segment-level travel features with live traffic, combined into a total \u2014 with post-hoc quantile calibration per segment and smoothed in-order updates", "Buys diagnosability (you know which leg is wrong), better use of leg-specific signals, and calibrated ranges. Costs more models and the subtlety that quantiles of legs do not add up to the quantile of the total, so the combination needs care."]
                ]
              },

              { t: "h2", text: "The residual trick, and what it costs" },
              { t: "p", html: "Set the target to <code class='tok'>actual &minus; routing_estimate</code> and the model no longer needs to learn that 10 km of motorway takes about eight minutes; it learns that this merchant is slow on Friday nights, that this neighbourhood's buildings add four minutes at handoff, that rain adds 15% to travel. Residual models train faster, need less data per area, and fall back sensibly \u2014 a residual of zero is the routing estimate. The cost is that you now depend on another team's model: when routing improves, your residuals shift, and a model trained on the old residuals will over-correct. Version the routing engine in your logs and retrain when it changes." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "OFFLINE                                       ONLINE  (per listing / order)\n" +
                "-------------------------------------          ----------------------------------\n" +
                "completed orders: timestamps per leg            request(customer, merchants[], time)\n" +
                "  + routing estimate at order time                       |\n" +
                "  + routing engine version                               v\n" +
                "        |                                       ROUTING (cached by area x time)\n" +
                "        v                                         path + segment estimate\n" +
                "point-in-time join: traffic, weather,                    |\n" +
                "  merchant load AS OF prediction time                    v\n" +
                "        |                                       FEATURE FETCH\n" +
                "        v                                         merchant prep history (batch)\n" +
                "quantile models per leg (P50, P75, P90)           live traffic, weather (stream)\n" +
                "        |                                         courier supply in area\n" +
                "        v                                                |\n" +
                "calibration fit per city x hour                          v\n" +
                "        |                                       RESIDUAL QUANTILE MODELS\n" +
                "        v                                         prep + travel + handoff\n" +
                "registry (paired with routing version) ---->             |\n" +
                "                                                          v\n" +
                "coverage + bias monitors  <---- prediction log  CALIBRATION + combine legs\n" +
                "                                                          |\n" +
                "                                                          v\n" +
                "                                                promise (tau) + range, smoothed\n"
              },
              { t: "p", html: "Two arrows deserve attention. <strong>Routing cached by area and time bucket</strong> is what makes listing pages affordable: dozens of merchants per page, each needing a route, is the dominant cost, and nearby requests share most of their routes. <strong>Prediction log \u2192 coverage and bias monitors</strong> closes the loop: you know the actual time for every order within the hour, so ETA systems get unusually fast feedback \u2014 use it, and alert on coverage per city before customers notice. Serving patterns are covered in <a href='#/ops/inference/serving-performance'>serving performance</a>." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>The label</strong> is the actual time per leg: order placed \u2192 food ready \u2192 courier arrives at merchant \u2192 picked up \u2192 delivered. Each timestamp comes from a different actor (merchant tablet, courier app, GPS), and each has its own errors \u2014 couriers who tap \"delivered\" early, merchants who mark food ready before it is.",
                "<strong>Clean the label</strong> with GPS and geofence checks, and drop or down-weight orders whose timestamps are physically impossible.",
                "<strong>Features:</strong> routing estimate and distance, segment-level historic and live speeds, merchant preparation history by hour and order size, merchant current load, courier supply nearby, weather, local events, and building or address type for handoff.",
                "<strong>Point-in-time traffic.</strong> Train on the traffic and merchant load as they were known <em>at prediction time</em>, not as later observed \u2014 otherwise the model learns from information it will never have. See <a href='#/data/correctness/point-in-time'>point-in-time correctness</a>."
              ] },
              { t: "note", variant: "trap", html: "<strong>The ETA you show changes the data you learn from.</strong> Customers order more from merchants with short ETAs, so long-ETA merchants get fewer, unusual orders and their history thins out. Pad the ETA and conversion falls; shave it and lateness rises \u2014 and dispatch, which consumes your ETA, may reassign couriers based on it. Treat the shown ETA as an intervention: evaluate accuracy on all orders, but measure product changes with experiments that track conversion and lateness together (see <a href='#/found/experiments/ab-test-design'>A/B test design</a>)." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "stat", items: [
                { v: "100%", k: "MAPE on a 2-minute trip off by 2 minutes" },
                { v: "10%", k: "MAPE on a 40-minute trip off by 4 minutes" },
                { v: "~90%", k: "target share of actuals at or below a calibrated P90" }
              ] },
              { t: "ul", items: [
                "<strong>MAE in minutes</strong> is the headline accuracy number, sliced by city, hour, distance band, and merchant type.",
                "<strong>MAPE misleads</strong> here: it explodes on short trips and rewards under-prediction, so a model can \"improve\" MAPE by being systematically early on short orders. Report it, if at all, with MAE beside it.",
                "<strong>Bias</strong> (mean signed error) per slice catches the model that has fine MAE overall and is consistently five minutes late in one city.",
                "<strong>Quantile coverage and pinball loss</strong> check the range: the share of actuals below the P90 should be close to 90% in every slice. This is calibration for quantiles \u2014 see <a href='#/found/metrics/calibration'>calibration</a>.",
                "<strong>Online:</strong> late-order rate against the promise, conversion, refunds and credits issued, and support contacts about lateness."
              ] },
              { t: "ol", items: [
                "<strong>Live updates without whiplash.</strong> Customers hate an estimate that jumps from 12 to 25 to 15 minutes. Smooth updates, move them only when the change exceeds a threshold, and never tell someone their food is closer than physics allows.",
                "<strong>Latency at listing scale.</strong> Precompute per-merchant preparation estimates on a short cadence, cache routing by area and time bucket, and batch the model over all merchants on the page.",
                "<strong>Shocks.</strong> Road closures, storms, and big events shift travel times within minutes. Live traffic features absorb some of it; coverage monitors per city catch the rest \u2014 see <a href='#/ops/monitoring/drift-and-skew'>drift and skew</a>."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cLate costs more than early, so I'd predict quantiles with pinball loss and promise the quantile set by the cost ratio \u2014 three-to-one gives the 75th percentile \u2014 and I'd model the residual on top of the routing engine's estimate so the model learns preparation, waiting, and handoff rather than rediscovering roads. Then I'd monitor quantile coverage per city, because a P90 that only covers 75% of orders is a broken promise.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds a regression model with distance, time, and traffic features and evaluates with MAE or RMSE. Returns a single number and treats late and early symmetrically."],
                  ["<strong>Senior</strong>", "Predicts quantiles with pinball loss, picks the promised quantile from the cost asymmetry, uses a residual model on the routing estimate, decomposes the trip into legs, explains why MAPE misleads, and monitors coverage and bias per slice."],
                  ["<strong>Staff</strong>", "Treats the shown ETA as an intervention that changes conversion, dispatch, and the training data, designs experiments that weigh conversion against lateness, handles label quality from multiple actors, couples model versions to the routing engine, and plans for shocks and live-update stability."]
                ]
              },
              { t: "note", variant: "key", html: "<strong>An ETA is a promise with an asymmetric penalty.</strong> Predict quantiles rather than a point, promise the quantile set by the late-to-early cost ratio, learn the residual on top of the routing engine, check calibration by coverage per slice rather than by MAE alone, and remember that the number you show changes what customers do." }
            ]
          },

          /* ---------- 13. demand forecasting ---------- */
          {
            id: "demand-forecasting",
            title: "Forecasting demand for supply, staffing, and inventory",
            summary: "Hierarchies that must add up, horizon and granularity chosen from the decision, rolling-origin backtests, honest baselines, and what happens when the world shifts under the model.",
            minutes: 12,
            tags: ["forecasting", "time-series", "hierarchy", "backtesting", "quantiles"],
            blocks: [
              { t: "p", html: "A forecast is never the product; it is an input to a decision \u2014 how many units to order, how many couriers to schedule, how many servers to reserve. That one fact settles most of the design questions people agonise over. The <strong>horizon</strong> is the decision's lead time. The <strong>granularity</strong> is the level at which the decision is made. The <strong>loss</strong> is the cost of being wrong in each direction for that decision. And the baseline you must beat is embarrassingly simple: \"the same as this day last week\" is right often enough that many sophisticated models fail to beat it. The mental model: <strong>forecast the quantity the decision needs, at the level it needs it, with the uncertainty it needs, and prove you beat the naive answer.</strong>" },

              { t: "h", text: "The ask, and the questions worth the first five minutes" },
              { t: "ul", items: [
                "<strong>What decision does it feed?</strong> <em>Assume:</em> daily replenishment orders for a retailer \u2014 units per product per store. Marketplace supply forecasting (drivers per zone per 15 minutes) has the same structure at a finer grain.",
                "<strong>Granularity and scale?</strong> <em>Assume:</em> tens of thousands of products across about a thousand stores \u2014 on the order of 10<sup>7</sup> product\u2013store series, daily.",
                "<strong>Horizon?</strong> <em>Assume:</em> 1 to 14 days ahead, matching supplier lead times, with a coarser 8-week view for planning.",
                "<strong>Is demand observed?</strong> <em>Assume:</em> no \u2014 you observe sales, and sales stop when the shelf is empty. This censoring question is the one most candidates never ask.",
                "<strong>What do we know about the future?</strong> <em>Assume:</em> planned promotions, prices, holidays, and store openings are known in advance; weather forecasts are available a few days out.",
                "<strong>Out of scope:</strong> the ordering optimiser itself and supplier constraints. They consume your quantiles."
              ] },

              { t: "h", text: "Requirements" },
              { t: "ul", items: [
                "<strong>Functional:</strong> produce daily forecasts per product\u2013store for the horizon, with quantiles; aggregate coherently to category, region, and total for planners; support new products and new stores; allow planners to override for known events, and log the overrides.",
                "<strong>Non-functional:</strong> below."
              ] },
              { t: "table",
                headers: ["Dimension", "Assumed target", "Why it binds the design"],
                rows: [
                  ["Series", "~10<sup>7</sup> product\u2013store pairs", "Per-series hand-tuned models are infeasible; favours global models across series"],
                  ["Horizon", "1\u201314 days daily, plus an 8-week weekly view", "Accuracy degrades with horizon; forecast no further than the decision needs"],
                  ["Run window", "nightly batch finishing within a few hours", "Training and inference budgets are hours, not milliseconds"],
                  ["Output", "P50 plus service-level quantiles (e.g. P80, P95)", "Safety stock depends on uncertainty, not on the mean"],
                  ["Coherence", "store totals add up to regional and national numbers", "Planners at different levels must see consistent numbers"],
                  ["Intermittency", "a large share of series sell zero on most days", "Metric and model choices must survive zeros"]
                ]
              },

              { t: "h", text: "Framing the objective \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Objective", "What it does to the decisions"],
                rows: [
                  ["<strong>Naive</strong>", "Minimise MAPE averaged over series", "Undefined on zero-sales days, explosive on tiny ones, and it penalises over-forecasting more than under-forecasting, so models learn to forecast low. On intermittent retail data it is dominated by the slowest movers."],
                  ["<strong>Naive</strong>", "Minimise RMSE pooled over all series", "Dominated by a few high-volume products, and a single point forecast with no uncertainty \u2014 the replenishment system has nothing to set safety stock from."],
                  ["<strong>Solid</strong>", "Minimise WAPE at the decision level, track bias separately, and produce quantiles trained with pinball loss", "Stable under zeros, weighted by volume, and honest about direction. Quantiles give the ordering system the uncertainty it needs."],
                  ["<strong>Standout</strong>", "Minimise the downstream decision cost \u2014 stockouts against holding and waste \u2014 by forecasting the service-level quantile each product needs, coherent across the hierarchy, and proven by rolling-origin backtests against a seasonal-naive baseline", "Ties the forecast to money, lets perishable and durable products choose different quantiles, makes the numbers consistent for every planner, and refuses to ship a model that does not beat the simple answer."]
                ]
              },
              { t: "code", lang: "text", code:
                "Why WAPE, on three product-store series for one day:\n" +
                "  A: actual 100, forecast 90   abs err 10   APE  10%\n" +
                "  B: actual   2, forecast  4   abs err  2   APE 100%\n" +
                "  C: actual   0, forecast  1   abs err  1   APE undefined\n" +
                "\n" +
                "  MAPE (A, B only) = (10% + 100%) / 2           = 55%\n" +
                "  WAPE = (10 + 2 + 1) / (100 + 2 + 0) = 13/102  ~= 12.7%\n" +
                "\n" +
                "Which quantile to order to (newsvendor):\n" +
                "  lost margin per unit short  c_short = 4\n" +
                "  holding + waste per unit over c_over  = 1\n" +
                "  tau = c_short / (c_short + c_over) = 4/5 = 0.8  -> stock to the P80\n"
              },

              { t: "h", text: "Model choice \u2014 Naive, Solid, Standout" },
              { t: "table",
                headers: ["Tier", "Choice", "Buys / costs"],
                rows: [
                  ["<strong>Naive</strong>", "Seasonal naive: same weekday last week (or same week last year for annual patterns)", "Buys a mandatory baseline in minutes, and one that is surprisingly hard to beat on stable series. Costs you promotions, holidays that move, trends, and anything new. Every other model is judged by how much it improves on this."],
                  ["<strong>Naive</strong>", "A classical model per series (exponential smoothing or ARIMA) fitted 10<sup>7</sup> times", "Buys well-understood, interpretable forecasts for smooth, long-history series. Costs you intermittent and short series, any sharing of information across products, and an operational burden of millions of models to fit and monitor."],
                  ["<strong>Solid</strong>", "One global gradient-boosted model across all series, with lag and rolling features, calendar and holiday features, price and promotion, and hierarchy identifiers, trained with quantile objectives", "Buys learning across series (a new flavour borrows from its siblings), easy use of known-future covariates, and strong accuracy on tabular data. Costs careful feature construction to avoid leakage and one model per quantile or a multi-quantile setup."],
                  ["<strong>Standout</strong>", "Global GBDT as champion with a deep sequence model as challenger, explicit handling of intermittent series, attribute-based cold start, hierarchical reconciliation, and a planner override layer \u2014 all selected by rolling-origin backtest", "Buys the best of each approach where it wins, coherent numbers for planners, and a path for events no model has seen. Costs a real evaluation harness and the discipline to keep the simpler model when the complex one does not beat it on the backtest."]
                ]
              },

              { t: "h2", text: "Hierarchies and reconciliation" },
              { t: "ul", items: [
                "<strong>Bottom-up</strong> sums product\u2013store forecasts upward: coherent by construction, but noisy series produce noisy totals.",
                "<strong>Top-down</strong> forecasts the total and splits it by historical shares: stable totals, but local patterns (one store's promotion) are lost.",
                "<strong>Reconciliation</strong> forecasts every level independently, then adjusts all of them together so they add up while moving each as little as its reliability warrants. It usually beats both simple strategies.",
                "<strong>Quantiles do not add.</strong> The P90 of a region is not the sum of its stores' P90s \u2014 that sum is far too high, because stores rarely all have a bad day at once. Reconcile means, and derive aggregate quantiles from the aggregate's own distribution or from simulated joint samples."
              ] },

              { t: "h2", text: "Backtesting with a rolling origin" },
              { t: "code", lang: "text", code:
                "time  ------------------------------------------------------------>\n" +
                "fold 1  [ train ................ ] | forecast 14d |\n" +
                "fold 2  [ train ...................... ] | forecast 14d |\n" +
                "fold 3  [ train ............................ ] | forecast 14d |\n" +
                "fold 4  [ train .................................. ] | forecast 14d |\n" +
                "\n" +
                "rules: every feature uses only data before the fold's origin;\n" +
                "       known-future inputs (planned promos, prices, holidays) are allowed;\n" +
                "       include folds that cover holidays, promotions, and a past shock;\n" +
                "       report each model's gain over seasonal naive, per fold and per slice\n"
              },
              { t: "p", html: "The backtest is the forecasting version of a time-based split, repeated across seasons. It catches the classic leaks \u2014 a rolling mean that includes the target day, actual promotion lift used where only the plan was known, a holiday indicator computed from realised sales \u2014 because each fold reconstructs what was knowable at its origin. Leakage patterns in general: <a href='#/data/correctness/leakage-taxonomy'>leakage taxonomy</a>." },

              { t: "h", text: "High-level design" },
              { t: "code", lang: "text", code:
                "NIGHTLY BATCH                                           CONSUMERS\n" +
                "-------------------------------------------------       ---------------------\n" +
                "sales + stock availability + prices + promos plan\n" +
                "        |\n" +
                "        v\n" +
                "censoring: mask / impute stockout days\n" +
                "        |\n" +
                "        v\n" +
                "feature build AS OF forecast origin\n" +
                "  lags, rolling stats, calendar, holidays,\n" +
                "  price, promo, weather, hierarchy ids\n" +
                "        |\n" +
                "        v\n" +
                "GLOBAL MODELS: champion GBDT + challenger    ---> backtest harness\n" +
                "  quantiles P50 / P80 / P95                        (rolling origin,\n" +
                "  + intermittent-demand handling                    vs seasonal naive)\n" +
                "  + cold-start by product attributes\n" +
                "        |\n" +
                "        v\n" +
                "HIERARCHICAL RECONCILIATION\n" +
                "        |\n" +
                "        v\n" +
                "planner overrides (logged) ------------------------->  replenishment orders\n" +
                "        |                                               staffing plans\n" +
                "        v                                               planning dashboards\n" +
                "forecast store --> accuracy + bias monitors per slice\n"
              },
              { t: "p", html: "Two boxes are the ones teams skip. <strong>Censoring before feature build</strong> keeps stockouts from masquerading as low demand. <strong>Logged planner overrides</strong> turn human judgement into data: you can measure whether overrides improve accuracy (often for known events, rarely for routine days), and you can train on them. The batch pipeline itself \u2014 scheduling, backfills, and data quality checks \u2014 is the kind of work <a href='../data-eng-academy/index.html'>Cascade</a> covers in depth." },

              { t: "h", text: "Data, features, and the label" },
              { t: "ul", items: [
                "<strong>The label is sales, but the target is demand.</strong> Join stock availability so you know which days were censored.",
                "<strong>Features:</strong> lags at the horizon and beyond (never shorter than the horizon), rolling means and volatility, day of week, holidays including ones that move each year, paydays, price and price relative to the category, promotion type and depth, weather, local events, and identifiers for product, store, category, and region.",
                "<strong>Intermittent demand:</strong> series that are mostly zero need either a two-part model (will it sell, and how many if so) or features that make the zero pattern learnable. Point forecasts of 0.3 units are fine as expectations and useless as orders \u2014 quantiles matter more here.",
                "<strong>Cold start:</strong> a new product has no history, so borrow from similar products by attributes (category, price band, brand) and from launch curves of past introductions; a new store borrows from similar stores. The general pattern is in <a href='#/rank/dynamics/cold-start'>cold start</a>.",
                "<strong>Promotions and cannibalisation:</strong> a discount on one product lifts it and depresses its substitutes. Category-level features help the model see the net effect."
              ] },
              { t: "note", variant: "trap", html: "<strong>Stockouts start a spiral if you train on raw sales.</strong> A product sells out, recorded sales drop, the next forecast is lower, the next order is smaller, it sells out sooner, and recorded sales drop again. The model is accurately forecasting sales that your own forecasts constrained. Mask or impute stockout days using availability data, and monitor the share of censored days per product \u2014 a rising share is a warning that the loop has started." },

              { t: "h", text: "Evaluation and the deep dives you will be pushed on" },
              { t: "ul", items: [
                "<strong>Offline:</strong> WAPE and bias at the decision level, pinball loss and quantile coverage for the service-level quantiles, and the improvement over seasonal naive, all from rolling-origin backtests and sliced by velocity class (fast, slow, intermittent), category, and horizon.",
                "<strong>Per level of the hierarchy:</strong> report accuracy for product\u2013store, store, category, and region separately; a model can win at the bottom and lose at the top.",
                "<strong>Online:</strong> stockout rate, waste and markdowns for perishables, inventory holding, and how often planners override. Run new models in shadow mode alongside the incumbent before letting them drive orders.",
                "<strong>Decision metrics beat forecast metrics.</strong> A small WAPE improvement that does not change orders is worth nothing; a quantile that cuts waste without raising stockouts is the real win."
              ] },
              { t: "ol", items: [
                "<strong>Shocks.</strong> When demand shifts abruptly, models trained on years of history lag badly. Detect the regime change with monitors on bias per slice, shorten training windows or up-weight recent data, widen quantiles, and lean on planner overrides until the model catches up \u2014 see <a href='#/ops/monitoring/drift-and-skew'>drift and skew</a> and <a href='#/ops/monitoring/retraining-triggers'>retraining triggers</a>.",
                "<strong>GBDT versus deep models.</strong> Deep sequence models can help with many related series, long histories, and complex seasonal interactions; gradient-boosted models often win on tabular data with rich known-future covariates and are cheaper to run. Let the backtest decide, and keep the simpler one on a tie.",
                "<strong>Horizon and granularity.</strong> Forecasting daily for a weekly decision adds noise you then have to aggregate away; forecasting 90 days ahead for a 7-day lead time spends effort on accuracy no decision uses."
              ] },
              { t: "cue", html: "The sentence that earns credit: \u201cI'd pick the horizon, granularity, and quantile from the decision \u2014 ordering to the P80 if a lost sale costs four times an overstocked unit \u2014 train one global model across series with known-future promotions and holidays, mask stockout days so censored sales don't drag the forecast down, reconcile the hierarchy so planners see consistent numbers, and prove it beats seasonal naive on a rolling-origin backtest, using WAPE rather than MAPE because most series are intermittent.\u201d" },

              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Bar", "On this problem, that means"],
                rows: [
                  ["<strong>Mid</strong>", "Builds a time-series model with lags and calendar features, evaluates with MAPE or RMSE on a holdout period, and outputs a point forecast. May fit a model per series without considering scale."],
                  ["<strong>Senior</strong>", "Chooses a global model across series, uses WAPE and pinball loss with a seasonal-naive baseline, backtests with rolling origins and point-in-time features, handles intermittent demand and cold start, and produces quantiles tied to service levels."],
                  ["<strong>Staff</strong>", "Links forecast to decision cost explicitly, spots censored demand and the stockout spiral, designs hierarchical reconciliation and knows quantiles do not add, builds an override-and-shadow process, and has a plan for shocks rather than assuming stationarity."]
                ]
              },
              { t: "quiz", id: "mlcase-forecast" },
              { t: "note", variant: "key", html: "<strong>A forecast is a decision input, so let the decision choose everything.</strong> Horizon from lead time, granularity from where the decision is made, quantile from the cost ratio; one global model across series; stockout days masked so censored sales do not drag demand down; a hierarchy that adds up; and a rolling-origin backtest showing you beat seasonal naive \u2014 or you ship seasonal naive." }
            ]
          }
        ]
      }
    ]
  };
})();
