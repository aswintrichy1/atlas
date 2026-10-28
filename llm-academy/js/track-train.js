/* =====================================================================
   LUMEN · Training & Alignment
   window.TRACKS.train — modules: pretrain / finetune / align

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

  function slider(label, opts, onChange) {
    var shown = h("b", { style: "font-family:var(--font-mono)" }, opts.fmt(opts.value));
    var input = h("input", { type: "range", min: String(opts.min), max: String(opts.max), step: String(opts.step), value: String(opts.value), "aria-label": label });
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      if (!isFinite(v)) v = opts.value;
      shown.textContent = opts.fmt(v);
      onChange(v);
    });
    return h("label", { class: "w-field", style: "flex:1 1 230px" }, h("span", {}, label), input, shown);
  }

  function sci(x) {
    if (!isFinite(x) || x <= 0) return "0";
    var e = Math.floor(Math.log(x) / Math.LN10);
    var m = x / Math.pow(10, e);
    if (m >= 9.995) { m = m / 10; e += 1; }
    return m.toFixed(2) + " × 10^" + e;
  }

  function count(n) {
    if (!isFinite(n)) return "0";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(Math.round(n));
  }

  function commas(n) {
    var s = String(Math.round(n));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function bar(label, frac, color, text) {
    var pct = Math.max(1, Math.min(100, Math.round(frac * 100)));
    return h("div", { style: "display:grid;grid-template-columns:150px 1fr 110px;gap:10px;align-items:center;padding:4px 0" },
      h("span", { style: "font-size:0.84rem" }, label),
      h("span", { style: "display:block;height:10px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
        h("i", { style: "display:block;height:100%;width:" + pct + "%;background:" + color })),
      h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, text));
  }

  var Widgets = {};

  /* ==================================================================
     1. trainFlops — 6·N·D training-compute estimator (illustrative)
  ================================================================== */
  Widgets.trainFlops = function (mount) {
    shell(mount, "estimator", "Training compute, back of the envelope",
      "Pick a parameter count and a token budget. Compute uses the 6·N·D rule of thumb; GPU-days assume an effective per-GPU throughput you choose. Every number here is illustrative, not a quote for any real cluster.");
    var st = { n: 7, d: 2, tput: 160, gpus: 1024 };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var N = st.n * 1e9, D = st.d * 1e12;
      var flops = 6 * N * D;
      var gpuSec = flops / (st.tput * 1e12);
      var gpuDays = gpuSec / 86400;
      var wall = gpuDays / st.gpus;
      var ratio = D / N;
      var regime = ratio < 10 ? "under-trained for its size" : ratio <= 40 ? "near compute-optimal (~20 tokens/param)" : "over-trained: cheaper to serve later";
      clear(stage);
      stage.appendChild(bar("tokens per param", Math.min(1, ratio / 400), ratio <= 40 && ratio >= 10 ? "var(--lime)" : "var(--accent)", ratio.toFixed(0) + " : 1"));
      stage.appendChild(bar("rule of thumb", 20 / 400, "var(--cyan)", "20 : 1"));
      stage.appendChild(h("p", { style: "font-size:0.8rem;color:var(--text-dim);margin:8px 0 0" },
        "6 × " + st.n + "e9 params × " + st.d + "e12 tokens = " + sci(flops) + " FLOPs"));
      clear(readout);
      readout.appendChild(ro("training compute", sci(flops) + " FLOPs"));
      readout.appendChild(ro("GPU-days", commas(gpuDays)));
      readout.appendChild(ro("wall clock on " + commas(st.gpus) + " GPUs", wall < 1 ? (wall * 24).toFixed(1) + " hours" : wall.toFixed(1) + " days"));
      readout.appendChild(ro("regime", regime));
    }

    controls.appendChild(slider("Parameters (B)", { min: 1, max: 400, step: 1, value: st.n, fmt: function (v) { return v + "B"; } }, function (v) { st.n = v; paint(); }));
    controls.appendChild(slider("Training tokens (T)", { min: 0.1, max: 20, step: 0.1, value: st.d, fmt: function (v) { return v.toFixed(1) + "T"; } }, function (v) { st.d = v; paint(); }));
    controls.appendChild(slider("Effective TFLOP/s per GPU (assumed)", { min: 50, max: 600, step: 10, value: st.tput, fmt: function (v) { return String(v); } }, function (v) { st.tput = v; paint(); }));
    controls.appendChild(segment([[64, "64 GPUs"], [256, "256"], [1024, "1,024"], [4096, "4,096"]], 2, function (v) { st.gpus = v; paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. trainMoe — total vs active parameters in a mixture of experts
  ================================================================== */
  var MOE_TOKENS = ["The", "invoice", "total", "is", "wrong", "because", "tax", "doubled"];

  Widgets.trainMoe = function (mount) {
    shell(mount, "simulator", "Total vs active parameters",
      "Set the number of experts, how many each token visits, and the size of each expert. Memory follows the total; per-token compute follows the active count. Step through tokens to watch the router pick different experts.");
    var st = { experts: 8, k: 2, expert: 5.5, shared: 1.5, tok: 0 };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function picks() {
      var chosen = [], j = 0;
      var k = Math.min(st.k, st.experts);
      while (chosen.length < k && j < 64) {
        var e = (st.tok * 5 + j * 3 + st.tok * j) % st.experts;
        if (chosen.indexOf(e) < 0) chosen.push(e);
        j++;
      }
      for (var f = 0; chosen.length < k && f < st.experts; f++) if (chosen.indexOf(f) < 0) chosen.push(f);
      return chosen;
    }

    function paint() {
      var k = Math.min(st.k, st.experts);
      var total = st.shared + st.experts * st.expert;
      var active = st.shared + k * st.expert;
      var chosen = picks();
      clear(stage);
      stage.appendChild(h("p", { style: "margin:0 0 8px;font-size:0.85rem" },
        "Token ", h("b", { style: "font-family:var(--font-mono);color:var(--cyan-ink)" }, "\"" + MOE_TOKENS[st.tok % MOE_TOKENS.length] + "\""),
        " → router → experts " + chosen.map(function (c) { return "#" + (c + 1); }).join(", ")));
      var grid = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px" });
      for (var i = 0; i < st.experts; i++) {
        var on = chosen.indexOf(i) >= 0;
        grid.appendChild(h("span", { style: "min-width:38px;text-align:center;padding:6px 4px;border-radius:8px;font-family:var(--font-mono);font-size:0.75rem;border:1px solid " + (on ? "var(--lime)" : "var(--line)") + ";background:" + (on ? "var(--surface-solid)" : "transparent") + ";color:" + (on ? "var(--lime-ink)" : "var(--text-dim)") }, "E" + (i + 1)));
      }
      stage.appendChild(grid);
      stage.appendChild(bar("active share", active / total, "var(--lime)", (active / total * 100).toFixed(1) + "%"));
      clear(readout);
      readout.appendChild(ro("total params", total.toFixed(1) + "B"));
      readout.appendChild(ro("active per token", active.toFixed(1) + "B"));
      readout.appendChild(ro("weights @16-bit", (total * 2).toFixed(0) + " GB"));
      readout.appendChild(ro("weights @4-bit", (total * 0.5).toFixed(1) + " GB"));
      readout.appendChild(ro("FLOPs per token ≈ 2×active", (2 * active).toFixed(1) + " GFLOPs"));
    }

    controls.appendChild(segment([[4, "4 experts"], [8, "8"], [16, "16"], [64, "64"]], 1, function (v) { st.experts = v; paint(); }));
    controls.appendChild(segment([[1, "top-1"], [2, "top-2"], [4, "top-4"]], 1, function (v) { st.k = v; paint(); }));
    controls.appendChild(slider("Params per expert (B)", { min: 0.5, max: 20, step: 0.5, value: st.expert, fmt: function (v) { return v.toFixed(1) + "B"; } }, function (v) { st.expert = v; paint(); }));
    controls.appendChild(slider("Shared params: attention, embeddings (B)", { min: 0.5, max: 10, step: 0.5, value: st.shared, fmt: function (v) { return v.toFixed(1) + "B"; } }, function (v) { st.shared = v; paint(); }));
    controls.appendChild(h("button", { type: "button", class: "w-btn primary", onclick: function () { st.tok = (st.tok + 1) % MOE_TOKENS.length; paint(); } }, "Route next token"));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. trainLora — trainable parameters for LoRA adapters
  ================================================================== */
  Widgets.trainLora = function (mount) {
    shell(mount, "calculator", "LoRA parameter budget",
      "Each adapted d_in × d_out matrix gets r·(d_in + d_out) trainable parameters. The MLP is assumed to be d → 4d → d, and the whole-model size uses the common ≈12·L·d² estimate (embeddings excluded).");
    var st = { d: 4096, r: 8, target: "qv", layers: 32 };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var d = st.d, r = st.r, L = st.layers;
      var perLayerLora, perLayerFull, label;
      if (st.target === "qv") { perLayerLora = 2 * r * (2 * d); perLayerFull = 2 * d * d; label = "q, v"; }
      else if (st.target === "qkvo") { perLayerLora = 4 * r * (2 * d); perLayerFull = 4 * d * d; label = "q, k, v, o"; }
      else { perLayerLora = 4 * r * (2 * d) + 2 * r * (5 * d); perLayerFull = 4 * d * d + 8 * d * d; label = "attention + MLP"; }
      var lora = perLayerLora * L;
      var full = perLayerFull * L;
      var model = 12 * L * d * d;
      var oneMatrix = r * (2 * d);
      clear(stage);
      stage.appendChild(h("p", { style: "margin:0 0 6px;font-family:var(--font-mono);font-size:0.8rem" },
        "one " + d + "×" + d + " matrix: r·(d_in+d_out) = " + r + " × " + (2 * d) + " = " + commas(oneMatrix) + "  vs  " + commas(d * d) + " full"));
      stage.appendChild(bar("vs adapted matrices", lora / full, "var(--lime)", (lora / full * 100).toFixed(2) + "%"));
      stage.appendChild(bar("vs whole model", Math.max(0.01, lora / model), "var(--cyan)", (lora / model * 100).toFixed(3) + "%"));
      clear(readout);
      readout.appendChild(ro("targets", label + " × " + L + " layers"));
      readout.appendChild(ro("trainable params", commas(lora)));
      readout.appendChild(ro("model estimate", count(model)));
      readout.appendChild(ro("adapter file @16-bit", (lora * 2 / 1e6).toFixed(1) + " MB"));
    }

    controls.appendChild(segment([[2048, "d=2048"], [4096, "4096"], [8192, "8192"]], 1, function (v) { st.d = v; paint(); }));
    controls.appendChild(segment([[4, "r=4"], [8, "8"], [16, "16"], [32, "32"], [64, "64"]], 1, function (v) { st.r = v; paint(); }));
    controls.appendChild(segment([["qv", "q,v"], ["qkvo", "q,k,v,o"], ["all", "attn+MLP"]], 0, function (v) { st.target = v; paint(); }));
    controls.appendChild(slider("Layers", { min: 12, max: 96, step: 4, value: st.layers, fmt: function (v) { return String(v); } }, function (v) { st.layers = v; paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "train-pretrain": {
      title: "Pretraining checkpoint",
      sub: "Data pipelines, the 6·N·D rule and mixture of experts.",
      questions: [
        {
          q: "Why do pretraining pipelines spend real effort on near-duplicate removal?",
          options: ["It makes tokenization faster", "Repeated documents get over-weighted and memorized, wasting compute and raising the risk of verbatim regurgitation", "It strips all copyrighted text from the corpus", "Mixture-of-experts routing requires unique documents"],
          answer: 1,
          explain: "A page copied ten thousand times across the web is effectively trained on ten thousand times. That skews the data mix toward boilerplate, burns compute on content the model already knows, and makes verbatim recall of that text far more likely. Dedup is about the mix and memorization, not speed or licensing."
        },
        {
          q: "Using the 6·N·D rule of thumb, roughly how much compute does training a 10B-parameter model on 1T tokens take?",
          options: ["6 × 10^22 FLOPs", "6 × 10^19 FLOPs", "1 × 10^22 FLOPs", "6 × 10^25 FLOPs"],
          answer: 0,
          explain: "Multiply 6 × (1 × 10^10 parameters) × (1 × 10^12 tokens) to get 6 × 10^22. The 6 comes from about 2 FLOPs per parameter per token for the forward pass and about 4 for the backward pass. Getting the exponents right is the whole skill here."
        },
        {
          q: "A new model scores suspiciously well on a public benchmark that was published well before its training cutoff. What should you suspect first?",
          options: ["The tokenizer vocabulary is too small", "It uses too many experts", "Benchmark items leaked into the pretraining corpus", "The learning rate was set too low"],
          answer: 2,
          explain: "When test questions and answers are on the open web before the crawl, they can end up in the training data. The model then partly remembers answers instead of reasoning to them. Teams check for this with n-gram overlap scans and by keeping private, freshly written evals."
        },
        {
          q: "A mixture-of-experts layer has 8 experts and routes each token to the top 2. Which statement is true?",
          options: ["Memory use scales with the active parameters only", "Top-2 routing means two separate full models vote on each token", "MoE removes the need for attention layers", "Per-token compute tracks the active parameters, but every expert must stay in memory"],
          answer: 3,
          explain: "Each token runs through only two expert feed-forward blocks, so compute per token follows the active count. But any token might be routed to any expert, so all eight sets of weights have to be loaded. That is why MoE models feel fast for their quality yet still need a lot of memory."
        },
        {
          q: "Why do many teams train small models on far more than the ~20 tokens per parameter that the compute-optimal rule of thumb suggests?",
          options: ["Inference is paid on every request, so a smaller model trained longer can be cheaper over its whole lifetime", "Scaling laws stop applying beyond 20 tokens per parameter", "Small models cannot be trained on fewer tokens", "Regulators require a minimum token count"],
          answer: 0,
          explain: "Compute-optimal means lowest training loss for a fixed training budget, and it ignores serving. A model that will answer billions of requests is cheaper to run if it is small, so it is worth spending extra training compute to make that small model as good as possible."
        }
      ]
    },
    "train-finetune": {
      title: "Fine-tuning checkpoint",
      sub: "SFT, LoRA and QLoRA arithmetic, and distillation.",
      questions: [
        {
          q: "In supervised fine-tuning on chat data, which tokens usually contribute to the loss?",
          options: ["Only the system prompt", "Every token in the example, including the user's turn, weighted equally", "Only the assistant's response tokens", "Only the final token of the conversation"],
          answer: 2,
          explain: "The prompt and user turns are masked so the model is not trained to imitate users. Gradients come from predicting the assistant tokens, which is the behaviour you actually want. The loss itself is the same next-token cross-entropy used in pretraining."
        },
        {
          q: "LoRA with rank r = 16 is applied to one 4096 × 4096 weight matrix. How many trainable parameters does that adapter add?",
          options: ["131,072", "16,777,216", "65,536", "262,144"],
          answer: 0,
          explain: "The adapter is two thin matrices, A (r × d_in) and B (d_out × r), so it adds r·(d_in + d_out) = 16 × 8,192 = 131,072 parameters. The full matrix has 16,777,216, so the adapter is under 1% of it. 65,536 would be the answer at rank 8."
        },
        {
          q: "What does QLoRA change compared with plain LoRA?",
          options: ["It quantizes the LoRA adapters to 4-bit and trains the base model in 16-bit", "It keeps the frozen base model in 4-bit and trains higher-precision LoRA adapters on top", "It removes half of the transformer layers", "It replaces fine-tuning with prompt engineering"],
          answer: 1,
          explain: "The base weights are stored in a 4-bit format and never updated; they are dequantized on the fly for each forward and backward pass. Only the small LoRA matrices are trained, in 16-bit. That cuts base-model memory to roughly a quarter, so a 7B model can be tuned on a single consumer GPU."
        },
        {
          q: "A team wants an assistant that answers questions about internal policy documents that change every week. What is the best first move?",
          options: ["Full fine-tune on the documents every week", "Raise the sampling temperature", "Distill a smaller model on the documents", "Retrieve from the documents at query time, and keep fine-tuning for format or tone if it is still needed"],
          answer: 3,
          explain: "Fine-tuning is unreliable for injecting facts and goes stale the moment a document changes. Retrieval puts the current text in front of the model and lets you cite it. Fine-tuning is the right tool for behaviour such as output format, tone or tool-call syntax, not for a changing knowledge base."
        },
        {
          q: "What does sequence-level distillation need from the teacher model?",
          options: ["Its full weights", "Its gradients during training", "Only its generated outputs for your prompts", "A tokenizer identical to the student's"],
          answer: 2,
          explain: "Sequence-level distillation simply trains the student with SFT on text the teacher wrote. That works even through an API, with no access to weights or logits. Logit distillation, by contrast, needs the teacher's probability distributions and usually a shared tokenizer."
        }
      ]
    },
    "train-align": {
      title: "Alignment checkpoint",
      sub: "RLHF, DPO and constitutional AI.",
      questions: [
        {
          q: "In RLHF, what is the reward model trained on?",
          options: ["Pairs of responses to the same prompt, with a human label saying which is better", "Absolute 1–10 scores the policy model gives itself", "Raw web text from the pretraining corpus", "The KL penalty values from the previous run"],
          answer: 0,
          explain: "People find comparing two answers much easier and more consistent than scoring one in isolation. The reward model learns to give the preferred answer a higher scalar score, usually with a pairwise logistic loss. That score is then what the RL step maximizes."
        },
        {
          q: "What is the KL penalty in the RLHF objective for?",
          options: ["Speeding up tokenization", "Directly increasing the reward score", "Keeping the policy close to the reference model so it does not drift into text that games the reward model", "Removing the need for preference data"],
          answer: 2,
          explain: "The reward model is only accurate near the kind of text it was trained on. Without a leash, the policy finds odd outputs that score high but read badly. The KL term charges the policy for moving away from the SFT reference, trading a little reward for staying fluent and on-distribution."
        },
        {
          q: "How does DPO differ from PPO-based RLHF?",
          options: ["DPO needs a separately trained reward model and an online RL loop", "DPO optimizes a classification-style loss on preference pairs directly, with no separate reward model", "DPO only works on base models that skipped SFT", "DPO needs humans to score answers on a 1–10 scale"],
          answer: 1,
          explain: "DPO rewrites the KL-regularized RL objective so the reward is implied by the ratio between the policy and the reference model. You train with a simple loss that raises the chosen answer's relative likelihood over the rejected one. No reward model, no sampling loop and far fewer models in memory."
        },
        {
          q: "After an RLHF round, answers become longer and more flattering without becoming more correct. What is this called?",
          options: ["Catastrophic forgetting", "Benchmark contamination", "Router collapse", "Reward hacking: the policy exploits quirks such as a length preference in the reward model"],
          answer: 3,
          explain: "Human raters and the reward models trained on them often slightly favour longer, more agreeable answers. The policy optimizes exactly what it is scored on, so it learns those quirks. The fixes are better preference data, length-controlled rewards, a stronger KL leash and evals that check correctness."
        },
        {
          q: "In constitutional AI and RLAIF, what replaces most of the human preference labels?",
          options: ["A model that judges responses against a written list of principles", "Randomly assigned labels", "User click-through rates", "The tokenizer's vocabulary statistics"],
          answer: 0,
          explain: "A capable model is asked which of two responses better follows a stated principle, and its choices become the preference data. Humans still write the principles and audit the results. The gain is scale and consistency, and the risk is that the judge's own biases get baked in."
        },
        {
          "q": "What is the core training signal behind most reasoning models' long chains of thought?",
          "options": [
            "Human annotators writing a reasoning trace for every training problem",
            "Reinforcement learning on problems whose final answers can be checked automatically, such as passing unit tests or matching a known result",
            "Pretraining on a larger web corpus",
            "Raising the sampling temperature during inference"
          ],
          "answer": 1,
          "explain": "With verifiable rewards, the model is rewarded when its answer is correct, regardless of how it got there. Over many attempts, behaviours that make correct answers more likely — re-checking, backtracking, trying alternatives — are reinforced, producing long reasoning traces without humans writing them."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.train = {
    id: "train",
    name: "Training & Alignment",
    short: "TRAIN",
    tagline: "How a base model becomes an assistant",
    color: "#fb923c",
    blurb: "Follow a model from raw web crawl to helpful assistant: how pretraining data is cleaned and mixed, how compute scales with parameters and tokens, why mixture-of-experts models are cheap to run but expensive to hold, and how SFT, LoRA, distillation, RLHF, DPO and constitutional AI shape behaviour after pretraining.",
    modules: [
      {
        id: "pretrain",
        name: "Pretraining",
        icon: "database",
        lessons: [
          {
            id: "pretraining-data",
            title: "Pretraining data",
            summary: "Where trillions of tokens come from, how they are cleaned and deduplicated, and why the mix matters more than the volume.",
            minutes: 9,
            tags: ["pretraining", "data", "dedup", "contamination"],
            blocks: [
              { t: "p", html: "Pretraining is one objective, <strong>predict the next token</strong>, applied to an enormous pile of text. The model has no curriculum other than that pile, so the data <em>is</em> the curriculum. Hold this picture: a base model is a compressed reflection of what it read, weighted by how often it read it." },
              { t: "diagram", id: "training-pipeline", caption: "From crawl to assistant: cleaned pretraining data builds a base model, then SFT and preference tuning turn it into an assistant." },
              { t: "h", text: "Where the tokens come from" },
              { t: "table", headers: ["Source", "What it adds", "Watch out for"], rows: [
                ["Web crawl", "Breadth: every topic, register and style", "Spam, boilerplate, machine-generated filler, personal data"],
                ["Code repositories", "Syntax, structure, step-by-step logic", "Licences, secrets committed by mistake, generated code"],
                ["Books and papers", "Long-form reasoning and coherent argument", "Copyright and licensing questions"],
                ["Reference and Q&amp;A sites", "Dense facts, worked explanations", "Small volume, so easy to overweight"],
                ["Synthetic or curated sets", "Targeted skills such as maths or instruction following", "Errors and blind spots of the generator model"],
                ["Multilingual text", "Coverage beyond English", "Uneven quality per language; tokenizer inefficiency"]
              ] },
              { t: "h", text: "The cleaning pipeline" },
              { t: "ol", items: [
                "<strong>Extract</strong> the main text from HTML and drop navigation, ads and cookie banners.",
                "<strong>Identify the language</strong> and route each document to its language bucket.",
                "<strong>Heuristic filters</strong>: too short, too many symbols, too repetitive, too few real words.",
                "<strong>Quality classifiers</strong>: a small model scores how much a page looks like reference-grade text.",
                "<strong>Deduplicate</strong>: exact hashes for copies, MinHash-style fingerprints for near-copies.",
                "<strong>Scrub</strong> personal data and filter toxic or unsafe content.",
                "<strong>Decontaminate</strong>: remove documents that overlap with evaluation sets.",
                "<strong>Tokenize and mix</strong>: assign each source a weight and shuffle into training batches."
              ] },
              { t: "stat", items: [
                { v: "trillions", k: "tokens in a modern pretraining run" },
                { v: "~4 chars", k: "per English token, roughly" },
                { v: "1–few", k: "passes over most documents" }
              ] },
              { t: "p", html: "The <strong>data mix</strong> is a set of weights, not just a set of sources. Teams upsample code and maths because they seem to help reasoning, downsample low-quality web text, and often finish with a short phase on the highest-quality data. Every token is counted with the tokenizer from <a class='inline' href='#/found/tokens/tokenization'>the tokenization lesson</a>, so a language the tokenizer splits badly costs more compute per word." },
              { t: "note", variant: "warn", html: "<strong>Contamination inflates scores.</strong> If benchmark questions sit on the open web before the crawl, the model may remember answers instead of earning them. Check n-gram overlap against your evals and keep a private, freshly written set that has never been published." },
              { t: "compare",
                bad: { title: "More data, unfiltered", items: ["Boilerplate repeated thousands of times", "Memorizes spam and personal data", "Benchmarks quietly leak in", "Compute spent on text it already knows"] },
                good: { title: "Better data, deliberately mixed", items: ["Deduplicated, quality-scored text", "PII scrubbed before training", "Evals decontaminated and kept private", "Mix weights tuned with small ablation runs"] } },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Contamination is the LLM version of train/test leakage. The Synapse atlas covers leakage, splits and offline evaluation for classical models; the same discipline applies here, just at web scale." },
              { t: "cue", html: "<strong>Interview cue:</strong> \"Data quality beats data quantity past a point: I'd dedup, quality-filter, scrub PII and decontaminate against my evals before arguing about model size.\"" },
              { t: "note", variant: "key", html: "<strong>The corpus is the curriculum.</strong> What a base model knows, how it writes and what it leaks are all set by how the data was filtered, deduplicated and weighted." }
            ]
          },
          {
            id: "compute-scaling",
            title: "Compute and scaling laws",
            summary: "The 6·N·D rule for training FLOPs, a worked GPU-days example, and the compute-optimal tokens-per-parameter rule of thumb.",
            minutes: 10,
            tags: ["scaling", "flops", "compute", "chinchilla"],
            blocks: [
              { t: "p", html: "Three numbers describe a training run: <strong>N</strong>, the number of parameters; <strong>D</strong>, the number of training tokens; and <strong>C</strong>, the compute spent. They are tied together, so fixing any two largely decides the third. Most planning conversations are really about how to split a compute budget between N and D." },
              { t: "h", text: "The 6·N·D rule of thumb" },
              { t: "p", html: "For each token, the forward pass costs about <strong>2 FLOPs per parameter</strong> (one multiply, one add). The backward pass costs roughly twice the forward. Add them up and training costs about <code class='tok'>6 × N × D</code> FLOPs. It ignores attention's extra cost at long context, but it is close enough for planning." },
              { t: "code", lang: "text", code:
                "Worked example (illustrative throughput, not a real quote)\n" +
                "N = 7e9 parameters, D = 2e12 tokens\n" +
                "C = 6 * 7e9 * 2e12              = 8.4e22 FLOPs\n\n" +
                "Assume 400 TFLOP/s peak per GPU at 40% utilization\n" +
                "effective = 1.6e14 FLOP/s per GPU\n" +
                "GPU-seconds = 8.4e22 / 1.6e14   = 5.25e8 s\n" +
                "GPU-days    = 5.25e8 / 86,400   ~= 6,080\n" +
                "on 1,024 GPUs                   ~= 6 days of wall clock"
              },
              { t: "widget", id: "trainFlops" },
              { t: "h", text: "Compute-optimal, as a rule of thumb" },
              { t: "p", html: "Scaling-law studies around 2020 showed that loss falls smoothly, as a power law, when you grow parameters, data and compute together. A 2022 compute-optimal study (often called Chinchilla) concluded that many earlier models were too big for the data they saw, and that for a fixed budget you should grow N and D in proportion: roughly <strong>20 tokens per parameter</strong>. GPT-3, with 175B parameters trained on on the order of 300B tokens, sat far below that ratio." },
              { t: "table", headers: ["Regime", "Tokens per parameter", "Why you would choose it"], rows: [
                ["Under-trained", "Well under 20", "Historical accident: models grew faster than datasets"],
                ["Compute-optimal", "About 20", "Lowest training loss for a fixed training budget"],
                ["Over-trained (inference-optimal)", "Hundreds or more", "A smaller model costs less on every request it serves for years"]
              ] },
              { t: "note", variant: "trap", html: "<strong>It is a rule of thumb, not a law of physics.</strong> The ratio shifts with data quality, architecture and how much unique data exists. Real runs also lose throughput to communication, restarts and imperfect utilization, so budget for well below peak FLOPs." },
              { t: "stat", items: [
                { v: "6", k: "FLOPs per parameter per training token" },
                { v: "~2", k: "FLOPs per parameter per generated token" },
                { v: "~20", k: "tokens per parameter, compute-optimal" }
              ] },
              { t: "p", html: "The trade-off: training compute is paid once, inference is paid forever. That is why many current open models are deliberately over-trained. The history of how this was discovered is in <a class='inline' href='#/hist/era/scaling'>GPT-2, GPT-3 and the scaling laws</a>." },
              { t: "cue", html: "<strong>Interview cue:</strong> \"Training compute is about 6·N·D. Compute-optimal is roughly 20 tokens per parameter, but if this model will serve heavy traffic I'd over-train a smaller one because inference dominates lifetime cost.\"" },
              { t: "note", variant: "key", html: "<strong>6·N·D for training, 2·N per token for inference.</strong> Split the budget between parameters and tokens with serving cost in mind, not just training loss." }
            ]
          },
          {
            id: "moe",
            title: "Mixture of experts",
            summary: "A router sends each token to a few expert networks, so active parameters stay small while total parameters, and memory, grow.",
            minutes: 9,
            tags: ["moe", "experts", "router", "sparsity"],
            blocks: [
              { t: "p", html: "In a dense transformer every token flows through every weight. A <strong>mixture-of-experts (MoE)</strong> model replaces each feed-forward block with many smaller <em>expert</em> feed-forward networks plus a <strong>router</strong>. Each token visits only its top-k experts. Picture a hospital triage desk: every patient is seen, but only by the two specialists the desk picks." },
              { t: "h", text: "How a token is routed" },
              { t: "ol", items: [
                "The token's hidden state, after attention, goes into the router, which is a small linear layer.",
                "The router outputs one score per expert; a softmax turns the scores into weights.",
                "The top-k experts (often k = 1 or 2) are selected; the rest are skipped entirely.",
                "Each chosen expert transforms the token; outputs are combined using the router weights.",
                "Attention and embeddings stay <strong>shared</strong>: every token uses them."
              ] },
              { t: "code", lang: "python", code:
                "import numpy as np\n\n" +
                "def moe_layer(x, router_w, experts, k=2):\n" +
                "    \"\"\"x: (d,) hidden state; experts: list of callables.\"\"\"\n" +
                "    scores = router_w @ x                    # one score per expert\n" +
                "    top = np.argsort(scores)[-k:]            # indices of the k best\n" +
                "    w = np.exp(scores[top] - scores[top].max())\n" +
                "    w = w / w.sum()                          # softmax over the chosen k\n" +
                "    return sum(wi * experts[i](x) for wi, i in zip(w, top))"
              },
              { t: "widget", id: "trainMoe" },
              { t: "table", headers: ["Quantity", "What it drives", "Example: 8 experts, top-2"], rows: [
                ["Total parameters", "Memory and storage: every expert must be loaded", "1.5B shared + 8 × 5.5B = 45.5B"],
                ["Active parameters", "FLOPs per token, so speed and serving cost", "1.5B shared + 2 × 5.5B = 12.5B"],
                ["Quality", "Behaves closer to a dense model somewhere between the two counts", "Better than a 12.5B dense model, cheaper than a 45.5B one"]
              ] },
              { t: "compare",
                bad: { title: "What MoE costs you", items: ["Memory for every expert, even idle ones", "All-to-all communication when experts live on different GPUs", "Training instability and load-balancing tricks", "Harder to fine-tune and to fit on local hardware"] },
                good: { title: "What MoE buys you", items: ["Dense-model quality at a fraction of the per-token compute", "Faster generation at a given quality", "Capacity grows by adding experts, not depth", "Cheaper training per unit of quality"] } },
              { t: "note", variant: "warn", html: "<strong>Routers collapse if left alone.</strong> Without help, a few experts win early, get more training and win even more. Training adds an auxiliary load-balancing loss and a per-expert capacity limit; tokens over the limit may be dropped or overflow to another expert." },
              { t: "p", html: "For serving, experts are often spread across GPUs (expert parallelism), which makes network bandwidth part of your latency. For local use the rule is blunt: you pay memory for the <em>total</em> count. See <a class='inline' href='#/local/why/hardware'>the hardware lesson</a> before downloading a large MoE onto a laptop." },
              { t: "cue", html: "<strong>Interview cue:</strong> \"MoE decouples compute from capacity: per-token FLOPs follow active parameters, memory follows total parameters. I'd check whether we are compute-bound or memory-bound before choosing one.\"" },
              { t: "quiz", id: "train-pretrain" },
              { t: "note", variant: "key", html: "<strong>Active params set the speed; total params set the memory.</strong> MoE is a trade of memory and engineering complexity for cheaper tokens." }
            ]
          }
        ]
      },
      {
        id: "finetune",
        name: "Fine-tuning",
        icon: "wrench",
        lessons: [
          {
            id: "sft",
            title: "Supervised fine-tuning",
            summary: "Turning a document-completing base model into an assistant with prompt and ideal-response pairs, and knowing when not to fine-tune.",
            minutes: 9,
            tags: ["sft", "instruction-tuning", "fine-tuning"],
            blocks: [
              { t: "p", html: "A base model continues documents. Ask it a question and it may answer, or it may write five more questions, because that is what follows a question on a forum page. <strong>Supervised fine-tuning (SFT)</strong> shows it thousands of examples of a different kind of document: a conversation where the assistant answers helpfully. After SFT, \"assistant turn comes next\" is a pattern it knows how to finish." },
              { t: "code", lang: "text", code:
                "One SFT example, rendered with a chat template (markers are illustrative)\n\n" +
                "<|system|>You are a concise support assistant.<|end|>\n" +
                "<|user|>How do I reset my password?<|end|>\n" +
                "<|assistant|>Open Settings, choose Security, then Reset password.\n" +
                "A link is emailed to you and expires after 30 minutes.<|end|>\n\n" +
                "loss mask:  system + user tokens -> ignored\n" +
                "            assistant tokens     -> next-token cross-entropy"
              },
              { t: "p", html: "The mechanism is the same next-token loss as pretraining, with three changes: the data is curated conversations, the loss is <strong>masked</strong> so only assistant tokens count, and training is short (a few epochs at a small learning rate). Datasets range from a few thousand carefully written examples to hundreds of thousands of mixed ones." },
              { t: "table", headers: ["Data source", "Strength", "Risk"], rows: [
                ["Human-written answers", "Highest quality and intent", "Slow and expensive; style varies by writer"],
                ["Outputs from a stronger model", "Cheap and plentiful", "Licence terms; copies the teacher's mistakes"],
                ["Synthetic data, filtered", "Targets specific skills at scale", "Narrow, repetitive phrasing if unchecked"],
                ["Your own product logs", "Matches real user requests", "Privacy review and consent required"]
              ] },
              { t: "ul", items: [
                "<strong>Good at:</strong> output format, tone, tool-call syntax, domain vocabulary, refusal style.",
                "<strong>Weak at:</strong> reliably adding new facts, especially facts that change.",
                "<strong>Risky for:</strong> general skills and safety behaviour, which can quietly regress."
              ] },
              { t: "h", text: "Fine-tune, prompt or retrieve?" },
              { t: "table", headers: ["Tier", "Approach for \"answer questions about our docs\"", "Why"], rows: [
                ["Naive", "Fine-tune the model on the docs so it \"knows\" them", "Facts stick unreliably, go stale on the next edit, and cannot be cited"],
                ["Solid", "Retrieve relevant passages and put them in the prompt", "Current, citable, and no training run needed"],
                ["Standout", "Retrieval for knowledge, a small SFT or LoRA for format and tone, both gated by an eval set", "Each tool does the job it is good at, and every change is measured"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Catastrophic forgetting.</strong> A narrow SFT set can make the model worse at everything outside it, including refusing harmful requests. Mix in some general instruction data and rerun your broad evals after every tuning job." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> SFT is ordinary supervised learning on labelled pairs. The Synapse atlas covers labelling strategy, train/validation splits and offline metrics for classical supervised models, and the same habits apply here." },
              { t: "cue", html: "<strong>Interview cue:</strong> \"I fine-tune for behaviour and retrieve for knowledge. If the requirement is 'know our latest docs', that is RAG; if it is 'always answer in this JSON shape and tone', that is SFT.\"" },
              { t: "note", variant: "key", html: "<strong>SFT teaches the shape of a good answer, not new facts.</strong> Mask the prompt, keep runs short, and check general skills did not regress." }
            ]
          },
          {
            id: "lora-peft",
            title: "LoRA, QLoRA and PEFT",
            summary: "Freeze the big model and train tiny low-rank adapters: the parameter arithmetic, why QLoRA fits on one GPU, and the trade-offs.",
            minutes: 10,
            tags: ["lora", "qlora", "peft", "adapters"],
            blocks: [
              { t: "p", html: "Full fine-tuning updates every weight and needs memory for gradients and optimizer state on all of them. <strong>Parameter-efficient fine-tuning (PEFT)</strong> freezes the base model and trains a small add-on instead. The most popular kind, <strong>LoRA</strong>, rests on one observation: the <em>change</em> a fine-tune makes to a weight matrix can be approximated by a low-rank matrix." },
              { t: "code", lang: "text", code:
                "LoRA on one weight matrix W (d_out x d_in), frozen\n\n" +
                "W' = W + (alpha / r) * B @ A\n" +
                "     A: r x d_in    (random init)\n" +
                "     B: d_out x r   (zero init, so W' == W at step 0)\n\n" +
                "trainable params per adapted matrix = r * (d_in + d_out)\n\n" +
                "Worked example: d_in = d_out = 4096, r = 8\n" +
                "  adapter = 8 * (4096 + 4096)      = 65,536\n" +
                "  full    = 4096 * 4096            = 16,777,216   -> 0.39%\n" +
                "  adapt q and v in 32 layers = 64 matrices\n" +
                "  64 * 65,536                      = 4,194,304  (~4.2M params, ~8 MB at 16-bit)"
              },
              { t: "widget", id: "trainLora" },
              { t: "h", text: "QLoRA: a 4-bit base under 16-bit adapters" },
              { t: "p", html: "<strong>QLoRA</strong> keeps the frozen base weights in a 4-bit format and trains ordinary LoRA adapters in 16-bit on top. During each pass the 4-bit weights are dequantized on the fly; gradients flow through them to the adapters but never update them. A 7B base drops from about 14 GB at 16-bit to roughly 4 GB, which is why a single consumer GPU can fine-tune it. Quantization formats are covered in <a class='inline' href='#/local/why/quantization'>the quantization lesson</a>." },
              { t: "table", headers: ["Method", "Trainable params", "Memory", "Notes"], rows: [
                ["Full fine-tune", "100%", "Highest: weights, gradients and optimizer state for everything", "Most capacity; one full copy per task"],
                ["LoRA", "Well under 1%", "Base in 16-bit plus small adapter state", "Adapters are megabytes; swap per task or tenant"],
                ["QLoRA", "Well under 1%", "Base in 4-bit plus small adapter state", "Fits big models on one GPU; slower steps, small quality cost"],
                ["Prompt / prefix tuning", "Tiny", "Lowest", "Learns soft prompt vectors; weaker on hard tasks"],
                ["Bottleneck adapters", "A few %", "Low", "Extra small layers; adds a little inference latency"]
              ] },
              { t: "code", lang: "python", code:
                "# Sketch with a PEFT-style library; names and values are illustrative\n" +
                "from peft import LoraConfig, get_peft_model\n\n" +
                "config = LoraConfig(\n" +
                "    r=8,                                  # rank\n" +
                "    lora_alpha=16,                        # scale = alpha / r\n" +
                "    target_modules=[\"q_proj\", \"v_proj\"],  # which matrices get adapters\n" +
                "    lora_dropout=0.05,\n" +
                ")\n" +
                "model = get_peft_model(base_model, config)\n" +
                "model.print_trainable_parameters()       # expect a fraction of a percent"
              },
              { t: "note", variant: "tip", html: "<strong>Serve one base, many adapters.</strong> Because adapters are small, a server can keep one copy of the base model and load a different adapter per customer or task. For a single task, merge <code class='tok'>B @ A</code> into W and the adapter adds zero latency." },
              { t: "note", variant: "trap", html: "<strong>Low rank can underfit.</strong> Simple style changes work at r = 4–16; harder domain shifts may need higher rank or more target matrices. QLoRA also adds quantization error, so compare against a 16-bit LoRA on your eval set before committing." },
              { t: "cue", html: "<strong>Interview cue:</strong> \"LoRA trains r·(d_in + d_out) parameters per adapted matrix, usually well under 1% of the model. QLoRA puts the frozen base in 4-bit so the whole job fits on one GPU.\"" },
              { t: "note", variant: "key", html: "<strong>Freeze the giant, train the sliver.</strong> LoRA makes fine-tuning cheap to run, store and swap; QLoRA makes it fit on hardware you already have." }
            ]
          },
          {
            id: "distillation",
            title: "Distillation and small models",
            summary: "Teaching a small student model to imitate a large teacher, the main flavours of distillation, and what it costs.",
            minutes: 8,
            tags: ["distillation", "small-models", "teacher-student"],
            blocks: [
              { t: "p", html: "<strong>Distillation</strong> trains a small <em>student</em> model to imitate a large <em>teacher</em>. The teacher's outputs carry more information than plain labels: when it says the next token is 70% \"cat\", 20% \"kitten\" and 10% \"dog\", the student learns how those options relate, not just which one won." },
              { t: "table", headers: ["Flavour", "Training signal", "What you need"], rows: [
                ["Logit (soft-label) distillation", "Match the teacher's full next-token distribution", "Teacher probabilities, usually a shared tokenizer"],
                ["Sequence-level distillation", "SFT on text the teacher generated", "Only the teacher's outputs, even via an API"],
                ["Reasoning-trace distillation", "SFT on the teacher's worked, step-by-step solutions", "Long outputs; careful filtering for correctness"],
                ["On-policy distillation", "Student generates, teacher scores or corrects", "Teacher access during training; more compute"]
              ] },
              { t: "code", lang: "text", code:
                "Classic soft-label loss (T = temperature, alpha = mixing weight)\n\n" +
                "loss = alpha       * CE(true_label, student)\n" +
                "     + (1 - alpha) * T^2 * KL( softmax(teacher / T) || softmax(student / T) )\n\n" +
                "Higher T flattens both distributions so the student sees the\n" +
                "teacher's 'second choices'; T^2 keeps gradient size comparable."
              },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Knowledge distillation predates LLMs; it is a standard way to compress classical models for serving. The Synapse atlas treats model compression in classical ML system design if you want that angle." },
              { t: "h", text: "Why small models matter" },
              { t: "stat", items: [
                { v: "lower", k: "latency per token" },
                { v: "cheaper", k: "cost per request" },
                { v: "on-device", k: "privacy and offline use" }
              ] },
              { t: "compare",
                bad: { title: "Student trained carelessly", items: ["Copies teacher hallucinations as fact", "Narrow: great on the distilled task, weak elsewhere", "Unfiltered traces teach confident wrong steps", "Licence terms ignored"] },
                good: { title: "Student trained deliberately", items: ["Teacher outputs filtered by an automatic checker", "Task mix matches real traffic", "Evaluated against the teacher on a held-out set", "Teacher terms of use checked first"] } },
              { t: "note", variant: "warn", html: "<strong>Check the terms before you distill.</strong> Many model providers forbid using their outputs to train competing models. Open-weight licences vary too. This is a legal question first and a technical one second." },
              { t: "p", html: "The trade-off is a capability ceiling: a student rarely beats its teacher on broad tasks, but on a narrow, well-defined task it can get close at a fraction of the cost. Where small models are heading is covered in <a class='inline' href='#/next/frontier/small-models'>small language models and on-device AI</a>." },
              { t: "cue", html: "<strong>Interview cue:</strong> \"For a narrow high-volume task I'd distill: generate teacher outputs, filter them with a checker, SFT a small model, and gate the swap on an eval comparing student and teacher.\"" },
              { t: "quiz", id: "train-finetune" },
              { t: "note", variant: "key", html: "<strong>Distillation buys speed and cost with a capability ceiling.</strong> Filter what the teacher says, check its licence, and measure the student against it." }
            ]
          }
        ]
      },
      {
        id: "align",
        name: "Alignment",
        icon: "shield",
        lessons: [
          {
            id: "rlhf",
            title: "RLHF, step by step",
            summary: "Preference data trains a reward model; PPO then optimizes the policy against it, with a KL penalty as a leash.",
            minutes: 10,
            tags: ["rlhf", "reward-model", "ppo", "kl"],
            blocks: [
              { t: "p", html: "SFT shows the model what a good answer looks like. But many qualities, such as helpful without being verbose, or honest about uncertainty, are easier to <em>judge</em> than to write. <strong>Reinforcement learning from human feedback (RLHF)</strong> captures those judgements and optimizes for them." },
              { t: "ol", items: [
                "<strong>Start from an SFT model.</strong> It becomes both the starting policy and the frozen <em>reference</em>.",
                "<strong>Collect preferences.</strong> Sample two or more answers per prompt; people mark which is better.",
                "<strong>Train a reward model.</strong> Usually the SFT model with a scalar head, trained so preferred answers score higher.",
                "<strong>Optimize with RL.</strong> PPO updates the policy to raise reward, minus a penalty for drifting from the reference."
              ] },
              { t: "code", lang: "text", code:
                "Reward model loss (pairwise, Bradley-Terry style)\n" +
                "  L_RM = -log sigmoid( r(x, y_chosen) - r(x, y_rejected) )\n\n" +
                "RL objective for the policy pi\n" +
                "  maximize  E[ r(x, y) ]  -  beta * KL( pi(y|x) || pi_ref(y|x) )\n\n" +
                "beta large -> stays close to SFT, gains little\n" +
                "beta small -> chases reward, risks reward hacking"
              },
              { t: "table", headers: ["Component", "Role during PPO"], rows: [
                ["Policy", "The model being trained; generates answers"],
                ["Reference model", "Frozen SFT copy; anchors the KL penalty"],
                ["Reward model", "Scores each generated answer"],
                ["Value model (critic)", "Estimates expected reward to reduce gradient noise"]
              ] },
              { t: "stat", items: [
                { v: "4", k: "models in memory during PPO" },
                { v: "pairs", k: "comparisons, not absolute scores" },
                { v: "β", k: "KL weight: the leash length" }
              ] },
              { t: "note", variant: "warn", html: "<strong>Reward hacking.</strong> The reward model is a learned proxy with blind spots. A policy under pressure finds them: longer answers, confident tone, flattery of the user's view. The KL penalty, fresh preference data and correctness evals are the counterweights." },
              { t: "p", html: "Why not just use more SFT? Because preferences capture <em>relative</em> quality, including answers no human would have written, and the RL step lets the model explore its own outputs rather than only imitate. The history of how this produced the first widely used chat assistant is in <a class='inline' href='#/hist/modern/rlhf-chatgpt'>InstructGPT, RLHF and ChatGPT</a>." },
              { t: "compare",
                bad: { title: "Where RLHF hurts", items: ["Four models and an unstable RL loop", "Expensive, slow preference collection", "Sycophancy and verbosity if unchecked", "Hard to reproduce run to run"] },
                good: { title: "Where RLHF helps", items: ["Optimizes qualities that are easier to judge than write", "Learns from the model's own outputs", "Large gains in perceived helpfulness", "Flexible: the reward can mix several goals"] } },
              { t: "cue", html: "<strong>Interview cue:</strong> \"RLHF is three stages: SFT, a reward model trained on pairwise human preferences, then PPO maximizing reward minus a KL penalty to the SFT reference so the policy can't game the reward model.\"" },
              { t: "note", variant: "key", html: "<strong>Preferences → reward model → PPO with a KL leash.</strong> RLHF optimizes what people prefer, and the leash stops it from optimizing the reward model's mistakes." }
            ]
          },
          {
            id: "dpo",
            title: "DPO and preference optimisation",
            summary: "Direct preference optimisation trains on preference pairs with a simple loss, no reward model and no RL loop.",
            minutes: 9,
            tags: ["dpo", "preference-optimisation", "alignment"],
            blocks: [
              { t: "p", html: "<strong>Direct preference optimisation (DPO)</strong> starts from the same preference pairs as RLHF but skips the reward model and the RL loop. It nudges the model to make the chosen answer more likely, and the rejected one less likely, <em>relative to a frozen reference model</em>. Think of it as preference learning that looks like ordinary supervised training." },
              { t: "code", lang: "text", code:
                "DPO loss for one pair (x, y_w = chosen, y_l = rejected)\n\n" +
                "  margin = beta * [ (log pi(y_w|x) - log pi_ref(y_w|x))\n" +
                "                 - (log pi(y_l|x) - log pi_ref(y_l|x)) ]\n" +
                "  L_DPO  = -log sigmoid(margin)\n\n" +
                "implied reward: r(x, y) = beta * log( pi(y|x) / pi_ref(y|x) )"
              },
              { t: "p", html: "Why it works: the KL-regularized RL objective from RLHF has a closed-form optimal policy. Rearranging it shows that the reward can be written in terms of the policy and reference probabilities. Substitute that into the reward model's pairwise loss and you get a loss on the policy alone. Same goal, no separate reward model." },
              { t: "table", headers: ["", "RLHF with PPO", "DPO"], rows: [
                ["Models in memory", "Policy, reference, reward, value", "Policy, reference"],
                ["Training loop", "Generate, score, RL update", "Supervised passes over a fixed dataset"],
                ["Stability", "Sensitive to many hyperparameters", "Few knobs, mainly β and learning rate"],
                ["Data", "Preferences plus fresh samples during training", "A fixed set of preference pairs (offline)"],
                ["Ceiling", "Can keep improving on its own outputs", "Limited by how well the fixed pairs cover what the model now does"]
              ] },
              { t: "ul", items: [
                "<strong>Online or iterative DPO</strong>: periodically sample new answers from the current model, label them, and train again.",
                "<strong>Unpaired variants</strong> learn from single thumbs-up or thumbs-down labels instead of pairs.",
                "<strong>Combined variants</strong> fold the preference term into the SFT loss so there is no separate stage.",
                "<strong>Regularized variants</strong> change the loss shape to reduce overfitting on easy pairs."
              ] },
              { t: "stat", items: [
                { v: "2", k: "models in memory: policy + reference" },
                { v: "β", k: "how far the policy may move from the reference" },
                { v: "offline", k: "trains on a fixed set of pairs" }
              ] },
              { t: "note", variant: "trap", html: "<strong>Offline data drifts.</strong> DPO learns from pairs sampled from an older model. As the policy changes, those pairs say less about what it actually generates now. It can also lower the likelihood of <em>both</em> answers while widening the gap, so watch the chosen answer's log-probability, not just the loss." },
              { t: "table", headers: ["Tier", "Aligning a fine-tuned support model", "Why"], rows: [
                ["Naive", "More SFT on whatever answers looked fine", "No signal about which answers are better, only which exist"],
                ["Solid", "DPO on a few thousand reviewed preference pairs from your own model", "Cheap, stable, and targets your model's real failure modes"],
                ["Standout", "Iterative DPO: sample, label with humans plus a rubric judge, retrain, gate on evals each round", "Keeps the data on-policy and every round measured"]
              ] },
              { t: "cue", html: "<strong>Interview cue:</strong> \"DPO turns RLHF into a classification-style loss on preference pairs with a frozen reference. It needs no reward model and no RL loop, at the cost of being offline unless you iterate.\"" },
              { t: "note", variant: "key", html: "<strong>DPO: same preferences, no reward model, no RL loop.</strong> Simpler and more stable than PPO; keep the data fresh to avoid drift." }
            ]
          },
          {
            "id": "reasoning",
            "title": "Reasoning models and test-time compute",
            "summary": "How models are trained to think before answering, why more inference compute can buy accuracy, and when it is worth paying for.",
            "minutes": 11,
            "tags": [
              "reasoning-models",
              "test-time-compute",
              "rlvr",
              "chain-of-thought",
              "self-consistency"
            ],
            "blocks": [
              {
                "t": "p",
                "html": "Classic scaling spends compute at <em>training</em> time: more data, more parameters. <strong>Reasoning models</strong> add a second dial: spend more compute at <em>inference</em> time by generating a long internal chain of thought before the final answer. On problems with checkable steps — maths, code, logic, planning — accuracy keeps rising as the model is allowed to think longer."
              },
              {
                "t": "h",
                "text": "How a model learns to reason"
              },
              {
                "t": "ol",
                "items": [
                  "<strong>Start from a strong base</strong> that already produces some step-by-step solutions when prompted.",
                  "<strong>Reinforcement learning with verifiable rewards (RLVR):</strong> give it problems whose answers a program can check — unit tests pass, the final number matches, the proof checker accepts. Sample many attempts, reward the ones that are right, and update the policy toward them.",
                  "<strong>Behaviours emerge</strong> that nobody wrote down: re-checking an intermediate result, backtracking ('wait, that is wrong'), trying a second method. Longer, more careful traces get rewarded because they are right more often.",
                  "<strong>Distil</strong> the traces of a large reasoning model into smaller models with supervised fine-tuning, which transfers much of the skill cheaply (see <a class='inline' href='#/train/finetune/distillation'>distillation</a>)."
                ]
              },
              {
                "t": "note",
                "variant": "warn",
                "html": "The reward checks the <em>answer</em>, not the reasoning. A model can reach the right result through a muddled trace, and visible reasoning is not a faithful transcript of the computation. Treat the trace as a debugging aid, not as proof."
              },
              {
                "t": "h",
                "text": "Ways to spend test-time compute"
              },
              {
                "t": "table",
                "headers": [
                  "Method",
                  "How it works",
                  "Best for",
                  "Cost"
                ],
                "rows": [
                  [
                    "Longer thinking",
                    "A reasoning model generates hidden or visible thinking tokens before answering; many APIs expose an effort or budget setting",
                    "Multi-step maths, code, planning",
                    "Output tokens and latency grow with the budget"
                  ],
                  [
                    "Self-consistency",
                    "Sample N independent answers and take the majority",
                    "Questions with one short, comparable answer",
                    "N× the calls"
                  ],
                  [
                    "Best-of-N with a verifier",
                    "Generate N candidates; a test suite, checker or reward model picks the best",
                    "Code (run the tests), structured outputs",
                    "N× calls plus verification"
                  ],
                  [
                    "Search over steps",
                    "Expand and score partial solutions as a tree",
                    "Hard puzzles and proofs; mostly research",
                    "High and hard to bound"
                  ]
                ]
              },
              {
                "t": "code",
                "lang": "python",
                "code": "# self-consistency: cheap, robust, model-agnostic\nfrom collections import Counter\n\ndef self_consistent(ask, question, n=5):\n    answers = [extract_final(ask(question, temperature=0.8)) for _ in range(n)]\n    best, votes = Counter(answers).most_common(1)[0]\n    return best, votes / n      # agreement doubles as a confidence signal"
              },
              {
                "t": "h",
                "text": "When to pay for reasoning"
              },
              {
                "t": "compare",
                "bad": {
                  "title": "Poor fit",
                  "items": [
                    "Lookups, extraction, classification and short rewrites",
                    "Latency-critical chat turns and autocomplete",
                    "Tasks where the missing piece is knowledge, not reasoning — retrieval fixes those"
                  ]
                },
                "good": {
                  "title": "Good fit",
                  "items": [
                    "Multi-step maths, algorithm design, debugging and refactors across files",
                    "Planning an agent's next steps over many tools",
                    "Offline or batch jobs where accuracy matters more than seconds"
                  ]
                }
              },
              {
                "t": "ul",
                "items": [
                  "<strong>Prompt differently.</strong> Reasoning models already think step by step; adding 'think step by step' or long worked examples often adds nothing. State the goal, the constraints and the output format, then get out of the way (contrast with <a class='inline' href='#/prompt/craft/chain-of-thought'>chain-of-thought prompting</a>).",
                  "<strong>Budget it.</strong> Thinking tokens are billed as output. Cap the effort level, route easy requests to a fast model, and measure accuracy per dollar on your own eval set.",
                  "<strong>Do not parse the thoughts.</strong> Ask for a final answer in a fixed format and read only that."
                ]
              },
              {
                "t": "cue",
                "html": "<strong>Interview cue:</strong> \"Reasoning models trade inference compute for accuracy. They are trained with RL on problems a program can verify, so they learn to check and backtrack. I route only multi-step tasks to them, cap the thinking budget, and compare accuracy per dollar against self-consistency on a cheaper model.\""
              },
              {
                "t": "note",
                "variant": "key",
                "html": "<strong>A second scaling dial.</strong> Train-time compute builds capability; test-time compute — longer thinking, voting, verify-and-select — spends it per question. Use it where steps can be checked, cap it everywhere else."
              }
            ]
          },
          {
            id: "constitutional",
            title: "Constitutional AI and RLAIF",
            summary: "Using a model guided by written principles to critique, revise and label preferences, so alignment scales beyond human labelling.",
            minutes: 9,
            tags: ["constitutional-ai", "rlaif", "ai-feedback"],
            blocks: [
              { t: "p", html: "Human preference labels are slow, expensive and inconsistent between labellers. <strong>Constitutional AI</strong> writes the standards down as a short list of principles (the \"constitution\") and asks a capable model to apply them. <strong>RLAIF</strong>, reinforcement learning from AI feedback, is the general idea: an AI judge produces the preference labels." },
              { t: "ol", items: [
                "<strong>Supervised phase:</strong> the model answers a prompt, critiques its own answer against a principle, then rewrites it.",
                "Fine-tune on the revised answers, so the improved behaviour becomes the default.",
                "<strong>Preference phase:</strong> sample two answers; a judge model picks the one that better follows a chosen principle.",
                "Train on those AI labels, with a reward model and RL or directly with DPO."
              ] },
              { t: "code", lang: "text", code:
                "Principle (example):\n" +
                "  Prefer the response that is most helpful while being honest about\n" +
                "  uncertainty and declining clearly unsafe requests without lecturing.\n\n" +
                "Judge prompt (sketch):\n" +
                "  Here is a user request and two candidate responses, A and B.\n" +
                "  Using the principle above, which response is better?\n" +
                "  Answer with A or B, then one sentence explaining why."
              },
              { t: "table", headers: ["", "Human feedback", "AI feedback"], rows: [
                ["Cost per label", "High", "Low"],
                ["Scale and speed", "Thousands per week", "Millions per day"],
                ["Consistency", "Varies by person and day", "Consistent, including consistently wrong"],
                ["Transparency", "Judgement is implicit", "Principles are written and reviewable"],
                ["Bias risk", "Labeller demographics and fatigue", "Judge's own blind spots and self-preference"]
              ] },
              { t: "note", variant: "warn", html: "<strong>An AI judge has biases too.</strong> Judges tend to favour longer answers, answers in their own style and the first option shown. Swap A/B order, calibrate against a human-labelled sample, and keep humans auditing the principles and the outcomes." },
              { t: "p", html: "The same judge machinery powers evaluation as well as training. If you use a model to grade your app's outputs, the pitfalls are identical; see <a class='inline' href='#/ops/evals/llm-judge'>LLM-as-judge</a>." },
              { t: "compare",
                bad: { title: "Principles done badly", items: ["Vague: \"be good\"", "Contradictory principles with no priority", "No human spot checks of judge labels", "Judge is the same model being trained, unchecked"] },
                good: { title: "Principles done well", items: ["Specific, testable statements", "Clear priority when principles conflict", "Regular human calibration samples", "Position-swapped judging to cancel order bias"] } },
              { t: "cue", html: "<strong>Interview cue:</strong> \"Constitutional AI replaces most human preference labels with a model applying written principles. It scales labelling and makes the standards reviewable, but I'd still calibrate the judge against human labels.\"" },
              { t: "quiz", id: "train-align" },
              { t: "note", variant: "key", html: "<strong>Write the standard down, let a model apply it, let humans audit it.</strong> AI feedback scales alignment; written principles make it inspectable." }
            ]
          }
        ]
      }
    ]
  };
})();
