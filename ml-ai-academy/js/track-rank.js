/* =====================================================================
   SYNAPSE · Search, Ranking & Recs
   window.TRACKS.rank — modules: retrieval / ranking / dynamics

   Self-contained: this file registers its own widgets (rankFunnel,
   rankBandit), its own quizzes (rank-retrieval, rank-ranking,
   rank-dynamics) and its own track data.
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

  function pct(x, digits) { return (x * 100).toFixed(digits == null ? 0 : digits) + "%"; }

  var Widgets = {};

  /* ==================================================================
     1. rankFunnel — "Budget the funnel"
     Deterministic: output is a pure function of the four controls.
     Illustrative cost and recall model, not measurements.
  ================================================================== */
  var FUNNEL_ANN_MS = 8;
  var FUNNEL_LIGHT_MS = 0.004;     /* per candidate, batched */
  var FUNNEL_RERANK_MS = 3;
  var FUNNEL_OVERHEAD_MS = 10;     /* network, feature fetch, serialization */
  var FUNNEL_RET_SCALE = 500;
  var FUNNEL_LIGHT_SCALE = 60;
  var FUNNEL_RERANK_RECALL = 0.98;
  /* a pricier heavy ranker orders the final ten better */
  var FUNNEL_HEAVY_QUALITY = { "0.02": 0.90, "0.05": 0.95, "0.2": 0.98 };

  function funnelState(kRet, kLight, heavyMs, budget) {
    var rRet = 1 - Math.exp(-kRet / FUNNEL_RET_SCALE);
    var rLight = 1 - Math.exp(-kLight / FUNNEL_LIGHT_SCALE);
    var rHeavy = FUNNEL_HEAVY_QUALITY[String(heavyMs)] || 0.95;
    var stages = [
      { name: "Retrieval", kept: kRet, ms: FUNNEL_ANN_MS, recall: rRet, note: "ANN over the corpus" },
      { name: "Light ranker", kept: kLight, ms: kRet * FUNNEL_LIGHT_MS, recall: rLight, note: "scores " + kRet + " items" },
      { name: "Heavy ranker", kept: 10, ms: kLight * heavyMs, recall: rHeavy, note: "scores " + kLight + " items" },
      { name: "Re-rank", kept: 10, ms: FUNNEL_RERANK_MS, recall: FUNNEL_RERANK_RECALL, note: "rules, diversity" },
      { name: "Overhead", kept: null, ms: FUNNEL_OVERHEAD_MS, recall: null, note: "network, features" }
    ];
    var total = 0, e2e = 1, i;
    for (i = 0; i < stages.length; i++) {
      total += stages[i].ms;
      if (stages[i].recall != null) e2e *= stages[i].recall;
    }
    var verdict, tone;
    if (total > budget) {
      tone = "over";
      verdict = "Over budget by " + Math.round(total - budget) + " ms. The heavy ranker's cost is per item, so either keep fewer candidates after the light ranker or buy a cheaper heavy model — and say which recall you are giving up to do it.";
    } else if (e2e < 0.7) {
      tone = "starved";
      verdict = "Recall-starved: end-to-end recall is only " + pct(e2e) + " while " + Math.round(budget - total) + " ms of budget sits unused. Every stage multiplies, so the narrowest early stage caps everything after it — widen it before tuning the ranker.";
    } else if (total < budget * 0.5 && e2e < 0.85) {
      tone = "headroom";
      verdict = "Balanced, with headroom: inside budget at " + pct(e2e) + " recall, but more than half the budget is idle. Spending it on more retrieval or light-ranker candidates is usually the cheapest recall you will ever buy.";
    } else {
      tone = "balanced";
      verdict = "Balanced: " + pct(e2e) + " end-to-end recall inside the " + budget + " ms budget. Further candidates buy little because the recall curves are already flattening — this is roughly where a production funnel settles.";
    }
    return { stages: stages, total: total, e2e: e2e, verdict: verdict, tone: tone };
  }

  Widgets.rankFunnel = function (mount) {
    shell(mount, "budget", "Budget the funnel",
      "Choose how many candidates survive retrieval and the light ranker, how expensive the heavy ranker is per item, and the latency budget. Each stage's recall saturates as it keeps more; end-to-end recall is the product of the stages. Illustrative model, real trade-off.");

    var kRet = 1000, kLight = 200, heavyMs = 0.05, budget = 100;

    var retIn = h("input", { type: "range", min: "100", max: "5000", step: "100", value: String(kRet) });
    var lightIn = h("input", { type: "range", min: "20", max: "1000", step: "10", value: String(kLight) });
    var retVal = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, String(kRet));
    var lightVal = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, String(kLight));

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var st = funnelState(kRet, kLight, heavyMs, budget), i, s;
      retVal.textContent = String(kRet);
      lightVal.textContent = String(kLight);
      var scale = Math.max(budget, st.total);

      clear(stage);
      for (i = 0; i < st.stages.length; i++) {
        s = st.stages[i];
        var fill = s.name === "Heavy ranker" ? "var(--rose)" : s.name === "Overhead" ? "var(--text-dim)" : "var(--accent)";
        var bar = h("i", {
          style: "display:block;height:10px;border-radius:6px;background:" + fill +
            ";width:" + Math.max(1, Math.round((s.ms / scale) * 100)) + "%"
        });
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:minmax(110px,1.2fr) minmax(70px,2fr) minmax(150px,1.4fr);" +
            "gap:12px;align-items:center;padding:7px 0"
        },
          h("span", { style: "font-size:0.84rem;line-height:1.35" },
            h("b", {}, s.name),
            h("span", { style: "display:block;font-size:0.74rem;color:var(--text-dim)" },
              (s.kept != null ? "keeps " + s.kept + " · " : "") + s.note)),
          h("span", { style: "display:block;background:var(--surface-solid);border-radius:6px;overflow:hidden" }, bar),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text)" },
            s.ms.toFixed(1) + " ms" + (s.recall != null ? " · recall " + pct(s.recall) : ""))
        ));
      }
      var over = st.total > budget;
      stage.appendChild(h("div", {
        style: "margin-top:6px;padding:8px 10px;border-left:3px " + (over ? "solid var(--rose)" : "dashed var(--line-strong)") +
          ";font-size:0.82rem;color:var(--text)"
      }, "Total " + st.total.toFixed(1) + " ms of a " + budget + " ms budget"));

      clear(readout);
      readout.appendChild(ro("end-to-end recall", pct(st.e2e, 1)));
      readout.appendChild(ro("latency", st.total.toFixed(1) + " / " + budget + " ms"));
      readout.appendChild(ro("heavy ranker", (kLight * heavyMs).toFixed(1) + " ms"));
      readout.appendChild(ro("verdict", st.tone === "over" ? "over budget" : st.tone === "starved" ? "recall-starved" : "balanced"));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, st.verdict));
    }

    retIn.addEventListener("input", function () {
      kRet = parseInt(retIn.value, 10) || 100;
      if (kLight > kRet) { kLight = kRet; lightIn.value = String(kLight); }
      paint();
    });
    lightIn.addEventListener("input", function () {
      kLight = Math.min(parseInt(lightIn.value, 10) || 20, kRet);
      lightIn.value = String(kLight);
      paint();
    });

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "After retrieval ", retIn, retVal),
      h("label", { class: "w-field" }, "After light ranker ", lightIn, lightVal)
    ));
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[0.02, "Heavy 0.02 ms/item"], [0.05, "0.05 ms/item"], [0.2, "0.2 ms/item"]], 1, function (v) { heavyMs = v; paint(); }),
      segment([[50, "50 ms"], [100, "100 ms"], [200, "200 ms"]], 1, function (v) { budget = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. rankBandit — "Explore or exploit"
     Deterministic: mulberry32 with a fixed seed, reseeded on Reset and
     on every policy change. Three incumbents carry logged history; the
     new item (the true best arm) starts with none.
  ================================================================== */
  var BANDIT_SEED = 20261028;
  var BANDIT_ARMS = [
    { name: "Evergreen", p: 0.03, histN: 200, histC: 6 },
    { name: "Popular", p: 0.05, histN: 200, histC: 10 },
    { name: "Trending", p: 0.045, histN: 200, histC: 9 },
    { name: "New item", p: 0.08, histN: 0, histC: 0 }
  ];
  var BANDIT_BEST = 3;
  var BANDIT_HIST_TOTAL = 600;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rnd) {
    var u = Math.max(rnd(), 1e-9), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function argmaxTie(vals, rnd) {
    var best = -Infinity, ids = [], i;
    for (i = 0; i < vals.length; i++) {
      if (vals[i] > best + 1e-12) { best = vals[i]; ids = [i]; }
      else if (Math.abs(vals[i] - best) <= 1e-12) ids.push(i);
    }
    if (ids.length === 1) return ids[0];
    return ids[Math.floor(rnd() * ids.length) % ids.length];
  }

  function banditFresh() {
    return { rnd: mulberry32(BANDIT_SEED), n: [0, 0, 0, 0], c: [0, 0, 0, 0], t: 0 };
  }

  function banditEstimate(s, i) {
    var N = BANDIT_ARMS[i].histN + s.n[i];
    return N ? (BANDIT_ARMS[i].histC + s.c[i]) / N : 0;
  }

  function banditPick(s, policy) {
    var v = [], i, N, m, a, b, tot;
    if (policy === "eps" && s.rnd() < 0.1) return Math.floor(s.rnd() * 4) % 4;
    for (i = 0; i < 4; i++) {
      if (policy === "ucb") {
        N = BANDIT_ARMS[i].histN + s.n[i];
        if (!N) { v.push(1e9); continue; }
        m = banditEstimate(s, i);
        v.push(m + Math.sqrt(2 * Math.max(m, 0.02) * Math.log(s.t + 1 + BANDIT_HIST_TOTAL) / N));
      } else if (policy === "ts") {
        a = 1 + BANDIT_ARMS[i].histC + s.c[i];
        b = 1 + BANDIT_ARMS[i].histN + s.n[i] - BANDIT_ARMS[i].histC - s.c[i];
        tot = a + b;
        v.push(a / tot + Math.sqrt(a * b / (tot * tot * (tot + 1))) * gaussian(s.rnd));
      } else {
        v.push(banditEstimate(s, i));
      }
    }
    return argmaxTie(v, s.rnd);
  }

  function banditRun(s, policy, rounds) {
    for (var r = 0; r < rounds; r++) {
      var arm = banditPick(s, policy);
      s.t++;
      s.n[arm]++;
      if (s.rnd() < BANDIT_ARMS[arm].p) s.c[arm]++;
    }
  }

  var BANDIT_POLICY_NOTE = {
    greedy: "Greedy always serves the best-looking arm. The new item has no history, so its estimate is zero and it never gets a single impression.",
    eps: "ε-greedy spends 10% of traffic uniformly at random, so the new item gets about 2.5% of rounds — enough to discover it eventually, slowly and noisily.",
    ucb: "UCB adds an uncertainty bonus that is largest for arms with few observations, so an unseen item is tried first and kept only if it earns its keep.",
    ts: "Thompson sampling draws a plausible click rate for each arm from its posterior and serves the highest draw; exploration fades on its own as evidence piles up."
  };

  Widgets.rankBandit = function (mount) {
    shell(mount, "simulator", "Explore or exploit",
      "Four arms, fixed true click rates the policy cannot see. The three incumbents start with 200 logged impressions each; the new item starts with none. Pick a policy and run rounds. Seeded, so every run of a policy is reproducible.");

    var policy = "greedy";
    var s = banditFresh();
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var i, clicks = 0, expected = 0, maxN = 1;
      for (i = 0; i < 4; i++) {
        clicks += s.c[i];
        expected += s.n[i] * BANDIT_ARMS[i].p;
        if (s.n[i] > maxN) maxN = s.n[i];
      }
      var bestExpected = s.t * BANDIT_ARMS[BANDIT_BEST].p;
      var regret = bestExpected - expected;
      var share = s.t ? s.n[BANDIT_BEST] / s.t : 0;

      clear(stage);
      for (i = 0; i < 4; i++) {
        var arm = BANDIT_ARMS[i];
        var bar = h("i", {
          style: "display:block;height:10px;border-radius:6px;background:" +
            (i === BANDIT_BEST ? "var(--lime)" : "var(--accent)") +
            ";width:" + (s.n[i] ? Math.max(1, Math.round((s.n[i] / maxN) * 100)) : 0) + "%"
        });
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:minmax(96px,1fr) minmax(70px,2fr) minmax(170px,1.6fr);" +
            "gap:12px;align-items:center;padding:7px 0"
        },
          h("span", { style: "font-size:0.84rem;color:" + (s.n[i] ? "var(--text)" : "var(--text-dim)") },
            h("b", {}, arm.name),
            h("span", { style: "display:block;font-size:0.74rem;color:var(--text-dim)" }, "true " + pct(arm.p, 1))),
          h("span", {
            style: "display:block;background:var(--surface-solid);border-radius:6px;overflow:hidden;border:1px " +
              (s.n[i] ? "solid transparent" : "dashed var(--line-strong)")
          }, bar),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text)" },
            s.n[i] + " pulls · CTR " + (s.n[i] ? pct(s.c[i] / s.n[i], 1) : "—"))
        ));
      }

      var verdict;
      if (!s.t) verdict = "Reset to zero rounds. Press Run 500 rounds to start this policy from the same seed.";
      else if (share < 0.05) verdict = "Stuck exploiting an incumbent: the best arm got " + pct(share) + " of traffic. Without deliberate exploration a new item never earns the data it would need to win.";
      else if (share < 0.5) verdict = "Still learning: the best arm has " + pct(share) + " of traffic. Exploration is happening, but slowly — run more rounds and watch the share climb.";
      else verdict = "Found the new item: " + pct(share) + " of traffic goes to the best arm, so the exploration cost is mostly paid. Regret now grows only as fast as the policy keeps exploring.";

      clear(readout);
      readout.appendChild(ro("rounds", s.t));
      readout.appendChild(ro("clicks", clicks));
      readout.appendChild(ro("always-best expects", bestExpected.toFixed(1)));
      readout.appendChild(ro("regret", regret.toFixed(1) + " clicks"));
      readout.appendChild(ro("best-arm share", pct(share)));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, BANDIT_POLICY_NOTE[policy] + " " + verdict));
    }

    var runBtn = h("button", { type: "button", class: "w-btn primary" }, "Run 500 rounds");
    var resetBtn = h("button", { type: "button", class: "w-btn ghost" }, "Reset");
    runBtn.addEventListener("click", function () { banditRun(s, policy, 500); paint(); });
    resetBtn.addEventListener("click", function () { s = banditFresh(); paint(); });

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["greedy", "Greedy"], ["eps", "ε-greedy 10%"], ["ucb", "UCB"], ["ts", "Thompson"]], 0, function (v) {
        policy = v;
        s = banditFresh();
        banditRun(s, policy, 500);
        paint();
      }),
      runBtn,
      resetBtn
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    banditRun(s, policy, 500);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     3. Quizzes — every `answer` is a ZERO-BASED index, hand-counted
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "rank-retrieval": {
      title: "Retrieval checkpoint",
      sub: "Funnel budgets, two-tower training, and approximate nearest-neighbour indexes.",
      questions: [
        {
          q: "A four-stage funnel has stage recalls of 0.90, 0.95, 0.95 and 0.98. Roughly what is the end-to-end recall?",
          options: [
            "0.95 — the average of the stages",
            "0.98 — the best stage sets the ceiling",
            "About 0.80 — the stage recalls multiply",
            "0.90 — the worst stage sets the floor"
          ],
          answer: 2,
          explain: "An item reaches the user only if every stage keeps it, so the recalls multiply: 0.90 × 0.95 × 0.95 × 0.98 ≈ 0.80. The weakest stage is an upper bound, not the answer. This is why a small recall loss at each of four stages adds up to a large loss overall."
        },
        {
          q: "Why does a two-tower model trained with in-batch negatives need a logQ correction?",
          options: [
            "Popular items are negatives in most batches, so they get buried unless log q(item) is subtracted",
            "The dot product saturates for long vectors, so every logit must be rescaled by the log of its norm",
            "In-batch negatives are guaranteed true negatives, so their share of the loss must be scaled down by a log factor",
            "The query tower trains faster than the item tower, so its gradients need a logarithmic learning-rate schedule"
          ],
          answer: 0,
          explain: "Negatives drawn from the batch follow the interaction distribution, so a popular item appears as someone else's negative constantly. Without a correction the model learns that popular items are bad. Subtracting log q(item), the item's sampling probability, from its logit removes that bias."
        },
        {
          q: "An IVF index has 4,096 partitions and you set nprobe to 32. What happens if you raise nprobe to 128?",
          options: [
            "Memory use roughly quadruples, because four times as many partitions must be held in RAM at query time",
            "Recall falls because more partitions add noise to the candidate list",
            "The index must be rebuilt with more centroids before it can answer",
            "Recall and latency both rise, since about four times as many vectors are scanned"
          ],
          answer: 3,
          explain: "nprobe is a query-time dial: it sets how many of the closest partitions are scanned. Going from 32 to 128 scans roughly four times as many vectors, which recovers neighbours that sat just across a partition boundary and costs proportionally more compute. Memory and the index itself are unchanged."
        },
        {
          q: "You have 100 million 768-dimensional float32 embeddings. Product quantization encodes each into 96 one-byte codes. Approximately how much memory do the vectors need before and after?",
          options: [
            "About 77 GB before and 9.6 GB after",
            "About 307 GB before and 9.6 GB after",
            "About 307 GB before and 77 GB after",
            "About 30 GB before and 1 GB after"
          ],
          answer: 1,
          explain: "Full precision is 768 × 4 bytes = 3,072 bytes per vector, so 100 million vectors need about 307 GB. With 96 one-byte codes each vector is 96 bytes, about 9.6 GB in total — a 32× reduction. The codebooks themselves are tiny by comparison, and the price is approximate distances that usually need a re-scoring pass."
        },
        {
          q: "A marketplace filters ANN results to 'in stock, ships to your country' after the search, and some queries return only two items. What is the most likely cause?",
          options: [
            "The embedding dimension is too low to separate in-stock items from out-of-stock ones",
            "The HNSW graph has too many links per node, so the walk ends before reaching matches",
            "Post-filtering a fixed top-k discards most neighbours when few items pass the filter",
            "The quantization codebook was trained on the wrong data"
          ],
          answer: 2,
          explain: "Post-filtering asks for k neighbours and then throws away the ones that fail the filter. When only a few percent of the catalogue passes, almost all of the k disappear. The fixes are over-fetching, partitioning the index by the filter attribute, or an index that applies the filter during traversal."
        },
        {
          q: "Which statement about two-tower retrieval is correct?",
          options: [
            "Item embeddings have to be recomputed per request, because each item vector depends on the requesting user",
            "The towers are trained separately and joined only at serving time",
            "Two-tower models capture user-by-item cross features as well as a heavy ranker does",
            "Item vectors can be precomputed and indexed, because the item tower never sees user features"
          ],
          answer: 3,
          explain: "The towers share a loss but not their inputs, so the item tower's output depends only on the item. That is what lets you embed the whole catalogue offline and serve retrieval as one query-tower pass plus an ANN lookup. The same independence is why a single dot product cannot express rich user-by-item interactions."
        }
      ]
    },

    "rank-ranking": {
      title: "Ranking checkpoint",
      sub: "Learning-to-rank losses, multi-objective value models, and the re-ranking layer.",
      questions: [
        {
          q: "What distinguishes a listwise learning-to-rank objective from a pointwise one?",
          options: [
            "Listwise objectives only work with gradient-boosted trees",
            "Listwise losses score the whole ordering, so mistakes near the top cost more",
            "Listwise objectives predict a calibrated probability for each item independently",
            "Listwise objectives need graded human relevance labels and cannot be trained on logged clicks at all"
          ],
          answer: 1,
          explain: "A pointwise loss treats each item as an independent classification or regression example and ignores where it lands. A listwise loss is defined over the ordering of a list, often weighting mistakes by how much they change a position-discounted metric such as NDCG. Both families can use clicks, and both can be trained with trees or neural networks."
        },
        {
          q: "A ranker is trained on logged clicks, and the item in position 1 is clicked far more than an equally relevant item in position 6. What is the standard training fix?",
          options: [
            "Drop every impression below position 3 so training only contains highly visible slots",
            "Train only on items the user scrolled past without clicking",
            "Multiply every label by the item's position",
            "Learn a position term in training and fix it to a constant at serving"
          ],
          answer: 3,
          explain: "Position bias means the click label mixes relevance with how visible the slot was. Giving the model position as a separate input, or a shallow position tower, lets that term absorb the visibility effect during training. At serving every candidate gets the same position value, so the ranking reflects relevance alone."
        },
        {
          q: "A feed scores items as 1.0·p(click) + 4.0·p(like) − 20·p(hide). Why must each head be calibrated?",
          options: [
            "The weights only act as exchange rates if each head is an honest probability",
            "Because uncalibrated heads cannot be trained jointly inside one shared multi-task network",
            "Because calibration raises the area under the ROC curve of each head",
            "Because the value model has to sum to exactly one"
          ],
          answer: 0,
          explain: "The weights say how many clicks one hide is worth, which is only meaningful if 0.02 from the hide head means a 2% chance of a hide. If one head drifts to over-predict, it silently gains influence in every ranking without anyone changing a weight. Calibration leaves the per-head ordering, and so AUC, unchanged."
        },
        {
          q: "In maximal marginal relevance, score = λ·rel(i) − (1−λ)·max similarity to already-selected items. What happens as λ approaches 0?",
          options: [
            "The list becomes ordered purely by relevance, exactly as the heavy ranker scored it",
            "Items are selected at random",
            "Picks are driven almost entirely by dissimilarity to items already chosen",
            "The algorithm stops after the first item"
          ],
          answer: 2,
          explain: "λ is the weight on relevance and 1−λ the weight on redundancy. At λ = 1 MMR reduces to a plain relevance sort, and as λ approaches 0 the next pick is whatever is least similar to the existing list. Production values sit in between and are tuned online, because the right trade depends on the surface."
        },
        {
          q: "When does a gradient-boosted ranker tend to beat a deep ranker?",
          options: [
            "When features are mostly dense tabular signals and training data is modest",
            "When the main inputs are raw text and image pixels",
            "When the model must learn embeddings for hundreds of millions of sparse IDs",
            "When the task needs one shared network that serves several surfaces"
          ],
          answer: 0,
          explain: "Boosted trees are strong, fast and robust on a few hundred hand-built numeric features, and they need little tuning. Deep rankers pull ahead when the signal lives in high-cardinality IDs, sequences or raw content that needs learned representations, and when there is enough data to train them. Many systems use both, with tree outputs or embeddings feeding one another."
        },
        {
          q: "Business rules in the re-ranking layer are applied in sequence. Why does their order matter?",
          options: [
            "Rules run in parallel, so order only affects latency",
            "Order matters only for ads, never for organic items",
            "Rules must all run before the ranker, otherwise the model cannot learn to respect them",
            "Early constraints shrink the pool later rules see, so a new order gives a new page"
          ],
          answer: 3,
          explain: "Each rule edits the list the next one sees. Filtering ineligible items, then deduplicating, then applying diversity caps, then inserting ads gives a different page than inserting ads first. Writing the order down, and measuring the relevance each rule costs, keeps the layer explainable."
        }
      ]
    },

    "rank-dynamics": {
      title: "Dynamics checkpoint",
      sub: "Cold start, exploration with bandits, feedback loops, and exposure fairness.",
      questions: [
        {
          q: "A new item has no interaction history. Which signal can the ranker use from the very first request?",
          options: [
            "Its collaborative-filtering embedding from the latest nightly training run",
            "Its observed click-through rate",
            "Its watch-time distribution across users",
            "A content embedding computed from its text, image or audio"
          ],
          answer: 3,
          explain: "Collaborative embeddings, CTR and watch-time all come from interactions, which a new item does not have yet. A content embedding is computed from the item itself at publish time, so it can place the item near similar items immediately. Creator priors and exploration boosts then collect the interactions that let behavioural signals take over."
        },
        {
          q: "Why does a purely greedy policy struggle with a genuinely better new item?",
          options: [
            "Greedy policies are too slow to compute at serving time",
            "With no evidence its estimate stays at zero, so greedy never serves it and never learns",
            "Greedy policies overreact to every single click and keep switching between arms every round",
            "Greedy policies cannot use logged history from incumbent items"
          ],
          answer: 1,
          explain: "Greedy always serves the arm with the highest current estimate. An item with no impressions has no evidence in its favour, so it never wins, and because it is never shown its estimate never moves. Exploration — random, optimistic, or posterior-sampled — exists to break that loop."
        },
        {
          q: "What does an upper confidence bound policy add to each arm's estimated reward?",
          options: [
            "A fixed 10% chance of choosing at random",
            "A penalty proportional to how many times the arm has already been shown to users",
            "A bonus that shrinks as the arm gathers observations",
            "A random draw from the arm's posterior distribution"
          ],
          answer: 2,
          explain: "UCB serves the arm whose optimistic estimate — the mean plus an uncertainty bonus — is highest. The bonus grows slowly with total rounds and shrinks with the arm's own count, so rarely-tried arms get tried and well-measured ones are judged on their mean. A random draw from the posterior is Thompson sampling, and a fixed random rate is ε-greedy."
        },
        {
          q: "Why must a production bandit log the propensity of each action it takes?",
          options: [
            "So new policies can be scored offline with inverse propensity weighting",
            "So the serving tier can cache the most likely action",
            "So the model can skip retraining when click rates are stable",
            "So users can be shown, next to each recommendation, how likely the system was to pick it"
          ],
          answer: 0,
          explain: "Off-policy evaluation reweights each logged reward by the ratio of the new policy's probability of that action to the logging policy's. Without the logged probability the ratio cannot be computed, and you are back to running an online experiment for every candidate policy. It is a single extra column, and it is very hard to recover after the fact."
        },
        {
          q: "A recommender's training data comes only from items it already chose to show. What is the long-run risk?",
          options: [
            "Training gets faster every cycle because the logged dataset keeps shrinking over time",
            "Calibration improves automatically as the system matures",
            "The head gains ever more exposure while the tail is never measured",
            "The embedding dimension has to grow every cycle"
          ],
          answer: 2,
          explain: "Each model decides what gets shown, which decides the next model's labels. Items that start ahead collect exposure and evidence, and items that start behind are never measured. Exploration traffic, propensity weighting and exposure metrics are the standard counterweights."
        },
        {
          q: "Which metric most directly measures how unevenly exposure is spread across creators?",
          options: [
            "NDCG at 10",
            "The Gini coefficient of impressions per creator",
            "Mean reciprocal rank",
            "Click-through rate"
          ],
          answer: 1,
          explain: "The Gini coefficient summarizes inequality in a distribution: 0 means every creator gets equal impressions, and values near 1 mean a few get nearly all of them. NDCG, MRR and CTR measure how well users are served, not how exposure is shared. Track Gini next to catalogue coverage and novelty so the trade-off with relevance is visible."
        }
      ]
    }
  });

  /* ==================================================================
     4. Module: retrieval
  ================================================================== */
  var MOD_RETRIEVAL = {
    id: "retrieval",
    name: "Retrieval",
    icon: "share",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "ranking-funnel",
        title: "The ranking funnel, stage by stage",
        summary: "From a hundred million items to ten slots: candidate counts, latency budgets and recall budgets for each stage, and why recall multiplies.",
        minutes: 10,
        tags: ["retrieval", "architecture", "latency"],
        blocks: [
          { t: "p", html: "Every large search or recommendation system has the same shape: a funnel that throws away candidates in stages, each stage more expensive per item than the last and each looking at far fewer items. <a href='#/mlsd/serving/retrieval-ranking'>Two-stage retrieval</a> gives the interview-level overview. This lesson goes one level down: how many stages, how many candidates each keeps, how many milliseconds each may spend, and how much recall each is allowed to lose." },
          {
            t: "code", lang: "text", code:
              "  corpus              ~10^8 items\n" +
              "     |  RETRIEVAL       several sources, ANN + heuristics     ~5-15 ms\n" +
              "     v\n" +
              "  candidates          ~10^3\n" +
              "     |  LIGHT RANKER    small model, cheap features            ~5-15 ms\n" +
              "     v\n" +
              "  short list          ~10^2\n" +
              "     |  HEAVY RANKER    big model, cross features              ~20-60 ms\n" +
              "     v\n" +
              "  ordered             ~10^1\n" +
              "     |  RE-RANK         rules, diversity, ads, policy          ~2-5 ms\n" +
              "     v\n" +
              "  response            10 slots\n" +
              "\n" +
              "(typical orders of magnitude, not a specification)"
          },
          { t: "h", text: "Why each stage exists" },
          { t: "p", html: "The funnel is an argument about cost per item. The heavy ranker might spend 50 microseconds on each candidate once you count feature lookups and the forward pass. Over a hundred items that is 5 ms; over a hundred million it is over an hour. Each stage exists so that the next, more accurate stage only pays for items with a real chance of reaching the page." },
          {
            t: "table",
            headers: ["Stage", "Optimizes", "Typical model", "Measured by"],
            rows: [
              ["Retrieval", "Recall: do not lose anything the ranker would want", "Two-tower + ANN, co-visitation, follows, trending", "Recall@K against the ranker's judgement or labels"],
              ["Light ranker", "Recall at a much smaller K, cheaply", "Small MLP or distilled model on cached features", "Agreement with the heavy ranker's top set"],
              ["Heavy ranker", "Precision at the top", "Large multi-task network with cross features", "NDCG, calibrated heads, online engagement"],
              ["Re-rank", "Page-level goals and hard constraints", "Rules, MMR, quotas, ad auction", "Diversity, policy compliance, revenue"]
            ]
          },
          { t: "h", text: "Recall multiplies" },
          { t: "p", html: "An item reaches the user only if every stage keeps it. So end-to-end recall is the <strong>product</strong> of stage recalls, not their average and not their minimum. Four stages that each look respectable can add up to a funnel that loses a quarter of what it should have shown." },
          {
            t: "code", lang: "text", code:
              "retrieval     0.92\n" +
              "light ranker  0.94\n" +
              "heavy ranker  0.95   (top-10 overlap with ideal)\n" +
              "re-rank       0.98   (rules drop a few good items)\n" +
              "\n" +
              "end-to-end  = 0.92 * 0.94 * 0.95 * 0.98  ~= 0.81"
          },
          { t: "note", variant: "tip", html: "Allocate a recall budget the way you allocate a latency budget. If the product needs 0.85 end to end and the heavy ranker realistically gets 0.95, the earlier stages together may lose no more than about 10%. That one sentence turns \"how big should K be?\" from a guess into a derivation." },
          { t: "h", text: "Several sources, one candidate set" },
          { t: "p", html: "Retrieval is rarely one index. A typical system unions four to eight sources — embedding neighbours, items co-engaged with the user's recent history, followed creators, trending in the user's region, an exploration pool — each with its own quota. Merging them needs three decisions you should state out loud." },
          {
            t: "ul", items: [
              "<strong>Quotas</strong> — a fixed share per source, so one very confident source cannot crowd out the others. Tune the shares online.",
              "<strong>Deduplication</strong> — the same item from two sources is one candidate, but keep <em>which</em> sources found it as a feature; agreement between sources is a strong signal.",
              "<strong>Score comparability</strong> — raw scores from different sources are not on the same scale, which is exactly why the light ranker exists: it re-scores the union on one scale."
            ]
          },
          { t: "widget", id: "rankFunnel" },
          { t: "p", html: "Notice in the widget that the heavy ranker dominates latency, while the earliest stage dominates recall. That asymmetry is the whole design problem: the cheapest place to buy recall is early, and the cheapest place to save milliseconds is the number of items the heavy ranker scores." },
          { t: "note", variant: "warn", html: "<strong>Do not size K from clicks.</strong> Logged clicks only cover items the old funnel chose to show, so a wider retrieval stage that surfaces genuinely new items looks worse offline for being different. Measure stage recall against the heavy ranker's own top set computed over a much larger candidate pool, or against human relevance labels." },
          { t: "cue", html: "Reach for the full funnel when the corpus is many orders of magnitude larger than the page and the prompt gives you a latency target. Phrases like <em>\"millions of items\"</em>, <em>\"under 100 ms\"</em>, <em>\"personalized home feed\"</em> or <em>\"search over the whole catalogue\"</em> are the trigger. Build it out end to end in <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a> and <a href='#/mlcase/retrieval/search-ranking'>search ranking</a>." },
          { t: "note", variant: "key", html: "<strong>Every stage spends milliseconds and loses recall, and recall multiplies.</strong> Give each stage a candidate count, a latency slice and a recall budget. Buy recall early, where items are cheap, and save latency late, where each item is expensive." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "two-tower",
        title: "Two-tower retrieval models",
        summary: "How a query tower and an item tower are trained with in-batch negatives, why popularity needs a logQ correction, and what a dot product cannot say.",
        minutes: 11,
        tags: ["retrieval", "embeddings", "training"],
        blocks: [
          { t: "p", html: "A two-tower model is two encoders trained together: one turns a user or query into a vector, one turns an item into a vector, and relevance is their dot product. The background on embeddings lives in <a href='#/mlsd/concepts/embeddings'>embeddings</a>. Here you look at the training mechanics and serving consequences that interviewers probe once you say \"two-tower\"." },
          {
            t: "code", lang: "text", code:
              "  user id, history, context          item id, text, category, creator\n" +
              "            |                                    |\n" +
              "     [ query tower ]                     [ item tower ]\n" +
              "            |                                    |\n" +
              "         u in R^d                             v in R^d\n" +
              "            \\________________  ________________/\n" +
              "                             \\/\n" +
              "                   score = <u, v> / tau"
          },
          { t: "h", text: "What goes in each tower" },
          {
            t: "table",
            headers: ["Tower", "Typical inputs", "Must not contain"],
            rows: [
              ["Query / user", "User id embedding, pooled recent history, query text, locale, device, time of day", "Anything about the candidate item"],
              ["Item", "Item id embedding, title or content embedding, category, creator id, age bucket", "Anything about the user or the request"]
            ]
          },
          { t: "p", html: "The \"must not contain\" column is the contract. Because the item tower never sees the user, every item vector can be computed offline and loaded into an index. Serving becomes one query-tower forward pass plus a nearest-neighbour search, which is what <a href='#/mlsd/concepts/ann-serving'>approximate nearest-neighbour serving</a> makes fast." },
          { t: "h", text: "In-batch negatives" },
          { t: "p", html: "Training data is positive pairs — a user and an item they engaged with. Negatives come for free: in a batch of B pairs, each user's positive item is a negative for the other B−1 users. That turns every batch into a B-way softmax classification, which is cheap and works well." },
          {
            t: "code", lang: "python", code:
              "# B positive (user, item) pairs per batch\n" +
              "U = query_tower(batch.users)           # [B, d], L2-normalized\n" +
              "V = item_tower(batch.items)            # [B, d], L2-normalized\n" +
              "logits = (U @ V.T) / tau               # [B, B]; diagonal = positives\n" +
              "\n" +
              "# logQ correction: popular items appear as negatives more often\n" +
              "logits = logits - log(q[batch.item_ids])[None, :]\n" +
              "\n" +
              "# same item twice in a batch is not a negative for its own row\n" +
              "logits = mask_duplicate_items(logits, batch.item_ids)\n" +
              "\n" +
              "loss = cross_entropy(logits, labels=arange(B))"
          },
          { t: "note", variant: "trap", html: "<strong>In-batch negatives are sampled by popularity, not uniformly.</strong> A hit item appears as someone else's negative in almost every batch, so the model learns to push it down for everyone. The <em>logQ correction</em> subtracts the log of each item's sampling probability (roughly its share of training interactions) from its logit, so an item is not punished just for being common." },
          { t: "h", text: "Hard negatives and their cost" },
          { t: "p", html: "Random and in-batch negatives are easy: most are obviously irrelevant, so the model stops learning once it can separate the topic. <strong>Hard negatives</strong> — items the current model ranks highly but the user did not engage with, or items shown and skipped — teach finer distinctions. Mix them in at a modest ratio, because many \"hard negatives\" are really unlabeled positives, and too many teaches the model to reject good items." },
          {
            t: "table",
            headers: ["Tier", "Negative strategy", "What it costs"],
            rows: [
              ["Naive", "Uniform random items from the catalogue", "Too easy; model plateaus at coarse topic separation"],
              ["Solid", "In-batch negatives with logQ correction", "Needs a sampling-probability estimate per item; streaming counts are fine"],
              ["Standout", "In-batch plus a small share of mined hard negatives, with duplicate masking", "Mining pipeline, false-negative risk, needs careful ratio tuning"]
            ]
          },
          { t: "h", text: "Serving and refresh" },
          {
            t: "ul", items: [
              "<strong>Item vectors are batch-computed</strong> and indexed. New items need an embedding at publish time, so the item tower must run on content features alone — an id-only item tower cannot embed anything it has not seen.",
              "<strong>Query vectors are computed per request</strong>, usually in a few milliseconds on CPU, because recent history changes between requests.",
              "<strong>Both towers must come from the same checkpoint.</strong> Retraining the query tower without re-embedding the catalogue mixes two vector spaces, and recall silently collapses. Version the index with the model.",
              "<strong>Refresh cadence</strong> — full re-embed daily or weekly, with incremental embedding for new items in between."
            ]
          },
          { t: "note", variant: "warn", html: "<strong>A dot product cannot express interactions.</strong> \"Likes cooking videos, but only short ones, and only in the evening\" needs features of the user and the item combined, which the towers never see together. That is not a bug to fix in retrieval; it is the reason the heavy ranker exists. Say so explicitly, because it shows you know where each stage's ceiling is." },
          { t: "cue", html: "Reach for a two-tower model when the prompt needs personalized candidates from a catalogue too large to score directly, and when you need new items to be retrievable without waiting for interactions. Listen for <em>\"similar items\"</em>, <em>\"people like you also\"</em>, <em>\"semantic search\"</em> or <em>\"candidates from millions\"</em>. For text-heavy semantic search with a language-model encoder, <a href='../llm-academy/index.html'>Lumen</a> covers the encoder side in depth." },
          { t: "note", variant: "key", html: "<strong>Two independent towers are what make retrieval servable, and the same independence caps how much they can express.</strong> Train with in-batch negatives plus logQ correction, keep towers and index on the same version, and leave cross features to the ranker." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "ann-indexes",
        title: "ANN indexes: IVF, graphs and quantization",
        summary: "How inverted-file partitions, graph indexes and product quantization trade recall against latency and memory, and why filters and updates are hard.",
        minutes: 12,
        tags: ["retrieval", "ann", "infrastructure"],
        blocks: [
          { t: "p", html: "Exact nearest-neighbour search compares the query with every vector. With 100 million 256-dimensional vectors that is about 25 billion multiply-adds per query, far too much for a 10 ms slice. Approximate indexes give up a little recall to scan a small fraction of the corpus. The overview is in <a href='#/mlsd/concepts/ann-serving'>approximate nearest-neighbour serving</a>; this lesson is about the dials." },
          { t: "stat", items: [
            { v: "~25 G", k: "multiply-adds for exact search, 10^8 × 256-d" },
            { v: "1-5%", k: "of vectors scanned by a tuned IVF index" },
            { v: "0.9-0.99", k: "typical recall@k target" }
          ] },
          { t: "h", text: "IVF: partition, then probe" },
          { t: "p", html: "An inverted-file index runs k-means over the vectors to get <code class='tok'>nlist</code> centroids, then assigns each vector to its nearest centroid. At query time it finds the <code class='tok'>nprobe</code> closest centroids and scans only their partitions. A common starting point is <code class='tok'>nlist</code> on the order of the square root of the corpus size, with nprobe tuned until recall@k meets the target." },
          {
            t: "code", lang: "text", code:
              "N = 100,000,000 vectors, nlist = 16,384 partitions\n" +
              "average partition size   = N / nlist        ~= 6,100 vectors\n" +
              "\n" +
              "nprobe = 16   scans  ~98,000 vectors  (0.1% of corpus)\n" +
              "nprobe = 64   scans ~390,000 vectors  (0.4%)\n" +
              "\n" +
              "raising nprobe: recall up, latency up roughly linearly,\n" +
              "memory unchanged, no rebuild needed"
          },
          { t: "h", text: "Graph indexes: walk toward the query" },
          { t: "p", html: "A hierarchical navigable small-world graph links each vector to a few dozen near neighbours, with sparse upper layers for long jumps. A query starts at an entry point and greedily walks toward closer nodes, keeping a candidate list of size <code class='tok'>efSearch</code>. A larger efSearch explores more of the graph — higher recall, slower query. Build-time parameters (links per node, build-time candidate list) set the graph's quality and its memory overhead." },
          {
            t: "compare",
            bad: { title: "IVF strengths and costs", items: ["Small memory overhead beyond the vectors", "Pairs naturally with quantization", "Recall drops at partition boundaries", "Needs retraining centroids if the data shifts"] },
            good: { title: "Graph strengths and costs", items: ["Very high recall at low latency", "Incremental inserts are natural", "Extra memory for links on every vector", "Deletes and heavy churn degrade the graph"] }
          },
          { t: "h", text: "Product quantization: the memory math" },
          { t: "p", html: "Product quantization splits each vector into <em>m</em> sub-vectors and replaces each with the id of its nearest centroid in a small per-subspace codebook — usually 256 centroids, so one byte per sub-vector. Distances are then computed from lookup tables instead of floats." },
          {
            t: "code", lang: "text", code:
              "100M vectors, 768-d, float32\n" +
              "  full precision : 768 * 4 B  = 3,072 B/vector  ->  ~307 GB\n" +
              "  PQ, m = 96     : 96 * 1 B   =    96 B/vector  ->  ~9.6 GB   (32x)\n" +
              "  PQ, m = 48     : 48 * 1 B   =    48 B/vector  ->  ~4.8 GB   (64x)\n" +
              "\n" +
              "common pattern: IVF + PQ for the coarse search,\n" +
              "then re-score the top few hundred with full vectors"
          },
          { t: "h", text: "The three-way trade-off" },
          {
            t: "table",
            headers: ["Configuration", "Recall@k", "Latency", "Memory"],
            rows: [
              ["Exact (flat) search", "Perfect", "Highest; linear in N", "Full vectors"],
              ["IVF, low nprobe", "Lower", "Low", "Full vectors + centroids"],
              ["IVF, high nprobe", "Higher", "Moderate", "Same as above"],
              ["Graph, high efSearch", "Very high", "Low to moderate", "Full vectors + link lists"],
              ["IVF + PQ + re-score", "High after re-score", "Low", "Smallest; codes plus a re-score store"]
            ]
          },
          { t: "note", variant: "tip", html: "Always quote recall@k <em>at</em> a latency and a memory budget. \"0.97 recall\" alone means nothing — any index reaches it if you let it scan enough. Sweep nprobe or efSearch, plot recall against p99 latency, and pick the knee." },
          { t: "h", text: "Filters break the neighbourhood" },
          { t: "p", html: "Real queries carry constraints: in stock, ships to this country, not already watched, safe for this account. Asking for the top 100 neighbours and then filtering — <strong>post-filtering</strong> — fails badly when the filter is selective: if 2% of items pass, you keep about 2 of 100." },
          {
            t: "ul", items: [
              "<strong>Over-fetch</strong> — ask for k / selectivity results. Simple, but cost grows as filters get stricter.",
              "<strong>Partition by the attribute</strong> — one index per country or category. Exact and fast, but multiplies memory and build jobs.",
              "<strong>Filter during traversal</strong> — skip non-matching vectors while searching. Supported by some engines, but very selective filters can disconnect the graph walk.",
              "<strong>Push the filter into retrieval sources</strong> — a separate, non-ANN source for strongly constrained queries."
            ]
          },
          { t: "note", variant: "warn", html: "<strong>Updates are not free.</strong> Graph indexes handle inserts well but deletes poorly — tombstoned nodes still sit on paths. IVF centroids drift away from the data as the catalogue changes. Plan a periodic full rebuild, served blue-green next to the live index, and keep it on the same model version as the query tower." },
          { t: "cue", html: "Go deep on ANN when the prompt has a very large catalogue, a tight latency budget, hard filters (<em>\"only in-stock\"</em>, <em>\"in my region\"</em>) or a memory ceiling. Mention the filter problem without being asked; most candidates skip it. <a href='#/mlcase/retrieval/search-autocomplete'>Search autocomplete</a> and <a href='#/mlcase/recsys/people-you-may-know'>people you may know</a> both lean on fast candidate lookup." },
          { t: "note", variant: "key", html: "<strong>An ANN index is a three-way dial between recall, latency and memory.</strong> IVF's nprobe and a graph's efSearch move recall against latency, PQ trades exact distances for a 30× smaller footprint, and selective filters need a strategy before they break your candidate set." },
          { t: "quiz", id: "rank-retrieval" }
        ]
      }
    ]
  };

  /* ==================================================================
     5. Module: ranking
  ================================================================== */
  var MOD_RANKING = {
    id: "ranking",
    name: "Ranking",
    icon: "trend",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "learning-to-rank",
        title: "Learning to rank",
        summary: "Pointwise, pairwise and listwise objectives, tree versus deep rankers, where labels come from, and how to stop position bias from leaking into relevance.",
        minutes: 11,
        tags: ["ranking", "training", "metrics"],
        blocks: [
          { t: "p", html: "A ranker's job is an ordering, not a set of scores. Learning to rank is the family of training objectives that take that seriously. The choice matters most at the top of the list, which is also where the metric is measured — usually <a href='#/found/metrics/ranking-metrics'>NDCG or a close relative</a>." },
          { t: "h", text: "Three families of objective" },
          {
            t: "table",
            headers: ["Family", "Training example", "Loss, conceptually", "Strength", "Weakness"],
            rows: [
              ["Pointwise", "One (query, item, label)", "Log loss on click, or regression on a grade", "Simple; outputs can be calibrated probabilities", "Ignores the ordering; equal effort on rank 1 and rank 80"],
              ["Pairwise", "Two items for one query, one preferred", "Penalize when the less-preferred item scores higher", "Directly learns order", "All pairs count equally unless reweighted"],
              ["Listwise", "A whole ranked list", "Softmax over the list, or pair gradients weighted by the NDCG change of swapping them", "Focuses effort near the top", "Harder to batch and debug; scores are not probabilities"]
            ]
          },
          {
            t: "code", lang: "text", code:
              "pairwise, for items i preferred over j with scores s_i, s_j:\n" +
              "  loss_ij = log(1 + exp(-(s_i - s_j)))\n" +
              "\n" +
              "listwise reweighting (LambdaRank idea):\n" +
              "  grad_ij  *=  | change in NDCG if i and j swapped positions |\n" +
              "  -> a swap between ranks 1 and 2 matters far more\n" +
              "     than a swap between ranks 41 and 42"
          },
          { t: "note", variant: "tip", html: "Most production multi-objective rankers are pointwise at heart, because the value model downstream needs calibrated probabilities. Pairwise or listwise losses show up as an extra head, or in search, where one query with graded judgements is a natural list. Saying which one you would use, and why, earns more credit than reciting all three." },
          { t: "h", text: "Gradient-boosted versus deep rankers" },
          {
            t: "compare",
            bad: { title: "Gradient-boosted trees", items: ["Excellent on a few hundred dense, hand-built features", "Fast to train, little tuning, easy to inspect", "Weak with raw text, sequences and huge sparse id spaces", "Hard to share across tasks or surfaces"] },
            good: { title: "Deep rankers", items: ["Learn embeddings for sparse ids and history sequences", "Multi-task heads share one network", "Need far more data and serving compute", "Harder to debug; feature importance is indirect"] }
          },
          { t: "h", text: "Features: four groups" },
          {
            t: "ul", items: [
              "<strong>Query or user</strong> — query length and intent class, user tenure, locale, long-term interest vector.",
              "<strong>Document or item</strong> — quality score, freshness, historical CTR, creator reputation, content embedding.",
              "<strong>Query–document</strong> — text match scores, retrieval similarity, the user's affinity for this creator or category, which retrieval sources found it. These carry most of the lift.",
              "<strong>Context</strong> — time, device, surface, session depth, what is already on the page."
            ]
          },
          { t: "h", text: "Where labels come from" },
          {
            t: "table",
            headers: ["Label source", "Volume", "Bias", "Best use"],
            rows: [
              ["Clicks", "Huge", "Position, presentation, clickbait", "Main training signal, debiased"],
              ["Dwell time / watch time", "Large", "Long items look better; needs normalizing by length", "Satisfaction signal, value-model head"],
              ["Explicit actions (like, save, hide)", "Medium to small", "Only engaged users act", "Separate heads in a multi-objective model"],
              ["Graded human judgements", "Small, costly", "Rater guidelines", "Evaluation set and quality guardrail"]
            ]
          },
          { t: "h", text: "Position bias in training" },
          { t: "p", html: "Items in slot 1 get clicked more partly because they are in slot 1. Train naively on clicks and the model learns \"whatever the old ranker put first is relevant\", which locks in yesterday's decisions." },
          {
            t: "ul", items: [
              "<strong>Position as a feature</strong> — include the logged position at training time and set it to a fixed value (say, slot 1) for every candidate at serving.",
              "<strong>Position tower</strong> — a shallow side network on position and device whose output is added to the logit during training and dropped at serving.",
              "<strong>Propensity weighting</strong> — estimate how likely each slot is to be examined, often from small randomized experiments, and weight clicks by the inverse.",
              "<strong>Interleaving for evaluation</strong> — compare two rankers inside one result list; see <a href='#/found/experiments/interleaving'>interleaving</a>."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Position bias also corrupts offline evaluation.</strong> Replaying logged clicks rewards a new ranker for agreeing with the old one's ordering. Use a debiased offline metric or a randomized slice, and treat a large offline gain from a ranker that reorders heavily with suspicion." },
          { t: "cue", html: "Learning-to-rank depth is expected when the prompt says <em>\"rank results for a query\"</em>, <em>\"order the feed\"</em> or <em>\"top ten\"</em>, and the interviewer asks <em>\"what loss would you use?\"</em>. Name the family, name the label, and name the bias in the label in one breath. <a href='#/mlcase/retrieval/search-ranking'>Search ranking</a> works through a full example." },
          { t: "note", variant: "key", html: "<strong>Pick a loss for where errors hurt, a label for what users value, and a debiasing scheme for how the label was collected.</strong> Pointwise gives calibrated heads, listwise focuses on the top, and an unhandled position bias will quietly undo both." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "multi-objective",
        title: "Multi-objective ranking and value models",
        summary: "Separate heads for click, like, hide and watch time, a weighted value model on top, and why calibration is what gives the weights meaning.",
        minutes: 10,
        tags: ["ranking", "objectives", "multi-task"],
        blocks: [
          { t: "p", html: "No product optimizes one thing. A feed wants clicks, but also likes, long watches and shares, and it wants to avoid hides and reports. The production pattern is to predict each outcome separately and combine them in a small, explicit formula — the <strong>value model</strong> — that product owners can reason about and tune." },
          {
            t: "code", lang: "text", code:
              "heads (one network, several outputs):\n" +
              "  p_click   p_like   p_share   p_hide   E[watch_seconds]\n" +
              "\n" +
              "value(item) =  1.0 * p_click\n" +
              "            +  4.0 * p_like\n" +
              "            +  8.0 * p_share\n" +
              "            - 20.0 * p_hide\n" +
              "            +  0.02 * E[watch_seconds]\n" +
              "\n" +
              "rank by value; weights are exchange rates between outcomes\n" +
              "(illustrative weights)"
          },
          { t: "h", text: "Why separate heads beat a single blended label" },
          { t: "p", html: "You could build one label — \"click plus four times like minus twenty times hide\" — and train on it. But then changing a weight means retraining, and you cannot tell which outcome moved when engagement shifts. Separate heads let you change weights in a config push, measure each head's calibration independently, and add a new outcome without touching the others." },
          { t: "h", text: "Calibration makes weights mean something" },
          { t: "p", html: "A weight of 20 on hides says one hide costs as much as twenty clicks. That only holds if <code class='tok'>p_hide = 0.01</code> actually means one hide per hundred impressions. If the hide head drifts to over-predict by 2×, hides quietly gain influence everywhere without anyone changing a weight. Calibrate every head — the mechanics are in <a href='#/found/metrics/calibration'>calibration</a> — and monitor calibration per head per surface." },
          { t: "note", variant: "warn", html: "<strong>Calibration does not change AUC</strong>, so a head can drift badly while its offline ranking metric looks fine. Put an expected-versus-observed ratio per head on the dashboard, next to the engagement metrics." },
          { t: "h", text: "Tuning the weights" },
          {
            t: "table",
            headers: ["Tier", "How weights are set", "What it costs"],
            rows: [
              ["Naive", "Picked once by intuition, never revisited", "Weights encode a guess; nobody knows the exchange rate"],
              ["Solid", "A/B tests over a small grid of weight vectors, judged on a north-star metric with guardrails", "Several weeks of experiment traffic per round"],
              ["Standout", "Weights tied to measured long-term value (e.g. how much each action predicts retention), refreshed by online experiments", "Needs a long-term-value study and patience; the payoff is weights you can defend"]
            ]
          },
          { t: "p", html: "Run the weight experiments the same way you run any online test — sample size, guardrails and duration are covered in <a href='#/found/experiments/ab-test-design'>A/B test design</a>. A useful trick is to search in a low-dimensional space: fix the click weight at 1 and tune the others as ratios." },
          { t: "h", text: "Sharing one network across tasks" },
          {
            t: "compare",
            bad: { title: "Shared bottom", items: ["One trunk, a small tower per head", "Cheap to serve; rare tasks borrow from common ones", "Conflicting tasks pull the trunk in opposite directions", "A dominant task can starve the others"] },
            good: { title: "Mixture of experts", items: ["Several expert sub-networks, a learned gate per task", "Each task mixes experts its own way, which reduces conflict", "More parameters and compute", "Gates can collapse onto one expert without care"] }
          },
          { t: "note", variant: "tip", html: "Sparse heads such as shares or reports have far fewer positives than clicks. Weight their losses up, or give them their own expert, or their predictions will be dominated by whatever the trunk learned for clicks." },
          { t: "cue", html: "Reach for a value model when the prompt lists several engagement signals, mentions <em>\"quality\"</em> or <em>\"meaningful interactions\"</em>, or when the interviewer asks <em>\"what if users click but then hide?\"</em>. Say <em>\"separate calibrated heads, a weighted sum, weights tuned online\"</em> early. <a href='#/mlcase/recsys/video-recommendations'>Video recommendations</a> uses exactly this shape." },
          { t: "note", variant: "key", html: "<strong>Predict each outcome with its own calibrated head, combine them with explicit weights, and tune the weights online.</strong> The weights are exchange rates between outcomes, and they only mean that if each head is an honest probability." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "reranking-diversity",
        title: "Re-ranking: diversity, rules and slotting",
        summary: "The layer after the ranker: MMR and caps for diversity, freshness boosts, de-duplication, ad slotting, fairness constraints, and what each rule costs in relevance.",
        minutes: 10,
        tags: ["ranking", "diversity", "policy"],
        blocks: [
          { t: "p", html: "The heavy ranker scores each item on its own. A page is not a set of independent items: ten near-identical videos from one creator would each score well and together make a bad page. The re-ranking layer works at the level of the whole list, and it is also where business rules that must hold exactly are enforced." },
          { t: "h", text: "Diversity with MMR" },
          { t: "p", html: "Maximal marginal relevance builds the list greedily. At each step, pick the item that is relevant but not too similar to anything already chosen." },
          {
            t: "code", lang: "python", code:
              "def mmr(candidates, rel, sim, k, lam=0.7):\n" +
              "    chosen = []\n" +
              "    pool = list(candidates)\n" +
              "    while pool and len(chosen) < k:\n" +
              "        def score(i):\n" +
              "            redundancy = max((sim(i, j) for j in chosen), default=0.0)\n" +
              "            return lam * rel[i] - (1 - lam) * redundancy\n" +
              "        best = max(pool, key=score)\n" +
              "        chosen.append(best)\n" +
              "        pool.remove(best)\n" +
              "    return chosen"
          },
          { t: "p", html: "λ = 1 is a plain relevance sort; λ near 0 picks for novelty alone. The similarity can be cosine distance between item embeddings, or simply \"same creator\" or \"same category\" as 1 and 0. The cost is O(k × pool) similarity calls, which is fine over a hundred candidates." },
          { t: "h", text: "The rest of the rule layer" },
          {
            t: "table",
            headers: ["Rule", "Example", "Cost to relevance"],
            rows: [
              ["Eligibility and policy", "Remove age-gated, geo-blocked, reported items", "None you may trade; must be exact"],
              ["De-duplication", "Collapse near-duplicate uploads and reposts", "Small; mostly removes redundancy"],
              ["Author / category caps", "At most 2 items per creator in the top 10", "Moderate; sometimes demotes the best item"],
              ["Freshness boost", "Additive bonus for items under 24 hours old", "Short-term relevance for long-term catalogue health"],
              ["Ads slotting", "Sponsored items at positions 3 and 8, chosen by auction", "Organic items shift down; measured as revenue against engagement"],
              ["Fairness constraint", "Minimum exposure share for new creators", "Measured explicitly; see the dynamics module"]
            ]
          },
          { t: "h", text: "Order matters" },
          { t: "p", html: "Each rule edits the list the next one sees, so the same rules in a different order give a different page. A defensible order runs hard constraints first and soft preferences last." },
          {
            t: "ol", items: [
              "<strong>Eligibility and policy filters</strong> — nothing later may reintroduce a removed item.",
              "<strong>De-duplication</strong> — so diversity is not wasted on copies.",
              "<strong>Diversity and caps</strong> — MMR or per-creator limits over the cleaned list.",
              "<strong>Boosts</strong> — freshness and exploration slots.",
              "<strong>Ad insertion</strong> — last, at fixed slots, so organic ordering is decided first."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Rules accumulate, and each costs a little relevance.</strong> A team that adds one rule per incident ends up with forty, nobody knows which still matter, and the ranker's improvements are flattened by the layer after it. Measure each rule's cost with a holdout that skips it, and retire rules that no longer pay." },
          { t: "note", variant: "tip", html: "Keep exact constraints in code, not in the model. \"The model will learn not to show blocked content\" means you cannot change a policy without retraining or explain a single decision to an auditor. The model decides relevance; the rule layer decides what is allowed." },
          { t: "cue", html: "The re-ranking layer is the right move when the prompt mentions <em>\"variety\"</em>, <em>\"don't show the same creator\"</em>, <em>\"ads in the feed\"</em>, <em>\"new creators\"</em> or <em>\"policy\"</em>. Drawing it as its own box, with an ordered list of rules, shows you know where governance lives. <a href='#/mlcase/recsys/people-you-may-know'>People you may know</a> leans on caps and de-duplication heavily." },
          { t: "note", variant: "key", html: "<strong>The ranker scores items; the re-ranking layer builds a page.</strong> Use MMR or caps for diversity, run hard constraints before soft preferences, insert ads last, and measure each rule's cost to relevance so the layer does not quietly undo the model." },
          { t: "quiz", id: "rank-ranking" }
        ]
      }
    ]
  };

  /* ==================================================================
     6. Module: dynamics
  ================================================================== */
  var MOD_DYNAMICS = {
    id: "dynamics",
    name: "Dynamics",
    icon: "globe",
    lessons: [
      /* ---------------------------------------------------------- */
      {
        id: "cold-start",
        title: "Cold start for users and items",
        summary: "What to show a brand-new user, how to give a brand-new item a fair first impression, and which signals take over as history accumulates.",
        minutes: 9,
        tags: ["dynamics", "cold-start", "features"],
        blocks: [
          { t: "p", html: "A recommender learns from interactions, and new users and new items have none. Cold start is not one problem but two, with different tools. Both share one principle: start from signals that exist at the first request, and hand off to behavioural signals as fast as evidence arrives." },
          { t: "h", text: "New users" },
          {
            t: "ul", items: [
              "<strong>Onboarding</strong> — ask for a few interests or seed follows. Each answer is cheap and immediately usable, but every extra question costs sign-up completion.",
              "<strong>Popularity by context</strong> — what is popular in this country, language, device and time of day is a far better default than global popularity.",
              "<strong>Content-based</strong> — once a user has touched even one item, its content embedding gives a neighbourhood to retrieve from.",
              "<strong>Session features</strong> — the last few clicks in this session, fed straight into the query tower. A model that adapts within minutes beats one that waits for the nightly batch."
            ]
          },
          { t: "h", text: "New items" },
          {
            t: "ul", items: [
              "<strong>Content embeddings</strong> — computed from text, image or audio at publish time, so the item is retrievable before anyone has seen it.",
              "<strong>Creator priors</strong> — a new item from a creator whose last twenty items did well starts with a higher prior than one from an unknown account.",
              "<strong>Exploration boosts</strong> — a guaranteed slice of impressions to collect early signal; the next lesson on <a href='#/rank/dynamics/bandits'>bandits</a> is how to spend it efficiently.",
              "<strong>Fast feedback loops</strong> — streaming counters so the first hundred impressions update the item's features in minutes, not tomorrow."
            ]
          },
          { t: "h", text: "Which strategy, when" },
          {
            t: "table",
            headers: ["Situation", "Primary signal", "Fallback", "Hand off when"],
            rows: [
              ["New user, no onboarding", "Popularity by locale, device and time", "Editorial or diverse sampler", "First few interactions arrive"],
              ["New user, with onboarding", "Declared interests mapped to content clusters", "Popularity by context", "Session behaviour contradicts declared interests"],
              ["Returning user, new session", "Long-term profile plus session features", "Long-term profile alone", "Always blend; session weight grows with clicks"],
              ["New item, known creator", "Creator prior plus content embedding", "Category prior", "A few hundred impressions"],
              ["New item, new creator", "Content embedding plus exploration slot", "Category prior", "Impressions reach a confidence threshold"]
            ]
          },
          {
            t: "compare",
            bad: { title: "Id-only models", items: ["Strong once an id has history", "No vector for an unseen user or item", "New items invisible to retrieval", "Every cold entity falls back to popularity"] },
            good: { title: "Id plus content and context", items: ["Content and context exist on day zero", "Id embeddings add precision as history grows", "New items retrievable immediately", "More features to compute and keep consistent"] }
          },
          { t: "note", variant: "warn", html: "<strong>Popularity fallbacks feed popularity.</strong> If every new user sees the global top items, those items gather even more interactions and the rest of the catalogue gets less data. Contextual popularity plus a small exploration slice keeps the default from becoming a feedback loop — the subject of <a href='#/rank/dynamics/feedback-fairness'>feedback and fairness</a>." },
          { t: "note", variant: "tip", html: "Evaluate cold start on its own slice. Report metrics separately for users in their first session and items in their first day; an aggregate number is dominated by warm traffic and hides a cold-start regression completely." },
          { t: "cue", html: "Bring up cold start without waiting to be asked whenever the prompt involves sign-ups, a marketplace with new listings, or a creator platform. Phrases like <em>\"new users\"</em>, <em>\"just uploaded\"</em>, <em>\"launching in a new country\"</em> or <em>\"first session\"</em> are direct triggers. <a href='#/mlcase/recsys/people-you-may-know'>People you may know</a> has an especially sharp new-user problem." },
          { t: "note", variant: "key", html: "<strong>Start from signals that exist at the first request — context, content, creator — and hand off to behaviour as evidence arrives.</strong> Measure the cold slice separately, and keep the popularity fallback from becoming a loop." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "bandits",
        title: "Bandits: exploring on purpose",
        summary: "Explore versus exploit, ε-greedy, UCB and Thompson sampling at concept level, contextual bandits, regret, and the propensity logging that makes off-policy evaluation possible.",
        minutes: 11,
        tags: ["dynamics", "exploration", "experimentation"],
        blocks: [
          { t: "p", html: "Every impression is spent either on what you believe is best (<strong>exploit</strong>) or on learning whether something else is better (<strong>explore</strong>). A purely exploiting system never learns about items it does not already rate highly. A multi-armed bandit is a policy that decides how much to explore, and where, based on how uncertain it is." },
          { t: "h", text: "Regret: the cost of learning" },
          { t: "p", html: "<strong>Regret</strong> is the reward you lost compared with always picking the best arm in hindsight. After T rounds, regret = T × (best arm's rate) − (expected reward you actually got). Well-designed policies have regret that grows ever more slowly over time, because they stop paying to explore once they are sure." },
          { t: "h", text: "Three policies" },
          {
            t: "table",
            headers: ["Policy", "How it explores", "Strength", "Weakness"],
            rows: [
              ["ε-greedy", "With probability ε, pick a random arm; otherwise the best estimate", "Trivial to implement and explain", "Explores bad arms forever at the same rate; ignores uncertainty"],
              ["Upper confidence bound", "Pick the arm with the highest mean plus an uncertainty bonus", "Tries rarely-seen arms first, then settles", "Deterministic, so it needs care with delayed feedback"],
              ["Thompson sampling", "Draw a plausible rate for each arm from its posterior; serve the highest draw", "Exploration fades naturally; handles delays well", "Needs a posterior model; harder to reason about by hand"]
            ]
          },
          {
            t: "code", lang: "text", code:
              "UCB1 score for arm a after t rounds:\n" +
              "  mean_a + sqrt( 2 * ln(t) / n_a )\n" +
              "  -> bonus shrinks as n_a grows, grows slowly with t\n" +
              "\n" +
              "Thompson sampling for click / no click:\n" +
              "  posterior_a = Beta(1 + clicks_a, 1 + impressions_a - clicks_a)\n" +
              "  sample theta_a ~ posterior_a for every arm\n" +
              "  serve argmax_a theta_a"
          },
          { t: "widget", id: "rankBandit" },
          { t: "p", html: "In the widget, the best arm is the new item. Greedy never serves it, because zero history means a zero estimate. ε-greedy finds it only slowly, because its 10% exploration is spread evenly over all four arms. UCB and Thompson both target their exploration at the uncertain arm, which is exactly what a new item is." },
          { t: "h", text: "Contextual bandits" },
          { t: "p", html: "A plain bandit learns one rate per arm. A <strong>contextual bandit</strong> learns a rate per arm given features of the user and request, so it can learn that the new item suits evening mobile users. Conceptually it is a ranker that also tracks its own uncertainty — for example, a linear model per arm with a confidence bound on its prediction, or Thompson sampling over model weights." },
          { t: "h", text: "Where bandits fit in a recommender" },
          {
            t: "ul", items: [
              "<strong>Slot-level exploration</strong> — one or two slots per page are filled by a bandit choosing among under-explored candidates, while the ranker owns the rest.",
              "<strong>New-item boosts</strong> — the bandit decides how many impressions a new item gets before the main ranker takes over.",
              "<strong>Choosing among a few options</strong> — thumbnails, notification templates, layouts; small arm counts where a bandit beats a fixed A/B split on regret.",
              "<strong>Not the whole ranking</strong> — with millions of arms, the ranker does the heavy lifting and the bandit handles uncertainty at the edges."
            ]
          },
          { t: "note", variant: "trap", html: "<strong>Log the propensity of every action.</strong> Off-policy evaluation estimates a new policy's value from old logs by reweighting each reward by π<sub>new</sub>(action) / π<sub>log</sub>(action). Without the logged probability that ratio cannot be computed, and every policy idea needs its own online test. It is one extra column at logging time and nearly impossible to reconstruct later." },
          { t: "note", variant: "warn", html: "<strong>Bandits and A/B tests answer different questions.</strong> A bandit minimizes regret while it learns; an A/B test gives a clean, unbiased effect estimate. Shifting traffic adaptively makes the final comparison harder to interpret, so use an experiment when you need a decision you can defend, and a bandit when you need to earn while learning." },
          { t: "cue", html: "Reach for a bandit when the prompt says <em>\"new items should get a chance\"</em>, <em>\"pick the best thumbnail\"</em>, <em>\"we keep showing the same things\"</em> or <em>\"learn quickly from little data\"</em>. Pair it with propensity logging in the same sentence. <a href='#/mlcase/recsys/video-recommendations'>Video recommendations</a> uses an exploration slot in exactly this way." },
          { t: "note", variant: "key", html: "<strong>Exploration is an investment you size deliberately, not noise you tolerate.</strong> UCB and Thompson aim it at uncertain arms, contextual bandits make it personal, and logged propensities let you evaluate tomorrow's policy on today's data." }
        ]
      },

      /* ---------------------------------------------------------- */
      {
        id: "feedback-fairness",
        title: "Feedback loops, bias and exposure fairness",
        summary: "How a recommender narrows its own view, how to correct position bias with randomization and propensity weighting, and how to measure exposure across creators.",
        minutes: 11,
        tags: ["dynamics", "bias", "fairness"],
        blocks: [
          { t: "p", html: "A recommender trains on data its previous version chose to show. That loop is introduced in <a href='#/mlsd/serving/feedback-loops'>feedback loops</a>. This lesson goes deeper on three effects that come from it — popularity bias, position bias and unequal exposure — and on the metrics that make them visible before they turn into a product problem." },
          {
            t: "code", lang: "text", code:
              "  model v1 ranks --> users see top items --> clicks logged\n" +
              "       ^                                           |\n" +
              "       |                                           v\n" +
              "  model v2 trains <-- labels only for shown items <-+\n" +
              "\n" +
              "  unshown items: no labels, no learning, no future exposure"
          },
          { t: "h", text: "Popularity bias" },
          { t: "p", html: "Items that start ahead get more impressions, more clicks and more training signal, so the next model rates them even higher. Over a few cycles the head of the catalogue takes a growing share of exposure, and the long tail is never measured well enough to compete. The model is not wrong about what it saw; it simply never saw the rest." },
          { t: "h", text: "Position bias and how to correct it" },
          {
            t: "table",
            headers: ["Tier", "Approach", "What it costs"],
            rows: [
              ["Naive", "Train on raw clicks as if every slot were examined equally", "Model learns the old ranker's ordering, not relevance"],
              ["Solid", "Position as a training feature, fixed at serving; position tower dropped at serving", "Assumes the position effect is separable from relevance"],
              ["Standout", "Estimate examination propensity per slot from a small randomized slice, weight clicks by the inverse, and evaluate with interleaving", "A slice of traffic with deliberately shuffled results, plus variance from large weights (clip them)"]
            ]
          },
          { t: "p", html: "The randomized slice is the honest anchor. Swapping adjacent results for a small fraction of traffic shows how click rate changes with position alone, which gives the propensities every other correction depends on." },
          { t: "h", text: "Exposure fairness" },
          { t: "p", html: "Users are not the only stakeholders. Creators and sellers depend on exposure, and a system that hands most impressions to a small head makes it hard for new suppliers to succeed, which eventually thins the catalogue users see. The group-level definitions — parity, equal opportunity and their conflicts — are in <a href='#/resp/fairness/fairness-definitions'>fairness definitions</a>; in ranking the usual target is exposure." },
          {
            t: "ul", items: [
              "<strong>Exposure floors</strong> — a minimum share of impressions for new or under-exposed creators, enforced in the re-ranking layer.",
              "<strong>Exposure proportional to merit</strong> — expected exposure tracks estimated relevance rather than rank alone, so two near-equal items get near-equal exposure over time.",
              "<strong>Amortized fairness</strong> — the constraint is met across many requests, not on every page, which costs far less relevance."
            ]
          },
          { t: "h", text: "Filter bubbles" },
          { t: "p", html: "The same loop works per user: show more of what someone clicked, learn they like it even more, show even more. Diversity in re-ranking, exploration slots and periodic \"step outside\" candidates from adjacent interests keep each user's profile from collapsing into one topic." },
          { t: "h", text: "Metrics that make it visible" },
          {
            t: "table",
            headers: ["Metric", "Definition", "Watch for"],
            rows: [
              ["Catalogue coverage", "Share of items with at least one impression in a period", "Falling coverage while engagement looks flat"],
              ["Gini of exposure", "Inequality of impressions across items or creators; 0 is equal, near 1 is concentrated", "Steady rise over model versions"],
              ["Novelty", "Average −log2 of the popularity of items shown", "Users seeing only the head"],
              ["Per-user diversity", "Average pairwise distance between items in a session", "Profiles collapsing to one topic"]
            ]
          },
          { t: "note", variant: "warn", html: "<strong>These metrics trade off against short-term engagement, by design.</strong> An exposure floor or a diversity term will usually lower immediate click rate a little. Make that cost explicit in the experiment readout and judge it on longer-horizon outcomes such as retention and creator activity, not on day-one CTR." },
          { t: "note", variant: "tip", html: "Put coverage and exposure Gini on the same dashboard as the engagement metrics and treat a large jump in either as a guardrail breach. A ranker that lifts CTR by 1% while halving coverage is usually a regression waiting to show up." },
          { t: "cue", html: "Raise feedback loops and exposure without prompting when the system has suppliers — creators, sellers, hosts, drivers — or when the prompt says <em>\"long tail\"</em>, <em>\"new creators\"</em>, <em>\"echo chamber\"</em> or <em>\"everyone sees the same thing\"</em>. Naming coverage and exposure Gini as guardrails is a strong senior signal. See it applied in <a href='#/mlcase/recsys/video-recommendations'>video recommendations</a>." },
          { t: "note", variant: "key", html: "<strong>A recommender writes its own training data, so bias compounds unless you counteract it on purpose.</strong> Anchor position correction on a randomized slice, enforce exposure goals in re-ranking, and track coverage, exposure Gini and novelty as guardrails next to engagement." },
          { t: "quiz", id: "rank-dynamics" }
        ]
      }
    ]
  };

  /* ==================================================================
     7. Track registration
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.rank = {
    id: "rank",
    name: "Search, Ranking & Recs",
    short: "Rank",
    tagline: "Millions of candidates, ten slots, fifty milliseconds",
    color: "#fb7185",
    blurb: "The deep end of search and recommendation, one level below the interview overview. Start with the funnel itself — candidate counts, latency slices and recall budgets that multiply — then the two-tower models and approximate nearest-neighbour indexes that make retrieval over a hundred million items fit in ten milliseconds. The ranking module covers learning-to-rank losses and their label biases, multi-objective value models with calibrated heads, and the re-ranking layer where diversity, ads and policy live. It closes with the dynamics that decide whether a recommender stays healthy: cold start, bandits that explore on purpose, and the feedback loops and exposure metrics that keep a system from narrowing its own view.",
    modules: [MOD_RETRIEVAL, MOD_RANKING, MOD_DYNAMICS]
  };
})();
