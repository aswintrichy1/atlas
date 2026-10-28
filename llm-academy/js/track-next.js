/* =====================================================================
   LUMEN · Multimodal & What's Next
   window.TRACKS.next — modules: multimodal / frontier

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
     1. nextDiffusion — forward noising of a tiny grid "image", and the
        denoiser's one-shot guess of the clean image at each step.
        Deterministic: fixed-seed noise, so every visit looks the same.
  ================================================================== */
  var DF_W = 18, DF_H = 12, DF_T = 10;
  var DF_RAMP = " .:-=+*#%@";

  function dfRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dfGauss(rng) {
    var u = Math.max(rng(), 1e-9), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  var DF_X0 = [], DF_EPS = [], DF_ERR = [];
  (function build() {
    var r1 = dfRng(7), r2 = dfRng(99);
    for (var y = 0; y < DF_H; y++) {
      for (var x = 0; x < DF_W; x++) {
        var dx = (x - 6) / 1.0, dy = (y - 4) / 0.75;
        var v = 0;
        if (dx * dx + dy * dy <= 9) v = 1;              // a sun
        else if (y >= 9) v = 0.55;                       // the ground
        else if (y === 8 && x > 9 && x < 16) v = 0.8;    // a low hill
        DF_X0.push(v * 2 - 1);                           // scale to [-1, 1]
        DF_EPS.push(dfGauss(r1));
        DF_ERR.push(dfGauss(r2));
      }
    }
  })();

  function dfAlphaBar(t) {
    var c = Math.cos((t / DF_T) * Math.PI / 2);
    return Math.max(c * c, 0);
  }

  Widgets.nextDiffusion = function (mount) {
    shell(mount, "simulator", "Noise in, image out",
      "A tiny greyscale picture (a sun over a hill) on an " + DF_W + " \u00d7 " + DF_H + " grid. Slide the step to add noise the way a diffusion model's forward process does. Switch the view to see what a trained denoiser would guess the clean picture is from that noisy input in one shot.");
    var state = { t: 3, view: "noisy" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var range = h("input", { type: "range", min: "0", max: String(DF_T), step: "1", value: String(state.t) });
    range.addEventListener("input", function () { state.t = parseInt(range.value, 10) || 0; paint(); });

    function pixel(v) {
      var n = Math.max(0, Math.min(1, (v + 1) / 2));
      var c = DF_RAMP.charAt(Math.round(n * (DF_RAMP.length - 1)));
      return c + c;
    }

    function paint() {
      var ab = dfAlphaBar(state.t);
      var sig = Math.sqrt(ab), noi = Math.sqrt(1 - ab);
      var lines = [], err = 0;
      for (var y = 0; y < DF_H; y++) {
        var row = "";
        for (var x = 0; x < DF_W; x++) {
          var i = y * DF_W + x;
          var xt = sig * DF_X0[i] + noi * DF_EPS[i];
          var v = xt;
          if (state.view === "guess") {
            // a good denoiser's estimate: blurrier and more wrong as noise grows
            v = sig * DF_X0[i] + noi * 0.45 * DF_ERR[i];
          }
          err += Math.abs(v - DF_X0[i]);
          row += pixel(v);
        }
        lines.push(row);
      }
      clear(stage);
      stage.appendChild(h("pre", { style: "font-family:var(--font-mono);font-size:0.78rem;line-height:1.05;margin:0 auto;padding:10px;background:var(--surface-solid);border:1px solid var(--line);border-radius:8px;width:max-content;max-width:100%;overflow:auto" }, lines.join("\n")));
      var phase = state.t === 0 ? "clean image: what training data looks like"
        : state.t === DF_T ? "pure noise: where generation starts"
        : state.t <= 3 ? "light noise: fine detail goes first"
        : state.t <= 7 ? "heavy noise: only coarse layout survives"
        : "almost pure noise: the model must invent the layout";
      stage.appendChild(h("div", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:8px;text-align:center" }, phase));
      clear(readout);
      readout.appendChild(ro("step", state.t + " / " + DF_T));
      readout.appendChild(ro("signal weight", sig.toFixed(2)));
      readout.appendChild(ro("noise weight", noi.toFixed(2)));
      readout.appendChild(ro("signal-to-noise", ab >= 0.9999 ? "\u221e" : (ab / Math.max(1 - ab, 1e-9)).toFixed(2)));
      readout.appendChild(ro("mean pixel error", (err / (DF_W * DF_H)).toFixed(2)));
      readout.appendChild(ro("view", state.view === "noisy" ? "noisy input x_t" : "denoiser's guess of x_0"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "noise step ", range),
      segment([["noisy", "Noisy input"], ["guess", "Denoiser's guess"]], 0, function (v) { state.view = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. nextOnDevice — does a model of N parameters at precision P fit
        in the memory a device can actually give it?
        Rough planning numbers only; real usage depends on runtime and context.
  ================================================================== */
  var OD_SIZES = [0.5, 1, 2, 3, 4, 7, 8, 14, 32, 70];
  var OD_PREC = { fp16: 2, int8: 1, q4: 0.56 };
  var OD_PREC_LABEL = { fp16: "FP16 (2 bytes/param)", int8: "INT8 (1 byte/param)", q4: "4-bit (~0.56 bytes/param incl. scales)" };
  var OD_DEVICES = [
    ["phone8", "Phone, 8 GB RAM", 3],
    ["phone12", "Phone, 12 GB RAM", 5],
    ["laptop16", "Laptop, 16 GB unified memory", 10],
    ["laptop32", "Laptop, 32 GB unified memory", 22],
    ["gpu24", "Desktop GPU, 24 GB VRAM", 21],
    ["gpu80", "Data-centre GPU, 80 GB", 74]
  ];
  var OD_OVERHEAD = 1.2;

  Widgets.nextOnDevice = function (mount) {
    shell(mount, "calculator", "Will it fit on the device?",
      "Choose a model size, a precision and a device. Weights take parameters \u00d7 bytes per parameter; add roughly 20% for the KV cache at a modest context and runtime buffers. The device budget is the memory realistically left for the model after the OS and other apps.");
    var state = { size: 5, prec: "q4", dev: 2 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var range = h("input", { type: "range", min: "0", max: String(OD_SIZES.length - 1), step: "1", value: String(state.size) });
    range.addEventListener("input", function () { state.size = parseInt(range.value, 10) || 0; paint(); });
    var sel = h("select", { class: "sim-select" });
    for (var i = 0; i < OD_DEVICES.length; i++) {
      var o = h("option", { value: String(i) }, OD_DEVICES[i][1]);
      if (i === state.dev) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () { state.dev = parseInt(sel.value, 10) || 0; paint(); });

    function paint() {
      var params = OD_SIZES[state.size];
      var weights = params * OD_PREC[state.prec];
      var need = weights * OD_OVERHEAD;
      var budget = OD_DEVICES[state.dev][2];
      var ratio = budget > 0 ? need / budget : 99;
      var verdict = ratio <= 0.8 ? "fits comfortably" : ratio <= 1 ? "tight: short contexts, nothing else running" : "does not fit";
      var hue = ratio <= 0.8 ? "var(--lime)" : ratio <= 1 ? "var(--amber)" : "var(--rose)";
      var maxGb = Math.max(need, budget) * 1.1;
      clear(stage);
      function bar(label, gb, color) {
        return h("div", { style: "display:grid;grid-template-columns:150px 1fr 80px;gap:10px;align-items:center;padding:4px 0" },
          h("span", { style: "font-size:0.84rem" }, label),
          h("span", { style: "display:block;height:12px;background:var(--surface-solid);border-radius:6px;overflow:hidden;border:1px solid var(--line)" },
            h("i", { style: "display:block;height:100%;width:" + Math.min(100, Math.round(gb / maxGb * 100)) + "%;background:" + color })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, gb.toFixed(1) + " GB"));
      }
      stage.appendChild(bar("Model needs", need, hue));
      stage.appendChild(bar("Device can give", budget, "var(--cyan)"));
      stage.appendChild(h("div", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:6px" },
        params + "B params \u00d7 " + OD_PREC_LABEL[state.prec] + " = " + weights.toFixed(1) + " GB of weights, plus overhead."));
      clear(readout);
      readout.appendChild(ro("model", params + "B"));
      readout.appendChild(ro("weights", weights.toFixed(1) + " GB"));
      readout.appendChild(ro("with overhead", need.toFixed(1) + " GB"));
      readout.appendChild(ro("budget", budget + " GB"));
      readout.appendChild(ro("verdict", verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch" },
      h("label", { class: "w-field" }, "model size ", range),
      segment([["fp16", "FP16"], ["int8", "INT8"], ["q4", "4-bit"]], 2, function (v) { state.prec = v; paint(); }),
      h("label", { class: "w-field" }, "device ", sel)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "next-multimodal": {
      title: "Multimodal models checkpoint",
      sub: "Patch embeddings, image-text alignment, speech and diffusion.",
      questions: [
        {
          q: "How does a vision transformer turn an image into something a transformer can process?",
          options: [
            "It splits the image into fixed-size patches, flattens each one and projects it to an embedding vector, then adds position information, so each patch acts like a token",
            "It converts the image to a text caption first and tokenizes the caption",
            "It feeds every pixel in as a separate token with no projection",
            "It compresses the image to a single vector with a hash function"
          ],
          answer: 0,
          explain: "Patches are the image equivalent of tokens: a 224 \u00d7 224 image cut into 16 \u00d7 16 patches gives 196 of them. Per-pixel tokens would make attention far too expensive, and captioning first would throw away most of the visual information."
        },
        {
          q: "What does contrastive image-text training (CLIP-style) optimise for?",
          options: [
            "Generating a caption word by word from the image",
            "Reconstructing the image pixels from its caption",
            "Pulling the embeddings of matching image-caption pairs together and pushing mismatched pairs apart, producing a shared space for images and text",
            "Classifying images into a fixed list of labels"
          ],
          answer: 2,
          explain: "Two encoders, one per modality, are trained so that a photo and its own caption score higher than the photo with any other caption in the batch. The result is a joint embedding space, which enables zero-shot classification and text-to-image search and also conditions many image generators."
        },
        {
          q: "In a diffusion model, what is the forward process?",
          options: [
            "The network generating an image from a prompt",
            "Encoding the prompt with a text encoder",
            "Upscaling a small image to a larger one",
            "Gradually adding Gaussian noise to a clean image over many steps until it is indistinguishable from noise; the network learns to reverse it"
          ],
          answer: 3,
          explain: "The forward process is fixed and needs no learning: it just mixes in more noise per step on a schedule. Training teaches a network to predict the added noise at each step; generation runs that learned reverse process starting from pure noise."
        },
        {
          q: "What is the main advantage of latent diffusion over diffusion directly on pixels?",
          options: [
            "It needs no training data",
            "It runs the denoising in the compressed latent space of an autoencoder, which is far smaller than the pixel grid, so training and sampling are much cheaper",
            "It removes the need for a noise schedule",
            "It guarantees the output exactly matches the prompt"
          ],
          answer: 1,
          explain: "A 512 \u00d7 512 RGB image has about 786,000 values; a typical latent for it has tens of thousands. Denoising there costs far less, and a decoder maps the final latent back to pixels. Training data, noise schedules and imperfect prompt adherence all remain."
        },
        {
          q: "What usually happens when you raise the classifier-free guidance scale very high?",
          options: [
            "Images become more random and ignore the prompt",
            "Generation becomes faster",
            "Images follow the prompt more literally but lose diversity and can look oversaturated or distorted",
            "The model switches to a different text encoder"
          ],
          answer: 2,
          explain: "Guidance extrapolates from the unconditional prediction toward the prompt-conditioned one. A moderate scale improves prompt adherence; a very large one pushes samples off the natural-image distribution, giving harsh colours and repeated, similar outputs. It also costs an extra prediction per step."
        },
        {
          "q": "You are extracting totals from thousands of scanned, photographed receipts. Which pipeline fits best?",
          "options": [
            "Plain text extraction from the PDF text layer, then an LLM",
            "A vision-capable model on each image with a JSON schema, then code checks (line items sum to the total, dates parse) and a review queue for failures",
            "A speech-to-speech model",
            "Fine-tune a model before trying anything else"
          ],
          "answer": 1,
          "explain": "Scans and photos have no reliable text layer, so the model must read the image. A schema makes the output machine-checkable, deterministic validation catches arithmetic and format errors, and a human queue handles the uncertain remainder. Fine-tuning is a later optimisation, not a starting point."
        }
      ]
    },
    "next-frontier": {
      title: "Frontier checkpoint",
      sub: "Small models, on-device AI and keeping up with the field.",
      questions: [
        {
          q: "What is knowledge distillation?",
          options: [
            "Removing training documents that contain errors",
            "Training a smaller student model to match a larger teacher model's outputs or probability distributions",
            "Compressing weights to 4-bit integers",
            "Merging two models by averaging their weights"
          ],
          answer: 1,
          explain: "The teacher's full probability distribution carries more signal than a single correct label, so a student can learn more per example. Quantisation and weight merging are separate techniques that are often combined with distillation, not the same thing."
        },
        {
          q: "Why does 4-bit quantisation matter so much for on-device models?",
          options: [
            "It makes the model more accurate than FP16",
            "It removes the need for a tokenizer",
            "It lets the model train on the device",
            "It cuts weight memory roughly fourfold versus FP16, and token generation is mostly limited by moving weights through memory, so the model both fits and runs faster"
          ],
          answer: 3,
          explain: "A 7B model is about 14 GB in FP16 and roughly 4 GB at 4-bit, the difference between impossible and practical on many devices. Decoding reads every weight for every token, so fewer bytes also means more tokens per second. Quality usually drops slightly, which you should measure."
        },
        {
          q: "What is an NPU in a phone or laptop?",
          options: [
            "A dedicated accelerator for low-precision matrix maths that runs neural networks with much less power than the CPU or GPU",
            "A network card optimised for streaming model weights from the cloud",
            "A software library for prompt templates",
            "A type of storage for model checkpoints"
          ],
          answer: 0,
          explain: "Neural processing units specialise in the integer and low-precision operations that inference needs, which matters on battery. They often support a narrower set of operations than a GPU, so runtimes must convert models into formats the NPU can execute."
        },
        {
          q: "An app advertises on-device AI. What should you check before claiming it is private?",
          options: [
            "Nothing: on-device always means private",
            "Only the model's parameter count",
            "Whether prompts, outputs or telemetry are sent anywhere, and whether some requests silently fall back to a cloud model",
            "Whether the model was trained with RLHF"
          ],
          answer: 2,
          explain: "Running inference locally keeps data off the network only if the surrounding app does too. Hybrid designs commonly route harder requests to a server, and analytics can capture content. Privacy is a property of the whole data flow, not of where the matrix multiplications happen."
        },
        {
          q: "A new model launches with impressive leaderboard claims. What is the most reliable way to decide whether to adopt it?",
          options: [
            "Switch immediately, because newer models are always better",
            "Run it on your own evaluation set for your task, and compare quality, cost and latency against what you use now",
            "Wait for social media consensus",
            "Pick whichever model has the largest parameter count"
          ],
          answer: 1,
          explain: "Public benchmarks are useful signals but can be saturated, contaminated or unrelated to your task. A small, versioned eval set of your real cases is the only measurement that answers your question, and it makes the switch decision repeatable."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.next = {
    id: "next",
    name: "Multimodal & What's Next",
    short: "NEXT",
    tagline: "Beyond text",
    color: "#818cf8",
    blurb: "How models see and hear (patch embeddings, image-text alignment, speech in and out), how diffusion models make images from noise, why small models and on-device AI matter, and a practical, hype-free way to keep up with a field that changes every month.",
    modules: [
      {
        id: "multimodal",
        name: "Multimodal Models",
        icon: "diamond",
        lessons: [
          {
            id: "vision-audio",
            title: "Vision and audio models",
            summary: "Patches as tokens, image-text embeddings, and speech-to-text and text-to-speech.",
            minutes: 10,
            tags: ["multimodal", "vision", "audio", "speech", "clip"],
            blocks: [
              { t: "p", html: "The mental model for every multimodal system: <strong>turn the signal into a sequence of vectors, then let a transformer attend over it</strong>. Text becomes token embeddings; images become patch embeddings; audio becomes frames of a spectrogram or discrete audio tokens. Once everything is vectors in one context, the same attention machinery mixes them." },
              { t: "h", text: "Images as tokens: patch embeddings" },
              { t: "p", html: "The vision transformer (ViT, 2020) cut an image into a grid of fixed-size patches, flattened each patch, multiplied it by a learned matrix to get an embedding, and added position embeddings, exactly like word tokens. A transformer encoder then attends across patches. With enough training data this matched or beat the convolutional networks that had dominated vision." },
              { t: "code", lang: "text", code:
                "image:            224 x 224 pixels, 3 colour channels\n" +
                "patch size:       16 x 16\n" +
                "patches:          (224 / 16) x (224 / 16) = 14 x 14 = 196\n" +
                "each patch:       16 * 16 * 3 = 768 numbers -> linear projection -> embedding\n\n" +
                "higher resolution or many images  ->  many more 'tokens' in the context"
              },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Convolutional networks, classical image features and the offline evaluation of image classifiers belong to classical ML and are covered in the Synapse atlas. Here we care about how vision plugs into language models." },
              { t: "h", text: "Connecting vision to language" },
              { t: "table", headers: ["Approach", "How it works", "Good for", "Trade-off"], rows: [
                ["Contrastive dual encoder (CLIP-style, 2021)", "Separate image and text encoders trained so matching pairs land close in one embedding space", "Image search, zero-shot labels, conditioning image generators", "Embeds and compares; cannot hold a conversation about the image"],
                ["Vision encoder + projector into an LLM", "A pretrained image encoder's patch vectors are mapped into the LLM's token space and placed in the prompt", "Visual question answering, chart and screenshot reading", "Quality bounded by the encoder's resolution; image tokens cost context"],
                ["Natively multimodal", "One model trained from early on with interleaved text, image (and audio) tokens", "Fluid mixed-media reasoning and output", "Most expensive to train; least transparent"]
              ] },
              { t: "p", html: "CLIP-style embeddings connect directly to retrieval: put images and text in one space and the same vector search from <a class='inline' href='#/found/tokens/embeddings'>Embeddings</a> works across modalities." },
              { t: "h", text: "Audio: speech in, speech out" },
              { t: "p", html: "<strong>Speech-to-text</strong> models typically convert audio into a log-mel spectrogram (energy per frequency band over short time frames), encode it with a transformer, and decode text tokens; Whisper (2022) popularised this for robust multilingual transcription. <strong>Text-to-speech</strong> runs the other way: text to acoustic features or discrete audio tokens, then a vocoder or codec decoder turns them into a waveform. Neural audio codecs let a language model treat sound as just another token stream." },
              { t: "table", headers: ["Voice design", "Pipeline", "Strength", "Weakness"], rows: [
                ["Cascade", "Speech-to-text, then LLM, then text-to-speech", "Swap each part; easy to log and moderate the text", "Adds latency at each hop; loses tone and emotion"],
                ["Native speech-to-speech", "One model hears audio tokens and speaks audio tokens", "Low latency; keeps prosody; can be interrupted naturally", "Harder to inspect, log and constrain"]
              ] },
              { t: "note", variant: "warn", html: "<strong>New modalities, new failure modes.</strong> Models can misread small text in images while sounding certain, images count against your context and cost, and instructions hidden inside an image or audio clip are a prompt-injection route. Voice cloning needs explicit consent and disclosure." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cMultimodal means tokenising other signals: patches for images, spectrogram frames or codec tokens for audio. Then it is the same transformer, paying for those extra tokens in context and latency.\u201d" },
              { t: "note", variant: "key", html: "<strong>Every modality becomes a sequence of vectors.</strong> Patch embeddings, shared image-text spaces and audio tokens are three ways of getting there, each trading cost and inspectability for capability." }
            ]
          },
          {
            "id": "multimodal-build",
            "title": "Building with multimodal models: documents, screenshots and voice",
            "summary": "Practical patterns for PDFs and scans, UI screenshots and speech, with the costs and failure modes to plan for.",
            "minutes": 10,
            "tags": [
              "multimodal",
              "document-ai",
              "vision",
              "voice",
              "speech"
            ],
            "blocks": [
              {
                "t": "p",
                "html": "<a class='inline' href='#/next/multimodal/vision-audio'>Vision and audio models</a> explains how images and sound become tokens. This lesson covers how to build with them: which pipeline to pick for documents, screenshots and voice, and how to keep cost and errors under control."
              },
              {
                "t": "h",
                "text": "Documents: parse, or look?"
              },
              {
                "t": "table",
                "headers": [
                  "Approach",
                  "How it works",
                  "Wins when",
                  "Watch out for"
                ],
                "rows": [
                  [
                    "Text extraction + LLM",
                    "Pull the text layer (or OCR it), keep headings and tables, send text",
                    "Clean digital PDFs; large volumes; RAG indexing",
                    "Tables and multi-column layouts scrambled by naive extraction"
                  ],
                  [
                    "Vision model on page images",
                    "Render each page as an image and ask the model directly",
                    "Scans, forms, charts, handwriting, complex layouts",
                    "Image tokens per page add up; small text needs enough resolution"
                  ],
                  [
                    "Hybrid",
                    "Extract text for search; send the page image only for pages that matter",
                    "Production document assistants",
                    "Two pipelines to maintain"
                  ]
                ]
              },
              {
                "t": "code",
                "lang": "text",
                "code": "Invoice extraction, hybrid pipeline\n1. extract text layer           -> empty? treat as a scan\n2. vision model + JSON schema   -> {vendor, date, total, line_items[]}\n3. validate in code             -> sum(line_items) == total? date parses?\n4. low confidence or mismatch   -> human review queue"
              },
              {
                "t": "h",
                "text": "Screenshots and UIs"
              },
              {
                "t": "ul",
                "items": [
                  "<strong>Bug reports and support:</strong> 'what is wrong in this screenshot?' works well for visible errors and layout issues.",
                  "<strong>Design to code:</strong> models can draft markup from a mock-up; treat it as a starting point and review accessibility and semantics.",
                  "<strong>Computer-use agents</strong> look at the screen, decide on a click or keystroke, and repeat. They are slow, costly and easily confused by pop-ups, so sandbox them in a disposable environment with no real credentials, and require approval before submitting forms or payments."
                ]
              },
              {
                "t": "h",
                "text": "Voice"
              },
              {
                "t": "table",
                "headers": [
                  "Architecture",
                  "Pipeline",
                  "Strength",
                  "Weakness"
                ],
                "rows": [
                  [
                    "Cascaded",
                    "Speech-to-text → LLM → text-to-speech",
                    "Every stage swappable, inspectable and loggable as text",
                    "Latency adds up; tone and interruptions are lost"
                  ],
                  [
                    "Speech-to-speech",
                    "One model hears and speaks directly",
                    "Natural turn-taking, lower latency, keeps prosody",
                    "Harder to log, evaluate and guard; fewer model choices"
                  ]
                ]
              },
              {
                "t": "p",
                "html": "For voice, latency is the product. Stream every stage, start speaking from the first sentence, detect when the user interrupts (barge-in), and keep answers short. Log transcripts for evaluation, with consent and retention rules, because audio carries personal data."
              },
              {
                "t": "note",
                "variant": "warn",
                "html": "Images and audio carry prompt injection too: text hidden in an image, or instructions spoken in a recording, are read by the model like any other input. Apply the same untrusted-input rules as for web pages, and strip metadata such as location from uploaded photos before storing them."
              },
              {
                "t": "note",
                "variant": "tip",
                "html": "<strong>Say it out loud.</strong> 'For documents I extract text when it is clean and send page images when layout matters, validate the structured output in code and route doubtful cases to a human. For voice I choose cascaded when I need inspectable logs and speech-to-speech when latency and natural turn-taking matter most.'"
              },
              {
                "t": "note",
                "variant": "key",
                "html": "<strong>Pick the pipeline per input.</strong> Text where text is clean, vision where layout or handwriting matters, cascaded or native speech by your latency and logging needs — and always validate outputs and treat media as untrusted input."
              }
            ]
          },
          {
            id: "diffusion",
            title: "Diffusion in one lesson",
            summary: "Forward noise, a learned denoiser, guidance and latent diffusion.",
            minutes: 11,
            tags: ["multimodal", "diffusion", "image-generation", "guidance"],
            blocks: [
              { t: "p", html: "Language models write one token at a time. Most image generators work differently: they <strong>start from pure noise and remove a little of it, many times</strong>, until a picture is left. Training teaches a network to undo noise; generation is that undoing, repeated." },
              { t: "h", text: "Forward process: destroy the image on a schedule" },
              { t: "code", lang: "text", code:
                "x_t = sqrt(abar_t) * x_0  +  sqrt(1 - abar_t) * eps       eps ~ Normal(0, 1)\n\n" +
                "t = 0       abar = 1     clean image\n" +
                "t small     abar near 1  a little grain\n" +
                "t = T       abar near 0  pure noise\n\n" +
                "jump straight to any step t: no need to add noise step by step"
              },
              { t: "widget", id: "nextDiffusion" },
              { t: "h", text: "Reverse process: a learned denoiser" },
              { t: "p", html: "Training is simple to state: take a real image, pick a random step <em>t</em>, add the matching noise, and ask the network to <strong>predict the noise that was added</strong>, scoring it with mean squared error. The network sees the noisy image, the step number and, for text-to-image, an embedding of the caption. U-Nets were the classic backbone; diffusion transformers (DiT) apply patch tokens and attention instead." },
              { t: "p", html: "To generate, start from random noise at step <em>T</em>, predict the noise, remove part of it, and repeat down to step 0. Early samplers used hundreds or a thousand steps; modern samplers and distilled models typically need tens or even a handful, which is where most speed gains came from." },
              { t: "h", text: "Guidance: making the prompt count" },
              { t: "p", html: "<strong>Classifier-free guidance</strong> trains the same network sometimes with the caption and sometimes with it blanked. At sampling time it makes both predictions and pushes the result further in the prompt's direction. The scale <em>s</em> is a dial between diversity and literal prompt adherence." },
              { t: "code", lang: "text", code:
                "eps_guided = eps_uncond + s * (eps_cond - eps_uncond)\n\n" +
                "s = 1      plain conditional prediction\n" +
                "s moderate stronger prompt adherence, usually the sweet spot\n" +
                "s large    oversaturated, repetitive images\n" +
                "cost:      two predictions per step (or a batch of two)"
              },
              { t: "h", text: "Latent diffusion: work on a smaller picture" },
              { t: "p", html: "Denoising every pixel is expensive. <strong>Latent diffusion</strong> (the design behind Stable Diffusion, 2022) first trains an autoencoder that compresses an image into a much smaller latent grid; for example a 512 \u00d7 512 \u00d7 3 image becomes a 64 \u00d7 64 \u00d7 4 latent, about 48 times fewer values. Diffusion runs in that latent space, and a decoder turns the final latent back into pixels." },
              { t: "table", headers: ["", "Autoregressive LLM", "Diffusion image model"], rows: [
                ["Generates", "One token at a time, left to right", "The whole image at once, refined over many steps"],
                ["Main cost knob", "Number of output tokens", "Number of denoising steps and resolution"],
                ["Conditioning", "Prompt in the context", "Text embedding injected via cross-attention, plus guidance"],
                ["Editing", "Rewrite text", "Partially noise an existing image and denoise it (img2img, inpainting)"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Generation brings provenance questions.</strong> Plan for content credentials or watermarking, filters for disallowed content, and clear rules about using people's likeness and copyrighted styles. These are product requirements, not afterthoughts." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cDiffusion trains a network to predict added noise; generation starts from noise and denoises step by step. Guidance trades diversity for prompt adherence, and latent diffusion makes it affordable by working in a compressed space.\u201d" },
              { t: "quiz", id: "next-multimodal" },
              { t: "note", variant: "key", html: "<strong>Learn to remove noise, then remove it from nothing.</strong> The forward process is fixed, the denoiser is learned, guidance steers it toward the prompt and latents make it cheap." }
            ]
          }
        ]
      },
      {
        id: "frontier",
        name: "The Frontier",
        icon: "trend",
        lessons: [
          {
            id: "small-models",
            title: "Small language models and on-device AI",
            summary: "Distillation, quantisation and NPUs, and what on-device really buys you.",
            minutes: 10,
            tags: ["small-models", "on-device", "distillation", "quantization", "npu"],
            blocks: [
              { t: "p", html: "The mental model: <strong>a small model is a budget decision</strong>. You give up some general capability to gain speed, cost, offline operation and control over where data goes. For a narrow, well-defined task, a small model that has been tuned well often matches a big general one." },
              { t: "stat", items: [
                { v: "2 bytes", k: "per parameter at FP16" },
                { v: "~0.5 bytes", k: "per parameter at 4-bit" },
                { v: "~4 GB", k: "a 7B model at 4-bit, roughly" }
              ] },
              { t: "h", text: "How small models get good" },
              { t: "table", headers: ["Technique", "What it does", "What it costs"], rows: [
                ["Distillation", "A small student learns to imitate a larger teacher's outputs or probability distributions", "Needs teacher compute and careful data; student inherits teacher mistakes"],
                ["Better data", "Train on heavily filtered, synthetic or curated text rather than more raw web", "Curation effort; risk of narrow skills"],
                ["Quantisation", "Store weights in 8 or 4 bits instead of 16", "Some quality loss, larger at very low bit-widths"],
                ["Pruning and sparsity", "Remove or skip weights that contribute little", "Speedups depend on hardware support"],
                ["Task fine-tuning", "LoRA or full fine-tune on your exact task", "Loses some generality; must be re-evaluated per release"]
              ] },
              { t: "code", lang: "text", code:
                "memory for weights  ~= parameters * bytes_per_parameter\n\n" +
                "3B  @ 4-bit  ->  3e9 * 0.56  ~= 1.7 GB    phone territory\n" +
                "7B  @ 4-bit  ->  7e9 * 0.56  ~= 3.9 GB    laptop territory\n" +
                "7B  @ FP16   ->  7e9 * 2     ~= 14 GB     a big GPU\n\n" +
                "add headroom for the KV cache (grows with context length) and the runtime"
              },
              { t: "widget", id: "nextOnDevice" },
              { t: "h", text: "NPUs and the on-device stack" },
              { t: "p", html: "Modern phones and laptops include a <strong>neural processing unit</strong>: an accelerator for low-precision matrix maths that runs inference at a fraction of the power of the CPU or GPU. Token generation is usually limited by <strong>memory bandwidth</strong> (every weight is read for every token), so smaller weights mean faster decoding as well as fitting at all. Runtimes such as llama.cpp, MLX and platform ML frameworks handle conversion and scheduling across CPU, GPU and NPU." },
              { t: "table", headers: ["Tier", "On-device plan", "Why"], rows: [
                ["Naive", "Ship the biggest model that technically loads", "Leaves no memory for the app, drains battery, slow first token"],
                ["Solid", "Pick the smallest model that passes your eval, quantise it, measure speed and battery on real devices", "Evidence-based and sized to the hardware"],
                ["Standout", "Small on-device model for common requests, explicit and disclosed fallback to a larger hosted model for hard ones, with the same eval set gating both", "Gets latency, cost and privacy wins without hiding the trade-off"]
              ] },
              { t: "note", variant: "warn", html: "<strong>On-device is not automatically private.</strong> If the app logs prompts, sends analytics or quietly falls back to a server for some requests, the data still leaves the device. Privacy is a property of the whole data flow; document it." },
              { t: "note", variant: "tip", html: "The mechanics are covered in depth elsewhere in this atlas: <a class='inline' href='#/train/finetune/distillation'>Distillation and small models</a>, <a class='inline' href='#/local/why/quantization'>Quantization formats</a> and <a class='inline' href='#/local/why/hardware'>Hardware: VRAM and unified memory</a>. Try the local sizing calculator in the <a class='inline' href='#/playground'>LLM playground</a>." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cParameters times bytes per parameter, plus KV cache headroom, against the memory the device can spare. Distil and quantise to fit; then prove quality with my eval set, not the model card.\u201d" },
              { t: "note", variant: "key", html: "<strong>Small models win on budget, not on bragging rights.</strong> Distillation and quantisation make them fit; NPUs make them efficient; your own evals decide whether they are good enough." }
            ]
          },
          {
            id: "whats-next",
            title: "What's next, and how to keep up",
            summary: "Durable directions to watch and a habit for separating signal from hype.",
            minutes: 9,
            tags: ["frontier", "trends", "evaluation", "learning"],
            blocks: [
              { t: "p", html: "Model names and rankings expire in months; <strong>mechanisms and trade-offs last for years</strong>. The useful skill is not knowing today's best model but being able to judge tomorrow's announcement quickly, using the concepts from this atlas." },
              { t: "h", text: "Directions worth watching" },
              { t: "table", headers: ["Direction", "What it means", "What to verify before you rely on it"], rows: [
                ["Reasoning and test-time compute", "Models spend more inference tokens thinking on hard problems", "Gain on your tasks versus extra latency and cost"],
                ["Longer context and memory", "More input per request; persistent memory across sessions", "Whether the model actually uses information deep in the context; see <a class='inline' href='#/rag/context/long-context-vs-rag'>Long context vs RAG</a>"],
                ["Agents and tool use", "Models that plan, call tools and act over many steps", "Task success rate end to end, failure recovery, permission boundaries"],
                ["Real-time multimodal", "Voice, vision and video in and out with low latency", "Latency under load, and how outputs are logged and moderated"],
                ["Smaller, efficient models", "More capability per parameter; on-device deployment", "Quality on your eval set at the target precision"],
                ["Evaluation and safety", "Better evals, interpretability, guardrails", "That the eval measures your risk, not a generic one"]
              ] },
              { t: "h", text: "How to keep up without drowning" },
              { t: "ol", items: [
                "<strong>Keep a personal eval set.</strong> Twenty to fifty real examples from your work, with expected answers. Every new model gets run against it before you form an opinion.",
                "<strong>Read for mechanism.</strong> In any announcement or paper, find what actually changed: data, architecture, training objective, inference budget or tooling. Ignore adjectives.",
                "<strong>Follow the tools you use.</strong> Release notes of your runtime, SDK or framework tell you what is usable today, which beats headlines about what is possible.",
                "<strong>Rebuild something small every quarter.</strong> A tiny RAG app or agent rebuilt with current tools shows you what got easier, and what did not.",
                "<strong>Separate capability from product.</strong> A demo shows a ceiling; your eval measures the floor."
              ] },
              { t: "compare",
                bad: { title: "Hype-driven", items: ["Switches models after every launch thread", "Quotes leaderboard positions", "Treats a demo video as evidence", "Rewrites the stack for each new framework"] },
                good: { title: "Evidence-driven", items: ["Runs the eval set and compares cost and latency", "Asks what mechanism changed", "Tries it on a real task before an opinion", "Keeps a thin abstraction so swapping models is cheap"] } },
              { t: "code", lang: "python", code:
                "# A minimal personal eval: same cases, any model, comparable results.\n" +
                "import json, time\n\n" +
                "def run_eval(call_model, model_name, cases_path='my_eval_cases.jsonl'):\n" +
                "    passed, latencies = 0, []\n" +
                "    with open(cases_path) as f:\n" +
                "        cases = [json.loads(line) for line in f]\n" +
                "    for case in cases:\n" +
                "        start = time.time()\n" +
                "        answer = call_model(model_name, case['prompt'])   # your client; keys come from env vars\n" +
                "        latencies.append(time.time() - start)\n" +
                "        if case['expected'].lower() in answer.lower():      # swap in a stricter check per task\n" +
                "            passed += 1\n" +
                "    latencies.sort()\n" +
                "    return {'model': model_name, 'pass_rate': passed / len(cases),\n" +
                "            'p50_latency_s': latencies[len(latencies) // 2]}"
              },
              { t: "note", variant: "tip", html: "Building and maintaining that eval set properly is the subject of <a class='inline' href='#/ops/evals/evals'>Evals: golden sets and regression testing</a>, and the capstone puts it to work from <a class='inline' href='#/cap/build/plan'>Plan the assistant</a> onward." },
              { t: "note", variant: "trap", html: "<strong>\u201cModel X is the best\u201d is a dated claim the moment it is said.</strong> Write and repeat comparative statements only with the date, the task and the eval behind them." },
              { t: "cue", html: "<strong>Say it out loud:</strong> \u201cI don't chase launches. I ask what mechanism changed, run my own eval set, and compare quality, cost and latency. If it wins on my tasks, swapping is cheap because I kept the model behind an interface.\u201d" },
              { t: "quiz", id: "next-frontier" },
              { t: "note", variant: "key", html: "<strong>Bet on mechanisms, measure with your own evals.</strong> The field will keep moving; a personal eval set and a habit of asking what actually changed keep you current without the hype." }
            ]
          }
        ]
      }
    ]
  };
})();
