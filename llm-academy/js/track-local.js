/* =====================================================================
   LUMEN · Local LLMs
   window.TRACKS.local — modules: why / runtimes

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

  function selectBox(pairs, initialIdx, onPick) {
    var sel = h("select", { class: "sim-select" });
    for (var i = 0; i < pairs.length; i++) {
      var o = h("option", { value: String(i) }, pairs[i][1]);
      if (i === initialIdx) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () {
      var idx = parseInt(sel.value, 10);
      if (!isNaN(idx) && pairs[idx]) onPick(pairs[idx][0]);
    });
    return sel;
  }

  function field(label, control) {
    return h("label", { class: "w-field" }, h("span", {}, label), control);
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function fmt(x, d) {
    if (typeof x !== "number" || !isFinite(x)) return "?";
    var p = Math.pow(10, d == null ? 1 : d);
    return String(Math.round(x * p) / p);
  }

  /* shared sizing data: params (billions), label, KV cache KiB per token
     (grouped-query attention, FP16 cache — older models can be far larger) */
  var MODELS = [
    [1, "1B", 32], [3, "3B", 112], [7, "7B", 128], [8, "8B", 128],
    [14, "13–14B", 192], [32, "32B", 256], [70, "70B", 320]
  ];
  var QUANTS = [
    ["fp16", "FP16", 2.0], ["q8", "Q8_0", 1.06], ["q5", "Q5_K_M", 0.71], ["q4", "Q4_K_M", 0.6]
  ];
  function findBy(list, key) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i];
    return list[0];
  }

  var Widgets = {};

  /* ==================================================================
     1. localFit — "Will this model fit on my machine?"
        total = weights x 1.10 (runtime overhead) + KV cache
  ================================================================== */
  Widgets.localFit = function (mount) {
    shell(mount, "calculator", "Will it fit?",
      "Pick a model size, a quantization, a context length and your machine. The estimate adds weights, roughly 10% runtime overhead and the KV cache, then compares the total with memory the model can actually use. Figures are decimal GB and deliberately rough.");
    var st = { params: 8, quant: "q4", ctx: 8192, kind: "mac", ram: 16 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch;gap:8px" });

    var modelPairs = MODELS.map(function (m) { return [m[0], m[1] + " parameters"]; });
    var quantPairs = QUANTS.map(function (q) { return [q[0], q[1]]; });
    var ctxPairs = [[4096, "4k tokens"], [8192, "8k tokens"], [32768, "32k tokens"], [131072, "128k tokens"]];
    var kindPairs = [["gpu", "GPU VRAM"], ["mac", "Mac unified memory"], ["cpu", "CPU RAM only"]];
    var ramPairs = [[8, "8 GB"], [12, "12 GB"], [16, "16 GB"], [24, "24 GB"], [32, "32 GB"], [48, "48 GB"], [64, "64 GB"], [96, "96 GB"], [128, "128 GB"], [192, "192 GB"]];

    controls.appendChild(field("Model", selectBox(modelPairs, 3, function (v) { st.params = v; paint(); })));
    controls.appendChild(segment(quantPairs, 3, function (v) { st.quant = v; paint(); }));
    controls.appendChild(field("Context", selectBox(ctxPairs, 1, function (v) { st.ctx = v; paint(); })));
    controls.appendChild(segment(kindPairs, 1, function (v) { st.kind = v; paint(); }));
    controls.appendChild(field("Memory", selectBox(ramPairs, 2, function (v) { st.ram = v; paint(); })));

    function usable() {
      if (st.kind === "gpu") return Math.max(0, st.ram - 0.5);
      if (st.kind === "mac") return st.ram * (st.ram <= 36 ? 0.67 : 0.75);
      return Math.max(0, st.ram - 4);
    }

    function paint() {
      var model = null;
      for (var i = 0; i < MODELS.length; i++) if (MODELS[i][0] === st.params) model = MODELS[i];
      if (!model) model = MODELS[3];
      var q = findBy(QUANTS, st.quant);
      var weights = model[0] * q[2];
      var overhead = weights * 0.10;
      var kv = st.ctx * model[2] * 1024 / 1e9;
      var total = weights + overhead + kv;
      var use = usable();
      var ratio = use > 0 ? total / use : 99;
      var verdict, hue;
      if (ratio <= 0.85) { verdict = "fits"; hue = "var(--lime)"; }
      else if (ratio <= 1.0) { verdict = "tight: close other apps or shorten context"; hue = "var(--amber)"; }
      else { verdict = "no: smaller quant, smaller model or less context"; hue = "var(--rose)"; }

      clear(stage);
      var scale = Math.max(total, use, 1);
      function seg(gb, color, label) {
        return h("i", { title: label, style: "display:block;height:100%;width:" + Math.max(0, Math.min(100, gb / scale * 100)) + "%;background:" + color });
      }
      stage.appendChild(h("div", { style: "font-size:0.82rem;margin-bottom:6px;color:var(--text-dim)" },
        "weights (cyan) + overhead (violet) + KV cache (amber) vs usable memory (marker)"));
      var bar = h("div", { style: "position:relative;display:flex;height:16px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
        seg(weights, "var(--cyan)", "weights"), seg(overhead, "var(--violet)", "overhead"), seg(kv, "var(--amber)", "KV cache"));
      bar.appendChild(h("span", { style: "position:absolute;top:0;bottom:0;width:3px;background:" + hue + ";left:calc(" + Math.min(100, use / scale * 100) + "% - 3px)" }));
      stage.appendChild(bar);
      stage.appendChild(h("div", { style: "margin-top:8px;font-family:var(--font-mono);font-size:0.82rem" },
        model[1] + " × " + q[2] + " bytes/param (" + q[1] + ") = " + fmt(weights) + " GB of weights"));

      clear(readout);
      readout.appendChild(ro("weights", fmt(weights) + " GB"));
      readout.appendChild(ro("overhead ~10%", fmt(overhead) + " GB"));
      readout.appendChild(ro("KV cache", fmt(kv, 2) + " GB"));
      readout.appendChild(ro("total", fmt(total) + " GB"));
      readout.appendChild(ro("usable", fmt(use) + " GB"));
      readout.appendChild(ro("verdict", verdict));
      if (st.kind === "cpu") readout.appendChild(ro("note", "CPU-only runs, but slowly"));
      if (st.kind === "mac") readout.appendChild(ro("note", "macOS caps GPU-usable memory by default"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. localTps — "Roughly how fast will it generate?"
        decode is memory-bound: every token reads ~all the weights
  ================================================================== */
  var BANDWIDTH = [
    [80, "Laptop, dual-channel DDR5 (~80 GB/s)"],
    [120, "Apple entry tier (~120 GB/s)"],
    [250, "Apple Pro tier (~250 GB/s)"],
    [450, "Apple Max tier (~450 GB/s)"],
    [800, "Apple Ultra tier (~800 GB/s)"],
    [1000, "High-end consumer GPU (~1,000 GB/s)"],
    [3000, "Datacenter GPU with HBM (~3,000 GB/s)"]
  ];

  Widgets.localTps = function (mount) {
    shell(mount, "estimator", "Rough tokens per second",
      "Generating one token means streaming roughly every weight through the processor once, so decode speed is capped by memory bandwidth divided by model size. This is a rough ceiling for a single user; prompt processing is compute-bound and behaves differently.");
    var st = { bw: 450, params: 8, quant: "q4" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls", style: "flex-direction:column;align-items:stretch;gap:8px" });

    controls.appendChild(field("Machine", selectBox(BANDWIDTH, 3, function (v) { st.bw = v; paint(); })));
    controls.appendChild(field("Model", selectBox(MODELS.map(function (m) { return [m[0], m[1] + " parameters"]; }), 3, function (v) { st.params = v; paint(); })));
    controls.appendChild(segment(QUANTS.map(function (q) { return [q[0], q[1]]; }), 3, function (v) { st.quant = v; paint(); }));

    function paint() {
      var q = findBy(QUANTS, st.quant);
      var gb = st.params * q[2];
      var ceiling = gb > 0 ? st.bw / gb : 0;
      var lo = ceiling * 0.5, hi = ceiling * 0.75;
      var feel = hi >= 30 ? "faster than you read" : hi >= 10 ? "comfortable to read along" : hi >= 4 ? "usable but sluggish" : "painful for chat";

      clear(stage);
      stage.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.85rem;line-height:1.7" },
        h("div", {}, "model bytes per token ≈ " + fmt(gb) + " GB"),
        h("div", {}, "ceiling ≈ " + st.bw + " GB/s ÷ " + fmt(gb) + " GB ≈ " + fmt(ceiling, 0) + " tokens/s"),
        h("div", { style: "color:var(--text-dim)" }, "real runs usually land at ~50–75% of the ceiling")));
      var pct = Math.max(2, Math.min(100, hi / 120 * 100));
      stage.appendChild(h("div", { style: "margin-top:8px;height:12px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
        h("i", { style: "display:block;height:100%;width:" + pct + "%;background:" + (hi >= 10 ? "var(--lime)" : hi >= 4 ? "var(--amber)" : "var(--rose)") })));

      clear(readout);
      readout.appendChild(ro("weights", fmt(gb) + " GB"));
      readout.appendChild(ro("ceiling", fmt(ceiling, 0) + " tok/s"));
      readout.appendChild(ro("rough real range", fmt(lo, 0) + "–" + fmt(hi, 0) + " tok/s"));
      readout.appendChild(ro("feel", feel));
    }

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
    "local-why": {
      title: "Why local and what fits checkpoint",
      sub: "Motivations, memory arithmetic, bandwidth and quantization formats.",
      questions: [
        {
          q: "Roughly how much memory do the weights of an 8B-parameter model take at Q4_K_M (about 0.6 bytes per parameter)?",
          options: ["About 16 GB", "About 8.5 GB", "About 4.8 GB", "About 1 GB"],
          answer: 2,
          explain: "Weights memory is parameters times bytes per parameter: 8 billion × 0.6 ≈ 4.8 GB. 16 GB is the FP16 figure and 8.5 GB is roughly Q8. You still need to add the KV cache and runtime overhead on top before deciding whether it fits."
        },
        {
          q: "Why does single-user generation speed track memory bandwidth more than raw compute?",
          options: [
            "Each new token requires reading roughly all of the model's weights from memory, so bytes moved per second sets the ceiling",
            "Bandwidth determines how large the vocabulary can be",
            "The tokenizer runs on the memory controller",
            "Bandwidth sets the maximum context window"
          ],
          answer: 0,
          explain: "During decode the processor does relatively little arithmetic per weight but must stream every weight once per token. That makes it memory-bound, so tokens per second is roughly bandwidth divided by model size. Prompt processing is the opposite case: many tokens share each weight read, so it leans on compute."
        },
        {
          q: "Which situation is the strongest case for running a model locally?",
          options: [
            "You need the best possible quality on hard, open-ended reasoning",
            "Data must not leave the device and the task is narrow, repetitive and high-volume",
            "You make a handful of requests per week",
            "You want to avoid owning any infrastructure or upgrades"
          ],
          answer: 1,
          explain: "Local shines when privacy rules forbid sending data out and the workload is narrow enough that a smaller open-weight model does it well, at volumes where per-token fees add up. Frontier hosted models still win on hard reasoning, low volumes make the hardware hard to justify, and local means you own the operations."
        },
        {
          q: "What is GGUF?",
          options: [
            "A GPU-only quantization algorithm used by high-throughput servers",
            "A tokenizer format shared by all open models",
            "An evaluation benchmark for quantized models",
            "A single-file model format used by llama.cpp-family runtimes that bundles quantized weights with metadata"
          ],
          answer: 3,
          explain: "GGUF packs weights, tokenizer and model metadata into one file that llama.cpp, Ollama and LM Studio can load directly. The quantization type, such as Q4_K_M or Q8_0, is chosen per file. AWQ and GPTQ are separate GPU-oriented quantization methods usually served by other runtimes."
        },
        {
          q: "What does unified memory on Apple Silicon change for local models?",
          options: [
            "The GPU can no longer access system RAM",
            "It doubles the effective capacity of RAM through compression",
            "CPU and GPU share one pool, so a large-RAM Mac can hold models that do not fit a 24 GB discrete GPU, usually at lower bandwidth than a high-end GPU",
            "It removes the need for quantization"
          ],
          answer: 2,
          explain: "Because the GPU addresses the same memory as the CPU, a 64 GB or 128 GB Mac can load models far larger than a typical consumer GPU's VRAM. The trade-off is bandwidth: most Macs move fewer bytes per second than a top consumer GPU, so tokens per second is often lower. macOS also reserves part of RAM for the system by default."
        }
      ]
    },
    "local-runtimes": {
      title: "Runtimes and setup checkpoint",
      sub: "Choosing a runtime, Ollama basics, OpenAI-compatible endpoints and local RAG.",
      questions: [
        {
          q: "You must serve an open-weight model to about 50 concurrent internal users from one GPU server. Which runtime fits best?",
          options: [
            "Ollama on a developer laptop",
            "LM Studio's desktop app",
            "vLLM, for continuous batching and paged KV-cache management",
            "MLX on a Mac mini"
          ],
          answer: 2,
          explain: "vLLM is built for throughput: it batches many requests continuously and manages KV-cache memory in pages so concurrent sequences do not waste VRAM. Ollama and LM Studio are excellent single-user tools, and MLX targets Apple Silicon. Matching the runtime to concurrency is the key decision."
        },
        {
          q: "On which port does Ollama's local REST API listen by default?",
          options: ["8080", "11434", "5000", "8000"],
          answer: 1,
          explain: "Ollama serves on port 11434 and binds to the loopback interface by default. Port 8000 is a common default for vLLM's server and 8080 for llama.cpp's server, which is why checking the port is a quick way to tell runtimes apart."
        },
        {
          q: "In an Ollama Modelfile, what does the SYSTEM instruction do?",
          options: [
            "Bakes a default system prompt into the derived model you create",
            "Selects which GPU the model runs on",
            "Sets the base weights to download",
            "Changes the port the server listens on"
          ],
          answer: 0,
          explain: "FROM names the base model, PARAMETER sets defaults such as temperature or context length, and SYSTEM stores a default system prompt. Running ollama create builds a named model that carries these defaults, so every caller gets the same behaviour without repeating the prompt."
        },
        {
          q: "How do you point the official OpenAI Python client at a local Ollama server?",
          options: [
            "You cannot; the client only talks to the vendor's cloud",
            "Supply a real OpenAI key so the request is authorised",
            "Convert the model to ONNX first",
            "Set base_url to the server's /v1 path; the client insists on an api_key, but Ollama ignores the placeholder value"
          ],
          answer: 3,
          explain: "Ollama exposes an OpenAI-compatible API under /v1, so changing base_url is enough for most chat and embedding calls. The client library requires some api_key string, but the local server does not check it. Keeping the URL in an environment variable lets the same code switch between local and hosted models."
        },
        {
          q: "In a fully local RAG setup, what must be true of the embedding model?",
          options: [
            "It must be the same model as the chat model",
            "It must be larger than the chat model",
            "The same embedding model (and version) must be used at indexing time and query time",
            "It must run in the cloud even if generation is local"
          ],
          answer: 2,
          explain: "Vectors from different embedding models live in different spaces, so query vectors only make sense against documents embedded by the same model. A small dedicated embedding model is normal and runs comfortably locally. If you change it, re-embed the corpus."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.local = {
    id: "local",
    name: "Local LLMs",
    short: "LOCAL",
    tagline: "Your model, your machine",
    color: "#2dd4bf",
    blurb: "Run open-weight models on your own hardware. Decide when local beats an API, size a model against VRAM or unified memory, pick a quantization, choose between Ollama, llama.cpp, LM Studio, vLLM and MLX, then set up Ollama step by step and wire it into code, an IDE and a local RAG pipeline.",
    modules: [
      {
        id: "why",
        name: "Why & What Fits",
        icon: "cube",
        lessons: [
          {
            id: "why-local",
            title: "Why run a model locally",
            summary: "Privacy, cost at volume, offline use, latency and control — and the quality gap, ops burden and hardware you pay for them.",
            minutes: 8,
            tags: ["local", "privacy", "cost", "trade-offs"],
            blocks: [
              { t: "p", html: "Hold this picture: a hosted API rents you a very large model by the token; a local model is one you <strong>own and run</strong>, usually smaller, on hardware you control. Neither is better in general. The question is which constraints dominate your workload." },
              { t: "h", text: "Five reasons teams go local" },
              { t: "table", headers: ["Reason", "What it buys you", "When it really matters"], rows: [
                ["Privacy and data residency", "Prompts and documents never leave the machine or network", "Regulated data, client code under NDA, air-gapped sites"],
                ["Cost at volume", "No per-token fee; marginal cost is power and hardware wear", "Millions of short, repetitive calls such as classification or extraction"],
                ["Offline operation", "Works on a plane, in a lab, at the edge", "Field devices, travel, unreliable networks"],
                ["Latency", "No network round trip; time to first token can be tiny", "Autocomplete, interactive tools, on-device features"],
                ["Control", "Pinned weights, no silent model updates, full sampling control, fine-tuning", "Reproducible pipelines, research, custom adapters"]
              ] },
              { t: "h", text: "What it costs you" },
              { t: "compare",
                bad: { title: "What you give up", items: ["A quality gap on hard reasoning versus frontier hosted models", "Operations: updates, drivers, monitoring and capacity are now yours", "Hardware: capital cost, and memory caps the model size you can run", "Throughput: one laptop serves roughly one user well"] },
                good: { title: "What you keep", items: ["Data stays put, which simplifies many compliance reviews", "Predictable cost for steady, high-volume narrow tasks", "Behaviour that only changes when you change it", "Freedom to quantize, fine-tune and inspect"] } },
              { t: "p", html: "The quality gap is the trade-off people underestimate. A small open-weight model can be excellent at a narrow task you have evaluated, and disappointing at open-ended reasoning. Decide with your own eval set, not with intuition — the <a class='inline' href='#/ops/evals/evals'>evals lesson</a> shows how." },
              { t: "h", text: "A quick decision ladder" },
              { t: "table", headers: ["Tier", "Approach", "Why"], rows: [
                ["Naive", "Run everything locally because it is free", "Ignores hardware, ops time and the quality gap on hard tasks"],
                ["Solid", "Use local for private or high-volume narrow tasks, hosted for the rest", "Each workload goes where its dominant constraint is met"],
                ["Standout", "Route per request behind one OpenAI-compatible interface, with evals deciding which tasks local handles", "Swapping is a config change, and the split is backed by measurement"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Local is not automatically private.</strong> If an IDE plugin or agent still sends context to a hosted service for some features, or you expose the local server on your network without authentication, the privacy argument evaporates." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \"Data cannot leave the building\", \"air-gapped\", \"millions of classification calls a day\", \"we need the model pinned for reproducibility\", \"works offline\" — each is a signal to put local on the table." },
              { t: "p", html: "Small models designed for laptops and phones are covered in <a class='inline' href='#/next/frontier/small-models'>small language models and on-device AI</a>; the open-weight releases that made this possible are in <a class='inline' href='#/hist/modern/open-weights'>the open-weight wave</a>." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \"I would go local where privacy or per-token cost dominates and the task is narrow enough that an evaluated open-weight model meets the bar; everything else goes to a hosted model behind the same interface.\"" },
              { t: "note", variant: "key", html: "<strong>Local trades quality headroom and ops effort for privacy, control and cheap volume.</strong> Choose it per workload, prove it with evals, and keep the interface identical so you can move either way." }
            ]
          },
          {
            id: "hardware",
            title: "Hardware: VRAM, unified memory and Apple Silicon",
            summary: "Size a model in GB from parameters and bytes per parameter, add the KV cache and overhead, and understand why bandwidth sets your tokens per second.",
            minutes: 11,
            tags: ["vram", "unified-memory", "apple-silicon", "sizing", "bandwidth"],
            blocks: [
              { t: "p", html: "The mental model is two numbers. <strong>Capacity</strong> decides whether a model loads at all. <strong>Bandwidth</strong> decides how fast it talks once loaded. Everything else is detail." },
              { t: "h", text: "Capacity: the memory formula" },
              { t: "code", lang: "text", code:
                "weights_GB   ≈ params_in_billions × bytes_per_param\n" +
                "                FP16 = 2.0   Q8_0 ≈ 1.06   Q5_K_M ≈ 0.71   Q4_K_M ≈ 0.6\n" +
                "kv_cache_GB  ≈ context_tokens × kv_bytes_per_token\n" +
                "                (an 8B model with grouped-query attention ≈ 128 KiB/token at FP16)\n" +
                "overhead     ≈ 10–20% of weights (runtime buffers, activations, scratch)\n" +
                "total        ≈ weights + overhead + kv_cache\n\n" +
                "example: 8B at Q4_K_M with 8k context\n" +
                "  weights  8 × 0.6           = 4.8 GB\n" +
                "  overhead 10%               ≈ 0.5 GB\n" +
                "  kv       8192 × 128 KiB    ≈ 1.1 GB\n" +
                "  total                      ≈ 6.4 GB"
              },
              { t: "p", html: "The KV cache is the part people forget. It grows linearly with context length and with concurrent users, so a model that fits at 4k tokens may not fit at 128k. The mechanism is explained in <a class='inline' href='#/core/generation/context-kv'>context windows and the KV cache</a>." },
              { t: "h", text: "VRAM versus unified memory" },
              { t: "table", headers: ["Memory type", "Usable for the model", "Bandwidth (rough)", "Typical trade-off"], rows: [
                ["Discrete GPU VRAM", "Nearly all of it, minus a little for the display and driver", "Very high on high-end cards, on the order of 1,000 GB/s", "Fast, but capacity is capped at the card's VRAM"],
                ["Apple Silicon unified memory", "Roughly two-thirds to three-quarters of RAM by default", "~100 to ~800 GB/s depending on chip tier", "Large capacity in one box, usually slower than a top GPU"],
                ["CPU system RAM", "Most of RAM minus the OS and apps", "Tens of GB/s on typical desktops and laptops", "Runs anything that fits, but slowly"]
              ] },
              { t: "note", variant: "tip", html: "On a Mac the CPU and GPU share one pool, so a 64 GB or 128 GB machine can load models that no single consumer GPU can. macOS reserves part of that memory for the system by default; an advanced setting can raise the cap, at the cost of leaving less for everything else." },
              { t: "h", text: "Worked examples (8k context, Q4_K_M unless noted)" },
              { t: "table", headers: ["Model", "Weights", "Total estimate", "Comfortable on", "Tight or no"], rows: [
                ["8B (similar for 7B)", "~4.8 GB", "~6.4 GB", "16 GB Mac, 12 GB+ GPU", "8 GB GPU is right at the edge"],
                ["8B at FP16", "~16 GB", "~18.7 GB", "24 GB GPU, 48 GB+ Mac", "32 GB Mac tight; 16 GB anything no"],
                ["13B–14B", "~8.4 GB", "~10.9 GB", "16 GB GPU, 24 GB+ Mac", "12 GB GPU tight; 16 GB Mac no"],
                ["32B", "~19.2 GB", "~23.3 GB", "48 GB+ Mac", "24 GB GPU tight; 32 GB Mac no"],
                ["70B", "~42 GB", "~49 GB", "96 GB+ Mac, or two 32 GB+ GPUs", "64 GB Mac only with a raised GPU cap or a smaller quant"]
              ] },
              { t: "widget", id: "localFit" },
              { t: "p", html: "The same calculator lives in the <a class='inline' href='#/playground'>LLM playground</a> as the local sizing pane, if you want it beside a terminal." },
              { t: "h", text: "Bandwidth: why speed is bytes per second" },
              { t: "p", html: "To emit one token, the runtime reads essentially every weight once. So the ceiling is <code class='tok'>bandwidth ÷ model size</code>: a 4.8 GB model on a ~450 GB/s machine tops out near 90 tokens per second, and real runs land somewhat below that. Halving the model's bytes through quantization roughly doubles speed, which is why quantization helps speed as well as fit." },
              { t: "note", variant: "warn", html: "If the model does not fully fit in GPU memory, runtimes can offload some layers to the CPU. It works, but every token then waits on the slow path, and speed can drop several-fold. Treat partial offload as a fallback, not a plan." },
              { t: "note", variant: "tip", html: "<strong>Interview cue.</strong> \"Capacity is params times bytes per param plus KV cache plus about 10–20%; speed is roughly bandwidth divided by model bytes. So for a 70B model I am choosing between a big unified-memory machine and multiple GPUs, and quantizing to fit.\"" },
              { t: "note", variant: "key", html: "<strong>Params × bytes per param, plus KV cache, plus overhead — then divide bandwidth by model bytes.</strong> Those two lines of arithmetic answer \"will it fit\" and \"will it be fast enough\" before you download anything." }
            ]
          },
          {
            id: "quantization",
            title: "Quantization: GGUF, Q4/Q8, AWQ and GPTQ",
            summary: "Store weights in fewer bits to shrink memory and speed up decode, and know which format each runtime expects.",
            minutes: 10,
            tags: ["quantization", "gguf", "awq", "gptq", "k-quants"],
            blocks: [
              { t: "p", html: "Quantization is lossy compression for weights. Instead of 16 bits per parameter you store 8, 5 or 4, plus a small scale factor per block of weights so values can be reconstructed approximately at run time. You trade a little accuracy for a lot of memory and speed." },
              { t: "h", text: "How it works, in one paragraph" },
              { t: "p", html: "Weights are grouped into small blocks. For each block the quantizer stores a scale (and sometimes an offset) and maps every weight to a small integer. At inference the runtime multiplies back by the scale. <strong>K-quants</strong> such as <code class='tok'>Q4_K_M</code> use a two-level block structure and spend extra bits on the layers that are most sensitive, which is why they keep more quality than a naive 4-bit scheme at similar size." },
              { t: "h", text: "Formats and where they run" },
              { t: "table", headers: ["Format", "Typical runtime", "Hardware", "Notes"], rows: [
                ["GGUF (Q8_0, Q6_K, Q5_K_M, Q4_K_M, ...)", "llama.cpp, Ollama, LM Studio", "CPU, Apple Silicon, consumer GPUs", "One file with weights, tokenizer and metadata; the quant type is in the filename"],
                ["AWQ", "vLLM and other GPU servers", "NVIDIA-class GPUs", "Activation-aware: protects the weights that matter most for typical activations"],
                ["GPTQ", "vLLM and other GPU servers", "NVIDIA-class GPUs", "Quantizes layer by layer while compensating for the error introduced"],
                ["MLX quantized weights", "MLX / mlx-lm", "Apple Silicon", "Native format for Apple's array framework"],
                ["FP16 / BF16", "Everything", "Anything with enough memory", "The unquantized reference; best quality, biggest size"]
              ] },
              { t: "h", text: "Quality versus size" },
              { t: "table", headers: ["Quant", "Bytes per param (rough)", "8B weights", "Quality, in practice"], rows: [
                ["FP16", "2.0", "~16 GB", "Reference"],
                ["Q8_0", "~1.06", "~8.5 GB", "Usually indistinguishable from FP16"],
                ["Q5_K_M", "~0.71", "~5.7 GB", "Small loss; a good choice when it fits"],
                ["Q4_K_M", "~0.6", "~4.8 GB", "The popular default; mild loss, most noticeable on maths and code"],
                ["Q3 and below", "under ~0.5", "under ~4 GB", "Noticeable degradation; a last resort"]
              ] },
              { t: "widget", id: "localTps" },
              { t: "note", variant: "trap", html: "<strong>A bigger model at Q4 often beats a smaller one at FP16</strong> for the same memory, but not always and not on every task. Compare candidates on your own eval set rather than trusting a rule of thumb." },
              { t: "compare",
                bad: { title: "Naive choice", items: ["Grab the smallest file so it surely fits", "Assume every 4-bit file is equal", "Never re-test after switching quant"] },
                good: { title: "Standout choice", items: ["Pick the largest model whose Q4_K_M or Q5_K_M fits with your context", "Prefer K-quants for GGUF, AWQ or GPTQ for GPU servers", "Run the same eval set across two or three quant levels and keep the cheapest that passes"] } },
              { t: "p", html: "Quantizing weights for inference is different from quantizing during training; QLoRA, which fine-tunes on top of a 4-bit base, is in <a class='inline' href='#/train/finetune/lora-peft'>LoRA, QLoRA and PEFT</a>." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \"I would start at Q4_K_M in GGUF for a laptop or Mac, or AWQ on a GPU server, check quality on our evals, and only step up to Q5 or Q8 if the task shows a measurable gap.\"" },
              { t: "quiz", id: "local-why" },
              { t: "note", variant: "key", html: "<strong>Fewer bits per weight means less memory and faster decode, at a small, measurable quality cost.</strong> GGUF K-quants for the llama.cpp family, AWQ or GPTQ for GPU servers, and your eval set decides how low you can go." }
            ]
          }
        ]
      },
      {
        id: "runtimes",
        name: "Runtimes & Setup",
        icon: "wrench",
        lessons: [
          {
            id: "runtimes",
            title: "Runtimes: Ollama, llama.cpp, LM Studio, vLLM and MLX",
            summary: "Five ways to run open-weight models, what each is built for, and how to pick one by user count and hardware.",
            minutes: 10,
            tags: ["ollama", "llama-cpp", "lm-studio", "vllm", "mlx", "serving"],
            blocks: [
              { t: "p", html: "A runtime is the program that loads weights, runs the forward pass and hands you tokens. They differ along two axes: <strong>who uses them</strong> (one developer versus many concurrent users) and <strong>what hardware they target</strong> (CPU and Mac versus datacenter GPUs)." },
              { t: "diagram", id: "local-stack", caption: "Weights file → runtime → local API → your app, IDE or agent. Swap any layer without touching the others." },
              { t: "table", headers: ["Runtime", "Best for", "Formats", "Interface", "Watch out for"], rows: [
                ["Ollama", "One developer, fast setup, scripting", "GGUF (pulls from its own library)", "CLI, REST on port 11434, OpenAI-compatible /v1", "Default context is modest; set it explicitly"],
                ["llama.cpp", "Maximum control, embedding in other tools, unusual hardware", "GGUF", "CLI and a built-in server with an OpenAI-compatible API", "More flags to learn; you manage model files"],
                ["LM Studio", "A GUI for browsing, testing and serving models", "GGUF, plus MLX on Mac", "Desktop app with a local OpenAI-compatible server", "Desktop-oriented; not a multi-user server"],
                ["vLLM", "High-throughput serving to many users on GPUs", "Hugging Face weights, AWQ, GPTQ and others", "OpenAI-compatible server", "Needs a capable GPU; heavier to operate"],
                ["MLX (mlx-lm)", "Apple Silicon, research and fine-tuning on a Mac", "MLX weights", "Python API and CLI, plus a simple server", "Mac-only"]
              ] },
              { t: "h", text: "Why vLLM is different" },
              { t: "p", html: "Single-user tools process one conversation at a time well. A server for fifty users must keep many sequences in flight. vLLM uses <strong>continuous batching</strong> (new requests join the running batch every step instead of waiting) and <strong>paged attention</strong>, which stores each sequence's KV cache in fixed-size pages rather than one contiguous block. That cuts wasted memory, so more sequences fit and GPU utilisation stays high." },
              { t: "code", lang: "bash", code:
                "# llama.cpp: serve a GGUF file, 8k context, all layers on the GPU\n" +
                "llama-server -m ./models/model-q4_k_m.gguf -c 8192 -ngl 99 --port 8080\n\n" +
                "# vLLM: an OpenAI-compatible server for many users (model id is an example)\n" +
                "vllm serve <org>/<model-name> --max-model-len 8192 --port 8000\n\n" +
                "# MLX on Apple Silicon (model id is an example)\n" +
                "python -m mlx_lm.generate --model <mlx-community/model-name> --prompt \"Summarise RAG in one line\""
              },
              { t: "h", text: "Choosing" },
              { t: "table", headers: ["Tier", "Choice", "Why"], rows: [
                ["Naive", "Whatever a blog post used", "Ignores concurrency and hardware"],
                ["Solid", "Ollama or LM Studio for one person; vLLM for a shared GPU server", "Matches the runtime to the number of users"],
                ["Standout", "Same OpenAI-compatible interface everywhere, so a laptop on Ollama and production on vLLM run the same client code", "Dev and prod differ only in base URL and model name"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas covers serving at system-design depth — batching, GPU capacity planning and autoscaling — in <em>HLD › AI &amp; ML › LLM systems &amp; serving</em>." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \"Just me on a laptop\" → Ollama or LM Studio. \"Embed inference inside our tool\" → llama.cpp. \"Hundreds of requests per minute on our GPUs\" → vLLM. \"Our team is all on Macs and wants to fine-tune\" → MLX." },
              { t: "note", variant: "key", html: "<strong>Pick the runtime by concurrency and hardware, then hide it behind an OpenAI-compatible API.</strong> Single-user tools for laptops, vLLM for shared GPUs, MLX for Apple Silicon — and your client code never needs to know which." }
            ]
          },
          {
            id: "ollama-setup",
            title: "Step by step: running a model with Ollama",
            summary: "Install, serve, pull, run, inspect, customise with a Modelfile and call the REST API — all on your own machine.",
            minutes: 12,
            tags: ["ollama", "setup", "modelfile", "rest-api", "hands-on"],
            blocks: [
              { t: "p", html: "Ollama wraps llama.cpp with a model library, a background server and a simple CLI. Think of it as a package manager plus a daemon: <code class='tok'>pull</code> downloads a model, the server keeps it loaded, and any program on your machine can talk to it." },
              { t: "h", text: "1. Install and start the server" },
              { t: "code", lang: "bash", code:
                "# macOS with Homebrew (or use the official desktop installer for macOS/Windows,\n" +
                "# or the official install script on Linux)\n" +
                "brew install ollama\n\n" +
                "# start the server in a terminal (the desktop app starts it for you)\n" +
                "ollama serve"
              },
              { t: "h", text: "2. Pull, run and inspect a model" },
              { t: "code", lang: "bash", code:
                "# model names are examples; browse the library for current ones\n" +
                "ollama pull llama3.2          # download a small instruct model, e.g. llama3.2\n" +
                "ollama run llama3.2           # interactive chat; type /bye to exit\n" +
                "ollama list                   # models on disk, with size\n" +
                "ollama ps                     # models loaded right now, and CPU vs GPU split\n" +
                "ollama show llama3.2          # parameters, context length, quantization, licence"
              },
              { t: "note", variant: "tip", html: "<code class='tok'>ollama ps</code> is the first debugging command. If it shows a CPU/GPU split rather than 100% GPU, the model plus context did not fit, and speed will suffer. Use a smaller model or quant, or a shorter context." },
              { t: "h", text: "3. Customise with a Modelfile" },
              { t: "code", lang: "text", code:
                "# Modelfile\n" +
                "FROM llama3.2\n" +
                "PARAMETER temperature 0.3\n" +
                "PARAMETER num_ctx 8192\n" +
                "SYSTEM \"\"\"You are a concise internal assistant. Answer in at most five sentences.\n" +
                "If you are not sure, say so instead of guessing.\"\"\""
              },
              { t: "code", lang: "bash", code:
                "ollama create my-assistant -f Modelfile\n" +
                "ollama run my-assistant \"Explain a KV cache in two sentences.\""
              },
              { t: "p", html: "<code class='tok'>FROM</code> picks the base weights, <code class='tok'>PARAMETER</code> sets defaults such as temperature and context length, and <code class='tok'>SYSTEM</code> bakes in a system prompt. The result is a named model every caller shares, which is a lightweight form of <a class='inline' href='#/prompt/systems/templates'>prompt versioning</a>." },
              { t: "h", text: "4. Call the REST API" },
              { t: "code", lang: "bash", code:
                "# one-shot generation\n" +
                "curl localhost:11434/api/generate -d '{\"model\":\"llama3.2\",\"prompt\":\"Why is the sky blue?\",\"stream\":false}'\n\n" +
                "# chat with roles\n" +
                "curl localhost:11434/api/chat -d '{\n" +
                "  \"model\": \"llama3.2\",\n" +
                "  \"messages\": [\n" +
                "    {\"role\": \"system\", \"content\": \"Answer in one sentence.\"},\n" +
                "    {\"role\": \"user\", \"content\": \"What is quantization?\"}\n" +
                "  ],\n" +
                "  \"stream\": false\n" +
                "}'"
              },
              { t: "p", html: "With <code class='tok'>\"stream\": false</code> you get one JSON object back (the text is in <code class='tok'>response</code> for generate and <code class='tok'>message.content</code> for chat). Leave streaming on in real apps so users see tokens as they arrive — see <a class='inline' href='#/api/basics/streaming'>streaming responses</a>." },
              { t: "note", variant: "warn", html: "Ollama listens only on the loopback interface by default, and the API has no authentication. Setting <code class='tok'>OLLAMA_HOST</code> to listen on all interfaces exposes an open model server to your network. If you must share it, put an authenticating reverse proxy in front." },
              { t: "note", variant: "key", html: "<strong>Install, serve, pull, run, check ps, then lock behaviour into a Modelfile.</strong> Ten minutes gets you a private model with a stable name, a pinned system prompt and a REST API on port 11434." }
            ]
          },
          {
            id: "local-endpoints",
            title: "OpenAI-compatible local endpoints, IDEs and RAG",
            summary: "Reuse the OpenAI client against a local server, point an IDE assistant at it, and build retrieval with a local embedding model.",
            minutes: 11,
            tags: ["openai-compatible", "ide", "local-rag", "embeddings", "chroma"],
            blocks: [
              { t: "p", html: "Most local runtimes speak the same wire format as the OpenAI chat API. That one fact is the whole lesson: if your code, IDE or agent can take a <strong>base URL</strong>, it can use a local model with no other change." },
              { t: "h", text: "The OpenAI client against Ollama" },
              { t: "code", lang: "python", code:
                "import os\n" +
                "from openai import OpenAI\n\n" +
                "base_url = os.environ.get(\"LLM_BASE_URL\", \"localhost:11434/v1\")\n" +
                "client = OpenAI(base_url=base_url, api_key=os.environ.get(\"LLM_API_KEY\", \"ollama\"))\n\n" +
                "resp = client.chat.completions.create(\n" +
                "    model=os.environ.get(\"LLM_MODEL\", \"llama3.2\"),\n" +
                "    messages=[\n" +
                "        {\"role\": \"system\", \"content\": \"You are terse.\"},\n" +
                "        {\"role\": \"user\", \"content\": \"Give one use for a local LLM.\"},\n" +
                "    ],\n" +
                "    temperature=0.2,\n" +
                ")\n" +
                "print(resp.choices[0].message.content)"
              },
              { t: "p", html: "Two details. First, set <code class='tok'>LLM_BASE_URL</code> to the full address including the scheme; the default above is written without one only because this atlas never embeds URLs, and the client needs the complete value. Second, the client library insists on an <code class='tok'>api_key</code>, but Ollama ignores it, so <code class='tok'>\"ollama\"</code> is just a placeholder. For a hosted provider, the same variable holds a real key from your secret store — never in source." },
              { t: "table", headers: ["Runtime", "Typical OpenAI-compatible base path"], rows: [
                ["Ollama", "localhost:11434/v1"],
                ["llama.cpp server", "localhost:8080/v1"],
                ["LM Studio server", "localhost:1234/v1"],
                ["vLLM", "localhost:8000/v1"]
              ] },
              { t: "h", text: "A local model in your IDE" },
              { t: "ul", items: [
                "Many IDE assistants and agent tools, including Continue-style open extensions, let you add a provider of type \"OpenAI-compatible\" with a custom base URL and model name.",
                "Point it at the local base URL above and pick the model you pulled, for example a code-tuned model for completion and a general instruct model for chat.",
                "Use a small, fast model for inline completion (latency matters) and a larger one for chat or agent tasks (quality matters).",
                "Check what still leaves the machine: some hosted IDE features route through the vendor's cloud regardless of the model setting."
              ] },
              { t: "note", variant: "trap", html: "<strong>Small local models struggle with agentic tool calling.</strong> Multi-step edits with tool calls are where the quality gap shows most. Try local for completion and Q&amp;A first, and evaluate before trusting it with an <a class='inline' href='#/agent/loop/react'>agent loop</a>." },
              { t: "h", text: "Fully local RAG" },
              { t: "code", lang: "bash", code: "ollama pull nomic-embed-text    # a small embedding model, e.g. nomic-embed-text" },
              { t: "code", lang: "python", code:
                "import os\n" +
                "import chromadb\n" +
                "from openai import OpenAI\n\n" +
                "client = OpenAI(base_url=os.environ.get(\"LLM_BASE_URL\", \"localhost:11434/v1\"), api_key=\"ollama\")\n" +
                "EMBED = \"nomic-embed-text\"\n\n" +
                "def embed(texts):\n" +
                "    return [d.embedding for d in client.embeddings.create(model=EMBED, input=texts).data]\n\n" +
                "docs = [\"Refunds are accepted within 30 days of delivery.\",\n" +
                "        \"Support hours are 9 to 5, Monday to Friday.\"]\n" +
                "db = chromadb.PersistentClient(path=\"./rag-index\")\n" +
                "col = db.get_or_create_collection(\"handbook\")\n" +
                "col.add(ids=[\"d1\", \"d2\"], documents=docs, embeddings=embed(docs))\n\n" +
                "question = \"How long do I have to return an item?\"\n" +
                "hits = col.query(query_embeddings=embed([question]), n_results=2)\n" +
                "context = \"\\n\".join(hits[\"documents\"][0])\n\n" +
                "answer = client.chat.completions.create(\n" +
                "    model=\"llama3.2\",\n" +
                "    messages=[{\"role\": \"system\", \"content\": \"Answer only from the context. Say 'not found' otherwise.\"},\n" +
                "              {\"role\": \"user\", \"content\": \"Context:\\n\" + context + \"\\n\\nQuestion: \" + question}],\n" +
                ")\n" +
                "print(answer.choices[0].message.content)"
              },
              { t: "p", html: "Every piece runs on your machine: the embedding model, the vector store (Chroma here; FAISS is a library-only alternative) and the chat model. The retrieval design choices — chunking, hybrid search, reranking — are the same as in the cloud and live in <a class='inline' href='#/rag/retrieval/vector-dbs'>embeddings and vector databases</a>." },
              { t: "note", variant: "tip", html: "<strong>Interview cue.</strong> \"Because the local server is OpenAI-compatible, moving between local and hosted is a base URL and a model name in config. I keep both in environment variables and run the same eval set against each before switching.\"" },
              { t: "quiz", id: "local-runtimes" },
              { t: "note", variant: "key", html: "<strong>One interface, many backends.</strong> Put the base URL and model in config, use a local embedding model consistently at index and query time, and evaluate the local model before handing it agent-level work." }
            ]
          }
        ]
      }
    ]
  };
})();
