/* =====================================================================
   LUMEN · Evolution of Language Models
   window.TRACKS.hist — modules: before / era / modern

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

  var Widgets = {};

  /* ==================================================================
     1. histTimeline — step through eras: what changed, what it solved,
        and which bottleneck it left for the next era.
  ================================================================== */
  var ERAS = [
    { id: "rules", tab: "Rules", years: "1960s–1980s", name: "Hand-written rules",
      changed: "Programs matched keywords and sentence templates written by people, and answered from scripted responses (ELIZA, expert systems).",
      solved: "Showed a machine could hold a superficially convincing conversation with no data at all.",
      limit: "Coverage ended where the rules ended; nothing generalised to unseen phrasing." },
    { id: "stats", tab: "n-grams", years: "1980s–2000s", name: "Statistical language models",
      changed: "Probabilities of the next word were estimated by counting short word sequences in large text collections.",
      solved: "Replaced hand rules with data; powered speech recognition and statistical machine translation.",
      limit: "Sparsity: most long word sequences never appear in training, and context is only a few words." },
    { id: "vectors", tab: "word2vec", years: "2013", name: "Learned word vectors",
      changed: "A shallow network learned a dense vector per word by predicting neighbouring words.",
      solved: "Similar words got similar vectors, so knowledge transferred between related words.",
      limit: "One vector per word regardless of context, and no model of whole sentences." },
    { id: "rnn", tab: "seq2seq", years: "2014–2016", name: "RNNs, LSTMs and seq2seq with attention",
      changed: "Recurrent encoders read a sentence into hidden states; a decoder generated output, attending back over those states.",
      solved: "End-to-end neural translation and summarisation; attention removed the single fixed-vector bottleneck.",
      limit: "Strictly sequential computation: training could not parallelise across time steps." },
    { id: "transformer", tab: "Transformer", years: "2017", name: "Attention is all you need",
      changed: "Recurrence was dropped; stacked self-attention and feed-forward layers processed every position at once.",
      solved: "Massive parallelism on GPUs and direct paths between any two tokens.",
      limit: "Still trained per task; attention cost grows with the square of sequence length." },
    { id: "pretrain", tab: "BERT / GPT", years: "2018–2019", name: "Pretrain, then adapt",
      changed: "One large model was pretrained on unlabelled text (masked or causal objective) and fine-tuned for many tasks.",
      solved: "Small labelled datasets became enough, because the model already knew the language.",
      limit: "Each task still needed fine-tuning and engineering around a model that only completed text." },
    { id: "scale", tab: "Scale", years: "2020–2022", name: "GPT-3 and scaling laws",
      changed: "Models and datasets were scaled by orders of magnitude, guided by empirical scaling laws.",
      solved: "In-context learning: a few examples in the prompt replaced fine-tuning for many tasks.",
      limit: "A raw base model continues documents; it does not reliably follow instructions." },
    { id: "assistant", tab: "Assistants", years: "2022", name: "Instruction tuning, RLHF and ChatGPT",
      changed: "Supervised demonstrations plus learning from human preference rankings turned base models into assistants.",
      solved: "Anyone could ask in plain language and get a helpful, mostly on-topic answer.",
      limit: "Closed models behind APIs; hallucination and over-confidence remained." },
    { id: "open", tab: "Open weights", years: "2023–2024", name: "The open-weight wave",
      changed: "Capable weights were published (LLaMA, Llama 2, Mistral, Qwen, Gemma, DeepSeek), often under custom licences.",
      solved: "Local inference, cheap fine-tuning and research on models you can inspect.",
      limit: "Text-in, text-out models that answer in one pass, however hard the question." },
    { id: "reason", tab: "Multimodal + reasoning", years: "2023 onward", name: "Multimodal, reasoning models and agents",
      changed: "Models accepted images, then audio and video; some were trained to think at length before answering and to call tools in loops.",
      solved: "Harder multi-step problems and tasks that act on the world, not only describe it.",
      limit: "Cost and latency grow with thinking time; agent reliability and safety are open problems." }
  ];

  Widgets.histTimeline = function (mount) {
    shell(mount, "timeline", "Step through the eras",
      "Pick an era. Each step names what changed, which problem it solved, and the bottleneck it left behind, which is exactly what the next era attacked.");
    var idx = 4;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var seg = h("div", { class: "w-seg", style: "flex-wrap:wrap" });
    var btns = [];

    function paint() {
      var e = ERAS[idx];
      for (var b = 0; b < btns.length; b++) btns[b].className = "w-seg-btn" + (b === idx ? " active" : "");
      clear(stage);
      var rail = h("div", { style: "display:flex;gap:4px;margin-bottom:12px" });
      for (var i = 0; i < ERAS.length; i++) {
        rail.appendChild(h("i", { style: "flex:1;height:8px;border-radius:4px;background:" +
          (i < idx ? "var(--amber)" : i === idx ? "var(--accent)" : "var(--surface-solid)") +
          ";border:1px solid var(--line)" }));
      }
      stage.appendChild(rail);
      stage.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--amber-ink)" }, e.years));
      stage.appendChild(h("div", { style: "font-weight:600;font-size:1.02rem;margin:2px 0 10px" }, e.name));
      var rows = [["What changed", e.changed, "var(--cyan-ink)"], ["Problem it solved", e.solved, "var(--lime-ink)"], ["Bottleneck it left", e.limit, "var(--rose-ink)"]];
      for (var r = 0; r < rows.length; r++) {
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:150px 1fr;gap:10px;padding:5px 0;border-top:1px solid var(--line)" },
          h("span", { style: "font-size:0.8rem;font-weight:600;color:" + rows[r][2] }, rows[r][0]),
          h("span", { style: "font-size:0.88rem" }, rows[r][1])));
      }
      clear(readout);
      readout.appendChild(ro("era", e.years));
      readout.appendChild(ro("step", (idx + 1) + " of " + ERAS.length));
      readout.appendChild(ro("next era", idx + 1 < ERAS.length ? ERAS[idx + 1].tab : "still being written"));
    }

    for (var i = 0; i < ERAS.length; i++) {
      (function (n) {
        var b = h("button", { type: "button", class: "w-seg-btn" }, ERAS[n].tab);
        b.addEventListener("click", function () { idx = n; paint(); });
        btns.push(b);
        seg.appendChild(b);
      })(i);
    }
    var prev = h("button", { type: "button", class: "w-btn ghost" }, "Previous");
    var next = h("button", { type: "button", class: "w-btn primary" }, "Next era");
    prev.addEventListener("click", function () { if (idx > 0) { idx--; paint(); } });
    next.addEventListener("click", function () { if (idx < ERAS.length - 1) { idx++; paint(); } });

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      seg, h("div", { style: "display:flex;gap:8px" }, prev, next)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. histNgram — a bigram model counted from a tiny corpus.
        Shows sparsity (zero counts) and what add-one smoothing does.
  ================================================================== */
  var NG_CORPUS = "the cat sat on the mat . the dog sat on the rug . the cat saw the dog . the dog ran to the cat . a cat sat on a rug .";
  var NG_TOKENS = NG_CORPUS.split(" ");
  var NG_COUNTS = {};
  var NG_VOCAB = [];
  (function build() {
    var seen = {};
    for (var i = 0; i < NG_TOKENS.length; i++) {
      var w = NG_TOKENS[i];
      if (!seen[w]) { seen[w] = true; NG_VOCAB.push(w); }
      if (i < NG_TOKENS.length - 1) {
        var nxt = NG_TOKENS[i + 1];
        if (!NG_COUNTS[w]) NG_COUNTS[w] = {};
        NG_COUNTS[w][nxt] = (NG_COUNTS[w][nxt] || 0) + 1;
      }
    }
    NG_VOCAB.sort();
  })();

  function ngDist(ctx, smooth) {
    var row = NG_COUNTS[ctx] || {};
    var total = 0, w, out = [];
    for (w in row) if (Object.prototype.hasOwnProperty.call(row, w)) total += row[w];
    var V = NG_VOCAB.length;
    for (var i = 0; i < V; i++) {
      var c = row[NG_VOCAB[i]] || 0;
      var p = smooth ? (c + 1) / (total + V) : (total ? c / total : 0);
      out.push({ w: NG_VOCAB[i], c: c, p: p });
    }
    out.sort(function (a, b) { return b.p - a.p || (a.w < b.w ? -1 : 1); });
    return { list: out, total: total, V: V };
  }

  Widgets.histNgram = function (mount) {
    shell(mount, "toy model", "A bigram predictor you can read",
      "This model has seen only the " + NG_TOKENS.length + "-token corpus below. It predicts the next word from the previous word alone, using counts. Switch on add-one smoothing to see how unseen pairs stop being impossible.");
    var state = { ctx: "the", smooth: false, chain: "" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var sel = h("select", { class: "sim-select" });
    for (var i = 0; i < NG_VOCAB.length; i++) {
      var o = h("option", { value: NG_VOCAB[i] }, NG_VOCAB[i] === "." ? ". (end of sentence)" : NG_VOCAB[i]);
      if (NG_VOCAB[i] === state.ctx) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () { state.ctx = sel.value; state.chain = ""; paint(); });
    var gen = h("button", { type: "button", class: "w-btn primary" }, "Generate 8 words (greedy)");
    gen.addEventListener("click", function () {
      var cur = state.ctx, words = [cur];
      for (var s = 0; s < 8; s++) {
        var d = ngDist(cur, false);
        if (!d.total) break;
        cur = d.list[0].w;
        words.push(cur);
      }
      state.chain = words.join(" ");
      paint();
    });

    function paint() {
      var d = ngDist(state.ctx, state.smooth);
      clear(stage);
      stage.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.76rem;color:var(--text-dim);margin-bottom:10px" }, "corpus: " + NG_CORPUS));
      var shown = 0, zeroes = 0;
      for (var i = 0; i < d.list.length; i++) {
        var it = d.list[i];
        if (it.c === 0) { zeroes++; continue; }
        shown++;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:90px 1fr 70px;gap:10px;align-items:center;padding:3px 0" },
          h("span", { style: "font-family:var(--font-mono);font-size:0.84rem" }, "→ " + it.w),
          h("span", { style: "display:block;height:10px;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + Math.round(it.p * 100) + "%;background:var(--amber)" })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, (it.p * 100).toFixed(1) + "%")));
      }
      if (!shown) stage.appendChild(h("div", { style: "font-size:0.86rem" }, "This word never appears with a successor in the corpus, so the raw model has nothing to say."));
      var unseenP = state.smooth ? 1 / (d.total + d.V) : 0;
      stage.appendChild(h("div", { style: "font-size:0.82rem;color:var(--text-dim);margin-top:8px" },
        zeroes + " of " + d.V + " vocabulary words never followed \u201c" + state.ctx + "\u201d: each gets " + (unseenP * 100).toFixed(1) + "% " + (state.smooth ? "after smoothing." : "(impossible).")));
      clear(readout);
      readout.appendChild(ro("context", state.ctx));
      readout.appendChild(ro("pairs counted", d.total));
      readout.appendChild(ro("distinct successors", shown));
      readout.appendChild(ro("P(unseen pair)", (unseenP * 100).toFixed(1) + "%"));
      readout.appendChild(ro("greedy text", state.chain || "press Generate"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "previous word ", sel),
      segment([[false, "Raw counts"], [true, "Add-one smoothing"]], 0, function (v) { state.smooth = v; paint(); }),
      gen));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "hist-before": {
      title: "Before transformers checkpoint",
      sub: "Rules, n-grams, word vectors, recurrent networks and early attention.",
      questions: [
        {
          q: "What fundamentally limited ELIZA-style chatbots?",
          options: [
            "They needed far more GPU memory than was available in the 1960s",
            "They matched surface patterns with hand-written rules and had no model of meaning, so they failed wherever the rules did not reach",
            "They were trained on too little text and overfitted to it",
            "They used a vocabulary too large to store on the hardware of the time"
          ],
          answer: 1,
          explain: "ELIZA was not trained at all: it matched keywords against a script and reflected fragments of the user's sentence back. That made it convincing inside the script and helpless outside it, which is the core weakness of every pure rule-based system."
        },
        {
          q: "Why do n-gram language models need smoothing?",
          options: [
            "To make inference faster on long documents",
            "To shrink the vocabulary to the most frequent words",
            "Because word sequences never seen in training would otherwise get probability zero, making any sentence that contains them impossible",
            "To let the model use context longer than n words"
          ],
          answer: 2,
          explain: "Counts are sparse: most valid word combinations simply never occur in a finite corpus. Without smoothing, one unseen pair multiplies a whole sentence's probability to zero. Smoothing (add-one, Kneser-Ney, backoff) moves a little probability mass onto the unseen events."
        },
        {
          q: "What does the skip-gram variant of word2vec learn to do?",
          options: [
            "Predict the surrounding context words from a centre word",
            "Predict whether two sentences follow each other",
            "Reconstruct masked tokens using a deep transformer",
            "Classify documents into topics from labelled examples"
          ],
          answer: 0,
          explain: "Skip-gram takes one word and predicts the words in a small window around it; CBOW does the reverse. The prediction task is only a pretext: the useful output is the learned vector for each word, which ends up close to vectors of words used in similar contexts."
        },
        {
          q: "What is the main limitation of static word vectors such as word2vec?",
          options: [
            "They require large labelled datasets to train",
            "They only work in exactly three dimensions",
            "They cannot be used as inputs to downstream models",
            "Each word type gets one vector regardless of context, so 'bank' by a river and 'bank' that holds money share a single representation"
          ],
          answer: 3,
          explain: "word2vec trains on unlabelled text and its vectors were widely reused downstream, so those options are wrong. Its real gap is context: one vector per word must average every sense of that word. Contextual models (ELMo, then transformers) fixed this by computing a fresh vector for each occurrence."
        },
        {
          q: "Which problem did Bahdanau-style attention solve for seq2seq translation?",
          options: [
            "It let recurrent networks train in parallel across time steps",
            "It removed the need for word embeddings",
            "The encoder squeezed the whole source sentence into one fixed-size vector; attention let the decoder look back at every encoder state at each output step",
            "It replaced the decoder with a lookup table of phrase translations"
          ],
          answer: 2,
          explain: "Early seq2seq models compressed any input, however long, into a single vector, and quality fell on long sentences. Attention computes a weighted mix of all encoder states for every output word. It did not remove recurrence, so training stayed sequential; that was the 2017 change."
        }
      ]
    },
    "hist-era": {
      title: "Transformer era checkpoint",
      sub: "The 2017 architecture, BERT vs GPT, GPT-2, GPT-3 and scaling laws.",
      questions: [
        {
          q: "What did the 2017 transformer architecture remove compared with the best translation models before it?",
          options: [
            "Word embeddings",
            "The softmax over the vocabulary",
            "Training on GPUs",
            "Recurrence: it relied on attention plus feed-forward layers, so all positions in a sequence could be processed in parallel during training"
          ],
          answer: 3,
          explain: "The paper kept embeddings, softmax outputs and GPU training. What it dropped was the recurrent network, which forced one time step after another. Without recurrence, training parallelises across the whole sequence, and that is what made far larger models practical."
        },
        {
          q: "What was BERT's main pretraining objective?",
          options: [
            "Masked language modelling: hide some input tokens and predict them using context on both sides",
            "Predict the next token using only the tokens to its left",
            "Translate between pairs of languages",
            "Rank human-written answers by quality"
          ],
          answer: 0,
          explain: "BERT is an encoder that sees the whole sentence at once, so it is trained to fill in blanks using left and right context. (It also used a next-sentence objective that later work found less important.) Predicting the next token from the left only is the GPT-style causal objective."
        },
        {
          q: "Why are GPT-style decoder models the natural fit for open-ended text generation?",
          options: [
            "They have more parameters than any encoder model can",
            "They need no tokenizer",
            "They are trained with a causal objective, predicting each token from the ones before it, which is exactly the operation needed to generate text one token at a time",
            "They read the whole input bidirectionally before writing"
          ],
          answer: 2,
          explain: "Generation is repeated next-token prediction, and a causal decoder is trained on precisely that task. Bidirectional reading is the encoder's trick and does not map onto left-to-right writing. Size and tokenization are unrelated to the distinction."
        },
        {
          q: "What did GPT-3 (2020) make widely visible?",
          options: [
            "That small models beat large ones when fine-tuned",
            "In-context learning: the model could perform a new task from a description and a few examples in the prompt, with no gradient updates",
            "That attention could be replaced by convolution",
            "That language models no longer need pretraining data"
          ],
          answer: 1,
          explain: "With 175 billion parameters, GPT-3 showed that few-shot prompting works surprisingly well on many tasks. The examples live only in the context window; the weights do not change. That shifted much practical NLP work from fine-tuning to prompting."
        },
        {
          q: "What was the headline practical finding of the Chinchilla work (2022)?",
          options: [
            "For a fixed compute budget, parameters and training tokens should grow roughly together, about 20 tokens per parameter as a rule of thumb, so many large models had been undertrained",
            "Models should always be as large as the hardware allows, regardless of data",
            "Training data quality does not matter at scale",
            "Loss stops improving beyond one billion parameters"
          ],
          answer: 0,
          explain: "Earlier scaling work had suggested growing parameters faster than data. Chinchilla's experiments found that a smaller model trained on more tokens did better for the same compute. Treat the 20-tokens-per-parameter ratio as a rough training-compute guide, not a law; models meant for cheap inference are often trained well past it."
        }
      ]
    },
    "hist-modern": {
      title: "Assistant era checkpoint",
      sub: "InstructGPT, RLHF, ChatGPT, open weights, multimodal and reasoning models.",
      questions: [
        {
          q: "What surprised people about the InstructGPT results (2022)?",
          options: [
            "The model no longer needed pretraining",
            "RLHF made the model larger",
            "Human raters often preferred outputs from a much smaller instruction-tuned model over the far larger base GPT-3",
            "The model stopped hallucinating entirely"
          ],
          answer: 2,
          explain: "Alignment tuning made a model with roughly a hundred times fewer parameters more useful to people than the raw 175B model. Instruction tuning does not remove pretraining or hallucination; it changes behaviour, which turned out to matter as much as scale for usefulness."
        },
        {
          q: "Which order matches the classic RLHF recipe?",
          options: [
            "Train a reward model first, then pretrain, then fine-tune on demonstrations",
            "Supervised fine-tuning on demonstrations, then train a reward model on human rankings of outputs, then optimise the policy against that reward model with a penalty for drifting too far from the original",
            "Optimise against human rankings directly, then pretrain on the results",
            "Collect rankings, fine-tune on them with plain cross-entropy, and stop"
          ],
          answer: 1,
          explain: "The three stages are SFT, reward modelling and reinforcement learning (PPO in the original work), applied to an already pretrained model. The KL penalty keeps the policy close to the SFT model so it cannot game the reward model with strange text. Methods such as DPO later collapsed the last two steps into one."
        },
        {
          q: "What does 'open weights' usually mean, as opposed to open source?",
          options: [
            "The trained weights can be downloaded and run, but training data and training code are often not released, and the licence may restrict use",
            "Anyone can use the model for any purpose with no licence at all",
            "The full training dataset is published alongside the code",
            "The model can only be accessed through a hosted API"
          ],
          answer: 0,
          explain: "Releasing weights lets you run, inspect and fine-tune a model, which is a big deal. It is not the same as open source in the traditional sense: you usually cannot rebuild the model from scratch, and licences such as the Llama community licence add conditions. Always read the licence before shipping."
        },
        {
          q: "What does 'test-time compute' mean for reasoning models?",
          options: [
            "Running the unit tests of the model's training code",
            "Compressing the model so inference uses less memory",
            "Training on the evaluation set to raise scores",
            "Spending more inference-time computation, typically by generating long intermediate reasoning before the final answer, trading latency and cost for accuracy on hard problems"
          ],
          answer: 3,
          explain: "Reasoning models are trained to work through a problem at length before answering, and you pay for those extra tokens in time and money. The bet is that some problems are cheaper to solve by thinking longer than by training a bigger model. For simple lookups, that extra thinking is wasted spend."
        },
        {
          q: "Why did ChatGPT (November 2022) spread so quickly, given that the underlying techniques already existed?",
          options: [
            "It introduced a new neural architecture",
            "A free, conversational interface over an instruction-tuned model made it usable by anyone, without prompting tricks or an API key",
            "It was the first model trained on internet text",
            "It was the first model that never made factual errors"
          ],
          answer: 1,
          explain: "ChatGPT was built from known ingredients: a GPT-3.5-series model tuned with supervised data and RLHF for dialogue. The leap was packaging and behaviour: a chat box anyone could use. Architecture and data were evolutionary, and hallucinations remained."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.hist = {
    id: "hist",
    name: "Evolution of Language Models",
    short: "HIST",
    tagline: "Seventy years to ChatGPT, and after",
    color: "#fbbf24",
    blurb: "Follow the line from hand-written rules and n-gram counts through word2vec, recurrent networks and attention, to the 2017 transformer, BERT and GPT, the scaling era, RLHF and ChatGPT, the open-weight wave, and today's multimodal and reasoning models. Each step is told as a problem and the idea that solved it.",
    modules: [
      {
        id: "before",
        name: "Before Transformers",
        icon: "compass",
        lessons: [
          {
            id: "rules-ngrams",
            title: "Rules, statistics and n-grams",
            summary: "From ELIZA's scripted patterns to counting word sequences, and why counts run out.",
            minutes: 9,
            tags: ["history", "eliza", "n-grams", "smoothing"],
            blocks: [
              { t: "p", html: "Hold one question through this whole track: <strong>where does the model's knowledge come from?</strong> In the first era a person wrote it down as rules. In the second, the machine counted it from text. Every later step is a better answer to that same question." },
              { t: "h", text: "Rules: ELIZA and pattern matching" },
              { t: "p", html: "ELIZA (mid-1960s) is the famous early chatbot. Its best-known script imitated a therapist: it scanned your sentence for keywords, matched a template, swapped pronouns and reflected the fragment back as a question. There was no learning and no representation of meaning, only a list of patterns ranked by priority. Expert systems in the following decades scaled the same idea up to thousands of hand-written if-then rules." },
              { t: "code", lang: "text", code:
                "rule:     * I feel (X) *\n" +
                "respond:  Why do you feel (X)?\n\n" +
                "user:     I feel ignored by my team\n" +
                "bot:      Why do you feel ignored by your team?     # 'my' -> 'your' swap\n\n" +
                "user:     Nobody replies to my messages\n" +
                "bot:      Please go on.                             # no rule matched: fallback"
              },
              { t: "note", variant: "trap", html: "<strong>The ELIZA effect.</strong> People attributed understanding to a program that had none, simply because its replies were fluent and on-topic. The same bias applies to modern models: fluency is evidence of fluency, not of correctness." },
              { t: "h", text: "Statistics: let the data vote" },
              { t: "p", html: "From the 1980s onward, speech recognition and machine translation moved to <strong>statistical language models</strong>. An n-gram model estimates the probability of the next word from the previous <em>n − 1</em> words, by counting how often each sequence appears in a large corpus. A bigram uses one word of context, a trigram two." },
              { t: "code", lang: "text", code:
                "P(next | prev) = count(prev, next) / count(prev, *)\n\n" +
                "count('the', 'cat') = 3      count('the', *) = 9\n" +
                "P('cat' | 'the')    = 3 / 9  ~= 0.33\n\n" +
                "sentence probability = product of each word's P given its context\n" +
                "  -> one zero anywhere makes the whole sentence impossible"
              },
              { t: "widget", id: "histNgram" },
              { t: "h", text: "Sparsity, smoothing and the context ceiling" },
              { t: "table", headers: ["Problem", "What it looks like", "Classic fix", "What it costs"], rows: [
                ["Zero counts", "A valid pair never appeared in training, so P = 0", "Add-one (Laplace) smoothing: pretend every pair was seen once more", "Steals too much mass from real pairs on large vocabularies"],
                ["Better zero handling", "Need sensible estimates for rare events", "Kneser-Ney smoothing, backoff to shorter contexts, interpolation", "More bookkeeping; still only counts"],
                ["Short context", "A trigram cannot connect a pronoun to a noun ten words back", "Use larger n", "Counts get sparser exponentially as n grows"],
                ["No similarity", "Seeing 'cat sat' teaches nothing about 'dog sat'", "Hand-built word classes", "Manual and brittle, which is what word vectors later fixed"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The statistical era also leaned on classical classifiers (naive Bayes, logistic regression) over hand-engineered text features. That feature-engineering world is covered properly in the Synapse atlas; here we only need the language-model thread." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cn-gram models replaced rules with counts, but counts are sparse and context is short. Smoothing patches the zeros; it cannot make 'cat' teach the model anything about 'dog'. That is the gap learned vectors filled.\u201d" },
              { t: "note", variant: "key", html: "<strong>Rules do not generalise; counts generalise only to what they have seen.</strong> Sparsity and a few words of context are the two limits that pushed language modelling toward learned, dense representations." }
            ]
          },
          {
            id: "word2vec",
            title: "word2vec and learned word vectors",
            summary: "Skip-gram, CBOW and the famous analogy arithmetic, with its caveats.",
            minutes: 9,
            tags: ["history", "word2vec", "embeddings", "skip-gram"],
            blocks: [
              { t: "p", html: "The idea behind word vectors is old: <strong>words used in similar contexts tend to mean similar things</strong>. If 'coffee' and 'tea' keep appearing next to 'cup', 'hot' and 'drink', a good representation should put them close together. word2vec (2013) made learning such representations fast enough to run on billions of words." },
              { t: "p", html: "Before it, a word was usually a one-hot vector: a 1 in one slot of a vocabulary-sized array. Every pair of words is equally far apart in that scheme, so nothing learned about one word transfers to another. Count-based methods such as latent semantic analysis compressed co-occurrence matrices, but scaled poorly." },
              { t: "h", text: "Two training set-ups: skip-gram and CBOW" },
              { t: "table", headers: ["Variant", "Input", "Predicts", "Tends to be good at"], rows: [
                ["Skip-gram", "One centre word", "Each word in a small window around it", "Rare words; small datasets"],
                ["CBOW (continuous bag of words)", "The surrounding window, averaged", "The centre word", "Faster training; frequent words"]
              ] },
              { t: "p", html: "Both are shallow: an embedding lookup and one output layer, no deep network. Tricks such as <strong>negative sampling</strong> (score the real neighbour against a few random words instead of the whole vocabulary) made training cheap. Vectors of a few hundred dimensions were typical. The prediction task is disposable; the learned embedding table is the product." },
              { t: "code", lang: "python", code:
                "# Build skip-gram training pairs from one sentence (window = 2)\n" +
                "sentence = ['the', 'cat', 'sat', 'on', 'the', 'mat']\n" +
                "pairs = []\n" +
                "for i, centre in enumerate(sentence):\n" +
                "    for j in range(max(0, i - 2), min(len(sentence), i + 3)):\n" +
                "        if j != i:\n" +
                "            pairs.append((centre, sentence[j]))\n" +
                "# ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'the') ...\n" +
                "# A tiny network learns vectors so each centre scores its real neighbours highly."
              },
              { t: "h", text: "king − man + woman ≈ queen" },
              { t: "p", html: "The result that made word2vec famous: some relationships showed up as roughly constant <em>directions</em> in the space. Take the vector for 'king', subtract 'man', add 'woman', and the nearest remaining word is often 'queen'. Similar offsets appeared for country to capital and verb tense." },
              { t: "note", variant: "warn", html: "<strong>Treat the analogy as intuition, not proof.</strong> The standard test excludes the three input words from the answer (otherwise 'king' is often nearest); showcase examples were the clean ones; results are much weaker on rare words and fuzzy relations; and the same geometry faithfully encodes social biases in the training text, such as gendered occupations." },
              { t: "compare",
                bad: { title: "What static vectors could not do", items: ["One vector per word, so every sense of 'bank' is averaged together", "No representation of word order or whole sentences", "Out-of-vocabulary words had no vector at all"] },
                good: { title: "What they made possible", items: ["Similarity that transfers between related words", "Pretrained features reusable across many tasks", "A first taste of 'pretrain on unlabelled text, reuse everywhere'"] } },
              { t: "p", html: "Successors refined the idea: GloVe (2014) factorised global co-occurrence statistics, fastText added sub-word pieces so unseen words got vectors, and ELMo (2018) produced <em>contextual</em> vectors from a language model. In a modern LLM, the embedding layer plays the same role at the start of the network; see <a class='inline' href='#/found/tokens/embeddings'>Embeddings: meaning as coordinates</a>." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cword2vec turned a prediction task into a representation: words that share contexts get nearby vectors. Its limit is one vector per word, which contextual models removed.\u201d" },
              { t: "note", variant: "key", html: "<strong>Meaning became geometry.</strong> word2vec showed that a cheap self-supervised task on raw text yields reusable vectors, the same pretrain-then-reuse bet that every LLM still makes." }
            ]
          },
          {
            id: "rnn-lstm",
            title: "RNNs, LSTMs and seq2seq with attention",
            summary: "Reading one word at a time, the fixed-vector bottleneck, and the attention fix.",
            minutes: 10,
            tags: ["history", "rnn", "lstm", "seq2seq", "attention"],
            blocks: [
              { t: "p", html: "Picture a reader who can only move left to right and keeps a single running summary in their head. That is a <strong>recurrent neural network</strong>: at each word it updates a hidden state from the previous state and the new input. In principle the state can carry information indefinitely; in practice it fades." },
              { t: "h", text: "Recurrent networks and their memory problem" },
              { t: "code", lang: "text", code:
                "h_t = tanh(W . x_t + U . h_(t-1) + b)     # new state from input and old state\n" +
                "y_t = softmax(V . h_t)                      # predict the next word\n\n" +
                "training: gradients flow back through every step\n" +
                "  many steps of small multipliers -> gradient vanishes (or explodes)"
              },
              { t: "p", html: "Because the gradient passes through the same multiplication at every time step, long-range signals shrink toward zero. The <strong>LSTM</strong> (1997) added a separate cell state with learned gates that decide what to keep, forget and output, giving information a cleaner path across many steps. The <strong>GRU</strong> (2014) is a lighter variant with fewer gates." },
              { t: "table", headers: ["Model", "How it remembers", "Main weakness"], rows: [
                ["Plain RNN", "One hidden state, overwritten each step", "Vanishing gradients; forgets within tens of steps"],
                ["LSTM", "Gated cell state alongside the hidden state", "More parameters per step; still sequential"],
                ["GRU", "Two gates merged into one state", "Similar trade-offs, slightly cheaper"]
              ] },
              { t: "h", text: "seq2seq: encode, then decode (2014)" },
              { t: "p", html: "Sequence-to-sequence models paired two recurrent networks. The <strong>encoder</strong> read the source sentence and its final hidden state became a single fixed-size vector; the <strong>decoder</strong> generated the target sentence from that vector, one token at a time. This made end-to-end neural translation work, but quality fell on long sentences: one vector had to hold everything." },
              { t: "h", text: "Attention arrives (2014–15)" },
              { t: "p", html: "Bahdanau and colleagues let the decoder <strong>look back</strong> at every encoder state at each output step. A small network scores how relevant each source position is to the word being produced; a softmax turns the scores into weights; the weighted sum becomes the context for that step. The learned weights even looked like word alignments. Luong and colleagues (2015) proposed simpler scoring variants." },
              { t: "code", lang: "text", code:
                "for each output step t:\n" +
                "  score_i  = relevance(decoder_state_t, encoder_state_i)   # for every source word i\n" +
                "  alpha_i  = softmax(score)_i                              # weights sum to 1\n" +
                "  context  = sum_i alpha_i * encoder_state_i\n" +
                "  next word predicted from decoder_state_t and context"
              },
              { t: "stat", items: [
                { v: "1997", k: "LSTM introduced" },
                { v: "2014", k: "seq2seq translation" },
                { v: "2014–15", k: "attention for seq2seq" }
              ] },
              { t: "note", variant: "trap", html: "<strong>Attention did not remove recurrence.</strong> These models were still RNNs underneath, so training had to process step 1 before step 2 before step 3. On parallel hardware that sequential dependency was the real speed limit, and it is what the 2017 transformer removed." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cLSTMs fixed short memory with gates; seq2seq made neural translation work; attention removed the fixed-vector bottleneck. What remained was sequential training, and the transformer kept attention and dropped the recurrence.\u201d" },
              { t: "quiz", id: "hist-before" },
              { t: "note", variant: "key", html: "<strong>Attention was invented to fix a bottleneck, not to replace RNNs.</strong> Once it existed, the obvious next question was whether the recurrence was needed at all." }
            ]
          }
        ]
      },
      {
        id: "era",
        name: "The Transformer Era",
        icon: "bolt",
        lessons: [
          {
            id: "attention-paper",
            title: "2017: the attention-only architecture",
            summary: "What 'Attention Is All You Need' changed, and the whole timeline at a glance.",
            minutes: 10,
            tags: ["history", "transformer", "attention", "timeline"],
            blocks: [
              { t: "p", html: "The 2017 paper <strong>\u201cAttention Is All You Need\u201d</strong> asked the question the previous lesson ended on: if attention lets any position read any other, why keep the recurrent network? Its answer, the <strong>transformer</strong>, is the architecture under essentially every model in this atlas." },
              { t: "diagram", id: "llm-timeline", caption: "From rules and counts to transformers, assistants, open weights and reasoning models." },
              { t: "h", text: "What the paper changed" },
              { t: "compare",
                bad: { title: "RNN with attention (before)", items: ["Reads tokens one after another", "Training cannot parallelise across the sequence", "Distant tokens connect through many steps"] },
                good: { title: "Transformer (2017)", items: ["Self-attention lets every token read every other token directly", "All positions computed at once during training", "Positional encodings supply the order that recurrence used to provide"] } },
              { t: "p", html: "Each layer computes <strong>queries, keys and values</strong> from the token vectors, lets each token take a weighted mix of the others' values, and then applies a feed-forward network. Several attention heads run side by side, and residual connections plus layer normalisation keep deep stacks trainable. The original model was an encoder-decoder built for translation. The mechanism itself is taught in <a class='inline' href='#/core/transformer/attention'>Attention, intuitively</a>." },
              { t: "code", lang: "text", code:
                "Attention(Q, K, V) = softmax( Q . K^T / sqrt(d_k) ) . V\n\n" +
                "Q: what each token is looking for\n" +
                "K: what each token offers\n" +
                "V: the information actually passed along\n" +
                "sqrt(d_k): keeps scores in a range where softmax still has useful gradients"
              },
              { t: "h", text: "The timeline in one table" },
              { t: "table", headers: ["When", "Milestone", "What it changed"], rows: [
                ["Mid-1960s", "ELIZA", "Scripted pattern matching; fluency without understanding"],
                ["1980s–2000s", "n-gram language models", "Probabilities counted from data; sparse, short context"],
                ["1997", "LSTM", "Gated memory for recurrent networks"],
                ["2013", "word2vec", "Dense learned word vectors"],
                ["2014", "seq2seq; attention for translation", "End-to-end neural translation; no single-vector bottleneck"],
                ["2017", "Transformer", "Attention only; parallel training"],
                ["2018", "GPT and BERT", "Pretrain once, adapt to many tasks (decoder vs encoder)"],
                ["2019", "GPT-2", "Larger decoder; staged release over misuse concerns"],
                ["2020", "GPT-3 (175B); scaling laws", "In-context few-shot learning; predictable gains from scale"],
                ["2022", "Chinchilla; InstructGPT; ChatGPT (Nov)", "Compute-optimal training; RLHF; assistants for everyone"],
                ["2023", "LLaMA (Feb), Llama 2, Mistral, Mixtral, Qwen", "The open-weight wave"],
                ["2023 onward", "Image, then audio and video input", "Multimodal models"],
                ["2024 onward", "Reasoning models; agents", "More inference compute spent thinking; models that act through tools"]
              ] },
              { t: "note", variant: "warn", html: "<strong>The trade-off the paper accepted.</strong> Self-attention compares every token with every other, so its cost grows with the square of the sequence length. Parallel training was worth it, but long contexts have been expensive ever since, which is why the KV cache and long-context tricks exist." },
              { t: "widget", id: "histTimeline" },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cThe transformer kept attention and dropped recurrence. That traded quadratic attention cost for fully parallel training, and parallel training is what let models scale.\u201d" },
              { t: "note", variant: "key", html: "<strong>2017 is the hinge.</strong> Everything before it is a search for good representations and memory; everything after is mostly about what happens when you scale one architecture and change how it is trained." }
            ]
          },
          {
            id: "bert-vs-gpt",
            title: "BERT vs GPT: two ways to use a transformer",
            summary: "Encoder with masked LM versus decoder with causal LM, and why both survive.",
            minutes: 9,
            tags: ["history", "bert", "gpt", "pretraining"],
            blocks: [
              { t: "p", html: "In 2018 two teams took the same transformer building block and pointed it in different directions. <strong>BERT</strong> kept the encoder and read text in both directions to understand it. <strong>GPT</strong> kept the decoder and read left to right to continue it. Most of what followed is a consequence of that fork." },
              { t: "p", html: "Both rode a shift that ELMo and ULMFiT had also pushed in 2018: <strong>pretrain one model on lots of unlabelled text, then fine-tune it</strong> on a small labelled dataset for each task. Before this, most NLP models were trained from scratch per task." },
              { t: "table", headers: ["", "BERT (2018)", "GPT (2018)"], rows: [
                ["Transformer half", "Encoder stack", "Decoder stack"],
                ["Attention", "Bidirectional: every token sees the whole input", "Causal: each token sees only earlier tokens"],
                ["Pretraining objective", "Masked language modelling (plus next-sentence prediction)", "Next-token prediction"],
                ["Natural output", "A contextual vector per token", "The next token, repeatedly"],
                ["Typical use then", "Classification, entity tagging, extractive QA, search", "Text generation; fine-tuned task heads"],
                ["Descendants today", "Embedding models, rerankers, classifiers", "Essentially every chat and coding assistant"]
              ] },
              { t: "h", text: "Masked LM vs causal LM" },
              { t: "code", lang: "text", code:
                "masked LM (BERT):  The [MASK] sat on the [MASK] .\n" +
                "                   -> predict 'cat' and 'mat' using words on BOTH sides\n\n" +
                "causal LM (GPT):   The cat sat on the  ___\n" +
                "                   -> predict 'mat' using only the words to the LEFT\n" +
                "                   -> repeat, feeding each prediction back in = generation"
              },
              { t: "p", html: "BERT's bidirectional view made it excellent at understanding tasks: add a small classification head, fine-tune briefly, and it beat task-specific architectures across many benchmarks. But it cannot naturally write text, because nothing in its training asks it to produce the next word from left context alone." },
              { t: "p", html: "GPT's causal objective is generation itself, so every training example practises the exact skill used at inference. The first GPT was fine-tuned per task like BERT; its successors showed that a large enough causal model could do tasks from the prompt alone. See <a class='inline' href='#/core/generation/next-token'>Next-token prediction</a> for the mechanics." },
              { t: "h", text: "Which family won, and where each still fits" },
              { t: "table", headers: ["Job", "Better fit", "Why"], rows: [
                ["Chat, writing, code generation", "Decoder (GPT-style)", "Generation is its training objective"],
                ["Embeddings for semantic search", "Encoder (or a decoder trained as an embedder)", "Wants one good vector for the whole text"],
                ["Reranking retrieved passages", "Encoder cross-encoder", "Reads query and passage together, both directions, cheaply"],
                ["High-volume classification", "Small fine-tuned encoder", "Fast and cheap per call; no generation needed"]
              ] },
              { t: "note", variant: "tip", html: "There is a third family: <strong>encoder-decoder</strong> models such as T5 (2019), which cast every task as text-to-text. They remain common in translation and summarisation pipelines." },
              { t: "note", variant: "trap", html: "<strong>\u201cBERT is obsolete\u201d is wrong.</strong> Decoders won generation, but encoder-style models still quietly power retrieval and reranking in many RAG systems; see <a class='inline' href='#/rag/quality/reranking'>Reranking</a>." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cSame block, different mask. BERT sees both sides and is trained to fill blanks, so it understands; GPT sees only the past and is trained to continue, so it generates.\u201d" },
              { t: "note", variant: "key", html: "<strong>The attention mask decides the job.</strong> Bidirectional encoders became the backbone of search and classification; causal decoders became the backbone of assistants." }
            ]
          },
          {
            id: "scaling",
            title: "GPT-2, GPT-3 and the scaling laws",
            summary: "Bigger decoders, in-context learning, and the empirical rules for spending compute.",
            minutes: 11,
            tags: ["history", "gpt-2", "gpt-3", "scaling-laws", "chinchilla"],
            blocks: [
              { t: "p", html: "Between 2019 and 2022 the field made one large bet: <strong>keep the decoder, make it much bigger, feed it much more text</strong>, and see what appears. The surprise was not only that it kept improving, but that it improved <em>predictably</em>." },
              { t: "h", text: "GPT-2 (2019) and the staged release" },
              { t: "p", html: "GPT-2 was a decoder of up to roughly 1.5 billion parameters trained on a large scrape of web pages linked from popular forum posts. It wrote surprisingly coherent paragraphs and could attempt some tasks zero-shot, just from the way a prompt was framed. OpenAI released it in stages over 2019, starting with smaller versions, citing concerns about misuse; the full model followed later that year. The episode started a lasting debate about how to release capable models." },
              { t: "h", text: "GPT-3 (2020): 175B and in-context learning" },
              { t: "p", html: "GPT-3 scaled to <strong>175 billion parameters</strong>. Its headline behaviour was <strong>in-context learning</strong>: give it a task description and a few worked examples in the prompt, and it continues the pattern for a new input. No weights change; the examples live only in the context window. This is why prompting became an engineering discipline; see <a class='inline' href='#/prompt/craft/few-shot'>Few-shot examples</a>." },
              { t: "code", lang: "text", code:
                "Convert each product name to a URL slug.\n\n" +
                "Name: Blue Running Shoes   -> slug: blue-running-shoes\n" +
                "Name: Kids' Rain Jacket    -> slug: kids-rain-jacket\n" +
                "Name: 4K Monitor (27 inch) -> slug:\n\n" +
                "# a large base model continues: 4k-monitor-27-inch"
              },
              { t: "h", text: "Scaling laws" },
              { t: "p", html: "Kaplan and colleagues (2020) measured that test loss falls as a smooth <strong>power law</strong> in parameters, dataset size and training compute, over many orders of magnitude. That turned model building into budgeting: you could forecast the loss of a big run from small ones. Their analysis suggested growing parameters faster than data." },
              { t: "p", html: "The Chinchilla work (Hoffmann and colleagues, 2022) revisited this and found that, for a fixed compute budget, <strong>parameters and training tokens should grow roughly in proportion</strong>. Its 70B-parameter model, trained on far more tokens than comparable models, outperformed much larger ones. The popular rule of thumb that came out of it is <strong>about 20 training tokens per parameter</strong> for compute-optimal training." },
              { t: "code", lang: "text", code:
                "training compute  C ~= 6 * N * D      (N = parameters, D = training tokens)\n\n" +
                "compute-optimal rule of thumb:  D ~= 20 * N\n" +
                "  7B model   -> ~140B tokens\n" +
                "  70B model  -> ~1.4T tokens\n\n" +
                "rough guides for reasoning about budgets, not exact laws"
              },
              { t: "table", headers: ["Tier", "How you read the scaling laws", "Why"], rows: [
                ["Naive", "\u201cBigger is always better, so maximise parameters\u201d", "Ignores data; Chinchilla showed many big models were undertrained"],
                ["Solid", "\u201cBalance parameters and tokens for the compute you have\u201d", "Matches the compute-optimal finding for training cost"],
                ["Standout", "\u201cOptimise total cost: training plus every token you will ever serve\u201d", "A smaller model trained past 20 tokens/param costs more to train but far less to run at scale"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Compute-optimal is not deployment-optimal.</strong> Many widely used open models are deliberately trained on many more tokens per parameter than the Chinchilla ratio, because inference cost dominates once millions of people use the model. Modern treatment is in <a class='inline' href='#/train/pretrain/compute-scaling'>Compute and scaling laws</a>." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cGPT-3 showed in-context learning; Kaplan showed loss is predictable from scale; Chinchilla corrected the recipe to scale data alongside parameters, roughly 20 tokens per parameter, then practice moved past that for cheaper inference.\u201d" },
              { t: "quiz", id: "hist-era" },
              { t: "note", variant: "key", html: "<strong>Scale became a plan, not a gamble.</strong> Power-law forecasting plus the compute-optimal correction told labs how to spend, and in-context learning turned the result into something you program with prompts." }
            ]
          }
        ]
      },
      {
        id: "modern",
        name: "The Assistant Era",
        icon: "globe",
        lessons: [
          {
            id: "rlhf-chatgpt",
            title: "InstructGPT, RLHF and ChatGPT",
            summary: "How a document-completer became an assistant, and why the chat box changed everything.",
            minutes: 10,
            tags: ["history", "instructgpt", "rlhf", "chatgpt"],
            blocks: [
              { t: "p", html: "A base model trained on web text is a <strong>document completer</strong>. Ask it \u201cHow do I reverse a list in Python?\u201d and it may continue with three more questions, as if it were a forum page. The assistant era began when labs trained models to treat a prompt as a request to fulfil." },
              { t: "compare",
                bad: { title: "Base model", items: ["Continues whatever document the prompt resembles", "Needs careful few-shot framing to do a task", "Happily imitates toxic or false text it has seen"] },
                good: { title: "Instruction-tuned assistant", items: ["Answers the request directly", "Follows formats and constraints stated in plain language", "Trained to decline some requests and to be more careful"] } },
              { t: "h", text: "InstructGPT (2022)" },
              { t: "ol", items: [
                "<strong>Supervised fine-tuning (SFT).</strong> Human labellers write good responses to sample prompts; the pretrained model is fine-tuned on them.",
                "<strong>Reward model.</strong> The model produces several answers per prompt; labellers rank them; a separate model learns to predict those rankings as a score.",
                "<strong>Reinforcement learning.</strong> The SFT model is optimised (with PPO in the original work) to produce answers the reward model scores highly, with a KL penalty that keeps it close to the SFT model."
              ] },
              { t: "p", html: "The striking result: human raters often preferred answers from an InstructGPT model with <strong>roughly a hundred times fewer parameters</strong> than the 175B GPT-3 base model. Behaviour, not only size, determined usefulness." },
              { t: "code", lang: "text", code:
                "reward model training (pairwise preference):\n" +
                "  for prompt x with preferred answer y_w and rejected answer y_l:\n" +
                "    loss = -log( sigmoid( r(x, y_w) - r(x, y_l) ) )\n\n" +
                "policy objective (RL step):\n" +
                "  maximise  r(x, y)  -  beta * KL( policy || sft_model )"
              },
              { t: "note", variant: "trap", html: "<strong>Optimising a learned reward has side effects.</strong> Push too hard and the policy finds text the reward model over-scores (reward hacking). Preference data can also reward agreeable, confident-sounding answers, which is one root of sycophancy." },
              { t: "h", text: "ChatGPT (November 2022)" },
              { t: "p", html: "ChatGPT applied the same recipe to a GPT-3.5-series model tuned for multi-turn dialogue, and put it behind a free web chat interface. It reached a very large audience within weeks. For most people it was the first time a language model was something you simply talked to." },
              { t: "table", headers: ["What was new", "What was not new"], rows: [
                ["A conversational format with turn-by-turn memory in the context", "The transformer decoder architecture"],
                ["A free interface needing no API key or prompt tricks", "Pretraining on large web corpora"],
                ["Dialogue-specific SFT and RLHF data at scale", "The SFT, reward model, RL recipe (InstructGPT)"]
              ] },
              { t: "note", variant: "tip", html: "The step-by-step mechanics of RLHF, and the simpler preference method that followed it, are in <a class='inline' href='#/train/align/rlhf'>RLHF, step by step</a> and <a class='inline' href='#/train/align/dpo'>DPO and preference optimisation</a>." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cChatGPT was not a new architecture. It was a GPT-3.5 model taught to follow instructions with SFT and RLHF, delivered through a chat box anyone could use.\u201d" },
              { t: "note", variant: "key", html: "<strong>Alignment tuning turned capability into usability.</strong> SFT teaches the format, the reward model encodes human preference, RL optimises toward it, and the product made it reachable for everyone." }
            ]
          },
          {
            id: "open-weights",
            title: "The open-weight wave",
            summary: "LLaMA, Llama 2, Mistral, Qwen, DeepSeek and Gemma, and why open weights is not open source.",
            minutes: 9,
            tags: ["history", "open-weights", "llama", "licensing"],
            blocks: [
              { t: "p", html: "Through 2022 the most capable models were reachable only through APIs. In 2023 that changed: labs began publishing <strong>trained weights</strong> you could download, run on your own hardware and fine-tune. The result was an explosion of local tooling, fine-tunes and research that no single lab could have produced." },
              { t: "table", headers: ["When", "Release", "Why it mattered"], rows: [
                ["Feb 2023", "LLaMA (Meta)", "Strong models at sizes that fit on research hardware; released to researchers, then widely shared"],
                ["Jul 2023", "Llama 2 (Meta)", "Commercial use allowed under a custom community licence with conditions"],
                ["Late 2023", "Mistral 7B, then Mixtral (Mistral AI)", "Small, efficient models under a permissive licence; Mixtral popularised sparse mixture-of-experts in the open"],
                ["2023 onward", "Qwen family (Alibaba)", "Broad range of sizes, strong multilingual and coding variants"],
                ["Feb 2024", "Gemma (Google)", "Small open models from a frontier lab, under its own terms"],
                ["2023 onward", "DeepSeek models", "Efficient MoE designs; an open-weight reasoning model in early 2025"]
              ] },
              { t: "h", text: "Open weights is not open source" },
              { t: "table", headers: ["What you get", "Typical open-weight release", "Open source in the traditional sense"], rows: [
                ["Trained weights", "Yes", "Yes"],
                ["Inference code", "Usually", "Yes"],
                ["Training code and recipe", "Sometimes, often partial", "Expected"],
                ["Training data", "Rarely; usually only a description", "Expected, or enough to rebuild it"],
                ["Use for any purpose", "Depends on the licence: acceptable-use rules, user caps, naming terms", "Yes, by definition"]
              ] },
              { t: "p", html: "With weights alone you can run, quantise, fine-tune and study a model, but you usually cannot reproduce it, audit exactly what it was trained on, or assume you may use it however you like. Some releases use standard permissive licences; others, like the Llama community licence, are custom documents with their own conditions." },
              { t: "note", variant: "warn", html: "<strong>Read the licence before you ship.</strong> Check commercial-use terms, acceptable-use policies, user or revenue thresholds, attribution or naming requirements, and whether outputs may be used to train other models. More in <a class='inline' href='#/ops/security/responsible-ai'>Responsible AI and open-weight licensing</a>." },
              { t: "h", text: "Why the wave mattered" },
              { t: "ul", items: [
                "<strong>Local inference.</strong> Runtimes like llama.cpp and Ollama made laptops into model hosts.",
                "<strong>Cheap adaptation.</strong> LoRA and QLoRA fine-tunes on a single GPU; see <a class='inline' href='#/train/finetune/lora-peft'>LoRA, QLoRA and PEFT</a>.",
                "<strong>Quantisation.</strong> 4- and 8-bit formats shrank memory needs several-fold.",
                "<strong>Privacy and control.</strong> Data can stay on your infrastructure, and the model never changes underneath you.",
                "<strong>Research.</strong> Interpretability and safety work on models people can actually inspect."
              ] },
              { t: "table", headers: ["Tier", "How you choose open vs hosted", "Why"], rows: [
                ["Naive", "\u201cOpen is free, so always self-host\u201d", "Ignores GPU, ops and quality costs"],
                ["Solid", "Pick by data sensitivity, cost at your volume and required quality", "Matches the real constraints"],
                ["Standout", "Run the same eval set on a hosted model and an open model, include serving cost and licence terms, and keep a swap path", "Decides with evidence and avoids lock-in either way"]
              ] },
              { t: "note", variant: "tip", html: "Running these models yourself is the subject of <a class='inline' href='#/local/why/why-local'>Why run a model locally</a>; the broader decision is in <a class='inline' href='#/api/choose/choosing-model'>Choosing a model</a>." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cOpen weights means I can run and fine-tune it, not that I can rebuild it or use it for anything. I check the licence and run my own evals before choosing.\u201d" },
              { t: "note", variant: "key", html: "<strong>The open-weight wave moved models from APIs onto everyone's hardware.</strong> It brought local inference, cheap fine-tuning and real research access, with licences you must read rather than assume." }
            ]
          },
          {
            id: "multimodal-reasoning",
            title: "Multimodal, reasoning models and agents",
            summary: "Images and audio in, thinking before answering, and models that act through tools.",
            minutes: 10,
            tags: ["history", "multimodal", "reasoning", "test-time-compute", "agents"],
            blocks: [
              { t: "p", html: "Since 2023, progress has come along three axes at once: <strong>what the model can perceive</strong> (images, audio, video), <strong>how long it thinks</strong> before answering, and <strong>whether it can act</strong> through tools. None needed a new core architecture; each changed the inputs, the training or the loop around the model." },
              { t: "diagram", id: "llm-timeline", caption: "The most recent stretch of the timeline: multimodal inputs, reasoning models and agents." },
              { t: "h", text: "Multimodal: from text-only to many inputs" },
              { t: "p", html: "Image understanding arrived first in mainstream assistants: GPT-4 (2023) accepted images as input, and other labs followed. Later systems added native audio in and out for real-time voice, and video understanding. The common trick is to turn every modality into a sequence of vectors the transformer can attend over; the details are in <a class='inline' href='#/next/multimodal/vision-audio'>Vision and audio models</a>." },
              { t: "h", text: "Reasoning models and test-time compute" },
              { t: "p", html: "Chain-of-thought prompting (2022) showed that asking a model to write out intermediate steps improves multi-step answers. <strong>Reasoning models</strong> (from 2024 onward, starting with OpenAI's o1 and followed by others, including the open-weight DeepSeek-R1 in early 2025) are trained, largely with reinforcement learning on checkable problems, to produce long reasoning before the final answer. This is <strong>test-time compute</strong>: spend more inference compute per question instead of only training a bigger model." },
              { t: "code", lang: "text", code:
                "standard model:   question -> answer                          (few hundred tokens)\n" +
                "reasoning model:  question -> [long reasoning tokens] -> answer (often many more)\n\n" +
                "cost and latency  ~ proportional to tokens generated\n" +
                "payoff            biggest on maths, code and multi-step planning\n" +
                "                  little or none on lookups and simple rewrites"
              },
              { t: "table", headers: ["Situation", "Better choice", "Why"], rows: [
                ["Hard maths, tricky debugging, multi-step planning", "Reasoning model", "Extra thinking measurably helps on problems with verifiable steps"],
                ["Classification, extraction, short rewrites", "Standard model", "Thinking adds cost and latency for no gain"],
                ["Latency-sensitive chat or voice", "Standard model, or reasoning with a low effort setting", "Users notice every second"]
              ] },
              { t: "h", text: "Agents" },
              { t: "p", html: "Tool calling plus a loop turns a model into an <strong>agent</strong>: it decides on an action, a program executes it, the result comes back into context, and the model decides again. The ReAct pattern (2022) named the reason-then-act cycle; coding agents and protocol standards for tools followed. The loop is taught in <a class='inline' href='#/agent/loop/react'>The ReAct loop</a>." },
              { t: "note", variant: "warn", html: "<strong>This is the part of the history that dates fastest.</strong> Specific model names and rankings here will be stale within months. Learn the mechanisms (modality encoders, test-time compute, tool loops) and verify current claims yourself." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cRecent progress is perception, thinking time and action: more modalities in, more inference compute spent reasoning, and tool loops that let the model act. Each trades cost or risk for capability.\u201d" },
              { t: "quiz", id: "hist-modern" },
              { t: "note", variant: "key", html: "<strong>The frontier moved from 'bigger model' to 'better use of the model'.</strong> Multimodal inputs, test-time reasoning and agent loops all extend the same transformer, and all make cost, latency and verification central." }
            ]
          }
        ]
      }
    ]
  };
})();
