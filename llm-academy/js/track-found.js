/* =====================================================================
   LUMEN · Foundations
   window.TRACKS.found — modules: basics / tokens

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
     {t:'diagram', id}          inline SVG from app.js DIAGRAMS
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  var SVG_NS = "http://www.w3.org/2000/svg";

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

  function s(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
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

  function slider(label, min, max, step, value, onChange) {
    var out = h("b", {}, String(value));
    var inp = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) });
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      if (isNaN(v)) v = value;
      out.textContent = String(v);
      onChange(v);
    });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), inp, out);
  }

  function fmt(x, d) {
    if (typeof x !== "number" || !isFinite(x)) return "—";
    return x.toFixed(d == null ? 3 : d);
  }

  var Widgets = {};

  /* ==================================================================
     1. foundDescent — gradient descent on L(w) = (w - 3)^2
  ================================================================== */
  Widgets.foundDescent = function (mount) {
    shell(mount, "simulator", "Gradient descent, one step at a time",
      "The loss is L(w) = (w − 3)², so the best weight is w = 3. Pick a learning rate and press Step. Small rates crawl, 0.5 lands in one jump, 0.9 overshoots back and forth, and anything above 1 diverges.");
    var lr = 0.1, w = 0, steps = 0;
    var W0 = -3, W1 = 9, WID = 320, HGT = 170;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function loss(x) { return (x - 3) * (x - 3); }
    function px(x) { return 10 + (x - W0) / (W1 - W0) * (WID - 20); }
    function py(l) { var c = Math.min(l, 36); return HGT - 12 - c / 36 * (HGT - 24); }

    function paint() {
      clear(stage);
      var svg = s("svg", { viewBox: "0 0 " + WID + " " + HGT, width: "100%", height: String(HGT), role: "img", "aria-label": "Loss curve with the current weight marked" });
      var d = "";
      for (var i = 0; i <= 60; i++) {
        var x = W0 + (W1 - W0) * i / 60;
        d += (i ? "L" : "M") + px(x).toFixed(1) + " " + py(loss(x)).toFixed(1) + " ";
      }
      svg.appendChild(s("path", { d: d, fill: "none", stroke: "var(--line)", "stroke-width": "2" }));
      svg.appendChild(s("line", { x1: px(3), y1: "8", x2: px(3), y2: String(HGT - 8), stroke: "var(--lime)", "stroke-dasharray": "4 4" }));
      var cx = Math.max(W0, Math.min(W1, w));
      svg.appendChild(s("circle", { cx: px(cx).toFixed(1), cy: py(loss(cx)).toFixed(1), r: "7", fill: "var(--accent)" }));
      stage.appendChild(svg);

      clear(readout);
      var diverged = !isFinite(w) || Math.abs(w) > 1e6;
      readout.appendChild(ro("step", steps));
      readout.appendChild(ro("w", diverged ? "diverged" : fmt(w, 3)));
      readout.appendChild(ro("loss", diverged ? "∞" : fmt(loss(w), 4)));
      readout.appendChild(ro("gradient 2(w−3)", diverged ? "—" : fmt(2 * (w - 3), 3)));
      readout.appendChild(ro("status", diverged ? "exploded" : Math.abs(w - 3) < 0.01 ? "converged" : lr > 1 ? "moving away" : "descending"));
    }

    function step(n) {
      for (var i = 0; i < n; i++) {
        if (!isFinite(w) || Math.abs(w) > 1e6) break;
        w = w - lr * 2 * (w - 3);
        steps++;
      }
      paint();
    }

    var controls = h("div", { class: "widget-controls" },
      h("span", { style: "font-size:0.84rem;color:var(--text-dim)" }, "learning rate"),
      segment([[0.1, "0.1"], [0.5, "0.5"], [0.9, "0.9"], [1.1, "1.1"]], 0, function (v) { lr = v; w = 0; steps = 0; paint(); }),
      h("button", { type: "button", class: "w-btn primary", onclick: function () { step(1); } }, "Step"),
      h("button", { type: "button", class: "w-btn", onclick: function () { step(10); } }, "Run 10"),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { w = 0; steps = 0; paint(); } }, "Reset"));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. foundBpe — step through BPE merges on a tiny corpus
  ================================================================== */
  var BPE_CORPUS = [["tea", 6], ["team", 4], ["steam", 3], ["seat", 5], ["eat", 7]];

  function bpeStep(words) {
    var counts = {}, best = null, bestN = 0, i, j;
    for (i = 0; i < words.length; i++) {
      var sy = words[i].syms;
      for (j = 0; j < sy.length - 1; j++) {
        var key = sy[j] + " " + sy[j + 1];
        counts[key] = (counts[key] || 0) + words[i].n;
      }
    }
    for (var k in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, k)) continue;
      if (counts[k] > bestN || (counts[k] === bestN && best !== null && k < best)) { best = k; bestN = counts[k]; }
    }
    if (!best) return null;
    var parts = best.split(" "), merged = parts[0] + parts[1];
    for (i = 0; i < words.length; i++) {
      var out = [], src = words[i].syms;
      for (j = 0; j < src.length; j++) {
        if (j < src.length - 1 && src[j] === parts[0] && src[j + 1] === parts[1]) { out.push(merged); j++; }
        else out.push(src[j]);
      }
      words[i].syms = out;
    }
    return { a: parts[0], b: parts[1], merged: merged, n: bestN };
  }

  Widgets.foundBpe = function (mount) {
    shell(mount, "step-through", "Byte-pair encoding on a five-word corpus",
      "Each press finds the most frequent adjacent pair across the corpus (weighted by word count), merges it into a new token everywhere, and adds it to the vocabulary. Ties break alphabetically.");
    var words, merges;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function reset() {
      words = [];
      for (var i = 0; i < BPE_CORPUS.length; i++) words.push({ w: BPE_CORPUS[i][0], n: BPE_CORPUS[i][1], syms: BPE_CORPUS[i][0].split("") });
      merges = [];
    }

    function paint() {
      clear(stage);
      var total = 0;
      for (var i = 0; i < words.length; i++) {
        var row = h("div", { style: "display:flex;gap:6px;align-items:center;padding:3px 0;flex-wrap:wrap" },
          h("span", { style: "width:70px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim)" }, words[i].w + " ×" + words[i].n));
        for (var j = 0; j < words[i].syms.length; j++) {
          var sym = words[i].syms[j];
          var isNew = merges.length && sym === merges[merges.length - 1].merged;
          row.appendChild(h("span", { style: "font-family:var(--font-mono);font-size:0.85rem;padding:2px 8px;border-radius:6px;border:1px solid var(--line);background:var(--surface-solid)" + (isNew ? ";border-color:var(--lime);color:var(--lime-ink)" : "") }, sym));
        }
        total += words[i].n * words[i].syms.length;
        stage.appendChild(row);
      }
      var hist = merges.length ? merges.map(function (m, idx) { return (idx + 1) + ". " + m.a + " + " + m.b + " → " + m.merged + " (" + m.n + ")"; }).join("   ") : "no merges yet";
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);margin-top:8px" }, hist));
      clear(readout);
      readout.appendChild(ro("merges", merges.length));
      readout.appendChild(ro("vocabulary", 5 + merges.length));
      readout.appendChild(ro("corpus tokens", total));
      readout.appendChild(ro("last merge", merges.length ? merges[merges.length - 1].merged : "—"));
    }

    var stepBtn = h("button", { type: "button", class: "w-btn primary" }, "Merge next pair");
    stepBtn.addEventListener("click", function () {
      var m = bpeStep(words);
      if (m) merges.push(m);
      else stepBtn.textContent = "Done: every word is one token";
      paint();
    });
    var resetBtn = h("button", { type: "button", class: "w-btn ghost" }, "Reset");
    resetBtn.addEventListener("click", function () { reset(); stepBtn.textContent = "Merge next pair"; paint(); });

    mount.appendChild(h("div", { class: "widget-controls" }, stepBtn, resetBtn));
    mount.appendChild(stage);
    mount.appendChild(readout);
    reset();
    paint();
  };

  /* ==================================================================
     3. foundCosine — two 2-d vectors, cosine vs dot product
  ================================================================== */
  Widgets.foundCosine = function (mount) {
    shell(mount, "explorer", "Cosine similarity in two dimensions",
      "Rotate the two vectors and stretch B. Cosine depends only on the angle between them; the dot product also grows with length. That is why embedding search usually normalises vectors first.");
    var angA = 30, angB = 60, lenB = 1;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var SZ = 220, C = 110, R = 80;

    function paint() {
      var ra = angA * Math.PI / 180, rb = angB * Math.PI / 180;
      var a = [Math.cos(ra), Math.sin(ra)], b = [lenB * Math.cos(rb), lenB * Math.sin(rb)];
      var dot = a[0] * b[0] + a[1] * b[1];
      var cos = lenB > 0 ? dot / lenB : 0;
      var diff = Math.abs(angA - angB) % 360;
      if (diff > 180) diff = 360 - diff;

      clear(stage);
      var svg = s("svg", { viewBox: "0 0 " + SZ + " " + SZ, width: String(SZ), height: String(SZ), role: "img", "aria-label": "Two vectors from the origin" });
      svg.appendChild(s("circle", { cx: C, cy: C, r: R, fill: "none", stroke: "var(--line)", "stroke-dasharray": "3 4" }));
      svg.appendChild(s("line", { x1: 10, y1: C, x2: SZ - 10, y2: C, stroke: "var(--line)" }));
      svg.appendChild(s("line", { x1: C, y1: 10, x2: C, y2: SZ - 10, stroke: "var(--line)" }));
      svg.appendChild(s("line", { x1: C, y1: C, x2: (C + a[0] * R).toFixed(1), y2: (C - a[1] * R).toFixed(1), stroke: "var(--lime)", "stroke-width": "4", "stroke-linecap": "round" }));
      svg.appendChild(s("line", { x1: C, y1: C, x2: (C + b[0] * R * 0.6).toFixed(1), y2: (C - b[1] * R * 0.6).toFixed(1), stroke: "var(--cyan)", "stroke-width": "4", "stroke-linecap": "round" }));
      stage.appendChild(svg);

      clear(readout);
      readout.appendChild(ro("angle between", Math.round(diff) + "°"));
      readout.appendChild(ro("cosine", fmt(cos, 3)));
      readout.appendChild(ro("dot product", fmt(dot, 3)));
      readout.appendChild(ro("|B|", fmt(lenB, 1)));
      readout.appendChild(ro("reading", cos > 0.9 ? "near-same direction" : cos > 0.3 ? "related" : cos > -0.3 ? "roughly unrelated" : "opposed"));
    }

    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      slider("A angle (lime)", 0, 359, 1, angA, function (v) { angA = v; paint(); }),
      slider("B angle (cyan)", 0, 359, 1, angB, function (v) { angB = v; paint(); }),
      slider("B length", 0.2, 1.6, 0.1, lenB, function (v) { lenB = v; paint(); }));
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
    "found-basics": {
      title: "AI, ML, DL & GenAI checkpoint",
      sub: "The vocabulary, neurons and layers, loss and gradient descent.",
      questions: [
        {
          q: "Which statement places the terms correctly?",
          options: [
            "Generative AI contains deep learning, which contains machine learning, which contains AI",
            "AI contains machine learning, which contains deep learning; an LLM is a generative deep learning model",
            "Machine learning and AI are separate fields with no overlap",
            "Deep learning is the rule-based branch of AI that predates machine learning"
          ],
          answer: 1,
          explain: "AI is the broad goal, machine learning is the subset that learns from data, and deep learning is the subset of ML that uses many-layered neural networks. An LLM is a deep learning model that is also generative, because it produces new text rather than a label."
        },
        {
          q: "Why does a neural network need a nonlinear activation between layers?",
          options: [
            "Without it, a stack of linear layers collapses into one linear map, so extra depth adds no expressive power",
            "It is required to make the weights fit in GPU memory",
            "It keeps every weight positive so gradients cannot vanish",
            "It reduces the parameter count of each layer by half"
          ],
          answer: 0,
          explain: "Multiplying matrices together just gives another matrix, so ten linear layers can only represent what one linear layer can. A nonlinearity such as ReLU or GELU between them is what lets the network bend its decision surface and compose features."
        },
        {
          q: "A model gives the correct next token a probability of 0.9. What is the cross-entropy loss for that position (natural log)?",
          options: ["0.9", "2.30", "0.01", "About 0.105"],
          answer: 3,
          explain: "Cross-entropy for one position is the negative log of the probability assigned to the correct answer: −ln(0.9) ≈ 0.105. A confident correct prediction gives a small loss, while a probability of 0.01 would give about 4.6."
        },
        {
          q: "While training, the loss jumps up and down and then shoots to infinity. What is the most likely cause?",
          options: [
            "The learning rate is too small",
            "The model has too few parameters",
            "The learning rate is too large, so each step overshoots the minimum by more than it corrects",
            "The validation set is too large"
          ],
          answer: 2,
          explain: "With an oversized learning rate each update overshoots the minimum, and if the overshoot grows each step the weights diverge. On the simple loss (w − 3)², any rate above 1.0 makes every step land farther away than the last. Too small a rate is slow but stable."
        },
        {
          q: "Which statement about inference is true?",
          options: [
            "The weights are updated a little after every user request",
            "It runs only a forward pass with frozen weights, roughly 2 × parameters FLOPs per generated token",
            "It needs labelled examples for every prompt",
            "It costs about 6 × parameters × training tokens FLOPs per request"
          ],
          answer: 1,
          explain: "Inference is a forward pass with fixed weights; no gradients and no updates. A common rule of thumb is about 2N FLOPs per token for an N-parameter model, versus about 6N per token during training, where the backward pass roughly doubles the cost again. The 6·N·D figure is the total training budget, not a per-request cost."
        }
      ]
    },
    "found-tokens": {
      title: "Tokens & embeddings checkpoint",
      sub: "Tokenization, BPE, embedding tables and vector similarity.",
      questions: [
        {
          q: "Why do modern LLMs use subword tokens rather than whole words?",
          options: [
            "Subword tokens are always shorter than single characters",
            "Subwords remove the need for an embedding table",
            "They handle rare and unseen words by composing known pieces while keeping sequences much shorter than characters would",
            "Transformers cannot accept vocabularies larger than 1,000 entries"
          ],
          answer: 2,
          explain: "Word-level vocabularies explode in size and still miss new words, while character-level sequences get very long. Subwords sit in between: common words become one token and rare words are spelled from a few pieces, so nothing is ever out of vocabulary."
        },
        {
          q: "During BPE training, what gets merged at each step?",
          options: [
            "The most frequent adjacent pair of symbols in the corpus, weighted by how often each word appears",
            "The two longest words in the corpus",
            "A randomly chosen pair, to keep the vocabulary diverse",
            "The pair whose merge shrinks the vocabulary the most"
          ],
          answer: 0,
          explain: "BPE counts every adjacent symbol pair across the corpus, merges the most frequent one into a new token, and repeats. Each merge grows the vocabulary by one and shortens the corpus; training stops when the target vocabulary size is reached."
        },
        {
          q: "As a rough rule for English prose, 1,000 tokens is about how many words?",
          options: ["About 250 words", "About 750 words", "About 4,000 words", "Exactly 1,000 words"],
          answer: 1,
          explain: "A common rule of thumb is about four characters, or three quarters of a word, per token for English. Code, numbers and many other languages use more tokens per word, so budgets should be measured with the real tokenizer."
        },
        {
          q: "Two embedding vectors point in exactly opposite directions. What is their cosine similarity?",
          options: ["0", "1", "It is undefined", "−1"],
          answer: 3,
          explain: "Cosine similarity is the cosine of the angle between vectors. At 0° it is 1, at 90° it is 0, and at 180° it is −1. Length plays no part, which is why cosine is the default for comparing embeddings."
        },
        {
          q: "Why can you not search document vectors from embedding model A with a query vector from model B, even when both are 768-dimensional?",
          options: [
            "Model B's vectors are always longer, which breaks cosine",
            "Cosine similarity only works on integer vectors",
            "Each model learns its own coordinate system, so the same position means different things in each space",
            "Vectors from different vendors are encrypted against each other"
          ],
          answer: 2,
          explain: "Matching dimension is a coincidence of shape, not of meaning. Each embedding model arranges meaning along its own learned axes, so a query from one model lands in an arbitrary spot in the other's space. Switching models means re-embedding the whole collection."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.found = {
    id: "found",
    name: "Foundations",
    short: "FOUND",
    tagline: "From 'what is AI' to vectors",
    color: "#a3e635",
    blurb: "The vocabulary and the maths you need before anything else makes sense: how AI, machine learning, deep learning and generative AI nest; what a neural network is; how loss and gradients train it; and how text becomes tokens and tokens become vectors you can compare.",
    modules: [
      {
        id: "basics",
        name: "AI, ML, DL & GenAI",
        icon: "compass",
        lessons: [
          {
            id: "ai-ml-dl-genai",
            title: "What AI, ML, deep learning and GenAI actually are",
            summary: "Four nested ideas, where an LLM sits among them, and when it is the wrong tool.",
            minutes: 8,
            tags: ["ai", "machine-learning", "deep-learning", "genai", "llm"],
            blocks: [
              { t: "p", html: "Picture four nested circles. <strong>AI</strong> is the outer goal: software that does things we would call intelligent. Inside it, <strong>machine learning</strong> is the approach where behaviour is learned from data instead of written as rules. Inside that, <strong>deep learning</strong> uses neural networks with many layers. And <strong>generative AI</strong> is the family of deep learning models that produce new content — text, images, audio, code — rather than a single label or number." },
              { t: "table", headers: ["Term", "What it means", "Everyday example", "Learns from"], rows: [
                ["AI", "Any technique that makes software act intelligently", "A chess engine searching moves, a rules-based spam filter", "Rules, search, or data"],
                ["Machine learning", "Behaviour fitted to examples instead of hand-coded", "A credit-risk score trained on past loans", "Labelled or unlabelled data"],
                ["Deep learning", "ML with many-layered neural networks", "Speech recognition, image classification", "Large datasets, lots of compute"],
                ["Generative AI", "Deep learning models that output new content", "Chat assistants, image generators", "Huge corpora of text, images, audio"],
                ["LLM", "A large generative model trained to predict the next token of text", "A coding assistant completing a function", "Trillions of tokens of text and code"]
              ] },
              { t: "h", text: "Rules versus learning" },
              { t: "compare",
                bad: { title: "Hand-written rules", items: ["You enumerate every case: 'if subject contains FREE MONEY, mark spam'", "Transparent and cheap to run", "Brittle: spammers write FR3E M0NEY and the rule misses", "Every new case is more code"] },
                good: { title: "Learned from data", items: ["You collect examples labelled spam or not", "An algorithm finds the patterns, including ones you never noticed", "Adapts when you retrain on fresh examples", "Costs data, compute and evaluation discipline"] } },
              { t: "p", html: "Deep learning took over the hard perception and language problems because layered networks learn their own features: you no longer hand-design 'has an edge here' or 'contains this word'. Generative models take one more step — instead of answering <em>which class is this?</em> they answer <em>what plausibly comes next?</em>, over and over, which is how a paragraph or an image gets built." },
              { t: "table", headers: ["Model type", "Output", "Typical question"], rows: [
                ["Discriminative", "A label, score or number", "Is this transaction fraudulent? What will demand be next week?"],
                ["Generative", "New content drawn from a learned distribution", "Write a reply to this email. Draw a red bicycle."]
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper on classical ML.</strong> Feature engineering, tabular models, recommender systems and the offline/online evaluation of classic models live in the Synapse atlas. Lumen stays focused on LLMs and generative AI." },
              { t: "h", text: "Where an LLM sits" },
              { t: "ul", items: [
                "It is <strong>deep learning</strong>: a transformer neural network with billions of weights.",
                "It is <strong>generative</strong>: it produces text one token at a time.",
                "It is a <strong>language model</strong>: its training objective is to predict the next token given the ones before.",
                "It is a <strong>foundation model</strong>: one pretrained model is adapted to many tasks by prompting or fine-tuning instead of training a new model per task."
              ] },
              { t: "table", headers: ["Tier", "Approach to 'flag risky payments and explain why'", "What goes wrong or right"], rows: [
                ["Naive", "Send every payment to an LLM and ask 'is this fraud?'", "Slow, expensive per call, inconsistent, and it has never seen your labelled fraud history"],
                ["Solid", "Train a gradient-boosted classifier on tabular payment features", "Fast, cheap and measurable, but analysts get a bare score with no narrative"],
                ["Standout", "The classifier scores every payment; an LLM drafts a short explanation only for the flagged few, citing the features that drove the score", "Each model does what it is good at, and LLM cost scales with alerts, not traffic"]
              ] },
              { t: "note", variant: "trap", html: "'AI' in a product brief does not mean 'use an LLM'. Many problems — forecasting, ranking, anomaly detection on numbers — are solved better, cheaper and more predictably by a classic model. Reach for an LLM when the input or output is open-ended language." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'An LLM is a deep learning model trained to predict the next token. That makes it generative and general-purpose, but for a fixed-label prediction on tabular data I'd start with a classic model and use the LLM where language is the interface.'" },
              { t: "note", variant: "key", html: "<strong>AI ⊃ ML ⊃ deep learning; generative AI is the part of deep learning that makes new content.</strong> An LLM is a generative deep learning model for text — powerful for language, not automatically the right tool for every prediction." }
            ]
          },
          {
            id: "neural-nets",
            title: "Neural networks in one lesson",
            summary: "Weighted sums, nonlinearities and layers — with a forward pass you can do by hand.",
            minutes: 9,
            tags: ["neural-networks", "neurons", "activation", "layers"],
            blocks: [
              { t: "p", html: "A <strong>neuron</strong> is a tiny function: multiply each input by a weight, add them up with a bias, and pass the result through a nonlinear <strong>activation</strong>. A <strong>layer</strong> is many neurons reading the same inputs. A <strong>network</strong> is layers stacked so each one reads the previous layer's outputs. Training is nothing more than finding good values for all those weights." },
              { t: "code", lang: "text", code:
                "One neuron, by hand\n" +
                "inputs   x = [ 2.0, -1.0 ]\n" +
                "weights  w = [ 0.5,  1.0 ]\n" +
                "bias     b = 0.5\n\n" +
                "z = w·x + b = (0.5 × 2.0) + (1.0 × -1.0) + 0.5 = 1.0 - 1.0 + 0.5 = 0.5\n" +
                "ReLU(z)    = max(0, 0.5)          = 0.5\n" +
                "sigmoid(z) = 1 / (1 + e^-0.5)     ≈ 0.622"
              },
              { t: "h", text: "Layers, weights and activations" },
              { t: "table", headers: ["Piece", "What it is", "Scale in an LLM"], rows: [
                ["Weight", "A learned number that scales one input for one neuron", "Billions of them in total"],
                ["Bias", "A learned offset added before the activation", "One per neuron (some LLMs drop biases entirely)"],
                ["Layer (dense)", "A weight matrix W plus bias: y = activation(W·x + b)", "Matrices like 4096 × 4096 or 4096 × 11008"],
                ["Activation", "A nonlinear squash applied element-wise", "GELU or SwiGLU-style gates in most modern LLMs"],
                ["Forward pass", "Feeding inputs through every layer to get an output", "One forward pass per generated token"]
              ] },
              { t: "p", html: "The nonlinearity is the whole trick. Multiply two matrices and you get another matrix, so a hundred linear layers can only do what one could. Put a bend between them and each layer can carve the space differently, letting later layers build on features found by earlier ones." },
              { t: "table", headers: ["Activation", "Formula", "Where you meet it"], rows: [
                ["ReLU", "max(0, z)", "Classic default; cheap, but neurons can get stuck at zero"],
                ["GELU", "z × Φ(z), a smooth ReLU", "Transformer feed-forward layers"],
                ["Sigmoid", "1 / (1 + e^−z), output in (0, 1)", "Gates and binary probabilities"],
                ["Softmax", "e^zᵢ / Σ e^zⱼ over a vector", "Turning scores into a probability distribution — including the next-token distribution"]
              ] },
              { t: "code", lang: "python", code:
                "# A two-layer network's forward pass in plain Python\n" +
                "def relu(v):\n" +
                "    return [max(0.0, x) for x in v]\n\n" +
                "def dense(W, b, x):\n" +
                "    return [sum(wij * xj for wij, xj in zip(row, x)) + bi for row, bi in zip(W, b)]\n\n" +
                "x  = [2.0, -1.0]\n" +
                "W1 = [[0.5, 1.0], [-1.0, 0.5]]; b1 = [0.5, 0.0]\n" +
                "W2 = [[1.0, 2.0]];              b2 = [0.1]\n\n" +
                "hidden = relu(dense(W1, b1, x))   # [0.5, 0.0]  (second neuron: -2.5 -> clipped)\n" +
                "output = dense(W2, b2, hidden)    # [0.6]\n" +
                "print(hidden, output)"
              },
              { t: "stat", items: [
                { v: "≈16.8M", k: "weights in one 4096 × 4096 matrix" },
                { v: "100s", k: "such matrices in a 7B-parameter model" },
                { v: "1", k: "forward pass per generated token" }
              ] },
              { t: "h", text: "Why depth works, and what it costs" },
              { t: "p", html: "Early layers pick up simple regularities; later layers combine them into more abstract ones. In a language model that might be spelling patterns, then syntax, then topic and intent. The trade-off: more layers and wider layers mean more parameters, which need more data and compute to train, more memory to serve, and become harder to inspect. You cannot point at a single weight and say what it means." },
              { t: "note", variant: "trap", html: "Artificial neurons are loosely inspired by biology and nothing more. Do not reason about LLM behaviour from brain analogies; reason from the maths — weighted sums, nonlinearities and a training objective." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'A neural network is stacked layers of weighted sums with nonlinearities in between. The nonlinearity is what makes depth useful, and training just means adjusting the weights to lower a loss.'" },
              { t: "note", variant: "key", html: "<strong>Weighted sum, bias, nonlinearity — repeated in layers.</strong> That is all a neural network is; an LLM is a very large, specially wired one." }
            ]
          },
          {
            id: "learning",
            title: "How models learn: loss, gradients, training vs inference",
            summary: "A loss scores wrongness, gradients point downhill, and training costs far more than using the model.",
            minutes: 10,
            tags: ["loss", "gradient-descent", "training", "inference", "cross-entropy"],
            blocks: [
              { t: "p", html: "Think of every possible setting of the weights as a point on a landscape, and the <strong>loss</strong> as the height: how wrong the model is on the training data. Training starts somewhere random and repeatedly takes a small step downhill. The <strong>gradient</strong> tells you which way is downhill for every weight at once; <strong>backpropagation</strong> is the efficient way to compute it." },
              { t: "h", text: "Loss: a number for 'how wrong'" },
              { t: "p", html: "Language models use <strong>cross-entropy</strong>: for each position, take the probability the model gave to the token that actually came next, and compute −ln(p). Confident and right is cheap; confident and wrong is very expensive." },
              { t: "table", headers: ["Probability on the correct token", "Loss −ln(p)", "Reading"], rows: [
                ["0.9", "0.105", "Confident and right"],
                ["0.5", "0.693", "A coin flip between two options"],
                ["0.1", "2.303", "Mostly expected something else"],
                ["0.01", "4.605", "Badly surprised"]
              ] },
              { t: "h", text: "Gradients and gradient descent" },
              { t: "p", html: "The update rule is one line: <code class='tok'>w ← w − η · ∂L/∂w</code>, where η (eta) is the <strong>learning rate</strong>. Here it is on a toy loss with a single weight whose best value is 3." },
              { t: "code", lang: "text", code:
                "L(w) = (w - 3)^2          dL/dw = 2(w - 3)          η = 0.1, start w = 0\n\n" +
                "step  w      gradient   new w = w - 0.1 × grad   loss\n" +
                "0     0.00   -6.00      0.60                     9.00 -> 5.76\n" +
                "1     0.60   -4.80      1.08                     5.76 -> 3.69\n" +
                "2     1.08   -3.84      1.46                     3.69 -> 2.36\n" +
                "...   each step removes 20% of the remaining distance to 3"
              },
              { t: "widget", id: "foundDescent" },
              { t: "table", headers: ["Tier", "Learning-rate choice", "Effect"], rows: [
                ["Naive", "Very small and fixed", "Stable but wastes compute; may stall in flat regions"],
                ["Naive", "Large and fixed", "Overshoots, oscillates or diverges — the loss goes to infinity"],
                ["Solid", "A tuned rate with warm-up then decay", "Fast early progress, fine adjustments later; the norm for LLM training"],
                ["Standout", "Warm-up and decay plus gradient clipping and loss monitoring, with checkpoints to roll back on a spike", "Survives the occasional bad batch on a run that costs real money"]
              ] },
              { t: "h", text: "Training versus inference" },
              { t: "table", headers: ["Aspect", "Training", "Inference"], rows: [
                ["Goal", "Find good weights", "Use the weights to produce output"],
                ["Passes", "Forward, backward, update — repeated over the dataset", "Forward only"],
                ["Weights", "Change every step", "Frozen"],
                ["Rule-of-thumb compute", "≈ 6 × N × D FLOPs for N parameters and D tokens", "≈ 2 × N FLOPs per generated token"],
                ["Who pays", "The model builder, once (plus fine-tunes)", "Every user, on every request"]
              ] },
              { t: "stat", items: [
                { v: "6·N·D", k: "approx. training FLOPs" },
                { v: "2·N", k: "approx. inference FLOPs per token" },
                { v: "0", k: "weight updates during a chat" }
              ] },
              { t: "note", variant: "warn", html: "Low training loss is not the goal; low loss on data the model has <em>not</em> seen is. Always hold out a validation set. A model that memorises training data and fails on fresh data is <strong>overfitting</strong>. How this plays out at LLM scale is covered in <a class='inline' href='#/train/pretrain/compute-scaling'>compute and scaling laws</a>." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'Training minimises cross-entropy by gradient descent, roughly 6ND FLOPs. Inference is a forward pass with frozen weights, about 2N FLOPs per token — so a chat never updates the model; it only reads it.'" },
              { t: "quiz", id: "found-basics" },
              { t: "note", variant: "key", html: "<strong>Loss measures wrongness, the gradient points downhill, and the learning rate sets the stride.</strong> Training is expensive and happens once; inference is cheaper per call but happens on every request with frozen weights." }
            ]
          }
        ]
      },
      {
        id: "tokens",
        name: "Tokens & Embeddings",
        icon: "grid",
        lessons: [
          {
            id: "tokenization",
            title: "Tokens and tokenization (BPE)",
            summary: "Why models read subword integers, how byte-pair encoding builds its vocabulary, and what that costs you.",
            minutes: 10,
            tags: ["tokens", "tokenization", "bpe", "vocabulary"],
            blocks: [
              { t: "p", html: "A model never sees letters. A <strong>tokenizer</strong> chops text into pieces from a fixed vocabulary and maps each piece to an integer id; the model reads and writes those ids. Your context limit, your bill and your latency are all counted in <strong>tokens</strong>, so it pays to know what one is." },
              { t: "table", headers: ["Tier", "Granularity", "Trade-off"], rows: [
                ["Naive", "Whole words", "Huge vocabulary, and any unseen word ('unfollowable') becomes an unknown token"],
                ["Naive", "Single characters", "Tiny vocabulary, but sequences get 4–5× longer and attention cost grows with length"],
                ["Solid", "Subwords learned with BPE", "Common words are one token, rare words split into a few known pieces"],
                ["Standout", "Byte-level BPE", "Starts from the 256 possible bytes, so any string in any language or emoji can be encoded with nothing out of vocabulary"]
              ] },
              { t: "h", text: "BPE, one merge at a time" },
              { t: "p", html: "Byte-pair encoding starts with every word spelled as single symbols, then repeatedly merges the most frequent adjacent pair into a new symbol. Take a toy corpus: <code class='tok'>tea</code> ×6, <code class='tok'>team</code> ×4, <code class='tok'>steam</code> ×3, <code class='tok'>seat</code> ×5, <code class='tok'>eat</code> ×7. The base vocabulary is the five letters t, e, a, m, s, and the corpus is 90 symbols long." },
              { t: "table", headers: ["Merge", "Most frequent pair", "Count", "New token", "Corpus length"], rows: [
                ["—", "—", "—", "—", "90"],
                ["1", "e + a", "25 (in every word)", "ea", "65"],
                ["2", "t + ea", "13 (tea, team, steam)", "tea", "52"],
                ["3", "ea + t", "12 (seat, eat)", "eat", "40"],
                ["4", "tea + m", "7 (team, steam)", "team", "33"],
                ["5", "s + eat", "5 (seat)", "seat", "28"],
                ["6", "s + team", "3 (steam)", "steam", "25"]
              ] },
              { t: "widget", id: "foundBpe" },
              { t: "p", html: "To tokenize new text, apply the learned merges in the same order. <code class='tok'>seats</code> starts as s·e·a·t·s, merge 1 gives s·ea·t·s, merge 3 gives s·eat·s, merge 5 gives <strong>seat·s</strong>: two tokens, even though 'seats' never appeared in training. Real tokenizers do this with tens of thousands to a few hundred thousand merges (GPT-2's byte-level vocabulary had 50,257 entries) and treat a leading space as part of the token." },
              { t: "h", text: "Rules of thumb" },
              { t: "ul", items: [
                "English prose averages roughly <strong>4 characters</strong> or <strong>¾ of a word</strong> per token, so 1,000 tokens ≈ 750 words.",
                "Code, JSON, numbers and many non-English languages need noticeably more tokens for the same content.",
                "' cat', 'cat' and 'Cat' can be three different tokens: spaces and case matter.",
                "Long numbers split into arbitrary chunks, which is one reason raw arithmetic is unreliable."
              ] },
              { t: "code", lang: "text", code:
                "Illustrative split (exact pieces depend on the tokenizer)\n" +
                "\"Tokenization isn't free.\"  ->  [Token][ization][ isn]['t][ free][.]   6 tokens\n" +
                "\"1234567\"                   ->  [123][456][7]                          3 tokens\n" +
                "\"strawberry\"                ->  [str][aw][berry]                       3 tokens"
              },
              { t: "note", variant: "trap", html: "Asking a model 'how many r's are in strawberry?' probes something it cannot see directly: it receives a few subword ids, not ten letters. Spelling, letter counting and digit manipulation are tokenization problems as much as reasoning problems." },
              { t: "note", variant: "tip", html: "Paste your own prompts into the tokenizer pane of the <a class='inline' href='#/playground'>LLM playground</a> to see where the boundaries fall and how the count changes with formatting." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'Models work on subword tokens learned by BPE. Context windows, pricing and latency are all per token, so I measure prompts with the model's own tokenizer instead of counting words.'" },
              { t: "note", variant: "key", html: "<strong>Text → subword tokens → integer ids.</strong> BPE builds the vocabulary by merging frequent pairs; every limit and price you will meet is counted in those tokens." }
            ]
          },
          {
            id: "embeddings",
            title: "Embeddings: meaning as coordinates",
            summary: "Each token id becomes a learned vector, and related meanings end up close together.",
            minutes: 9,
            tags: ["embeddings", "vectors", "representation"],
            blocks: [
              { t: "p", html: "An integer id carries no meaning: token 1042 is not 'close' to token 1043. So the first thing a model does is look each id up in an <strong>embedding table</strong> — a matrix with one row per vocabulary entry — and swap the id for that row, a vector of a few hundred to several thousand numbers. Those numbers are learned, and training pushes tokens used in similar ways toward similar vectors." },
              { t: "diagram", id: "tokens-embeddings", caption: "Text is split into tokens, each token id selects a row of the embedding table, and the resulting vectors enter the transformer." },
              { t: "code", lang: "text", code:
                "vocabulary size V = 50,000      embedding width d = 4,096\n" +
                "embedding table E has shape [V, d]\n\n" +
                "\"the cat\" -> ids [262, 3797] -> [ E[262], E[3797] ]  -> a [2, 4096] matrix\n" +
                "(ids are illustrative; each row is 4,096 learned numbers)"
              },
              { t: "stat", items: [
                { v: "204.8M", k: "parameters in a 50k × 4,096 table" },
                { v: "12,288", k: "embedding width of GPT-3 (175B)" },
                { v: "1 lookup", k: "per token — no maths, just indexing" }
              ] },
              { t: "h", text: "Where the meaning comes from" },
              { t: "p", html: "Nobody labels the axes. Because the whole network is trained to predict the next token, tokens that appear in similar contexts receive similar gradient nudges and drift together — the old idea that a word is known by the company it keeps. Earlier models such as word2vec learned only this table; see <a class='inline' href='#/hist/before/word2vec'>word2vec and learned word vectors</a> for that history." },
              { t: "table", headers: ["Kind", "What you get", "Weakness"], rows: [
                ["Static (input) embedding", "One fixed vector per token, from the table", "'bank' has the same vector by a river and in a loan form"],
                ["Contextual embedding", "The hidden state after the transformer layers have mixed in the surrounding tokens", "Depends on the whole input; costs a forward pass"],
                ["Text (sentence) embedding", "One vector for a whole passage, from a model trained for similarity", "Compresses nuance; quality depends on the embedding model and domain"]
              ] },
              { t: "h", text: "Embeddings for search" },
              { t: "p", html: "Dedicated <strong>embedding models</strong> map a whole sentence or chunk to a single vector so that 'how do I reset my password' lands near 'steps to change your login credentials'. That is the engine under semantic search and retrieval-augmented generation, covered in <a class='inline' href='#/rag/retrieval/vector-dbs'>embeddings and vector databases</a>." },
              { t: "table", headers: ["Tier", "Embedding a document collection", "Outcome"], rows: [
                ["Naive", "Average the chat model's raw token embeddings", "Cheap, but those vectors were never trained for similarity; retrieval is noisy"],
                ["Solid", "A dedicated embedding model, the same one for queries and documents", "Good semantic matching out of the box"],
                ["Standout", "Solid, plus measure recall on real queries, record the model and version with every vector, and re-embed on upgrade", "Retrieval quality you can prove, and migrations that do not silently break"]
              ] },
              { t: "note", variant: "warn", html: "Vectors from different embedding models — or different versions of one — live in different coordinate systems. Never mix them in one index; changing models means re-embedding everything." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'An embedding is a learned vector per token or per passage. Distance in that space approximates similarity of meaning, which is what semantic search exploits.'" },
              { t: "note", variant: "key", html: "<strong>Ids become learned vectors, and similar use means nearby vectors.</strong> Token embeddings feed the transformer; passage embeddings from a dedicated model power search." }
            ]
          },
          {
            id: "vector-space",
            title: "Vector-space intuition and similarity",
            summary: "Dot product, cosine and Euclidean distance, worked on 3-d vectors, and why high dimensions mislead.",
            minutes: 9,
            tags: ["cosine-similarity", "dot-product", "vectors", "similarity"],
            blocks: [
              { t: "p", html: "In embedding space, <strong>direction carries meaning</strong>. Two texts about the same thing point the same way; unrelated texts sit near right angles. Similarity measures are just different ways of asking 'how aligned are these arrows?'" },
              { t: "h", text: "Three ways to compare vectors" },
              { t: "table", headers: ["Measure", "Formula", "Range", "Notes"], rows: [
                ["Dot product", "a·b = Σ aᵢbᵢ", "Unbounded", "Grows with length as well as alignment; fastest to compute"],
                ["Cosine similarity", "a·b / (|a| |b|)", "−1 to 1", "Pure angle; the usual default for text embeddings"],
                ["Euclidean distance", "√Σ (aᵢ − bᵢ)²", "0 to ∞ (lower = closer)", "Sensitive to length; for unit vectors it ranks results exactly like cosine"]
              ] },
              { t: "h", text: "Worked example in three dimensions" },
              { t: "code", lang: "text", code:
                "cat = [0.9, 0.8, 0.1]   dog = [0.8, 0.9, 0.2]   car = [0.1, 0.2, 0.9]\n\n" +
                "cat·dog = 0.72 + 0.72 + 0.02 = 1.46\n" +
                "|cat| = √(0.81 + 0.64 + 0.01) = √1.46 ≈ 1.208\n" +
                "|dog| = √(0.64 + 0.81 + 0.04) = √1.49 ≈ 1.221\n" +
                "cos(cat, dog) = 1.46 / (1.208 × 1.221) ≈ 0.990    -> nearly the same direction\n\n" +
                "cat·car = 0.09 + 0.16 + 0.09 = 0.34\n" +
                "|car| = √(0.01 + 0.04 + 0.81) = √0.86 ≈ 0.927\n" +
                "cos(cat, car) = 0.34 / (1.208 × 0.927) ≈ 0.303    -> weakly related"
              },
              { t: "widget", id: "foundCosine" },
              { t: "p", html: "Two identities save real compute. If every vector is normalised to length 1, cosine equals the dot product, so the database can use the cheaper operation. And for unit vectors, squared Euclidean distance is 2 − 2·cos, so all three measures rank neighbours identically. Normalise once at write time and the choice of metric stops mattering." },
              { t: "h", text: "Vector arithmetic and its limits" },
              { t: "p", html: "Static word vectors famously support analogies: the offset from 'man' to 'woman' roughly matches the offset from 'king' to 'queen'. It is a striking demo of structure in the space, but it is approximate, cherry-picked in many write-ups, and much weaker in modern contextual and passage embeddings. Treat it as intuition, not as an operation you build on." },
              { t: "note", variant: "trap", html: "Intuition from 2-d drawings breaks in 768 or 3,072 dimensions. Scores from a given model often bunch into a narrow band, so a cosine of 0.8 might be mediocre for one model and excellent for another. Thresholds are model-specific: calibrate them on labelled pairs from your own data." },
              { t: "stat", items: [
                { v: "768M", k: "multiply-adds to brute-force 1M × 768-d vectors per query" },
                { v: "2 − 2cos", k: "squared distance between unit vectors" },
                { v: "ANN", k: "approximate indexes trade a little recall for big speed" }
              ] },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> 'I normalise embeddings so cosine equals dot product, and I calibrate the similarity threshold per model on real pairs rather than assuming 0.8 means similar.'" },
              { t: "quiz", id: "found-tokens" },
              { t: "note", variant: "key", html: "<strong>Similarity is about direction.</strong> Cosine ignores length; on normalised vectors it equals the dot product and ranks exactly like Euclidean distance — and every threshold must be calibrated per model." }
            ]
          }
        ]
      }
    ]
  };
})();
