/* =====================================================================
   LUMEN · How LLMs Work
   window.TRACKS.core — modules: transformer / generation

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   Block grammar: see the header of track-found.js.
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

  function slider(label, min, max, step, value, onChange, show) {
    var view = show || function (v) { return String(v); };
    var out = h("b", {}, view(value));
    var inp = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) });
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      if (isNaN(v)) v = value;
      out.textContent = view(v);
      onChange(v);
    });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), inp, out);
  }

  function fmt(x, d) {
    if (typeof x !== "number" || !isFinite(x)) return "—";
    return x.toFixed(d == null ? 3 : d);
  }

  function softmax(xs) {
    var m = -Infinity, i, sum = 0, out = [];
    for (i = 0; i < xs.length; i++) if (xs[i] > m) m = xs[i];
    for (i = 0; i < xs.length; i++) { out.push(Math.exp(xs[i] - m)); sum += out[i]; }
    for (i = 0; i < out.length; i++) out[i] = sum > 0 ? out[i] / sum : 0;
    return out;
  }

  function bar(frac, hue) {
    var pct = Math.max(0, Math.min(100, Math.round(frac * 100)));
    return h("span", { style: "display:block;height:12px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
      h("i", { style: "display:block;height:100%;width:" + pct + "%;background:" + hue }));
  }

  var Widgets = {};

  /* ==================================================================
     1. coreAttention — the three-token example from the lesson
  ================================================================== */
  var ATT_TOKENS = ["the", "cat", "sat"];
  var ATT_Q = [[1, 0], [0, 1], [1, 1]];
  var ATT_K = [[1, 0], [0, 2], [1, 1]];
  var ATT_V = [[1, 0], [0, 1], [1, 1]];

  Widgets.coreAttention = function (mount) {
    shell(mount, "calculator", "Scaled dot-product attention, three tokens",
      "Pick the query token. Each key is scored against its query, divided by √2 (the key dimension), and softmaxed into weights; the output is the weighted mix of value vectors. Turn the causal mask on to hide tokens that come later, as a decoder does.");
    var qi = 2, causal = true;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var q = ATT_Q[qi], raw = [], vis = [], i;
      for (i = 0; i < ATT_TOKENS.length; i++) {
        var allowed = !causal || i <= qi;
        vis.push(allowed);
        if (allowed) raw.push((q[0] * ATT_K[i][0] + q[1] * ATT_K[i][1]) / Math.SQRT2);
      }
      var w = softmax(raw), full = [], wi = 0, out = [0, 0], best = 0;
      for (i = 0; i < ATT_TOKENS.length; i++) {
        var weight = vis[i] ? w[wi++] : 0;
        full.push(weight);
        out[0] += weight * ATT_V[i][0];
        out[1] += weight * ATT_V[i][1];
        if (weight > full[best]) best = i;
      }

      clear(stage);
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:60px 90px 1fr 60px;gap:8px;font-size:0.78rem;color:var(--text-dim);padding-bottom:4px" },
        h("span", {}, "key"), h("span", {}, "q·k / √2"), h("span", {}, "attention weight"), h("span", {}, "weight")));
      for (i = 0; i < ATT_TOKENS.length; i++) {
        var score = (q[0] * ATT_K[i][0] + q[1] * ATT_K[i][1]) / Math.SQRT2;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:60px 90px 1fr 60px;gap:8px;align-items:center;padding:3px 0" + (vis[i] ? "" : ";opacity:0.55") },
          h("span", { style: "font-family:var(--font-mono)" }, ATT_TOKENS[i]),
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem" }, vis[i] ? fmt(score, 3) : "masked"),
          bar(full[i], i === best ? "var(--cyan)" : "var(--accent)"),
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem" }, fmt(full[i], 3))));
      }

      clear(readout);
      readout.appendChild(ro("query", ATT_TOKENS[qi] + " [" + q.join(", ") + "]"));
      readout.appendChild(ro("visible keys", raw.length));
      readout.appendChild(ro("most attended", ATT_TOKENS[best]));
      readout.appendChild(ro("output vector", "[" + fmt(out[0], 3) + ", " + fmt(out[1], 3) + "]"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-size:0.84rem;color:var(--text-dim)" }, "query"),
      segment([[0, "the"], [1, "cat"], [2, "sat"]], 2, function (v) { qi = v; paint(); }),
      h("span", { style: "font-size:0.84rem;color:var(--text-dim)" }, "mask"),
      segment([[true, "causal"], [false, "none"]], 0, function (v) { causal = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. coreSoftmax — temperature and top-p over four logits
  ================================================================== */
  var SM_TOKENS = ["Paris", "Lyon", "Nice", "pizza"];
  var SM_LOGITS = [3.0, 1.5, 1.0, -1.0];

  Widgets.coreSoftmax = function (mount) {
    shell(mount, "sampler", "Temperature and top-p on four candidate tokens",
      "The model's raw scores (logits) for the next word after 'The capital of France is' are fixed: 3.0, 1.5, 1.0, −1.0. Temperature divides them before the softmax; top-p then keeps the smallest set of tokens whose probability adds up to p and renormalises.");
    var T = 1.0, topP = 1.0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var t = Math.max(0.05, T), scaled = [], i;
      for (i = 0; i < SM_LOGITS.length; i++) scaled.push(SM_LOGITS[i] / t);
      var p = softmax(scaled);
      var order = [0, 1, 2, 3].sort(function (a, b) { return p[b] - p[a]; });
      var kept = {}, cum = 0, keptN = 0, keptMass = 0;
      for (i = 0; i < order.length; i++) {
        kept[order[i]] = true; keptN++; cum += p[order[i]];
        if (cum >= topP - 1e-9) break;
      }
      for (i = 0; i < p.length; i++) if (kept[i]) keptMass += p[i];
      var entropy = 0;
      for (i = 0; i < p.length; i++) if (p[i] > 0) entropy -= p[i] * Math.log(p[i]) / Math.LN2;

      clear(stage);
      for (i = 0; i < SM_TOKENS.length; i++) {
        var final = kept[i] && keptMass > 0 ? p[i] / keptMass : 0;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:70px 50px 1fr 120px;gap:8px;align-items:center;padding:4px 0" + (kept[i] ? "" : ";opacity:0.5") },
          h("span", { style: "font-family:var(--font-mono)" }, SM_TOKENS[i]),
          h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim)" }, fmt(SM_LOGITS[i], 1)),
          bar(p[i], i === 0 ? "var(--cyan)" : "var(--accent)"),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, fmt(p[i], 3) + (kept[i] ? " → " + fmt(final, 3) : " cut"))));
      }

      clear(readout);
      readout.appendChild(ro("temperature", fmt(T, 1)));
      readout.appendChild(ro("P(Paris)", fmt(p[0], 3)));
      readout.appendChild(ro("tokens kept", keptN + " of 4"));
      readout.appendChild(ro("entropy", fmt(entropy, 2) + " bits"));
      readout.appendChild(ro("behaviour", t <= 0.3 ? "near-greedy" : t < 0.9 ? "focused" : t <= 1.2 ? "balanced" : "adventurous"));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      slider("temperature", 0.1, 2.0, 0.1, T, function (v) { T = v; paint(); }, function (v) { return v.toFixed(1); }),
      h("div", { style: "display:flex;gap:8px;align-items:center" },
        h("span", { style: "font-size:0.84rem;color:var(--text-dim)" }, "top-p"),
        segment([[1.0, "1.0 (off)"], [0.9, "0.9"], [0.5, "0.5"]], 0, function (v) { topP = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. coreKvCache — memory = 2 × layers × kv_heads × head_dim × bytes × tokens
  ================================================================== */
  Widgets.coreKvCache = function (mount) {
    shell(mount, "calculator", "KV-cache memory calculator",
      "The cache stores one key and one value vector per layer, per KV head, per token. Change the model shape and the context to see how quickly it adds up — and how much grouped-query attention (fewer KV heads) or a smaller cache precision saves.");
    var cfg = { layers: 32, kvHeads: 8, headDim: 128, bytes: 2, ctxK: 8, batch: 1 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var tokens = cfg.ctxK * 1024;
      var perToken = 2 * cfg.layers * cfg.kvHeads * cfg.headDim * cfg.bytes;
      var perSeq = perToken * tokens;
      var total = perSeq * cfg.batch;
      var gib = total / Math.pow(2, 30);
      var share = gib / 80;

      clear(stage);
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:0.82rem;margin:0 0 8px" },
        "2 × " + cfg.layers + " layers × " + cfg.kvHeads + " kv heads × " + cfg.headDim + " dim × " + cfg.bytes + " B × " + tokens.toLocaleString("en-US") + " tokens × " + cfg.batch + " seq"));
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:140px 1fr 70px;gap:8px;align-items:center" },
        h("span", { style: "font-size:0.84rem" }, "of an 80 GB card"),
        bar(Math.min(1, share), share > 1 ? "var(--rose)" : share > 0.5 ? "var(--amber)" : "var(--lime)"),
        h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, Math.round(share * 100) + "%")));

      clear(readout);
      readout.appendChild(ro("per token", fmt(perToken / 1024, 0) + " KiB"));
      readout.appendChild(ro("per sequence", fmt(perSeq / Math.pow(2, 30), 2) + " GiB"));
      readout.appendChild(ro("whole batch", fmt(gib, 2) + " GiB"));
      readout.appendChild(ro("verdict", share > 1 ? "exceeds one card" : share > 0.5 ? "tight once weights are loaded" : "comfortable"));
    }

    function set(key) { return function (v) { cfg[key] = v; paint(); }; }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      slider("layers", 8, 96, 4, cfg.layers, set("layers")),
      slider("KV heads", 1, 64, 1, cfg.kvHeads, set("kvHeads")),
      slider("context (K tokens)", 1, 128, 1, cfg.ctxK, set("ctxK"), function (v) { return v + "K"; }),
      slider("concurrent sequences", 1, 64, 1, cfg.batch, set("batch")),
      h("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" },
        h("span", { style: "font-size:0.84rem;color:var(--text-dim)" }, "head dim"),
        segment([[64, "64"], [128, "128"]], 1, set("headDim")),
        h("span", { style: "font-size:0.84rem;color:var(--text-dim)" }, "precision"),
        segment([[2, "fp16 (2 B)"], [1, "fp8 (1 B)"], [0.5, "4-bit (0.5 B)"]], 0, set("bytes")))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "core-transformer": {
      title: "Transformer checkpoint",
      sub: "Attention, heads, positions and the decoder-only stack.",
      questions: [
        {
          q: "In scaled dot-product attention, what is divided by √d_k, and why?",
          options: [
            "The value vectors, so the output has unit length",
            "The query-key dot products, so scores do not grow with dimension and push the softmax into a near one-hot, tiny-gradient regime",
            "The number of heads, so the heads are averaged",
            "The learning rate, so training is stable"
          ],
          answer: 1,
          explain: "Dot products of random d-dimensional vectors have a spread that grows like √d. Without scaling, large models would produce huge scores, the softmax would put almost all weight on one key, and gradients through it would nearly vanish. Dividing by √d_k keeps scores in a workable range."
        },
        {
          q: "What does the causal mask in a decoder-only transformer do?",
          options: [
            "It hides padding tokens and nothing else",
            "It randomly drops attention weights as regularisation",
            "It blocks attention across sentence boundaries",
            "It stops each position from attending to later positions, so the model cannot see the token it is meant to predict"
          ],
          answer: 3,
          explain: "During training every position predicts its next token in parallel, so without a mask a position could simply read the answer from the future. Setting future scores to minus infinity before the softmax gives them zero weight, which also matches generation, where future tokens do not exist yet."
        },
        {
          q: "A model has d_model = 4,096 and 32 attention heads. What is each head's dimension?",
          options: ["128", "4,096", "32", "512"],
          answer: 0,
          explain: "Multi-head attention splits the model width across heads: 4,096 / 32 = 128 dimensions per head. The heads run in parallel on these smaller projections, and their outputs are concatenated back to 4,096 and mixed by an output projection."
        },
        {
          q: "Why must a transformer be given positional information?",
          options: [
            "It makes attention faster on GPUs",
            "It shrinks the vocabulary",
            "Attention on its own is order-blind: shuffle the inputs and the outputs are shuffled identically, so 'dog bites man' and 'man bites dog' look the same",
            "Only encoder models need it; decoders infer order from the causal mask alone"
          ],
          answer: 2,
          explain: "Attention computes weighted sums over a set, with no notion of which token came first. Positional schemes — sinusoidal or learned vectors, or rotary embeddings applied to queries and keys — inject order so the model can tell subject from object."
        },
        {
          q: "Ignoring embeddings, about how many parameters does a decoder-only model with 32 layers and d_model = 4,096 have?",
          options: ["About 0.5 billion", "About 6.4 billion, from roughly 12 × layers × d_model²", "About 175 billion", "About 64 billion"],
          answer: 1,
          explain: "Each block has about 4d² in the attention projections and about 8d² in a feed-forward layer that expands to 4d, so roughly 12d² per layer. 12 × 32 × 4,096² ≈ 6.4 billion; adding a 32k-entry embedding table brings it close to the familiar 7B size."
        }
      ]
    },
    "core-generation": {
      title: "Generation checkpoint",
      sub: "Next-token prediction, sampling, the KV cache and hallucinations.",
      questions: [
        {
          q: "With logits 3.0, 1.5, 1.0 and −1.0, what does lowering the temperature from 1.0 to 0.5 do?",
          options: [
            "It flattens the distribution so all four tokens become more likely",
            "Nothing, because temperature only changes which token is the argmax",
            "It sharpens the distribution: the logits are doubled before the softmax, so the top token's share rises from about 0.73 to about 0.94",
            "It deletes the two least likely tokens"
          ],
          answer: 2,
          explain: "Temperature divides the logits before the softmax. Dividing by 0.5 doubles every gap between scores, and because softmax is exponential the leader takes even more of the mass. The argmax never changes; only how peaked the distribution is."
        },
        {
          q: "What does top-p (nucleus) sampling with p = 0.9 do?",
          options: [
            "Keeps the smallest set of most-likely tokens whose probabilities add up to at least 0.9, renormalises them, and samples from that set",
            "Keeps exactly 90% of the vocabulary",
            "Multiplies every probability by 0.9",
            "Keeps the nine most likely tokens"
          ],
          answer: 0,
          explain: "Top-p adapts to the shape of the distribution: when the model is confident the nucleus may be one or two tokens, and when it is unsure it widens. In the lesson's example at temperature 1, the top two tokens hold 0.888, so a third is needed to reach 0.9."
        },
        {
          q: "A model has 32 layers, 8 KV heads and head dimension 128, with an fp16 cache. How much KV-cache memory does one 32,768-token sequence need?",
          options: ["512 MiB", "1 GiB", "16 GiB", "4 GiB"],
          answer: 3,
          explain: "2 × 32 × 8 × 128 × 2 bytes = 131,072 bytes (128 KiB) per token. Multiplied by 32,768 tokens that is 4 GiB. With 32 KV heads instead of 8 it would be 16 GiB, which is why grouped-query attention matters for long contexts."
        },
        {
          q: "Why do inference engines keep a KV cache?",
          options: [
            "To store the model weights in faster memory",
            "To keep every layer's keys and values for past tokens, so each decode step computes attention for the new token only instead of reprocessing the whole prefix",
            "To remember answers to repeated questions across users",
            "To compress the prompt into fewer tokens"
          ],
          answer: 1,
          explain: "Past tokens' keys and values never change once computed, because of the causal mask. Caching them turns each decode step from re-running the full sequence into one new row of work per layer. The price is memory that grows linearly with context length and batch size."
        },
        {
          q: "An assistant invents plausible but wrong details about your company's internal policies. Which mitigation addresses the cause best?",
          options: [
            "Raise the temperature so it explores more answers",
            "Add 'be accurate and do not make things up' to the prompt and change nothing else",
            "Retrieve the relevant policy passages, require answers to cite them, allow 'I don't know' when nothing supports an answer, and check the citations",
            "Switch to greedy decoding"
          ],
          answer: 2,
          explain: "The model never saw your internal policies, so it fills the gap with likely-sounding text. Grounding supplies the facts, citations make claims checkable, and an explicit abstain path removes the pressure to guess. Instructions alone or decoding changes do not supply missing knowledge."
        },
        {
          "q": "Speculative decoding uses a small draft model to propose four tokens that the large model then checks. Why does this speed generation up without changing the output distribution?",
          "options": [
            "The draft model's tokens are always accepted, so the large model runs less often",
            "The large model verifies all drafted tokens in one forward pass, which costs about as much as generating one token because decode is bandwidth-bound, and the acceptance rule keeps samples distributed exactly as the large model's",
            "It lowers the temperature so fewer tokens are needed",
            "It skips the KV cache, which is the slow part of decoding"
          ],
          "answer": 1,
          "explain": "Checking k proposed tokens in one target pass is nearly free compared with k separate passes, because each pass is dominated by streaming the weights. Rejected tokens are replaced with the target's own choice, and the standard accept/reject rule guarantees the same distribution as sampling the target directly."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.core = {
    id: "core",
    name: "How LLMs Work",
    short: "CORE",
    tagline: "Inside the next-token machine",
    color: "#22d3ee",
    blurb: "Open the box. Attention with real numbers, multi-head attention and positional encoding, the decoder-only transformer end to end; then generation itself — next-token prediction, temperature and top-p, context windows and the KV cache, how serving engines make inference fast, and the honest reasons models hallucinate.",
    modules: [
      {
        id: "transformer",
        name: "The Transformer",
        icon: "blocks",
        lessons: [
          {
            id: "attention",
            title: "Attention, intuitively",
            summary: "Queries, keys and values — and a three-token attention calculation you can check by hand.",
            minutes: 11,
            tags: ["attention", "self-attention", "transformer", "qkv"],
            blocks: [
              { t: "p", html: "Attention lets every token gather information from every other token in one step. Each token produces three vectors: a <strong>query</strong> ('what am I looking for?'), a <strong>key</strong> ('what do I contain?') and a <strong>value</strong> ('what will I hand over if chosen?'). A token's output is a weighted average of all the values, weighted by how well its query matches each key." },
              { t: "table", headers: ["Vector", "Made by", "Role", "Library analogy"], rows: [
                ["Query (q)", "x · W_Q", "Asks the question", "The topic you type into the catalogue"],
                ["Key (k)", "x · W_K", "Gets matched against queries", "The subject label on each book"],
                ["Value (v)", "x · W_V", "Content that is mixed into the output", "The book's actual pages"]
              ] },
              { t: "h", text: "The formula" },
              { t: "code", lang: "text", code:
                "Attention(Q, K, V) = softmax( Q · Kᵀ / √d_k ) · V\n\n" +
                "Q, K : [n tokens, d_k]     V : [n, d_v]\n" +
                "Q·Kᵀ : [n, n]   one score for every (query, key) pair\n" +
                "softmax is applied row by row, so each query's weights sum to 1\n" +
                "output: [n, d_v]   one blended value vector per token"
              },
              { t: "h", text: "A three-token worked example" },
              { t: "code", lang: "text", code:
                "tokens: the  cat  sat         d_k = 2, so scale by √2 ≈ 1.414\n" +
                "q:  the [1,0]   cat [0,1]   sat [1,1]\n" +
                "k:  the [1,0]   cat [0,2]   sat [1,1]\n" +
                "v:  the [1,0]   cat [0,1]   sat [1,1]\n\n" +
                "Query = sat [1,1]\n" +
                "raw scores  q·k :  the 1    cat 2      sat 2\n" +
                "scaled  ÷ √2    :  0.707    1.414      1.414\n" +
                "exp             :  2.028    4.113      4.113     (sum 10.254)\n" +
                "weights         :  0.198    0.401      0.401\n\n" +
                "output = 0.198·[1,0] + 0.401·[0,1] + 0.401·[1,1] = [0.599, 0.802]"
              },
              { t: "widget", id: "coreAttention" },
              { t: "p", html: "Notice what happened: 'sat' pulled mostly from 'cat' and itself, because its query aligned with those keys. In a trained model the projections W_Q, W_K and W_V are learned, so a verb can learn to look for its subject, a pronoun for its referent. Unlike a recurrent network, which passes information along one step at a time (see <a class='inline' href='#/hist/before/rnn-lstm'>RNNs, LSTMs and seq2seq</a>), the first and the thousandth token are one hop apart." },
              { t: "h", text: "The cost" },
              { t: "stat", items: [
                { v: "1M", k: "scores for 1K tokens (per head, per layer)" },
                { v: "64M", k: "scores for 8K tokens" },
                { v: "≈17B", k: "scores for 128K tokens" }
              ] },
              { t: "note", variant: "warn", html: "Attention compares every token with every other, so compute grows with the <strong>square</strong> of sequence length. Optimised kernels such as FlashAttention compute the same exact result without materialising the full n × n matrix, which saves memory and time — but the quadratic arithmetic is still there." },
              { t: "note", variant: "tip", html: "Drag queries and keys around in the attention pane of the <a class='inline' href='#/playground'>LLM playground</a>. <strong>Say it out loud:</strong> 'Each token's query is dotted with every key, scaled by root d_k, softmaxed into weights, and those weights mix the values. It gives one-hop access to any token at quadratic cost in length.'" },
              { t: "note", variant: "key", html: "<strong>softmax(QKᵀ/√d_k)·V.</strong> Queries pick, keys get picked, values get mixed. Any token can reach any other in one step, and the price is n² work in sequence length." }
            ]
          },
          {
            id: "multi-head",
            title: "Multi-head attention and positional encoding",
            summary: "Why attention runs as many small heads in parallel, and how a model knows word order.",
            minutes: 10,
            tags: ["multi-head-attention", "positional-encoding", "rope", "gqa"],
            blocks: [
              { t: "p", html: "One attention pattern per token is limiting: a word may need its subject, its object and the previous word all at once. <strong>Multi-head attention</strong> runs several smaller attentions side by side, each with its own learned projections, then stitches the results back together." },
              { t: "code", lang: "text", code:
                "d_model = 4,096      heads = 32      head_dim = 4,096 / 32 = 128\n\n" +
                "for each head h:   Q_h, K_h, V_h = x·W_Q[h], x·W_K[h], x·W_V[h]   # [n, 128] each\n" +
                "                   out_h = softmax(Q_h·K_hᵀ / √128) · V_h\n" +
                "concat(out_1 .. out_32)  -> [n, 4,096]\n" +
                "output = concat · W_O                                          # mixes the heads\n\n" +
                "Same parameter count and FLOPs as one 4,096-wide head, but 32 separate patterns."
              },
              { t: "table", headers: ["Pattern researchers have observed", "What the head tends to do"], rows: [
                ["Previous-token head", "Attends mostly to the token immediately before"],
                ["Syntactic heads", "Link verbs to subjects, or adjectives to their nouns"],
                ["Induction / copy heads", "Find an earlier occurrence of the current token and look at what followed it — a building block of in-context learning"],
                ["Broad or 'sink' heads", "Spread weight thinly or park it on the first token when nothing is relevant"]
              ] },
              { t: "note", variant: "trap", html: "Nobody assigns heads their jobs. Roles emerge from training, many heads are messy or redundant, and some can be removed with little loss. Treat clean head roles as findings about specific models, not a design spec." },
              { t: "h", text: "Why position must be added" },
              { t: "p", html: "Attention is a weighted sum over a <em>set</em>. Shuffle the input tokens and every output is shuffled the same way, with identical values. Without extra information, 'dog bites man' and 'man bites dog' are indistinguishable. Positional encoding injects order." },
              { t: "table", headers: ["Scheme", "Mechanism", "Strength", "Weakness"], rows: [
                ["Sinusoidal (2017 paper)", "Add fixed sine and cosine waves of different frequencies to each embedding", "No parameters; defined for any position", "Extrapolates poorly beyond trained lengths in practice"],
                ["Learned absolute", "Add a learned vector per position index", "Simple and flexible", "Hard limit at the maximum trained position"],
                ["RoPE (rotary)", "Rotate each query and key pair of dimensions by an angle proportional to position", "q·k then depends on the relative offset; widely used in open-weight LLMs", "Needs scaling tricks to stretch to much longer contexts"],
                ["ALiBi", "Subtract a penalty from scores proportional to distance", "Extrapolates to longer inputs gracefully", "Builds in a recency bias"]
              ] },
              { t: "p", html: "RoPE's trick is worth one sentence: because the query at position m and the key at position n are rotated by angles proportional to m and n, their dot product depends only on <strong>m − n</strong>. The model sees how far apart two tokens are, not their absolute slots." },
              { t: "h", text: "Sharing keys and values: MQA and GQA" },
              { t: "table", headers: ["Variant", "KV heads (for 32 query heads)", "KV-cache size", "Quality"], rows: [
                ["Multi-head (MHA)", "32", "1×", "Baseline"],
                ["Grouped-query (GQA)", "8 (4 query heads share each)", "0.25×", "Close to MHA; the common modern default"],
                ["Multi-query (MQA)", "1", "1/32×", "Cheapest, with a measurable quality cost"]
              ] },
              { t: "note", variant: "tip", html: "Why KV heads matter so much for serving memory is worked through in <a class='inline' href='#/core/generation/context-kv'>context windows and the KV cache</a>. <strong>Say it out loud:</strong> 'Heads split the width so the model can attend to several things at once; rotary embeddings make scores depend on relative position; GQA shares keys and values across heads to cut cache memory.'" },
              { t: "note", variant: "key", html: "<strong>Many small heads, plus a sense of order.</strong> Multi-head attention gives parallel relationship patterns at no extra cost; positional encoding, usually RoPE today, breaks attention's order-blindness; GQA trims the memory bill." }
            ]
          },
          {
            id: "decoder-only",
            title: "The decoder-only transformer, end to end",
            summary: "From token ids to next-token probabilities through a stack of identical blocks — and where the parameters live.",
            minutes: 12,
            tags: ["transformer", "decoder-only", "residual-stream", "architecture"],
            blocks: [
              { t: "p", html: "Hold one picture: a <strong>residual stream</strong> — one vector per token — flows up through a stack of identical blocks. Each block reads the stream, computes something (attention mixes information across tokens, the feed-forward layer transforms each token on its own) and <em>adds</em> its result back. At the top, the last token's vector is turned into a score for every word in the vocabulary." },
              { t: "diagram", id: "transformer-block", caption: "One decoder block: normalise, causal self-attention, add; normalise, feed-forward, add. A model stacks dozens of these." },
              { t: "ol", items: [
                "<strong>Tokenize</strong> the text into ids.",
                "<strong>Embed</strong>: look each id up in the embedding table to get a d_model-wide vector.",
                "<strong>Blocks × L</strong>: each block applies causal multi-head attention and a feed-forward network, each wrapped in normalisation and a residual add. Position enters through RoPE inside attention (or an added positional vector in older designs).",
                "<strong>Final norm</strong>, then the <strong>unembedding</strong>: multiply by a [d_model, vocab] matrix to get one logit per vocabulary entry.",
                "<strong>Softmax</strong> the last position's logits into a next-token distribution, pick a token, append it, repeat."
              ] },
              { t: "code", lang: "text", code:
                "x = embed(token_ids)                       # [n, d]\n" +
                "for block in blocks:                       # L times\n" +
                "    x = x + attention(norm(x), causal=True) # tokens exchange information\n" +
                "    x = x + mlp(norm(x))                    # each token transformed independently\n" +
                "logits = norm(x) @ W_unembed               # [n, vocab]\n" +
                "next_token_probs = softmax(logits[-1])"
              },
              { t: "h", text: "Where the parameters live" },
              { t: "code", lang: "text", code:
                "per block, width d:\n" +
                "  attention  W_Q, W_K, W_V, W_O      ≈ 4 d²\n" +
                "  MLP        d -> 4d -> d            ≈ 8 d²\n" +
                "  total                              ≈ 12 d²\n\n" +
                "d = 4,096, L = 32:   12 × 32 × 4,096² ≈ 6.44 B\n" +
                "embeddings: 32,000 × 4,096          ≈ 0.13 B\n" +
                "                                    ≈ 6.6 B  -> the familiar '7B' class"
              },
              { t: "table", headers: ["Family", "Attention", "Good at", "Examples of use"], rows: [
                ["Encoder-only", "Bidirectional: every token sees every other", "Understanding: classification, embeddings, extraction", "Search embeddings, sentiment, entity tagging"],
                ["Encoder-decoder", "Encoder bidirectional; decoder causal plus cross-attention to the encoder", "Input-to-output mapping", "Translation, summarisation"],
                ["Decoder-only", "Causal only", "Open-ended generation, and with scale almost everything else", "Today's chat and coding assistants"]
              ] },
              { t: "h", text: "Training and generating with the same stack" },
              { t: "p", html: "In training, the whole sequence goes through at once. The causal mask means position 5 only sees positions 1–5, so every position predicts its own next token in parallel — thousands of training signals per forward pass. In generation there is no future to hide: the model produces one token, appends it and runs again. Same weights, same mask, very different performance profile, which the <a class='inline' href='#/core/generation/next-token'>next-token</a> lesson unpacks." },
              { t: "table", headers: ["Tier", "Answer to 'how does an LLM produce text?'", "Why it scores that way"], rows: [
                ["Naive", "'It searches its training data for the answer.'", "Wrong mechanism; there is no lookup, only weights"],
                ["Solid", "'Tokens are embedded, pass through stacked attention and MLP blocks, and the output is a probability over the next token, sampled in a loop.'", "Correct pipeline"],
                ["Standout", "Solid, plus the residual stream, the causal mask enabling parallel training, the ≈12·L·d² parameter estimate, and why decode is memory-bound", "Shows you can reason about cost and behaviour, not just recite"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'A decoder-only transformer is embeddings, then L blocks of causal attention plus MLP on a residual stream, then an unembedding to vocabulary logits. Parameters are about 12 L d², so 32 layers at 4,096 wide is roughly 7B.'" },
              { t: "quiz", id: "core-transformer" },
              { t: "note", variant: "key", html: "<strong>Embed → (attention + MLP) × L on a residual stream → unembed → softmax.</strong> The causal mask lets training predict every position at once, while generation runs the same stack one token at a time." }
            ]
          }
        ]
      },
      {
        id: "generation",
        name: "Generation",
        icon: "bolt",
        lessons: [
          {
            id: "next-token",
            title: "Next-token prediction",
            summary: "One function from context to a probability distribution, wrapped in a loop — plus loss, perplexity, prefill and decode.",
            minutes: 9,
            tags: ["next-token", "autoregressive", "perplexity", "prefill", "decode"],
            blocks: [
              { t: "p", html: "An LLM is one function: given the tokens so far, return a probability for every token in the vocabulary being next. Everything you see — answers, code, essays — comes from calling that function, choosing a token, appending it and calling it again. This is <strong>autoregressive</strong> generation." },
              { t: "code", lang: "python", code:
                "def generate(model, tokenizer, prompt, max_new_tokens=200):\n" +
                "    ids = tokenizer.encode(prompt)\n" +
                "    for _ in range(max_new_tokens):\n" +
                "        probs = model.next_token_probs(ids)   # one forward pass\n" +
                "        nxt = sample(probs)                   # greedy, temperature, top-p ...\n" +
                "        if nxt == tokenizer.eos_id:\n" +
                "            break\n" +
                "        ids.append(nxt)\n" +
                "    return tokenizer.decode(ids)"
              },
              { t: "h", text: "Logits, softmax and probabilities" },
              { t: "p", html: "The last layer produces a <strong>logit</strong> — an unbounded score — for each of the tens of thousands of vocabulary entries. Softmax turns them into probabilities that sum to 1. For the prompt 'The capital of France is', the top of that list might look like this:" },
              { t: "table", headers: ["Candidate", "Logit", "Probability (softmax)"], rows: [
                [" Paris", "3.0", "0.726"],
                [" Lyon", "1.5", "0.162"],
                [" Nice", "1.0", "0.098"],
                [" pizza", "−1.0", "0.013"]
              ] },
              { t: "h", text: "Measuring it: loss and perplexity" },
              { t: "p", html: "Training minimises the average cross-entropy: −ln of the probability given to the token that really came next. <strong>Perplexity</strong> is e raised to that loss, and reads as 'the model is as uncertain as if it were choosing uniformly among this many tokens'." },
              { t: "stat", items: [
                { v: "loss 2.0", k: "≈ perplexity 7.4" },
                { v: "loss 1.0", k: "≈ perplexity 2.7" },
                { v: "loss 0.69", k: "= perplexity 2 (a coin flip)" }
              ] },
              { t: "h", text: "Prefill and decode" },
              { t: "table", headers: ["Phase", "What happens", "Bottleneck", "User feels it as"], rows: [
                ["Prefill", "The whole prompt is processed in one parallel pass, filling the KV cache", "Compute-bound: big matrix multiplies", "Time to first token"],
                ["Decode", "One new token per step, each reading all the weights and the cache", "Memory-bandwidth-bound: weights are streamed for a single token", "Tokens per second while streaming"]
              ] },
              { t: "note", variant: "trap", html: "'It's just autocomplete' is technically the objective and practically misleading. Predicting the next token of code, proofs and dialogue well forces a model to represent a great deal about syntax, facts and intent. And assistants are further tuned after pretraining — see <a class='inline' href='#/train/align/rlhf'>RLHF, step by step</a> — so their behaviour is shaped by more than raw continuation." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'The model maps context to a distribution over the next token; generation is a loop of predict, pick, append. Prefill is compute-bound and sets time to first token; decode is bandwidth-bound and sets tokens per second.'" },
              { t: "note", variant: "key", html: "<strong>Context in, distribution out, repeat.</strong> Cross-entropy and perplexity measure how well that distribution matches real text; prefill and decode explain the two latencies users notice." }
            ]
          },
          {
            id: "sampling",
            title: "Sampling: temperature, top-k and top-p",
            summary: "How a probability distribution becomes one chosen token, with a four-token temperature example.",
            minutes: 10,
            tags: ["sampling", "temperature", "top-p", "top-k", "decoding"],
            blocks: [
              { t: "p", html: "The model proposes; the <strong>decoder</strong> disposes. The model outputs a distribution, and a sampling strategy decides which token actually gets emitted. These few knobs change output style more than most prompt edits, and they cost nothing to adjust." },
              { t: "diagram", id: "sampling-pipeline", caption: "Logits → optional penalties → divide by temperature → softmax → truncate with top-k or top-p → renormalise → sample one token." },
              { t: "h", text: "Temperature" },
              { t: "code", lang: "text", code:
                "logits:          Paris 3.0   Lyon 1.5   Nice 1.0   pizza -1.0\n" +
                "p_i = exp(z_i / T) / Σ exp(z_j / T)\n\n" +
                "T = 1.0   ->   0.726   0.162   0.098   0.013\n" +
                "T = 0.5   ->   0.936   0.047   0.017   0.000   (gaps doubled: sharper)\n" +
                "T = 2.0   ->   0.506   0.239   0.186   0.069   (gaps halved: flatter)\n" +
                "T -> 0    ->   1       0       0       0       (greedy: always the argmax)"
              },
              { t: "widget", id: "coreSoftmax" },
              { t: "h", text: "Truncation: top-k and top-p" },
              { t: "table", headers: ["Method", "Rule", "On the example at T = 1", "Weakness"], rows: [
                ["Greedy", "Always take the most likely token", "Paris, every time", "Repetitive loops in long outputs; no diversity"],
                ["Top-k (k = 2)", "Keep the k most likely, renormalise", "Paris 0.818, Lyon 0.182", "Fixed k is too wide when the model is sure and too narrow when it is not"],
                ["Top-p (p = 0.9)", "Keep the smallest top set with cumulative probability ≥ p", "0.726 + 0.162 = 0.888 < 0.9, so Nice joins: three tokens", "Can still admit junk when the tail is fat"],
                ["Min-p (0.1)", "Drop tokens below 0.1 × the top probability", "Threshold 0.073: keeps Paris, Lyon, Nice", "Newer; support varies by runtime"]
              ] },
              { t: "p", html: "A typical order is: apply repetition or presence penalties to the logits, divide by temperature, softmax, truncate with top-k and/or top-p, renormalise and draw. Libraries differ in the exact order and defaults, so set the parameters you care about explicitly rather than trusting a default." },
              { t: "table", headers: ["Tier", "Sampling policy", "Result"], rows: [
                ["Naive", "One temperature for every feature, left at the default", "Creative where you wanted exact, flat where you wanted lively"],
                ["Solid", "Low temperature (0–0.3) for extraction, classification and code; around 0.7–1.0 with top-p 0.9–0.95 for brainstorming and prose", "Behaviour matched to the task"],
                ["Standout", "Solid, plus constrained or structured output where a format is required, fixed seeds and several samples per case in evals, and settings versioned with the prompt", "Reproducible quality you can measure and roll back"]
              ] },
              { t: "note", variant: "warn", html: "Temperature 0 is not a determinism guarantee. Floating-point order on different hardware, batching with other requests and model updates can still change outputs. Evaluate on several runs and store the settings alongside every result." },
              { t: "note", variant: "tip", html: "Try the same prompt at different settings in the sampler pane of the <a class='inline' href='#/playground'>LLM playground</a>. <strong>Say it out loud:</strong> 'Temperature rescales logits before softmax; top-p keeps the smallest high-probability nucleus. I run extraction near zero and creative tasks around 0.8 with top-p 0.9.'" },
              { t: "note", variant: "key", html: "<strong>Temperature shapes the distribution; top-k and top-p cut its tail.</strong> Pick settings per task, set them explicitly, and never assume temperature 0 means identical outputs." }
            ]
          },
          {
            id: "context-kv",
            title: "Context windows and the KV cache",
            summary: "What fits in a model's working memory, and the memory formula that dominates LLM serving.",
            minutes: 11,
            tags: ["context-window", "kv-cache", "gqa", "serving", "memory"],
            blocks: [
              { t: "p", html: "The <strong>context window</strong> is the model's entire working memory for one call: system prompt, conversation history, retrieved documents, tool results <em>and</em> the tokens it generates, all counted together. Anything outside it does not exist for the model. Behind that limit sits a very physical cost: the KV cache." },
              { t: "stat", items: [
                { v: "4K → 1M+", k: "range of context sizes across today's models" },
                { v: "input + output", k: "both count against the window" },
                { v: "linear", k: "KV-cache growth per token" }
              ] },
              { t: "h", text: "Why a KV cache exists" },
              { t: "p", html: "Generating token 1,001 needs the keys and values of tokens 1–1,000 at every layer. Because of the causal mask, those never change once computed. So engines store them — the <strong>KV cache</strong> — and each decode step computes keys and values only for the newest token. That turns decoding from quadratic recomputation into one new row per step, at the price of memory." },
              { t: "code", lang: "text", code:
                "KV bytes = 2 (K and V) × layers × kv_heads × head_dim × bytes_per_value × tokens\n\n" +
                "7B-class shape, full multi-head attention, fp16, 4,096 tokens:\n" +
                "  2 × 32 × 32 × 128 × 2 B = 524,288 B = 512 KiB per token\n" +
                "  × 4,096 tokens          = 2 GiB per sequence\n\n" +
                "Same depth with GQA (8 KV heads), fp16, 32,768 tokens:\n" +
                "  2 × 32 × 8 × 128 × 2 B  = 128 KiB per token\n" +
                "  × 32,768 tokens         = 4 GiB per sequence\n\n" +
                "70B-class shape (80 layers, 8 KV heads, 128 dim), fp16, 4,096 tokens:\n" +
                "  2 × 80 × 8 × 128 × 2 B × 4,096 = 1.25 GiB per sequence"
              },
              { t: "widget", id: "coreKvCache" },
              { t: "table", headers: ["Lever", "How it shrinks the cache", "Cost"], rows: [
                ["Grouped / multi-query attention", "Fewer KV heads: 32 → 8 is a 4× saving", "Decided at training time; slight quality trade"],
                ["Quantised KV cache", "fp16 → fp8 halves it", "Small accuracy risk on long, precise tasks"],
                ["Sliding-window attention", "Only the last W tokens are kept for some or all layers", "Distant tokens are no longer directly visible"],
                ["Paged allocation", "Allocates the cache in fixed blocks instead of one worst-case slab, so far less is wasted (the idea behind vLLM's paged attention)", "Engine complexity"],
                ["Prefix / prompt caching", "Reuse the cache of a shared system prompt across requests", "Only helps when prefixes repeat exactly"]
              ] },
              { t: "h", text: "Long context is not free" },
              { t: "ul", items: [
                "You pay per input token on every call, so a 100K-token context repeated across a chat adds up fast.",
                "Prefill time, and therefore time to first token, grows with prompt length.",
                "Cache memory per sequence limits how many users one GPU can serve at once.",
                "Models often use material at the start and end of a long context more reliably than material buried in the middle; test retrieval of facts at different depths before trusting a huge window."
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas covers batching, throughput and GPU capacity planning at system-design depth in <em>HLD › AI &amp; ML › LLM systems &amp; serving</em>." },
              { t: "note", variant: "tip", html: "Deciding whether to stuff the window or retrieve selectively is its own lesson: <a class='inline' href='#/rag/context/long-context-vs-rag'>long context vs RAG</a>. <strong>Say it out loud:</strong> 'KV cache is 2 × layers × KV heads × head dim × bytes × tokens. For a 7B model in fp16 that is half a megabyte per token, so concurrency, not weights, is often what runs out first.'" },
              { t: "note", variant: "key", html: "<strong>Everything the model sees and says shares one window, and every token in it costs cache memory.</strong> Memorise the formula — 2 × layers × kv_heads × head_dim × bytes × tokens — and reach for GQA, cache quantisation and paging when it gets big." }
            ]
          },
          {
            "id": "inference-speed",
            "title": "Fast inference: FlashAttention, batching and speculative decoding",
            "summary": "Why serving engines are fast: fused attention kernels, continuous batching, paged caches and draft-and-verify decoding.",
            "minutes": 11,
            "tags": [
              "inference",
              "flash-attention",
              "continuous-batching",
              "speculative-decoding",
              "serving"
            ],
            "blocks": [
              {
                "t": "p",
                "html": "The same weights can serve one user at a crawl or hundreds at once. The difference is the <strong>inference engine</strong>: how it moves data through GPU memory, how it packs requests together and how many tokens it can commit per forward pass. Four ideas explain most of the gap."
              },
              {
                "t": "h",
                "text": "1. FlashAttention: same maths, less memory traffic"
              },
              {
                "t": "p",
                "html": "Naive attention writes the full n × n score matrix to GPU main memory, reads it back for the softmax, then reads it again to mix the values. On modern GPUs that memory traffic, not the arithmetic, is the bottleneck. <strong>FlashAttention</strong> splits queries, keys and values into tiles that fit in fast on-chip memory, computes the softmax incrementally with a running maximum and sum, and never stores the full matrix. The result is <em>exactly</em> the same attention output, with memory that grows linearly instead of quadratically and a large speed-up on long sequences."
              },
              {
                "t": "code",
                "lang": "text",
                "code": "naive:  S = Q·Kᵀ  -> write n×n to HBM -> read -> softmax -> write -> read -> ·V\nflash:  for each tile of Q:\n          for each tile of K, V:\n            scores in on-chip SRAM, update running max m and sum l\n            rescale the partial output, accumulate tile · V\n        output written once; the n×n matrix never exists in HBM"
              },
              {
                "t": "note",
                "variant": "trap",
                "html": "FlashAttention is not an approximation and does not change attention's quadratic arithmetic. It is an IO-aware <em>implementation</em>. Sparse or sliding-window attention are the techniques that actually change what is computed."
              },
              {
                "t": "h",
                "text": "2. Continuous batching"
              },
              {
                "t": "p",
                "html": "Decode is memory-bandwidth-bound: every step streams all the weights to produce one token per sequence. Serving 32 sequences in the same step costs barely more than serving one, so batching is where throughput comes from. Static batching waits for the slowest request in a batch to finish. <strong>Continuous (in-flight) batching</strong> admits new requests and retires finished ones at every decode step, so the GPU stays full."
              },
              {
                "t": "table",
                "headers": [
                  "Technique",
                  "What it fixes",
                  "Trade-off"
                ],
                "rows": [
                  [
                    "Static batching",
                    "Amortises weight reads across requests",
                    "Short requests wait for long ones; idle slots"
                  ],
                  [
                    "Continuous batching",
                    "Fills freed slots every step",
                    "Scheduler complexity; per-request latency varies with load"
                  ],
                  [
                    "Paged KV cache",
                    "Allocates cache in small blocks, so many more sequences fit",
                    "Block tables and custom kernels"
                  ],
                  [
                    "Chunked prefill",
                    "Splits long prompts so they do not stall everyone's decode",
                    "Slightly slower first token for the long prompt"
                  ],
                  [
                    "Prefix caching",
                    "Reuses the cache of shared system prompts",
                    "Only helps exact shared prefixes"
                  ]
                ]
              },
              {
                "t": "h",
                "text": "3. Speculative decoding: draft, then verify"
              },
              {
                "t": "p",
                "html": "A small, fast <strong>draft</strong> model proposes the next few tokens. The large <strong>target</strong> model scores all of them in a single forward pass — checking k tokens costs about the same as generating one, because the pass is bandwidth-bound. Accepted tokens are kept; at the first rejection the target's own choice is used and drafting restarts. With the standard acceptance rule the output distribution is identical to sampling from the target alone."
              },
              {
                "t": "code",
                "lang": "text",
                "code": "draft proposes:   ' the'  ' cat'  ' sat'  ' on'      (4 cheap steps)\ntarget verifies:  ✓       ✓       ✓       ✗ -> ' upon'  (1 expensive pass)\ncommitted:        ' the cat sat upon'  = 4 tokens for ~1 target pass\n\nspeed-up depends on acceptance rate: high for code and boilerplate,\nlower for creative text where the draft guesses wrong more often"
              },
              {
                "t": "ul",
                "items": [
                  "<strong>Variants</strong> drop the separate draft model: extra prediction heads on the target, or n-gram lookup in the prompt (great when the answer copies the input, as in code edits).",
                  "<strong>It speeds up latency, not throughput,</strong> at large batch sizes, where the GPU is already busy; engines often disable it under heavy load.",
                  "<strong>Quantization</strong> is the fourth lever: fewer bytes per weight means fewer bytes streamed per token. See <a class='inline' href='#/local/why/quantization'>quantization</a>."
                ]
              },
              {
                "t": "note",
                "variant": "tip",
                "html": "<strong>Go deeper.</strong> Capacity planning, GPU counts and serving topologies are system-design questions covered in the Blueprint atlas under <em>HLD › AI &amp; ML › LLM systems &amp; serving</em>. <strong>Say it out loud:</strong> 'FlashAttention tiles attention through on-chip memory so the n² matrix never hits main memory. Continuous batching and a paged KV cache keep the GPU full. Speculative decoding lets a cheap draft propose tokens the big model verifies in one pass, with the same output distribution.'"
              },
              {
                "t": "note",
                "variant": "key",
                "html": "<strong>Decode is bandwidth-bound, so the wins come from moving fewer bytes per useful token:</strong> fused attention kernels, batching many sequences per weight read, paging the cache, quantizing weights, and committing several tokens per pass with speculative decoding."
              }
            ]
          },
          {
            id: "hallucinations",
            title: "Why hallucinations happen",
            summary: "Fluent text is not checked text: the causes behind confident errors, and the mitigations that actually work.",
            minutes: 10,
            tags: ["hallucinations", "grounding", "reliability", "rag"],
            blocks: [
              { t: "p", html: "A <strong>hallucination</strong> is fluent, confident output that is false or unsupported. The mental model: the model is trained to produce the most <em>plausible</em> continuation, and plausible is not the same as true. When the right answer is missing, the most plausible text is often a confident-sounding guess." },
              { t: "table", headers: ["Cause", "What is going on", "Symptom"], rows: [
                ["Next-token objective", "Training rewards text that looks like the training data, not text that is verified", "Answers in the right style with the wrong facts"],
                ["No truth oracle", "Nothing inside the model checks a claim against the world; knowledge is smeared across weights", "Plausible-looking citations, URLs or API names that do not exist"],
                ["Knowledge cutoff", "Training data stops at some date, and private data was never seen at all", "Stale versions, invented details about internal systems"],
                ["Sampling", "Randomness can pick a lower-probability, wrong continuation; once written, later tokens build on it", "A wrong early token snowballs into a wrong paragraph"],
                ["Pressure to answer", "Tuning toward helpfulness can reward answering over abstaining, and leading questions invite agreement", "Agreeing with a false premise in the prompt"]
              ] },
              { t: "h", text: "A tiny illustration" },
              { t: "code", lang: "text", code:
                "Prompt: \"Who wrote the 2019 paper 'Sparse Lattice Routing for Graph Transformers'?\"\n" +
                "        (no such paper exists)\n\n" +
                "Illustrative next-token distribution after 'The paper was written by':\n" +
                "  ' Dr'  0.21   ' Zhang'  0.14   ' a'  0.09   ' researchers'  0.08   ...\n" +
                "  ' I'   0.02   <- the start of \"I can't find a record of that paper\"\n\n" +
                "Every option above 'I' is a fluent continuation. Without grounding or an explicit\n" +
                "permission to abstain, the likely path is a confident, invented author list."
              },
              { t: "h", text: "Mitigations that work" },
              { t: "table", headers: ["Tier", "Approach", "Effect"], rows: [
                ["Naive", "Add 'do not hallucinate' to the prompt", "Barely moves the rate; the model cannot follow an instruction to know what it does not know"],
                ["Solid", "Ground with retrieval (RAG), instruct the model to answer only from the provided sources, cite them, and say 'I don't know' when they do not cover the question", "Supplies the missing facts and removes the pressure to guess"],
                ["Standout", "Solid, plus verification: check each citation exists and supports its claim, use tools for maths, dates and lookups, measure the unsupported-claim rate in evals, and route high-stakes answers to human review", "Errors become measurable and catchable rather than just rarer"]
              ] },
              { t: "code", lang: "text", code:
                "System prompt excerpt (abstain path):\n" +
                "Answer using ONLY the passages inside <sources>. Cite the passage id after each claim, like [S2].\n" +
                "If the passages do not contain the answer, reply exactly: \"I don't know based on the provided sources.\"\n" +
                "Do not use outside knowledge for facts about our products or policies."
              },
              { t: "ul", items: [
                "<strong>Lower temperature</strong> for factual tasks reduces random drift but cannot supply missing knowledge.",
                "<strong>Ask for quotes</strong> before conclusions: extracting the supporting sentence first makes unsupported claims easier to spot.",
                "<strong>Use tools</strong> — a calculator, a search, a database query — for anything with a single checkable answer.",
                "<strong>Verify automatically</strong>: a second pass or a smaller model checks that each claim is entailed by its cited passage."
              ] },
              { t: "note", variant: "warn", html: "Retrieval reduces hallucinations; it does not end them. A model can misread a passage, merge two sources, or ignore the context in favour of what it learned in training. Keep the verification step." },
              { t: "note", variant: "tip", html: "Grounding is built properly in <a class='inline' href='#/rag/retrieval/why-rag'>why retrieval-augmented generation</a> and <a class='inline' href='#/rag/quality/grounding'>grounding and citations</a>; measuring it is in <a class='inline' href='#/ops/evals/evals'>evals: golden sets and regression testing</a>. <strong>Say it out loud:</strong> 'Hallucinations come from optimising for plausible text with no truth check. I ground answers in retrieved sources, require citations, give the model an explicit way to abstain, and verify claims in evals.'" },
              { t: "quiz", id: "core-generation" },
              { t: "note", variant: "key", html: "<strong>Plausible is not true.</strong> Hallucinations follow from the next-token objective, missing knowledge and sampling; the fix is to supply facts (grounding), make claims checkable (citations), allow abstaining, and verify." }
            ]
          }
        ]
      }
    ]
  };
})();
